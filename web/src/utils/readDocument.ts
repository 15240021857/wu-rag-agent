import { normalizeDocumentText } from '@/utils/chunk'

const TEXT_EXT = new Set(['md', 'markdown', 'txt', 'csv', 'json', 'log'])
const MAX_SIZE = 8 * 1024 * 1024

export interface ParsedDocument {
  fileName: string
  fileType: string
  size: number
  content: string
}

export async function readDocumentFile(file: File): Promise<ParsedDocument> {
  const fileType = extensionOf(file.name)
  if (file.size > MAX_SIZE) throw new Error('文件不能超过 8MB')
  if (!fileType) throw new Error('无法识别文件类型')
  if (TEXT_EXT.has(fileType)) {
    const content = normalizeDocumentText(await file.text())
    if (!content) throw new Error('文件内容为空')
    return { fileName: file.name, fileType, size: file.size, content }
  }
  if (fileType === 'pdf') {
    const content = normalizeDocumentText(await extractPdfText(await file.arrayBuffer()))
    if (content.length < 2) throw new Error('没有解析出可复制文本，请换用 md 或 txt')
    return { fileName: file.name, fileType, size: file.size, content }
  }
  throw new Error('仅支持 md、txt、csv、json、pdf')
}

export async function extractPdfText(data: ArrayBuffer) {
  const bytes = new Uint8Array(data)
  const streams = await collectStreamTexts(bytes)
  const source = streams.length ? streams.join('\n') : decodeLatin1(bytes)
  return cleanup(extractOperators(source))
}

function extensionOf(name: string) {
  const base = name.split(/[/\\]/).pop() ?? ''
  const index = base.lastIndexOf('.')
  if (index < 0) return ''
  return base.slice(index + 1).toLowerCase()
}

async function collectStreamTexts(bytes: Uint8Array) {
  const raw = decodeLatin1(bytes)
  const texts: string[] = []
  let cursor = 0
  while (cursor < raw.length) {
    const at = raw.indexOf('stream', cursor)
    if (at < 0) break
    const before = raw.slice(Math.max(0, at - 400), at)
    if (!before.includes('<<')) {
      cursor = at + 6
      continue
    }
    let dataStart = at + 'stream'.length
    if (raw[dataStart] === '\r') dataStart += 1
    if (raw[dataStart] === '\n') dataStart += 1
    const end = raw.indexOf('endstream', dataStart)
    if (end < 0) break
    const length = streamLength(before, end - dataStart)
    const slice = bytes.subarray(dataStart, Math.min(bytes.length, dataStart + length))
    let decoded = ''
    if (before.includes('/FlateDecode')) decoded = await inflatePdf(slice)
    else if (!/\/Filter/.test(before)) decoded = decodeLatin1(slice)
    if (decoded) texts.push(decoded)
    cursor = end + 'endstream'.length
  }
  return texts
}

function streamLength(header: string, fallback: number) {
  const matches = header.match(/\/Length\s+(\d+)(?!\s+\d+\s+R)/g)
  if (!matches?.length) return fallback
  const last = matches[matches.length - 1] ?? ''
  const value = Number(last.replace(/\/Length\s+/, ''))
  if (!Number.isFinite(value) || value <= 0) return fallback
  return value
}

async function inflatePdf(bytes: Uint8Array) {
  if (typeof DecompressionStream === 'undefined') return ''
  const candidates = [bytes, bytes.subarray(2)].filter((item) => item.length > 0)
  const formats: CompressionFormat[] = ['deflate', 'deflate-raw']
  for (const candidate of candidates) {
    for (const format of formats) {
      try {
        const inflated = await inflate(candidate, format)
        const text = decodeLatin1(inflated)
        if (text.includes('Tj') || text.includes('TJ')) return text
      } catch {
        // 换一种 deflate 包装再试
      }
    }
  }
  return ''
}

async function inflate(bytes: Uint8Array, format: CompressionFormat) {
  const copy = new Uint8Array(bytes)
  const stream = new Blob([copy.buffer]).stream().pipeThrough(new DecompressionStream(format))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

function decodeLatin1(bytes: Uint8Array) {
  let text = ''
  const step = 0x8000
  for (let offset = 0; offset < bytes.length; offset += step) {
    const slice = bytes.subarray(offset, offset + step)
    text += String.fromCharCode(...Array.from(slice))
  }
  return text
}

function extractOperators(source: string) {
  const parts: string[] = []
  let index = 0
  while (index < source.length) {
    const current = source[index]
    if (current === '(') {
      const literal = readLiteral(source, index)
      if (!literal) {
        index += 1
        continue
      }
      if (isOperator(source, literal.end, 'Tj')) parts.push(repairText(literal.text))
      index = literal.end
      continue
    }
    if (current === '<') {
      const hex = readHex(source, index)
      if (!hex) {
        index += 1
        continue
      }
      if (isOperator(source, hex.end, 'Tj')) parts.push(hex.text)
      index = hex.end
      continue
    }
    if (current === '[') {
      const array = readTextArray(source, index)
      if (array && isOperator(source, array.end, 'TJ')) parts.push(array.text)
      index = array ? array.end : index + 1
      continue
    }
    index += 1
  }
  return parts.join('')
}

function isOperator(source: string, offset: number, name: string) {
  return new RegExp(`^\\s*${name}\\b`).test(source.slice(offset, offset + name.length + 6))
}

function readLiteral(source: string, start: number) {
  if (source[start] !== '(') return null
  let text = ''
  let depth = 1
  let index = start + 1
  while (index < source.length && depth > 0) {
    const current = source[index] ?? ''
    if (current === '\\') {
      const next = source[index + 1] ?? ''
      if (/[0-7]/.test(next)) {
        let octal = next
        if (/[0-7]/.test(source[index + 2] ?? '')) octal += source[index + 2]
        if (/[0-7]/.test(source[index + 3] ?? '')) octal += source[index + 3]
        text += String.fromCharCode(Number.parseInt(octal, 8))
        index += 1 + octal.length
        continue
      }
      const escaped: Record<string, string> = {
        n: '\n',
        r: '\r',
        t: '\t',
        b: '\b',
        f: '\f',
        '(': '(',
        ')': ')',
        '\\': '\\',
      }
      text += escaped[next] ?? next
      index += 2
      continue
    }
    if (current === '(') {
      depth += 1
      text += current
      index += 1
      continue
    }
    if (current === ')') {
      depth -= 1
      if (depth === 0) return { text, end: index + 1 }
      text += current
      index += 1
      continue
    }
    text += current
    index += 1
  }
  return null
}

function readHex(source: string, start: number) {
  if (source[start] !== '<' || source[start + 1] === '<') return null
  const end = source.indexOf('>', start + 1)
  if (end < 0) return null
  const hex = source.slice(start + 1, end).replace(/\s+/g, '')
  if (hex.length < 2 || /[^0-9a-fA-F]/.test(hex)) return null
  const bytes: number[] = []
  for (let index = 0; index + 1 < hex.length; index += 2) {
    bytes.push(Number.parseInt(hex.slice(index, index + 2), 16))
  }
  return { text: decodeHexBytes(bytes), end: end + 1 }
}

function decodeHexBytes(bytes: number[]) {
  const first = bytes[0] ?? 0
  const second = bytes[1] ?? 0
  if (bytes.length >= 4 && first === 0xfe && second === 0xff) {
    let text = ''
    for (let index = 2; index + 1 < bytes.length; index += 2) {
      text += String.fromCharCode(((bytes[index] ?? 0) << 8) | (bytes[index + 1] ?? 0))
    }
    return text
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(Uint8Array.from(bytes))
}

function readTextArray(source: string, start: number) {
  if (source[start] !== '[') return null
  let text = ''
  let index = start + 1
  while (index < source.length) {
    const current = source[index]
    if (current === ']') return { text, end: index + 1 }
    if (current === '(') {
      const literal = readLiteral(source, index)
      if (!literal) return null
      text += repairText(literal.text)
      index = literal.end
      continue
    }
    if (current === '<') {
      const hex = readHex(source, index)
      if (!hex) return null
      text += hex.text
      index = hex.end
      continue
    }
    index += 1
  }
  return null
}

function repairText(text: string) {
  if ([...text].some((char) => char.charCodeAt(0) > 255)) return text
  const bytes = Uint8Array.from(text, (char) => char.charCodeAt(0) & 0xff)
  const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
  const cjk = (value: string) => (value.match(/[\u4e00-\u9fff]/g) ?? []).length
  return cjk(decoded) > cjk(text) ? decoded : text
}

function cleanup(text: string) {
  return text.split('\u0000').join('').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

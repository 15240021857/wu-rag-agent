import type { ChunkMethod } from '@/types/rag'

export interface TextChunk {
  index: number
  content: string
  charCount: number
}

export function normalizeChunkSize(chunkSize: number) {
  if (!Number.isFinite(chunkSize)) return 1024
  return Math.min(4000, Math.max(100, Math.floor(chunkSize)))
}

export function normalizeDocumentText(text: string) {
  return text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').trim()
}

export function decodeChunkSeparator(input: string) {
  const marker = '\u0000'
  return input
    .replace(/\\\\/g, marker)
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .split(marker)
    .join('\\')
}

export function splitChunks(text: string, method: ChunkMethod, chunkSize: number, separator = '\\n'): TextChunk[] {
  const size = normalizeChunkSize(chunkSize)
  const source = normalizeDocumentText(text)
  if (!source) return []
  const parts = method === 'FIXED' ? cutFixed(source, size) : cutByCharacter(source, separator, size)
  const normalized = method === 'CHAR' ? parts.map((item) => item.trim()) : parts
  const kept = normalized.filter((item) => item.length > 0 && !isBlankChunk(item, method, separator))
  return kept.map((content, index) => ({
    index: index + 1,
    content,
    charCount: content.length,
  }))
}

export function chunkUsesFallback(text: string, method: ChunkMethod, separator: string) {
  if (method !== 'CHAR') return false
  const decoded = decodeChunkSeparator(separator)
  if (!decoded) return true
  return !normalizeDocumentText(text).includes(decoded)
}

export function formatChunkNotes(chunks: Array<{ index: number; content: string }>) {
  return chunks.map((item) => `<!-- chunk${item.index} -->\n${item.content}`).join('\n\n')
}

function isBlankChunk(part: string, method: ChunkMethod, separator: string) {
  if (method === 'FIXED') return part.trim().length === 0
  const decoded = decodeChunkSeparator(separator)
  const stripped = decoded ? part.split(decoded).join('') : part
  return stripped.trim().length === 0
}

function cutFixed(text: string, size: number) {
  const parts: string[] = []
  for (let offset = 0; offset < text.length; offset += size) {
    parts.push(text.slice(offset, offset + size))
  }
  return parts
}

function cutByCharacter(text: string, separator: string, size: number) {
  const decoded = decodeChunkSeparator(separator)
  if (!decoded || !text.includes(decoded)) return cutFixed(text, size)
  const parts: string[] = []
  let start = 0
  while (start < text.length) {
    const at = text.indexOf(decoded, start)
    if (at < 0) {
      parts.push(text.slice(start))
      break
    }
    if (at > start) parts.push(text.slice(start, at))
    start = at + decoded.length
  }
  return parts
}

export interface TextRun {
  kind: 'text'
  text: string
}

export interface BoldRun {
  kind: 'bold'
  text: string
}

export interface CiteRun {
  kind: 'cite'
  n: number
}

export type Run = TextRun | BoldRun | CiteRun

export interface ParagraphBlock {
  kind: 'p'
  runs: Run[]
}

export interface ListBlock {
  kind: 'ol' | 'ul'
  items: Run[][]
}

export interface CalloutBlock {
  kind: 'callout'
  runs: Run[]
}

export type AnswerBlock = ParagraphBlock | ListBlock | CalloutBlock

const ORDERED = /^(\d{1,2})[.、]\s+(\S.*)$/
const UNORDERED = /^[-*•]\s+(\S.*)$/
const CALLOUT = /^(?:⚠️|⚠)/
const HEADING = /^#{1,6}\s+(\S.*)$/

const SUPERSCRIPTS: Record<string, string> = {
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
}

// 按行把模型回答收成块。优先认列表、提示和标题，剩下的连续正文合成段落。
// 空行不单独成块，只用来把前后两段切开。parseRuns 再把每行里的 [1] 和 **加粗** 拆开。
export function renderAnswer(content: string): AnswerBlock[] {
  const lines = content.replace(/\r\n/g, '\n').split('\n')
  const blocks: AnswerBlock[] = []
  let index = 0
  while (index < lines.length) {
    const line = lines[index] ?? ''
    if (!line.trim()) {
      index += 1
      continue
    }
    // 「1. 」「2、」必须连续。中间插入别的行就会结束这个有序列表。
    if (ORDERED.test(line)) {
      const items: Run[][] = []
      while (index < lines.length && ORDERED.test(lines[index] ?? '')) {
        const match = ORDERED.exec(lines[index] ?? '')
        items.push(parseRuns(match?.[2] ?? ''))
        index += 1
      }
      blocks.push({ kind: 'ol', items })
      continue
    }
    // 「- 」「* 」「• 」同样收成一个无序列表，规则和上面相同。
    if (UNORDERED.test(line)) {
      const items: Run[][] = []
      while (index < lines.length && UNORDERED.test(lines[index] ?? '')) {
        const match = UNORDERED.exec(lines[index] ?? '')
        items.push(parseRuns(match?.[1] ?? ''))
        index += 1
      }
      blocks.push({ kind: 'ul', items })
      continue
    }
    // 以 ⚠ 开头的一行单独做成提示块，不并进前后段落。
    if (CALLOUT.test(line)) {
      blocks.push({ kind: 'callout', runs: parseRuns(line) })
      index += 1
      continue
    }
    // 「# 标题」不保留标题级别，压成加粗段落。
    const heading = HEADING.exec(line)
    if (heading?.[1]) {
      blocks.push({ kind: 'p', runs: [{ kind: 'bold', text: heading[1] }] })
      index += 1
      continue
    }
    // 其余连续非空行合成一段，直到空行，或碰到列表、提示、标题。
    const paragraph: string[] = []
    while (index < lines.length) {
      const current = lines[index] ?? ''
      if (!current.trim() || ORDERED.test(current) || UNORDERED.test(current) || CALLOUT.test(current) || HEADING.test(current)) break
      paragraph.push(current)
      index += 1
    }
    blocks.push({ kind: 'p', runs: parseRuns(paragraph.join('\n')) })
  }
  return blocks
}

export function leadingHeadings(content: string): string[] {
  const headings: string[] = []
  for (const line of content.replace(/\r\n/g, '\n').split('\n')) {
    const match = HEADING.exec(line.trim())
    if (match?.[1]) {
      headings.push(match[1].trim())
      continue
    }
    if (!line.trim() && !headings.length) continue
    break
  }
  return headings.slice(0, 5)
}

export function clauseBody(content: string): string {
  const lines = content.replace(/\r\n/g, '\n').split('\n')
  let index = 0
  let seenHeading = false
  while (index < lines.length) {
    const line = lines[index] ?? ''
    if (!line.trim()) {
      if (seenHeading) break
      index += 1
      continue
    }
    if (HEADING.test(line.trim())) {
      seenHeading = true
      index += 1
      continue
    }
    break
  }
  const body = seenHeading ? lines.slice(index).join('\n').trim() : content
  return displayClause(body || content)
}

function parseRuns(text: string): Run[] {
  const runs: Run[] = []
  const chunks = text.split(/(\[\d{1,2}\]|【\d{1,2}】)/g)
  for (const chunk of chunks) {
    if (!chunk) continue
    const cite = /^(?:\[(\d{1,2})\]|【(\d{1,2})】)$/.exec(chunk)
    const number = cite?.[1] ?? cite?.[2]
    if (number) {
      runs.push({ kind: 'cite', n: Number(number) })
      continue
    }
    runs.push(...parseBold(chunk))
  }
  return runs
}

function parseBold(text: string): Run[] {
  const runs: Run[] = []
  const pattern = /\*\*(.+?)\*\*/g
  let last = 0
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0
    if (start > last) runs.push({ kind: 'text', text: text.slice(last, start) })
    if (match[1]) runs.push({ kind: 'bold', text: match[1] })
    last = start + match[0].length
  }
  if (last < text.length) runs.push({ kind: 'text', text: text.slice(last) })
  return runs
}

function displayClause(content: string) {
  return content
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<sup>\s*([^<]*)\s*<\/sup>/gi, (_, inner: string) => toSuperscript(inner))
    .replace(/<\/?(?:sub|p|div|span|b|strong|em|i)\b[^>]*>/gi, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .trim()
}

function toSuperscript(value: string) {
  return [...value].map((char) => SUPERSCRIPTS[char] ?? char).join('')
}

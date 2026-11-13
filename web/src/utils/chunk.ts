export function formatChunkNotes(chunks: Array<{ index: number; content: string }>) {
  return chunks.map((item) => `<!-- chunk${item.index} -->\n${item.content}`).join('\n\n')
}

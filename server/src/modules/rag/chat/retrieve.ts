export interface IncomingCitation {
  documentId: string;
  chunkIndex: number;
  content: string;
}

export type SsePiece =
  | { kind: 'text'; text: string }
  | { kind: 'citations'; citations: IncomingCitation[] }
  | { kind: 'error'; message: string }
  | { kind: 'done' };

export function readSse(buffer: string): { pieces: SsePiece[]; rest: string } {
  const blocks = buffer.split('\n\n');
  const rest = blocks.pop() ?? '';
  const pieces: SsePiece[] = [];
  for (const block of blocks) {
    const piece = readBlock(block);
    if (piece) pieces.push(piece);
  }
  return { pieces, rest };
}

function readBlock(block: string): SsePiece | undefined {
  const data = block
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice('data:'.length).trimStart())
    .join('\n');
  if (!data) return undefined;
  if (data === '[DONE]') return { kind: 'done' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return undefined;
  }
  if (!isRecord(parsed)) return undefined;
  if (typeof parsed.error === 'string') {
    return { kind: 'error', message: parsed.error };
  }
  const citations = readCitations(parsed.citations);
  if (citations) return { kind: 'citations', citations };
  if (typeof parsed.text === 'string') {
    return { kind: 'text', text: parsed.text };
  }
  return undefined;
}

function readCitations(value: unknown): IncomingCitation[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const citations: IncomingCitation[] = [];
  for (const [index, item] of value.entries()) {
    if (!isRecord(item)) continue;
    if (typeof item.documentId !== 'string' || typeof item.content !== 'string') {
      continue;
    }
    if (!item.content.trim()) continue;
    const chunkIndex =
      typeof item.chunkIndex === 'number' && Number.isFinite(item.chunkIndex)
        ? item.chunkIndex
        : index;
    citations.push({
      documentId: item.documentId,
      chunkIndex,
      content: item.content,
    });
  }
  return citations.length ? citations : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

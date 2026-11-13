import { BadRequestException } from '@nestjs/common';
import { ChunkMethod } from '@prisma/client';

const FILE_TYPES = new Set([
  'md',
  'markdown',
  'txt',
  'csv',
  'json',
  'log',
  'pdf',
]);

export interface ChunkDraft {
  chunkMethod: ChunkMethod;
  chunkSeparator: string;
  chunkSize: number;
  chunks: string[];
}

export function normalizeFileType(fileType: string) {
  return fileType.trim().toLowerCase();
}

export function assertFileType(fileType: string) {
  if (!FILE_TYPES.has(fileType)) {
    throw new BadRequestException(
      '仅支持 md、markdown、txt、csv、json、log、pdf',
    );
  }
}

export function separatorOf(input: ChunkDraft) {
  return input.chunkMethod === ChunkMethod.CHAR ? input.chunkSeparator : '';
}

export function assertChunks(content: string, input: ChunkDraft) {
  if (input.chunkSize < 100 || input.chunkSize > 4000) {
    throw new BadRequestException('最大分片字符数需在 100 到 4000 之间');
  }
  if (input.chunkMethod === ChunkMethod.CHAR && !input.chunkSeparator) {
    throw new BadRequestException('请填写切分字符');
  }
  if (input.chunkSeparator.length > 20) {
    throw new BadRequestException('切分字符过长');
  }
  if (input.chunks.length === 0 || input.chunks.length > 2000) {
    throw new BadRequestException('请先生成分片');
  }
  if (input.chunks.some((item) => item.length === 0)) {
    throw new BadRequestException('存在空分片');
  }
  if (input.chunks.some((item) => isIgnorableChunk(item, input))) {
    throw new BadRequestException('存在仅含切分字符或空格的分片');
  }
  if (
    input.chunkMethod === ChunkMethod.FIXED &&
    input.chunks.some((item) => item.length > input.chunkSize)
  ) {
    throw new BadRequestException('存在超过最大字符数的分片');
  }
  if (!chunksFollowContent(content, input)) {
    throw new BadRequestException('分片与文档内容不一致');
  }
}

function chunksFollowContent(content: string, input: ChunkDraft) {
  let cursor = 0;
  for (const chunk of input.chunks) {
    const at = content.indexOf(chunk, cursor);
    if (at < 0) return false;
    if (!isIgnorableChunk(content.slice(cursor, at), input)) return false;
    cursor = at + chunk.length;
  }
  return isIgnorableChunk(content.slice(cursor), input);
}

function isIgnorableChunk(text: string, input: ChunkDraft) {
  if (!text) return true;
  if (input.chunkMethod === ChunkMethod.FIXED) return text.trim().length === 0;
  const decoded = decodeSeparator(input.chunkSeparator);
  const stripped = decoded ? text.split(decoded).join('') : text;
  return stripped.trim().length === 0;
}

function decodeSeparator(input: string) {
  const marker = '\u0000';
  return input
    .replace(/\\\\/g, marker)
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .split(marker)
    .join('\\');
}

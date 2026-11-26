import { BadRequestException } from '@nestjs/common';
import { ChunkMethod } from '@prisma/client';

/** 上传失败时返回的格式说明，和前端提示保持同一句。 */
export const DOCUMENT_TYPE_MESSAGE =
  '仅支持 txt、md、pdf、docx、xlsx、csv、ppt';

/** 这些后缀按 UTF-8 文本存进 content，预览直接显示原文。 */
const TEXT_TYPES = new Set(['txt', 'md']);

/**
 * 这些后缀不能当文本解码。content 暂存 base64，入库时还原成原字节。
 * csv 也在这里：Python 把 csv 交给 MinerU，不能先转成 UTF-8 字符串。
 */
const BINARY_TYPES = new Set(['pdf', 'docx', 'xlsx', 'csv', 'ppt']);

/** markdown 只是上传别名，入库文件名和 fileType 都记成 md。 */
const UPLOAD_SUFFIXES = new Set([...TEXT_TYPES, 'markdown', ...BINARY_TYPES]);

const FILE_TYPES = new Set([...TEXT_TYPES, ...BINARY_TYPES]);

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
  if (!FILE_TYPES.has(normalizeFileType(fileType))) {
    throw new BadRequestException(DOCUMENT_TYPE_MESSAGE);
  }
}

export function isBinaryFileType(fileType: string) {
  return BINARY_TYPES.has(normalizeFileType(fileType));
}

/** 按库里的 fileType 把 content 还原成要发给 Python 的字节。 */
export function documentBytes(fileType: string, content: string) {
  return isBinaryFileType(fileType)
    ? Buffer.from(content, 'base64')
    : Buffer.from(content, 'utf8');
}

/**
 * 校验上传文件名，并把后缀规范成 Python 能识别的小写形式。
 * Report.PDF 存成 Report.pdf，笔记.markdown 存成 笔记.md。
 */
export function normalizeUploadName(originalName: string) {
  const base = originalName.replace(/\\/g, '/').split('/').pop()?.trim() ?? '';
  if (!base) throw new BadRequestException('请上传文档');
  if (base.length > 120) throw new BadRequestException('文件名过长');
  const dot = base.lastIndexOf('.');
  const suffix = dot >= 0 ? base.slice(dot + 1).toLowerCase() : '';
  if (!UPLOAD_SUFFIXES.has(suffix)) {
    throw new BadRequestException(DOCUMENT_TYPE_MESSAGE);
  }
  const storedSuffix = suffix === 'markdown' ? 'md' : suffix;
  return {
    fileName: `${base.slice(0, dot)}.${storedSuffix}`,
    fileType: storedSuffix,
  };
}

/** 发给 Python 的文件名必须带它认识的小写后缀，旧的 .markdown 在这里改成 .md。 */
export function toIngestFileName(fileName: string) {
  const dot = fileName.lastIndexOf('.');
  if (dot < 0) return fileName;
  const suffix = fileName.slice(dot + 1).toLowerCase();
  const stored = suffix === 'markdown' ? 'md' : suffix;
  return `${fileName.slice(0, dot)}.${stored}`;
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

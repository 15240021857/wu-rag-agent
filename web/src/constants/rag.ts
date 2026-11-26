import type { ChunkMethod, KnowledgeVisibility, VectorStatus } from '@/types/rag'

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024

/** 向量化状态轮询间隔。解析和入库通常要数秒，3 秒查一次即可。 */
export const VECTOR_POLL_MS = 3000

export const DOCUMENT_TYPE_MESSAGE = '仅支持 txt、md、pdf、docx、xlsx、csv、ppt'

export const DOCUMENT_ACCEPT = '.txt,.md,.markdown,.pdf,.docx,.xlsx,.csv,.ppt'

const DOCUMENT_SUFFIXES = new Set(['txt', 'md', 'markdown', 'pdf', 'docx', 'xlsx', 'csv', 'ppt'])

const TEXT_PREVIEW_TYPES = new Set(['txt', 'md', 'markdown'])

export function isAcceptedDocument(name: string) {
  const base = name.split(/[/\\]/).pop()?.trim().toLowerCase() ?? ''
  const dot = base.lastIndexOf('.')
  const suffix = dot >= 0 ? base.slice(dot + 1) : ''
  return DOCUMENT_SUFFIXES.has(suffix)
}

export function previewsAsText(fileType: string) {
  return TEXT_PREVIEW_TYPES.has(fileType.trim().toLowerCase())
}

export const CHUNK_METHOD_OPTIONS: Array<{ label: string; value: ChunkMethod }> = [
  { label: '字符切分', value: 'CHAR' },
  { label: '固定字符切分', value: 'FIXED' },
]

export const VECTOR_STATUS_OPTIONS: Array<{ label: string; value: VectorStatus }> = [
  { label: '向量化中', value: 'PROCESSING' },
  { label: '已完成', value: 'READY' },
  { label: '失败', value: 'FAILED' },
]

const VISIBILITY_LABEL: Record<KnowledgeVisibility, string> = {
  PUBLIC: '公开',
  CUSTOM: '自定义',
}

export function chunkMethodLabel(value: ChunkMethod) {
  return CHUNK_METHOD_OPTIONS.find((item) => item.value === value)?.label ?? value
}

export function vectorStatusLabel(value: VectorStatus) {
  return VECTOR_STATUS_OPTIONS.find((item) => item.value === value)?.label ?? value
}

export function visibilityLabel(value: KnowledgeVisibility) {
  return VISIBILITY_LABEL[value]
}

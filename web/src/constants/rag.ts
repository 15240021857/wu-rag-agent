import type { ChunkMethod, KnowledgeVisibility, VectorStatus } from '@/types/rag'

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

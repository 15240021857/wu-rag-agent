import type { PageQuery } from './api'

export type ChunkMethod = 'CHAR' | 'FIXED'
export type KnowledgeVisibility = 'PUBLIC' | 'CUSTOM'
export type VectorStatus = 'PROCESSING' | 'READY' | 'FAILED'

export interface Knowledge {
  id: string
  name: string
  description: string
  visibility: KnowledgeVisibility
  ownerId: string
  ownerName: string
  documentCount: number
  updatedAt: string
}

export interface KnowledgePayload {
  name: string
  description: string
}

export interface KnowledgeQuery extends PageQuery {
  name: string
}

export interface DocumentChunk {
  index: number
  content: string
  charCount: number
}

export interface KnowledgeDocument {
  id: string
  knowledgeId: string
  knowledgeName: string
  fileName: string
  fileType: string
  size: number
  chunkMethod: ChunkMethod
  chunkSeparator: string
  chunkSize: number
  chunkCount: number
  vectorStatus: VectorStatus
  ready: boolean
  progress: number
  updatedAt: string
}

export interface DocumentDetail extends KnowledgeDocument {
  content: string
  chunks: DocumentChunk[]
}

export interface DocumentPayload {
  knowledgeId: string
  fileName: string
  fileType: string
  size: number
  content: string
  chunkMethod: ChunkMethod
  chunkSeparator: string
  chunkSize: number
  chunks: Array<{ content: string }>
}

export interface RevectorizePayload {
  chunkMethod: ChunkMethod
  chunkSeparator: string
  chunkSize: number
  chunks: Array<{ content: string }>
}

export interface DocumentQuery extends PageQuery {
  knowledgeId: string
  fileName: string
  vectorStatus: VectorStatus | ''
}

export interface Citation {
  documentId: string
  documentName: string
  chunkIndex: number
  content: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  citations?: Citation[]
}

export interface ConversationSummary {
  id: string
  title: string
  knowledgeId: string
  knowledgeName: string
  updatedAt: string
}

export interface ConversationDetail extends ConversationSummary {
  systemPrompt: string
  messages: ChatMessage[]
}

export interface ChatPayload {
  conversationId?: string
  knowledgeId: string
  systemPrompt: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
}

import type { PageResult } from '@/types/api'
import type {
  ChatPayload,
  ConversationDetail,
  ConversationSummary,
  DocumentDetail,
  DocumentPayload,
  DocumentQuery,
  Knowledge,
  KnowledgeDocument,
  KnowledgePayload,
  KnowledgeQuery,
  RevectorizePayload,
} from '@/types/rag'
import { http } from '@/utils/request'

export function fetchKnowledges(params: KnowledgeQuery) {
  return http<PageResult<Knowledge>>({ url: '/rag/knowledges', method: 'GET', params })
}

export function createKnowledge(data: KnowledgePayload) {
  return http<Knowledge>({ url: '/rag/knowledges', method: 'POST', data })
}

export function updateKnowledge(id: string, data: KnowledgePayload) {
  return http<Knowledge>({ url: `/rag/knowledges/${id}`, method: 'PUT', data })
}

export function deleteKnowledge(id: string) {
  return http<null>({ url: `/rag/knowledges/${id}`, method: 'DELETE' })
}

export function fetchDocuments(params: DocumentQuery) {
  return http<PageResult<KnowledgeDocument>>({ url: '/rag/documents', method: 'GET', params })
}

export function fetchDocument(id: string) {
  return http<KnowledgeDocument>({ url: `/rag/documents/${id}`, method: 'GET' })
}

export function fetchDocumentDetail(id: string) {
  return http<DocumentDetail>({ url: `/rag/documents/${id}/detail`, method: 'GET' })
}

export function createDocument(data: DocumentPayload) {
  return http<KnowledgeDocument>({ url: '/rag/documents', method: 'POST', data })
}

export function revectorizeDocument(id: string, data: RevectorizePayload) {
  return http<KnowledgeDocument>({ url: `/rag/documents/${id}/vectorize`, method: 'POST', data })
}

export function deleteDocument(id: string) {
  return http<null>({ url: `/rag/documents/${id}`, method: 'DELETE' })
}

export function fetchConversations() {
  return http<ConversationSummary[]>({ url: '/rag/conversations', method: 'GET' })
}

export function fetchConversation(id: string) {
  return http<ConversationDetail>({ url: `/rag/conversations/${id}`, method: 'GET' })
}

export function deleteConversation(id: string) {
  return http<null>({ url: `/rag/conversations/${id}`, method: 'DELETE' })
}

export function sendChat(data: ChatPayload) {
  return http<ConversationDetail>({ url: '/rag/chat', method: 'POST', data })
}

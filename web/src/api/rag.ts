import type { ApiResponse, PageResult } from '@/types/api'
import type {
  ChatPayload,
  ChatStreamEvent,
  Citation,
  ConversationDetail,
  ConversationSummary,
  DocumentDetail,
  DocumentQuery,
  Knowledge,
  KnowledgeDocument,
  KnowledgePayload,
  KnowledgeQuery,
} from '@/types/rag'
import { apiBase, getToken, http, rejectApi } from '@/utils/request'

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

export function createDocument(knowledgeId: string, file: File) {
  const body = new FormData()
  body.append('file', file)
  body.append('knowledgeId', knowledgeId)
  return http<KnowledgeDocument>({
    url: '/rag/documents',
    method: 'POST',
    data: body,
    timeout: 120_000,
  })
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

export async function sendChat(data: ChatPayload, onEvent: (event: ChatStreamEvent) => void, signal?: AbortSignal) {
  let response: Response
  try {
    const token = getToken()
    response = await fetch(`${apiBase()}/rag/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(data),
      signal,
    })
  } catch {
    throw rejectApi(0, undefined)
  }
  const contentType = response.headers.get('content-type') ?? ''
  if (!response.ok || !contentType.includes('text/event-stream')) {
    throw rejectApi(response.status, await readBody(response))
  }
  try {
    await readSse(response, onEvent)
  } catch (error) {
    if (signal?.aborted) throw error
    throw rejectApi(0, undefined)
  }
}

async function readBody(response: Response): Promise<ApiResponse<unknown> | undefined> {
  try {
    const body: unknown = await response.json()
    if (!isRecord(body)) return undefined
    return {
      code: typeof body.code === 'number' ? body.code : response.status,
      message: typeof body.message === 'string' ? body.message : '',
      data: body.data ?? null,
    }
  } catch {
    return undefined
  }
}

async function readSse(response: Response, onEvent: (event: ChatStreamEvent) => void) {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('检索服务不可用')
  const decoder = new TextDecoder()
  let pending = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      pending += decoder.decode(value, { stream: !done })
      const blocks = pending.split('\n\n')
      pending = blocks.pop() ?? ''
      for (const block of blocks) {
        const event = readBlock(block)
        if (event) onEvent(event)
      }
      if (done) break
    }
  } finally {
    reader.releaseLock()
  }
}

function readBlock(block: string): ChatStreamEvent | undefined {
  const data = block
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice('data:'.length).trimStart())
    .join('\n')
  if (!data) return undefined
  if (data === '[DONE]') return { kind: 'done' }
  let parsed: unknown
  try {
    parsed = JSON.parse(data)
  } catch {
    return undefined
  }
  if (!isRecord(parsed)) return undefined
  if (typeof parsed.error === 'string') return { kind: 'error', message: parsed.error }
  const citations = readCitations(parsed.citations)
  if (citations) return { kind: 'citations', citations }
  if (typeof parsed.text === 'string') return { kind: 'text', text: parsed.text }
  if (typeof parsed.conversationId === 'string') return { kind: 'conversation', conversationId: parsed.conversationId }
  return undefined
}

function readCitations(value: unknown): Citation[] | undefined {
  if (!Array.isArray(value)) return undefined
  const citations: Citation[] = []
  for (const item of value) {
    if (!isRecord(item)) continue
    if (
      typeof item.documentId !== 'string' ||
      typeof item.documentName !== 'string' ||
      typeof item.content !== 'string' ||
      typeof item.chunkIndex !== 'number'
    ) {
      continue
    }
    citations.push({
      documentId: item.documentId,
      documentName: item.documentName,
      chunkIndex: item.chunkIndex,
      content: item.content,
    })
  }
  return citations.length ? citations : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

import { userLabel } from './db.ts'
import { paginate } from './tree.ts'
import type { Actor, OpResult, PageResult } from './types.ts'

type ChunkMethod = 'CHAR' | 'FIXED'
type VectorStatus = 'PROCESSING' | 'READY' | 'FAILED'
type Visibility = 'PUBLIC' | 'CUSTOM'
type ChatRole = 'user' | 'assistant'

interface DbKnowledge {
  id: string
  name: string
  description: string
  visibility: Visibility
  ownerId: string
  updatedAt: string
}

interface DbChunk {
  index: number
  content: string
  charCount: number
}

interface DbDocument {
  id: string
  knowledgeId: string
  fileName: string
  fileType: string
  size: number
  content: string
  chunkMethod: ChunkMethod
  chunkSeparator: string
  chunkSize: number
  chunks: DbChunk[]
  vectorStatus: VectorStatus
  ready: boolean
  progress: number
  vectorStartedAt: number
  updatedAt: string
}

interface ChatMessage {
  role: ChatRole
  content: string
  citations?: Citation[]
}

interface Citation {
  documentId: string
  documentName: string
  chunkIndex: number
  content: string
}

interface DbConversation {
  id: string
  ownerId: string
  knowledgeId: string
  title: string
  systemPrompt: string
  messages: ChatMessage[]
  updatedAt: string
}

export interface KnowledgeView {
  id: string
  name: string
  description: string
  visibility: Visibility
  ownerId: string
  ownerName: string
  documentCount: number
  updatedAt: string
}

export interface DocumentView {
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

export interface KnowledgeInput {
  name: string
  description: string
}

export interface DocumentInput {
  knowledgeId: string
  fileName: string
  fileType: string
  size: number
  content: string
  chunkMethod: ChunkMethod
  chunkSeparator: string
  chunkSize: number
  chunks: string[]
}

export interface VectorizeInput {
  chunkMethod: ChunkMethod
  chunkSeparator: string
  chunkSize: number
  chunks: string[]
}

export interface DocumentDetailView extends DocumentView {
  content: string
  chunks: DbChunk[]
}

export interface ChatInput {
  conversationId: string
  knowledgeId: string
  systemPrompt: string
  messages: Array<{ role: ChatRole; content: string }>
}

const FILE_TYPES = new Set(['md', 'markdown', 'txt', 'csv', 'json', 'log', 'pdf'])
const VECTOR_DURATION = 6400

const knowledges: DbKnowledge[] = [
  {
    id: 'kb_manual',
    name: '产品手册',
    description: '知识中枢的产品说明与使用方式',
    visibility: 'PUBLIC',
    ownerId: 'u_chenmy',
    updatedAt: '2024-08-01T02:00:00.000Z',
  },
  {
    id: 'kb_dev',
    name: '研发规范',
    description: '前端研发约定与问答要求',
    visibility: 'PUBLIC',
    ownerId: 'u_chenmy',
    updatedAt: '2024-08-02T02:00:00.000Z',
  },
]

const documents: DbDocument[] = [
  seedDocument('doc_manual_intro', 'kb_manual', '产品说明.md', [
    '知识中枢是面向企业的知识库问答系统。员工登录后可以按知识库检索制度、手册和项目文档。',
    '知识库当前阶段统一为公开。所有登录用户都可以在问答页选择知识库并发问，暂不按部门或用户白名单限制。',
    '新增文档时先上传 md、txt 或 pdf。解析完成后可以按字符切分，或按固定字符切分，并设置最大分片字符数，例如 1024。确认无误后开始向量化，进度走完即表示文档已就绪。',
  ]),
  seedDocument('doc_manual_qa', 'kb_manual', '问答说明.md', [
    '问答页分为三栏：左侧编排知识库和系统提示词，中间是对话历史，右侧输入问题并查看回答。',
    '回答必须带引用来源。引用对应文档名称和分片序号，方便回到原文核对。',
  ]),
  seedDocument('doc_dev_rule', 'kb_dev', '研发约定.md', [
    '前端使用 Vue3、TypeScript 和 ant-design-vue。接口函数放在 src/api，页面不要直接调用 axios。',
    '提交前需要通过类型检查和 lint。按钮权限使用 v-auth，菜单由登录信息动态生成。',
    '知识库问答对普通用户和管理员开放。提问时前端只提交多轮消息，由服务检索知识库并返回引用。',
  ]),
]

const conversations: DbConversation[] = []

let serial = 1

function now() {
  return new Date().toISOString()
}

function uid(prefix: string) {
  serial += 1
  return `${prefix}_${Date.now().toString(36)}${serial.toString(36)}`
}

function fail(code: number, message: string): OpResult<never> {
  return { ok: false, code, message }
}

function success<T>(data: T): OpResult<T> {
  return { ok: true, data }
}

function requirePerm(actor: Actor, permission: string): OpResult<never> | null {
  if (!actor.permissions.includes(permission)) return fail(403, '没有操作权限')
  return null
}

function requireAny(actor: Actor, permissions: string[]): OpResult<never> | null {
  if (permissions.some((item) => actor.permissions.includes(item))) return null
  return fail(403, '没有操作权限')
}

function seedDocument(id: string, knowledgeId: string, fileName: string, texts: string[]): DbDocument {
  const chunks = texts.map((item, index) => {
    const content = index < texts.length - 1 ? `${item}\n` : item
    return { index: index + 1, content, charCount: content.length }
  })
  const content = chunks.map((item) => item.content).join('')
  return {
    id,
    knowledgeId,
    fileName,
    fileType: 'md',
    size: content.length,
    content,
    chunkMethod: 'CHAR',
    chunkSeparator: '\\n',
    chunkSize: 1024,
    chunks,
    vectorStatus: 'READY',
    ready: true,
    progress: 100,
    vectorStartedAt: 0,
    updatedAt: '2024-08-03T02:00:00.000Z',
  }
}

function knowledgeOf(id: string) {
  return knowledges.find((item) => item.id === id)
}

function canReadKnowledge(actor: Actor, knowledge: DbKnowledge) {
  if (knowledge.visibility === 'PUBLIC') return true
  return knowledge.ownerId === actor.id
}

function settle(document: DbDocument) {
  if (document.vectorStatus !== 'PROCESSING') return
  const elapsed = Date.now() - document.vectorStartedAt
  if (elapsed >= VECTOR_DURATION) {
    document.vectorStatus = 'READY'
    document.ready = true
    document.progress = 100
    document.updatedAt = now()
    return
  }
  document.progress = Math.max(1, Math.min(99, Math.floor((elapsed / VECTOR_DURATION) * 100)))
  document.ready = false
}

function settleKnowledge(knowledgeId: string) {
  for (const document of documents) {
    if (document.knowledgeId === knowledgeId) settle(document)
  }
}

function documentCount(knowledgeId: string) {
  return documents.filter((item) => item.knowledgeId === knowledgeId).length
}

function toKnowledge(knowledge: DbKnowledge): KnowledgeView {
  return {
    id: knowledge.id,
    name: knowledge.name,
    description: knowledge.description,
    visibility: knowledge.visibility,
    ownerId: knowledge.ownerId,
    ownerName: userLabel(knowledge.ownerId),
    documentCount: documentCount(knowledge.id),
    updatedAt: knowledge.updatedAt,
  }
}

function toDocument(document: DbDocument): DocumentView {
  settle(document)
  return {
    id: document.id,
    knowledgeId: document.knowledgeId,
    knowledgeName: knowledgeOf(document.knowledgeId)?.name ?? '',
    fileName: document.fileName,
    fileType: document.fileType,
    size: document.size,
    chunkMethod: document.chunkMethod,
    chunkSeparator: document.chunkSeparator,
    chunkSize: document.chunkSize,
    chunkCount: document.chunks.length,
    vectorStatus: document.vectorStatus,
    ready: document.ready,
    progress: document.progress,
    updatedAt: document.updatedAt,
  }
}

function toSummary(conversation: DbConversation): ConversationSummary {
  const knowledge = knowledgeOf(conversation.knowledgeId)
  return {
    id: conversation.id,
    title: conversation.title,
    knowledgeId: conversation.knowledgeId,
    knowledgeName: knowledge?.name ?? '知识库已删除',
    updatedAt: conversation.updatedAt,
  }
}

function toDetail(conversation: DbConversation): ConversationDetail {
  return {
    ...toSummary(conversation),
    systemPrompt: conversation.systemPrompt,
    messages: conversation.messages.map((message) => ({
      role: message.role,
      content: message.content,
      ...(message.citations?.length ? { citations: message.citations.map((item) => ({ ...item })) } : {}),
    })),
  }
}

function validateKnowledge(input: KnowledgeInput, currentId?: string): OpResult<never> | null {
  if (!input.name) return fail(400, '请填写知识库名称')
  if (input.name.length > 40) return fail(400, '知识库名称不能超过 40 个字')
  if (input.description.length > 200) return fail(400, '描述不能超过 200 个字')
  if (knowledges.some((item) => item.name === input.name && item.id !== currentId)) {
    return fail(400, '知识库名称已存在')
  }
  return null
}

export function listKnowledges(
  actor: Actor,
  query: { name: string; pageNum: number; pageSize: number },
): OpResult<PageResult<KnowledgeView>> {
  const denied = requireAny(actor, ['rag:knowledge:query', 'rag:chat:query'])
  if (denied) return denied
  const name = query.name.trim()
  const matched = knowledges.filter((item) => {
    if (!canReadKnowledge(actor, item)) return false
    if (name && !item.name.includes(name) && !item.description.includes(name)) return false
    return true
  })
  matched.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  return success(paginate(matched.map(toKnowledge), query.pageNum, query.pageSize))
}

export function createKnowledge(actor: Actor, input: KnowledgeInput): OpResult<KnowledgeView> {
  const denied = requirePerm(actor, 'rag:knowledge:create')
  if (denied) return denied
  const invalid = validateKnowledge(input)
  if (invalid) return invalid
  const knowledge: DbKnowledge = {
    id: uid('kb'),
    name: input.name,
    description: input.description,
    visibility: 'PUBLIC',
    ownerId: actor.id,
    updatedAt: now(),
  }
  knowledges.unshift(knowledge)
  return success(toKnowledge(knowledge))
}

export function updateKnowledge(actor: Actor, id: string, input: KnowledgeInput): OpResult<KnowledgeView> {
  const denied = requirePerm(actor, 'rag:knowledge:update')
  if (denied) return denied
  const current = knowledgeOf(id)
  if (!current) return fail(400, '知识库不存在')
  if (!canReadKnowledge(actor, current)) return fail(403, '不能修改该知识库')
  const invalid = validateKnowledge(input, id)
  if (invalid) return invalid
  current.name = input.name
  current.description = input.description
  current.updatedAt = now()
  return success(toKnowledge(current))
}

export function removeKnowledge(actor: Actor, id: string): OpResult<null> {
  const denied = requirePerm(actor, 'rag:knowledge:delete')
  if (denied) return denied
  const index = knowledges.findIndex((item) => item.id === id)
  const current = knowledges[index]
  if (!current) return fail(400, '知识库不存在')
  if (!canReadKnowledge(actor, current)) return fail(403, '不能删除该知识库')
  knowledges.splice(index, 1)
  for (let cursor = documents.length - 1; cursor >= 0; cursor -= 1) {
    if (documents[cursor]?.knowledgeId === id) documents.splice(cursor, 1)
  }
  return success(null)
}

export function listDocuments(
  actor: Actor,
  query: { knowledgeId: string; fileName: string; vectorStatus: string; pageNum: number; pageSize: number },
): OpResult<PageResult<DocumentView>> {
  const denied = requireAny(actor, ['rag:document:query', 'rag:chat:query'])
  if (denied) return denied
  const fileName = query.fileName.trim()
  const matched = documents.filter((item) => {
    const knowledge = knowledgeOf(item.knowledgeId)
    if (!knowledge || !canReadKnowledge(actor, knowledge)) return false
    if (query.knowledgeId && item.knowledgeId !== query.knowledgeId) return false
    if (fileName && !item.fileName.includes(fileName)) return false
    settle(item)
    if (query.vectorStatus && item.vectorStatus !== query.vectorStatus) return false
    return true
  })
  matched.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  return success(paginate(matched.map(toDocument), query.pageNum, query.pageSize))
}

export function getDocument(actor: Actor, id: string): OpResult<DocumentView> {
  const denied = requireAny(actor, ['rag:document:query', 'rag:chat:query'])
  if (denied) return denied
  const current = documents.find((item) => item.id === id)
  if (!current) return fail(400, '文档不存在')
  const knowledge = knowledgeOf(current.knowledgeId)
  if (!knowledge || !canReadKnowledge(actor, knowledge)) return fail(403, '不能查看该文档')
  return success(toDocument(current))
}

export function createDocument(actor: Actor, input: DocumentInput): OpResult<DocumentView> {
  const denied = requirePerm(actor, 'rag:document:create')
  if (denied) return denied
  const knowledge = knowledgeOf(input.knowledgeId)
  if (!knowledge) return fail(400, '请选择知识库')
  if (!canReadKnowledge(actor, knowledge)) return fail(403, '不能向该知识库添加文档')
  if (!input.fileName) return fail(400, '请上传文档')
  if (!FILE_TYPES.has(input.fileType)) return fail(400, '仅支持 md、txt、csv、json、pdf')
  if (!input.content.trim()) return fail(400, '文档内容为空')
  if (input.content.length > 500000) return fail(400, '文档内容过长')
  const invalidChunks = validateChunks(input.content, input)
  if (invalidChunks) return invalidChunks
  const document: DbDocument = {
    id: uid('doc'),
    knowledgeId: knowledge.id,
    fileName: input.fileName.slice(0, 120),
    fileType: input.fileType,
    size: Math.max(0, input.size),
    content: input.content,
    chunkMethod: input.chunkMethod,
    chunkSeparator: input.chunkMethod === 'CHAR' ? input.chunkSeparator : '',
    chunkSize: input.chunkSize,
    chunks: input.chunks.map((content, index) => ({ index: index + 1, content, charCount: content.length })),
    vectorStatus: 'PROCESSING',
    ready: false,
    progress: 1,
    vectorStartedAt: Date.now(),
    updatedAt: now(),
  }
  documents.unshift(document)
  knowledge.updatedAt = document.updatedAt
  return success(toDocument(document))
}

export function getDocumentDetail(actor: Actor, id: string): OpResult<DocumentDetailView> {
  const denied = requirePerm(actor, 'rag:document:query')
  if (denied) return denied
  const current = documents.find((item) => item.id === id)
  if (!current) return fail(400, '文档不存在')
  const knowledge = knowledgeOf(current.knowledgeId)
  if (!knowledge || !canReadKnowledge(actor, knowledge)) return fail(403, '不能查看该文档')
  return success({
    ...toDocument(current),
    content: current.content,
    chunks: current.chunks.map((item) => ({ ...item })),
  })
}

export function revectorizeDocument(actor: Actor, id: string, input: VectorizeInput): OpResult<DocumentView> {
  const denied = requirePerm(actor, 'rag:document:update')
  if (denied) return denied
  const current = documents.find((item) => item.id === id)
  if (!current) return fail(400, '文档不存在')
  const knowledge = knowledgeOf(current.knowledgeId)
  if (!knowledge || !canReadKnowledge(actor, knowledge)) return fail(403, '不能重新向量化该文档')
  const invalidChunks = validateChunks(current.content, input)
  if (invalidChunks) return invalidChunks
  current.chunks = input.chunks.map((content, index) => ({ index: index + 1, content, charCount: content.length }))
  current.chunkMethod = input.chunkMethod
  current.chunkSeparator = input.chunkMethod === 'CHAR' ? input.chunkSeparator : ''
  current.chunkSize = input.chunkSize
  current.vectorStatus = 'PROCESSING'
  current.ready = false
  current.progress = 1
  current.vectorStartedAt = Date.now()
  current.updatedAt = now()
  knowledge.updatedAt = current.updatedAt
  return success(toDocument(current))
}

function validateChunks(content: string, input: VectorizeInput): OpResult<never> | null {
  if (input.chunkSize < 100 || input.chunkSize > 4000) return fail(400, '最大分片字符数需在 100 到 4000 之间')
  if (input.chunkMethod === 'CHAR' && !input.chunkSeparator) return fail(400, '请填写切分字符')
  if (input.chunkSeparator.length > 20) return fail(400, '切分字符过长')
  if (input.chunks.length === 0 || input.chunks.length > 2000) return fail(400, '请先生成分片')
  if (input.chunks.some((item) => item.length === 0)) return fail(400, '存在空分片')
  if (input.chunks.some((item) => isIgnorableChunk(item, input))) return fail(400, '存在仅含切分字符或空格的分片')
  if (input.chunkMethod === 'FIXED' && input.chunks.some((item) => item.length > input.chunkSize)) {
    return fail(400, '存在超过最大字符数的分片')
  }
  if (!chunksFollowContent(content, input)) return fail(400, '分片与文档内容不一致')
  return null
}

function chunksFollowContent(content: string, input: VectorizeInput) {
  let cursor = 0
  for (const chunk of input.chunks) {
    const at = content.indexOf(chunk, cursor)
    if (at < 0) return false
    if (!isIgnorableChunk(content.slice(cursor, at), input)) return false
    cursor = at + chunk.length
  }
  return isIgnorableChunk(content.slice(cursor), input)
}

function isIgnorableChunk(text: string, input: VectorizeInput) {
  if (!text) return true
  if (input.chunkMethod === 'FIXED') return text.trim().length === 0
  const decoded = decodeSeparator(input.chunkSeparator)
  const stripped = decoded ? text.split(decoded).join('') : text
  return stripped.trim().length === 0
}

function decodeSeparator(input: string) {
  const marker = '\u0000'
  return input
    .replace(/\\\\/g, marker)
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .split(marker)
    .join('\\')
}

export function removeDocument(actor: Actor, id: string): OpResult<null> {
  const denied = requirePerm(actor, 'rag:document:delete')
  if (denied) return denied
  const index = documents.findIndex((item) => item.id === id)
  const current = documents[index]
  if (!current) return fail(400, '文档不存在')
  const knowledge = knowledgeOf(current.knowledgeId)
  if (!knowledge || !canReadKnowledge(actor, knowledge)) return fail(403, '不能删除该文档')
  documents.splice(index, 1)
  knowledge.updatedAt = now()
  return success(null)
}

export function listConversations(actor: Actor): OpResult<ConversationSummary[]> {
  const denied = requirePerm(actor, 'rag:chat:query')
  if (denied) return denied
  const matched = conversations
    .filter((item) => item.ownerId === actor.id)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  return success(matched.map(toSummary))
}

export function getConversation(actor: Actor, id: string): OpResult<ConversationDetail> {
  const denied = requirePerm(actor, 'rag:chat:query')
  if (denied) return denied
  const current = conversations.find((item) => item.id === id && item.ownerId === actor.id)
  if (!current) return fail(400, '对话不存在')
  return success(toDetail(current))
}

export function removeConversation(actor: Actor, id: string): OpResult<null> {
  const denied = requirePerm(actor, 'rag:chat:query')
  if (denied) return denied
  const index = conversations.findIndex((item) => item.id === id && item.ownerId === actor.id)
  if (index < 0) return fail(400, '对话不存在')
  conversations.splice(index, 1)
  return success(null)
}

export function askChat(actor: Actor, input: ChatInput): OpResult<ConversationDetail> {
  const denied = requirePerm(actor, 'rag:chat:query')
  if (denied) return denied
  if (input.systemPrompt.length > 2000) return fail(400, '系统提示词不能超过 2000 字')
  if (input.messages.length === 0 || input.messages.length > 40) return fail(400, '请输入问题')
  if (input.messages.some((item) => item.content.length > 4000)) return fail(400, '单条消息不能超过 4000 字')
  const knowledge = knowledgeOf(input.knowledgeId)
  if (!knowledge) return fail(400, '请选择知识库')
  if (!canReadKnowledge(actor, knowledge)) return fail(403, '不能使用该知识库')

  let conversation = input.conversationId
    ? conversations.find((item) => item.id === input.conversationId && item.ownerId === actor.id)
    : undefined
  if (input.conversationId && !conversation) return fail(400, '对话不存在')

  const history = mergeHistory(conversation?.messages ?? [], input.messages)
  const latest = history[history.length - 1]
  if (!latest || latest.role !== 'user' || !latest.content.trim()) return fail(400, '请输入问题')

  const reply = retrieve(knowledge, latest.content)
  history.push({ role: 'assistant', content: reply.answer, ...(reply.citations.length ? { citations: reply.citations } : {}) })

  if (!conversation) {
    const firstUser = history.find((item) => item.role === 'user')?.content.trim() ?? '新对话'
    conversation = {
      id: uid('conv'),
      ownerId: actor.id,
      knowledgeId: knowledge.id,
      title: firstUser.slice(0, 24),
      systemPrompt: input.systemPrompt,
      messages: history,
      updatedAt: now(),
    }
    conversations.unshift(conversation)
  } else {
    conversation.knowledgeId = knowledge.id
    conversation.systemPrompt = input.systemPrompt
    conversation.messages = history
    conversation.updatedAt = now()
  }
  return success(toDetail(conversation))
}

function mergeHistory(stored: ChatMessage[], incoming: Array<{ role: ChatRole; content: string }>) {
  const history: ChatMessage[] = []
  for (let index = 0; index < incoming.length; index += 1) {
    const message = incoming[index]
    if (!message) continue
    const previous = stored[index]
    if (previous && previous.role === message.role && previous.content === message.content) {
      history.push(previous)
      continue
    }
    history.push({ role: message.role, content: message.content })
  }
  return history
}

function retrieve(knowledge: DbKnowledge, question: string) {
  settleKnowledge(knowledge.id)
  const readyDocs = documents.filter((item) => item.knowledgeId === knowledge.id && item.vectorStatus === 'READY')
  if (!readyDocs.length) {
    return { answer: '所选知识库还没有就绪文档。请先上传文档并等待向量化完成。', citations: [] as Citation[] }
  }
  const ranked: Array<Citation & { score: number }> = []
  for (const document of readyDocs) {
    for (const chunk of document.chunks) {
      const score = scoreText(question, chunk.content)
      if (score <= 0) continue
      ranked.push({
        documentId: document.id,
        documentName: document.fileName,
        chunkIndex: chunk.index,
        content: chunk.content,
        score,
      })
    }
  }
  ranked.sort((left, right) => right.score - left.score)
  const picked: Citation[] = ranked.slice(0, 3).map((item) => ({
    documentId: item.documentId,
    documentName: item.documentName,
    chunkIndex: item.chunkIndex,
    content: item.content,
  }))
  if (!picked.length) {
    return { answer: '没有在已就绪的文档里找到相关内容。', citations: [] as Citation[] }
  }
  const body = picked.map((item, index) => `（${index + 1}）${item.content}`).join('\n')
  return {
    answer: `根据知识库「${knowledge.name}」中的资料：\n${body}`,
    citations: picked,
  }
}

function scoreText(question: string, content: string) {
  const normalized = question.replace(/\s+/g, '')
  if (!normalized) return 0
  if (normalized.length === 1) return content.includes(normalized) ? 1 : 0
  const seen = new Set<string>()
  let score = 0
  for (let index = 0; index < normalized.length - 1; index += 1) {
    const gram = normalized.slice(index, index + 2)
    if (seen.has(gram)) continue
    seen.add(gram)
    if (content.includes(gram)) score += 1
  }
  return score
}

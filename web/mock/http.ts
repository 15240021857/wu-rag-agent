import {
  actorFromAuth,
  createCompany,
  createDept,
  createMenu,
  createRole,
  createUser,
  listCompanies,
  listDepts,
  listMenus,
  listRoles,
  listUsers,
  login,
  logout,
  profileOf,
  removeCompany,
  removeDept,
  removeMenu,
  removeRole,
  removeUser,
  resetPassword,
  updateCompany,
  updateDept,
  updateMenu,
  updateRole,
  updateRoleMenus,
  updateUser,
} from './db.ts'
import {
  askChat,
  createDocument,
  createKnowledge,
  getConversation,
  getDocument,
  getDocumentDetail,
  listConversations,
  listDocuments,
  listKnowledges,
  removeConversation,
  removeDocument,
  removeKnowledge,
  revectorizeDocument,
  updateKnowledge,
} from './rag.ts'
import type { DataScope, MenuType, Status } from './types.ts'

export interface MockReply {
  status: number
  body: {
    code: number
    message: string
    data: unknown
  }
}

interface Ctx {
  method: string
  pathname: string
  query: URLSearchParams
  body: unknown
  authorization: string | undefined
}

function ok(data: unknown): MockReply {
  return { status: 200, body: { code: 0, message: 'ok', data } }
}

// 解释这个函数：这个函数是用来将db.ts中的opResult转换为MockReply的
function fromOp(result: { ok: true; data: unknown } | { ok: false; code: number; message: string }): MockReply {
  if (!result.ok) {
    const status = result.code === 401 ? 401 : 200
    return { status, body: { code: result.code, message: result.message, data: null } }
  }
  return ok(result.data)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function numberOf(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function statusOf(value: unknown): Status | null {
  return value === 'NORMAL' || value === 'DISABLED' ? value : null
}

function dataScopeOf(value: unknown): DataScope | null {
  if (value === 'ALL' || value === 'COMPANY' || value === 'DEPT' || value === 'SELF') return value
  return null
}

function parentIdOf(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  return typeof value === 'string' ? value : null
}

function stringList(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

function pageQuery(query: URLSearchParams) {
  const pageNum = Number(query.get('pageNum') ?? '1')
  const pageSize = Number(query.get('pageSize') ?? '10')
  return {
    pageNum: Number.isFinite(pageNum) && pageNum > 0 ? pageNum : 1,
    pageSize: Number.isFinite(pageSize) && pageSize > 0 ? Math.min(pageSize, 1000) : 10,
  }
}

function requireActor(ctx: Ctx) {
  const actor = actorFromAuth(ctx.authorization)
  if (!actor) return { actor: null, reply: { status: 401, body: { code: 401, message: '登录已过期，请重新登录', data: null } } }
  return { actor, reply: null }
}

function companyInput(body: unknown) {
  if (!isRecord(body)) return null
  const status = statusOf(body.status)
  if (!status) return null
  return {
    name: text(body.name),
    code: text(body.code),
    parentId: parentIdOf(body.parentId),
    sort: numberOf(body.sort, 0),
    leader: text(body.leader),
    phone: text(body.phone),
    address: text(body.address),
    status,
  }
}

function deptInput(body: unknown) {
  if (!isRecord(body)) return null
  const status = statusOf(body.status)
  if (!status || typeof body.companyId !== 'string') return null
  return {
    name: text(body.name),
    code: text(body.code),
    companyId: body.companyId,
    parentId: parentIdOf(body.parentId),
    sort: numberOf(body.sort, 0),
    leader: text(body.leader),
    status,
  }
}

function menuTypeOf(value: unknown): MenuType | null {
  if (value === 'DIR' || value === 'MENU' || value === 'BUTTON') return value
  return null
}

function menuInput(body: unknown) {
  if (!isRecord(body)) return null
  const type = menuTypeOf(body.type)
  if (!type) return null
  return {
    parentId: parentIdOf(body.parentId),
    name: text(body.name),
    path: text(body.path),
    component: text(body.component),
    icon: text(body.icon),
    sort: numberOf(body.sort, 0),
    type,
    permission: text(body.permission),
  }
}

function roleInput(body: unknown) {
  if (!isRecord(body)) return null
  const status = statusOf(body.status)
  const dataScope = dataScopeOf(body.dataScope)
  if (!status || !dataScope) return null
  return {
    name: text(body.name),
    code: text(body.code),
    sort: numberOf(body.sort, 0),
    status,
    dataScope,
    remark: text(body.remark),
  }
}

function userInput(body: unknown, withPassword: boolean) {
  if (!isRecord(body)) return null
  const status = statusOf(body.status)
  if (!status || typeof body.companyId !== 'string' || typeof body.deptId !== 'string') return null
  return {
    username: text(body.username),
    nickname: text(body.nickname),
    employeeName: text(body.employeeName),
    companyId: body.companyId,
    deptId: body.deptId,
    email: text(body.email),
    mobile: text(body.mobile),
    officePhone: text(body.officePhone),
    status,
    roleIds: stringList(body.roleIds),
    password: withPassword ? text(body.password) : '',
  }
}

export function dispatch(ctx: Ctx): MockReply {
  const { method, pathname, query } = ctx

  if (method === 'POST' && pathname === '/api/auth/login') {
    if (!isRecord(ctx.body)) return { status: 200, body: { code: 400, message: '请输入账号和密码', data: null } }
    return fromOp(login(text(ctx.body.username), text(ctx.body.password)))
  }
  if (method === 'POST' && pathname === '/api/auth/logout') {
    logout(ctx.authorization)
    return ok(null)
  }

  const auth = requireActor(ctx)
  if (!auth.actor) return auth.reply ?? { status: 401, body: { code: 401, message: '未登录', data: null } }
  const actor = auth.actor
  const page = pageQuery(query)

  if (method === 'GET' && pathname === '/api/auth/profile') return fromOp(profileOf(actor))

  if (method === 'GET' && pathname === '/api/system/companies') {
    return fromOp(listCompanies(actor, {
      name: query.get('name') ?? '',
      status: query.get('status') ?? '',
      ...page,
    }))
  }
  if (method === 'POST' && pathname === '/api/system/companies') {
    const input = companyInput(ctx.body)
    if (!input) return { status: 200, body: { code: 400, message: '公司参数不正确', data: null } }
    return fromOp(createCompany(actor, input))
  }

  const companyMatch = pathname.match(/^\/api\/system\/companies\/([^/]+)$/)
  if (companyMatch?.[1] && method === 'PUT') {
    const input = companyInput(ctx.body)
    if (!input) return { status: 200, body: { code: 400, message: '公司参数不正确', data: null } }
    return fromOp(updateCompany(actor, decodeURIComponent(companyMatch[1]), input))
  }
  if (companyMatch?.[1] && method === 'DELETE') {
    return fromOp(removeCompany(actor, decodeURIComponent(companyMatch[1])))
  }

  if (method === 'GET' && pathname === '/api/system/depts') {
    return fromOp(listDepts(actor, {
      name: query.get('name') ?? '',
      status: query.get('status') ?? '',
      companyId: query.get('companyId') ?? '',
      ...page,
    }))
  }
  if (method === 'POST' && pathname === '/api/system/depts') {
    const input = deptInput(ctx.body)
    if (!input) return { status: 200, body: { code: 400, message: '部门参数不正确', data: null } }
    return fromOp(createDept(actor, input))
  }

  const deptMatch = pathname.match(/^\/api\/system\/depts\/([^/]+)$/)
  if (deptMatch?.[1] && method === 'PUT') {
    const input = deptInput(ctx.body)
    if (!input) return { status: 200, body: { code: 400, message: '部门参数不正确', data: null } }
    return fromOp(updateDept(actor, decodeURIComponent(deptMatch[1]), input))
  }
  if (deptMatch?.[1] && method === 'DELETE') {
    return fromOp(removeDept(actor, decodeURIComponent(deptMatch[1])))
  }

  if (method === 'GET' && pathname === '/api/system/roles') {
    return fromOp(listRoles(actor, {
      name: query.get('name') ?? '',
      status: query.get('status') ?? '',
      ...page,
    }))
  }
  if (method === 'POST' && pathname === '/api/system/roles') {
    const input = roleInput(ctx.body)
    if (!input) return { status: 200, body: { code: 400, message: '角色参数不正确', data: null } }
    return fromOp(createRole(actor, input))
  }
  if (method === 'GET' && pathname === '/api/system/menus') {
    return fromOp(listMenus(actor, {
      name: query.get('name') ?? '',
      type: query.get('type') ?? '',
    }))
  }
  if (method === 'POST' && pathname === '/api/system/menus') {
    const input = menuInput(ctx.body)
    if (!input) return { status: 200, body: { code: 400, message: '菜单参数不正确', data: null } }
    return fromOp(createMenu(actor, input))
  }

  const menuMatch = pathname.match(/^\/api\/system\/menus\/([^/]+)$/)
  if (menuMatch?.[1] && method === 'PUT') {
    const input = menuInput(ctx.body)
    if (!input) return { status: 200, body: { code: 400, message: '菜单参数不正确', data: null } }
    return fromOp(updateMenu(actor, decodeURIComponent(menuMatch[1]), input))
  }
  if (menuMatch?.[1] && method === 'DELETE') {
    return fromOp(removeMenu(actor, decodeURIComponent(menuMatch[1])))
  }

  const roleMenuMatch = pathname.match(/^\/api\/system\/roles\/([^/]+)\/menus$/)
  if (roleMenuMatch?.[1] && method === 'PUT') {
    if (!isRecord(ctx.body)) return { status: 200, body: { code: 400, message: '授权参数不正确', data: null } }
    const dataScope = dataScopeOf(ctx.body.dataScope)
    if (!dataScope) return { status: 200, body: { code: 400, message: '数据范围不正确', data: null } }
    return fromOp(updateRoleMenus(actor, decodeURIComponent(roleMenuMatch[1]), stringList(ctx.body.menuIds), dataScope))
  }

  const roleMatch = pathname.match(/^\/api\/system\/roles\/([^/]+)$/)
  if (roleMatch?.[1] && method === 'PUT') {
    const input = roleInput(ctx.body)
    if (!input) return { status: 200, body: { code: 400, message: '角色参数不正确', data: null } }
    return fromOp(updateRole(actor, decodeURIComponent(roleMatch[1]), input))
  }
  if (roleMatch?.[1] && method === 'DELETE') {
    return fromOp(removeRole(actor, decodeURIComponent(roleMatch[1])))
  }

  if (method === 'GET' && pathname === '/api/system/users') {
    return fromOp(listUsers(actor, {
      username: query.get('username') ?? '',
      nickname: query.get('nickname') ?? '',
      status: query.get('status') ?? '',
      companyId: query.get('companyId') ?? '',
      deptId: query.get('deptId') ?? '',
      ...page,
    }))
  }
  if (method === 'POST' && pathname === '/api/system/users') {
    const input = userInput(ctx.body, true)
    if (!input) return { status: 200, body: { code: 400, message: '用户参数不正确', data: null } }
    return fromOp(createUser(actor, input))
  }

  const passwordMatch = pathname.match(/^\/api\/system\/users\/([^/]+)\/password$/)
  if (passwordMatch?.[1] && method === 'PUT') {
    if (!isRecord(ctx.body)) return { status: 200, body: { code: 400, message: '请填写新密码', data: null } }
    return fromOp(resetPassword(actor, decodeURIComponent(passwordMatch[1]), text(ctx.body.password)))
  }

  const userMatch = pathname.match(/^\/api\/system\/users\/([^/]+)$/)
  if (userMatch?.[1] && method === 'PUT') {
    const input = userInput(ctx.body, false)
    if (!input) return { status: 200, body: { code: 400, message: '用户参数不正确', data: null } }
    return fromOp(updateUser(actor, decodeURIComponent(userMatch[1]), input))
  }
  if (userMatch?.[1] && method === 'DELETE') {
    return fromOp(removeUser(actor, decodeURIComponent(userMatch[1])))
  }

  if (method === 'GET' && pathname === '/api/rag/knowledges') {
    return fromOp(listKnowledges(actor, { name: query.get('name') ?? '', ...page }))
  }
  if (method === 'POST' && pathname === '/api/rag/knowledges') {
    const input = knowledgeInput(ctx.body)
    if (!input) return { status: 200, body: { code: 400, message: '知识库参数不正确', data: null } }
    return fromOp(createKnowledge(actor, input))
  }
  const knowledgeMatch = pathname.match(/^\/api\/rag\/knowledges\/([^/]+)$/)
  if (knowledgeMatch?.[1] && method === 'PUT') {
    const input = knowledgeInput(ctx.body)
    if (!input) return { status: 200, body: { code: 400, message: '知识库参数不正确', data: null } }
    return fromOp(updateKnowledge(actor, decodeURIComponent(knowledgeMatch[1]), input))
  }
  if (knowledgeMatch?.[1] && method === 'DELETE') {
    return fromOp(removeKnowledge(actor, decodeURIComponent(knowledgeMatch[1])))
  }

  if (method === 'GET' && pathname === '/api/rag/documents') {
    return fromOp(listDocuments(actor, {
      knowledgeId: query.get('knowledgeId') ?? '',
      fileName: query.get('fileName') ?? '',
      vectorStatus: query.get('vectorStatus') ?? '',
      ...page,
    }))
  }
  if (method === 'POST' && pathname === '/api/rag/documents') {
    const input = documentInput(ctx.body)
    if (!input) return { status: 200, body: { code: 400, message: '文档参数不正确', data: null } }
    return fromOp(createDocument(actor, input))
  }
  const detailMatch = pathname.match(/^\/api\/rag\/documents\/([^/]+)\/detail$/)
  if (detailMatch?.[1] && method === 'GET') {
    return fromOp(getDocumentDetail(actor, decodeURIComponent(detailMatch[1])))
  }
  const vectorizeMatch = pathname.match(/^\/api\/rag\/documents\/([^/]+)\/vectorize$/)
  if (vectorizeMatch?.[1] && method === 'POST') {
    const input = vectorizeInput(ctx.body)
    if (!input) return { status: 200, body: { code: 400, message: '分片参数不正确', data: null } }
    return fromOp(revectorizeDocument(actor, decodeURIComponent(vectorizeMatch[1]), input))
  }
  const documentMatch = pathname.match(/^\/api\/rag\/documents\/([^/]+)$/)
  if (documentMatch?.[1] && method === 'GET') {
    return fromOp(getDocument(actor, decodeURIComponent(documentMatch[1])))
  }
  if (documentMatch?.[1] && method === 'DELETE') {
    return fromOp(removeDocument(actor, decodeURIComponent(documentMatch[1])))
  }

  if (method === 'GET' && pathname === '/api/rag/conversations') return fromOp(listConversations(actor))
  if (method === 'POST' && pathname === '/api/rag/chat') {
    const input = chatInput(ctx.body)
    if (!input) return { status: 200, body: { code: 400, message: '问答参数不正确', data: null } }
    return fromOp(askChat(actor, input))
  }
  const conversationMatch = pathname.match(/^\/api\/rag\/conversations\/([^/]+)$/)
  if (conversationMatch?.[1] && method === 'GET') {
    return fromOp(getConversation(actor, decodeURIComponent(conversationMatch[1])))
  }
  if (conversationMatch?.[1] && method === 'DELETE') {
    return fromOp(removeConversation(actor, decodeURIComponent(conversationMatch[1])))
  }

  return { status: 404, body: { code: 404, message: '接口不存在', data: null } }
}

function knowledgeInput(body: unknown) {
  if (!isRecord(body)) return null
  return { name: text(body.name), description: text(body.description) }
}

function documentInput(body: unknown) {
  if (!isRecord(body) || typeof body.knowledgeId !== 'string' || !Array.isArray(body.chunks)) return null
  if (typeof body.content !== 'string') return null
  let chunkMethod: 'CHAR' | 'FIXED'
  if (body.chunkMethod === 'CHAR') chunkMethod = 'CHAR'
  else if (body.chunkMethod === 'FIXED') chunkMethod = 'FIXED'
  else return null
  const chunks: string[] = []
  for (const item of body.chunks) {
    if (!isRecord(item) || typeof item.content !== 'string') return null
    chunks.push(item.content)
  }
  return {
    knowledgeId: body.knowledgeId,
    fileName: text(body.fileName),
    fileType: text(body.fileType).toLowerCase(),
    size: numberOf(body.size, 0),
    content: body.content,
    chunkMethod,
    chunkSeparator: typeof body.chunkSeparator === 'string' ? body.chunkSeparator : '\\n',
    chunkSize: numberOf(body.chunkSize, 1024),
    chunks,
  }
}

function vectorizeInput(body: unknown) {
  if (!isRecord(body) || !Array.isArray(body.chunks)) return null
  let chunkMethod: 'CHAR' | 'FIXED'
  if (body.chunkMethod === 'CHAR') chunkMethod = 'CHAR'
  else if (body.chunkMethod === 'FIXED') chunkMethod = 'FIXED'
  else return null
  const chunks: string[] = []
  for (const item of body.chunks) {
    if (!isRecord(item) || typeof item.content !== 'string') return null
    chunks.push(item.content)
  }
  return {
    chunkMethod,
    chunkSeparator: typeof body.chunkSeparator === 'string' ? body.chunkSeparator : '\\n',
    chunkSize: numberOf(body.chunkSize, 1024),
    chunks,
  }
}

function chatInput(body: unknown) {
  if (!isRecord(body) || typeof body.knowledgeId !== 'string' || !Array.isArray(body.messages)) return null
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = []
  for (const item of body.messages) {
    if (!isRecord(item) || (item.role !== 'user' && item.role !== 'assistant') || typeof item.content !== 'string') return null
    messages.push({ role: item.role, content: item.content })
  }
  return {
    conversationId: typeof body.conversationId === 'string' ? body.conversationId : '',
    knowledgeId: body.knowledgeId,
    systemPrompt: text(body.systemPrompt),
    messages,
  }
}

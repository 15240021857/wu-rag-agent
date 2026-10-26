import { buildTree, descendantIds, paginate, withAncestors } from './tree.ts'
import type {
  Actor,
  CompanyNode,
  DataScope,
  DbCompany,
  DbDept,
  DbMenu,
  DbRole,
  DbUser,
  DeptNode,
  MenuNode,
  MenuType,
  OpResult,
  PageResult,
  Profile,
  Status,
  UserView,
} from './types.ts'

const SCOPE_RANK: Record<DataScope, number> = {
  SELF: 1,
  DEPT: 2,
  COMPANY: 3,
  ALL: 4,
}

function now() {
  return new Date().toISOString()
}

let serial = 1
function uid(prefix: string) {
  serial += 1
  return `${prefix}_${Date.now().toString(36)}${serial.toString(36)}`
}

const menus: DbMenu[] = [
  { id: 'm_dashboard', parentId: null, name: '工作台', path: '/dashboard', component: 'dashboard/index', icon: 'DashboardOutlined', sort: 1, type: 'MENU', permission: '' },
  { id: 'm_rag_chat', parentId: null, name: '知识库问答', path: '/chat', component: 'rag/chat/index', icon: 'CommentOutlined', sort: 2, type: 'MENU', permission: 'rag:chat:query' },
  { id: 'm_rag', parentId: null, name: '知识库管理', path: '/rag', component: '', icon: 'BookOutlined', sort: 3, type: 'DIR', permission: '' },
  { id: 'm_kb', parentId: 'm_rag', name: '知识库管理', path: '/rag/knowledge', component: 'rag/knowledge/index', icon: 'ReadOutlined', sort: 1, type: 'MENU', permission: 'rag:knowledge:query' },
  { id: 'm_doc', parentId: 'm_rag', name: '文档管理', path: '/rag/document', component: 'rag/document/index', icon: 'FileTextOutlined', sort: 2, type: 'MENU', permission: 'rag:document:query' },
  { id: 'b_kb_create', parentId: 'm_rag_chat', name: '新增知识库', path: '', component: '', icon: '', sort: 1, type: 'BUTTON', permission: 'rag:knowledge:create' },
  { id: 'b_doc_create', parentId: 'm_rag_chat', name: '新增文档', path: '', component: '', icon: '', sort: 2, type: 'BUTTON', permission: 'rag:document:create' },
  { id: 'b_kb_update', parentId: 'm_kb', name: '编辑知识库', path: '', component: '', icon: '', sort: 1, type: 'BUTTON', permission: 'rag:knowledge:update' },
  { id: 'b_kb_delete', parentId: 'm_kb', name: '删除知识库', path: '', component: '', icon: '', sort: 2, type: 'BUTTON', permission: 'rag:knowledge:delete' },
  { id: 'b_doc_update', parentId: 'm_doc', name: '重新向量化', path: '', component: '', icon: '', sort: 1, type: 'BUTTON', permission: 'rag:document:update' },
  { id: 'b_doc_delete', parentId: 'm_doc', name: '删除文档', path: '', component: '', icon: '', sort: 2, type: 'BUTTON', permission: 'rag:document:delete' },
  { id: 'm_system', parentId: null, name: '系统管理', path: '/system', component: '', icon: 'SettingOutlined', sort: 4, type: 'DIR', permission: '' },
  { id: 'm_user', parentId: 'm_system', name: '用户管理', path: '/system/user', component: 'system/user/index', icon: 'UserOutlined', sort: 1, type: 'MENU', permission: 'system:user:query' },
  { id: 'm_company', parentId: 'm_system', name: '公司管理', path: '/system/company', component: 'system/company/index', icon: 'BankOutlined', sort: 2, type: 'MENU', permission: 'system:company:query' },
  { id: 'm_dept', parentId: 'm_system', name: '部门管理', path: '/system/dept', component: 'system/dept/index', icon: 'ApartmentOutlined', sort: 3, type: 'MENU', permission: 'system:dept:query' },
  { id: 'm_role', parentId: 'm_system', name: '角色管理', path: '/system/role', component: 'system/role/index', icon: 'SafetyCertificateOutlined', sort: 4, type: 'MENU', permission: 'system:role:query' },
  { id: 'b_user_create', parentId: 'm_user', name: '新增用户', path: '', component: '', icon: '', sort: 1, type: 'BUTTON', permission: 'system:user:create' },
  { id: 'b_user_update', parentId: 'm_user', name: '编辑用户', path: '', component: '', icon: '', sort: 2, type: 'BUTTON', permission: 'system:user:update' },
  { id: 'b_user_delete', parentId: 'm_user', name: '删除用户', path: '', component: '', icon: '', sort: 3, type: 'BUTTON', permission: 'system:user:delete' },
  { id: 'b_user_reset', parentId: 'm_user', name: '重置密码', path: '', component: '', icon: '', sort: 4, type: 'BUTTON', permission: 'system:user:resetPwd' },
  { id: 'b_company_create', parentId: 'm_company', name: '新增公司', path: '', component: '', icon: '', sort: 1, type: 'BUTTON', permission: 'system:company:create' },
  { id: 'b_company_update', parentId: 'm_company', name: '编辑公司', path: '', component: '', icon: '', sort: 2, type: 'BUTTON', permission: 'system:company:update' },
  { id: 'b_company_delete', parentId: 'm_company', name: '删除公司', path: '', component: '', icon: '', sort: 3, type: 'BUTTON', permission: 'system:company:delete' },
  { id: 'b_dept_create', parentId: 'm_dept', name: '新增部门', path: '', component: '', icon: '', sort: 1, type: 'BUTTON', permission: 'system:dept:create' },
  { id: 'b_dept_update', parentId: 'm_dept', name: '编辑部门', path: '', component: '', icon: '', sort: 2, type: 'BUTTON', permission: 'system:dept:update' },
  { id: 'b_dept_delete', parentId: 'm_dept', name: '删除部门', path: '', component: '', icon: '', sort: 3, type: 'BUTTON', permission: 'system:dept:delete' },
  { id: 'b_role_create', parentId: 'm_role', name: '新增角色', path: '', component: '', icon: '', sort: 1, type: 'BUTTON', permission: 'system:role:create' },
  { id: 'b_role_update', parentId: 'm_role', name: '编辑角色', path: '', component: '', icon: '', sort: 2, type: 'BUTTON', permission: 'system:role:update' },
  { id: 'b_role_delete', parentId: 'm_role', name: '删除角色', path: '', component: '', icon: '', sort: 3, type: 'BUTTON', permission: 'system:role:delete' },
  { id: 'm_menu', parentId: 'm_system', name: '菜单管理', path: '/system/menu', component: 'system/menu/index', icon: 'MenuOutlined', sort: 5, type: 'MENU', permission: 'system:menu:query' },
  { id: 'b_menu_create', parentId: 'm_menu', name: '新增菜单', path: '', component: '', icon: '', sort: 1, type: 'BUTTON', permission: 'system:menu:create' },
  { id: 'b_menu_update', parentId: 'm_menu', name: '编辑菜单', path: '', component: '', icon: '', sort: 2, type: 'BUTTON', permission: 'system:menu:update' },
  { id: 'b_menu_delete', parentId: 'm_menu', name: '删除菜单', path: '', component: '', icon: '', sort: 3, type: 'BUTTON', permission: 'system:menu:delete' },
]

const allMenuIds = menus.map((item) => item.id)
const companyMenuIds = [
  'm_dashboard',
  'm_rag_chat',
  'm_rag',
  'm_kb',
  'm_doc',
  'b_kb_create',
  'b_doc_create',
  'b_kb_update',
  'b_kb_delete',
  'b_doc_update',
  'b_doc_delete',
  'm_system',
  'm_user',
  'm_company',
  'm_dept',
  'b_user_create',
  'b_user_update',
  'b_company_create',
  'b_company_update',
  'b_dept_create',
  'b_dept_update',
]

const companies: DbCompany[] = [
  { id: 'c_sd', name: '山东公司', code: 'SD', parentId: null, sort: 1, leader: '王磊', phone: '053188888888', address: '山东省济南市', status: 'NORMAL', updatedAt: '2024-06-01T02:00:00.000Z' },
  { id: 'c_jn', name: '济南公司', code: 'JN', parentId: 'c_sd', sort: 1, leader: '李娜', phone: '053188888801', address: '山东省济南市高新区', status: 'NORMAL', updatedAt: '2024-06-02T02:00:00.000Z' },
  { id: 'c_qd', name: '青岛公司', code: 'QD', parentId: 'c_sd', sort: 2, leader: '赵强', phone: '053288888802', address: '山东省青岛市市南区', status: 'NORMAL', updatedAt: '2024-06-03T02:00:00.000Z' },
]

const depts: DbDept[] = [
  { id: 'd_sd_admin', name: '企管部', code: 'SD-QG', companyId: 'c_sd', parentId: null, sort: 1, leader: '陈明', status: 'NORMAL', updatedAt: '2024-06-04T02:00:00.000Z' },
  { id: 'd_jn_fin', name: '财务部', code: 'JN-CW', companyId: 'c_jn', parentId: null, sort: 1, leader: '刘芳', status: 'NORMAL', updatedAt: '2024-06-05T02:00:00.000Z' },
  { id: 'd_jn_rd', name: '研发部', code: 'JN-YF', companyId: 'c_jn', parentId: null, sort: 2, leader: '周凯', status: 'NORMAL', updatedAt: '2024-06-06T02:00:00.000Z' },
  { id: 'd_qd_admin', name: '企管部', code: 'QD-QG', companyId: 'c_qd', parentId: null, sort: 1, leader: '孙悦', status: 'NORMAL', updatedAt: '2024-06-07T02:00:00.000Z' },
  { id: 'd_qd_fin', name: '财务部', code: 'QD-CW', companyId: 'c_qd', parentId: null, sort: 2, leader: '吴迪', status: 'NORMAL', updatedAt: '2024-06-08T02:00:00.000Z' },
  { id: 'd_qd_rd', name: '研发部', code: 'QD-YF', companyId: 'c_qd', parentId: null, sort: 3, leader: '郑浩', status: 'NORMAL', updatedAt: '2024-06-09T02:00:00.000Z' },
]

const roles: DbRole[] = [
  { id: 'r_super', name: '超级管理员', code: 'SUPER_ADMIN', sort: 1, status: 'NORMAL', dataScope: 'ALL', remark: '系统全部权限', menuIds: allMenuIds, updatedAt: '2024-06-01T02:00:00.000Z' },
  { id: 'r_company', name: '公司管理员', code: 'COMPANY_ADMIN', sort: 2, status: 'NORMAL', dataScope: 'COMPANY', remark: '管理本公司的用户、组织与知识库', menuIds: companyMenuIds, updatedAt: '2024-06-01T02:10:00.000Z' },
  { id: 'r_staff', name: '普通员工', code: 'STAFF', sort: 3, status: 'NORMAL', dataScope: 'SELF', remark: '可访问工作台和知识库问答', menuIds: ['m_dashboard', 'm_rag_chat', 'b_kb_create', 'b_doc_create'], updatedAt: '2024-06-01T02:20:00.000Z' },
]

const deptCycle = ['d_jn_fin', 'd_jn_rd', 'd_qd_admin', 'd_qd_fin', 'd_qd_rd', 'd_sd_admin']
const people: Array<[string, string, string]> = [
  ['user01', '用户01', '张伟'],
  ['user02', '用户02', '李娜'],
  ['user03', '用户03', '王强'],
  ['user04', '用户04', '赵敏'],
  ['user05', '用户05', '刘洋'],
  ['user06', '用户06', '陈静'],
  ['user07', '用户07', '周凯'],
  ['user08', '用户08', '吴迪'],
  ['user09', '用户09', '孙悦'],
  ['user10', '用户10', '郑浩'],
  ['user11', '用户11', '冯雪'],
  ['user12', '用户12', '何军'],
]

const users: DbUser[] = [
  {
    id: 'u_chenmy',
    username: 'chenmy',
    password: '123456',
    nickname: 'chenmy',
    employeeName: '陈明',
    companyId: 'c_sd',
    deptId: 'd_sd_admin',
    email: 'chenmy@test.com',
    mobile: '13800000000',
    officePhone: '053188888888',
    status: 'NORMAL',
    roleIds: ['r_super'],
    updatedAt: '2024-07-01T06:39:00.000Z',
  },
  {
    id: 'u_manager',
    username: 'manager',
    password: '123456',
    nickname: '公司管理员',
    employeeName: '刘芳',
    companyId: 'c_jn',
    deptId: 'd_jn_fin',
    email: 'manager@test.com',
    mobile: '13800000001',
    officePhone: '053188888801',
    status: 'NORMAL',
    roleIds: ['r_company'],
    updatedAt: '2024-07-02T06:39:00.000Z',
  },
  {
    id: 'u_staff',
    username: 'staff',
    password: '123456',
    nickname: '普通员工',
    employeeName: '郑浩',
    companyId: 'c_qd',
    deptId: 'd_qd_rd',
    email: 'staff@test.com',
    mobile: '13800000002',
    officePhone: '053288888802',
    status: 'NORMAL',
    roleIds: ['r_staff'],
    updatedAt: '2024-07-03T06:39:00.000Z',
  },
  ...people.map(([username, nickname, employeeName], index): DbUser => {
    const deptId = deptCycle[index % deptCycle.length] ?? 'd_sd_admin'
    const dept = depts.find((item) => item.id === deptId)
    return {
      id: `u_${username}`,
      username,
      password: '123456',
      nickname,
      employeeName,
      companyId: dept?.companyId ?? 'c_sd',
      deptId,
      email: `${username}@test.com`,
      mobile: `1855555${String(1000 + index).slice(-4)}`,
      officePhone: `05318888${String(1000 + index).slice(-4)}`,
      status: username === 'user12' ? 'DISABLED' : 'NORMAL',
      roleIds: index % 5 === 0 ? ['r_company'] : ['r_staff'],
      updatedAt: `2024-07-${String((index % 27) + 1).padStart(2, '0')}T0${index % 9}:30:00.000Z`,
    }
  }),
]

const sessions = new Map<string, string>()

function fail(code: number, message: string): OpResult<never> {
  return { ok: false, code, message }
}

function success<T>(data: T): OpResult<T> {
  return { ok: true, data }
}

function companyName(id: string) {
  return companies.find((item) => item.id === id)?.name ?? ''
}

function deptName(id: string) {
  return depts.find((item) => item.id === id)?.name ?? ''
}

function roleName(id: string) {
  return roles.find((item) => item.id === id)?.name ?? ''
}

export function userLabel(id: string) {
  const user = users.find((item) => item.id === id)
  if (!user) return ''
  return user.employeeName || user.nickname
}

function activeRoles(user: DbUser) {
  return roles.filter((role) => user.roleIds.includes(role.id) && role.status === 'NORMAL')
}

function permissionsOf(menuIds: Iterable<string>) {
  const allowed = new Set(menuIds)
  const permissions = new Set<string>()
  for (const menu of menus) {
    if (allowed.has(menu.id) && menu.permission) permissions.add(menu.permission)
  }
  return [...permissions]
}

function dataScopeOf(user: DbUser): DataScope {
  return activeRoles(user).reduce<DataScope>((current, role) => {
    return SCOPE_RANK[role.dataScope] > SCOPE_RANK[current] ? role.dataScope : current
  }, 'SELF')
}

function toActor(user: DbUser): Actor {
  const ownedMenus = new Set(activeRoles(user).flatMap((role) => role.menuIds))
  return {
    id: user.id,
    companyId: user.companyId,
    deptId: user.deptId,
    permissions: permissionsOf(ownedMenus),
    dataScope: dataScopeOf(user),
  }
}

export function actorFromAuth(authorization: string | undefined): Actor | null {
  if (!authorization?.startsWith('Bearer ')) return null
  const userId = sessions.get(authorization.slice('Bearer '.length).trim())
  const user = users.find((item) => item.id === userId)
  if (!user || user.status !== 'NORMAL') return null
  return toActor(user)
}

function requirePerm(actor: Actor, permission: string): OpResult<never> | null {
  if (!actor.permissions.includes(permission)) return fail(403, '没有操作权限')
  return null
}

function requireAny(actor: Actor, permissions: string[]): OpResult<never> | null {
  if (permissions.some((item) => actor.permissions.includes(item))) return null
  return fail(403, '没有操作权限')
}

function allowedCompanyIds(actor: Actor): Set<string> | null {
  if (actor.dataScope === 'ALL') return null
  if (actor.dataScope === 'COMPANY') {
    const ids = descendantIds(actor.companyId, companies)
    ids.add(actor.companyId)
    return ids
  }
  return new Set([actor.companyId])
}

function canAccessCompany(actor: Actor, companyId: string) {
  const allowed = allowedCompanyIds(actor)
  return allowed === null || allowed.has(companyId)
}

function toMenuNode(menu: DbMenu): MenuNode {
  const node: MenuNode = {
    id: menu.id,
    parentId: menu.parentId,
    name: menu.name,
    path: menu.path,
    sort: menu.sort,
    type: menu.type,
  }
  if (menu.component) node.component = menu.component
  if (menu.icon) node.icon = menu.icon
  if (menu.permission) node.permission = menu.permission
  return node
}

function menuTree(includeButtons: boolean, allowedIds?: Set<string>): MenuNode[] {
  const source = menus.filter((menu) => {
    if (!includeButtons && menu.type === 'BUTTON') return false
    if (allowedIds && !allowedIds.has(menu.id)) return false
    return true
  })
  return buildTree(source.map(toMenuNode))
}

function visibleMenuIds(user: DbUser) {
  const owned = new Set(activeRoles(user).flatMap((role) => role.menuIds))
  return withAncestors(owned, menus)
}

export function login(username: string, password: string): OpResult<{ token: string }> {
  const user = users.find((item) => item.username === username)
  if (!user || user.password !== password) return fail(400, '账号或密码错误')
  if (user.status === 'DISABLED') return fail(400, '账号已停用')
  const token = `mock_${user.id}_${Math.random().toString(36).slice(2, 10)}`
  sessions.set(token, user.id)
  return success({ token })
}

export function logout(authorization: string | undefined) {
  if (!authorization?.startsWith('Bearer ')) return
  sessions.delete(authorization.slice('Bearer '.length).trim())
}

export function profileOf(actor: Actor): OpResult<Profile> {
  const user = users.find((item) => item.id === actor.id)
  if (!user) return fail(401, '登录已过期')
  const allowed = visibleMenuIds(user)
  return success({
    user: {
      id: user.id,
      username: user.username,
      nickname: user.nickname,
      employeeName: user.employeeName,
      companyId: user.companyId,
      companyName: companyName(user.companyId),
      deptId: user.deptId,
      deptName: deptName(user.deptId),
      email: user.email,
      mobile: user.mobile,
    },
    permissions: actor.permissions,
    menus: menuTree(false, allowed),
  })
}

function pageOf<T>(list: T[], pageNum: number, pageSize: number): PageResult<T> {
  return paginate(list, pageNum, pageSize)
}

export function listCompanies(
  actor: Actor,
  query: { name: string; status: string; pageNum: number; pageSize: number },
): OpResult<PageResult<CompanyNode>> {
  const denied = requireAny(actor, ['system:company:query', 'system:dept:query', 'system:user:query'])
  if (denied) return denied
  const allowed = allowedCompanyIds(actor)
  const matched = new Set<string>()
  for (const company of companies) {
    if (allowed && !allowed.has(company.id)) continue
    const nameOk = !query.name || company.name.includes(query.name) || company.code.includes(query.name)
    const statusOk = !query.status || company.status === query.status
    if (nameOk && statusOk) matched.add(company.id)
  }
  const visible = withAncestors(matched, companies)
  const list = companies.filter((company) => visible.has(company.id) && (!allowed || allowed.has(company.id)))
  return success(pageOf(buildTree(list), query.pageNum, query.pageSize))
}

interface CompanyInput {
  name: string
  code: string
  parentId: string | null
  sort: number
  leader: string
  phone: string
  address: string
  status: Status
}

function validateCompany(input: CompanyInput, currentId?: string): OpResult<never> | null {
  if (!input.name) return fail(400, '请填写公司名称')
  if (!input.code) return fail(400, '请填写公司编码')
  if (companies.some((item) => item.code === input.code && item.id !== currentId)) {
    return fail(400, '公司编码已存在')
  }
  if (input.parentId) {
    if (input.parentId === currentId) return fail(400, '上级公司不能是自己')
    const parent = companies.find((item) => item.id === input.parentId)
    if (!parent) return fail(400, '上级公司不存在')
    if (currentId && descendantIds(currentId, companies).has(input.parentId)) {
      return fail(400, '上级公司不能选自己的下级')
    }
  }
  return null
}

export function createCompany(actor: Actor, input: CompanyInput): OpResult<DbCompany> {
  const denied = requirePerm(actor, 'system:company:create')
  if (denied) return denied
  const invalid = validateCompany(input)
  if (invalid) return invalid
  if (input.parentId && !canAccessCompany(actor, input.parentId)) return fail(403, '不能在该上级公司下新增')
  const company: DbCompany = { id: uid('c'), ...input, updatedAt: now() }
  companies.push(company)
  return success(company)
}

export function updateCompany(actor: Actor, id: string, input: CompanyInput): OpResult<DbCompany> {
  const denied = requirePerm(actor, 'system:company:update')
  if (denied) return denied
  const current = companies.find((item) => item.id === id)
  if (!current) return fail(400, '公司不存在')
  if (!canAccessCompany(actor, id)) return fail(403, '不能修改该公司')
  const invalid = validateCompany(input, id)
  if (invalid) return invalid
  if (input.parentId && !canAccessCompany(actor, input.parentId)) return fail(403, '不能挂到该公司下')
  Object.assign(current, input, { updatedAt: now() })
  return success(current)
}

export function removeCompany(actor: Actor, id: string): OpResult<null> {
  const denied = requirePerm(actor, 'system:company:delete')
  if (denied) return denied
  const index = companies.findIndex((item) => item.id === id)
  if (index < 0) return fail(400, '公司不存在')
  if (!canAccessCompany(actor, id)) return fail(403, '不能删除该公司')
  if (companies.some((item) => item.parentId === id)) return fail(400, '请先删除下级公司')
  if (depts.some((item) => item.companyId === id)) return fail(400, '请先删除该公司下的部门')
  if (users.some((item) => item.companyId === id)) return fail(400, '请先移除该公司下的用户')
  companies.splice(index, 1)
  return success(null)
}

function toDeptNode(dept: DbDept): DeptNode {
  return { ...dept, companyName: companyName(dept.companyId) }
}

export function listDepts(
  actor: Actor,
  query: { name: string; status: string; companyId: string; pageNum: number; pageSize: number },
): OpResult<PageResult<DeptNode>> {
  const denied = requireAny(actor, ['system:dept:query', 'system:user:query'])
  if (denied) return denied
  const allowed = allowedCompanyIds(actor)
  if (query.companyId && allowed && !allowed.has(query.companyId)) return fail(403, '不能查看该公司的部门')
  const matched = new Set<string>()
  for (const dept of depts) {
    if (allowed && !allowed.has(dept.companyId)) continue
    if (query.companyId && dept.companyId !== query.companyId) continue
    const nameOk = !query.name || dept.name.includes(query.name) || dept.code.includes(query.name)
    const statusOk = !query.status || dept.status === query.status
    if (nameOk && statusOk) matched.add(dept.id)
  }
  const visible = withAncestors(matched, depts)
  const list = depts
    .filter((dept) => visible.has(dept.id))
    .filter((dept) => !allowed || allowed.has(dept.companyId))
    .filter((dept) => !query.companyId || dept.companyId === query.companyId)
    .map(toDeptNode)
  return success(pageOf(buildTree(list), query.pageNum, query.pageSize))
}

interface DeptInput {
  name: string
  code: string
  companyId: string
  parentId: string | null
  sort: number
  leader: string
  status: Status
}

function validateDept(input: DeptInput, currentId?: string): OpResult<never> | null {
  if (!input.name) return fail(400, '请填写部门名称')
  if (!input.code) return fail(400, '请填写部门编码')
  if (!companies.some((item) => item.id === input.companyId)) return fail(400, '所属公司不存在')
  if (depts.some((item) => item.companyId === input.companyId && item.code === input.code && item.id !== currentId)) {
    return fail(400, '该公司下部门编码已存在')
  }
  if (input.parentId) {
    if (input.parentId === currentId) return fail(400, '上级部门不能是自己')
    const parent = depts.find((item) => item.id === input.parentId)
    if (!parent) return fail(400, '上级部门不存在')
    if (parent.companyId !== input.companyId) return fail(400, '上级部门必须属于同一公司')
    if (currentId && descendantIds(currentId, depts).has(input.parentId)) {
      return fail(400, '上级部门不能选自己的下级')
    }
  }
  return null
}

export function createDept(actor: Actor, input: DeptInput): OpResult<DeptNode> {
  const denied = requirePerm(actor, 'system:dept:create')
  if (denied) return denied
  if (!canAccessCompany(actor, input.companyId)) return fail(403, '不能在该公司下新增部门')
  const invalid = validateDept(input)
  if (invalid) return invalid
  const dept: DbDept = { id: uid('d'), ...input, updatedAt: now() }
  depts.push(dept)
  return success(toDeptNode(dept))
}

export function updateDept(actor: Actor, id: string, input: DeptInput): OpResult<DeptNode> {
  const denied = requirePerm(actor, 'system:dept:update')
  if (denied) return denied
  const current = depts.find((item) => item.id === id)
  if (!current) return fail(400, '部门不存在')
  if (!canAccessCompany(actor, current.companyId) || !canAccessCompany(actor, input.companyId)) {
    return fail(403, '不能修改该部门')
  }
  const invalid = validateDept(input, id)
  if (invalid) return invalid
  if (input.companyId !== current.companyId && depts.some((item) => item.parentId === id)) {
    return fail(400, '存在下级部门时不能变更所属公司')
  }
  if (input.companyId !== current.companyId && users.some((item) => item.deptId === id)) {
    return fail(400, '部门下已有用户时不能变更所属公司')
  }
  Object.assign(current, input, { updatedAt: now() })
  return success(toDeptNode(current))
}

export function removeDept(actor: Actor, id: string): OpResult<null> {
  const denied = requirePerm(actor, 'system:dept:delete')
  if (denied) return denied
  const index = depts.findIndex((item) => item.id === id)
  const current = depts[index]
  if (!current) return fail(400, '部门不存在')
  if (!canAccessCompany(actor, current.companyId)) return fail(403, '不能删除该部门')
  if (depts.some((item) => item.parentId === id)) return fail(400, '请先删除下级部门')
  if (users.some((item) => item.deptId === id)) return fail(400, '请先移除该部门下的用户')
  depts.splice(index, 1)
  return success(null)
}

function visibleRoles(actor: Actor) {
  return roles.filter((role) => SCOPE_RANK[role.dataScope] <= SCOPE_RANK[actor.dataScope])
}

export function listRoles(
  actor: Actor,
  query: { name: string; status: string; pageNum: number; pageSize: number },
): OpResult<PageResult<DbRole>> {
  const denied = requireAny(actor, ['system:role:query', 'system:user:query'])
  if (denied) return denied
  const list = visibleRoles(actor).filter((role) => {
    const nameOk = !query.name || role.name.includes(query.name) || role.code.includes(query.name)
    const statusOk = !query.status || role.status === query.status
    return nameOk && statusOk
  })
  return success(pageOf(list, query.pageNum, query.pageSize))
}

export function listMenus(
  actor: Actor,
  query: { name: string; type: string } = { name: '', type: '' },
): OpResult<MenuNode[]> {
  const denied = requireAny(actor, ['system:menu:query', 'system:role:update'])
  if (denied) return denied
  const name = query.name.trim()
  const type = query.type === 'DIR' || query.type === 'MENU' || query.type === 'BUTTON' ? query.type : ''
  if (!name && !type) return success(menuTree(true))
  const matched = new Set<string>()
  for (const menu of menus) {
    const nameOk = !name || menu.name.includes(name) || menu.path.includes(name) || menu.permission.includes(name)
    const typeOk = !type || menu.type === type
    if (nameOk && typeOk) matched.add(menu.id)
  }
  const visible = withAncestors(matched, menus)
  if (name) {
    for (const id of matched) {
      for (const childId of descendantIds(id, menus)) visible.add(childId)
    }
  }
  return success(buildTree(menus.filter((menu) => visible.has(menu.id)).map(toMenuNode)))
}

interface MenuInput {
  parentId: string | null
  name: string
  path: string
  component: string
  icon: string
  sort: number
  type: MenuType
  permission: string
}

function normalizeMenu(input: MenuInput): MenuInput {
  if (input.type === 'BUTTON') return { ...input, path: '', component: '', icon: '' }
  if (input.type === 'DIR') return { ...input, component: '', permission: '' }
  return input
}

function validateMenu(input: MenuInput, currentId?: string): OpResult<never> | null {
  if (!input.name || input.name.length > 30) return fail(400, '名称需在 30 个字以内')
  if (!Number.isInteger(input.sort) || input.sort < 0 || input.sort > 9999) return fail(400, '排序需为 0 到 9999 的整数')
  const current = currentId ? menus.find((item) => item.id === currentId) : undefined
  if (currentId && !current) return fail(400, '菜单不存在')
  if (current && current.type !== input.type && menus.some((item) => item.parentId === currentId)) {
    return fail(400, '存在下级时不能修改类型')
  }
  if (currentId && input.parentId) {
    if (input.parentId === currentId || descendantIds(currentId, menus).has(input.parentId)) {
      return fail(400, '上级不能选择自己或下级')
    }
  }
  const parent = input.parentId ? menus.find((item) => item.id === input.parentId) : undefined
  if (input.parentId && !parent) return fail(400, '上级菜单不存在')
  if (input.type === 'BUTTON') {
    if (!parent || parent.type !== 'MENU') return fail(400, '按钮必须挂在菜单下')
    if (!input.permission) return fail(400, '请填写权限标识')
  } else if (parent && parent.type !== 'DIR') {
    return fail(400, '目录和菜单只能挂在目录下')
  }
  if (input.type !== 'BUTTON') {
    if (!/^\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/.test(input.path)) {
      return fail(400, '路由地址需以 / 开头，仅包含字母、数字、-、_')
    }
    if (parent?.path && !input.path.startsWith(`${parent.path}/`)) {
      return fail(400, `路由地址需以 ${parent.path}/ 开头`)
    }
    if (menus.some((item) => item.path === input.path && item.id !== currentId)) return fail(400, '路由地址已存在')
  }
  if (input.type === 'MENU') {
    if (!/^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)+$/.test(input.component)) return fail(400, '页面组件格式不正确')
  }
  if (input.icon && !/^[A-Z][A-Za-z0-9]*$/.test(input.icon)) return fail(400, '图标不正确')
  if (input.permission && !/^[a-z][A-Za-z0-9]*:[A-Za-z][A-Za-z0-9]*:[A-Za-z][A-Za-z0-9]*$/.test(input.permission)) {
    return fail(400, '权限标识格式应为 模块:实体:动作')
  }
  if (input.permission && menus.some((item) => item.permission === input.permission && item.id !== currentId)) {
    return fail(400, '权限标识已存在')
  }
  return null
}

function grantCreatedMenu(actor: Actor, menuId: string) {
  const owner = users.find((item) => item.id === actor.id)
  const ownedRoles = new Set(owner?.roleIds ?? [])
  for (const role of roles) {
    if (role.dataScope !== 'ALL' && !ownedRoles.has(role.id)) continue
    if (!role.menuIds.includes(menuId)) role.menuIds.push(menuId)
  }
}

export function createMenu(actor: Actor, input: MenuInput): OpResult<MenuNode> {
  const denied = requirePerm(actor, 'system:menu:create')
  if (denied) return denied
  const normalized = normalizeMenu(input)
  const invalid = validateMenu(normalized)
  if (invalid) return invalid
  const menu: DbMenu = { id: uid(normalized.type === 'BUTTON' ? 'b' : 'm'), ...normalized }
  menus.push(menu)
  grantCreatedMenu(actor, menu.id)
  return success(toMenuNode(menu))
}

export function updateMenu(actor: Actor, id: string, input: MenuInput): OpResult<MenuNode> {
  const denied = requirePerm(actor, 'system:menu:update')
  if (denied) return denied
  const current = menus.find((item) => item.id === id)
  if (!current) return fail(400, '菜单不存在')
  const normalized = normalizeMenu(input)
  const invalid = validateMenu(normalized, id)
  if (invalid) return invalid
  Object.assign(current, normalized)
  return success(toMenuNode(current))
}

export function removeMenu(actor: Actor, id: string): OpResult<null> {
  const denied = requirePerm(actor, 'system:menu:delete')
  if (denied) return denied
  const index = menus.findIndex((item) => item.id === id)
  if (index < 0) return fail(400, '菜单不存在')
  if (menus.some((item) => item.parentId === id)) return fail(400, '请先删除下级菜单')
  menus.splice(index, 1)
  for (const role of roles) {
    if (role.menuIds.includes(id)) role.menuIds = role.menuIds.filter((item) => item !== id)
  }
  return success(null)
}

interface RoleInput {
  name: string
  code: string
  sort: number
  status: Status
  dataScope: DataScope
  remark: string
}

function validateRole(actor: Actor, input: RoleInput, currentId?: string): OpResult<never> | null {
  if (!input.name) return fail(400, '请填写角色名称')
  if (!input.code) return fail(400, '请填写角色编码')
  if (roles.some((item) => item.code === input.code && item.id !== currentId)) return fail(400, '角色编码已存在')
  if (SCOPE_RANK[input.dataScope] > SCOPE_RANK[actor.dataScope]) return fail(403, '不能分配超出自己的数据范围')
  return null
}

export function createRole(actor: Actor, input: RoleInput): OpResult<DbRole> {
  const denied = requirePerm(actor, 'system:role:create')
  if (denied) return denied
  const invalid = validateRole(actor, input)
  if (invalid) return invalid
  const role: DbRole = { id: uid('r'), ...input, menuIds: [], updatedAt: now() }
  roles.push(role)
  return success(role)
}

export function updateRole(actor: Actor, id: string, input: RoleInput): OpResult<DbRole> {
  const denied = requirePerm(actor, 'system:role:update')
  if (denied) return denied
  const current = roles.find((item) => item.id === id)
  if (!current) return fail(400, '角色不存在')
  if (SCOPE_RANK[current.dataScope] > SCOPE_RANK[actor.dataScope]) return fail(403, '不能修改该角色')
  const invalid = validateRole(actor, input, id)
  if (invalid) return invalid
  Object.assign(current, input, { updatedAt: now() })
  return success(current)
}

export function updateRoleMenus(
  actor: Actor,
  id: string,
  menuIds: string[],
  dataScope: DataScope,
): OpResult<DbRole> {
  const denied = requirePerm(actor, 'system:role:update')
  if (denied) return denied
  const current = roles.find((item) => item.id === id)
  if (!current) return fail(400, '角色不存在')
  if (SCOPE_RANK[current.dataScope] > SCOPE_RANK[actor.dataScope]) return fail(403, '不能授权该角色')
  if (SCOPE_RANK[dataScope] > SCOPE_RANK[actor.dataScope]) return fail(403, '不能分配超出自己的数据范围')
  const known = new Set(menus.map((item) => item.id))
  current.menuIds = [...new Set(menuIds.filter((item) => known.has(item)))]
  current.dataScope = dataScope
  current.updatedAt = now()
  return success(current)
}

export function removeRole(actor: Actor, id: string): OpResult<null> {
  const denied = requirePerm(actor, 'system:role:delete')
  if (denied) return denied
  const index = roles.findIndex((item) => item.id === id)
  const current = roles[index]
  if (!current) return fail(400, '角色不存在')
  if (SCOPE_RANK[current.dataScope] > SCOPE_RANK[actor.dataScope]) return fail(403, '不能删除该角色')
  if (users.some((item) => item.roleIds.includes(id))) return fail(400, '角色已分配给用户，不能删除')
  roles.splice(index, 1)
  return success(null)
}

function toUserView(user: DbUser): UserView {
  return {
    id: user.id,
    username: user.username,
    nickname: user.nickname,
    employeeName: user.employeeName,
    companyId: user.companyId,
    companyName: companyName(user.companyId),
    deptId: user.deptId,
    deptName: deptName(user.deptId),
    email: user.email,
    mobile: user.mobile,
    officePhone: user.officePhone,
    status: user.status,
    roleIds: [...user.roleIds],
    roleNames: user.roleIds.map(roleName).filter(Boolean),
    updatedAt: user.updatedAt,
  }
}

function userVisible(actor: Actor, user: DbUser) {
  if (actor.dataScope === 'ALL') return true
  if (actor.dataScope === 'SELF') return user.id === actor.id
  if (actor.dataScope === 'DEPT') return user.deptId === actor.deptId
  return canAccessCompany(actor, user.companyId)
}

export function listUsers(
  actor: Actor,
  query: {
    username: string
    nickname: string
    status: string
    companyId: string
    deptId: string
    pageNum: number
    pageSize: number
  },
): OpResult<PageResult<UserView>> {
  const denied = requirePerm(actor, 'system:user:query')
  if (denied) return denied
  const list = users.filter((user) => {
    if (!userVisible(actor, user)) return false
    if (query.companyId && user.companyId !== query.companyId) return false
    if (query.deptId && user.deptId !== query.deptId) return false
    if (query.username && !user.username.includes(query.username)) return false
    if (query.nickname && !user.nickname.includes(query.nickname) && !user.employeeName.includes(query.nickname)) {
      return false
    }
    if (query.status && user.status !== query.status) return false
    return true
  })
  return success(pageOf(list.map(toUserView), query.pageNum, query.pageSize))
}

interface UserInput {
  username: string
  nickname: string
  employeeName: string
  companyId: string
  deptId: string
  email: string
  mobile: string
  officePhone: string
  status: Status
  roleIds: string[]
  password: string
}

function validateUser(actor: Actor, input: UserInput, currentId?: string): OpResult<never> | null {
  if (!input.username) return fail(400, '请填写登录账号')
  if (!input.nickname) return fail(400, '请填写用户昵称')
  if (!input.employeeName) return fail(400, '请填写员工姓名')
  if (users.some((item) => item.username === input.username && item.id !== currentId)) {
    return fail(400, '登录账号已存在')
  }
  const company = companies.find((item) => item.id === input.companyId)
  if (!company) return fail(400, '所属公司不存在')
  if (!canAccessCompany(actor, input.companyId)) return fail(403, '不能把用户放到该公司')
  const dept = depts.find((item) => item.id === input.deptId)
  if (!dept || dept.companyId !== input.companyId) return fail(400, '部门必须属于所选公司')
  if (actor.dataScope === 'DEPT' && input.deptId !== actor.deptId) return fail(403, '只能管理部门内的用户')
  if (input.roleIds.length === 0) return fail(400, '请选择角色')
  const grantable = new Set(visibleRoles(actor).map((item) => item.id))
  if (input.roleIds.some((id) => !grantable.has(id))) return fail(403, '不能分配该角色')
  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) return fail(400, '邮箱格式不正确')
  return null
}

export function createUser(actor: Actor, input: UserInput): OpResult<UserView> {
  const denied = requirePerm(actor, 'system:user:create')
  if (denied) return denied
  if (input.password.length < 6) return fail(400, '初始密码至少 6 位')
  const invalid = validateUser(actor, input)
  if (invalid) return invalid
  const user: DbUser = {
    id: uid('u'),
    username: input.username,
    password: input.password,
    nickname: input.nickname,
    employeeName: input.employeeName,
    companyId: input.companyId,
    deptId: input.deptId,
    email: input.email,
    mobile: input.mobile,
    officePhone: input.officePhone,
    status: input.status,
    roleIds: [...input.roleIds],
    updatedAt: now(),
  }
  users.unshift(user)
  return success(toUserView(user))
}

export function updateUser(actor: Actor, id: string, input: UserInput): OpResult<UserView> {
  const denied = requirePerm(actor, 'system:user:update')
  if (denied) return denied
  const current = users.find((item) => item.id === id)
  if (!current) return fail(400, '用户不存在')
  if (!userVisible(actor, current)) return fail(403, '不能修改该用户')
  if (current.id === actor.id && input.status === 'DISABLED') return fail(400, '不能停用当前登录账号')
  const invalid = validateUser(actor, { ...input, username: current.username }, id)
  if (invalid) return invalid
  current.nickname = input.nickname
  current.employeeName = input.employeeName
  current.companyId = input.companyId
  current.deptId = input.deptId
  current.email = input.email
  current.mobile = input.mobile
  current.officePhone = input.officePhone
  current.status = input.status
  current.roleIds = [...input.roleIds]
  current.updatedAt = now()
  return success(toUserView(current))
}

export function removeUser(actor: Actor, id: string): OpResult<null> {
  const denied = requirePerm(actor, 'system:user:delete')
  if (denied) return denied
  const index = users.findIndex((item) => item.id === id)
  const current = users[index]
  if (!current) return fail(400, '用户不存在')
  if (current.id === actor.id) return fail(400, '不能删除当前登录账号')
  if (!userVisible(actor, current)) return fail(403, '不能删除该用户')
  users.splice(index, 1)
  for (const [token, userId] of sessions) {
    if (userId === id) sessions.delete(token)
  }
  return success(null)
}

export function resetPassword(actor: Actor, id: string, password: string): OpResult<null> {
  const denied = requirePerm(actor, 'system:user:resetPwd')
  if (denied) return denied
  const current = users.find((item) => item.id === id)
  if (!current) return fail(400, '用户不存在')
  if (!userVisible(actor, current)) return fail(403, '不能重置该用户密码')
  if (password.length < 6) return fail(400, '密码至少 6 位')
  current.password = password
  current.updatedAt = now()
  return success(null)
}

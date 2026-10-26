export interface PageResult<T> {
  list: T[]
  total: number
  pageNum: number
  pageSize: number
}

export type Status = 'NORMAL' | 'DISABLED'
export type DataScope = 'ALL' | 'COMPANY' | 'DEPT' | 'SELF'
export type MenuType = 'DIR' | 'MENU' | 'BUTTON'

export interface DbMenu {
  id: string
  parentId: string | null
  name: string
  path: string
  component: string
  icon: string
  sort: number
  type: MenuType
  permission: string
}

export interface MenuNode {
  id: string
  parentId: string | null
  name: string
  path: string
  component?: string
  icon?: string
  sort: number
  type: MenuType
  permission?: string
  children?: MenuNode[]
}

export interface DbCompany {
  id: string
  name: string
  code: string
  parentId: string | null
  sort: number
  leader: string
  phone: string
  address: string
  status: Status
  updatedAt: string
}

export interface CompanyNode extends DbCompany {
  children?: CompanyNode[]
}

export interface DbDept {
  id: string
  name: string
  code: string
  companyId: string
  parentId: string | null
  sort: number
  leader: string
  status: Status
  updatedAt: string
}

export interface DeptNode extends DbDept {
  companyName: string
  children?: DeptNode[]
}

export interface DbRole {
  id: string
  name: string
  code: string
  sort: number
  status: Status
  dataScope: DataScope
  remark: string
  menuIds: string[]
  updatedAt: string
}

export interface DbUser {
  id: string
  username: string
  password: string
  nickname: string
  employeeName: string
  companyId: string
  deptId: string
  email: string
  mobile: string
  officePhone: string
  status: Status
  roleIds: string[]
  updatedAt: string
}

export interface UserInfo {
  id: string
  username: string
  nickname: string
  employeeName: string
  companyId: string
  companyName: string
  deptId: string
  deptName: string
  email: string
  mobile: string
}

export interface Profile {
  user: UserInfo
  permissions: string[]
  menus: MenuNode[]
}

export interface UserView {
  id: string
  username: string
  nickname: string
  employeeName: string
  companyId: string
  companyName: string
  deptId: string
  deptName: string
  email: string
  mobile: string
  officePhone: string
  status: Status
  roleIds: string[]
  roleNames: string[]
  updatedAt: string
}

export interface Actor {
  id: string
  companyId: string
  deptId: string
  permissions: string[]
  dataScope: DataScope
}

export type OpResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: number; message: string }

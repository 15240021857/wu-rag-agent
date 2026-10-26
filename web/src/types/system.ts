import type { DataScope, MenuType, PageQuery, Status } from './api'

export interface Menu {
  id: string
  parentId: string | null
  name: string
  path: string
  component?: string
  icon?: string
  sort: number
  type: MenuType
  permission?: string
  children?: Menu[]
}

export interface MenuPayload {
  parentId: string | null
  name: string
  path: string
  component: string
  icon: string
  sort: number
  type: MenuType
  permission: string
}

export interface MenuQuery {
  name?: string
  type?: MenuType | ''
}

export interface Company {
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
  children?: Company[]
}

export interface CompanyPayload {
  name: string
  code: string
  parentId: string | null
  sort: number
  leader: string
  phone: string
  address: string
  status: Status
}

export interface CompanyQuery extends PageQuery {
  name?: string
  status?: Status | ''
}

export interface Dept {
  id: string
  name: string
  code: string
  companyId: string
  companyName: string
  parentId: string | null
  sort: number
  leader: string
  status: Status
  updatedAt: string
  children?: Dept[]
}

export interface DeptPayload {
  name: string
  code: string
  companyId: string
  parentId: string | null
  sort: number
  leader: string
  status: Status
}

export interface DeptQuery extends PageQuery {
  name?: string
  status?: Status | ''
  companyId?: string
}

export interface Role {
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

export interface RolePayload {
  name: string
  code: string
  sort: number
  status: Status
  dataScope: DataScope
  remark: string
}

export interface RoleQuery extends PageQuery {
  name?: string
  status?: Status | ''
}

export interface RoleMenuPayload {
  menuIds: string[]
  dataScope: DataScope
}

export interface User {
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

export interface UserPayload {
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
  password?: string
}

export interface UserQuery extends PageQuery {
  username?: string
  nickname?: string
  status?: Status | ''
  companyId?: string
  deptId?: string
}

export interface ResetPasswordPayload {
  password: string
}

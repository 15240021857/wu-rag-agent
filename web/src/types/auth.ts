import type { Menu } from './system'

export interface LoginPayload {
  username: string
  password: string
}

export interface LoginResult {
  token: string
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
  menus: Menu[]
}

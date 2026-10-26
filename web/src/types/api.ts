export interface ApiResponse<T> {
  code: number
  message: string
  data: T
}

export interface PageQuery {
  pageNum: number
  pageSize: number
}

export interface PageResult<T> {
  list: T[]
  total: number
  pageNum: number
  pageSize: number
}

export type Status = 'NORMAL' | 'DISABLED'

export type DataScope = 'ALL' | 'COMPANY' | 'DEPT' | 'SELF'

export type MenuType = 'DIR' | 'MENU' | 'BUTTON'

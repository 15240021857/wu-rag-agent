import type { DataScope, MenuType, Status } from '@/types/api'

export const STATUS_OPTIONS: Array<{ label: string; value: Status }> = [
  { label: '正常', value: 'NORMAL' },
  { label: '停用', value: 'DISABLED' },
]

export const MENU_TYPE_OPTIONS: Array<{ label: string; value: MenuType }> = [
  { label: '目录', value: 'DIR' },
  { label: '菜单', value: 'MENU' },
  { label: '按钮', value: 'BUTTON' },
]

export const DATA_SCOPE_OPTIONS: Array<{ label: string; value: DataScope }> = [
  { label: '全部', value: 'ALL' },
  { label: '本公司', value: 'COMPANY' },
  { label: '本部门', value: 'DEPT' },
  { label: '仅本人', value: 'SELF' },
]

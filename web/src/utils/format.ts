import type { DataScope } from '@/types/api'
import dayjs from 'dayjs'

const DATA_SCOPE_LABEL: Record<DataScope, string> = {
  ALL: '全部',
  COMPANY: '本公司',
  DEPT: '本部门',
  SELF: '仅本人',
}

export function formatDateTime(value: string) {
  if (!value) return ''
  return dayjs(value).format('YYYY-MM-DD HH:mm')
}

export function dataScopeLabel(value: DataScope) {
  return DATA_SCOPE_LABEL[value]
}

export function formatFileSize(size: number) {
  if (!Number.isFinite(size) || size < 0) return ''
  if (size < 1024) return `${Math.round(size)} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

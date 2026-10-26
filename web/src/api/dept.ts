import type { PageResult } from '@/types/api'
import type { Dept, DeptPayload, DeptQuery } from '@/types/system'
import { http } from '@/utils/request'

export function fetchDepts(params: DeptQuery) {
  return http<PageResult<Dept>>({ url: '/system/depts', method: 'GET', params })
}

export function createDept(data: DeptPayload) {
  return http<Dept>({ url: '/system/depts', method: 'POST', data })
}

export function updateDept(id: string, data: DeptPayload) {
  return http<Dept>({ url: `/system/depts/${id}`, method: 'PUT', data })
}

export function deleteDept(id: string) {
  return http<null>({ url: `/system/depts/${id}`, method: 'DELETE' })
}

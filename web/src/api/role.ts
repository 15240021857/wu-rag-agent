import type { PageResult } from '@/types/api'
import type { Role, RoleMenuPayload, RolePayload, RoleQuery } from '@/types/system'
import { http } from '@/utils/request'

export function fetchRoles(params: RoleQuery) {
  return http<PageResult<Role>>({ url: '/system/roles', method: 'GET', params })
}

export function createRole(data: RolePayload) {
  return http<Role>({ url: '/system/roles', method: 'POST', data })
}

export function updateRole(id: string, data: RolePayload) {
  return http<Role>({ url: `/system/roles/${id}`, method: 'PUT', data })
}

export function deleteRole(id: string) {
  return http<null>({ url: `/system/roles/${id}`, method: 'DELETE' })
}

export function updateRoleMenus(id: string, data: RoleMenuPayload) {
  return http<Role>({ url: `/system/roles/${id}/menus`, method: 'PUT', data })
}

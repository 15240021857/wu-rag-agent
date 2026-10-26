import type { PageResult } from '@/types/api'
import type { ResetPasswordPayload, User, UserPayload, UserQuery } from '@/types/system'
import { http } from '@/utils/request'

export function fetchUsers(params: UserQuery) {
  return http<PageResult<User>>({ url: '/system/users', method: 'GET', params })
}

export function createUser(data: UserPayload) {
  return http<User>({ url: '/system/users', method: 'POST', data })
}

export function updateUser(id: string, data: UserPayload) {
  return http<User>({ url: `/system/users/${id}`, method: 'PUT', data })
}

export function deleteUser(id: string) {
  return http<null>({ url: `/system/users/${id}`, method: 'DELETE' })
}

export function resetUserPassword(id: string, data: ResetPasswordPayload) {
  return http<null>({ url: `/system/users/${id}/password`, method: 'PUT', data })
}

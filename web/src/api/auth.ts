import type { LoginPayload, LoginResult, Profile } from '@/types/auth'
import { http } from '@/utils/request'

export function login(data: LoginPayload) {
  return http<LoginResult>({ url: '/auth/login', method: 'POST', data })
}

export function logout() {
  return http<null>({ url: '/auth/logout', method: 'POST' })
}

export function getProfile() {
  return http<Profile>({ url: '/auth/profile', method: 'GET' })
}

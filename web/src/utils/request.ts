import type { ApiResponse } from '@/types/api'
import { message } from 'ant-design-vue'
import axios, { type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios'

const TOKEN_KEY = 'rag_token'

let onUnauthorized = () => {
  localStorage.removeItem(TOKEN_KEY)
}

export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) ?? ''
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

const service = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '/api',
  timeout: 15000,
})

service.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

service.interceptors.response.use(
  (response) => {
    const body = response.data as ApiResponse<unknown>
    if (body.code === 401) {
      onUnauthorized()
      message.error(body.message || '登录已过期，请重新登录')
      return Promise.reject(new Error(body.message || '未登录'))
    }
    if (body.code !== 0) {
      message.error(body.message || '请求失败')
      return Promise.reject(new Error(body.message || '请求失败'))
    }
    return response
  },
  (error: unknown) => {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status
      const body = error.response?.data as ApiResponse<unknown> | undefined
      if (status === 401) {
        onUnauthorized()
        message.error(body?.message || '登录已过期，请重新登录')
        return Promise.reject(error)
      }
      message.error(body?.message || '网络异常，请稍后重试')
      return Promise.reject(error)
    }
    message.error('网络异常，请稍后重试')
    return Promise.reject(error instanceof Error ? error : new Error('网络异常'))
  },
)

export async function http<T>(config: AxiosRequestConfig): Promise<T> {
  const response = await service.request<ApiResponse<T>>(config)
  return response.data.data
}

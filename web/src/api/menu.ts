import type { Menu, MenuPayload, MenuQuery } from '@/types/system'
import { http } from '@/utils/request'

export function fetchMenus(params?: MenuQuery) {
  return http<Menu[]>({ url: '/system/menus', method: 'GET', params })
}

export function createMenu(data: MenuPayload) {
  return http<Menu>({ url: '/system/menus', method: 'POST', data })
}

export function updateMenu(id: string, data: MenuPayload) {
  return http<Menu>({ url: `/system/menus/${id}`, method: 'PUT', data })
}

export function deleteMenu(id: string) {
  return http<null>({ url: `/system/menus/${id}`, method: 'DELETE' })
}

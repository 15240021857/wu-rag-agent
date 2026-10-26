import type { Menu } from '@/types/system'
import type { Component } from 'vue'
import type { RouteRecordRaw, Router } from 'vue-router'

type ViewModule = { default: Component }
type ViewLoader = () => Promise<ViewModule>

const viewModules = import.meta.glob('../views/**/*.vue') as Record<string, ViewLoader>

const addedNames = new Set<string>()
const routeSignatures = new Map<string, string>()
let routerRef: Router | null = null

export function bindRouter(router: Router) {
  routerRef = router
}

export function resolveView(component: string): ViewLoader | undefined {
  return viewModules[`../views/${component}.vue`]
}

function toRoute(menu: Menu): RouteRecordRaw | null {
  if (menu.type !== 'MENU' || !menu.component) return null
  const loader = resolveView(menu.component)
  if (!loader) return null
  return {
    path: menu.path,
    name: menu.id,
    component: loader,
    meta: {
      title: menu.name,
      icon: menu.icon,
    },
  }
}

function routeSignature(menu: Menu) {
  return `${menu.path}\0${menu.component ?? ''}\0${menu.name}\0${menu.icon ?? ''}`
}

function collectMenuRoutes(menus: Menu[], bucket: Map<string, Menu>) {
  for (const menu of menus) {
    if (menu.type === 'MENU' && menu.component && resolveView(menu.component)) bucket.set(menu.id, menu)
    if (menu.children?.length) collectMenuRoutes(menu.children, bucket)
  }
}

export function listViewComponents() {
  return Object.keys(viewModules)
    .map((key) => key.replace(/\\/g, '/').replace(/^\.\.\/views\//, '').replace(/\.vue$/, ''))
    .filter((item) => item !== 'login/index' && item !== 'exception/404')
    .sort((left, right) => left.localeCompare(right))
}

export function addDynamicRoutes(menus: Menu[]) {
  const router = routerRef
  if (!router) return
  const next = new Map<string, Menu>()
  collectMenuRoutes(menus, next)
  for (const [name, menu] of next) {
    const signature = routeSignature(menu)
    if (routeSignatures.get(name) === signature && router.hasRoute(name)) continue
    const route = toRoute(menu)
    if (!route) continue
    if (router.hasRoute(name)) router.removeRoute(name)
    router.addRoute('Layout', route)
    routeSignatures.set(name, signature)
    addedNames.add(name)
  }
  for (const name of [...addedNames]) {
    if (next.has(name)) continue
    if (router.hasRoute(name)) router.removeRoute(name)
    addedNames.delete(name)
    routeSignatures.delete(name)
  }
}

export function resetDynamicRoutes() {
  const router = routerRef
  if (!router) return
  for (const name of addedNames) {
    if (router.hasRoute(name)) router.removeRoute(name)
  }
  addedNames.clear()
  routeSignatures.clear()
}

export function firstLeafPath(menus: Menu[]): string | null {
  for (const menu of menus) {
    if (menu.type === 'MENU' && menu.path) return menu.path
    if (menu.children?.length) {
      const child = firstLeafPath(menu.children)
      if (child) return child
    }
  }
  return null
}

import { useUserStore } from '@/stores/user'
import type { Router } from 'vue-router'
import { addDynamicRoutes, bindRouter, firstLeafPath } from './dynamic'

export function setupGuard(router: Router) {
  bindRouter(router)
  router.beforeEach(async (to) => {
    const userStore = useUserStore()
    const title = typeof to.meta.title === 'string' ? to.meta.title : ''
    document.title = title ? `${title} - 知识中枢 RAG` : '知识中枢 RAG'

    if (to.path === '/login') {
      if (!userStore.token) return true
      if (!userStore.loaded) {
        try {
          await userStore.fetchProfile()
          addDynamicRoutes(userStore.menus)
        } catch {
          userStore.clearSession()
          return true
        }
      }
      return firstLeafPath(userStore.menus) ?? '/'
    }

    if (!userStore.token) {
      return { path: '/login', query: { redirect: to.fullPath } }
    }

    if (!userStore.loaded) {
      try {
        await userStore.fetchProfile()
        addDynamicRoutes(userStore.menus)
      } catch {
        userStore.clearSession()
        return { path: '/login', query: { redirect: to.fullPath } }
      }
      return { path: to.path, query: to.query, hash: to.hash, replace: true }
    }

    if (to.path === '/') return firstLeafPath(userStore.menus) ?? '/login'
    return true
  })
}

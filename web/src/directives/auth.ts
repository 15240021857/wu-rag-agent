import { useUserStore } from '@/stores/user'
import type { App, Directive } from 'vue'

export const authDirective: Directive<HTMLElement, string> = {
  mounted(el, binding) {
    const permission = binding.value
    if (!permission) return
    const permissions = useUserStore().permissions
    if (!permissions.includes(permission)) el.parentNode?.removeChild(el)
  },
}

export function setupAuthDirective(app: App) {
  app.directive('auth', authDirective)
}

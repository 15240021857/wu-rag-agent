import { getProfile, login as loginApi, logout as logoutApi } from '@/api/auth'
import { resetDynamicRoutes } from '@/router/dynamic'
import { useTabsStore } from '@/stores/tabs'
import type { LoginPayload, Profile } from '@/types/auth'
import type { Menu } from '@/types/system'
import { clearToken, getToken, setToken } from '@/utils/request'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export const useUserStore = defineStore('user', () => {
  const token = ref(getToken())
  const profile = ref<Profile | null>(null)
  const loaded = ref(false)

  const permissions = computed(() => profile.value?.permissions ?? [])
  const menus = computed<Menu[]>(() => profile.value?.menus ?? [])
  const user = computed(() => profile.value?.user ?? null)

  async function login(payload: LoginPayload) {
    const result = await loginApi(payload)
    token.value = result.token
    setToken(result.token)
  }

  async function fetchProfile() {
    profile.value = await getProfile()
    loaded.value = true
  }

  function clearSession() {
    token.value = ''
    profile.value = null
    loaded.value = false
    clearToken()
    resetDynamicRoutes()
    useTabsStore().reset()
  }

  async function logout() {
    try {
      await logoutApi()
    } finally {
      clearSession()
    }
  }

  function hasAuth(permission: string) {
    return permissions.value.includes(permission)
  }

  return {
    token,
    profile,
    loaded,
    permissions,
    menus,
    user,
    login,
    fetchProfile,
    logout,
    clearSession,
    hasAuth,
  }
})

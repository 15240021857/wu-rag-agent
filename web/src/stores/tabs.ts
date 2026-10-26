import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface TabItem {
  path: string
  title: string
  closable: boolean
}

export const useTabsStore = defineStore('tabs', () => {
  const tabs = ref<TabItem[]>([])

  function open(path: string, title: string) {
    if (tabs.value.some((item) => item.path === path)) return
    tabs.value.push({
      path,
      title,
      closable: path !== '/dashboard',
    })
  }

  function close(path: string, current: string) {
    const index = tabs.value.findIndex((item) => item.path === path)
    if (index < 0) return null
    const tab = tabs.value[index]
    if (!tab?.closable) return null
    tabs.value.splice(index, 1)
    if (path !== current) return null
    const next = tabs.value[index] ?? tabs.value[index - 1]
    return next?.path ?? '/dashboard'
  }

  function reset() {
    tabs.value = []
  }

  return { tabs, open, close, reset }
})

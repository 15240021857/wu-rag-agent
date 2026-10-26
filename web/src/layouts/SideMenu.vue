<script setup lang="ts">
import { resolveIcon } from '@/components/icons'
import type { Menu } from '@/types/system'

defineProps<{
  menus: Menu[]
}>()
</script>

<template>
  <template v-for="menu in menus" :key="menu.id">
    <a-sub-menu v-if="menu.type === 'DIR'" :key="menu.path">
      <template v-if="resolveIcon(menu.icon)" #icon>
        <component :is="resolveIcon(menu.icon)" />
      </template>
      <template #title>{{ menu.name }}</template>
      <SideMenu v-if="menu.children?.length" :menus="menu.children" />
      <a-menu-item v-else disabled :key="`${menu.path}#empty`">暂无菜单</a-menu-item>
    </a-sub-menu>
    <a-menu-item v-else :key="menu.path">
      <template v-if="resolveIcon(menu.icon)" #icon>
        <component :is="resolveIcon(menu.icon)" />
      </template>
      {{ menu.name }}
    </a-menu-item>
  </template>
</template>

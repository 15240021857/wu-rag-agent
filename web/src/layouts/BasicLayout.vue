<script setup lang="ts">
import { resolveIcon } from '@/components/icons'
import { firstLeafPath } from '@/router/dynamic'
import { useTabsStore } from '@/stores/tabs'
import { useUserStore } from '@/stores/user'
import type { Menu } from '@/types/system'
import { BellOutlined, LogoutOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SideMenu from './SideMenu.vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const tabsStore = useTabsStore()

const activeTop = computed(() => {
  return userStore.menus.find((menu) => route.path === menu.path || route.path.startsWith(`${menu.path}/`))
    ?? userStore.menus[0]
})

const sideMenus = computed(() => {
  const current = activeTop.value
  if (!current) return []
  return current.children?.length ? current.children : [current]
})

function directoryPaths(menus: Menu[]) {
  const paths: string[] = []
  const walk = (nodes: Menu[]) => {
    for (const menu of nodes) {
      if (menu.type === 'DIR' && menu.path) paths.push(menu.path)
      if (menu.children?.length) walk(menu.children)
    }
  }
  walk(menus)
  return paths
}

const openKeys = computed(() => directoryPaths(sideMenus.value))

watch(
  () => route.path,
  () => {
    const title = route.meta.title
    if (typeof title === 'string' && title) tabsStore.open(route.path, title)
  },
  { immediate: true },
)

function openTop(menu: Menu) {
  const target = menu.type === 'MENU' ? menu.path : firstLeafPath(menu.children ?? [])
  if (target) void router.push(target)
}

function onMenuClick(info: { key: string | number }) {
  const path = String(info.key)
  if (!path.startsWith('/') || path.endsWith('#empty')) return
  void router.push(path)
}

function onTabChange(key: string | number) {
  void router.push(String(key))
}

function onTabEdit(target: MouseEvent | string | number, action: 'add' | 'remove') {
  if (action !== 'remove' || target instanceof MouseEvent) return
  const next = tabsStore.close(String(target), route.path)
  if (next) void router.push(next)
}

function onNotice() {
  message.info('暂无新消息')
}

async function onLogout() {
  await userStore.logout()
  await router.replace('/login')
}
</script>

<template>
  <a-layout class="layout">
    <a-layout-header class="header">
      <div class="brand" @click="router.push('/')">
        <span class="brand-mark">R</span>
        <span class="brand-name">知识中枢</span>
      </div>
      <nav class="top-nav">
        <button
          v-for="menu in userStore.menus"
          :key="menu.id"
          type="button"
          class="top-nav__item"
          :class="{ 'is-active': menu.id === activeTop?.id }"
          @click="openTop(menu)"
        >
          <component :is="resolveIcon(menu.icon)" v-if="resolveIcon(menu.icon)" />
          {{ menu.name }}
        </button>
      </nav>
      <div class="header-right">
        <span class="company-name">{{ userStore.user?.companyName }}</span>
        <button type="button" class="icon-btn" @click="onNotice">
          <BellOutlined />
        </button>
        <a-dropdown>
          <button type="button" class="user-entry">
            <span class="avatar">{{ userStore.user?.employeeName?.slice(0, 1) }}</span>
            <span>{{ userStore.user?.nickname }}</span>
          </button>
          <template #overlay>
            <a-menu>
              <a-menu-item key="logout" @click="onLogout">
                <LogoutOutlined />
                退出登录
              </a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
      </div>
    </a-layout-header>
    <a-layout class="body">
      <a-layout-sider class="sider" theme="light" :width="220">
        <div class="sider-user">
          <span class="avatar">{{ userStore.user?.employeeName?.slice(0, 1) }}</span>
          <div>
            <strong>{{ userStore.user?.employeeName }}</strong>
            <p>{{ userStore.user?.deptName }}</p>
          </div>
        </div>
        <a-menu
          mode="inline"
          :selected-keys="[route.path]"
          :open-keys="openKeys"
          @click="onMenuClick"
        >
          <SideMenu :menus="sideMenus" />
        </a-menu>
      </a-layout-sider>
      <a-layout-content class="main">
        <a-tabs
          class="tabs"
          type="editable-card"
          hide-add
          :active-key="route.path"
          @change="onTabChange"
          @edit="onTabEdit"
        >
          <a-tab-pane
            v-for="tab in tabsStore.tabs"
            :key="tab.path"
            :tab="tab.title"
            :closable="tab.closable"
          />
        </a-tabs>
        <div class="content">
          <router-view />
        </div>
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>

<style scoped lang="less">
.layout {
  min-height: 100vh;
  background: #f3f5f9;
}

.header {
  display: flex;
  align-items: center;
  height: 52px;
  padding: 0 16px 0 0;
  line-height: 52px;
  background: #3a67e8;
}

.brand {
  display: flex;
  gap: 8px;
  align-items: center;
  width: 220px;
  padding-left: 16px;
  color: #fff;
  cursor: pointer;
}

.brand-mark,
.avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  color: #3a67e8;
  font-weight: 700;
  background: #fff;
  border-radius: 8px;
}

.brand-name {
  font-size: 16px;
  font-weight: 650;
  letter-spacing: 0.5px;
}

.top-nav {
  display: flex;
  flex: 1;
  gap: 4px;
  align-items: center;
  height: 52px;
}

.top-nav__item {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  height: 32px;
  padding: 0 12px;
  color: rgba(255, 255, 255, 0.88);
  font-size: 14px;
  background: transparent;
  border: 0;
  border-radius: 6px;
  cursor: pointer;

  &.is-active,
  &:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.16);
  }
}

.header-right {
  display: flex;
  gap: 12px;
  align-items: center;
  color: #fff;
}

.company-name {
  color: rgba(255, 255, 255, 0.88);
  font-size: 13px;
}

.icon-btn,
.user-entry {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  height: 32px;
  padding: 0 8px;
  color: #fff;
  background: transparent;
  border: 0;
  border-radius: 6px;
  cursor: pointer;

  &:hover {
    background: rgba(255, 255, 255, 0.16);
  }
}

.user-entry .avatar {
  width: 24px;
  height: 24px;
  font-size: 12px;
}

.body {
  min-height: calc(100vh - 52px);
}

.sider {
  background: #fff;
  border-right: 1px solid #eef0f4;
}

.sider-user {
  display: flex;
  gap: 10px;
  align-items: center;
  margin: 12px;
  padding: 10px;
  background: #f4f7ff;
  border-radius: 8px;

  strong {
    display: block;
    font-size: 14px;
  }

  p {
    margin: 0;
    color: #8b93a7;
    font-size: 12px;
  }
}

.main {
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: #f3f5f9;
}

.tabs {
  padding: 8px 12px 0;
  background: #fff;

  :deep(.ant-tabs-nav) {
    margin-bottom: 0;
  }
}

.content {
  height: calc(100vh - 52px - 46px);
  padding: 12px;
  overflow: auto;
}
</style>

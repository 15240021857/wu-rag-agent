<script setup lang="ts">
import { useUserStore } from '@/stores/user'
import type { Menu } from '@/types/system'
import { computed } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const userStore = useUserStore()

function leaves(menus: Menu[]): Menu[] {
  const result: Menu[] = []
  for (const menu of menus) {
    if (menu.type === 'MENU' && menu.path !== '/dashboard') result.push(menu)
    if (menu.children?.length) result.push(...leaves(menu.children))
  }
  return result
}

const shortcuts = computed(() => leaves(userStore.menus))
</script>

<template>
  <section class="dashboard">
    <header>
      <h2>欢迎回来，{{ userStore.user?.employeeName }}</h2>
      <p>{{ userStore.user?.companyName }} / {{ userStore.user?.deptName }}</p>
    </header>
    <div v-if="shortcuts.length" class="grid">
      <button v-for="item in shortcuts" :key="item.id" type="button" @click="router.push(item.path)">
        <strong>{{ item.name }}</strong>
        <span>进入模块</span>
      </button>
    </div>
    <a-empty v-else description="当前账号还没有可访问的管理菜单" />
  </section>
</template>

<style scoped lang="less">
.dashboard {
  min-height: 100%;
  padding: 24px;
  background: #fff;
  border-radius: 8px;

  h2 {
    margin: 0 0 6px;
    font-size: 22px;
  }

  header p {
    margin: 0 0 20px;
    color: #8b93a7;
  }
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
}

button {
  padding: 18px 16px;
  text-align: left;
  background: #f6f8ff;
  border: 1px solid #e6ebff;
  border-radius: 10px;
  cursor: pointer;

  strong {
    display: block;
    margin-bottom: 6px;
    color: #243056;
  }

  span {
    color: #3a67e8;
    font-size: 12px;
  }

  &:hover {
    border-color: #3a67e8;
  }
}
</style>

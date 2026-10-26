<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <div class="missing">
    <a-result status="404" title="页面不存在" sub-title="请从菜单重新进入，或返回工作台。">
      <template #extra>
        <a-button type="primary" @click="router.push('/')">返回首页</a-button>
      </template>
    </a-result>
  </div>
</template>

<style scoped>
.missing {
  display: grid;
  min-height: 100vh;
  place-items: center;
  background: #fff;
}
</style>

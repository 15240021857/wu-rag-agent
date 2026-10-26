<script setup lang="ts">
import PageCard from '@/components/PageCard.vue'
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const title = computed(() => (typeof route.meta.title === 'string' ? route.meta.title : '空白页'))
</script>

<template>
  <PageCard :title="title">
    <a-empty description="页面组件仍是空白页，可在菜单管理中改成实际页面" />
  </PageCard>
</template>

<script setup lang="ts">
import type { Status } from '@/types/api'

defineProps<{
  status: Status
}>()
</script>

<template>
  <a-tag :color="status === 'NORMAL' ? 'success' : 'default'">
    {{ status === 'NORMAL' ? '正常' : '停用' }}
  </a-tag>
</template>

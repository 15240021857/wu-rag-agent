<script setup lang="ts">
defineProps<{
  title: string
}>()
</script>

<template>
  <section class="page-card">
    <header class="page-card__head">
      <h2>{{ title }}</h2>
      <div class="page-card__extra">
        <slot name="extra" />
      </div>
    </header>
    <div v-if="$slots.search" class="page-card__search">
      <slot name="search" />
    </div>
    <slot />
  </section>
</template>

<style scoped lang="less">
.page-card {
  min-height: 100%;
  padding: 16px 18px 12px;
  background: #fff;
  border-radius: 8px;
}

.page-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;

  h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  }
}

.page-card__search {
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f0f0f0;
}
</style>

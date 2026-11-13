<script setup lang="ts">
import type { Citation } from '@/types/rag'
import type { Run } from './renderAnswer'

const props = defineProps<{
  runs: Run[]
  citations?: Citation[]
}>()

const emit = defineEmits<{
  (event: 'cite', n: number): void
}>()

function linked(n: number) {
  return Boolean(props.citations && n >= 1 && n <= props.citations.length)
}

function onCite(n: number) {
  if (!linked(n)) return
  emit('cite', n)
}
</script>

<template>
  <template v-for="(run, index) in runs" :key="index">
    <strong v-if="run.kind === 'bold'">{{ run.text }}</strong>
    <button
      v-else-if="run.kind === 'cite' && linked(run.n)"
      type="button"
      class="cite-mark"
      @click="onCite(run.n)"
    >
      [{{ run.n }}]
    </button>
    <span v-else-if="run.kind === 'cite'" class="cite-mark is-plain">[{{ run.n }}]</span>
    <span v-else>{{ run.text }}</span>
  </template>
</template>

<style scoped lang="less">
.cite-mark {
  display: inline;
  margin: 0 1px;
  padding: 0 2px;
  color: #14915c;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  line-height: inherit;
  vertical-align: baseline;
  background: transparent;
  border: 0;
  border-radius: 4px;
  cursor: pointer;

  &:hover {
    background: #e7f6ee;
  }
}

.is-plain {
  cursor: text;

  &:hover {
    background: transparent;
  }
}
</style>

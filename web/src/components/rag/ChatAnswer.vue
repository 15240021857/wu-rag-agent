<script setup lang="ts">
import type { Citation } from '@/types/rag'
import { FilePdfOutlined, FileTextOutlined } from '@ant-design/icons-vue'
import { computed } from 'vue'
import AnswerRuns from './AnswerRuns.vue'
import { renderAnswer } from './renderAnswer'

const props = defineProps<{
  content: string
  citations?: Citation[]
  pending?: boolean
}>()

const emit = defineEmits<{
  (event: 'open', citation: Citation, index: number): void
}>()

const blocks = computed(() => renderAnswer(props.content))

function isPdf(name: string) {
  return name.toLowerCase().endsWith('.pdf')
}

function onCite(n: number) {
  const cite = props.citations?.[n - 1]
  if (cite) emit('open', cite, n)
}

function onSource(cite: Citation, index: number) {
  emit('open', cite, index)
}
</script>

<template>
  <article class="answer-card">
    <p v-if="pending && !content" class="pending">正在检索知识库…</p>
    <template v-for="(block, blockIndex) in blocks" :key="blockIndex">
      <p v-if="block.kind === 'p'" class="para">
        <AnswerRuns :runs="block.runs" :citations="citations" @cite="onCite" />
      </p>
      <ol v-else-if="block.kind === 'ol'">
        <li v-for="(item, itemIndex) in block.items" :key="itemIndex">
          <AnswerRuns :runs="item" :citations="citations" @cite="onCite" />
        </li>
      </ol>
      <ul v-else-if="block.kind === 'ul'">
        <li v-for="(item, itemIndex) in block.items" :key="itemIndex">
          <AnswerRuns :runs="item" :citations="citations" @cite="onCite" />
        </li>
      </ul>
      <p v-else-if="block.kind === 'callout'" class="callout">
        <AnswerRuns :runs="block.runs" :citations="citations" @cite="onCite" />
      </p>
    </template>
    <div v-if="citations?.length" class="sources">
      <div class="sources-label">引用来源</div>
      <button
        v-for="(cite, index) in citations"
        :key="`${cite.documentId}-${cite.chunkIndex}-${index}`"
        type="button"
        class="source"
        :title="cite.documentName"
        @click="onSource(cite, index + 1)"
      >
        <span class="source-no">[{{ index + 1 }}]</span>
        <FilePdfOutlined v-if="isPdf(cite.documentName)" class="file-icon pdf" />
        <FileTextOutlined v-else class="file-icon" />
        <span class="source-name">{{ cite.documentName }}</span>
      </button>
    </div>
  </article>
</template>

<style scoped lang="less">
.answer-card {
  width: 100%;
  padding: 16px 18px 14px;
  color: #24302a;
  font-size: 15px;
  line-height: 1.75;
  background: #fff;
  border: 1px solid #e7ece8;
  border-radius: 14px;
  box-shadow: 0 8px 24px rgba(22, 40, 32, 0.04);
}

.pending {
  margin: 0;
  color: #8b93a7;
}

.para,
.callout {
  margin: 0 0 10px;
  white-space: pre-wrap;
  word-break: break-word;
}

.para:last-child,
.callout:last-child {
  margin-bottom: 0;
}

.callout {
  padding: 8px 12px;
  color: #8a5a12;
  background: #fff8eb;
  border-radius: 8px;
}

ol,
ul {
  margin: 4px 0 12px;
  padding-left: 1.35em;
}

li + li {
  margin-top: 6px;
}

.sources {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid #eef1f4;
}

.sources-label {
  margin-bottom: 6px;
  color: #8b93a7;
  font-size: 13px;
  line-height: 1.4;
}

.source {
  display: flex;
  gap: 8px;
  align-items: center;
  width: 100%;
  margin: 0;
  padding: 7px 8px;
  color: inherit;
  font: inherit;
  text-align: left;
  background: transparent;
  border: 0;
  border-radius: 8px;
  cursor: pointer;

  &:hover {
    background: #f3faf6;
  }
}

.source-no {
  flex: none;
  color: #14915c;
  font-size: 14px;
  font-weight: 600;
}

.file-icon {
  flex: none;
  color: #178f62;
  font-size: 16px;

  &.pdf {
    color: #e25c4a;
  }
}

.source-name {
  overflow: hidden;
  color: #1f2430;
  font-size: 14px;
  white-space: nowrap;
  text-overflow: ellipsis;
}
</style>

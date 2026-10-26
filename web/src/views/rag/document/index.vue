<script setup lang="ts">
import { deleteDocument, fetchDocumentDetail, fetchDocuments, fetchKnowledges } from '@/api/rag'
import DocumentModal from '@/components/rag/DocumentModal.vue'
import KnowledgeModal from '@/components/rag/KnowledgeModal.vue'
import PageCard from '@/components/PageCard.vue'
import { useTable } from '@/composables/useTable'
import { chunkMethodLabel, VECTOR_STATUS_OPTIONS, vectorStatusLabel } from '@/constants/rag'
import type { DocumentDetail, Knowledge, KnowledgeDocument, VectorStatus } from '@/types/rag'
import { formatChunkNotes } from '@/utils/chunk'
import { formatDateTime, formatFileSize } from '@/utils/format'
import { PlusOutlined } from '@ant-design/icons-vue'
import { message, Modal } from 'ant-design-vue'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const knowledgeOpen = ref(false)
const documentOpen = ref(false)
const revectorOpen = ref(false)
const revectorId = ref('')
const inspectOpen = ref(false)
const inspectMode = ref<'detail' | 'preview'>('detail')
const inspectLoading = ref(false)
const inspectDoc = ref<DocumentDetail | null>(null)
const knowledges = ref<Knowledge[]>([])
let pollTimer = 0

const { loading, list, total, query, load, search, reset, onPageChange } = useTable(
  (params) => fetchDocuments(params),
  () => ({
    pageNum: 1,
    pageSize: 10,
    knowledgeId: '',
    fileName: '',
    vectorStatus: '' as VectorStatus | '',
  }),
)

const columns = [
  { title: '文档', dataIndex: 'fileName', key: 'fileName', width: 220 },
  { title: '知识库', dataIndex: 'knowledgeName', key: 'knowledgeName', width: 140 },
  { title: '类型', dataIndex: 'fileType', key: 'fileType', width: 80 },
  { title: '大小', dataIndex: 'size', key: 'size', width: 100 },
  { title: '切分', dataIndex: 'chunkMethod', key: 'chunkMethod', width: 220 },
  { title: '分片数', dataIndex: 'chunkCount', key: 'chunkCount', width: 80 },
  { title: '向量化状态', dataIndex: 'vectorStatus', key: 'vectorStatus', width: 120 },
  { title: '更新时间', dataIndex: 'updatedAt', key: 'updatedAt', width: 160 },
  { title: '操作', key: 'action', width: 280, fixed: 'right' as const },
]

const knowledgeOptions = computed(() => knowledges.value.map((item) => ({ label: item.name, value: item.id })))

async function loadKnowledges() {
  const page = await fetchKnowledges({ pageNum: 1, pageSize: 200, name: '' })
  knowledges.value = page.list
}

async function refreshQuiet() {
  try {
    const result = await fetchDocuments({ ...query })
    list.value = result.list
    total.value = result.total
  } catch {
    // 轮询失败时保留当前列表
  }
}

function stopPoll() {
  if (!pollTimer) return
  window.clearInterval(pollTimer)
  pollTimer = 0
}

watch(
  () => list.value.some((item) => item.vectorStatus === 'PROCESSING'),
  (processing) => {
    stopPoll()
    if (!processing) return
    pollTimer = window.setInterval(() => {
      void refreshQuiet()
    }, 800)
  },
)

watch(
  () => (typeof route.query.knowledgeId === 'string' ? route.query.knowledgeId : ''),
  (knowledgeId) => {
    query.knowledgeId = knowledgeId
    void search()
  },
  { immediate: true },
)

function vectorColor(status: VectorStatus) {
  if (status === 'READY') return 'success'
  if (status === 'FAILED') return 'error'
  return 'processing'
}

function openDocument() {
  documentOpen.value = true
}

function splitLabel(record: KnowledgeDocument) {
  if (record.chunkMethod === 'FIXED') return `固定字符切分 / ${record.chunkSize}`
  return `字符切分 / ${record.chunkSeparator || '\\n'} / 兜底 ${record.chunkSize}`
}

async function openInspect(record: KnowledgeDocument, mode: 'detail' | 'preview') {
  inspectMode.value = mode
  inspectDoc.value = null
  inspectOpen.value = true
  inspectLoading.value = true
  try {
    inspectDoc.value = await fetchDocumentDetail(record.id)
  } catch {
    inspectOpen.value = false
  } finally {
    inspectLoading.value = false
  }
}

function openRevector(record: KnowledgeDocument) {
  revectorId.value = record.id
  revectorOpen.value = true
}

function onDelete(record: KnowledgeDocument) {
  Modal.confirm({
    title: `确认删除文档「${record.fileName}」？`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      await deleteDocument(record.id)
      message.success('已删除')
      await load()
    },
  })
}

async function onReset() {
  const hasQuery = typeof route.query.knowledgeId === 'string'
  await reset()
  if (hasQuery) await router.replace({ path: '/rag/document' })
}

async function onKnowledgeSaved() {
  await loadKnowledges()
}

onMounted(() => {
  void loadKnowledges()
})

onUnmounted(stopPoll)
</script>

<template>
  <PageCard title="文档管理">
    <template #extra>
      <a-space>
        <a-button v-auth="'rag:knowledge:create'" @click="knowledgeOpen = true">
          <PlusOutlined />
          新增知识库
        </a-button>
        <a-button v-auth="'rag:document:create'" type="primary" @click="openDocument">
          <PlusOutlined />
          新增文档
        </a-button>
      </a-space>
    </template>
    <template #search>
      <div class="search-row">
        <a-form layout="inline">
          <a-form-item label="知识库">
            <a-select
              v-model:value="query.knowledgeId"
              allow-clear
              show-search
              option-filter-prop="label"
              placeholder="全部"
              style="width: 180px"
              :options="knowledgeOptions"
            />
          </a-form-item>
          <a-form-item label="文档">
            <a-input v-model:value="query.fileName" allow-clear placeholder="文件名" @press-enter="search" />
          </a-form-item>
          <a-form-item label="向量化">
            <a-select
              v-model:value="query.vectorStatus"
              allow-clear
              placeholder="全部"
              style="width: 120px"
              :options="VECTOR_STATUS_OPTIONS"
            />
          </a-form-item>
        </a-form>
        <a-space>
          <a-button type="primary" @click="search">查询</a-button>
          <a-button @click="onReset">重置</a-button>
        </a-space>
      </div>
    </template>
    <a-table
      row-key="id"
      size="middle"
      :loading="loading"
      :columns="columns"
      :data-source="list"
      :pagination="false"
      :scroll="{ x: 1400 }"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'fileType'">{{ String(record.fileType).toUpperCase() }}</template>
        <template v-else-if="column.key === 'size'">{{ formatFileSize(record.size) }}</template>
        <template v-else-if="column.key === 'chunkMethod'">
          {{ splitLabel(record) }}
        </template>
        <template v-else-if="column.key === 'vectorStatus'">
          <a-tag :color="vectorColor(record.vectorStatus)">{{ vectorStatusLabel(record.vectorStatus) }}</a-tag>
        </template>
        <template v-else-if="column.key === 'updatedAt'">{{ formatDateTime(record.updatedAt) }}</template>
        <template v-else-if="column.key === 'action'">
          <div class="row-actions">
            <a-button type="link" size="small" @click="openInspect(record, 'detail')">详情</a-button>
            <a-button type="link" size="small" @click="openInspect(record, 'preview')">预览</a-button>
            <a-button v-auth="'rag:document:update'" type="link" size="small" @click="openRevector(record)">重新向量化</a-button>
            <a-button v-auth="'rag:document:delete'" type="link" size="small" danger @click="onDelete(record)">删除</a-button>
          </div>
        </template>
      </template>
    </a-table>
    <div class="table-footer">
      <a-pagination
        :current="query.pageNum"
        :page-size="query.pageSize"
        :total="total"
        show-size-changer
        :page-size-options="['10', '20', '50']"
        :show-total="(value: number) => `共 ${value} 条数据`"
        @change="onPageChange"
      />
    </div>
    <KnowledgeModal v-model:open="knowledgeOpen" @saved="onKnowledgeSaved" />
    <DocumentModal v-model:open="documentOpen" :knowledge-id="query.knowledgeId" @saved="load" />
    <DocumentModal v-model:open="revectorOpen" :document-id="revectorId" @saved="load" />
    <a-modal
      :open="inspectOpen"
      :title="inspectMode === 'detail' ? '文档详情' : '预览文档'"
      :width="860"
      :footer="null"
      @cancel="inspectOpen = false"
    >
      <a-spin :spinning="inspectLoading">
        <template v-if="inspectDoc && inspectMode === 'detail'">
          <a-descriptions bordered size="small" :column="2">
            <a-descriptions-item label="文档">{{ inspectDoc.fileName }}</a-descriptions-item>
            <a-descriptions-item label="知识库">{{ inspectDoc.knowledgeName }}</a-descriptions-item>
            <a-descriptions-item label="类型">{{ inspectDoc.fileType.toUpperCase() }}</a-descriptions-item>
            <a-descriptions-item label="大小">{{ formatFileSize(inspectDoc.size) }}</a-descriptions-item>
            <a-descriptions-item label="切分方式">{{ chunkMethodLabel(inspectDoc.chunkMethod) }}</a-descriptions-item>
            <a-descriptions-item label="切分字符">{{ inspectDoc.chunkSeparator || '—' }}</a-descriptions-item>
            <a-descriptions-item label="单片最大字符数">{{ inspectDoc.chunkSize }}</a-descriptions-item>
            <a-descriptions-item label="分片数">{{ inspectDoc.chunkCount }}</a-descriptions-item>
            <a-descriptions-item label="向量化状态">{{ vectorStatusLabel(inspectDoc.vectorStatus) }}</a-descriptions-item>
            <a-descriptions-item label="是否就绪">{{ inspectDoc.ready ? '就绪' : '未就绪' }}</a-descriptions-item>
            <a-descriptions-item label="更新时间" :span="2">{{ formatDateTime(inspectDoc.updatedAt) }}</a-descriptions-item>
          </a-descriptions>
          <p class="inspect-label">分片内容</p>
          <a-textarea class="inspect-text" readonly :auto-size="{ minRows: 12 }" :value="formatChunkNotes(inspectDoc.chunks)" />
        </template>
        <a-textarea v-else-if="inspectDoc" class="inspect-text" readonly :value="inspectDoc.content" />
      </a-spin>
    </a-modal>
  </PageCard>
</template>

<style scoped lang="less">
.inspect-label {
  margin: 14px 0 8px;
  color: #5c657a;
}

.inspect-text {
  :deep(textarea) {
    min-height: calc(1.5715em * 12 + 8px);
  }
}
</style>

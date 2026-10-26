<script setup lang="ts">
import { deleteKnowledge, fetchKnowledges } from '@/api/rag'
import KnowledgeModal from '@/components/rag/KnowledgeModal.vue'
import PageCard from '@/components/PageCard.vue'
import { useTable } from '@/composables/useTable'
import { visibilityLabel } from '@/constants/rag'
import type { Knowledge } from '@/types/rag'
import { formatDateTime } from '@/utils/format'
import { PlusOutlined } from '@ant-design/icons-vue'
import { message, Modal } from 'ant-design-vue'
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const visible = ref(false)
const editing = ref<Knowledge | null>(null)

const { loading, list, total, query, load, search, reset, onPageChange } = useTable(
  (params) => fetchKnowledges(params),
  () => ({ pageNum: 1, pageSize: 10, name: '' }),
)

const columns = [
  { title: '知识库', dataIndex: 'name', key: 'name', width: 180 },
  { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
  { title: '可见范围', dataIndex: 'visibility', key: 'visibility', width: 110 },
  { title: '文档数', dataIndex: 'documentCount', key: 'documentCount', width: 90 },
  { title: '创建人', dataIndex: 'ownerName', key: 'ownerName', width: 120 },
  { title: '更新时间', dataIndex: 'updatedAt', key: 'updatedAt', width: 160 },
  { title: '操作', key: 'action', width: 180, fixed: 'right' as const },
]

function openCreate() {
  editing.value = null
  visible.value = true
}

function openEdit(record: Knowledge) {
  editing.value = record
  visible.value = true
}

function openDocuments(record: Knowledge) {
  void router.push({ path: '/rag/document', query: { knowledgeId: record.id } })
}

function onDelete(record: Knowledge) {
  Modal.confirm({
    title: `确认删除知识库「${record.name}」？`,
    content: '其中的文档会一并删除。',
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      await deleteKnowledge(record.id)
      message.success('已删除')
      await load()
    },
  })
}

onMounted(() => {
  void load()
})
</script>

<template>
  <PageCard title="知识库管理">
    <template #extra>
      <a-button v-auth="'rag:knowledge:create'" type="primary" @click="openCreate">
        <PlusOutlined />
        新增
      </a-button>
    </template>
    <template #search>
      <div class="search-row">
        <a-form layout="inline">
          <a-form-item label="知识库">
            <a-input v-model:value="query.name" allow-clear placeholder="名称 / 描述" @press-enter="search" />
          </a-form-item>
        </a-form>
        <a-space>
          <a-button type="primary" @click="search">查询</a-button>
          <a-button @click="reset">重置</a-button>
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
      :scroll="{ x: 980 }"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'visibility'">
          <a-tag color="blue">{{ visibilityLabel(record.visibility) }}</a-tag>
        </template>
        <template v-else-if="column.key === 'documentCount'">
          <a-button type="link" size="small" @click="openDocuments(record)">{{ record.documentCount }}</a-button>
        </template>
        <template v-else-if="column.key === 'updatedAt'">
          {{ formatDateTime(record.updatedAt) }}
        </template>
        <template v-else-if="column.key === 'action'">
          <div class="row-actions">
            <a-button type="link" size="small" @click="openDocuments(record)">文档</a-button>
            <a-button v-auth="'rag:knowledge:update'" type="link" size="small" @click="openEdit(record)">编辑</a-button>
            <a-button v-auth="'rag:knowledge:delete'" type="link" size="small" danger @click="onDelete(record)">删除</a-button>
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
    <KnowledgeModal v-model:open="visible" :record="editing" @saved="load" />
  </PageCard>
</template>

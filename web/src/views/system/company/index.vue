<script setup lang="ts">
import { createCompany, deleteCompany, fetchCompanies, updateCompany } from '@/api/company'
import PageCard from '@/components/PageCard.vue'
import StatusTag from '@/components/StatusTag.vue'
import { useTable } from '@/composables/useTable'
import { STATUS_OPTIONS } from '@/constants/system'
import type { Status } from '@/types/api'
import type { Company, CompanyPayload } from '@/types/system'
import { formatDateTime } from '@/utils/format'
import { descendantIds, flattenTree } from '@/utils/tree'
import { PlusOutlined } from '@ant-design/icons-vue'
import { message, Modal, type FormInstance } from 'ant-design-vue'
import { computed, onMounted, reactive, ref } from 'vue'

interface SelectNode {
  id: string
  name: string
  disabled?: boolean
  children?: SelectNode[]
}

const tableKey = ref(0)
const visible = ref(false)
const saving = ref(false)
const editingId = ref('')
const formRef = ref<FormInstance>()

const { loading, list, query, load, search, reset } = useTable(
  (params) => fetchCompanies(params),
  () => ({ pageNum: 1, pageSize: 500, name: '', status: '' as Status | '' }),
)

const form = reactive<CompanyPayload>({
  name: '',
  code: '',
  parentId: null,
  sort: 0,
  leader: '',
  phone: '',
  address: '',
  status: 'NORMAL',
})

const rules = {
  name: [{ required: true, message: '请输入公司名称' }],
  code: [{ required: true, message: '请输入公司编码' }],
}

const columns = [
  { title: '公司名称', dataIndex: 'name', key: 'name', width: 220 },
  { title: '编码', dataIndex: 'code', key: 'code', width: 120 },
  { title: '负责人', dataIndex: 'leader', key: 'leader', width: 120 },
  { title: '电话', dataIndex: 'phone', key: 'phone', width: 150 },
  { title: '地址', dataIndex: 'address', key: 'address', ellipsis: true },
  { title: '排序', dataIndex: 'sort', key: 'sort', width: 80 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 90 },
  { title: '更新时间', dataIndex: 'updatedAt', key: 'updatedAt', width: 160 },
  { title: '操作', key: 'action', width: 210, fixed: 'right' as const },
]

const totalCount = computed(() => flattenTree(list.value).length)

const parentTree = computed(() => {
  const blocked = new Set<string>()
  if (editingId.value) {
    for (const id of descendantIds(list.value, editingId.value)) blocked.add(id)
    blocked.add(editingId.value)
  }
  const mapNodes = (nodes: Company[]): SelectNode[] => nodes.map((node) => ({
    id: node.id,
    name: node.name,
    disabled: blocked.has(node.id),
    children: node.children?.length ? mapNodes(node.children) : undefined,
  }))
  return mapNodes(list.value)
})

function fillForm(record?: Company, parentId: string | null = null) {
  editingId.value = record?.id ?? ''
  form.name = record?.name ?? ''
  form.code = record?.code ?? ''
  form.parentId = record?.parentId ?? parentId
  form.sort = record?.sort ?? 0
  form.leader = record?.leader ?? ''
  form.phone = record?.phone ?? ''
  form.address = record?.address ?? ''
  form.status = record?.status ?? 'NORMAL'
}

async function reload() {
  await load()
  tableKey.value += 1
}

function openCreate(parentId: string | null = null) {
  fillForm(undefined, parentId)
  visible.value = true
}

function openEdit(record: Company) {
  fillForm(record)
  visible.value = true
}

async function onSubmit() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  saving.value = true
  try {
    if (editingId.value) await updateCompany(editingId.value, { ...form })
    else await createCompany({ ...form })
    message.success('保存成功')
    visible.value = false
    await reload()
  } catch {
    // 错误提示由请求拦截器统一处理
  } finally {
    saving.value = false
  }
}

function onDelete(record: Company) {
  Modal.confirm({
    title: `确认删除公司「${record.name}」？`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      await deleteCompany(record.id)
      message.success('已删除')
      await reload()
    },
  })
}

onMounted(() => {
  void reload()
})
</script>

<template>
  <PageCard title="公司管理">
    <template #extra>
      <a-button v-auth="'system:company:create'" type="primary" @click="openCreate(null)">
        <PlusOutlined />
        新增
      </a-button>
    </template>
    <template #search>
      <div class="search-row">
        <a-form layout="inline">
          <a-form-item label="公司">
            <a-input v-model:value="query.name" allow-clear placeholder="名称 / 编码" @press-enter="search" />
          </a-form-item>
          <a-form-item label="状态">
            <a-select v-model:value="query.status" allow-clear placeholder="全部" style="width: 120px" :options="STATUS_OPTIONS" />
          </a-form-item>
        </a-form>
        <a-space>
          <a-button type="primary" @click="search">查询</a-button>
          <a-button @click="reset().then(() => { tableKey += 1 })">重置</a-button>
        </a-space>
      </div>
    </template>
    <a-table
      :key="tableKey"
      row-key="id"
      :loading="loading"
      :columns="columns"
      :data-source="list"
      :pagination="false"
      :default-expand-all-rows="true"
      :scroll="{ x: 1200 }"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'status'">
          <StatusTag :status="record.status" />
        </template>
        <template v-else-if="column.key === 'updatedAt'">
          {{ formatDateTime(record.updatedAt) }}
        </template>
        <template v-else-if="column.key === 'action'">
          <div class="row-actions">
            <a-button v-auth="'system:company:create'" type="link" size="small" @click="openCreate(record.id)">新增下级</a-button>
            <a-button v-auth="'system:company:update'" type="link" size="small" @click="openEdit(record)">编辑</a-button>
            <a-button v-auth="'system:company:delete'" type="link" size="small" danger @click="onDelete(record)">删除</a-button>
          </div>
        </template>
      </template>
    </a-table>
    <div class="table-footer">共 {{ totalCount }} 条数据</div>
    <a-modal
      v-model:open="visible"
      :title="editingId ? '编辑公司' : '新增公司'"
      :confirm-loading="saving"
      ok-text="保存"
      cancel-text="取消"
      @ok="onSubmit"
    >
      <a-form ref="formRef" :model="form" :rules="rules" layout="vertical">
        <a-form-item label="上级公司" name="parentId">
          <a-tree-select
            v-model:value="form.parentId"
            allow-clear
            tree-default-expand-all
            placeholder="不选则为顶级公司"
            :tree-data="parentTree"
            :field-names="{ label: 'name', value: 'id', children: 'children' }"
          />
        </a-form-item>
        <a-form-item label="公司名称" name="name">
          <a-input v-model:value="form.name" />
        </a-form-item>
        <a-form-item label="公司编码" name="code">
          <a-input v-model:value="form.code" />
        </a-form-item>
        <a-form-item label="排序" name="sort">
          <a-input-number v-model:value="form.sort" :min="0" style="width: 100%" />
        </a-form-item>
        <a-form-item label="负责人" name="leader">
          <a-input v-model:value="form.leader" />
        </a-form-item>
        <a-form-item label="电话" name="phone">
          <a-input v-model:value="form.phone" />
        </a-form-item>
        <a-form-item label="地址" name="address">
          <a-input v-model:value="form.address" />
        </a-form-item>
        <a-form-item label="状态" name="status">
          <a-radio-group v-model:value="form.status" :options="STATUS_OPTIONS" />
        </a-form-item>
      </a-form>
    </a-modal>
  </PageCard>
</template>

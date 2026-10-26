<script setup lang="ts">
import { fetchCompanies } from '@/api/company'
import { createDept, deleteDept, fetchDepts, updateDept } from '@/api/dept'
import PageCard from '@/components/PageCard.vue'
import StatusTag from '@/components/StatusTag.vue'
import { useTable } from '@/composables/useTable'
import { STATUS_OPTIONS } from '@/constants/system'
import type { Status } from '@/types/api'
import type { Company, Dept, DeptPayload } from '@/types/system'
import { formatDateTime } from '@/utils/format'
import { buildTree, descendantIds, flattenTree, type TreeItem } from '@/utils/tree'
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
const companies = ref<Company[]>([])
const formRef = ref<FormInstance>()

const { loading, list, query, load, search, reset } = useTable(
  (params) => fetchDepts(params),
  () => ({ pageNum: 1, pageSize: 500, name: '', status: '' as Status | '', companyId: '' }),
)

const form = reactive<DeptPayload>({
  name: '',
  code: '',
  companyId: '',
  parentId: null,
  sort: 0,
  leader: '',
  status: 'NORMAL',
})

const rules = {
  companyId: [{ required: true, message: '请选择所属公司' }],
  name: [{ required: true, message: '请输入部门名称' }],
  code: [{ required: true, message: '请输入部门编码' }],
}

const columns = [
  { title: '部门名称', dataIndex: 'name', key: 'name', width: 220 },
  { title: '编码', dataIndex: 'code', key: 'code', width: 140 },
  { title: '所属公司', dataIndex: 'companyName', key: 'companyName', width: 160 },
  { title: '负责人', dataIndex: 'leader', key: 'leader', width: 120 },
  { title: '排序', dataIndex: 'sort', key: 'sort', width: 80 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 90 },
  { title: '更新时间', dataIndex: 'updatedAt', key: 'updatedAt', width: 160 },
  { title: '操作', key: 'action', width: 210, fixed: 'right' as const },
]

const companyOptions = computed(() => flattenTree(companies.value).map((item) => ({ label: item.name, value: item.id })))
const totalCount = computed(() => flattenTree(list.value).length)

const parentTree = computed(() => {
  const sameCompany = flattenTree(list.value).filter((item) => item.companyId === form.companyId)
  const tree = buildTree(sameCompany)
  const blocked = new Set<string>()
  if (editingId.value) {
    for (const id of descendantIds(tree, editingId.value)) blocked.add(id)
    blocked.add(editingId.value)
  }
  const mapNodes = (nodes: TreeItem<Dept>[]): SelectNode[] => nodes.map((node) => ({
    id: node.id,
    name: node.name,
    disabled: blocked.has(node.id),
    children: node.children?.length ? mapNodes(node.children) : undefined,
  }))
  return mapNodes(tree)
})

async function loadCompanies() {
  const result = await fetchCompanies({ pageNum: 1, pageSize: 500, name: '', status: '' })
  companies.value = result.list
}

function fillForm(record?: Dept, parent?: Dept) {
  editingId.value = record?.id ?? ''
  form.name = record?.name ?? ''
  form.code = record?.code ?? ''
  form.companyId = record?.companyId ?? parent?.companyId ?? query.companyId
  form.parentId = record?.parentId ?? parent?.id ?? null
  form.sort = record?.sort ?? 0
  form.leader = record?.leader ?? ''
  form.status = record?.status ?? 'NORMAL'
}

async function reload() {
  await load()
  tableKey.value += 1
}

function openCreate(parent?: Dept) {
  fillForm(undefined, parent)
  visible.value = true
}

function openEdit(record: Dept) {
  fillForm(record)
  visible.value = true
}

function onCompanyChange() {
  const parent = flattenTree(list.value).find((item) => item.id === form.parentId)
  if (parent && parent.companyId !== form.companyId) form.parentId = null
}

async function onSubmit() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  saving.value = true
  try {
    if (editingId.value) await updateDept(editingId.value, { ...form })
    else await createDept({ ...form })
    message.success('保存成功')
    visible.value = false
    await reload()
  } catch {
    // 错误提示由请求拦截器统一处理
  } finally {
    saving.value = false
  }
}

function onDelete(record: Dept) {
  Modal.confirm({
    title: `确认删除部门「${record.name}」？`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      await deleteDept(record.id)
      message.success('已删除')
      await reload()
    },
  })
}

onMounted(() => {
  void loadCompanies()
  void reload()
})
</script>

<template>
  <PageCard title="部门管理">
    <template #extra>
      <a-button v-auth="'system:dept:create'" type="primary" @click="openCreate()">
        <PlusOutlined />
        新增
      </a-button>
    </template>
    <template #search>
      <div class="search-row">
        <a-form layout="inline">
          <a-form-item label="公司">
            <a-select
              v-model:value="query.companyId"
              allow-clear
              placeholder="全部公司"
              style="width: 180px"
              :options="companyOptions"
            />
          </a-form-item>
          <a-form-item label="部门">
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
            <a-button v-auth="'system:dept:create'" type="link" size="small" @click="openCreate(record)">新增下级</a-button>
            <a-button v-auth="'system:dept:update'" type="link" size="small" @click="openEdit(record)">编辑</a-button>
            <a-button v-auth="'system:dept:delete'" type="link" size="small" danger @click="onDelete(record)">删除</a-button>
          </div>
        </template>
      </template>
    </a-table>
    <div class="table-footer">共 {{ totalCount }} 条数据</div>
    <a-modal
      v-model:open="visible"
      :title="editingId ? '编辑部门' : '新增部门'"
      :confirm-loading="saving"
      ok-text="保存"
      cancel-text="取消"
      @ok="onSubmit"
    >
      <a-form ref="formRef" :model="form" :rules="rules" layout="vertical">
        <a-form-item label="所属公司" name="companyId">
          <a-select v-model:value="form.companyId" :options="companyOptions" @change="onCompanyChange" />
        </a-form-item>
        <a-form-item label="上级部门" name="parentId">
          <a-tree-select
            v-model:value="form.parentId"
            allow-clear
            tree-default-expand-all
            placeholder="不选则为一级部门"
            :tree-data="parentTree"
            :field-names="{ label: 'name', value: 'id', children: 'children' }"
          />
        </a-form-item>
        <a-form-item label="部门名称" name="name">
          <a-input v-model:value="form.name" />
        </a-form-item>
        <a-form-item label="部门编码" name="code">
          <a-input v-model:value="form.code" />
        </a-form-item>
        <a-form-item label="排序" name="sort">
          <a-input-number v-model:value="form.sort" :min="0" style="width: 100%" />
        </a-form-item>
        <a-form-item label="负责人" name="leader">
          <a-input v-model:value="form.leader" />
        </a-form-item>
        <a-form-item label="状态" name="status">
          <a-radio-group v-model:value="form.status" :options="STATUS_OPTIONS" />
        </a-form-item>
      </a-form>
    </a-modal>
  </PageCard>
</template>

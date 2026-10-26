<script setup lang="ts">
import { fetchMenus } from '@/api/menu'
import { createRole, deleteRole, fetchRoles, updateRole, updateRoleMenus } from '@/api/role'
import PageCard from '@/components/PageCard.vue'
import StatusTag from '@/components/StatusTag.vue'
import { useTable } from '@/composables/useTable'
import { DATA_SCOPE_OPTIONS, STATUS_OPTIONS } from '@/constants/system'
import type { DataScope, Status } from '@/types/api'
import type { Menu, Role, RolePayload } from '@/types/system'
import { dataScopeLabel, formatDateTime } from '@/utils/format'
import { PlusOutlined } from '@ant-design/icons-vue'
import { message, Modal, type FormInstance } from 'ant-design-vue'
import { computed, onMounted, reactive, ref } from 'vue'

interface CheckNode {
  title: string
  key: string
  children?: CheckNode[]
}

const visible = ref(false)
const grantOpen = ref(false)
const saving = ref(false)
const editingId = ref('')
const granting = ref<Role | null>(null)
const menuTree = ref<Menu[]>([])
const checkedKeys = ref<string[]>([])
const grantMenuIds = ref<string[]>([])
const formRef = ref<FormInstance>()

const { loading, list, total, query, load, search, reset, onPageChange } = useTable(
  (params) => fetchRoles(params),
  () => ({ pageNum: 1, pageSize: 10, name: '', status: '' as Status | '' }),
)

const form = reactive<RolePayload>({
  name: '',
  code: '',
  sort: 0,
  status: 'NORMAL',
  dataScope: 'SELF',
  remark: '',
})

const grantScope = ref<DataScope>('SELF')

const rules = {
  name: [{ required: true, message: '请输入角色名称' }],
  code: [{ required: true, message: '请输入角色编码' }],
  dataScope: [{ required: true, message: '请选择数据范围' }],
}

const columns = [
  { title: '角色名称', dataIndex: 'name', key: 'name' },
  { title: '角色编码', dataIndex: 'code', key: 'code' },
  { title: '排序', dataIndex: 'sort', key: 'sort', width: 80 },
  { title: '数据范围', dataIndex: 'dataScope', key: 'dataScope', width: 120 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 90 },
  { title: '更新时间', dataIndex: 'updatedAt', key: 'updatedAt', width: 160 },
  { title: '操作', key: 'action', width: 200 },
]

const checkTree = computed(() => {
  const mapNodes = (nodes: Menu[]): CheckNode[] => nodes.map((node) => ({
    title: node.type === 'BUTTON' ? `${node.name}（按钮）` : node.name,
    key: node.id,
    children: node.children?.length ? mapNodes(node.children) : undefined,
  }))
  return mapNodes(menuTree.value)
})

function leafIds(nodes: Menu[], assigned: Set<string>, bucket: string[]) {
  for (const node of nodes) {
    if (node.children?.length) leafIds(node.children, assigned, bucket)
    else if (assigned.has(node.id)) bucket.push(node.id)
  }
}

function fillForm(record?: Role) {
  editingId.value = record?.id ?? ''
  form.name = record?.name ?? ''
  form.code = record?.code ?? ''
  form.sort = record?.sort ?? 0
  form.status = record?.status ?? 'NORMAL'
  form.dataScope = record?.dataScope ?? 'SELF'
  form.remark = record?.remark ?? ''
}

function openCreate() {
  fillForm()
  visible.value = true
}

function openEdit(record: Role) {
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
    if (editingId.value) await updateRole(editingId.value, { ...form })
    else await createRole({ ...form })
    message.success('保存成功')
    visible.value = false
    await load()
  } catch {
    // 错误提示由请求拦截器统一处理
  } finally {
    saving.value = false
  }
}

async function openGrant(record: Role) {
  try {
    menuTree.value = await fetchMenus()
  } catch {
    return
  }
  granting.value = record
  grantScope.value = record.dataScope
  const leaves: string[] = []
  leafIds(menuTree.value, new Set(record.menuIds), leaves)
  checkedKeys.value = leaves
  grantMenuIds.value = [...record.menuIds]
  grantOpen.value = true
}

function onMenuCheck(
  keys: string[] | { checked: string[]; halfChecked: string[] },
  info: { halfCheckedKeys?: Array<string | number> },
) {
  const checked = Array.isArray(keys) ? keys : keys.checked
  const half = (info.halfCheckedKeys ?? []).map(String)
  grantMenuIds.value = [...checked.map(String), ...half]
}

async function saveGrant() {
  if (!granting.value) return
  saving.value = true
  try {
    await updateRoleMenus(granting.value.id, {
      menuIds: grantMenuIds.value,
      dataScope: grantScope.value,
    })
    message.success('授权已保存')
    grantOpen.value = false
    await load()
  } catch {
    // 错误提示由请求拦截器统一处理
  } finally {
    saving.value = false
  }
}

function onDelete(record: Role) {
  Modal.confirm({
    title: `确认删除角色「${record.name}」？`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      await deleteRole(record.id)
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
  <PageCard title="角色管理">
    <template #extra>
      <a-button v-auth="'system:role:create'" type="primary" @click="openCreate">
        <PlusOutlined />
        新增
      </a-button>
    </template>
    <template #search>
      <div class="search-row">
        <a-form layout="inline">
          <a-form-item label="角色">
            <a-input v-model:value="query.name" allow-clear placeholder="名称 / 编码" @press-enter="search" />
          </a-form-item>
          <a-form-item label="状态">
            <a-select v-model:value="query.status" allow-clear placeholder="全部" style="width: 120px" :options="STATUS_OPTIONS" />
          </a-form-item>
        </a-form>
        <a-space>
          <a-button type="primary" @click="search">查询</a-button>
          <a-button @click="reset">重置</a-button>
        </a-space>
      </div>
    </template>
    <a-table row-key="id" :loading="loading" :columns="columns" :data-source="list" :pagination="false">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'dataScope'">
          {{ dataScopeLabel(record.dataScope) }}
        </template>
        <template v-else-if="column.key === 'status'">
          <StatusTag :status="record.status" />
        </template>
        <template v-else-if="column.key === 'updatedAt'">
          {{ formatDateTime(record.updatedAt) }}
        </template>
        <template v-else-if="column.key === 'action'">
          <div class="row-actions">
            <a-button v-auth="'system:role:update'" type="link" size="small" @click="openEdit(record)">编辑</a-button>
            <a-button v-auth="'system:role:update'" type="link" size="small" @click="openGrant(record)">授权</a-button>
            <a-button v-auth="'system:role:delete'" type="link" size="small" danger @click="onDelete(record)">删除</a-button>
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
        :show-total="(value: number) => `共 ${value} 条数据`"
        @change="onPageChange"
      />
    </div>
    <a-modal
      v-model:open="visible"
      :title="editingId ? '编辑角色' : '新增角色'"
      :confirm-loading="saving"
      ok-text="保存"
      cancel-text="取消"
      @ok="onSubmit"
    >
      <a-form ref="formRef" :model="form" :rules="rules" layout="vertical">
        <a-form-item label="角色名称" name="name">
          <a-input v-model:value="form.name" />
        </a-form-item>
        <a-form-item label="角色编码" name="code">
          <a-input v-model:value="form.code" />
        </a-form-item>
        <a-form-item label="排序" name="sort">
          <a-input-number v-model:value="form.sort" :min="0" style="width: 100%" />
        </a-form-item>
        <a-form-item label="数据范围" name="dataScope">
          <a-select v-model:value="form.dataScope" :options="DATA_SCOPE_OPTIONS" />
        </a-form-item>
        <a-form-item label="状态" name="status">
          <a-radio-group v-model:value="form.status" :options="STATUS_OPTIONS" />
        </a-form-item>
        <a-form-item label="备注" name="remark">
          <a-textarea v-model:value="form.remark" :rows="3" />
        </a-form-item>
      </a-form>
    </a-modal>
    <a-drawer v-model:open="grantOpen" :title="`授权 - ${granting?.name ?? ''}`" :width="420">
      <a-form layout="vertical">
        <a-form-item label="数据范围">
          <a-select v-model:value="grantScope" :options="DATA_SCOPE_OPTIONS" />
        </a-form-item>
        <a-form-item label="菜单与按钮">
          <a-tree
            v-model:checked-keys="checkedKeys"
            checkable
            default-expand-all
            :tree-data="checkTree"
            @check="onMenuCheck"
          />
        </a-form-item>
      </a-form>
      <template #footer>
        <a-space>
          <a-button @click="grantOpen = false">取消</a-button>
          <a-button type="primary" :loading="saving" @click="saveGrant">保存</a-button>
        </a-space>
      </template>
    </a-drawer>
  </PageCard>
</template>

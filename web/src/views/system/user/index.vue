<script setup lang="ts">
import { fetchCompanies } from '@/api/company'
import { fetchDepts } from '@/api/dept'
import { fetchRoles } from '@/api/role'
import {
  createUser,
  deleteUser,
  fetchUsers,
  resetUserPassword,
  updateUser,
} from '@/api/user'
import PageCard from '@/components/PageCard.vue'
import StatusTag from '@/components/StatusTag.vue'
import { useTable } from '@/composables/useTable'
import { STATUS_OPTIONS } from '@/constants/system'
import type { Status } from '@/types/api'
import type { Company, Dept, Role, User, UserPayload } from '@/types/system'
import { formatDateTime } from '@/utils/format'
import { flattenTree } from '@/utils/tree'
import { PlusOutlined } from '@ant-design/icons-vue'
import { message, Modal, type FormInstance } from 'ant-design-vue'
import { computed, onMounted, reactive, ref } from 'vue'

interface OrgNode {
  key: string
  title: string
  companyId: string
  deptId: string
  children?: OrgNode[]
}

const companies = ref<Company[]>([])
const depts = ref<Dept[]>([])
const roles = ref<Role[]>([])
const orgLoaded = ref(false)
const orgKeyword = ref('')
const selectedOrg = ref<string[]>(['all'])
const visible = ref(false)
const passwordOpen = ref(false)
const saving = ref(false)
const editingId = ref('')
const passwordUser = ref<User | null>(null)
const nextPassword = ref('')
const formRef = ref<FormInstance>()

const { loading, list, total, query, load, search, reset, onPageChange } = useTable(
  (params) => fetchUsers(params),
  () => ({
    pageNum: 1,
    pageSize: 20,
    username: '',
    nickname: '',
    status: '' as Status | '',
    companyId: '',
    deptId: '',
  }),
)

const form = reactive<UserPayload>({
  username: '',
  nickname: '',
  employeeName: '',
  companyId: '',
  deptId: '',
  email: '',
  mobile: '',
  officePhone: '',
  status: 'NORMAL',
  roleIds: [],
  password: '',
})

const rules = computed(() => ({
  username: [{ required: true, message: '请输入登录账号' }],
  nickname: [{ required: true, message: '请输入用户昵称' }],
  employeeName: [{ required: true, message: '请输入员工姓名' }],
  companyId: [{ required: true, message: '请选择公司' }],
  deptId: [{ required: true, message: '请选择部门' }],
  roleIds: [{ required: true, type: 'array' as const, min: 1, message: '请选择角色' }],
  password: editingId.value ? [] : [{ required: true, min: 6, message: '初始密码至少 6 位' }],
}))

const columns = [
  { title: '序号', key: 'index', width: 70, fixed: 'left' as const },
  { title: '登录账号', dataIndex: 'username', key: 'username', width: 120 },
  { title: '用户昵称', dataIndex: 'nickname', key: 'nickname', width: 120 },
  { title: '员工姓名', dataIndex: 'employeeName', key: 'employeeName', width: 120 },
  { title: '归属机构', dataIndex: 'deptName', key: 'deptName', width: 120 },
  { title: '归属公司', dataIndex: 'companyName', key: 'companyName', width: 140 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 90 },
  { title: '更新时间', dataIndex: 'updatedAt', key: 'updatedAt', width: 160 },
  { title: '电子邮箱', dataIndex: 'email', key: 'email', width: 180 },
  { title: '手机号码', dataIndex: 'mobile', key: 'mobile', width: 140 },
  { title: '办公电话', dataIndex: 'officePhone', key: 'officePhone', width: 150 },
  { title: '操作', key: 'action', width: 180, fixed: 'right' as const },
]

const companyOptions = computed(() => flattenTree(companies.value).map((item) => ({ label: item.name, value: item.id })))
const roleOptions = computed(() => roles.value.map((item) => ({ label: item.name, value: item.id })))
const deptOptions = computed(() => {
  return flattenTree(depts.value)
    .filter((item) => item.companyId === form.companyId)
    .map((item) => ({ label: item.name, value: item.id }))
})

const orgTree = computed(() => filterOrg(buildOrg(companies.value, depts.value), orgKeyword.value.trim()))

function buildOrg(companyTree: Company[], deptTree: Dept[]): OrgNode[] {
  const flatCompanies = flattenTree(companyTree)
  const flatDepts = flattenTree(deptTree)
  const nodes = new Map<string, OrgNode>()
  for (const company of flatCompanies) {
    nodes.set(company.id, {
      key: `c:${company.id}`,
      title: company.name,
      companyId: company.id,
      deptId: '',
      children: [],
    })
  }
  const roots: OrgNode[] = []
  for (const company of flatCompanies) {
    const node = nodes.get(company.id)
    if (!node) continue
    const parent = company.parentId ? nodes.get(company.parentId) : undefined
    if (parent) parent.children?.push(node)
    else roots.push(node)
  }
  const appendDepts = (companyId: string, parentId: string | null, bucket: OrgNode[]) => {
    for (const dept of flatDepts) {
      if (dept.companyId !== companyId || dept.parentId !== parentId) continue
      const children: OrgNode[] = []
      const node: OrgNode = {
        key: `d:${dept.id}`,
        title: dept.name,
        companyId,
        deptId: dept.id,
        children,
      }
      appendDepts(companyId, dept.id, children)
      if (!children.length) delete node.children
      bucket.push(node)
    }
  }
  for (const node of nodes.values()) {
    const deptNodes: OrgNode[] = []
    appendDepts(node.companyId, null, deptNodes)
    node.children = [...(node.children ?? []), ...deptNodes]
    if (!node.children.length) delete node.children
  }
  return [{ key: 'all', title: '全部机构', companyId: '', deptId: '', children: roots }]
}

function filterOrg(nodes: OrgNode[], keyword: string): OrgNode[] {
  if (!keyword) return nodes
  const result: OrgNode[] = []
  for (const node of nodes) {
    const children = node.children ? filterOrg(node.children, keyword) : []
    if (node.title.includes(keyword) || children.length) {
      const next: OrgNode = { ...node }
      if (children.length) next.children = children
      else delete next.children
      result.push(next)
    }
  }
  return result
}

function rowIndex(index: number) {
  return (query.pageNum - 1) * query.pageSize + index + 1
}

async function loadOptions() {
  const [companyPage, deptPage, rolePage] = await Promise.all([
    fetchCompanies({ pageNum: 1, pageSize: 500, name: '', status: '' }),
    fetchDepts({ pageNum: 1, pageSize: 500, name: '', status: '', companyId: '' }),
    fetchRoles({ pageNum: 1, pageSize: 200, name: '', status: 'NORMAL' }),
  ])
  companies.value = companyPage.list
  depts.value = deptPage.list
  roles.value = rolePage.list
  orgLoaded.value = true
}

function fillForm(record?: User) {
  editingId.value = record?.id ?? ''
  form.username = record?.username ?? ''
  form.nickname = record?.nickname ?? ''
  form.employeeName = record?.employeeName ?? ''
  form.companyId = record?.companyId ?? query.companyId
  form.deptId = record?.deptId ?? query.deptId
  form.email = record?.email ?? ''
  form.mobile = record?.mobile ?? ''
  form.officePhone = record?.officePhone ?? ''
  form.status = record?.status ?? 'NORMAL'
  form.roleIds = record?.roleIds ? [...record.roleIds] : []
  form.password = ''
}

function openCreate() {
  fillForm()
  visible.value = true
}

function openEdit(record: User) {
  fillForm(record)
  visible.value = true
}

function onCompanyChange() {
  if (!deptOptions.value.some((item) => item.value === form.deptId)) form.deptId = ''
}

function onSelectOrg(keys: Array<string | number>) {
  const key = String(keys[0] ?? 'all')
  selectedOrg.value = [key]
  if (key === 'all') {
    query.companyId = ''
    query.deptId = ''
  } else if (key.startsWith('c:')) {
    query.companyId = key.slice(2)
    query.deptId = ''
  } else {
    const dept = flattenTree(depts.value).find((item) => item.id === key.slice(2))
    query.companyId = dept?.companyId ?? ''
    query.deptId = key.slice(2)
  }
  void search()
}

async function onSubmit() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  saving.value = true
  try {
    if (editingId.value) await updateUser(editingId.value, { ...form, password: undefined })
    else await createUser({ ...form })
    message.success('保存成功')
    visible.value = false
    await load()
  } catch {
    // 错误提示由请求拦截器统一处理
  } finally {
    saving.value = false
  }
}

function onDelete(record: User) {
  Modal.confirm({
    title: `确认删除用户「${record.username}」？`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      await deleteUser(record.id)
      message.success('已删除')
      await load()
    },
  })
}

async function toggleStatus(record: User) {
  const status: Status = record.status === 'NORMAL' ? 'DISABLED' : 'NORMAL'
  await updateUser(record.id, {
    username: record.username,
    nickname: record.nickname,
    employeeName: record.employeeName,
    companyId: record.companyId,
    deptId: record.deptId,
    email: record.email,
    mobile: record.mobile,
    officePhone: record.officePhone,
    status,
    roleIds: record.roleIds,
  })
  message.success(status === 'NORMAL' ? '已启用' : '已停用')
  await load()
}

function openReset(record: User) {
  passwordUser.value = record
  nextPassword.value = ''
  passwordOpen.value = true
}

async function savePassword() {
  if (!passwordUser.value) return
  if (nextPassword.value.trim().length < 6) {
    message.warning('密码至少 6 位')
    return
  }
  saving.value = true
  try {
    await resetUserPassword(passwordUser.value.id, { password: nextPassword.value.trim() })
    message.success('密码已重置')
    passwordOpen.value = false
  } catch {
    // 错误提示由请求拦截器统一处理
  } finally {
    saving.value = false
  }
}

function onResetQuery() {
  selectedOrg.value = ['all']
  return reset()
}

onMounted(() => {
  void loadOptions()
  void load()
})
</script>

<template>
  <div class="user-page">
    <aside class="org">
      <div class="org-title">机构</div>
      <a-input-search v-model:value="orgKeyword" allow-clear placeholder="搜索机构" />
      <a-tree
        v-if="orgLoaded"
        default-expand-all
        :tree-data="orgTree"
        :selected-keys="selectedOrg"
        :field-names="{ title: 'title', key: 'key', children: 'children' }"
        @select="onSelectOrg"
      />
    </aside>
    <PageCard class="user-main" title="用户管理">
      <template #extra>
        <a-button v-auth="'system:user:create'" type="primary" @click="openCreate">
          <PlusOutlined />
          新增
        </a-button>
      </template>
      <template #search>
        <div class="search-row">
          <a-form layout="inline">
            <a-form-item label="账号">
              <a-input v-model:value="query.username" allow-clear placeholder="登录账号" @press-enter="search" />
            </a-form-item>
            <a-form-item label="昵称">
              <a-input v-model:value="query.nickname" allow-clear placeholder="昵称 / 姓名" @press-enter="search" />
            </a-form-item>
            <a-form-item label="状态">
              <a-select v-model:value="query.status" allow-clear placeholder="全部" style="width: 120px" :options="STATUS_OPTIONS" />
            </a-form-item>
          </a-form>
          <a-space>
            <a-button type="primary" @click="search">查询</a-button>
            <a-button @click="onResetQuery">重置</a-button>
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
        :scroll="{ x: 1560 }"
      >
        <template #bodyCell="{ column, record, index }">
          <template v-if="column.key === 'index'">{{ rowIndex(index) }}</template>
          <template v-else-if="column.key === 'status'">
            <StatusTag :status="record.status" />
          </template>
          <template v-else-if="column.key === 'updatedAt'">
            {{ formatDateTime(record.updatedAt) }}
          </template>
          <template v-else-if="column.key === 'action'">
            <div class="row-actions">
              <a-button v-auth="'system:user:update'" type="link" size="small" @click="openEdit(record)">编辑</a-button>
              <a-button v-auth="'system:user:delete'" type="link" size="small" danger @click="onDelete(record)">删除</a-button>
              <a-dropdown>
                <a-button type="link" size="small">更多</a-button>
                <template #overlay>
                  <a-menu>
                    <a-menu-item v-auth="'system:user:resetPwd'" @click="openReset(record)">重置密码</a-menu-item>
                    <a-menu-item v-auth="'system:user:update'" @click="toggleStatus(record)">
                      {{ record.status === 'NORMAL' ? '停用' : '启用' }}
                    </a-menu-item>
                  </a-menu>
                </template>
              </a-dropdown>
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
    </PageCard>
    <a-modal
      v-model:open="visible"
      :title="editingId ? '编辑用户' : '新增用户'"
      :confirm-loading="saving"
      ok-text="保存"
      cancel-text="取消"
      :width="680"
      @ok="onSubmit"
    >
      <a-form ref="formRef" :model="form" :rules="rules" layout="vertical">
        <div class="form-grid">
          <a-form-item label="登录账号" name="username">
            <a-input v-model:value="form.username" :disabled="Boolean(editingId)" />
          </a-form-item>
          <a-form-item v-if="!editingId" label="初始密码" name="password">
            <a-input-password v-model:value="form.password" />
          </a-form-item>
          <a-form-item label="用户昵称" name="nickname">
            <a-input v-model:value="form.nickname" />
          </a-form-item>
          <a-form-item label="员工姓名" name="employeeName">
            <a-input v-model:value="form.employeeName" />
          </a-form-item>
          <a-form-item label="归属公司" name="companyId">
            <a-select v-model:value="form.companyId" :options="companyOptions" @change="onCompanyChange" />
          </a-form-item>
          <a-form-item label="归属机构" name="deptId">
            <a-select v-model:value="form.deptId" :options="deptOptions" placeholder="请先选择公司" />
          </a-form-item>
          <a-form-item label="角色" name="roleIds">
            <a-select v-model:value="form.roleIds" mode="multiple" :options="roleOptions" />
          </a-form-item>
          <a-form-item label="状态" name="status">
            <a-radio-group v-model:value="form.status" :options="STATUS_OPTIONS" />
          </a-form-item>
          <a-form-item label="电子邮箱" name="email">
            <a-input v-model:value="form.email" />
          </a-form-item>
          <a-form-item label="手机号码" name="mobile">
            <a-input v-model:value="form.mobile" />
          </a-form-item>
          <a-form-item label="办公电话" name="officePhone">
            <a-input v-model:value="form.officePhone" />
          </a-form-item>
        </div>
      </a-form>
    </a-modal>
    <a-modal
      v-model:open="passwordOpen"
      title="重置密码"
      :confirm-loading="saving"
      ok-text="保存"
      cancel-text="取消"
      @ok="savePassword"
    >
      <p>为账号 {{ passwordUser?.username }} 设置新密码</p>
      <a-input-password v-model:value="nextPassword" placeholder="至少 6 位" />
    </a-modal>
  </div>
</template>

<style scoped lang="less">
.user-page {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  gap: 12px;
  min-height: 100%;
}

.org {
  padding: 14px 12px;
  background: #fff;
  border-radius: 8px;
}

.org-title {
  margin-bottom: 10px;
  font-weight: 600;
}

.user-main {
  min-width: 0;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 16px;
}
</style>

<script setup lang="ts">
import { createMenu, deleteMenu, fetchMenus, updateMenu } from '@/api/menu'
import { MENU_ICON_OPTIONS, resolveIcon } from '@/components/icons'
import PageCard from '@/components/PageCard.vue'
import { MENU_TYPE_OPTIONS } from '@/constants/system'
import { addDynamicRoutes, firstLeafPath, listViewComponents } from '@/router/dynamic'
import { useUserStore } from '@/stores/user'
import type { MenuType } from '@/types/api'
import type { Menu, MenuPayload } from '@/types/system'
import { buildTree, descendantIds, flattenTree } from '@/utils/tree'
import { PlusOutlined } from '@ant-design/icons-vue'
import { message, Modal, type FormInstance } from 'ant-design-vue'
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

const TYPE_LABEL: Record<MenuType, string> = {
  DIR: '目录',
  MENU: '菜单',
  BUTTON: '按钮',
}

const TYPE_COLOR: Record<MenuType, string> = {
  DIR: 'blue',
  MENU: 'green',
  BUTTON: 'orange',
}

const router = useRouter()
const userStore = useUserStore()
const tableKey = ref(0)
const loading = ref(false)
const visible = ref(false)
const saving = ref(false)
const editingId = ref('')
const list = ref<Menu[]>([])
const formRef = ref<FormInstance>()
const componentOptions = listViewComponents().map((value) => ({ label: value, value }))

const query = reactive({
  name: '',
  type: undefined as MenuType | undefined,
})

const form = reactive({
  parentId: null as string | null,
  name: '',
  path: '',
  component: '',
  icon: undefined as string | undefined,
  sort: 0 as number | null,
  type: 'DIR' as MenuType,
  permission: '',
})

const columns = [
  { title: '名称', dataIndex: 'name', key: 'name', width: 240 },
  { title: '类型', dataIndex: 'type', key: 'type', width: 90 },
  { title: '路由地址', dataIndex: 'path', key: 'path', width: 200 },
  { title: '页面组件', dataIndex: 'component', key: 'component', width: 200 },
  { title: '权限标识', dataIndex: 'permission', key: 'permission', width: 200 },
  { title: '排序', dataIndex: 'sort', key: 'sort', width: 80 },
  { title: '操作', key: 'action', width: 220, fixed: 'right' as const },
]

const totalCount = computed(() => flattenTree(list.value).length)
const typeLocked = computed(() => {
  if (!editingId.value) return false
  return flattenTree(list.value).some((item) => item.parentId === editingId.value)
})
const dialogTitle = computed(() => `${editingId.value ? '编辑' : '新增'}${TYPE_LABEL[form.type]}`)
const pathPlaceholder = computed(() => {
  const parent = flattenTree(list.value).find((item) => item.id === form.parentId)
  return parent?.path ? `${parent.path}/example` : '/example'
})

const rules = {
  name: [
    { required: true, message: '请输入名称' },
    { max: 30, message: '名称不超过 30 个字' },
  ],
  type: [{ required: true, message: '请选择类型' }],
  path: [{ validator: validatePath, trigger: 'blur' }],
}

const directoryTree = computed(() => {
  const hidden = blockedIds()
  const source = flattenTree(list.value)
    .filter((item) => item.type === 'DIR' && !hidden.has(item.id))
    .map((item) => ({
      id: item.id,
      parentId: hidden.has(item.parentId ?? '') ? null : item.parentId,
      name: item.name,
      sort: item.sort,
    }))
  return buildTree(source)
})

const buttonParentOptions = computed(() => {
  const hidden = blockedIds()
  return flattenTree(list.value)
    .filter((item) => item.type === 'MENU' && !hidden.has(item.id))
    .map((item) => ({ label: ancestorLabel(item), value: item.id }))
})

function typeLabel(type: MenuType) {
  return TYPE_LABEL[type]
}

function typeColor(type: MenuType) {
  return TYPE_COLOR[type]
}

function display(value?: string) {
  return value || '-'
}

function blockedIds() {
  const hidden = new Set<string>()
  if (!editingId.value) return hidden
  hidden.add(editingId.value)
  for (const id of descendantIds(list.value, editingId.value)) hidden.add(id)
  return hidden
}

function ancestorLabel(menu: Menu) {
  const flat = flattenTree(list.value)
  const names = [menu.name]
  let parentId = menu.parentId
  while (parentId) {
    const parent = flat.find((item) => item.id === parentId)
    if (!parent) break
    names.unshift(parent.name)
    parentId = parent.parentId
  }
  return names.join(' / ')
}

function validatePath(_rule: unknown, value: unknown) {
  if (form.type === 'BUTTON') return Promise.resolve()
  const path = typeof value === 'string' ? value.trim() : ''
  if (!path) return Promise.reject(new Error('请输入路由地址'))
  if (!/^\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/.test(path)) {
    return Promise.reject(new Error('以 / 开头，仅含字母、数字、-、_'))
  }
  const parent = flattenTree(list.value).find((item) => item.id === form.parentId)
  if (parent?.path && !path.startsWith(`${parent.path}/`)) {
    return Promise.reject(new Error(`需以 ${parent.path}/ 开头`))
  }
  return Promise.resolve()
}

function nextSort(parent?: Menu) {
  const siblings = flattenTree(list.value).filter((item) => item.parentId === (parent?.id ?? null))
  const max = siblings.reduce((current, item) => Math.max(current, item.sort), 0)
  return siblings.length ? max + 1 : 1
}

function fillForm(record?: Menu, parent?: Menu) {
  editingId.value = record?.id ?? ''
  form.type = record?.type ?? (parent?.type === 'MENU' ? 'BUTTON' : parent ? 'MENU' : 'DIR')
  form.parentId = record?.parentId ?? parent?.id ?? null
  form.name = record?.name ?? ''
  form.path = record?.path ?? (form.type !== 'BUTTON' && parent?.path ? `${parent.path}/` : '')
  form.component = record?.component ?? (form.type === 'MENU' ? 'blank/index' : '')
  form.icon = record?.icon
  form.sort = record?.sort ?? nextSort(parent)
  form.permission = record?.permission ?? ''
}

function toPayload(): MenuPayload {
  return {
    parentId: form.parentId,
    name: form.name.trim(),
    path: form.type === 'BUTTON' ? '' : form.path.trim(),
    component: form.type === 'MENU' ? form.component.trim() : '',
    icon: form.type === 'BUTTON' ? '' : (form.icon ?? ''),
    sort: form.sort ?? 0,
    type: form.type,
    permission: form.type === 'DIR' ? '' : form.permission.trim(),
  }
}

async function reload() {
  loading.value = true
  try {
    list.value = await fetchMenus({ name: query.name.trim(), type: query.type ?? '' })
    tableKey.value += 1
  } catch {
    // 错误提示由请求拦截器统一处理
  } finally {
    loading.value = false
  }
}

function onSearch() {
  void reload()
}

function onReset() {
  query.name = ''
  query.type = undefined
  void reload()
}

async function openCreate(parent?: Menu) {
  fillForm(undefined, parent)
  visible.value = true
  await nextTick()
  formRef.value?.clearValidate()
}

async function openEdit(record: Menu) {
  fillForm(record)
  visible.value = true
  await nextTick()
  formRef.value?.clearValidate()
}

function onTypeChange() {
  const parent = flattenTree(list.value).find((item) => item.id === form.parentId)
  if (form.type === 'BUTTON') {
    form.path = ''
    form.component = ''
    form.icon = undefined
    if (parent?.type !== 'MENU') form.parentId = null
    return
  }
  if (form.type === 'DIR') {
    form.component = ''
    form.permission = ''
  }
  if (form.type === 'MENU' && !form.component) form.component = 'blank/index'
  if (!form.path && parent?.path) form.path = `${parent.path}/`
  if (parent && parent.type !== 'DIR') form.parentId = null
}

function onParentChange() {
  if (form.type !== 'BUTTON' && !form.path.trim()) {
    const parent = flattenTree(list.value).find((item) => item.id === form.parentId)
    if (parent?.path) form.path = `${parent.path}/`
  }
  void formRef.value?.validateFields(['path']).catch(() => undefined)
}

async function refreshNavigation(preferredPath?: string) {
  const current = router.currentRoute.value.path
  await userStore.fetchProfile()
  addDynamicRoutes(userStore.menus)
  const paths = new Set(
    flattenTree(userStore.menus).filter((item) => item.type === 'MENU').map((item) => item.path),
  )
  if (paths.has(current)) return
  const target = preferredPath && paths.has(preferredPath) ? preferredPath : firstLeafPath(userStore.menus)
  if (target) await router.replace(target)
}

async function onSubmit() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  const payload = toPayload()
  saving.value = true
  try {
    if (editingId.value) await updateMenu(editingId.value, payload)
    else await createMenu(payload)
    message.success('保存成功')
    visible.value = false
    await reload()
    await refreshNavigation(payload.type === 'MENU' ? payload.path : undefined)
  } catch {
    // 错误提示由请求拦截器统一处理
  } finally {
    saving.value = false
  }
}

function onDelete(record: Menu) {
  Modal.confirm({
    title: `确认删除${typeLabel(record.type)}「${record.name}」？`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      await deleteMenu(record.id)
      message.success('已删除')
      await reload()
      await refreshNavigation()
    },
  })
}

onMounted(() => {
  void reload()
})
</script>

<template>
  <PageCard title="菜单管理">
    <template #extra>
      <a-button v-auth="'system:menu:create'" type="primary" @click="openCreate()">
        <PlusOutlined />
        新增
      </a-button>
    </template>
    <template #search>
      <div class="search-row">
        <a-form layout="inline">
          <a-form-item label="菜单">
            <a-input v-model:value="query.name" allow-clear placeholder="名称 / 路由 / 权限" @press-enter="onSearch" />
          </a-form-item>
          <a-form-item label="类型">
            <a-select
              v-model:value="query.type"
              allow-clear
              placeholder="全部"
              style="width: 120px"
              :options="MENU_TYPE_OPTIONS"
            />
          </a-form-item>
        </a-form>
        <a-space>
          <a-button type="primary" @click="onSearch">查询</a-button>
          <a-button @click="onReset">重置</a-button>
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
      :scroll="{ x: 1280 }"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'name'">
          <span class="menu-name">
            <component :is="resolveIcon(record.icon)" v-if="resolveIcon(record.icon)" />
            {{ record.name }}
          </span>
        </template>
        <template v-else-if="column.key === 'type'">
          <a-tag :color="typeColor(record.type)">{{ typeLabel(record.type) }}</a-tag>
        </template>
        <template v-else-if="column.key === 'path'">{{ display(record.path) }}</template>
        <template v-else-if="column.key === 'component'">{{ display(record.component) }}</template>
        <template v-else-if="column.key === 'permission'">{{ display(record.permission) }}</template>
        <template v-else-if="column.key === 'action'">
          <div class="row-actions">
            <a-button
              v-if="record.type !== 'BUTTON'"
              v-auth="'system:menu:create'"
              type="link"
              size="small"
              @click="openCreate(record)"
            >
              新增下级
            </a-button>
            <a-button v-auth="'system:menu:update'" type="link" size="small" @click="openEdit(record)">编辑</a-button>
            <a-button v-auth="'system:menu:delete'" type="link" size="small" danger @click="onDelete(record)">删除</a-button>
          </div>
        </template>
      </template>
    </a-table>
    <div class="table-footer">共 {{ totalCount }} 条数据</div>
    <a-modal v-model:open="visible" :title="dialogTitle" :width="560" :footer="null" destroy-on-close>
      <a-form ref="formRef" :model="form" :rules="rules" layout="vertical">
        <a-form-item label="类型" name="type">
          <a-radio-group v-model:value="form.type" :options="MENU_TYPE_OPTIONS" :disabled="typeLocked" @change="onTypeChange" />
        </a-form-item>
        <a-form-item
          label="上级"
          name="parentId"
          :rules="form.type === 'BUTTON' ? [{ required: true, message: '请选择所属菜单' }] : []"
        >
          <a-select
            v-if="form.type === 'BUTTON'"
            v-model:value="form.parentId"
            show-search
            option-filter-prop="label"
            placeholder="请选择所属菜单"
            :options="buttonParentOptions"
          />
          <a-tree-select
            v-else
            v-model:value="form.parentId"
            allow-clear
            show-search
            tree-default-expand-all
            tree-node-filter-prop="name"
            placeholder="不选则为顶级"
            :tree-data="directoryTree"
            :field-names="{ label: 'name', value: 'id', children: 'children' }"
            @change="onParentChange"
          />
        </a-form-item>
        <a-form-item label="名称" name="name">
          <a-input v-model:value="form.name" placeholder="请输入名称" />
        </a-form-item>
        <a-form-item v-if="form.type !== 'BUTTON'" label="路由地址" name="path">
          <a-input v-model:value="form.path" :placeholder="pathPlaceholder" />
        </a-form-item>
        <a-form-item
          v-if="form.type === 'MENU'"
          label="页面组件"
          name="component"
          :rules="[{ required: true, message: '请选择页面组件' }]"
        >
          <a-select
            v-model:value="form.component"
            show-search
            placeholder="对应 views 下的页面"
            :options="componentOptions"
          />
        </a-form-item>
        <a-form-item
          v-if="form.type !== 'DIR'"
          label="权限标识"
          name="permission"
          :rules="form.type === 'BUTTON' ? [{ required: true, message: '请输入权限标识' }] : []"
        >
          <a-input v-model:value="form.permission" placeholder="例如 system:notice:query" />
        </a-form-item>
        <a-form-item v-if="form.type !== 'BUTTON'" label="图标" name="icon">
          <a-select
            v-model:value="form.icon"
            allow-clear
            show-search
            option-filter-prop="label"
            placeholder="选择图标"
            :options="MENU_ICON_OPTIONS"
          >
            <template #option="{ value, label }">
              <span class="icon-option">
                <component :is="resolveIcon(String(value))" />
                <span>{{ label }}</span>
              </span>
            </template>
          </a-select>
        </a-form-item>
        <a-form-item label="排序" name="sort">
          <a-input-number v-model:value="form.sort" :min="0" :max="9999" :precision="0" style="width: 100%" />
        </a-form-item>
        <div class="modal-footer">
          <a-button @click="visible = false">取消</a-button>
          <a-button type="primary" :loading="saving" @click="onSubmit">保存</a-button>
        </div>
      </a-form>
    </a-modal>
  </PageCard>
</template>

<style scoped lang="less">
.menu-name,
.icon-option {
  display: inline-flex;
  gap: 8px;
  align-items: center;
}

.modal-footer {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
</style>

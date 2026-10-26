<script setup lang="ts">
import { createKnowledge, updateKnowledge } from '@/api/rag'
import type { Knowledge, KnowledgePayload } from '@/types/rag'
import { message, type FormInstance } from 'ant-design-vue'
import { nextTick, reactive, ref, watch } from 'vue'

const props = defineProps<{
  open: boolean
  record?: Knowledge | null
}>()

const emit = defineEmits<{
  (event: 'update:open', open: boolean): void
  (event: 'saved', knowledge: Knowledge): void
}>()

const formRef = ref<FormInstance>()
const saving = ref(false)
const editingId = ref('')
const form = reactive<KnowledgePayload>({
  name: '',
  description: '',
})

const rules = {
  name: [{ required: true, message: '请输入知识库名称' }],
}

watch(
  () => [props.open, props.record?.id] as const,
  ([visible]) => {
    if (!visible) return
    const record = props.record
    editingId.value = record?.id ?? ''
    form.name = record?.name ?? ''
    form.description = record?.description ?? ''
    void nextTick(() => formRef.value?.clearValidate())
  },
)

function close() {
  emit('update:open', false)
}

async function onSubmit() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  saving.value = true
  try {
    const saved = editingId.value
      ? await updateKnowledge(editingId.value, { ...form })
      : await createKnowledge({ ...form })
    message.success('保存成功')
    emit('saved', saved)
    close()
  } catch {
    // 错误提示由请求拦截器统一处理
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <a-modal
    :open="open"
    :title="editingId ? '编辑知识库' : '新增知识库'"
    :confirm-loading="saving"
    ok-text="保存"
    cancel-text="取消"
    @ok="onSubmit"
    @cancel="close"
  >
    <a-form ref="formRef" :model="form" :rules="rules" layout="vertical">
      <a-form-item label="知识库名称" name="name">
        <a-input v-model:value="form.name" :maxlength="40" placeholder="例如：产品手册" />
      </a-form-item>
      <a-form-item label="描述" name="description">
        <a-textarea v-model:value="form.description" :maxlength="200" :rows="4" placeholder="这个知识库用来回答什么问题" />
      </a-form-item>
      <a-form-item label="可见范围">
        <a-tag color="blue">公开</a-tag>
        <span class="visibility-hint">当前阶段知识库对所有登录用户可见。</span>
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<style scoped lang="less">
.visibility-hint {
  margin-left: 8px;
  color: #8b93a7;
  font-size: 12px;
}
</style>

<script setup lang="ts">
import { createDocument, fetchDocument, fetchKnowledges } from '@/api/rag'
import { MAX_DOCUMENT_BYTES } from '@/constants/rag'
import type { VectorStatus } from '@/types/rag'
import { formatFileSize } from '@/utils/format'
import { InboxOutlined } from '@ant-design/icons-vue'
import { message, type FormInstance, type UploadProps } from 'ant-design-vue'
import { computed, onUnmounted, reactive, ref, watch } from 'vue'

const props = defineProps<{
  open: boolean
  knowledgeId?: string
}>()

const emit = defineEmits<{
  (event: 'update:open', open: boolean): void
  (event: 'saved'): void
}>()

const formRef = ref<FormInstance>()
const saving = ref(false)
const file = ref<File | null>(null)
const createdId = ref('')
const vectorStatus = ref<VectorStatus>('PROCESSING')
const knowledgeOptions = ref<Array<{ label: string; value: string }>>([])
let pollTimer = 0

const form = reactive({
  knowledgeId: '',
})

const rules = {
  knowledgeId: [{ required: true, message: '请选择知识库' }],
}

const statusTitle = computed(() => {
  if (vectorStatus.value === 'READY') return '处理完成'
  if (vectorStatus.value === 'FAILED') return '处理失败'
  return '向量化中'
})

watch(
  () => props.open,
  (visible) => {
    if (!visible) {
      stopPoll()
      return
    }
    resetState()
    void loadKnowledges()
  },
)

function resetState() {
  stopPoll()
  file.value = null
  createdId.value = ''
  vectorStatus.value = 'PROCESSING'
  saving.value = false
  form.knowledgeId = props.knowledgeId || ''
  void formRef.value?.clearValidate()
}

async function loadKnowledges() {
  try {
    const page = await fetchKnowledges({ pageNum: 1, pageSize: 200, name: '' })
    knowledgeOptions.value = page.list.map((item) => ({ label: item.name, value: item.id }))
  } catch {
    knowledgeOptions.value = []
  }
}

const beforeUpload: UploadProps['beforeUpload'] = (raw) => {
  if (createdId.value) return false
  const next = raw as File
  if (!isMarkdown(next.name)) {
    message.error('仅支持 markdown 文件')
    return false
  }
  if (next.size > MAX_DOCUMENT_BYTES) {
    message.error('文件不能超过 10MB')
    return false
  }
  if (next.size <= 0) {
    message.error('文档内容为空')
    return false
  }
  file.value = next
  return false
}

function clearFile() {
  file.value = null
}

async function onConfirm() {
  const selected = file.value
  if (!selected) {
    message.warning('请先上传文档')
    return
  }
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  saving.value = true
  try {
    const document = await createDocument(form.knowledgeId, selected)
    createdId.value = document.id
    vectorStatus.value = document.vectorStatus
    message.success('已开始处理')
    emit('saved')
    void poll(document.id)
  } catch {
    // 错误提示由请求拦截器统一处理
  } finally {
    saving.value = false
  }
}

async function poll(id: string) {
  try {
    const document = await fetchDocument(id)
    vectorStatus.value = document.vectorStatus
    if (document.vectorStatus === 'PROCESSING' && props.open) {
      pollTimer = window.setTimeout(() => {
        void poll(id)
      }, 400)
    }
  } catch {
    stopPoll()
  }
}

function stopPoll() {
  if (!pollTimer) return
  window.clearTimeout(pollTimer)
  pollTimer = 0
}

function close() {
  stopPoll()
  emit('update:open', false)
}

function isMarkdown(name: string) {
  const base = name.split(/[/\\]/).pop()?.trim().toLowerCase() ?? ''
  return base.endsWith('.md') || base.endsWith('.markdown')
}

onUnmounted(stopPoll)
</script>

<template>
  <a-modal :open="open" title="新增文档" :width="640" :footer="null" :mask-closable="true" @cancel="close">
    <a-form ref="formRef" :model="form" :rules="rules" layout="vertical">
      <a-form-item label="所属知识库" name="knowledgeId">
        <a-select
          v-model:value="form.knowledgeId"
          show-search
          option-filter-prop="label"
          :disabled="Boolean(createdId)"
          :options="knowledgeOptions"
          placeholder="请选择知识库"
        />
      </a-form-item>
    </a-form>
    <a-upload-dragger v-if="!file" :before-upload="beforeUpload" :show-upload-list="false" accept=".md,.markdown">
      <p class="upload-icon"><InboxOutlined /></p>
      <p>点击或拖拽上传文档</p>
      <p class="upload-hint">仅支持 .md、.markdown，不超过 10MB。上传后由服务端切块并向量化。</p>
    </a-upload-dragger>
    <div v-else class="file-row">
      <div>
        <strong>{{ file.name }}</strong>
        <span>{{ formatFileSize(file.size) }}</span>
      </div>
      <a-button v-if="!createdId" type="link" @click="clearFile">重新选择</a-button>
    </div>
    <div v-if="createdId" class="vector-box">
      <strong>{{ statusTitle }}</strong>
      <p v-if="vectorStatus === 'READY'">文档已可用于问答。</p>
      <p v-else-if="vectorStatus === 'FAILED'">向量化失败，可稍后重新上传。</p>
      <p v-else>可以关闭弹窗，处理会继续。完成后，文档列表中的向量化状态会变为已完成。</p>
    </div>
    <div class="doc-footer">
      <span v-if="!createdId" class="footer-hint">确定后开始向量化并入库</span>
      <a-button @click="close">{{ createdId ? '关闭' : '取消' }}</a-button>
      <a-button v-if="!createdId" type="primary" :loading="saving" :disabled="!file" @click="onConfirm">确定</a-button>
    </div>
  </a-modal>
</template>

<style scoped lang="less">
.upload-icon {
  margin-bottom: 8px;
  color: #3a67e8;
  font-size: 28px;
}

.upload-hint,
.footer-hint,
.file-row span,
.vector-box p {
  color: #8b93a7;
  font-size: 12px;
}

.file-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  background: #f6f8ff;
  border: 1px solid #e6ebff;
  border-radius: 8px;

  strong,
  span {
    display: block;
  }

  strong {
    margin-bottom: 4px;
  }
}

.vector-box {
  margin-top: 16px;
  padding: 12px 14px;
  background: #f8fafc;
  border: 1px solid #e6ebf2;
  border-radius: 8px;

  p {
    margin: 8px 0 0;
  }
}

.doc-footer {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: flex-end;
  margin-top: 16px;
}

.footer-hint {
  margin-right: auto;
}
</style>

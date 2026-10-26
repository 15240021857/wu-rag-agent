<script setup lang="ts">
import { createDocument, fetchDocument, fetchDocumentDetail, fetchKnowledges, revectorizeDocument } from '@/api/rag'
import { CHUNK_METHOD_OPTIONS } from '@/constants/rag'
import type { ChunkMethod, VectorStatus } from '@/types/rag'
import { chunkUsesFallback, formatChunkNotes, splitChunks, type TextChunk } from '@/utils/chunk'
import { readDocumentFile, type ParsedDocument } from '@/utils/readDocument'
import { CheckOutlined, CloseOutlined, InboxOutlined } from '@ant-design/icons-vue'
import { message, type FormInstance, type UploadProps } from 'ant-design-vue'
import { computed, onUnmounted, reactive, ref, watch } from 'vue'

const props = defineProps<{
  open: boolean
  knowledgeId?: string
  documentId?: string
}>()

const emit = defineEmits<{
  (event: 'update:open', open: boolean): void
  (event: 'saved'): void
}>()

const formRef = ref<FormInstance>()
const saving = ref(false)
const parsing = ref(false)
const parsed = ref<ParsedDocument | null>(null)
const chunks = ref<TextChunk[]>([])
const usedFallback = ref(false)
const createdId = ref('')
const progress = ref(0)
const vectorStatus = ref<VectorStatus>('PROCESSING')
const knowledgeOptions = ref<Array<{ label: string; value: string }>>([])
let pollTimer = 0
let skipClear = false

const form = reactive({
  knowledgeId: '',
  chunkMethod: 'CHAR' as ChunkMethod,
  chunkSeparator: '\\n',
  chunkSize: 1024 as number | null,
})

const rules = {
  knowledgeId: [{ required: true, message: '请选择知识库' }],
}

const revectorizing = computed(() => Boolean(props.documentId))
const chunkNotes = computed(() => formatChunkNotes(chunks.value))

type IngestState = 'wait' | 'active' | 'finish' | 'error'
type ProgressStatus = 'success' | 'active' | 'normal' | 'exception'

interface IngestStageView {
  key: 'chunk' | 'embed' | 'store'
  title: string
  state: IngestState
  percent: number
  detail: string
  barStatus: ProgressStatus
}

const STAGE_BANDS = [
  { key: 'chunk' as const, title: '分片', start: 0, end: 12 },
  { key: 'embed' as const, title: '向量化', start: 12, end: 72 },
  { key: 'store' as const, title: '入库', start: 72, end: 100 },
]

function bandPercent(value: number, start: number, end: number) {
  if (value <= start) return 0
  if (value >= end) return 100
  return Math.round(((value - start) / (end - start)) * 100)
}

const ingest = computed(() => {
  const total = chunks.value.length
  const ready = vectorStatus.value === 'READY'
  const failed = vectorStatus.value === 'FAILED'
  const value = ready ? 100 : Math.max(0, Math.min(99, progress.value))
  let activeIndex = STAGE_BANDS.findIndex((band) => value < band.end)
  if (activeIndex < 0) activeIndex = STAGE_BANDS.length - 1

  const stages: IngestStageView[] = STAGE_BANDS.map((band, index) => {
    const percent = ready ? 100 : bandPercent(value, band.start, band.end)
    const finished = ready || index < activeIndex || percent >= 100
    const error = failed && index === activeIndex
    const state: IngestState = error ? 'error' : finished ? 'finish' : index === activeIndex ? 'active' : 'wait'
    const rawDone = percent >= 100 ? total : Math.floor((percent / 100) * total)
    const done = state === 'active' && percent > 0 ? Math.min(total, Math.max(rawDone, 1)) : rawDone
    let detail = '等待中'
    if (state === 'error') detail = '失败'
    else if (state === 'finish') detail = band.key === 'chunk' ? `${total} 片` : '已完成'
    else if (state === 'active') detail = total > 0 ? `${done} / ${total}${band.key === 'chunk' ? ' 片' : ''}` : '处理中'
    const barStatus: ProgressStatus =
      state === 'finish' ? 'success' : state === 'error' ? 'exception' : state === 'active' ? 'active' : 'normal'
    return {
      key: band.key,
      title: band.title,
      state,
      percent: state === 'finish' ? 100 : percent,
      detail,
      barStatus,
    }
  })

  const current = stages[activeIndex]
  const title = ready ? '处理完成' : failed ? '处理失败' : `正在${current?.title ?? '处理'}`
  return { title, stages }
})

watch(
  () => [form.chunkMethod, form.chunkSeparator, form.chunkSize] as const,
  () => {
    if (skipClear || createdId.value) return
    chunks.value = []
    usedFallback.value = false
  },
  { flush: 'sync' },
)

watch(
  () => props.open,
  (visible) => {
    if (!visible) {
      stopPoll()
      return
    }
    resetState()
    void loadKnowledges()
    if (props.documentId) void loadExisting(props.documentId)
  },
)

function resetState() {
  stopPoll()
  parsed.value = null
  parsing.value = false
  chunks.value = []
  usedFallback.value = false
  createdId.value = ''
  progress.value = 0
  vectorStatus.value = 'PROCESSING'
  saving.value = false
  skipClear = true
  form.knowledgeId = props.knowledgeId || ''
  form.chunkMethod = 'CHAR'
  form.chunkSeparator = '\\n'
  form.chunkSize = 1024
  skipClear = false
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

async function loadExisting(id: string) {
  parsing.value = true
  try {
    const detail = await fetchDocumentDetail(id)
    parsed.value = {
      fileName: detail.fileName,
      fileType: detail.fileType,
      size: detail.size,
      content: detail.content,
    }
    skipClear = true
    form.knowledgeId = detail.knowledgeId
    form.chunkMethod = detail.chunkMethod
    form.chunkSeparator = detail.chunkSeparator || '\\n'
    form.chunkSize = detail.chunkSize
    skipClear = false
    previewChunks()
  } catch {
    parsed.value = null
  } finally {
    parsing.value = false
  }
}

const beforeUpload: UploadProps['beforeUpload'] = (file) => {
  if (createdId.value || revectorizing.value) return false
  void readFile(file)
  return false
}

function clearFile() {
  parsed.value = null
  chunks.value = []
  usedFallback.value = false
}

async function readFile(file: File) {
  parsing.value = true
  chunks.value = []
  try {
    parsed.value = await readDocumentFile(file)
    previewChunks()
  } catch (error) {
    parsed.value = null
    message.error(error instanceof Error ? error.message : '解析失败')
  } finally {
    parsing.value = false
  }
}

function previewChunks() {
  if (!parsed.value) {
    message.warning('请先上传并解析文档')
    return
  }
  const size = form.chunkSize ?? 0
  if (size < 100 || size > 4000) {
    message.warning('单片最大字符数需在 100 到 4000 之间')
    return
  }
  if (form.chunkMethod === 'CHAR' && !form.chunkSeparator) {
    message.warning('请填写切分字符')
    return
  }
  const next = splitChunks(parsed.value.content, form.chunkMethod, size, form.chunkSeparator)
  if (!next.length) {
    message.warning('没有可切分的文本')
    return
  }
  chunks.value = next
  usedFallback.value = chunkUsesFallback(parsed.value.content, form.chunkMethod, form.chunkSeparator)
}

async function onConfirm() {
  if (!parsed.value) {
    message.warning('请先上传并解析文档')
    return
  }
  if (!chunks.value.length) {
    message.warning('请先查看分片')
    return
  }
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  const size = form.chunkSize ?? 0
  const payload = {
    chunkMethod: form.chunkMethod,
    chunkSeparator: form.chunkSeparator,
    chunkSize: size,
    chunks: chunks.value.map((item) => ({ content: item.content })),
  }
  saving.value = true
  try {
    const document = props.documentId
      ? await revectorizeDocument(props.documentId, payload)
      : await createDocument({
          ...payload,
          knowledgeId: form.knowledgeId,
          fileName: parsed.value.fileName,
          fileType: parsed.value.fileType,
          size: parsed.value.size,
          content: parsed.value.content,
        })
    createdId.value = document.id
    progress.value = document.progress
    vectorStatus.value = document.vectorStatus
    message.success(props.documentId ? '已删除旧向量，正在重新处理' : '已开始处理')
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
    progress.value = document.progress
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

onUnmounted(stopPoll)
</script>

<template>
  <a-modal
    :open="open"
    :title="revectorizing ? '重新向量化' : '新增文档'"
    :width="860"
    :footer="null"
    :mask-closable="true"
    @cancel="close"
  >
    <div class="doc-shell">
      <div class="doc-body">
        <a-form ref="formRef" :model="form" :rules="rules" layout="vertical">
          <a-form-item label="所属知识库" name="knowledgeId">
            <a-select
              v-model:value="form.knowledgeId"
              show-search
              option-filter-prop="label"
              :disabled="Boolean(createdId) || revectorizing"
              :options="knowledgeOptions"
              placeholder="请选择知识库"
            />
          </a-form-item>
        </a-form>
        <a-spin :spinning="parsing" tip="正在解析文档">
          <a-upload-dragger
            v-if="!parsed && !revectorizing"
            :before-upload="beforeUpload"
            :show-upload-list="false"
            accept=".md,.markdown,.txt,.csv,.json,.pdf"
          >
            <p class="upload-icon"><InboxOutlined /></p>
            <p>点击或拖拽上传文档</p>
            <p class="upload-hint">支持 md、txt、csv、json、pdf，上传后自动解析并生成分片</p>
          </a-upload-dragger>
          <div v-else-if="parsed" class="file-row">
            <div>
              <strong>{{ parsed.fileName }}</strong>
              <span>解析完成，共 {{ parsed.content.length }} 个字符</span>
            </div>
            <a-button v-if="!createdId && !revectorizing" type="link" @click="clearFile">重新上传</a-button>
          </div>
        </a-spin>
        <template v-if="parsed">
          <div class="split-row">
            <div>
              <div class="field-label">切分方式</div>
              <a-radio-group v-model:value="form.chunkMethod" :disabled="Boolean(createdId)" :options="CHUNK_METHOD_OPTIONS" />
            </div>
            <div v-if="form.chunkMethod === 'CHAR'">
              <div class="field-label">切分字符</div>
              <a-input v-model:value="form.chunkSeparator" :disabled="Boolean(createdId)" :maxlength="20" style="width: 140px" />
            </div>
            <div>
              <div class="field-label">单片最大字符数</div>
              <a-input-number v-model:value="form.chunkSize" :disabled="Boolean(createdId)" :min="100" :max="4000" :precision="0" />
            </div>
            <a-button :disabled="Boolean(createdId)" @click="previewChunks">查看分片</a-button>
          </div>
          <p class="split-hint">
            默认按字符切分，切分字符默认 \n，可改成 # 等。切分字符只作分界，不会留在分片里。文本中没有该字符时，按单片最大字符数截断，默认 1024。只剩切分字符或空格的分片会去掉。更改配置后分片会清空。
          </p>
          <p v-if="chunks.length && usedFallback" class="split-hint">未匹配到切分字符，已按单片最大 {{ form.chunkSize }} 个字符兜底。</p>
          <div v-if="chunks.length" class="chunk-panel">
            <div class="field-label">全部分片 · {{ chunks.length }} 片。注释只用于核对，不会写入向量。</div>
            <a-textarea class="chunk-text" readonly :auto-size="{ minRows: 12 }" :value="chunkNotes" />
          </div>
          <a-empty v-else description="分片已清空，点击查看分片后在这里核对" />
        </template>
      </div>
      <div v-if="createdId" class="vector-box">
        <div class="vector-head">
          <strong>{{ ingest.title }}</strong>
        </div>
        <div v-for="(stage, index) in ingest.stages" :key="stage.key" class="stage" :class="`is-${stage.state}`">
          <div class="stage-row">
            <span class="stage-name">
              <span class="stage-mark">
                <CheckOutlined v-if="stage.state === 'finish'" />
                <CloseOutlined v-else-if="stage.state === 'error'" />
                <span v-else>{{ index + 1 }}</span>
              </span>
              {{ stage.title }}
            </span>
            <span class="stage-detail">{{ stage.detail }}</span>
          </div>
          <a-progress :percent="stage.percent" :show-info="false" :status="stage.barStatus" size="small" />
        </div>
        <p>可以关闭弹窗，处理会继续。完成后，文档列表中的向量化状态会变为已完成。</p>
      </div>
      <div class="doc-footer">
        <span v-if="!createdId" class="footer-hint">{{ revectorizing ? '确定后删除旧向量，再分片、向量化并入库' : '确定后开始分片、向量化并入库' }}</span>
        <a-button @click="close">{{ createdId ? '关闭' : '取消' }}</a-button>
        <a-button v-if="!createdId" type="primary" :loading="saving" :disabled="!chunks.length" @click="onConfirm">确定</a-button>
      </div>
    </div>
  </a-modal>
</template>

<style scoped lang="less">
.doc-body {
  max-height: 68vh;
  overflow: auto;
  padding-right: 4px;
}

.upload-icon {
  margin-bottom: 8px;
  color: #3a67e8;
  font-size: 28px;
}

.upload-hint,
.split-hint,
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

.split-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: flex-end;
  margin-top: 16px;
}

.field-label {
  margin-bottom: 6px;
  color: #5c657a;
  font-size: 13px;
}

.split-hint {
  margin: 8px 0 0;
}

.chunk-panel {
  margin-top: 12px;
}

.chunk-text {
  :deep(textarea) {
    min-height: calc(1.5715em * 12 + 8px);
  }
}

.vector-box {
  margin-top: 16px;
  padding: 12px 14px;
  background: #f8fafc;
  border: 1px solid #e6ebf2;
  border-radius: 8px;

  p {
    margin: 12px 0 0;
  }
}

.vector-head {
  margin-bottom: 12px;
}

.stage + .stage {
  margin-top: 10px;
}

.stage-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2px;
  font-size: 13px;
}

.stage-name {
  display: inline-flex;
  gap: 8px;
  align-items: center;
}

.stage-mark {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  color: #5c657a;
  font-size: 12px;
  line-height: 1;
  background: #eef1f6;

  :deep(.anticon) {
    font-size: 10px;
  }
}

.stage-detail {
  color: #8b93a7;
  font-variant-numeric: tabular-nums;
}

.stage.is-wait {
  .stage-name,
  .stage-detail {
    color: #8b93a7;
  }
}

.stage.is-active {
  .stage-name {
    color: #3a67e8;
    font-weight: 600;
  }

  .stage-mark {
    color: #fff;
    background: #3a67e8;
  }
}

.stage.is-finish .stage-mark {
  color: #389e0d;
  background: #e8f7ee;
}

.stage.is-error {
  .stage-name,
  .stage-detail {
    color: #cf1322;
  }

  .stage-mark {
    color: #cf1322;
    background: #fff1f0;
  }
}

.stage :deep(.ant-progress) {
  margin: 0;
  line-height: 1;
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

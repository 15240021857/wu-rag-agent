<script setup lang="ts">
import { fetchConversations, fetchConversation, fetchDocuments, fetchKnowledges, deleteConversation, sendChat } from '@/api/rag'
import ChatAnswer from '@/components/rag/ChatAnswer.vue'
import DocumentModal from '@/components/rag/DocumentModal.vue'
import KnowledgeModal from '@/components/rag/KnowledgeModal.vue'
import { clauseBody, leadingHeadings } from '@/components/rag/renderAnswer'
import type { ChatMessage, Citation, ConversationSummary, Knowledge } from '@/types/rag'
import { formatDateTime } from '@/utils/format'
import { DeleteOutlined, FileAddOutlined, FilePdfOutlined, FileTextOutlined, PlusOutlined } from '@ant-design/icons-vue'
import { message, Modal } from 'ant-design-vue'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

const DEFAULT_PROMPT = '你是企业知识库助手。根据资料回答，资料没有的兜底回答在资料中没找到相关内容，回答里用资料编号标注依据。'

const knowledges = ref<Knowledge[]>([])
const conversations = ref<ConversationSummary[]>([])
const messages = ref<ChatMessage[]>([])
const knowledgeId = ref('')
const systemPrompt = ref(DEFAULT_PROMPT)
const draft = ref('')
const activeId = ref('')
const asking = ref(false)
const historyLoading = ref(false)
const knowledgeOpen = ref(false)
const documentOpen = ref(false)
const processingCount = ref(0)
const messageBox = ref<HTMLElement>()
const citeOpen = ref(false)
const activeCite = ref<Citation | null>(null)
const citeNo = ref(0)
let skipKnowledgeWatch = false
let pollTimer = 0

const knowledgeOptions = computed(() => knowledges.value.map((item) => ({ label: item.name, value: item.id })))
const citeHeadings = computed(() => leadingHeadings(activeCite.value?.content ?? ''))
const citeText = computed(() => clauseBody(activeCite.value?.content ?? ''))

watch(
  knowledgeId,
  () => {
    if (skipKnowledgeWatch) return
    activeId.value = ''
    messages.value = []
    void refreshProcessing()
  },
  { flush: 'sync' },
)

watch(processingCount, (count) => {
  stopPoll()
  if (count <= 0) return
  pollTimer = window.setInterval(() => {
    void refreshProcessing()
  }, 800)
})

async function loadKnowledges() {
  const page = await fetchKnowledges({ pageNum: 1, pageSize: 200, name: '' })
  knowledges.value = page.list
  if (!knowledgeId.value && page.list[0]) knowledgeId.value = page.list[0].id
}

async function loadConversations() {
  historyLoading.value = true
  try {
    conversations.value = await fetchConversations()
  } finally {
    historyLoading.value = false
  }
}

async function refreshProcessing() {
  if (!knowledgeId.value) {
    processingCount.value = 0
    return
  }
  try {
    const page = await fetchDocuments({
      pageNum: 1,
      pageSize: 1,
      knowledgeId: knowledgeId.value,
      fileName: '',
      vectorStatus: 'PROCESSING',
    })
    processingCount.value = page.total
  } catch {
    processingCount.value = 0
  }
}

async function openConversation(id: string) {
  const detail = await fetchConversation(id)
  skipKnowledgeWatch = true
  knowledgeId.value = detail.knowledgeId
  systemPrompt.value = detail.systemPrompt || DEFAULT_PROMPT
  activeId.value = detail.id
  messages.value = detail.messages
  skipKnowledgeWatch = false
  await scrollBottom()
  void refreshProcessing()
}

function createBlank() {
  activeId.value = ''
  messages.value = []
  draft.value = ''
}

function onPressEnter(event: KeyboardEvent) {
  if (event.shiftKey || event.isComposing) return
  event.preventDefault()
  void send()
}

async function send() {
  const content = draft.value.trim()
  if (!content || asking.value) return
  if (!knowledgeId.value) {
    message.warning('请选择知识库')
    return
  }
  const history = [
    ...messages.value.map((item) => ({ role: item.role, content: item.content })),
    { role: 'user' as const, content },
  ]
  messages.value = [...messages.value, { role: 'user', content }, { role: 'assistant', content: '' }]
  draft.value = ''
  asking.value = true
  let started = false
  let failedBeforeText = false
  let savedId = ''
  await scrollBottom()
  try {
    await sendChat(
      {
        conversationId: activeId.value || undefined,
        knowledgeId: knowledgeId.value,
        systemPrompt: systemPrompt.value.trim(),
        messages: history,
      },
      (event) => {
        if (event.kind === 'citations') {
          setCitations(event.citations)
          void scrollBottom()
          return
        }
        if (event.kind === 'text') {
          if (event.text) started = true
          appendAnswer(event.text)
          void scrollBottom()
          return
        }
        if (event.kind === 'error') {
          message.error(event.message)
          if (!started) failedBeforeText = true
          return
        }
        if (event.kind === 'conversation') {
          savedId = event.conversationId
          activeId.value = event.conversationId
        }
      },
    )
    if (failedBeforeText) {
      messages.value = messages.value.slice(0, -2)
      draft.value = content
      return
    }
    if (savedId) await loadConversations()
    await scrollBottom()
  } catch {
    if (!started) {
      messages.value = messages.value.slice(0, -2)
      draft.value = content
    }
  } finally {
    asking.value = false
  }
}

function appendAnswer(text: string) {
  const next = messages.value.slice()
  const last = next[next.length - 1]
  if (!last || last.role !== 'assistant') return
  next[next.length - 1] = { ...last, content: last.content + text }
  messages.value = next
}

function setCitations(citations: Citation[]) {
  const next = messages.value.slice()
  const last = next[next.length - 1]
  if (!last || last.role !== 'assistant') return
  next[next.length - 1] = { ...last, citations }
  messages.value = next
}

function openCite(cite: Citation, index: number) {
  activeCite.value = cite
  citeNo.value = index
  citeOpen.value = true
}

function isPdf(name: string) {
  return name.toLowerCase().endsWith('.pdf')
}

function removeHistory(id: string) {
  const current = conversations.value.find((item) => item.id === id)
  Modal.confirm({
    title: `删除对话「${current?.title ?? ''}」？`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      await deleteConversation(id)
      if (activeId.value === id) createBlank()
      await loadConversations()
    },
  })
}

async function onKnowledgeSaved(item: Knowledge) {
  await loadKnowledges()
  knowledgeId.value = item.id
}

async function scrollBottom() {
  await nextTick()
  const box = messageBox.value
  if (box) box.scrollTop = box.scrollHeight
}

function stopPoll() {
  if (!pollTimer) return
  window.clearInterval(pollTimer)
  pollTimer = 0
}

onMounted(() => {
  void loadKnowledges()
  void loadConversations()
})

onUnmounted(stopPoll)
</script>

<template>
  <div class="chat-page">
    <section class="panel">
      <h3>智能体编排</h3>
      <div class="field-label">知识库</div>
      <div class="kb-row">
        <a-select
          v-model:value="knowledgeId"
          class="kb-select"
          show-search
          option-filter-prop="label"
          placeholder="请选择知识库"
          :options="knowledgeOptions"
        />
        <a-tooltip title="新增知识库">
          <a-button v-auth="'rag:knowledge:create'" type="text" @click="knowledgeOpen = true">
            <PlusOutlined />
          </a-button>
        </a-tooltip>
        <a-tooltip title="新增文档">
          <a-button v-auth="'rag:document:create'" type="text" @click="documentOpen = true">
            <FileAddOutlined />
          </a-button>
        </a-tooltip>
      </div>
      <a-alert
        v-if="processingCount > 0"
        class="processing-alert"
        type="info"
        show-icon
        :message="`${processingCount} 个文档正在向量化，完成后即可用于问答`"
      />
      <div class="field-label prompt-label">系统提示词</div>
      <a-textarea v-model:value="systemPrompt" class="prompt" :maxlength="2000" placeholder="描述助手该如何回答" />
    </section>
    <section class="panel">
      <header class="panel-head">
        <h3>对话历史</h3>
        <a-button type="link" size="small" @click="createBlank">新对话</a-button>
      </header>
      <div class="history-list">
        <a-spin :spinning="historyLoading">
          <div
            v-for="item in conversations"
            :key="item.id"
            class="history-item"
            :class="{ 'is-active': item.id === activeId }"
            @click="openConversation(item.id)"
          >
            <div>
              <strong>{{ item.title }}</strong>
              <span>{{ item.knowledgeName }}</span>
              <em>{{ formatDateTime(item.updatedAt) }}</em>
            </div>
            <a-button type="text" size="small" @click.stop="removeHistory(item.id)">
              <DeleteOutlined />
            </a-button>
          </div>
          <a-empty v-if="!historyLoading && !conversations.length" description="还没有对话" />
        </a-spin>
      </div>
    </section>
    <section class="panel qa">
      <header class="qa-head">
        <h3>问答</h3>
      </header>
      <div ref="messageBox" class="messages">
        <a-empty v-if="!messages.length && !asking" description="选择知识库后开始提问，回答会附带引用" />
        <div v-for="(item, index) in messages" :key="`${index}-${item.role}`" class="message" :class="item.role">
          <ChatAnswer
            v-if="item.role === 'assistant'"
            :content="item.content"
            :citations="item.citations"
            :pending="asking && index === messages.length - 1 && !item.content"
            @open="openCite"
          />
          <div v-else class="bubble">{{ item.content }}</div>
        </div>
      </div>
      <div class="composer">
        <a-textarea
          v-model:value="draft"
          :rows="3"
          :maxlength="2000"
          placeholder="输入问题，Enter 发送，Shift + Enter 换行"
          @press-enter="onPressEnter"
        />
        <a-button class="send" type="primary" :loading="asking" :disabled="!draft.trim()" @click="send">发送</a-button>
      </div>
    </section>
    <a-drawer v-model:open="citeOpen" title="引用来源" placement="right" :width="560" destroy-on-close>
      <div v-if="activeCite" class="origin">
        <div class="origin-file">
          <span class="file-badge" :class="{ pdf: isPdf(activeCite.documentName) }">
            <FilePdfOutlined v-if="isPdf(activeCite.documentName)" />
            <FileTextOutlined v-else />
          </span>
          <div class="origin-meta">
            <div class="origin-name">
              <span class="origin-no">[{{ citeNo }}]</span>
              <strong>{{ activeCite.documentName }}</strong>
            </div>
            <div v-if="citeHeadings.length" class="crumbs">
              <template v-for="(heading, headingIndex) in citeHeadings" :key="`${heading}-${headingIndex}`">
                <span v-if="headingIndex" class="crumb-sep">/</span>
                <span class="crumb" :class="{ 'is-last': headingIndex === citeHeadings.length - 1 }">{{ heading }}</span>
              </template>
            </div>
          </div>
        </div>
        <article class="origin-text">{{ citeText }}</article>
      </div>
    </a-drawer>
    <KnowledgeModal v-model:open="knowledgeOpen" @saved="onKnowledgeSaved" />
    <DocumentModal v-model:open="documentOpen" :knowledge-id="knowledgeId" @saved="refreshProcessing" />
  </div>
</template>

<style scoped lang="less">
.chat-page {
  display: grid;
  grid-template-columns: 300px 260px minmax(0, 1fr);
  gap: 12px;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.panel {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  padding: 14px;
  background: #fff;
  border-radius: 8px;

  h3 {
    margin: 0 0 12px;
    font-size: 15px;
  }
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;

  h3 {
    margin-bottom: 0;
  }
}

.field-label {
  margin-bottom: 6px;
  color: #5c657a;
  font-size: 13px;
}

.kb-row {
  display: flex;
  gap: 4px;
  align-items: center;
}

.kb-select {
  flex: 1;
  min-width: 0;
}

.processing-alert {
  margin-top: 10px;
}

.prompt-label {
  margin-top: 14px;
}

.prompt {
  flex: 1;
  min-height: 160px;

  :deep(textarea) {
    height: 100%;
    resize: none;
  }
}

.history-list {
  flex: 1;
  margin-top: 8px;
  overflow: auto;
}

.history-item {
  display: flex;
  gap: 4px;
  align-items: flex-start;
  width: 100%;
  margin-bottom: 8px;
  padding: 8px;
  text-align: left;
  background: #fff;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  cursor: pointer;

  strong,
  span,
  em {
    display: block;
  }

  strong {
    margin-bottom: 2px;
  }

  span,
  em {
    color: #8b93a7;
    font-size: 12px;
    font-style: normal;
  }

  &.is-active {
    background: #f4f7ff;
    border-color: #d6e2ff;
  }
}

.qa {
  min-width: 0;
  padding: 0;
  overflow: hidden;
  background: #f5f7f6;
}

.qa-head {
  padding: 14px 16px 0;

  h3 {
    margin: 0;
  }
}

.messages {
  flex: 1;
  min-height: 0;
  padding: 16px;
  overflow: auto;
}

.message {
  display: flex;
  margin-bottom: 16px;

  &.user {
    justify-content: flex-end;
  }

  &.assistant {
    justify-content: flex-start;
  }
}

.bubble {
  max-width: min(72%, 520px);
  padding: 10px 14px;
  color: #fff;
  white-space: pre-wrap;
  word-break: break-word;
  background: #178f62;
  border-radius: 14px 14px 4px 14px;
  box-shadow: 0 6px 16px rgba(23, 143, 98, 0.16);
}

.composer {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: end;
  padding: 12px 16px 16px;
  background: #fff;
  border-top: 1px solid #e8eeea;

  :deep(textarea) {
    padding: 10px 12px;
    border-radius: 10px;
  }
}

.send {
  height: 40px;
  padding: 0 18px;
  border-radius: 8px;

  &:not(:disabled) {
    background: #178f62;
    border-color: #178f62;

    &:hover {
      background: #127a54;
      border-color: #127a54;
    }
  }
}

.origin-file {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  margin-bottom: 18px;
  padding: 14px;
  background: #f7f8fa;
  border-radius: 12px;
}

.file-badge {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  color: #178f62;
  font-size: 18px;
  background: #e8f7f0;
  border-radius: 10px;

  &.pdf {
    color: #e25c4a;
    background: #fff1f0;
  }
}

.origin-meta {
  min-width: 0;
}

.origin-name {
  display: flex;
  gap: 6px;
  align-items: baseline;

  strong {
    color: #1f2430;
    font-size: 15px;
    line-height: 1.5;
    word-break: break-all;
  }
}

.origin-no {
  flex: none;
  color: #14915c;
  font-weight: 600;
}

.crumbs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  margin-top: 8px;
}

.crumb,
.crumb-sep {
  color: #8b93a7;
  font-size: 12px;
}

.crumb.is-last {
  color: #14915c;
}

.origin-text {
  color: #3d4654;
  font-size: 14px;
  line-height: 1.9;
  white-space: pre-wrap;
  word-break: break-word;
}

@media (max-width: 1200px) {
  .chat-page {
    grid-template-columns: 1fr;
    height: auto;
    overflow: visible;
  }

  .panel {
    min-height: 360px;
  }
}
</style>

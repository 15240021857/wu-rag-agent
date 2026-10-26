<script setup lang="ts">
import { addDynamicRoutes, firstLeafPath } from '@/router/dynamic'
import { useUserStore } from '@/stores/user'
import { LockOutlined, SafetyCertificateOutlined, UserOutlined, WechatOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const REMEMBER_KEY = 'rag_remember_username'
const remembered = localStorage.getItem(REMEMBER_KEY)

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const loading = ref(false)
const form = reactive({
  username: remembered || 'chenmy',
  password: '',
  remember: true,
})

function soon(name: string) {
  message.info(`${name}暂未开通`)
}

async function onSubmit() {
  if (!form.username || !form.password) {
    message.warning('请输入账号和密码')
    return
  }
  loading.value = true
  try {
    await userStore.login({ username: form.username.trim(), password: form.password })
    if (form.remember) localStorage.setItem(REMEMBER_KEY, form.username.trim())
    else localStorage.removeItem(REMEMBER_KEY)
    await userStore.fetchProfile()
    addDynamicRoutes(userStore.menus)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : firstLeafPath(userStore.menus)
    await router.replace(redirect || '/')
  } catch {
    // 错误提示由请求拦截器统一处理
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login">
    <section class="hero">
      <div class="network" aria-hidden="true">
        <svg viewBox="0 0 800 900" preserveAspectRatio="xMidYMid slice">
          <g stroke="rgba(110,176,255,0.45)" stroke-width="1.2" fill="none">
            <path d="M80 140 L210 220 L160 360 L40 300 Z" />
            <path d="M210 220 L360 160 L470 280 L320 390 L160 360 Z" />
            <path d="M470 280 L640 180 L720 320 L560 410 Z" />
            <path d="M320 390 L560 410 L610 560 L430 620 L250 500 Z" />
            <path d="M40 300 L160 360 L250 500 L90 560 Z" />
            <path d="M610 560 L760 640 L680 780 L480 740 L430 620 Z" />
            <path d="M90 560 L250 500 L430 620 L300 760 L120 700 Z" />
          </g>
          <g fill="#7ec8ff">
            <circle cx="80" cy="140" r="4" />
            <circle cx="210" cy="220" r="5" />
            <circle cx="360" cy="160" r="4" />
            <circle cx="470" cy="280" r="5" />
            <circle cx="640" cy="180" r="4" />
            <circle cx="720" cy="320" r="4" />
            <circle cx="160" cy="360" r="5" />
            <circle cx="320" cy="390" r="4" />
            <circle cx="560" cy="410" r="5" />
            <circle cx="40" cy="300" r="3" />
            <circle cx="250" cy="500" r="5" />
            <circle cx="430" cy="620" r="5" />
            <circle cx="610" cy="560" r="4" />
            <circle cx="760" cy="640" r="4" />
            <circle cx="680" cy="780" r="4" />
            <circle cx="480" cy="740" r="4" />
            <circle cx="90" cy="560" r="4" />
            <circle cx="300" cy="760" r="4" />
            <circle cx="120" cy="700" r="3" />
          </g>
        </svg>
      </div>
      <div class="hero-inner">
        <div class="logo">
          <span>R</span>
          <div>
            <strong>知识中枢 RAG</strong>
            <p>企业知识库问答管理系统</p>
          </div>
        </div>
        <div class="slogan">
          <h1>让企业知识 随问随答</h1>
          <p>
            基于 RAG 检索增强的私有化知识问答平台，统一沉淀制度、产品与业务文档，为每个问题提供可追溯的引用来源。
          </p>
          <div class="stats">
            <article>
              <strong>--</strong>
              <span>知识库</span>
            </article>
            <article>
              <strong>--</strong>
              <span>文档</span>
            </article>
            <article>
              <strong>--%</strong>
              <span>采纳率</span>
            </article>
          </div>
        </div>
        <footer>私有化部署 · 数据不出内网 · 支持 JeeSite 权限体系</footer>
      </div>
    </section>
    <section class="panel">
      <form class="card" @submit.prevent="onSubmit">
        <h2>账号登录</h2>
        <p class="welcome">欢迎回来，请使用企业统一账号登录</p>
        <label class="xw-form__label">
          <span class="xw-form__label-text">账号</span>
          <a-input v-model:value="form.username" size="large" placeholder="请输入账号" autocomplete="username">
            <template #prefix><UserOutlined /></template>
          </a-input>
        </label>
        <label class="xw-form__label">
          <span class="xw-form__label-text">密码</span>
          <a-input-password
            v-model:value="form.password"
            size="large"
            placeholder="请输入密码"
            autocomplete="current-password"
          >
            <template #prefix><LockOutlined /></template>
          </a-input-password>
        </label>
        <div class="assist">
          <a-checkbox v-model:checked="form.remember" class="remember-checkbox">记住账号</a-checkbox>
          <button type="button" class="link" @click="soon('找回密码')">忘记密码?</button>
        </div>
        <a-button type="primary" size="large" block html-type="submit" :loading="loading">登录</a-button>
        <a-divider>企业身份认证</a-divider>
        <div class="idp">
          <a-button block @click="soon('统一身份 SSO')">
            <SafetyCertificateOutlined />
            统一身份 SSO
          </a-button>
          <a-button block @click="soon('企业微信扫码')">
            <WechatOutlined />
            企业微信扫码
          </a-button>
        </div>
        <p class="hint">演示账号 chenmy / manager / staff，密码均为 123456</p>
        <footer>
          <p>首次登录须修改初始密码，连续 5 次错误将锁定 30 分钟。</p>
          <p>© 2024 知识中枢科技有限公司 技术支持 信息技术部</p>
        </footer>
      </form>
    </section>
  </div>
</template>

<style scoped lang="less">
.login {
  display: grid;
  grid-template-columns: minmax(420px, 1.05fr) minmax(420px, 0.95fr);
  min-height: 100vh;
  background: #fff;
}

.hero {
  position: relative;
  overflow: hidden;
  color: #fff;
  background:
    radial-gradient(circle at 20% 20%, rgba(70, 140, 255, 0.35), transparent 32%),
    radial-gradient(circle at 80% 70%, rgba(40, 110, 255, 0.28), transparent 36%),
    linear-gradient(160deg, #071433 0%, #0c2d78 48%, #123f96 100%);
}

.network {
  position: absolute;
  inset: 0;
  opacity: 0.9;

  svg {
    width: 100%;
    height: 100%;
  }
}

.hero-inner {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 100%;
  padding: 36px 48px 28px;
}

.logo {
  display: flex;
  gap: 12px;
  align-items: center;

  span {
    display: grid;
    width: 36px;
    height: 36px;
    place-items: center;
    color: #3a67e8;
    font-weight: 700;
    background: #fff;
    border-radius: 10px;
  }

  strong {
    display: block;
    font-size: 16px;
  }

  p {
    margin: 2px 0 0;
    color: rgba(255, 255, 255, 0.72);
    font-size: 12px;
  }
}

.slogan {
  max-width: 560px;
  margin-bottom: 12vh;

  h1 {
    margin: 0 0 16px;
    font-size: 40px;
    font-weight: 650;
    letter-spacing: 1px;
  }

  p {
    margin: 0;
    color: rgba(255, 255, 255, 0.78);
    font-size: 14px;
    line-height: 1.8;
  }
}

.stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin-top: 28px;

  article {
    padding: 16px 18px;
    background: rgba(8, 24, 68, 0.38);
    border: 1px solid rgba(148, 188, 255, 0.28);
    border-radius: 12px;
    backdrop-filter: blur(8px);
  }

  strong {
    display: block;
    font-size: 26px;
  }

  span {
    color: rgba(255, 255, 255, 0.7);
    font-size: 13px;
  }
}

.hero footer,
.card footer {
  color: rgba(255, 255, 255, 0.62);
  font-size: 12px;
}

.panel {
  display: grid;
  place-items: center;
  padding: 32px 24px;
}

.card {
  width: min(420px, 100%);

  h2 {
    margin: 0;
    font-size: 28px;
  }
}

.welcome {
  margin: 8px 0 28px;
  color: #8b93a7;
}

.xw-form__label {
  display: block;
  margin-bottom: 16px;

  .xw-form__label-text {
    display: block;
    margin-bottom: 8px;
    color: #3c4458;
    font-size: 13px;
  }
}

.assist {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
  .remember-checkbox {
    display: flex;
  }
}

.link {
  padding: 0;
  color: #3a67e8;
  background: transparent;
  border: 0;
  cursor: pointer;
}

.idp {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.hint {
  margin: 14px 0 0;
  color: #8b93a7;
  font-size: 12px;
  text-align: center;
}

.card footer {
  margin-top: 36px;
  color: #98a0b3;
  text-align: center;

  p {
    margin: 4px 0;
  }
}

@media (max-width: 960px) {
  .login {
    grid-template-columns: 1fr;
  }

  .hero {
    min-height: 420px;
  }

  .slogan h1 {
    font-size: 32px;
  }
}
</style>

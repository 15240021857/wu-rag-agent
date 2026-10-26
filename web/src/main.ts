import { setupAuthDirective } from '@/directives/auth'
import router from '@/router'
import { useUserStore } from '@/stores/user'
import { setUnauthorizedHandler } from '@/utils/request'
import Antd from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import './styles/global.less'

dayjs.locale('zh-cn')

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(Antd)
setupAuthDirective(app)

setUnauthorizedHandler(() => {
  useUserStore().clearSession()
  if (router.currentRoute.value.path !== '/login') void router.replace('/login')
})

app.mount('#app')

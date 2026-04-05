import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import Antd from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css'
import * as Icons from '@ant-design/icons-vue'

import App from './App.vue'
import routes from './routes'

const app = createApp(App)

const router = createRouter({
  history: createWebHistory(),
  routes
})

app.use(router)
app.use(Antd)

// 注册所有图标
for (const [key, component] of Object.entries(Icons)) {
  app.component(key, component)
}

app.mount('#app')

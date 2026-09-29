import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'

import App from './App.vue'
import router from './router'
import './styles/main.scss'
import { installShortcutDispatcher, installDialogEnterConfirm } from './composables/useShortcuts'

const app = createApp(App)

// 统一快捷键派发器（必须最早安装：捕获阶段、先于各组件自己的按键监听）
installShortcutDispatcher()
// 确认弹窗回车 = 点「确定」
installDialogEnterConfirm()

// 注册 Element Plus 图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.use(createPinia())
app.use(router)
app.use(ElementPlus)

app.mount('#app')

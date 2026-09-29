<template>
  <div class="app-layout">
    <!-- 标签导航 -->
    <nav class="app-tabs">
      <router-link
        v-for="tab in tabs"
        :key="tab.path"
        :to="tab.path"
        class="tab-item"
        :class="{ active: route.path === tab.path }"
      >
        <el-icon class="tab-icon"><component :is="tab.icon" /></el-icon>
        <span class="tab-label">{{ tab.label }}</span>
      </router-link>
    </nav>

    <!-- 主内容区：左侧栏 + 右侧内容 -->
    <div class="main-wrapper">
      <!-- 包一层 relative：拖拽条贴的是宿主容器右缘，不包会锚到视口右缘去 -->
      <div class="sidebar-wrap">
        <GlobalSidebar :width="sidebarWidth" />
        <ResizableSplitter
          direction="horizontal"
          :on-drag="onSidebarDrag"
        />
      </div>
      <main class="app-main">
        <router-view v-slot="{ Component }">
          <transition name="fade-transform" mode="out-in">
            <keep-alive :include="['BootView', 'UDSView', 'FunctionView', 'CANView', 'CreateCanoeView', 'SanbaoView']">
              <component :is="Component" />
            </keep-alive>
          </transition>
        </router-view>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useModuleStore } from '@/stores/modules'
import { useShortcut } from '@/composables/useShortcuts'
import {
  Cpu,
  Sunny,
  Moon,
  Lightning,
  Connection,
  Setting,
  Promotion,
  Files,
  Tickets,
} from '@element-plus/icons-vue'
import GlobalSidebar from '@/components/GlobalSidebar.vue'
import ResizableSplitter from '@/components/ResizableSplitter.vue'
import { useResizableSize } from '@/composables/useResizableSize'

const route = useRoute()
const store = useModuleStore()
const isDark = ref(false)

// 参数顺序是 (key, 默认值, 最小值, 最大值)。原来写成 280, 400, 600，
// 最小值 400 比默认值 280 还大 → 一旦拖动就被夹到 400 以上，再也拉不回 280。
const [sidebarWidth, setSidebarWidth] = useResizableSize('global-sidebar', 280, 240, 600)
function onSidebarDrag(delta: number) {
  setSidebarWidth(sidebarWidth.value + delta)
}

const tabs = [
  { path: '/boot', label: 'Boot', icon: Lightning },
  { path: '/uds', label: 'UDS', icon: Connection },
  { path: '/function', label: 'Function', icon: Setting },
  { path: '/can', label: 'CAN', icon: Promotion },
  { path: '/create-canoe', label: 'Creat CANoe', icon: Files },
  { path: '/sanbao', label: '三包', icon: Tickets },
]

function toggleTheme() {
  isDark.value = !isDark.value
  document.documentElement.classList.toggle('dark', isDark.value)
}

onMounted(() => {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  if (prefersDark) {
    isDark.value = true
    document.documentElement.classList.add('dark')
  }
  
  updateActiveModule()
})

watch(() => route.path, () => {
  updateActiveModule()
})

function updateActiveModule() {
  const moduleName = route.path.replace('/', '').replace('-', '_') as 'boot' | 'uds' | 'function' | 'can' | 'create_canoe' | 'sanbao'
  if (tabs.some(t => t.path === route.path)) {
    store.setActiveModule(moduleName)
  }
}

// ---------- 全局快捷键：Ctrl+1..6 切换模块、Ctrl+F 聚焦当前模块搜索框 ----------
const router = useRouter()
tabs.forEach((tab, i) => {
  useShortcut({
    id: `global:module${i + 1}`,
    keys: `Ctrl+${i + 1}`,
    scope: 'global',
    desc: `切换到 ${tab.label}`,
    // 明确：即使在输入框里按 Ctrl+数字 也切模块（不会影响文本输入）
    allowInInput: true,
    run: () => {
      if (route.path === tab.path) return false
      router.push(tab.path)
      return true
    },
  })
})
useShortcut({
  id: 'global:focusSearch',
  keys: 'Ctrl+F',
  scope: 'global',
  desc: '聚焦当前模块的搜索框',
  allowInInput: true,
  run: () => {
    // 仅挑当前可见的搜索框（其余模块被 keep-alive 缓存，不可见）
    const el = Array.from(document.querySelectorAll<HTMLElement>('[data-shortcut-search]')).find(
      (x) => x.getClientRects().length > 0 && !(x as HTMLInputElement).disabled,
    )
    if (!el) return false
    el.focus()
    ;(el as HTMLInputElement).select?.()
    return true
  },
})
</script>

<style scoped lang="scss">
.app-layout {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 1024px;
}

/* ---------- 标签导航 ---------- */
.app-tabs {
  height: var(--tab-height);
  background: var(--bg-card);
  border-bottom: 1px solid var(--border-color-light);
  display: flex;
  align-items: center;
  padding: 0 16px;
  gap: 2px;
  flex-shrink: 0;
}

.tab-item {
  display: flex;
  align-items: center;
  gap: 5px;
  height: 100%;
  padding: 0 14px;
  font-size: 14px;
  color: var(--text-regular);
  border-bottom: 2px solid transparent;
  transition: var(--transition-base);
  position: relative;

  .tab-icon {
    font-size: 16px;
  }

  &:hover {
    color: var(--color-primary);
  }

  &.active {
    color: var(--color-primary);
    border-bottom-color: var(--color-primary);
    font-weight: 600;
  }
}

/* ---------- 主内容区 ---------- */
.main-wrapper {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.sidebar-wrap {
  position: relative;
  flex-shrink: 0;
  display: flex;
  min-height: 0;
}

.app-main {
  flex: 1;
  padding: 10px 16px;
  overflow-y: auto;
  background: var(--bg-page);
}
</style>

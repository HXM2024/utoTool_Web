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
  // 默认浅色主题：不再跟随系统 prefers-color-scheme 自动切深色。
  // 原因：图形化配置编辑器（CaseFrameCanvas / StepEditor / DockLayout 等）的自绘样式是浅色设计，
  // 而外壳切深色时两者的控件配色会打架（白面板 + 黑按钮 / 深色滚动条滑道）。一律从浅色开始，
  // 需要深色再手动切换（toggleTheme）。
  updateActiveModule()
  // 继电器配置（Function / CAN / 三包 共用的 CAN 通道 + 继电器模块）存后端，
  // 启动时拉一次，避免刷新后回落默认值
  store.loadRelayConfig()
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

// 切换模块前的守卫：当前模块若有「未保存的配置改动」，由该模块注册的守卫弹窗询问
// （保存 / 不保存）；用户关闭弹窗 → 守卫返回 false → 取消本次导航，留在当前模块。
// 视图被 keep-alive 缓存，注册的守卫在切走期间依然有效。
router.beforeEach(async (to) => {
  if (!tabs.some((t) => t.path === to.path)) return true
  const target = to.path.replace('/', '').replace('-', '_')
  if (target === store.activeModule) return true
  return await store.runModuleLeaveGuard(store.activeModule)
})

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

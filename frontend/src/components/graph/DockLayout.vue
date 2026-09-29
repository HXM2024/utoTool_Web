<template>
  <div class="dock-layout" :class="node.kind === 'split' ? (node.dir === 'column' ? 'dl-column' : 'dl-row') : ''">
    <!-- tab 分组 -->
    <div v-if="node.kind === 'tab'" class="dl-tab" :data-tab-group="node.id">
      <div v-if="tabList.length > 1" class="dl-tabbar">
        <div
          v-for="tid in tabList"
          :key="tid"
          class="dl-tab-item"
          :class="{ active: activeTab === tid }"
          @mousedown.stop
          @click="activate(tid)"
        >
          {{ titleOf(tid) }}
        </div>
      </div>
      <div class="dl-tab-body">
        <DockPanel
          v-if="activeTab"
          :key="activeTab"
          :panel-id="activeTab"
          :title="titleOf(activeTab)"
          :help="helpOf(activeTab)"
          :floating="false"
          :dragging="draggingId === activeTab"
          @drag-start="emit('drag-start', activeTab)"
        >
          <PanelBody :panel-id="activeTab" />
        </DockPanel>
      </div>
    </div>

    <!-- 分栏 -->
    <template v-else-if="node.kind === 'split'">
      <template v-for="(child, i) in children" :key="child.id">
        <div class="dl-child" :style="childStyle(i)">
          <DockLayout
            :node="child"
            :panels="panels"
            :dragging-id="draggingId"
            @drag-start="emit('drag-start', $event)"
            @activate="emit('activate', $event)"
          />
        </div>
        <div
          v-if="i < children.length - 1"
          class="dl-resizer"
          :class="node.dir === 'column' ? 'dl-resizer-h' : 'dl-resizer-v'"
          @mousedown="onResizeStart($event, i)"
        />
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import DockPanel from './DockPanel.vue'
import PanelBody from './PanelBody.vue'

export interface LayoutNode {
  id: string
  kind: 'tab' | 'split'
  tabs?: string[]
  active?: string
  dir?: 'row' | 'column'
  ratios?: number[]
  children?: LayoutNode[]
}

const props = defineProps<{
  node: LayoutNode
  panels: Record<string, { title: string; help?: string }>
  draggingId?: string
}>()
const emit = defineEmits<{
  (e: 'drag-start', id: string): void
  (e: 'activate', id: string): void
}>()

function titleOf(id: string): string {
  return props.panels[id]?.title ?? id
}
function helpOf(id: string): string {
  return props.panels[id]?.help ?? ''
}
const tabList = computed<string[]>(() => props.node.tabs ?? [])
const activeTab = computed<string | null>(() => {
  const tabs = tabList.value
  if (!tabs.length) return null
  return props.node.active && tabs.includes(props.node.active) ? props.node.active : tabs[0]
})
const children = computed(() => props.node.children ?? [])
function activate(id: string) {
  emit('activate', id)
}

function ensureRatios(): number[] {
  const n = children.value.length
  if (!props.node.ratios || props.node.ratios.length !== n) {
    props.node.ratios = new Array(n).fill(1)
  }
  return props.node.ratios
}
function childStyle(i: number) {
  const ratios = ensureRatios()
  const g = ratios[i] ?? 1
  return { flexGrow: g, flexBasis: 0, flexShrink: 1, minWidth: 0, minHeight: 0 }
}
function onResizeStart(e: MouseEvent, i: number) {
  e.preventDefault()
  const dir = props.node.dir === 'column' ? 'column' : 'row'
  const container = (e.currentTarget as HTMLElement).parentElement as HTMLElement
  const rect = container.getBoundingClientRect()
  const total = dir === 'row' ? rect.width : rect.height
  const ratios = ensureRatios()
  const g1 = ratios[i] ?? 1
  const g2 = ratios[i + 1] ?? 1
  const S = g1 + g2
  const startPos = dir === 'row' ? e.clientX : e.clientY
  const min = 0.3

  // mousemove 合并到下一帧：每移动一次就改 ratios 会让整棵停靠子树 + 画布一起重渲染，
  // 而画布尺寸变化又会触发它自己的 ResizeObserver → 全量重算连线
  let raf = 0
  let pending = 0
  const apply = () => {
    raf = 0
    const dg = total > 0 ? (pending / total) * S : 0
    let ng1 = g1 + dg
    let ng2 = g2 - dg
    if (ng1 < min) {
      ng1 = min
      ng2 = S - min
    }
    if (ng2 < min) {
      ng2 = min
      ng1 = S - min
    }
    ratios[i] = ng1
    ratios[i + 1] = ng2
  }
  const onMove = (ev: MouseEvent) => {
    pending = (dir === 'row' ? ev.clientX : ev.clientY) - startPos
    if (!raf) raf = requestAnimationFrame(apply)
  }
  const onUp = () => {
    // 收尾：把最后一次移动落地，避免松手时丢掉几像素
    if (raf) {
      cancelAnimationFrame(raf)
      apply()
    }
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }
  document.body.style.cursor = dir === 'row' ? 'col-resize' : 'row-resize'
  document.body.style.userSelect = 'none'
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}
</script>

<style scoped>
.dock-layout {
  width: 100%;
  height: 100%;
  display: flex;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
.dock-layout.dl-row {
  flex-direction: row;
}
.dock-layout.dl-column {
  flex-direction: column;
}
.dl-child {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
.dl-resizer {
  flex: 0 0 5px;
  background: transparent;
  transition: background 0.12s;
  z-index: 2;
}
.dl-resizer:hover,
.dl-resizer:active {
  background: var(--el-color-primary);
}
.dl-resizer-v {
  cursor: col-resize;
}
.dl-resizer-h {
  cursor: row-resize;
}
.dl-tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
.dl-tabbar {
  display: flex;
  gap: 2px;
  padding: 2px;
  background: #ebeef5;
  flex-shrink: 0;
  border-radius: 4px 4px 0 0;
  overflow-x: auto;
}
.dl-tab-item {
  font-size: 12px;
  padding: 3px 10px;
  cursor: pointer;
  color: #606266;
  border-radius: 3px;
  user-select: none;
  white-space: nowrap;
  flex-shrink: 0;
}
.dl-tab-item:hover {
  color: var(--el-color-primary);
}
.dl-tab-item.active {
  background: #fff;
  color: var(--el-color-primary);
  font-weight: 600;
}
.dl-tab-body {
  flex: 1;
  min-height: 0;
  display: flex;
  overflow: hidden;
}
.dl-tab-body > :deep(.dock-panel) {
  flex: 1;
}
</style>

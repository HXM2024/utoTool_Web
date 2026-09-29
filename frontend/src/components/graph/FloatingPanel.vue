<template>
  <div
    class="floating-panel"
    :class="{ 'fp-dragging': !!dragging }"
    :style="{
      left: x + 'px',
      top: y + 'px',
      width: width + 'px',
      height: height + 'px',
    }"
  >
    <div class="fp-header" @mousedown="onHeaderDown">
      <span class="fp-title">{{ title }}</span>
      <span class="fp-hint">拖到边缘停靠 · 拖到中心浮动</span>
      <el-icon class="fp-close" title="关闭" @click.stop="emit('close')"><Close /></el-icon>
    </div>
    <div class="fp-body">
      <slot />
    </div>
    <div class="fp-resize" title="拖拽调整大小" @mousedown.stop="onResizeDown" />
  </div>
</template>

<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import { Close } from '@element-plus/icons-vue'

const props = defineProps<{
  x: number
  y: number
  width: number
  height: number
  title: string
}>()
const emit = defineEmits<{
  (e: 'update:x', v: number): void
  (e: 'update:y', v: number): void
  (e: 'update:width', v: number): void
  (e: 'update:height', v: number): void
  (e: 'drag-start'): void
  (e: 'drag-move', pos: { x: number; y: number }): void
  (e: 'drag-end', pos: { x: number; y: number }): void
  (e: 'close'): void
}>()

const dragging = ref<{ startX: number; startY: number; originX: number; originY: number } | null>(null)
const resizing = ref<{ startX: number; startY: number; startW: number; startH: number } | null>(null)

function onHeaderDown(e: MouseEvent) {
  dragging.value = { startX: e.clientX, startY: e.clientY, originX: props.x, originY: props.y }
  emit('drag-start')
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onDragUp)
}
function onMove(e: MouseEvent) {
  if (!dragging.value) return
  const dx = e.clientX - dragging.value.startX
  const dy = e.clientY - dragging.value.startY
  emit('update:x', dragging.value.originX + dx)
  emit('update:y', dragging.value.originY + dy)
  emit('drag-move', { x: e.clientX, y: e.clientY })
}
function onDragUp(e: MouseEvent) {
  dragging.value = null
  window.removeEventListener('mousemove', onMove)
  window.removeEventListener('mouseup', onDragUp)
  emit('drag-end', { x: e.clientX, y: e.clientY })
}

function onResizeDown(e: MouseEvent) {
  resizing.value = { startX: e.clientX, startY: e.clientY, startW: props.width, startH: props.height }
  window.addEventListener('mousemove', onResizeMove)
  window.addEventListener('mouseup', onResizeUp)
}
function onResizeMove(e: MouseEvent) {
  if (!resizing.value) return
  const w = Math.max(240, resizing.value.startW + (e.clientX - resizing.value.startX))
  const h = Math.max(160, resizing.value.startH + (e.clientY - resizing.value.startY))
  emit('update:width', w)
  emit('update:height', h)
}
function onResizeUp() {
  resizing.value = null
  window.removeEventListener('mousemove', onResizeMove)
  window.removeEventListener('mouseup', onResizeUp)
}

onUnmounted(() => {
  window.removeEventListener('mousemove', onMove)
  window.removeEventListener('mouseup', onDragUp)
  window.removeEventListener('mousemove', onResizeMove)
  window.removeEventListener('mouseup', onResizeUp)
})
</script>

<style scoped>
.floating-panel {
  position: absolute;
  display: flex;
  flex-direction: column;
  background: #fff;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.16);
  overflow: hidden;
  z-index: 20;
}
.fp-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #f5f7fa;
  border-bottom: 1px solid #ebeef5;
  cursor: move;
  user-select: none;
  flex-shrink: 0;
}
.fp-title {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
}
.fp-hint {
  flex: 1;
  margin-left: 8px;
  font-size: 11px;
  color: #909399;
  font-weight: 400;
}
.floating-panel.fp-dragging {
  opacity: 0.85;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.24);
}
.fp-close {
  cursor: pointer;
  color: #909399;
  font-size: 14px;
}
.fp-close:hover { color: #f56c6c; }
.fp-body {
  flex: 1;
  overflow: hidden;
  min-height: 0;
}
.fp-resize {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 16px;
  height: 16px;
  cursor: nwse-resize;
}
.fp-resize::after {
  content: '';
  position: absolute;
  right: 3px;
  bottom: 3px;
  width: 8px;
  height: 8px;
  border-right: 2px solid #c0c4cc;
  border-bottom: 2px solid #c0c4cc;
}
</style>

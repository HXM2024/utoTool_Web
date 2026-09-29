<template>
  <div
    class="dock-panel"
    :class="{ 'dp-floating': floating, 'dp-dragging': dragging }"
    :style="floating ? floatingStyle : undefined"
    :data-panel-id="panelId"
  >
    <div class="dp-header" @mousedown="onHeaderDown">
      <div class="dp-title-group">
        <span class="dp-title">{{ title }}</span>
        <el-tooltip v-if="help" placement="bottom" :content="help">
          <el-icon class="dp-btn dp-help" @mousedown.stop @click.stop><QuestionFilled /></el-icon>
        </el-tooltip>
      </div>
      <span class="dp-actions">
        <el-icon v-if="closable" class="dp-btn dp-close" title="关闭" @mousedown.stop @click="emit('close')">
          <Close />
        </el-icon>
      </span>
    </div>
    <div class="dp-body">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Close, QuestionFilled } from '@element-plus/icons-vue'

const props = defineProps<{
  title: string
  help?: string
  floating: boolean
  closable?: boolean
  panelId?: string
  dragging?: boolean
  x?: number
  y?: number
  width?: number
  height?: number
}>()
const emit = defineEmits<{
  (e: 'drag-start'): void
  (e: 'close'): void
}>()

const floatingStyle = computed(() => ({
  left: `${props.x ?? 0}px`,
  top: `${props.y ?? 0}px`,
  width: `${props.width ?? 360}px`,
  height: `${props.height ?? 480}px`,
}))

function onHeaderDown(e: MouseEvent) {
  if ((e.target as HTMLElement).closest('.dp-btn')) return
  emit('drag-start')
}
</script>

<style scoped>
.dock-panel {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  background: #fff;
  overflow: hidden;
}
.dp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
  background: #f5f7fa;
  border-bottom: 1px solid #ebeef5;
  cursor: move;
  user-select: none;
  flex-shrink: 0;
}
.dp-title {
  font-size: 12px;
  font-weight: 600;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dp-title-group {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  min-width: 0;
}
.dp-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  margin-left: 6px;
}
.dp-btn {
  cursor: pointer;
  color: #909399;
  font-size: 14px;
  flex-shrink: 0;
}
.dp-help {
  font-size: 14px;
}
.dp-help:hover {
  color: var(--el-color-primary);
}
.dp-btn:hover {
  color: var(--el-color-primary);
}
.dp-close:hover {
  color: #f56c6c;
}
.dp-body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.dock-panel.dp-floating {
  position: absolute;
  z-index: 30;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.18);
}
.dock-panel.dp-dragging {
  opacity: 0.9;
  pointer-events: none;
}
</style>

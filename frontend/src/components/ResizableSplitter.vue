<template>
  <div
    class="resizable-splitter"
    :class="['splitter-' + direction, 'splitter-side-' + (side || 'start'), { active: isDragging, 'with-toggle': showToggle }]"
    @mousedown="onMouseDown"
  >
    <div
      v-if="showToggle"
      class="splitter-toggle"
      @click.stop="onToggleClick"
    />
    <span v-if="direction === 'horizontal'" class="grip" />
    <span v-else class="grip vertical" />
  </div>
</template>

<script setup lang="ts">
import { ref, onBeforeUnmount } from 'vue'

defineOptions({ name: 'ResizableSplitter' })

interface Props {
  /** 'horizontal' = 拖动改变左右容器宽度; 'vertical' = 拖动改变上下容器高度 */
  direction: 'horizontal' | 'vertical'
  /** 拖动回调，传入像素位移 delta（向右/下为正） */
  onDrag?: (delta: number) => void
  /** 是否显示折叠/展开按钮 */
  showToggle?: boolean
  /** 折叠按钮图标组件 */
  toggleIcon?: any
  /**
   * 拖拽条吸附在哪一侧：
   * 'start' = 贴宿主容器右缘（左侧栏 / 左侧分栏用，默认）；
   * 'end'   = 贴宿主容器左缘（右侧面板用）。
   * 宿主容器必须有 position: relative，否则会锚到视口上。
   */
  side?: 'start' | 'end'
}

const props = defineProps<Props>()
const emit = defineEmits<{ toggle: [] }>()

function onToggleClick() {
  emit('toggle')
}

const isDragging = ref(false)
let startX = 0
let startY = 0

function onMouseDown(e: MouseEvent) {
  e.preventDefault()
  e.stopPropagation()
  isDragging.value = true
  startX = e.clientX
  startY = e.clientY

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
  document.body.style.userSelect = 'none'
  document.body.style.cursor = props.direction === 'horizontal' ? 'col-resize' : 'row-resize'
}

/** 拖拽期间累计的位移：mousemove 合并到下一帧，一帧最多回调一次 onDrag
 *  （每回调一次都会改面板宽度 → 触发面板重渲染） */
let pendingDelta = 0
let dragRaf = 0

function flushDrag() {
  dragRaf = 0
  const d = pendingDelta
  pendingDelta = 0
  if (d) props.onDrag?.(d)
}

function onMouseMove(e: MouseEvent) {
  if (!isDragging.value) return
  pendingDelta += props.direction === 'horizontal' ? e.clientX - startX : e.clientY - startY
  startX = e.clientX
  startY = e.clientY
  if (!dragRaf) dragRaf = requestAnimationFrame(flushDrag)
}

function onMouseUp() {
  // 收尾：把最后一次移动落地，避免松手时丢掉几像素
  if (dragRaf) {
    cancelAnimationFrame(dragRaf)
    dragRaf = 0
    flushDrag()
  }
  isDragging.value = false
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
  document.body.style.userSelect = ''
  document.body.style.cursor = ''
}

onBeforeUnmount(() => {
  if (dragRaf) {
    cancelAnimationFrame(dragRaf)
    dragRaf = 0
  }
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
  document.body.style.userSelect = ''
  document.body.style.cursor = ''
})
</script>

<style scoped lang="scss">
.resizable-splitter {
  flex-shrink: 0;
  position: absolute;
  background: transparent;
  z-index: 5;
  transition: background 0.15s;

  &.splitter-horizontal {
    width: 6px;
    cursor: col-resize;
    right: -3px;
    top: 0;
    bottom: 0;

    &.splitter-side-end {
      right: auto;
      left: -3px;
    }

    &.with-toggle {
      width: 22px;
      right: -11px;
    }

    &.with-toggle.splitter-side-end {
      right: auto;
      left: -11px;
    }

    .grip {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 2px;
      height: 32px;
      background: var(--border-color-light);
      border-radius: 1px;
    }
  }

  &.splitter-vertical {
    position: relative;
    height: 6px;
    cursor: row-resize;
    margin: -3px 0;
    width: 100%;

    .grip.vertical {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 32px;
      height: 2px;
      background: var(--border-color-light);
      border-radius: 1px;
    }
  }

  &:hover,
  &.active {
    background: rgba(79, 70, 229, 0.08);

    .grip,
    .grip.vertical {
      background: var(--color-primary);
    }
  }

  .splitter-toggle {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 22px;
    height: 48px;
    cursor: pointer;
    background: var(--bg-card);
    border: 1px solid var(--border-color-light);
    border-radius: var(--radius-small);
    z-index: 10;
    box-shadow: var(--shadow-card);
    transition: var(--transition-base);

    &::before {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 2px;
      height: 10px;
      background: var(--text-secondary);
      transition: var(--transition-base);
    }

    &:hover {
      border-color: var(--color-primary);

      &::before {
        background: var(--color-primary);
      }
    }
  }
}
</style>

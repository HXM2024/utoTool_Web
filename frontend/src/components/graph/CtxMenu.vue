<template>
  <teleport to="body">
    <div
      v-if="visible"
      class="ctx-mask"
      @mousedown.stop.prevent="close"
      @contextmenu.prevent.stop="close"
      @wheel="close"
    />
    <div v-if="visible" class="ctx-menu" :style="style" @mousedown.stop.prevent @contextmenu.prevent.stop>
      <div
        v-for="it in items"
        :key="it.key"
        class="ctx-item"
        :class="{ danger: it.danger }"
        @click="pick(it)"
      >
        {{ it.label }}
      </div>
    </div>
  </teleport>
</template>

<script lang="ts">
/** 右键菜单项 */
export interface CtxMenuItem {
  key: string
  label: string
  /** 危险操作（删除等）用红色 */
  danger?: boolean
}
</script>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'

const visible = ref(false)
const x = ref(0)
const y = ref(0)
const items = ref<CtxMenuItem[]>([])
/** 打开菜单时携带的数据，选中某项时原样回传（避免调用方再记一份“当前行”） */
const payload = ref<unknown>(null)

const emit = defineEmits<{
  (e: 'select', key: string, payload: unknown): void
}>()

const style = computed(() => ({ left: `${x.value}px`, top: `${y.value}px` }))

/** Esc 关闭：遮罩铺满全屏，留一个键盘退出通道，避免菜单意外卡住挡住操作 */
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}
/** 在鼠标位置打开菜单（自动避开视口右/下边缘） */
function open(e: MouseEvent, list: CtxMenuItem[], data: unknown = null) {
  items.value = list
  payload.value = data
  const w = 168
  const h = list.length * 30 + 8
  x.value = Math.min(e.clientX, Math.max(0, window.innerWidth - w - 4))
  y.value = Math.min(e.clientY, Math.max(0, window.innerHeight - h - 4))
  visible.value = true
  window.addEventListener('keydown', onKeydown, true)
}
function close() {
  visible.value = false
  window.removeEventListener('keydown', onKeydown, true)
}
function pick(it: CtxMenuItem) {
  close()
  emit('select', it.key, payload.value)
}
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown, true))

defineExpose({ open, close })
</script>

<style scoped>
.ctx-mask {
  position: fixed;
  inset: 0;
  z-index: 4000;
}
.ctx-menu {
  position: fixed;
  z-index: 4001;
  min-width: 168px;
  padding: 4px;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.14);
}
.ctx-item {
  padding: 6px 10px;
  font-size: 12px;
  color: #303133;
  border-radius: 4px;
  cursor: pointer;
  white-space: nowrap;
}
.ctx-item:hover {
  background: #ecf5ff;
  color: var(--el-color-primary);
}
.ctx-item.danger {
  color: var(--el-color-danger);
}
.ctx-item.danger:hover {
  background: #fef0f0;
}
</style>

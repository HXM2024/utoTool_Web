<template>
  <div class="sanbao-test-case-list">
    <div class="tc-header">
      <span class="tc-title">测试用例</span>
      <span class="tc-count">{{ cases.length }} 个</span>
    </div>

    <div
      class="tc-drop-zone"
      :class="{ 'drag-over': isDragOver }"
      @dragover.prevent="onDragOver"
      @dragenter.prevent="isDragOver = true"
      @dragleave.prevent="onDragLeave"
      @drop="onDrop"
    >
      <div v-if="!cases.length" class="tc-empty">
        <el-icon class="tc-empty-icon"><FolderAdd /></el-icon>
        <div>暂无测试用例</div>
        <div class="tc-empty-sub">在「用例序列」输入名称后用「保存」下拉保存，或从左侧「用例库」拖拽用例到此新建</div>
      </div>

      <div v-else class="tc-list">
        <div
          v-for="item in cases"
          :key="item.id"
          class="tc-card"
          :class="{ 'tc-active': item.id === activeId }"
          @click="emit('load', item)"
          @contextmenu.prevent="openMenu($event, item)"
        >
          <div class="tc-card-head">
            <el-icon class="tc-icon"><Document /></el-icon>
            <span class="tc-card-name" :title="item.name">{{ item.name }}</span>
          </div>
          <div class="tc-card-meta">{{ stepsCount(item.steps) }} 步</div>
        </div>
      </div>
    </div>

    <!-- 右击菜单 -->
    <teleport to="body">
      <div
        v-if="menu.visible"
        class="tc-context-menu"
        :style="{ left: menu.x + 'px', top: menu.y + 'px' }"
      >
        <div class="tc-menu-item" @click="onSaveAsLibrary">
          <el-icon><FolderAdd /></el-icon><span>保存为用例库</span>
        </div>
        <div class="tc-menu-item" @click="onRename">
          <el-icon><Edit /></el-icon><span>重命名</span>
        </div>
        <div class="tc-menu-item danger" @click="onDelete">
          <el-icon><Delete /></el-icon><span>删除</span>
        </div>
      </div>
    </teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Document, FolderAdd, Edit, Delete } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { CaseLibraryItem } from './SanbaoCaseLibrary.vue'
import type { SequenceStep } from './SanbaoSequenceEditor.vue'

const props = defineProps<{
  cases: CaseLibraryItem[]
  activeId?: string
}>()
const emit = defineEmits<{
  load: [CaseLibraryItem]
  'save-as-library': [CaseLibraryItem]
  'update:cases': [CaseLibraryItem[]]
}>()

const isDragOver = ref(false)
const menu = ref<{ visible: boolean; x: number; y: number; item: CaseLibraryItem | null }>({
  visible: false,
  x: 0,
  y: 0,
  item: null,
})

function genId() {
  return 'case-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7)
}
function genStepId() {
  return 'step-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7)
}
/** 深拷贝序列并重新分配 id，避免与已有步骤 id 冲突 */
function cloneSteps(steps: SequenceStep[] = []): SequenceStep[] {
  return steps.map((s) => {
    const c: SequenceStep = { ...s, id: genStepId(), params: { ...(s.params || {}) } }
    if (s.type === 'loop' && s.children) c.children = cloneSteps(s.children)
    return c
  })
}

function stepsCount(steps: SequenceStep[]): number {
  let n = 0
  const walk = (list: SequenceStep[]) => {
    for (const s of list) {
      n += 1
      if (s.type === 'loop' && s.children) walk(s.children)
    }
  }
  walk(steps || [])
  return n
}

function onDragOver(event: DragEvent) {
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
}
function onDragLeave(event: DragEvent) {
  const zone = event.currentTarget as HTMLElement
  if (!event.relatedTarget || !zone.contains(event.relatedTarget as Node)) {
    isDragOver.value = false
  }
}
function onDrop(event: DragEvent) {
  event.preventDefault()
  isDragOver.value = false
  const json = event.dataTransfer?.getData('application/json')
  if (!json) return
  try {
    const payload = JSON.parse(json)
    if (payload.type !== 'case') return
    emit('update:cases', [
      ...props.cases,
      { id: genId(), name: payload.name || '用例', steps: cloneSteps(payload.steps || []) },
    ])
    ElMessage.success(`已新建测试用例：${payload.name}`)
  } catch {
    /* ignore */
  }
}

function openMenu(event: MouseEvent, item: CaseLibraryItem) {
  menu.value = { visible: true, x: event.clientX, y: event.clientY, item }
}
function closeMenu() {
  menu.value.visible = false
}

function onSaveAsLibrary() {
  const item = menu.value.item
  closeMenu()
  if (item) emit('save-as-library', item)
}
function onRename() {
  const item = menu.value.item
  closeMenu()
  if (!item) return
  ElMessageBox.prompt('请输入新的用例名称', '重命名用例', {
    inputValue: item.name,
    inputPattern: /\S+/,
    inputErrorMessage: '名称不能为空',
  })
    .then(({ value }) => {
      emit(
        'update:cases',
        props.cases.map((c) => (c.id === item.id ? { ...c, name: value.trim() } : c)),
      )
      ElMessage.success('已重命名')
    })
    .catch(() => {})
}
function onDelete() {
  const item = menu.value.item
  closeMenu()
  if (!item) return
  ElMessageBox.confirm(`确认删除测试用例「${item.name}」？`, '提示', { type: 'warning' })
    .then(() => {
      emit('update:cases', props.cases.filter((c) => c.id !== item.id))
      ElMessage.success('已删除')
    })
    .catch(() => {})
}

onMounted(() => document.addEventListener('click', closeMenu))
onUnmounted(() => document.removeEventListener('click', closeMenu))
</script>

<style scoped lang="scss">
.sanbao-test-case-list {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-card);
  border-radius: 12px;
  padding: 10px;
  overflow: hidden;
}

.tc-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.tc-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.tc-count {
  font-size: 11px;
  color: var(--text-color-secondary);
  flex: 1;
}

.tc-drop-zone {
  flex: 1;
  overflow-y: auto;
  border: 2px dashed var(--border-color-light);
  border-radius: 6px;
  padding: 8px;
  transition: border-color 0.2s, background 0.2s;
}

.tc-drop-zone.drag-over {
  border-color: var(--color-primary);
  background: rgba(64, 158, 255, 0.04);
}

.tc-empty {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-color-secondary);
  text-align: center;
  gap: 6px;
  padding: 0 8px;
}

.tc-empty-icon {
  font-size: 28px;
  opacity: 0.4;
}

.tc-empty-sub {
  font-size: 10px;
  opacity: 0.8;
  line-height: 1.5;
}

.tc-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tc-card {
  background: var(--bg-page);
  border: 1px solid var(--border-color-light);
  border-radius: 6px;
  padding: 6px 8px;
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s;

  &:hover {
    border-color: var(--color-primary);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }
}

.tc-card.tc-active {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 1.5px var(--color-primary);
}

.tc-card-head {
  display: flex;
  align-items: center;
  gap: 6px;
}

.tc-icon {
  color: var(--color-primary);
  font-size: 13px;
}

.tc-card-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tc-card-meta {
  font-size: 10px;
  color: var(--text-color-secondary);
  margin-top: 2px;
  padding-left: 19px;
}

.tc-context-menu {
  position: fixed;
  z-index: 3000;
  min-width: 150px;
  background: var(--bg-card, #fff);
  border: 1px solid var(--border-color-light, #e4e7ed);
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.16);
  padding: 4px;
}

.tc-menu-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  font-size: 12px;
  color: var(--text-primary);
  border-radius: 4px;
  cursor: pointer;

  &:hover {
    background: var(--bg-page, #f5f7fa);
    color: var(--color-primary);
  }

  &.danger:hover {
    color: var(--color-danger, #f56c6c);
  }
}
</style>

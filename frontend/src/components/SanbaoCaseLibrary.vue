<template>
  <div class="sanbao-case-library">
    <div class="library-header">
      <span class="library-title">用例库</span>
      <span class="library-count">{{ cases.length }} 个用例</span>
    </div>
    <div class="library-tip">拖拽用例到右侧「测试用例」列表或中间序列框复用；用例由「测试用例」右击保存而来</div>

    <div class="case-list">
      <div
        v-for="item in cases"
        :key="item.id"
        class="case-card"
        draggable="true"
        @dragstart="onDragStart($event, item)"
        @dblclick="onRename(item)"
      >
        <div class="case-card-head">
          <el-icon class="case-icon"><Files /></el-icon>
          <span class="case-card-name" :title="item.name">{{ item.name }}</span>
          <div class="case-card-actions">
            <el-button text size="small" :icon="Edit" @click.stop="onRename(item)" />
            <el-button text size="small" :icon="Delete" @click.stop="onDelete(item.id)" />
          </div>
        </div>
        <div class="case-card-meta">{{ stepsCount(item.steps) }} 步</div>
      </div>
      <div v-if="!cases.length" class="empty-tip">
        用例库为空，在右侧「测试用例」列表右击用例选择「保存为用例库」
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Files, Edit, Delete } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { SequenceStep } from './SanbaoSequenceEditor.vue'

/** 用例库条目（用例=命名后的序列） */
export interface CaseLibraryItem {
  id: string
  name: string
  steps: SequenceStep[]
}

const props = defineProps<{ cases: CaseLibraryItem[] }>()
const emit = defineEmits<{ 'update:cases': [CaseLibraryItem[]] }>()

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

function onDragStart(event: DragEvent, item: CaseLibraryItem) {
  if (!event.dataTransfer) return
  event.dataTransfer.effectAllowed = 'copy'
  const payload = { type: 'case', id: item.id, name: item.name, steps: item.steps }
  event.dataTransfer.setData('application/json', JSON.stringify(payload))
  event.dataTransfer.setData('text/plain', item.name)
}

function onRename(item: CaseLibraryItem) {
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

function onDelete(id: string) {
  ElMessageBox.confirm('确认从用例库删除该用例？', '提示', { type: 'warning' })
    .then(() => {
      emit('update:cases', props.cases.filter((c) => c.id !== id))
      ElMessage.success('已删除')
    })
    .catch(() => {})
}
</script>

<style scoped lang="scss">
.sanbao-case-library {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-card);
  border-radius: 12px;
  padding: 12px;
  overflow: hidden;
}

.library-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.library-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.library-count {
  font-size: 11px;
  color: var(--text-color-secondary);
}

.library-tip {
  font-size: 11px;
  color: var(--text-color-secondary);
  margin-bottom: 10px;
  padding-left: 2px;
  line-height: 1.5;
}

.case-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.case-card {
  background: var(--bg-page);
  border: 1px solid var(--border-color-light);
  border-radius: 8px;
  padding: 8px 10px;
  cursor: grab;
  transition: border-color 0.2s, box-shadow 0.2s;

  &:hover {
    border-color: var(--color-primary);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }

  &:active {
    cursor: grabbing;
  }
}

.case-card-head {
  display: flex;
  align-items: center;
  gap: 6px;
}

.case-icon {
  color: var(--color-warning, #e6a23c);
  font-size: 14px;
}

.case-card-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.case-card-actions {
  display: flex;
  gap: 2px;
}

.case-card-meta {
  font-size: 11px;
  color: var(--text-color-secondary);
  margin-top: 2px;
  padding-left: 20px;
}

.empty-tip {
  text-align: center;
  color: var(--text-color-secondary);
  font-size: 12px;
  padding: 24px 8px;
  line-height: 1.6;
}
</style>

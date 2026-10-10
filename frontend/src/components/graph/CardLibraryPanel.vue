<template>
  <div class="card-library-panel">
    <div class="clp-header">
      <span class="clp-title">统一卡片库</span>
      <el-button size="small" :icon="Plus" type="primary" text @click="openEditor(null)" />
    </div>

    <el-tabs v-model="activeTab" class="clp-tabs" stretch>
      <el-tab-pane v-for="t in tabs" :key="t.value" :name="t.value">
        <template #label>
          <span class="tab-label" :class="`tab-${t.value}`">{{ t.label }}</span>
        </template>
        <div class="clp-list">
          <div
            v-for="card in cardsOf(activeTab)"
            :key="card.id"
            class="clp-card"
            :class="`clp-${card.type}`"
            draggable="true"
            @dragstart="onDragStart($event, card)"
            @dblclick="openEditor(card)"
          >
            <div class="clp-card-head">
              <span class="clp-name" :title="card.description || card.name">{{ card.name }}</span>
              <el-icon class="clp-edit" @click.stop="openEditor(card)"><Edit /></el-icon>
              <el-icon class="clp-del" @click.stop="removeCard(card)"><Close /></el-icon>
            </div>
            <div class="clp-steps">
              <span v-for="(s, i) in card.steps.slice(0, 3)" :key="s.id" class="step-chip">
                {{ STEP_KIND_LABEL[s.kind] }}
              </span>
              <span v-if="card.steps.length > 3" class="step-more">+{{ card.steps.length - 3 }}</span>
              <span v-if="!card.steps.length" class="step-none">无步骤</span>
            </div>
          </div>
          <div v-if="!cardsOf(activeTab).length" class="clp-empty">
            暂无{{ tabLabel(activeTab) }}卡片，点击右上角 + 新建
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>

    <CardEditor
      ref="cardEditorRef"
      :visible="editorVisible"
      :card="editingCard"
      :default-type="activeTab"
      :cards="cards"
      @update:visible="editorVisible = $event"
      @save="saveCard"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Plus, Edit, Close } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { Card, CardType, CardLibrary } from '@/types/functionGraph'
import { CARD_TYPE_LABEL, STEP_KIND_LABEL } from '@/utils/functionGraph'
import CardEditor from './CardEditor.vue'

const props = defineProps<{
  cards: CardLibrary
}>()
const emit = defineEmits<{
  (e: 'update:cards', cards: CardLibrary): void
}>()

const tabs: Array<{ value: CardType; label: string }> = [
  { value: 'inject', label: CARD_TYPE_LABEL.inject },
  { value: 'sequence', label: CARD_TYPE_LABEL.sequence },
  { value: 'result', label: CARD_TYPE_LABEL.result },
]
const activeTab = ref<CardType>('inject')

function tabLabel(v: CardType) {
  return CARD_TYPE_LABEL[v]
}
function cardsOf(type: CardType): Card[] {
  return props.cards[type] || []
}

const editorVisible = ref(false)
const editingCard = ref<Card | null>(null)
/** 卡片编辑器实例：切换编辑对象前用它做「有未保存修改 → 提示保存」的守卫 */
const cardEditorRef = ref<InstanceType<typeof CardEditor> | null>(null)

/** 打开编辑器。切换编辑对象前先过守卫：选保存且保存成功才切过去（取消/失败则留在当前卡片） */
async function openEditor(card: Card | null) {
  if (editorVisible.value && cardEditorRef.value) {
    const ok = await cardEditorRef.value.confirmBeforeSwitch()
    if (!ok) return
  }
  editingCard.value = card
  editorVisible.value = true
}

function saveCard(card: Card) {
  const next: CardLibrary = {
    inject: [...props.cards.inject],
    sequence: [...props.cards.sequence],
    result: [...props.cards.result],
  }
  const bucket = card.type
  const idx = next[bucket].findIndex((c) => c.id === card.id)
  if (idx >= 0) next[bucket][idx] = card
  else next[bucket].push(card)
  emit('update:cards', next)
  ElMessage.success(idx >= 0 ? '卡片已更新' : '卡片已新建')
}

function removeCard(card: Card) {
  ElMessageBox.confirm(`确认删除卡片「${card.name}」？`, '提示', { type: 'warning' })
    .then(() => {
      const next: CardLibrary = {
        inject: [...props.cards.inject],
        sequence: [...props.cards.sequence],
        result: [...props.cards.result],
      }
      next[card.type] = next[card.type].filter((c) => c.id !== card.id)
      emit('update:cards', next)
      ElMessage.success('卡片已删除')
    })
    .catch(() => {})
}

function onDragStart(event: DragEvent, card: Card) {
  if (!event.dataTransfer) return
  event.dataTransfer.effectAllowed = 'copy'
  event.dataTransfer.setData('application/x-graph-card', JSON.stringify(card))
  event.dataTransfer.setData('text/plain', card.name)
}
</script>

<style scoped>
.card-library-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: #fff;
}
.clp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border-bottom: 1px solid #ebeef5;
  flex-shrink: 0;
}
.clp-title {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
}
.clp-tabs {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  :deep(.el-tabs__header) {
    margin: 0;
    flex-shrink: 0;
  }
  :deep(.el-tabs__content) {
    flex: 1;
    overflow: hidden;
  }
  :deep(.el-tab-pane) {
    height: 100%;
  }
}
.tab-label {
  font-size: 12px;
}
.tab-inject { color: #e6a23c; }
.tab-sequence { color: var(--el-color-primary); }
.tab-result { color: #67c23a; }
.clp-list {
  height: 100%;
  overflow-y: auto;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.clp-card {
  border: 1px solid #ebeef5;
  border-radius: 6px;
  padding: 6px 8px;
  cursor: grab;
  background: #fff;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.clp-card:hover {
  border-color: var(--el-color-primary);
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.08);
}
.clp-card:active { cursor: grabbing; }
.clp-inject { border-left: 3px solid #e6a23c; }
.clp-sequence { border-left: 3px solid var(--el-color-primary); }
.clp-result { border-left: 3px solid #67c23a; }
.clp-card-head {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 4px;
}
.clp-name {
  flex: 1;
  font-size: 12px;
  font-weight: 600;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.clp-edit, .clp-del {
  cursor: pointer;
  color: #c0c4cc;
  font-size: 12px;
  flex-shrink: 0;
}
.clp-edit:hover { color: var(--el-color-primary); }
.clp-del:hover { color: #f56c6c; }
.clp-steps {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
}
.step-chip {
  font-size: 10px;
  color: #606266;
  background: #f5f7fa;
  padding: 1px 5px;
  border-radius: 3px;
}
.step-more {
  font-size: 10px;
  color: #909399;
}
.step-none {
  font-size: 10px;
  color: #c0c4cc;
  font-style: italic;
}
.clp-empty {
  text-align: center;
  color: #c0c4cc;
  font-size: 12px;
  padding: 20px 4px;
  line-height: 1.6;
}
</style>

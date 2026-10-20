<script setup lang="ts">
import { ref } from 'vue'
import { Card, StageType, STAGE_LABEL } from '../types'
import { saveToLibrary } from '../store'
import StepTable from './StepTable.vue'

const props = defineProps<{
  card: Card
  index: number
  total: number
  stage: StageType
}>()

const emit = defineEmits<{
  (e: 'insert-after'): void
  (e: 'remove'): void
  (e: 'drag-start', cardId: string): void
  (e: 'drag-over', cardId: string): void
  (e: 'drop', cardId: string): void
  (e: 'change'): void
}>()

const expanded = ref(true)

function onSaveToLibrary() {
  saveToLibrary(props.card)
}
</script>

<template>
  <div
    class="stage-card"
    :class="{ referenced: !!card.refId }"
    draggable="true"
    @dragstart="emit('drag-start', card.id)"
    @dragover.prevent="emit('drag-over', card.id)"
    @drop.prevent="emit('drop', card.id)"
  >
    <div class="card-head">
      <span class="drag-hint" title="拖拽排序">⠿</span>
      <input v-model="card.name" class="card-name" @input="emit('change')" />
      <span v-if="card.refId" class="ref-badge" title="引用自卡片库">↗库</span>
      <span class="badge">{{ STAGE_LABEL[stage] }}</span>
      <button class="mini toggle" @click="expanded = !expanded">{{ expanded ? '收起' : '展开' }}</button>
      <button class="mini save" title="保存到卡片库" @click="onSaveToLibrary">💾 入库</button>
      <button class="mini del" title="删除卡片" @click="emit('remove')">×</button>
    </div>
    <div v-if="expanded" class="card-body">
      <StepTable :steps="card.steps" @change="emit('change')" />
    </div>
  </div>
</template>

<style scoped>
.stage-card {
  background: #fff; border: 1px solid #e3e7ee; border-radius: 8px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.04); margin-bottom: 8px; overflow: hidden;
}
.stage-card.referenced { border-left: 3px solid #2563eb; }
.card-head {
  display: flex; align-items: center; gap: 5px; padding: 6px 8px;
  background: #fafbfd; border-bottom: 1px solid #eef0f4;
}
.drag-hint { color: #9ca3af; cursor: grab; }
.card-name { flex: 1; min-width: 60px; border: 1px solid transparent; border-radius: 5px; padding: 3px 6px; font-size: 13px; font-weight: 600; }
.card-name:hover { border-color: #d7dbe2; background: #fff; }
.badge { font-size: 11px; color: #6b7280; background: #f0f2f6; border-radius: 4px; padding: 1px 5px; white-space: nowrap; }
.ref-badge { font-size: 11px; color: #2563eb; background: #eef3ff; border-radius: 4px; padding: 1px 5px; white-space: nowrap; }
.mini { border: none; border-radius: 5px; font-size: 12px; padding: 3px 7px; white-space: nowrap; }
.mini.toggle { background: #f0f2f6; color: #374151; }
.mini.save { background: #eef3ff; color: #2563eb; }
.mini.del { background: #fdeaea; color: #dc2626; }
.card-body { padding: 8px; }
</style>

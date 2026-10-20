<script setup lang="ts">
import { ref } from 'vue'
import { CaseTrack, StageType, STAGE_LABEL, STAGE_ORDER } from '../types'
import { insertCard, removeCard, moveCard, removeTrack } from '../store'
import StageCard from './StageCard.vue'

const props = defineProps<{ track: CaseTrack }>()
const emit = defineEmits<{ (e: 'change'): void }>()

const dragId = ref<string | null>(null)
const overId = ref<string | null>(null)

function cardsOf(stage: StageType) {
  const s = props.track.stages.find((x) => x.type === stage)
  return s ? s.cards : []
}

function onInsertAfter(stage: StageType, index: number) {
  insertCard(props.track, stage, index)
  emit('change')
}

function onRemove(stage: StageType, cardId: string) {
  removeCard(props.track, stage, cardId)
  emit('change')
}

function onDrop(stage: StageType, targetId: string) {
  const from = dragId.value
  if (!from || from === targetId) { dragId.value = null; overId.value = null; return }
  const cards = cardsOf(stage)
  const fromIdx = cards.findIndex((c) => c.id === from)
  const toIdx = cards.findIndex((c) => c.id === targetId)
  if (fromIdx >= 0 && toIdx >= 0) moveCard(props.track, stage, fromIdx, toIdx)
  dragId.value = null
  overId.value = null
  emit('change')
}
</script>

<template>
  <div class="case-track">
    <div class="track-head">
      <input v-model="track.name" class="track-name" @input="emit('change')" placeholder="用例名" />
      <span class="case-count">{{ track.stages.reduce((n, s) => n + s.cards.length, 0) }} 卡片</span>
      <button class="mini del" title="删除用例" @click="removeTrack(track.id)">删除用例</button>
    </div>
    <div class="rail">
      <div v-for="stage in STAGE_ORDER" :key="stage" class="stage-col">
        <div class="stage-label">{{ STAGE_LABEL[stage] }}</div>
        <div class="stage-cards">
          <StageCard
            v-for="(card, i) in cardsOf(stage)"
            :key="card.id"
            :card="card"
            :index="i"
            :total="cardsOf(stage).length"
            :stage="stage"
            :class="{ 'drag-over': overId === card.id }"
            @insert-after="onInsertAfter(stage, i)"
            @remove="onRemove(stage, card.id)"
            @drag-start="dragId = $event"
            @drag-over="overId = $event"
            @drop="onDrop(stage, card.id)"
            @change="emit('change')"
          />
          <button
            v-if="cardsOf(stage).length === 0"
            class="plus-empty"
            @click="onInsertAfter(stage, -1)"
          >+ 添加卡片</button>
          <button
            v-else
            class="plus-between"
            @click="onInsertAfter(stage, cardsOf(stage).length - 1)"
          >＋ 插入卡片（并联分支）</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.case-track {
  background: #fff; border: 1px solid #e3e7ee; border-radius: 10px;
  padding: 10px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}
.track-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.track-name { font-size: 15px; font-weight: 700; border: 1px solid #d7dbe2; border-radius: 6px; padding: 5px 8px; flex: 1; }
.case-count { font-size: 12px; color: #6b7280; }
.mini.del { border: none; background: #fdeaea; color: #dc2626; border-radius: 5px; font-size: 12px; padding: 4px 8px; }
.rail { display: flex; gap: 10px; overflow-x: auto; }
.stage-col { flex: 1; min-width: 230px; background: #fafbfd; border: 1px dashed #d7dbe2; border-radius: 8px; padding: 6px; }
.stage-label { font-size: 12px; font-weight: 700; color: #6b7280; margin-bottom: 6px; text-align: center; }
.stage-cards { display: flex; flex-direction: column; }
.plus-empty, .plus-between {
  border: 1px dashed #b9c2d0; background: transparent; color: #2563eb;
  border-radius: 6px; font-size: 12px; padding: 8px; margin-top: 4px;
}
.plus-between { margin-top: 6px; }
.plus-empty:hover, .plus-between:hover { background: #eef3ff; }
</style>

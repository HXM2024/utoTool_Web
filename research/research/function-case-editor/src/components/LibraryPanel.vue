<script setup lang="ts">
import { ref } from 'vue'
import { ws, referenceFromLibrary } from '../store'
import { StageType, STAGE_LABEL } from '../types'

const emit = defineEmits<{ (e: 'change'): void }>()

const targetStage = ref<StageType>('sequence')

function refInto(stage: StageType, libId: string) {
  const track = ws.tracks[0]
  if (!track) return
  referenceFromLibrary(track, stage, libId)
  emit('change')
}
</script>

<template>
  <aside class="library">
    <h3>卡片库（引用式复用）</h3>
    <p class="hint">点击「引用」把卡片以引用方式加入当前用例，改库即全局同步。</p>
    <div v-if="ws.library.length === 0" class="empty">暂无卡片。在卡片上点「💾 入库」保存。</div>
    <div v-for="c in ws.library" :key="c.id" class="lib-card">
      <div class="lib-head">
        <span class="lib-name">{{ c.name || '未命名' }}</span>
        <span class="badge">{{ STAGE_LABEL[c.type] }}</span>
      </div>
      <div class="lib-steps">{{ c.steps.length }} 步骤</div>
      <select v-model="targetStage" class="lib-stage">
        <option value="inject">注入</option>
        <option value="sequence">序列</option>
        <option value="result">结果</option>
      </select>
      <button class="mini" @click="refInto(targetStage, c.id)">引用</button>
    </div>
  </aside>
</template>

<style scoped>
.library {
  width: 260px; background: #fff; border: 1px solid #e3e7ee; border-radius: 10px;
  padding: 12px; position: sticky; top: 12px; align-self: flex-start;
  max-height: calc(100vh - 24px); overflow-y: auto;
}
h3 { margin: 0 0 4px; font-size: 14px; }
.hint { font-size: 12px; color: #6b7280; margin: 0 0 10px; }
.empty { font-size: 12px; color: #9ca3af; padding: 10px 0; }
.lib-card { border: 1px solid #eef0f4; border-radius: 8px; padding: 8px; margin-bottom: 8px; }
.lib-head { display: flex; align-items: center; gap: 6px; }
.lib-name { font-weight: 600; font-size: 13px; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.badge { font-size: 11px; color: #6b7280; background: #f0f2f6; border-radius: 4px; padding: 1px 5px; }
.lib-steps { font-size: 12px; color: #9ca3af; margin: 4px 0; }
.lib-stage { font-size: 12px; border: 1px solid #d7dbe2; border-radius: 5px; padding: 3px 5px; }
.mini { border: none; background: #eef3ff; color: #2563eb; border-radius: 5px; font-size: 12px; padding: 3px 8px; margin-left: 4px; }
</style>

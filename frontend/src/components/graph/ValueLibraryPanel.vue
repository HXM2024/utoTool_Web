<template>
  <div class="value-library">
    <div class="vl-header">
      <span class="vl-title">值资源库</span>
      <el-button size="small" type="primary" plain :icon="Plus" @click="addResource">新增</el-button>
    </div>
    <div class="vl-list">
      <div
        v-for="(v, i) in values"
        :key="v.id"
        class="vl-item"
        draggable="true"
        @dragstart="onDragStart($event, v)"
      >
        <span class="vl-drag" title="拖拽到参数框">⠿</span>
        <el-select v-model="v.kind" size="small" class="vl-kind" @change="onKindChange(v)">
          <el-option label="常量" value="const" />
          <el-option label="列表" value="list" />
          <el-option label="区间" value="range" />
        </el-select>
        <el-input v-model="v.name" size="small" class="vl-name" placeholder="引用名" @change="commit" />

        <template v-if="v.kind === 'const'">
          <el-input v-model="constDraft[v.id]" size="small" class="vl-values" placeholder="常量值" @change="applyConst(v)" />
        </template>
        <template v-else-if="v.kind === 'list'">
          <el-input v-model="listDraft[v.id]" size="small" class="vl-values" placeholder="逗号分隔，如 10,50,161" @change="applyList(v)" />
        </template>
        <template v-else>
          <span class="vl-range">
            <el-input-number v-model="rangeDraft[v.id].from" size="small" :controls="false" placeholder="起" @change="applyRange(v)" />
            <el-input-number v-model="rangeDraft[v.id].to" size="small" :controls="false" placeholder="止" @change="applyRange(v)" />
            <el-input-number v-model="rangeDraft[v.id].step" size="small" :controls="false" placeholder="步" @change="applyRange(v)" />
          </span>
        </template>

        <el-button size="small" text :icon="Close" class="vl-del" @click="removeResource(i)" />
      </div>
      <div v-if="!values.length" class="vl-empty">暂无值资源，点击「新增」创建常量/列表/区间</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue'
import { Plus, Close } from '@element-plus/icons-vue'
import type { ValueResource } from '@/types/functionGraph'
import { genId } from '@/types/functionGraph'

const props = defineProps<{
  values: ValueResource[]
}>()
const emit = defineEmits<{
  (e: 'update:values', values: ValueResource[]): void
}>()

// 编辑草稿：list 逗号分隔文本、const 文本、range 数字
const constDraft = reactive<Record<string, string>>({})
const listDraft = reactive<Record<string, string>>({})
const rangeDraft = reactive<Record<string, { from: number; to: number; step: number }>>({})

function syncDrafts() {
  for (const v of props.values) {
    if (v.kind === 'const') {
      if (!(v.id in constDraft)) constDraft[v.id] = typeof v.values === 'string' ? v.values : ''
    } else if (v.kind === 'list') {
      if (!(v.id in listDraft)) listDraft[v.id] = Array.isArray(v.values) ? v.values.join(',') : ''
    } else {
      if (!(v.id in rangeDraft)) {
        const r = (typeof v.values === 'object' && v.values) ? (v.values as any) : { from: 0, to: 1, step: 1 }
        rangeDraft[v.id] = { from: r.from ?? 0, to: r.to ?? 1, step: r.step ?? 1 }
      }
    }
  }
}
// 只监听数组本身（增删/整体替换）：草稿只负责「补齐缺失项」，
// 用 deep 会把每次字段改动都做一次深度遍历，纯属浪费。
watch(() => props.values, syncDrafts, { immediate: true })

function commit() {
  emit('update:values', JSON.parse(JSON.stringify(props.values)))
}

// 切换类型时重置 values 结构并同步草稿
function onKindChange(v: ValueResource) {
  if (v.kind === 'const') {
    v.values = constDraft[v.id] ?? ''
  } else if (v.kind === 'list') {
    v.values = (listDraft[v.id] ?? '')
      .split(/[,，\s]+/)
      .map((s) => s.trim())
      .filter(Boolean)
  } else {
    v.values = { ...(rangeDraft[v.id] || { from: 0, to: 1, step: 1 }) }
  }
  syncDrafts()
  commit()
}

function applyConst(v: ValueResource) {
  v.values = constDraft[v.id] ?? ''
  commit()
}
function applyList(v: ValueResource) {
  const parts = (listDraft[v.id] ?? '')
    .split(/[,，\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
  v.values = parts
  commit()
}
function applyRange(v: ValueResource) {
  v.values = { ...rangeDraft[v.id] }
  commit()
}

function addResource() {
  const n = props.values.length + 1
  const v: ValueResource = { id: genId('val'), name: `value${n}`, kind: 'const', values: '', expand: 'split' }
  const next = [...props.values, v]
  emit('update:values', next)
  // 预填草稿，保证新建后立即进入可编辑状态
  constDraft[v.id] = ''
}

function removeResource(i: number) {
  const next = props.values.slice()
  const removed = next.splice(i, 1)[0]
  if (removed) {
    delete constDraft[removed.id]
    delete listDraft[removed.id]
    delete rangeDraft[removed.id]
  }
  emit('update:values', next)
}

function onDragStart(e: DragEvent, v: ValueResource) {
  if (!e.dataTransfer) return
  const ref = `@${v.kind}:${v.name}`
  e.dataTransfer.effectAllowed = 'copy'
  e.dataTransfer.setData('text/plain', ref)
  e.dataTransfer.setData('application/x-value-ref', JSON.stringify({ kind: v.kind, name: v.name, ref }))
}
</script>

<style scoped>
.value-library {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.vl-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  border-bottom: 1px solid #ebeef5;
  flex-shrink: 0;
}
.vl-title {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
}
.vl-list {
  flex: 1;
  overflow-y: auto;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.vl-item {
  display: flex;
  align-items: center;
  gap: 4px;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  padding: 4px 6px;
  background: #fff;
  cursor: default;
}
.vl-item:hover {
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.08);
}
.vl-drag {
  color: #c0c4cc;
  cursor: grab;
  font-size: 13px;
  flex-shrink: 0;
}
.vl-kind {
  width: 72px;
  flex-shrink: 0;
}
.vl-name {
  width: 90px;
  flex-shrink: 0;
}
.vl-values {
  flex: 1;
  min-width: 0;
}
.vl-range {
  display: flex;
  gap: 4px;
  flex: 1;
  min-width: 0;
}
.vl-range :deep(.el-input-number) {
  width: 56px;
}
.vl-del {
  flex-shrink: 0;
}
.vl-empty {
  color: #c0c4cc;
  font-size: 12px;
  text-align: center;
  padding: 16px 0;
}
</style>
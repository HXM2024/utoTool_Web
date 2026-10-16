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
        :class="{ 'vl-item-active': isRowSelected(i) }"
        draggable="true"
        @dragstart="onDragStart($event, v)"
        @click="onRowClick(i, $event)"
        @contextmenu.prevent.stop="openMenu($event, i)"
      >
        <span class="vl-drag" title="拖拽到参数框">⠿</span>
        <span v-if="v.global" class="vl-global" title="全局值资源：设为全局后自动同步到所有分组的值资源库">全局</span>
        <el-select v-model="v.kind" size="small" class="vl-kind" @change="onKindChange(v)">
          <el-option label="常量" value="const" />
          <el-option label="列表" value="list" />
          <el-option label="区间" value="range" />
        </el-select>
        <el-input
          v-model="v.name"
          size="small"
          class="vl-name"
          placeholder="引用名"
          :ref="(el: any) => setNameInputEl(v.id, el)"
          @change="commit"
        />

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

        <el-button size="small" text :icon="Close" class="vl-del" @click.stop="removeResource(i)" />
      </div>
      <div v-if="!values.length" class="vl-empty">暂无值资源，点击「新增」创建常量/列表/区间</div>
    </div>
    <CtxMenu ref="ctxMenu" @select="onMenuSelect" />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { Plus, Close } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import type { ValueResource } from '@/types/functionGraph'
import { genId } from '@/types/functionGraph'
import CtxMenu from './CtxMenu.vue'
import type { CtxMenuItem } from './CtxMenu.vue'

const props = defineProps<{
  values: ValueResource[]
}>()
const emit = defineEmits<{
  (e: 'update:values', values: ValueResource[]): void
  /** 右键「设为全局 / 取消全局」：只发意图（可批量），全局库同步由编辑器统一处理 */
  (e: 'toggle-global', items: ValueResource[], on: boolean): void
}>()

// ===== 行选中（右键批量操作 / Shift 范围选择）=====
const selRows = ref<number[]>([])
/** Shift 范围选择的锚点行 */
let anchorRow = -1
function isRowSelected(i: number): boolean {
  return selRows.value.includes(i)
}
/** 当前选中的值资源（按下标取，越界自动忽略） */
const selectedItems = computed<ValueResource[]>(() =>
  selRows.value.map((i) => props.values[i]).filter(Boolean) as ValueResource[],
)
function onRowClick(i: number, e?: MouseEvent) {
  if (e?.shiftKey && anchorRow >= 0 && anchorRow !== i) {
    const [lo, hi] = anchorRow < i ? [anchorRow, i] : [i, anchorRow]
    selRows.value = Array.from({ length: hi - lo + 1 }, (_, k) => lo + k)
    return
  }
  if (e && (e.ctrlKey || e.metaKey)) {
    selRows.value = selRows.value.includes(i) ? selRows.value.filter((x) => x !== i) : [...selRows.value, i]
  } else {
    selRows.value = [i]
  }
  anchorRow = i
}

// ===== 行右键菜单：设为全局 / 取消全局（右键行在多选里时作用于整批） =====
const ctxMenu = ref<InstanceType<typeof CtxMenu> | null>(null)
/** 右键作用的条目集合：右键行已在多选中 → 整批；否则只作用于该行（并把选中态切到它） */
function menuItems(i: number): ValueResource[] {
  if (selRows.value.length > 1 && selRows.value.includes(i)) {
    const picked = selectedItems.value
    if (picked.length) return picked
  }
  selRows.value = [i]
  anchorRow = i
  const only = props.values[i]
  return only ? [only] : []
}
function openMenu(e: MouseEvent, i: number) {
  const list = menuItems(i)
  if (!list.length) return
  const globals = list.filter((x) => x.global).length
  const items: CtxMenuItem[] = []
  if (globals < list.length) {
    items.push({ key: 'global', label: list.length > 1 ? `设为全局（${list.length - globals} 个）` : '设为全局' })
  }
  if (globals > 0) {
    // 已带「全局」标记的项再点「设为全局」会被过滤成空操作，所以单独给一个发布入口
    items.push({ key: 'republish', label: list.length > 1 ? `重新发布到所有分组（${globals} 个）` : '重新发布到所有分组' })
    items.push({ key: 'unglobal', label: list.length > 1 ? `取消全局（${globals} 个）` : '取消全局' })
  }
  ctxMenu.value?.open(e, items, list)
}
function onMenuSelect(key: string, payload: unknown) {
  const list = (payload as ValueResource[]) || []
  if (!list.length) return
  if (key === 'global') emit('toggle-global', list.filter((x) => !x.global), true)
  else if (key === 'republish') emit('toggle-global', list, true)
  else if (key === 'unglobal') emit('toggle-global', list.filter((x) => x.global), false)
}

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
  // 新增后自动聚焦「引用名」并全选，便于直接改名（默认名是 valueN）
  nextTick(() => {
    const inst = nameInputEls[v.id]
    const input = inst?.input || inst?.$el?.querySelector?.('input')
    if (input && typeof input.focus === 'function') {
      input.focus()
      input.select?.()
    }
  })
}

/** 引用名输入框实例（按值资源 id 存）：新增后自动聚焦 */
const nameInputEls: Record<string, any> = {}
function setNameInputEl(id: string, el: any) {
  if (el) nameInputEls[id] = el
}

function removeResource(i: number) {
  const next = props.values.slice()
  const removed = next.splice(i, 1)[0]
  if (removed) {
    delete constDraft[removed.id]
    delete listDraft[removed.id]
    delete rangeDraft[removed.id]
  }
  // 选中态里的下标跟着左移，避免删一行后选中错位
  selRows.value = selRows.value.filter((x) => x !== i).map((x) => (x > i ? x - 1 : x))
  if (anchorRow > i) anchorRow -= 1
  else if (anchorRow === i) anchorRow = -1
  emit('update:values', next)
  // 删除后给个明确回执：原来静默删除，误点时看不出来
  if (removed) ElMessage.success(`已删除值资源：${removed.name || '未命名'}`)
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
/* 选中行：右键可对整批选中项做「设为全局 / 取消全局」 */
.vl-item.vl-item-active {
  border-color: var(--el-color-primary);
  background: #ecf5ff;
}
.vl-drag {
  color: #c0c4cc;
  cursor: grab;
  font-size: 13px;
  flex-shrink: 0;
}
/* 全局值资源标记：琥珀色小胶囊 */
.vl-global {
  flex-shrink: 0;
  padding: 0 5px;
  border-radius: 8px;
  font-size: 10px;
  line-height: 15px;
  color: #b88230;
  background: #fdf6ec;
  border: 1px solid #f5dab1;
  pointer-events: none;
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
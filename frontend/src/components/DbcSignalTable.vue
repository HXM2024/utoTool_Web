<template>
  <div ref="wrapRef" class="dbc-signal-table" tabindex="0">
    <el-table
      ref="tableRef"
      :data="rows"
      row-key="id"
      :height="tableHeight"
      :tree-props="{ children: 'children' }"
      :expand-row-keys="expandedKeys"
      :cell-class-name="cellClassName"
      @row-click="onRowClick"
      @cell-dblclick="onCellDblClick"
      @expand-change="onExpandChange"
    >
      <el-table-column
        v-for="col in visibleColumns"
        :key="col.key"
        :prop="col.key"
        :label="col.label"
        :width="colWidthOf(col)"
        :min-width="colWidthOf(col) ? undefined : (col.minWidth || 110)"
      >
        <template #header>
          <span class="dst-header" :title="col.label">{{ col.label }}</span>
          <span v-if="col.en" class="dst-header-en" :title="col.en">{{ col.en }}</span>
          <!-- 列宽拖拽调节 -->
          <span
            class="dst-col-resizer"
            @mousedown.stop.prevent="startColResize($event, col)"
            @dblclick.stop.prevent
          ></span>
        </template>
        <template #default="{ row }">
          <div
            class="dst-cell-inner"
            :data-row-id="row.id"
            :data-col-key="col.key"
            @mousedown="onCellMouseDown($event, row, col)"
            @mouseenter="onCellMouseEnter(row, col)"
            @dragover.prevent="onCellDragOver($event, row)"
            @dragleave="onCellDragLeave($event)"
            @drop.stop.prevent="onCellDrop($event, row, col)"
          >
            <!-- 测试勾选：唯一的复选框列（原 el-table 自带勾选列已移除）。
                 Ctrl/Shift+点击 = 加选行（不改勾选状态）；普通点击 = 若有多个已选行则一起勾选/取消。 -->
            <template v-if="col.type === 'test'">
              <el-checkbox
                :model-value="!!row.node.checked"
                @click.stop.prevent="onCheckClick($event, row)"
              />
            </template>
            <!-- 测试参数标签 -->
            <template v-else-if="col.type === 'params'">
              <div class="dst-tags">
                <span
                  v-for="param in row.node.testParams || []"
                  :key="param.value"
                  class="dst-tag"
                  :class="{ active: isParamSelected(row.node, param), configured: isConfigured(param) }"
                  @click.stop="emit('select-param', row.node, param)"
                  @dragover.prevent.stop="onTagDragOver($event)"
                  @dragleave="onTagDragLeave($event)"
                  @drop.stop.prevent="emit('tag-drop', $event, row.node, param)"
                >
                  {{ param.label }}
                  <el-icon class="dst-tag-close" @click.stop="emit('remove-param', row.node, param)">×</el-icon>
                </span>
              </div>
            </template>
            <!-- DTC（只读，编辑走测试参数详情面板） -->
            <template v-else-if="col.type === 'dtc'">
              <span class="dst-readonly">{{ getCellText(row, col) }}</span>
            </template>
            <!-- 内联编辑 -->
            <template v-else-if="isEditing(row, col)">
              <input
                class="dst-edit-input"
                :value="editValue"
                @input="editValue = ($event.target as HTMLInputElement).value"
                @keyup.enter="commitEdit(row, col)"
                @keyup.esc="cancelEdit"
                @blur="commitEdit(row, col)"
                @mousedown.stop
              />
            </template>
            <template v-else>
              <span class="dst-text">{{ getCellText(row, col) }}</span>
            </template>
          </div>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { DbcTableColumn, DbcTableRow } from '@/types/dbcTable'
import { useShortcut } from '@/composables/useShortcuts'

const props = defineProps<{
  rows: DbcTableRow[]
  columns: DbcTableColumn[]
  isConfigured: (param: any) => boolean
  isParamSelected: (node: any, param: any) => boolean
  changeMarkOf: (node: any) => 'new' | 'diff' | null
  /** 序列化某节点的测试参数（用于单元格复制，空参数返回空串） */
  serializeParams: (node: any) => string
}>()

const emit = defineEmits<{
  (e: 'select-param', node: any, param: any): void
  (e: 'remove-param', node: any, param: any): void
  (e: 'tag-drop', event: DragEvent, node: any, param: any): void
  (e: 'row-drop', event: DragEvent, node: any, path: string | null): void
  (e: 'check-change', node: any, checked: boolean): void
  (e: 'cell-commit', node: any, path: string, value: string): void
  /** 发送节点改名：需要把报文移动到目标发送节点下，故单独事件 */
  (e: 'sender-rename', node: any, sender: string): void
  (e: 'apply-params', node: any, text: string): void
  (e: 'batch-test', nodes: any[], checked: boolean): void
  (e: 'row-select', node: any): void
  (e: 'column-resize', key: string, width: number): void
  /** 按内容算出的各列自适应宽度（表头不参与），由父组件决定是否采用 */
  (e: 'auto-widths', widths: Record<string, number>): void
  (e: 'selection-count', count: number): void
}>()

const wrapRef = ref<HTMLElement | null>(null)
const tableRef = ref<any>(null)

/** 表格高度：随容器自适应铺满 DBC 页签，无需外部传入 */
const tableHeight = ref(400)
let wrapObserver: ResizeObserver | null = null

function measureTableHeight() {
  const wrap = wrapRef.value
  if (!wrap) return
  const total = wrap.clientHeight
  if (!total) return
  const next = Math.max(120, Math.round(total))
  if (next !== tableHeight.value) tableHeight.value = next
}

/** 可见列：显隐 / 顺序 / 列宽由父组件统一管理（工具按钮放在页签头部与树形图共用） */
const visibleColumns = computed(() => props.columns)

// ==================== 列宽拖拽调节 ====================

const dragWidth = ref<{ key: string; width: number } | null>(null)
let resizeStartX = 0
let resizeStartWidth = 0
let resizeColKey: string | null = null

function colWidthOf(col: DbcTableColumn): number | undefined {
  if (dragWidth.value?.key === col.key) return dragWidth.value.width
  return col.width
}

function startColResize(e: MouseEvent, col: DbcTableColumn) {
  const th = (e.currentTarget as HTMLElement | null)?.closest('th') as HTMLElement | null
  resizeColKey = col.key
  resizeStartX = e.clientX
  resizeStartWidth = th ? th.offsetWidth : (col.width || col.minWidth || 110)
  dragWidth.value = { key: col.key, width: resizeStartWidth }
  document.addEventListener('mousemove', onColResizeMove)
  document.addEventListener('mouseup', endColResize)
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

function onColResizeMove(e: MouseEvent) {
  if (!dragWidth.value || !resizeColKey) return
  const next = Math.max(60, Math.round(resizeStartWidth + (e.clientX - resizeStartX)))
  dragWidth.value = { key: resizeColKey, width: next }
}

function endColResize() {
  const cur = dragWidth.value
  document.removeEventListener('mousemove', onColResizeMove)
  document.removeEventListener('mouseup', endColResize)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  resizeColKey = null
  dragWidth.value = null
  if (cur) emit('column-resize', cur.key, cur.width)
}

// ==================== 列宽按内容自适应 ====================
//
// 规则：只看**单元格内容**，表头不参与 —— 表头比内容长时以内容为准，表头由 CSS 截断（省略号）。
// 文本宽度用 Range 量（`Range.getBoundingClientRect().width`）：它是**文字本身的宽度**，
// 与单元格当前宽度无关。这一点很关键——若改用 `scrollWidth`，列一旦被撑宽，
// 量出来的就是「当前列宽」而不是内容宽度，列只会越来越宽、收不回去。
// 实测 Range 宽度与 canvas measureText 完全一致（含报文行的 600 粗体），254×15 格约几十毫秒。

/** 列宽下限：防止内容只有一两个字符的列被压成一条缝 */
const AUTO_WIDTH_MIN = 56
/** 列宽上限：防止某条超长文本把整张表撑爆 */
const AUTO_WIDTH_MAX = 480
/** 单元格左右内边距（.dst-cell-inner 的 padding: 2px 8px）+ 2px 余量 */
const AUTO_WIDTH_PAD = 18

/** 单个单元格「内容」需要的宽度（文本 / 标签 / 复选框） */
function contentWidthOf(inner: HTMLElement): number {
  const text = inner.querySelector<HTMLElement>('.dst-text, .dst-readonly')
  if (text) {
    const range = document.createRange()
    range.selectNodeContents(text)
    const w = range.getBoundingClientRect().width
    range.detach?.()
    return w
  }
  // 测试参数列：标签会自动换行，所以按「最宽的一个标签」算，而不是整行标签的总和
  const tags = inner.querySelectorAll<HTMLElement>('.dst-tag')
  if (tags.length) {
    let w = 0
    for (const t of tags) w = Math.max(w, t.offsetWidth)
    return w
  }
  const box = inner.querySelector<HTMLElement>('.el-checkbox')
  if (box) return box.offsetWidth
  return 0
}

/** 量一遍所有可见单元格，按列取最大内容宽度并折算成列宽 */
function computeAutoWidths(): Record<string, number> {
  const wrap = wrapRef.value
  if (!wrap) return {}
  const maxByCol: Record<string, number> = {}
  const cells = wrap.querySelectorAll<HTMLElement>('.dst-cell-inner[data-col-key]')
  for (const cell of Array.from(cells)) {
    const key = cell.getAttribute('data-col-key')
    if (!key) continue
    const w = contentWidthOf(cell)
    if (w > (maxByCol[key] ?? 0)) maxByCol[key] = w
  }
  const out: Record<string, number> = {}
  for (const key of Object.keys(maxByCol)) {
    const max = maxByCol[key]
    // 整列都没有内容（例如该配置里信号值描述全为空）→ 不参与自适应，回落到列自带的 minWidth：
    // 没有任何内容可依据时按最小值 56px 压下去，表头会完全看不见，反而更难用。
    if (max <= 0) continue
    out[key] = Math.min(AUTO_WIDTH_MAX, Math.max(AUTO_WIDTH_MIN, Math.round(max) + AUTO_WIDTH_PAD))
  }
  return out
}

/** 上报自适应宽度；父组件只在与当前值不同时才采纳，因此不会和 props.columns 形成循环 */
function emitAutoWidths() {
  emit('auto-widths', computeAutoWidths())
}

// ==================== 展开 / 折叠 ====================

const expandedKeys = ref<string[]>([])
// 单元格矩形选区 / 填充柄元素：刻意用普通变量（非响应式），详见下方「性能约定」。
// rows 的 immediate watcher 会在 setup 期间重置选区，因此必须在此提前声明。
let selection: { aRow: number; aCol: number; fRow: number; fCol: number } | null = null
let fillHandleEl: HTMLElement | null = null

function collectMsgIds(list: DbcTableRow[]): string[] {
  const ids: string[] = []
  const walk = (l: DbcTableRow[]) => {
    for (const r of l) {
      if (r.children?.length) {
        ids.push(r.id)
        walk(r.children)
      }
    }
  }
  walk(list)
  return ids
}

/** 已见过的报文行 id 集合：用于区分「换了一批数据」与「同一批数据重算」 */
const knownMsgIds = ref<Set<string>>(new Set())

watch(
  () => props.rows,
  (rows) => {
    const msgIds = collectMsgIds(rows)
    const msgSet = new Set(msgIds)
    // 同一批数据（单元格编辑等导致 rows 重算）→ 保持当前展开状态，避免刚折叠又被自动展开
    const sameSet = msgIds.length === knownMsgIds.value.size && msgIds.every((id) => knownMsgIds.value.has(id))
    if (!sameSet) {
      knownMsgIds.value = msgSet
      expandedKeys.value = msgIds
      selection = null
      fillHandleEl?.remove()
      return
    }
    const next = expandedKeys.value.filter((id) => msgSet.has(id))
    for (const id of msgIds) {
      if (!next.includes(id)) next.push(id)
    }
    expandedKeys.value = next
  },
  { immediate: true }
)

/** 展开/折叠全部报文行。
 *  注意：EP 的 expand-row-keys 在「同内容数组」下不会重新应用（watchEffect 里 props 变了但
 *  内部 treeData 的 expanded 标记不变），因此这里直接改内部展开标记（与树形图 expandAllMainTree 同思路）。 */
function setAllExpanded(expanded: boolean) {
  const store = tableRef.value?.store
  try {
    if (store?.toggleTreeExpansion) {
      for (const row of props.rows) store.toggleTreeExpansion(row, expanded)
    } else {
      const treeData = store?.states?.treeData?.value
      if (treeData && typeof treeData === 'object') {
        for (const key of Object.keys(treeData)) {
          const item = treeData[key]
          if (item && typeof item.expanded === 'boolean') item.expanded = expanded
        }
      }
    }
  } catch {
    /* 忽略内部结构差异，仅同步外部状态 */
  }
  expandedKeys.value = expanded ? collectMsgIds(props.rows) : []
}

function expandAll() {
  setAllExpanded(true)
}

function collapseAll() {
  setAllExpanded(false)
}

function onExpandChange(row: DbcTableRow, expanded: any) {
  const isExpanded =
    typeof expanded === 'boolean' ? expanded : Array.isArray(expanded) ? expanded.includes(row) : !!expanded
  const set = new Set(expandedKeys.value)
  if (isExpanded) set.add(row.id)
  else set.delete(row.id)
  expandedKeys.value = [...set]
}

// ==================== 取值 / 编辑 ====================

function getByPath(obj: any, path: string): any {
  if (!obj || !path) return ''
  return path.split('.').reduce((acc: any, k: string) => (acc == null ? undefined : acc[k]), obj)
}

/** 信号级 DTC 实际存放在测试参数里（tp.*.dtc），仅用于只读展示 */
function signalDtc(node: any): string {
  for (const p of node?.testParams || []) {
    if (p?.params?.dtc) return String(p.params.dtc)
  }
  return ''
}

function getCellText(row: DbcTableRow, col: DbcTableColumn): string {
  if (col.type === 'dtc') return signalDtc(row.node)
  // 测试参数列：序列化为 JSON，使参数可随单元格一起复制/粘贴
  if (col.type === 'params') return props.serializeParams(row.node)
  // 发送节点（节点属性）只显示在报文行，信号行留空
  if (col.path === 'senderName') return row.kind === 'message' ? String(row.senderName ?? '') : ''
  // 信号级列在报文行上留空（否则会取出报文自身的同名字段，显示成不相关的值）
  if (col.scope === 'sig' && row.kind === 'message') return ''
  // 报文级列在信号行上留空（报文属性只显示在所属报文行，避免信号行重复显示）
  if (col.scope === 'msg' && row.kind === 'signal') return ''
  const v = getByPath(row.node, col.path || '')
  return v === undefined || v === null ? '' : String(v)
}

/** 该单元格在当前行是否可编辑（msg 列仅报文行、sig 列仅信号行、发送节点仅报文行） */
function isEditable(row: DbcTableRow, col: DbcTableColumn): boolean {
  if (!col.editable || !col.path) return false
  // 发送节点列在信号行留空，只在报文行可改（改后报文会移动到目标发送节点下）
  if (col.path === 'senderName') return row.kind === 'message'
  if (col.scope === 'sig') return row.kind === 'signal'
  if (col.scope === 'msg') return row.kind === 'message'
  return false
}

const editing = ref<{ rowId: string; key: string } | null>(null)
const editValue = ref('')

function isEditing(row: DbcTableRow, col: DbcTableColumn): boolean {
  return editing.value?.rowId === row.id && editing.value?.key === col.key
}

function onCellDblClick(row: DbcTableRow, column: any) {
  const col = visibleColumns.value.find((c) => c.key === column?.property)
  if (!col || !isEditable(row, col)) return
  editing.value = { rowId: row.id, key: col.key }
  editValue.value = getCellText(row, col)
  nextTick(() => {
    const el = wrapRef.value?.querySelector('.dst-edit-input') as HTMLInputElement | null
    el?.focus()
    el?.select()
  })
}

function cancelEdit() {
  editing.value = null
}

function commitEdit(row: DbcTableRow, col: DbcTableColumn) {
  if (!isEditing(row, col)) return
  const value = editValue.value
  editing.value = null
  if (String(getCellText(row, col)) === String(value)) return
  // 发送节点不是节点上的字段，走独立事件（需把报文移动到目标发送节点下）
  if (col.path === 'senderName') {
    emit('sender-rename', row.node, value)
    return
  }
  emit('cell-commit', row.node, col.path as string, value)
}

// ==================== 「Test」列：勾选 + Ctrl 多选 ====================
//
// 只有一个复选框列（「Test」）。它同时承担两件事：
//   1) 该行是否生成测试用例（node.checked）；
//   2) 批量操作的行多选（Ctrl/Shift 加选，普通点击在有多个已选行时一起勾选）。
// 多选集合刻意不用 ref（理由同下方「性能约定」）：它会用 dst-picked 类直接打到行上。

/** 已加选的行 id 集合（非响应式，改动后手动 emit('selection-count')） */
let pickedIds = new Set<string>()
/** Shift 加选的锚点行 id */
let pickedAnchorId = ''

function emitPickCount() {
  emit('selection-count', pickedIds.size)
}

function paintPicked(rowId: string, on: boolean) {
  for (const n of rowCells(rowId)) n.closest('td')?.classList.toggle('dst-picked', on)
}

function togglePick(row: DbcTableRow) {
  if (pickedIds.has(row.id)) {
    pickedIds.delete(row.id)
    paintPicked(row.id, false)
  } else {
    pickedIds.add(row.id)
    paintPicked(row.id, true)
  }
  pickedAnchorId = row.id
  emitPickCount()
}

/** Shift 加选：从锚点到当前行整段加入多选（已选中的不重复加） */
function extendPickTo(row: DbcTableRow) {
  const rows = flatRows.value
  const to = rowIndex(row)
  const from = rows.findIndex((r) => r.id === pickedAnchorId)
  if (to < 0 || from < 0) {
    togglePick(row)
    return
  }
  const r0 = Math.min(from, to)
  const r1 = Math.max(from, to)
  for (let i = r0; i <= r1; i++) {
    const r = rows[i]
    if (!r || pickedIds.has(r.id)) continue
    pickedIds.add(r.id)
    paintPicked(r.id, true)
  }
  pickedAnchorId = row.id
  emitPickCount()
}

function clearPicked() {
  if (!pickedIds.size) return
  for (const id of pickedIds) paintPicked(id, false)
  pickedIds = new Set()
  pickedAnchorId = ''
  emitPickCount()
}

/** 把「已加选的所有行」的勾选状态一起改掉 */
function applyCheckedToPicked(checked: boolean) {
  const rows = flatRows.value.filter((r) => pickedIds.has(r.id))
  if (!rows.length) return
  for (const r of rows) {
    if (!!r.node.checked !== checked) emit('check-change', r.node, checked)
    else r.node.checked = checked
  }
}

function onCheckClick(e: MouseEvent, row: DbcTableRow) {
  e.stopPropagation()
  e.preventDefault()
  if (e.ctrlKey || e.metaKey) {
    // Ctrl 只做加选/减选，不动勾选状态
    togglePick(row)
    return
  }
  if (e.shiftKey) {
    extendPickTo(row)
    return
  }
  // 普通点击：有多个已选行且当前行在选区内 → 一起勾选/取消勾选
  if (pickedIds.size > 1 && pickedIds.has(row.id)) {
    applyCheckedToPicked(!row.node.checked)
    return
  }
  emit('check-change', row.node, !row.node.checked)
}

function emitBatch(checked: boolean) {
  const nodes = flatRows.value.filter((r) => pickedIds.has(r.id)).map((r) => r.node)
  if (!nodes.length) return
  emit('batch-test', nodes, checked)
  // 批量执行后清空多选，避免下次误操作（与原来 el-table 勾选列行为一致）
  clearPicked()
}

// ==================== 框选 / 复制粘贴 ====================
//
// 性能约定：选区状态 **不参与响应式渲染**。
// 单元格里只要读一次 selection（例如模板里写 v-if="isSelectionCorner(...)" 或把选区判定塞进
// cell-class-name），Element Plus 的表体渲染函数就会依赖它；之后每次移动选区（含拖拽时每个
// mouseenter）都会整表重渲染 —— 实测 114 行 × 16 列时单次约 240ms，点一下要等 0.25s。
// 因此选区改为普通变量 + 直接操作 DOM（加/去 dst-selected、移动填充柄）。

const dragging = ref(false)

/** 当前可见（已展开）的行序列，用于框选与 TSV 粘贴的坐标 */
const flatRows = computed<DbcTableRow[]>(() => {
  const out: DbcTableRow[] = []
  const walk = (l: DbcTableRow[]) => {
    for (const r of l) {
      out.push(r)
      if (r.children?.length && expandedKeys.value.includes(r.id)) walk(r.children)
    }
  }
  walk(props.rows)
  return out
})

/** id → flatRows 下标；避免每个单元格都做一次 O(n) 的 findIndex */
const rowIndexMap = computed(() => {
  const m = new Map<string, number>()
  flatRows.value.forEach((r, i) => m.set(r.id, i))
  return m
})

/** column key → 列对象 / 下标 */
const columnMap = computed(() => {
  const m = new Map<string, DbcTableColumn>()
  visibleColumns.value.forEach((c) => m.set(c.key, c))
  return m
})
const colIndexMap = computed(() => {
  const m = new Map<string, number>()
  visibleColumns.value.forEach((c, i) => m.set(c.key, i))
  return m
})

function rowIndex(row: DbcTableRow): number {
  const i = rowIndexMap.value.get(row.id)
  return i === undefined ? -1 : i
}

function colIndex(col: DbcTableColumn): number {
  const i = colIndexMap.value.get(col.key)
  return i === undefined ? -1 : i
}

function cellClassName({ row, column }: any): string {
  const key = column?.property
  if (!key) return ''
  const col = columnMap.value.get(key)
  if (!col) return ''
  const cls: string[] = ['dst-cell']
  // 报文行 / 信号行底色区分
  cls.push(row.kind === 'message' ? 'dst-row-msg' : 'dst-row-sig')
  if (isEditable(row, col)) cls.push('dst-editable')
  if (col.type === 'params') cls.push('dst-cell-params')
  if (col.type === 'test') cls.push('dst-cell-test')
  const mark = props.changeMarkOf(row.node)
  if (mark === 'new') cls.push('dst-new')
  else if (mark === 'diff') cls.push('dst-diff')
  return cls.join(' ')
}

function onRowClick(row: DbcTableRow) {
  emit('row-select', row.node)
}

// ==================== 选区：非响应式 + 直接操作 DOM ====================

interface CellRange {
  r0: number
  c0: number
  r1: number
  c1: number
}

/** 当前选区（anchor/focus）；selection 变量本身声明在文件上方（见「性能约定」）。 */

function selectionRange(): CellRange | null {
  const s = selection
  if (!s) return null
  return {
    r0: Math.min(s.aRow, s.fRow),
    r1: Math.max(s.aRow, s.fRow),
    c0: Math.min(s.aCol, s.fCol),
    c1: Math.max(s.aCol, s.fCol),
  }
}

/** 行 id / 列 key → 该格的 .dst-cell-inner 元素。每轮重绘重建一次索引，避免逐格 querySelector。 */
let cellIndex = new Map<string, HTMLElement>()

function cellKey(rowId: string, colKey: string) {
  return rowId + '\u0000' + colKey
}

function rebuildCellIndex() {
  const map = new Map<string, HTMLElement>()
  const wrap = wrapRef.value
  if (wrap) {
    const nodes = wrap.querySelectorAll<HTMLElement>('.dst-cell-inner[data-col-key]')
    for (const n of Array.from(nodes)) {
      const rowId = n.getAttribute('data-row-id')
      const colKey = n.getAttribute('data-col-key')
      if (rowId && colKey) map.set(cellKey(rowId, colKey), n)
    }
  }
  cellIndex = map
}

/** 取某一行的所有 .dst-cell-inner（用于整行打标） */
function rowCells(rowId: string): HTMLElement[] {
  const out: HTMLElement[] = []
  const wrap = wrapRef.value
  if (!wrap) return out
  const nodes = wrap.querySelectorAll<HTMLElement>(`.dst-cell-inner[data-row-id="${CSS.escape(rowId)}"]`)
  for (const n of Array.from(nodes)) out.push(n)
  return out
}

/** 给指定矩形区域打/去 dst-selected */
function paintRange(range: CellRange | null, on: boolean) {
  if (!range) return
  const cols = visibleColumns.value
  for (let r = range.r0; r <= range.r1; r++) {
    const row = flatRows.value[r]
    if (!row) continue
    for (let c = range.c0; c <= range.c1; c++) {
      const key = cols[c]?.key
      if (!key) continue
      const inner = cellIndex.get(cellKey(row.id, key))
      inner?.closest('td')?.classList.toggle('dst-selected', on)
    }
  }
}

// ---- 填充柄（选区右下角的小方块）：独立 DOM 元素，随选区移动 ----

function ensureFillHandle() {
  if (fillHandleEl) return fillHandleEl
  const el = document.createElement('span')
  el.className = 'dst-fill-handle'
  // 手工创建的元素没有 scoped 样式作用域属性（data-v-xxx），不补上的话 .dst-fill-handle 的
  // 尺寸/定位样式全部匹配不到（实测 0×0，鼠标根本点不到，拖拽填充会失效）。
  const scopeAttr = Array.from(wrapRef.value?.attributes || []).find((a) => a.name.startsWith('data-v-'))
  if (scopeAttr) el.setAttribute(scopeAttr.name, '')
  el.title = '拖拽自动填充'
  el.addEventListener('mousedown', (e) => {
    e.stopPropagation()
    e.preventDefault()
    startFill(e)
  })
  fillHandleEl = el
  return el
}

function moveFillHandle(range: CellRange | null) {
  const el = ensureFillHandle()
  if (!range) {
    el.remove()
    return
  }
  const row = flatRows.value[range.r1]
  const key = visibleColumns.value[range.c1]?.key
  const inner = row && key ? cellIndex.get(cellKey(row.id, key)) : null
  if (!inner) {
    el.remove()
    return
  }
  inner.appendChild(el)
}

/** 重绘选区（先擦旧区、再画新区、移动填充柄） */
function paintSelection(prev: CellRange | null) {
  if (prev) paintRange(prev, false)
  const next = selectionRange()
  paintRange(next, true)
  moveFillHandle(next)
}

/** 确保索引可用：EP 重渲染会整批换掉单元格节点，此时第一个缓存节点会脱离文档，
 *  借此以 O(1) 判断是否需要重建（拖拽时每格都重建 1800+ 节点的索引没必要）。 */
function ensureCellIndex() {
  for (const el of cellIndex.values()) {
    if (!el.isConnected) rebuildCellIndex()
    return
  }
  if (!cellIndex.size) rebuildCellIndex()
}

/** 更新选区并立即重绘 */
function setSelection(next: { aRow: number; aCol: number; fRow: number; fCol: number } | null) {
  const prev = selectionRange()
  selection = next
  ensureCellIndex()
  paintSelection(prev)
}

function clearSelection() {
  const prev = selectionRange()
  selection = null
  if (prev) paintRange(prev, false)
  moveFillHandle(null)
}

function onCellMouseDown(e: MouseEvent, row: DbcTableRow, col: DbcTableColumn) {
  // 「测试」列含 checkbox，不参与框选；「测试参数」列需可框选才能随单元格复制
  if (col.type === 'test') return
  const rIdx = rowIndex(row)
  const cIdx = colIndex(col)
  if (rIdx < 0 || cIdx < 0) return
  e.preventDefault()
  // 用 preventScroll 避免聚焦容器时把表格滚动带偏（否则鼠标点击位置会跳到别的行）
  wrapRef.value?.focus?.({ preventScroll: true })
  if (e.shiftKey && selection) {
    setSelection({ ...selection, fRow: rIdx, fCol: cIdx })
  } else {
    setSelection({ aRow: rIdx, aCol: cIdx, fRow: rIdx, fCol: cIdx })
  }
  dragging.value = true
  // 注意：这里不再 emit row-select。row-click 已在单击结束时发过一次，
  // 而 mousedown 多发一次会让「选中树节点」的副作用在拖拽起点重复触发。
}

function onCellMouseEnter(row: DbcTableRow, col: DbcTableColumn) {
  if (!dragging.value && !fillDragging.value) return
  const cIdx = colIndex(col)
  const rIdx = rowIndex(row)
  if (rIdx < 0 || cIdx < 0 || !selection) return
  if (selection.fRow === rIdx && selection.fCol === cIdx) return
  setSelection({ ...selection, fRow: rIdx, fCol: cIdx })
}

/** 拖拽自动填充：按住选区右下角手柄拖动，松开时按源区域循环填充 */
const fillDragging = ref(false)
const fillSource = ref<CellRange | null>(null)

function startFill(e: MouseEvent) {
  const range = selectionRange()
  if (!range) return
  fillSource.value = range
  // 锚点固定在源区域左上、焦点移到右下，拖拽时只扩展焦点
  selection = { aRow: range.r0, aCol: range.c0, fRow: range.r1, fCol: range.c1 }
  dragging.value = false
  fillDragging.value = true
  wrapRef.value?.focus?.({ preventScroll: true })
}

/** 把源区域按瓦片方式循环写入当前选区（跳过源区域本身） */
function fillRange(source: CellRange) {
  const target = selectionRange()
  if (!target) return
  const srcRows = source.r1 - source.r0 + 1
  const srcCols = source.c1 - source.c0 + 1
  if (srcRows <= 0 || srcCols <= 0) return
  for (let r = target.r0; r <= target.r1; r++) {
    const row = flatRows.value[r]
    if (!row) continue
    for (let c = target.c0; c <= target.c1; c++) {
      if (r >= source.r0 && r <= source.r1 && c >= source.c0 && c <= source.c1) continue
      const col = visibleColumns.value[c]
      if (!col) continue
      const srcRow = flatRows.value[source.r0 + ((r - target.r0) % srcRows)]
      const srcCol = visibleColumns.value[source.c0 + ((c - target.c0) % srcCols)]
      if (!srcRow || !srcCol) continue
      const text = getCellText(srcRow, srcCol)
      if (col.type === 'params') {
        emit('apply-params', row.node, text)
        continue
      }
      if (!isEditable(row, col)) continue
      emit('cell-commit', row.node, col.path as string, text)
    }
  }
}

function endDrag() {
  if (fillDragging.value) {
    const source = fillSource.value
    fillDragging.value = false
    fillSource.value = null
    dragging.value = false
    if (source) {
      fillRange(source)
      // 填充会写入节点（rows 重算），DOM 会被 EP 重建，重绘一次保证高亮/填充柄跟上
      nextTick(() => {
        rebuildCellIndex()
        paintSelection(null)
      })
    }
    return
  }
  dragging.value = false
}

onMounted(() => {
  window.addEventListener('mouseup', endDrag)
  window.addEventListener('resize', measureTableHeight)
  measureTableHeight()
  if (typeof ResizeObserver !== 'undefined' && wrapRef.value) {
    wrapObserver = new ResizeObserver(() => measureTableHeight())
    wrapObserver.observe(wrapRef.value)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('mouseup', endDrag)
  window.removeEventListener('resize', measureTableHeight)
  document.removeEventListener('mousemove', onColResizeMove)
  document.removeEventListener('mouseup', endColResize)
  wrapObserver?.disconnect()
  wrapObserver = null
})

/** rows / 列配置变化后 EP 会重建单元格 DOM，高亮、多选标记与填充柄需要重新贴回 */
function repaint() {
  nextTick(() => {
    rebuildCellIndex()
    paintSelection(null)
    for (const id of pickedIds) paintPicked(id, true)
    // 内容变了 → 列宽重新自适应一次
    emitAutoWidths()
  })
}
watch(
  () => props.rows,
  () => {
    void nextTick(measureTableHeight)
    repaint()
  }
)

watch(() => props.columns, repaint, { deep: true })
watch(tableHeight, repaint)
// 展开/折叠会改变可见单元格集合，自适应宽度要跟着重算
watch(expandedKeys, () => void nextTick(emitAutoWidths))

function buildClipboardText(): string {
  const range = selectionRange()
  if (!range) return ''
  const lines: string[] = []
  for (let r = range.r0; r <= range.r1; r++) {
    const row = flatRows.value[r]
    if (!row) break
    const cells: string[] = []
    for (let c = range.c0; c <= range.c1; c++) {
      const col = visibleColumns.value[c]
      cells.push(col ? getCellText(row, col) : '')
    }
    lines.push(cells.join('\t'))
  }
  return lines.join('\n')
}

function parseClipboard(text: string): string[][] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  while (lines.length && lines[lines.length - 1] === '') lines.pop()
  return lines.map((line) => line.split('\t'))
}

async function copySelection() {
  const text = buildClipboardText()
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    try {
      document.execCommand('copy')
    } catch {
      /* ignore */
    }
    document.body.removeChild(ta)
  }
}

async function pasteSelection() {
  let text = ''
  try {
    text = await navigator.clipboard.readText()
  } catch {
    return
  }
  if (!text) return
  const grid = parseClipboard(text)
  if (!grid.length || !grid[0]?.length) return

  const srcRows = grid.length
  const srcCols = grid[0].length
  const maxRow = flatRows.value.length - 1
  const maxCol = visibleColumns.value.length - 1
  if (maxRow < 0 || maxCol < 0) return

  const range = selectionRange()
  const isRect = range && (range.r1 > range.r0 || range.c1 > range.c0)
  const targetTop = isRect ? range.r0 : range?.r0 ?? 0
  const targetLeft = isRect ? range.c0 : range?.c0 ?? 0
  const targetRows = isRect ? range.r1 - range.r0 + 1 : srcRows
  const targetCols = isRect ? range.c1 - range.c0 + 1 : srcCols

  // 循环平铺：源数据作为瓦片在目标区域重复填充（与 Excel 行为一致）
  for (let dr = 0; dr < targetRows; dr++) {
    const r = targetTop + dr
    if (r > maxRow) break
    const row = flatRows.value[r]
    if (!row) break
    for (let dc = 0; dc < targetCols; dc++) {
      const c = targetLeft + dc
      if (c > maxCol) break
      const col = visibleColumns.value[c]
      if (!col) continue
      const text = grid[dr % srcRows][dc % srcCols]
      // 测试参数列：整格替换（支持把参数随单元格一起复制/粘贴）
      if (col.type === 'params') {
        emit('apply-params', row.node, text)
        continue
      }
      if (!isEditable(row, col)) continue
      emit('cell-commit', row.node, col.path as string, text)
    }
  }

  setSelection({
    aRow: targetTop,
    aCol: targetLeft,
    fRow: Math.min(targetTop + targetRows - 1, maxRow),
    fCol: Math.min(targetLeft + targetCols - 1, maxCol),
  })
}

function clearSelectionValues() {
  const range = selectionRange()
  if (!range) return
  for (let r = range.r0; r <= range.r1; r++) {
    const row = flatRows.value[r]
    if (!row) break
    for (let c = range.c0; c <= range.c1; c++) {
      const col = visibleColumns.value[c]
      if (!col || !isEditable(row, col)) continue
      if (getCellText(row, col) === '') continue
      emit('cell-commit', row.node, col.path as string, '')
    }
  }
}

// ====== 键盘事件：统一快捷键层（context 作用域，仅焦点在本表格容器内时生效） ======
const inTable = () => !!wrapRef.value?.contains(document.activeElement)

useShortcut({
  id: 'dbcTable:copy',
  keys: 'Ctrl+C',
  scope: 'context',
  desc: '复制信号表格选区',
  when: inTable,
  run: () => {
    void copySelection()
    return true
  },
})
useShortcut({
  id: 'dbcTable:paste',
  keys: 'Ctrl+V',
  scope: 'context',
  desc: '粘贴到信号表格选区',
  when: inTable,
  run: () => {
    void pasteSelection()
    return true
  },
})
useShortcut({
  id: 'dbcTable:clear',
  keys: 'Delete',
  scope: 'context',
  desc: '清空信号表格选区内容',
  when: inTable,
  run: () => {
    clearSelectionValues()
    return true
  },
})
useShortcut({
  id: 'dbcTable:clearBackspace',
  keys: 'Backspace',
  scope: 'context',
  desc: '清空信号表格选区内容',
  when: inTable,
  run: () => {
    clearSelectionValues()
    return true
  },
})

// ==================== 拖拽落点 ====================
// 同样采用「非响应式 + 直接改类」，避免拖拽经过单元格时整表重渲染

let dragOverRowId = ''

function markDropOver(rowId: string) {
  if (dragOverRowId === rowId) return
  if (dragOverRowId) {
    for (const n of rowCells(dragOverRowId)) n.closest('td')?.classList.remove('dst-drop-over')
  }
  dragOverRowId = rowId
  if (rowId) {
    for (const n of rowCells(rowId)) n.closest('td')?.classList.add('dst-drop-over')
  }
}

function onCellDragOver(event: DragEvent, row: DbcTableRow) {
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
  markDropOver(row.id)
}

function onCellDragLeave(event: DragEvent) {
  const el = event.currentTarget as HTMLElement
  const to = event.relatedTarget as HTMLElement | null
  if (to && el.contains(to)) return
  markDropOver('')
}

function onCellDrop(event: DragEvent, row: DbcTableRow, col: DbcTableColumn) {
  markDropOver('')
  emit('row-drop', event, row.node, col.key === 'params' || col.type === 'test' ? null : col.path || null)
}

function onTagDragOver(event: DragEvent) {
  const el = event.currentTarget as HTMLElement
  if (el) el.classList.add('dst-tag-drop-over')
}

function onTagDragLeave(event: DragEvent) {
  const el = event.currentTarget as HTMLElement
  if (el) el.classList.remove('dst-tag-drop-over')
}

defineExpose({ expandAll, collapseAll, applyBatch: emitBatch, clearSelection })
</script>

<style scoped lang="scss">
.dbc-signal-table {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  outline: none;
}

.dst-header {
  margin-right: 6px;
}

.dst-header-en {
  font-size: 11px;
  color: var(--text-secondary, #909399);
}

/* 列宽拖拽手柄（表头右缘） */
.dst-col-resizer {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 6px;
  cursor: col-resize;
  z-index: 3;

  &:hover {
    background: var(--el-color-primary-light-5);
  }
}

.dst-cell-inner {
  position: relative;
  box-sizing: border-box;
  width: 100%;
  min-height: 26px;
  padding: 2px 8px;
  display: flex;
  align-items: center;
}

/* 自动填充柄（选区右下角） */
.dst-fill-handle {
  position: absolute;
  right: -2px;
  bottom: -2px;
  width: 7px;
  height: 7px;
  background: var(--el-color-primary);
  border: 1px solid #fff;
  cursor: crosshair;
  z-index: 4;
}

.dst-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dst-readonly {
  color: var(--text-secondary, #909399);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dst-edit-input {
  width: 100%;
  height: 22px;
  padding: 0 4px;
  border: 1px solid var(--el-color-primary);
  border-radius: 2px;
  outline: none;
  font-size: 12px;
  background: var(--bg-card, #fff);
  color: var(--text-primary, #303133);
}

.dst-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.dst-tag {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 12px;
  cursor: pointer;
  background: var(--bg-hover, #f0f2f5);
  border: 1px solid transparent;
  color: var(--text-regular, #606266);
  white-space: nowrap;

  &.configured {
    border-color: var(--el-color-success);
    color: var(--el-color-success);
  }

  &.active {
    background: var(--el-color-primary-light-8);
    border-color: var(--el-color-primary);
    color: var(--el-color-primary);
  }

  &.dst-tag-drop-over {
    border-color: var(--el-color-warning);
    background: var(--el-color-warning-light-9);
  }
}

.dst-tag-close {
  font-size: 12px;
  line-height: 1;
}

/* 报文行 / 信号行底色区分（声明在 dst-new / dst-diff / dst-selected 之前，保证高亮优先） */
:deep(.dst-row-msg) {
  background-color: rgba(64, 158, 255, 0.07);
  font-weight: 600;
}

:deep(.dst-row-sig) {
  background-color: transparent;
}

:deep(.dst-new) {
  background: rgba(230, 162, 60, 0.12);
}

:deep(.dst-diff) {
  background: rgba(230, 162, 60, 0.2);
}

/* 「Test」列 Ctrl/Shift 加选的行（声明在 dst-selected 之前，单元格选区高亮优先） */
:deep(.dst-picked) {
  background: var(--el-color-primary-light-8) !important;
}

:deep(.dst-selected) {
  background: var(--el-color-primary-light-9) !important;
  box-shadow: inset 0 0 0 1px var(--el-color-primary-light-5);
}

:deep(.dst-drop-over) {
  background: var(--el-color-warning-light-9) !important;
}

:deep(.dst-editable .dst-cell-inner:hover) {
  outline: 1px dashed var(--el-color-primary-light-5);
  outline-offset: -2px;
}

:deep(.el-table__cell) {
  padding: 2px 0;
}

:deep(.el-table th .cell) {
  position: relative;
  padding: 0 8px;
  line-height: 22px;
  /* 列宽按内容自适应、表头不参与 → 表头比内容长时截断显示省略号（悬停有原生 title 提示） */
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

/* 数据单元格：去掉 .cell 的内边距，让整格都可点击/框选，内边距交给 .dst-cell-inner */
:deep(.el-table__body .cell) {
  padding: 0;
  line-height: 22px;
  overflow: visible;
}
</style>

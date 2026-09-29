<script setup lang="ts">
import { ref, computed, nextTick, watch, onMounted, onBeforeUnmount } from 'vue'
import { Close, Warning } from '@element-plus/icons-vue'
import { useShortcut } from '@/composables/useShortcuts'

interface Props {
  columns: any[]
  data: any[]
  objectNames: Set<string>
  selectedRow: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update', payload: { row: number; col: number; value: string }): void
  (e: 'add-col', payload: { title: string }): void
  (e: 'remove-col', payload: { col: number }): void
  (e: 'rename-col', payload: { col: number; title: string }): void
  (e: 'select-row', rowIndex: number): void
}>()

const editingCell = ref<{ row: number; col: number } | null>(null)
const editingValue = ref('')
const editInputRef = ref<HTMLInputElement | null>(null)
const editStyle = ref<{ top: string; left: string; width: string }>({ top: '0px', left: '0px', width: '100px' })

// 单元格选区：anchor 为起点，focus 为当前端点，构成矩形区域
const anchorCell = ref<{ row: number; col: number } | null>(null)
const focusCell = ref<{ row: number; col: number } | null>(null)
// 本组件容器引用，用于判断键盘焦点是否在内部、以及重算滚动位置
const listRef = ref<HTMLElement | null>(null)

// 鼠标拖拽框选状态
const isDragging = ref(false)
const dragStart = ref<{ x: number; y: number } | null>(null)

// 列宽：记录每列当前宽度（px），未设置的列使用默认值
const colWidths = ref<Record<number, number>>({})
const MIN_COL_WIDTH = 60
const DEFAULT_COL_WIDTH = 120

// 列宽拖拽调整状态
const resizingCol = ref<number | null>(null)
const resizeStartX = ref(0)
const resizeStartWidth = ref(0)

const detectionStartCol = 4

const allColumns = computed(() => {
  return props.columns.map((col, idx) => {
    const rawTitle = String(col.title || '').replace(/^⚠\s*/, '')
    // 检测对象表头格式为「对象名 / 时间」，时间可省略（仅识别数值，避免把双语表头第二行当成时间）
    const [name, ...rest] = rawTitle.split(' / ')
    const isDetection = idx >= detectionStartCol
    const timeCandidate = String(rest[0] ?? '').trim()
    const time = isDetection && /^\d+(\.\d+)?$/.test(timeCandidate) ? timeCandidate : ''
    return {
      colIndex: idx,
      name: name.trim(),
      time,
      rawTitle,
      isDetection,
      matched: isDetection ? props.objectNames.has(name.trim()) : null,
    }
  })
})

const dtcItems = computed(() => {
  return props.data.map((row, rowIndex) => {
    const cells: Record<number, string> = {}
    for (let i = 0; i < props.columns.length; i++) {
      cells[i] = String(row[`c${i}`] || '')
    }
    return { rowIndex, cells }
  })
})

const colCount = computed(() => props.columns.length)
const rowCount = computed(() => dtcItems.value.length)

// 选中区域（规范化的矩形边界）
const selection = computed(() => {
  if (!anchorCell.value || !focusCell.value) return null
  const r1 = anchorCell.value.row
  const r2 = focusCell.value.row
  const c1 = anchorCell.value.col
  const c2 = focusCell.value.col
  return {
    minRow: Math.min(r1, r2),
    maxRow: Math.max(r1, r2),
    minCol: Math.min(c1, c2),
    maxCol: Math.max(c1, c2),
  }
})

function isCellSelected(row: number, col: number): boolean {
  if (!selection.value) return false
  const s = selection.value
  return row >= s.minRow && row <= s.maxRow && col >= s.minCol && col <= s.maxCol
}

function getCellValue(rowIndex: number, colIndex: number): string {
  return dtcItems.value[rowIndex]?.cells[colIndex] ?? ''
}

// ====== 列宽（自适应 + 自由调节） ======
// 根据文字内容估算列宽（自适应）
function estimateColWidth(colIndex: number): number {
  const col = allColumns.value[colIndex]
  const titleLen = (col?.name || '').length
  // 取该列内容的最大长度（限制扫描前 100 行）
  let maxCellLen = 0
  const scanLimit = Math.min(dtcItems.value.length, 100)
  for (let r = 0; r < scanLimit; r++) {
    const v = getCellValue(r, colIndex)
    if (v && v.length > maxCellLen) maxCellLen = v.length
  }
  const refLen = Math.max(titleLen, maxCellLen)
  // 每个字符约 8px，加上内边距 24px，并设置上下限
  const width = Math.round(refLen * 8 + 24)
  return Math.max(MIN_COL_WIDTH, Math.min(width, 360))
}

// 初始化 / 补全列宽（列变化时调用）
function syncColWidths() {
  const next: Record<number, number> = {}
  for (let i = 0; i < colCount.value; i++) {
    next[i] = colWidths.value[i] ?? estimateColWidth(i)
  }
  colWidths.value = next
}

watch(colCount, () => {
  syncColWidths()
})

// grid 列宽模板（动态）
const gridTemplateColumns = computed(() => {
  const widthList: string[] = []
  for (let i = 0; i < colCount.value; i++) {
    widthList.push(`${colWidths.value[i] ?? DEFAULT_COL_WIDTH}px`)
  }
  return widthList.join(' ')
})

// 开始拖拽调整某列宽度
function startResize(e: MouseEvent, colIndex: number) {
  e.preventDefault()
  e.stopPropagation()
  resizingCol.value = colIndex
  resizeStartX.value = e.clientX
  resizeStartWidth.value = colWidths.value[colIndex] ?? DEFAULT_COL_WIDTH
}

// 拖拽过程中调整列宽
function onResizeMove(e: MouseEvent) {
  if (resizingCol.value === null) return
  const delta = e.clientX - resizeStartX.value
  const newWidth = Math.max(MIN_COL_WIDTH, resizeStartWidth.value + delta)
  colWidths.value = {
    ...colWidths.value,
    [resizingCol.value]: newWidth,
  }
}

// 结束列宽调整
function endResize() {
  resizingCol.value = null
}

function clearSelection() {
  anchorCell.value = null
  focusCell.value = null
}

function setSelection(row: number, col: number, extend: boolean) {
  if (!extend || !anchorCell.value) {
    anchorCell.value = { row, col }
    focusCell.value = { row, col }
  } else {
    focusCell.value = { row, col }
  }
}

function clampCell(row: number, col: number) {
  return {
    row: Math.max(0, Math.min(row, Math.max(0, rowCount.value - 1))),
    col: Math.max(0, Math.min(col, Math.max(0, colCount.value - 1))),
  }
}

// ====== 单元格编辑 ======
function startEdit(rowIndex: number, colIndex: number, value: string, event: MouseEvent) {
  const target = event.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  editStyle.value = {
    top: `${rect.top}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
  }
  editingCell.value = { row: rowIndex, col: colIndex }
  editingValue.value = value
  // 进入编辑态同时建立选区
  setSelection(rowIndex, colIndex, false)
  nextTick(() => {
    editInputRef.value?.focus()
    editInputRef.value?.select()
  })
}

// 单元格点击处理：单击选中 + 建立选区；Shift+点击扩展选区
function onCellClick(e: MouseEvent, row: number, col: number) {
  if (e.shiftKey) {
    setSelection(row, col, true)
  } else {
    setSelection(row, col, false)
  }
}

// 整行点击：选中整行并清除自由单元格选区（两种聚焦互斥）
function onRowClick(rowIndex: number) {
  clearSelection()
  emit('select-row', rowIndex)
}

// ====== 鼠标拖拽框选 ======
function onCellMouseDown(e: MouseEvent, row: number, col: number) {
  // 双击编辑由 dblclick 处理，此处仅处理单击/框选起点
  // 阻止浏览器默认文本选择
  e.preventDefault()

  // 让容器获得焦点，确保后续方向键 / 复制粘贴可用
  listRef.value?.focus()

  // 框选单元格时消除整行高亮
  emit('select-row', -1)

  // 按下即建立选区起点
  if (e.shiftKey && anchorCell.value) {
    setSelection(row, col, true)
  } else {
    setSelection(row, col, false)
  }

  isDragging.value = true
  dragStart.value = { x: e.clientX, y: e.clientY }
}

function onCellMouseEnter(row: number, col: number) {
  if (!isDragging.value) return
  // 拖拽经过单元格时，将焦点单元格更新到当前格，形成矩形选区
  focusCell.value = { row, col }
}

function endDrag() {
  isDragging.value = false
  dragStart.value = null
}

function onCellMouseUp() {
  endDrag()
}

function onEditTab() {
  if (!editingCell.value) return
  const { row, col } = editingCell.value
  commitEdit()
  const next = clampCell(row, col + 1)
  startEditAtCell(next.row, next.col)
}

function commitEdit() {
  if (!editingCell.value) return
  const { row, col } = editingCell.value
  emit('update', { row, col, value: editingValue.value })
  editingCell.value = null
}

function cancelEdit() {
  editingCell.value = null
}

// ====== 复制 / 粘贴 ======
function buildClipboardText(): string {
  if (!selection.value) return ''
  const s = selection.value
  const lines: string[] = []
  for (let r = s.minRow; r <= s.maxRow; r++) {
    const cells: string[] = []
    for (let c = s.minCol; c <= s.maxCol; c++) {
      cells.push(getCellValue(r, c))
    }
    lines.push(cells.join('\t'))
  }
  return lines.join('\n')
}

async function copySelection() {
  if (!selection.value) return
  const text = buildClipboardText()
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    // 回退：使用隐藏 textarea
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    try {
      document.execCommand('copy')
    } catch { /* ignore */ }
    document.body.removeChild(ta)
  }
}

function parseClipboard(text: string): string[][] {
  // 兼容 \r\n 与 \n，按行拆分；行内按 \t 拆分（Excel 通用 TSV）
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  // 去掉末尾可能的空行
  while (lines.length && lines[lines.length - 1] === '') lines.pop()
  return lines.map((line) => line.split('\t'))
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
  if (!grid.length) return

  const srcRows = grid.length
  const srcCols = grid[0]?.length ?? 0
  if (srcRows === 0 || srcCols === 0) return

  const maxRow = Math.max(0, rowCount.value - 1)
  const maxCol = Math.max(0, colCount.value - 1)

  // 目标区域：优先取当前选区；若选区仅单格（或为空），则从起点按源大小 1:1 平铺
  const sel = selection.value
  let targetTop: number
  let targetLeft: number
  let targetRows: number
  let targetCols: number

  if (sel && (sel.maxRow > sel.minRow || sel.maxCol > sel.minCol)) {
    // 用户框选了一片区域：以选区的宽高为目标区域，循环填充
    targetTop = sel.minRow
    targetLeft = sel.minCol
    targetRows = sel.maxRow - sel.minRow + 1
    targetCols = sel.maxCol - sel.minCol + 1
  } else {
    // 单格（或被清空）：以该格为左上角，按源尺寸 1:1 填充
    const startRow = focusCell.value?.row ?? sel?.minRow ?? 0
    const startCol = focusCell.value?.col ?? sel?.minCol ?? 0
    targetTop = startRow
    targetLeft = startCol
    targetRows = srcRows
    targetCols = srcCols
  }

  // 循环平铺：源数据作为瓦片在目标区域内重复填充（与 Excel / 表格软件行为一致）
  for (let dr = 0; dr < targetRows; dr++) {
    const targetRow = targetTop + dr
    if (targetRow > maxRow) break
    for (let dc = 0; dc < targetCols; dc++) {
      const targetCol = targetLeft + dc
      if (targetCol > maxCol) break
      const srcRow = dr % srcRows
      const srcCol = dc % srcCols
      emit('update', { row: targetRow, col: targetCol, value: grid[srcRow][srcCol] })
    }
  }

  // 粘贴后选区覆盖实际粘贴区域
  const endRow = Math.min(targetTop + targetRows - 1, maxRow)
  const endCol = Math.min(targetLeft + targetCols - 1, maxCol)
  anchorCell.value = { row: targetTop, col: targetLeft }
  focusCell.value = { row: endRow, col: endCol }
}

// ====== 拖拽（填充列内容） ======
function removeDetectionObject(colIndex: number) {
  emit('remove-col', { col: colIndex })
}

// ====== 检测对象等待时间（表头「对象名 / 时间」） ======
const editingTimeCol = ref<number | null>(null)
const editingTimeValue = ref('')

function startTimeEdit(colIndex: number, time: string) {
  editingTimeCol.value = colIndex
  editingTimeValue.value = time
  nextTick(() => {
    const input = listRef.value?.querySelector(
      `.col-time-input[data-col="${colIndex}"]`
    ) as HTMLInputElement | null
    input?.focus()
    input?.select()
  })
}

function commitTimeEdit(col: { colIndex: number; name: string; time: string; rawTitle: string }) {
  if (editingTimeCol.value !== col.colIndex) return
  const raw = String(editingTimeValue.value ?? '').trim()
  const num = Number(raw)
  // 空值 / 非法值 / 0 视为未设置时间，后端走 SignalCheck
  const hasTime = raw !== '' && Number.isFinite(num) && num > 0
  const title = hasTime ? `${col.name} / ${num}` : col.name
  editingTimeCol.value = null
  if (title !== col.rawTitle) {
    emit('rename-col', { col: col.colIndex, title })
  }
}

function cancelTimeEdit() {
  editingTimeCol.value = null
}

function clearSelectionValues() {
  if (!selection.value) return
  const s = selection.value
  for (let r = s.minRow; r <= s.maxRow; r++) {
    for (let c = s.minCol; c <= s.maxCol; c++) {
      emit('update', { row: r, col: c, value: '' })
    }
  }
}

function onTagDrop(e: DragEvent, colIndex: number) {
  e.preventDefault()
  e.stopPropagation()
  const objName = e.dataTransfer?.getData('text/plain') || e.dataTransfer?.getData('application/x-dnd-node') || ''
  if (!objName) return
  // 换绑对象时保留该列已配置的等待时间
  const time = allColumns.value[colIndex]?.time || ''
  emit('rename-col', { col: colIndex, title: time ? `${objName} / ${time}` : objName })
}

function onHeaderDrop(e: DragEvent) {
  e.preventDefault()
  const objName = e.dataTransfer?.getData('text/plain') || e.dataTransfer?.getData('application/x-dnd-node') || ''
  if (!objName) return
  emit('add-col', { title: objName })
}

function onDragOver(e: DragEvent) {
  e.preventDefault()
}

// ====== 键盘事件：统一快捷键层（context 作用域，仅焦点在本组件容器内时生效） ======
const inList = () => !!listRef.value?.contains(document.activeElement)

/** 方向键移动 / Shift+方向键扩展选区（行为与迁移前一致） */
function applyArrow(dr: number, dc: number, extend: boolean) {
  if (!focusCell.value) {
    setSelection(0, 0, false)
    return
  }
  const next = clampCell(focusCell.value.row + dr, focusCell.value.col + dc)
  if (extend) {
    focusCell.value = next
  } else {
    setSelection(next.row, next.col, false)
  }
  scrollCellIntoView(next.row, next.col)
}

useShortcut({
  id: 'dtc:copy',
  keys: 'Ctrl+C',
  scope: 'context',
  desc: '复制 DTC 表格选区',
  when: inList,
  run: () => {
    void copySelection()
    return true
  },
})
useShortcut({
  id: 'dtc:paste',
  keys: 'Ctrl+V',
  scope: 'context',
  desc: '粘贴到 DTC 表格选区',
  when: inList,
  run: () => {
    void pasteSelection()
    return true
  },
})
useShortcut({
  id: 'dtc:moveUp',
  keys: 'ArrowUp',
  scope: 'context',
  desc: '向上移动 DTC 表格选区',
  when: inList,
  run: () => {
    applyArrow(-1, 0, false)
    return true
  },
})
useShortcut({
  id: 'dtc:moveDown',
  keys: 'ArrowDown',
  scope: 'context',
  desc: '向下移动 DTC 表格选区',
  when: inList,
  run: () => {
    applyArrow(1, 0, false)
    return true
  },
})
useShortcut({
  id: 'dtc:moveLeft',
  keys: 'ArrowLeft',
  scope: 'context',
  desc: '向左移动 DTC 表格选区',
  when: inList,
  run: () => {
    applyArrow(0, -1, false)
    return true
  },
})
useShortcut({
  id: 'dtc:moveRight',
  keys: 'ArrowRight',
  scope: 'context',
  desc: '向右移动 DTC 表格选区',
  when: inList,
  run: () => {
    applyArrow(0, 1, false)
    return true
  },
})
useShortcut({
  id: 'dtc:extendUp',
  keys: 'Shift+ArrowUp',
  scope: 'context',
  desc: '向上扩展 DTC 表格选区',
  when: inList,
  run: () => {
    applyArrow(-1, 0, true)
    return true
  },
})
useShortcut({
  id: 'dtc:extendDown',
  keys: 'Shift+ArrowDown',
  scope: 'context',
  desc: '向下扩展 DTC 表格选区',
  when: inList,
  run: () => {
    applyArrow(1, 0, true)
    return true
  },
})
useShortcut({
  id: 'dtc:extendLeft',
  keys: 'Shift+ArrowLeft',
  scope: 'context',
  desc: '向左扩展 DTC 表格选区',
  when: inList,
  run: () => {
    applyArrow(0, -1, true)
    return true
  },
})
useShortcut({
  id: 'dtc:extendRight',
  keys: 'Shift+ArrowRight',
  scope: 'context',
  desc: '向右扩展 DTC 表格选区',
  when: inList,
  run: () => {
    applyArrow(0, 1, true)
    return true
  },
})
useShortcut({
  id: 'dtc:clear',
  keys: 'Delete',
  scope: 'context',
  desc: '清空 DTC 表格选区内容',
  when: inList,
  run: () => {
    clearSelectionValues()
    return true
  },
})
useShortcut({
  id: 'dtc:clearBackspace',
  keys: 'Backspace',
  scope: 'context',
  desc: '清空 DTC 表格选区内容',
  when: inList,
  run: () => {
    clearSelectionValues()
    return true
  },
})
useShortcut({
  id: 'dtc:edit',
  keys: 'Enter',
  scope: 'context',
  desc: '编辑 DTC 表格当前单元格',
  when: inList,
  run: () => {
    if (focusCell.value) startEditAtCell(focusCell.value.row, focusCell.value.col)
    return true
  },
})
useShortcut({
  id: 'dtc:editF2',
  keys: 'F2',
  scope: 'context',
  desc: '编辑 DTC 表格当前单元格',
  when: inList,
  run: () => {
    if (focusCell.value) startEditAtCell(focusCell.value.row, focusCell.value.col)
    return true
  },
})

function startEditAtCell(row: number, col: number) {
  const cell = document.querySelector(`.dtc-row[data-row="${row}"] .row-cell[data-col="${col}"]`) as HTMLElement | null
  editingCell.value = { row, col }
  editingValue.value = getCellValue(row, col)
  requestAnimationFrame(() => {
    if (cell) {
      const rect = cell.getBoundingClientRect()
      editStyle.value = {
        top: `${rect.top}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
      }
    }
    nextTick(() => {
      editInputRef.value?.focus()
      editInputRef.value?.select()
    })
  })
}

function scrollCellIntoView(row: number, col: number) {
  const cell = document.querySelector(`.dtc-row[data-row="${row}"] .row-cell[data-col="${col}"]`) as HTMLElement | null
  cell?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
}

onMounted(() => {
  window.addEventListener('mouseup', endDrag)
  window.addEventListener('mousemove', onResizeMove)
  window.addEventListener('mouseup', endResize)
  syncColWidths()
})

onBeforeUnmount(() => {
  window.removeEventListener('mouseup', endDrag)
  window.removeEventListener('mousemove', onResizeMove)
  window.removeEventListener('mouseup', endResize)
})
</script>

<template>
  <div ref="listRef" class="dtc-card-list" tabindex="0">
    <div v-if="dtcItems.length === 0" class="empty-state">
      <Warning class="empty-icon" />
      <span>暂无 DTC 数据</span>
    </div>

    <template v-else>
      <!-- 表头 -->
      <div class="dtc-header" :style="{ gridTemplateColumns }" @dragover="onDragOver" @drop="onHeaderDrop">
        <div
          v-for="col in allColumns"
          :key="col.colIndex"
          class="header-cell"
          :class="{ 'detection-col': col.isDetection, matched: col.matched, unmatched: col.matched === false }"
          @dragover.stop.prevent="onDragOver"
          @drop="(e) => col.isDetection && onTagDrop(e, col.colIndex)"
        >
          <template v-if="col.isDetection">
            <div class="col-head">
              <el-icon v-if="col.matched === false" class="col-warning" title="未匹配对象"><Warning /></el-icon>
              <span class="col-name" :title="col.name || '未配置'">{{ col.name || '未配置' }}</span>
              <el-icon class="col-delete" @click.stop="removeDetectionObject(col.colIndex)"><Close /></el-icon>
            </div>
            <input
              v-if="editingTimeCol === col.colIndex"
              class="col-time-input"
              :data-col="col.colIndex"
              type="number"
              min="0"
              placeholder="时间"
              v-model="editingTimeValue"
              @click.stop
              @keyup.enter="commitTimeEdit(col)"
              @keyup.esc="cancelTimeEdit"
              @blur="commitTimeEdit(col)"
            />
            <span
              v-else
              class="col-time"
              :class="{ 'is-empty': !col.time }"
              :title="col.time
                ? `检测等待时间：${col.time}（SignalWaitCheck），点击修改`
                : '未设置等待时间（SignalCheck），点击设置'"
              @click.stop="startTimeEdit(col.colIndex, col.time)"
            >{{ col.time ? `时间 ${col.time}` : '时间 —' }}</span>
          </template>
          <template v-else>
            <span class="col-name" :title="col.name">{{ col.name }}</span>
          </template>
          <span
            class="resize-handle"
            @mousedown.prevent.stop="(e) => startResize(e, col.colIndex)"
          ></span>
        </div>
        <div v-if="allColumns.length <= detectionStartCol" class="header-hint">
          拖拽对象到此处新增检测对象
        </div>
      </div>

      <!-- DTC 行 -->
      <div
        v-for="item in dtcItems"
        :key="item.rowIndex"
        class="dtc-row"
        :data-row="item.rowIndex"
        :style="{ gridTemplateColumns }"
        :class="{ 'is-selected': item.rowIndex === selectedRow }"
        @click="onRowClick(item.rowIndex)"
      >
        <div
          v-for="col in allColumns"
          :key="col.colIndex"
          class="row-cell"
          :data-row="item.rowIndex"
          :data-col="col.colIndex"
          :class="{
            'detection-col': col.isDetection,
            'cell-selected': isCellSelected(item.rowIndex, col.colIndex),
          }"
          @mousedown.prevent="(e) => onCellMouseDown(e, item.rowIndex, col.colIndex)"
          @mouseenter="(e) => onCellMouseEnter(item.rowIndex, col.colIndex)"
          @mouseup="onCellMouseUp"
          @click.stop="(e) => onCellClick(e, item.rowIndex, col.colIndex)"
          @dblclick="(e) => startEdit(item.rowIndex, col.colIndex, item.cells[col.colIndex] || (col.isDetection ? '0' : ''), e)"
        >
          <span class="cell-text" :title="item.cells[col.colIndex]">
            {{ item.cells[col.colIndex] || (col.isDetection ? '0' : '') }}
          </span>
        </div>
      </div>
    </template>
  </div>

  <input
    v-if="editingCell"
    ref="editInputRef"
    class="dtc-edit-input"
    :style="editStyle"
    v-model="editingValue"
    @blur="commitEdit"
    @keyup.enter="commitEdit"
    @keyup.esc="cancelEdit"
    @keydown.tab.prevent="onEditTab"
  />
</template>

<style scoped>
.dtc-card-list {
  display: flex;
  flex-direction: column;
  gap: 0;
  max-height: 520px;
  overflow-y: auto;
  overflow-x: auto;
  border: 1px solid var(--border-color-light);
  border-radius: 10px;
  outline: none;
}

.dtc-card-list:focus-visible {
  border-color: var(--color-primary);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--text-secondary);
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

/* ====== 表格布局 ====== */
.dtc-header,
.dtc-row {
  display: grid;
  align-items: center;
  min-height: 40px;
  width: max-content;
  min-width: 100%;
}

/* ====== 表头 ====== */
.dtc-header {
  background: var(--bg-card);
  position: sticky;
  top: 0;
  z-index: 10;
  border-bottom: 1px solid var(--border-color-light);
}

.header-cell {
  position: relative;
  padding: 3px 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 4px;
  border-right: 1px solid var(--border-color-light);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 列宽调整拖动条（定位在单元格右边缘） */
.resize-handle {
  position: absolute;
  top: 0;
  right: -4px;
  width: 8px;
  height: 100%;
  cursor: col-resize;
  z-index: 20;
  user-select: none;
}

.resize-handle:hover {
  background: var(--color-primary);
}

.header-cell:last-child {
  border-right: none;
}

.header-cell.detection-col {
  background: rgba(79, 70, 229, 0.04);
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
  gap: 1px;
  white-space: normal;
}

/* 检测对象表头：第一行对象名 */
.col-head {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

/* 检测对象表头：第二行等待时间（为空时后端走 SignalCheck） */
.col-time {
  font-size: 11px;
  font-weight: 400;
  color: var(--text-secondary);
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  &:hover {
    color: var(--color-primary);
  }

  &.is-empty {
    opacity: 0.5;
  }
}

.col-time-input {
  width: 100%;
  height: 18px;
  box-sizing: border-box;
  padding: 0 4px;
  font-size: 11px;
  font-weight: 400;
  color: var(--text-primary);
  background: var(--bg-card);
  border: 1px solid var(--color-primary);
  border-radius: 3px;
  outline: none;
}

.header-cell.detection-col.matched {
  color: var(--color-success);
}

.header-cell.detection-col.unmatched {
  color: var(--color-warning);
}

.col-warning {
  font-size: 13px;
  color: var(--color-warning);
  flex-shrink: 0;
}

.col-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.col-delete {
  font-size: 11px;
  opacity: 0.4;
  cursor: pointer;
  transition: opacity 0.2s;
  flex-shrink: 0;
}

.col-delete:hover {
  opacity: 1;
}

.header-hint {
  grid-column: 5 / -1;
  padding: 8px 12px;
  font-size: 12px;
  color: var(--text-secondary);
  font-style: italic;
}

/* ====== 行 ====== */
.dtc-row {
  border-bottom: 1px solid var(--border-color-lighter);
  transition: background 0.2s;
}

.dtc-row:last-child {
  border-bottom: none;
}

.dtc-row:hover {
  background: var(--bg-hover);
}

.dtc-row.is-selected {
  background: rgba(79, 70, 229, 0.08);
  outline: 1px solid rgba(79, 70, 229, 0.3);
  outline-offset: -1px;
}

.dtc-row.is-selected:hover {
  background: rgba(79, 70, 229, 0.12);
}

.row-cell {
  padding: 8px 12px;
  font-size: 12px;
  color: var(--text-regular);
  border-right: 1px solid var(--border-color-lighter);
  cursor: cell;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  user-select: none;
  -webkit-user-select: none;
}

.row-cell:last-child {
  border-right: none;
}

.row-cell.detection-col {
  background: rgba(79, 70, 229, 0.02);
  text-align: center;
}

/* 单元格选中高亮（Excel 式） */
.row-cell.cell-selected {
  background: rgba(79, 70, 229, 0.22);
  outline: 1px solid var(--color-primary);
  outline-offset: -1px;
}

.row-cell.cell-selected.detection-col {
  background: rgba(79, 70, 229, 0.28);
}

.cell-text {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ====== 编辑输入框 ====== */
.dtc-edit-input {
  position: fixed;
  z-index: 1000;
  padding: 6px 10px;
  border-radius: 4px;
  border: 2px solid var(--color-primary);
  background: var(--bg-card);
  font-size: 12px;
  outline: none;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  text-align: center;
  box-sizing: border-box;
}
</style>
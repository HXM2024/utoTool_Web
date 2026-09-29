<!--
  DtcTable.vue - DTC 表（可编辑、拖拽关联、匹配提示）
  - 单元格双击可编辑
  - 第 4 列（索引 3）后的表头与 DBC/A2L 对象检索匹配
  - 未匹配的表头显示黄色感叹号，拖拽对象可建立/恢复关联
  - 也可通过拖拽对象添加新表头
-->
<template>
  <div class="dtc-table-wrapper" ref="wrapperRef">
    <el-auto-resizer>
      <template #default="{ height: autoHeight, width }">
        <el-table-v2
          :columns="tableColumns"
          :data="tableData"
          :width="width"
          :height="height || autoHeight"
          :row-height="36"
          :header-height="60"
          fixed
        >
          <template #empty>
            <div class="table-empty">
              <el-icon class="empty-icon"><DataBoard /></el-icon>
              <span>暂无数据</span>
            </div>
          </template>
        </el-table-v2>
      </template>
    </el-auto-resizer>
    <!-- 新增列拖拽区域 -->
    <div
      class="dtc-add-col-zone"
      :class="{ 'drag-over': addColDragOver }"
      @dragover.prevent="addColDragOver = true"
      @dragleave="addColDragOver = false"
      @drop="onAddColDrop"
    >
      <span class="add-col-icon">＋</span>
      <span class="add-col-text">新增列</span>
    </div>
    <!-- 表头编辑浮动 input -->
    <input
      v-if="editingHeader !== null"
      class="dtc-header-input"
      :style="{
        left: headerEditPos.left + 'px',
        top: headerEditPos.top + 'px',
        width: headerEditPos.width + 'px',
        height: headerEditPos.height + 'px',
      }"
      v-model="editingHeaderValue"
      @blur="commitHeaderEdit"
      @keyup.enter="commitHeaderEdit"
      @keyup.esc="cancelHeaderEdit"
      ref="headerInputRef"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, h, nextTick, onMounted } from 'vue'
import { DataBoard } from '@element-plus/icons-vue'
import type { Column as ElColumn } from 'element-plus'

const props = withDefaults(defineProps<{
  columns: { key: string; title: string; width?: number; matched?: boolean; matchedName?: string }[]
  data: any[]
  height?: number
  /** 对象检索：传入 DBC 信号名 + A2L 变量名集合，用于判断表头是否匹配 */
  objectNames?: Set<string>
  /** 起始列索引（D 列后的列才进行对象匹配，例：D 列是 c3） */
  matchFromColIndex?: number
}>(), {
  height: 0,
  objectNames: () => new Set(),
  matchFromColIndex: 4,
})

const emit = defineEmits<{
  (e: 'cell-update', payload: { row: number; col: string; value: string }): void
  (e: 'header-update', payload: { col: string; value: string }): void
  (e: 'column-add', payload: { title: string }): void
  (e: 'header-bind', payload: { col: string; objectName: string }): void
}>()

const wrapperRef = ref<HTMLElement | null>(null)

// 编辑状态：单元格 / 表头
const editing = ref<{ row: number; col: string } | null>(null)
const editingValue = ref('')
const editingHeader = ref<string | null>(null)
const editingHeaderValue = ref('')
const headerInputRef = ref<HTMLInputElement | null>(null)

// 新增列拖拽状态
const addColDragOver = ref(false)

const tableData = computed(() => props.data)

function getCellValue(rowData: any, column: any): string {
  const key = column.dataKey || column.key
  const val = rowData?.[key]
  return val === null || val === undefined ? '' : String(val)
}

function renderCell(cellProps: any) {
  const { rowData, column } = cellProps
  const key = column.dataKey || column.key
  const isEditing = editing.value?.row === rowData.__row && editing.value?.col === key
  const val = getCellValue(rowData, column)

  if (isEditing) {
    return h('div', {
      class: 'dtc-cell dtc-cell-editing',
      'data-row': rowData.__row,
      'data-col': key,
      onDrop: (e: DragEvent) => onCellDrop(e, rowData.__row, key),
      onDragover: (e: DragEvent) => { e.preventDefault() },
    }, [
      h('input', {
        class: 'dtc-edit-input',
        value: editingValue.value,
        onInput: (e: Event) => { editingValue.value = (e.target as HTMLInputElement).value },
        onBlur: commitEdit,
        onKeyup: (e: KeyboardEvent) => {
          if (e.key === 'Enter') commitEdit()
          else if (e.key === 'Escape') cancelEdit()
        },
        ref: (el: any) => {
          if (el) nextTick(() => el.focus())
        },
      }),
    ])
  }

  return h('div', {
    class: 'dtc-cell',
    'data-row': rowData.__row,
    'data-col': key,
    onDblclick: () => startEdit(rowData.__row, key, val),
    onDrop: (e: DragEvent) => onCellDrop(e, rowData.__row, key),
    onDragover: (e: DragEvent) => { e.preventDefault() },
  }, val)
}

function startEdit(row: number, col: string, val: string) {
  editing.value = { row, col }
  editingValue.value = val
}

const tableColumns = computed<ElColumn<any>[]>(() => {
  return props.columns.map((col, idx) => {
    const isMatchCol = idx >= props.matchFromColIndex
    const colDef: ElColumn<any> = {
      key: col.key,
      dataKey: col.key,
      title: col.title,
      width: col.width ?? 160,
      cellRenderer: renderCell,
      headerClass: 'dtc-header-editable',
    }
    ;(colDef as any)._colMeta = {
      ...col,
      index: idx,
      isMatchCol,
    }
    return colDef
  })
})

function commitEdit() {
  if (editing.value) {
    emit('cell-update', {
      row: editing.value.row,
      col: editing.value.col,
      value: editingValue.value,
    })
  }
  editing.value = null
}

function cancelEdit() {
  editing.value = null
}

function onCellDrop(e: DragEvent, row: number, col: string) {
  e.preventDefault()
  const objName = e.dataTransfer?.getData('text/plain') || e.dataTransfer?.getData('application/x-dnd-node') || ''
  if (!objName) return
  emit('cell-update', { row, col, value: objName })
}

/** 拖拽对象到新增列区域：新增一列 */
function onAddColDrop(e: DragEvent) {
  e.preventDefault()
  addColDragOver.value = false
  const objName = e.dataTransfer?.getData('text/plain') || e.dataTransfer?.getData('application/x-dnd-node') || ''
  if (!objName) return
  emit('column-add', { title: objName })
}

// ==================== 表头双击编辑 ====================

/** 表头双击：进入编辑 */
function onHeaderDblClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  const headerEl = target.closest('.el-table-v2__header-cell') as HTMLElement | null
  if (!headerEl) return
  const headerCells = wrapperRef.value?.querySelectorAll('.el-table-v2__header-cell')
  if (!headerCells) return
  const cellIndex = Array.from(headerCells).indexOf(headerEl)
  if (cellIndex < 0 || cellIndex >= props.columns.length) return
  const col = props.columns[cellIndex]
  if (!col) return
  editingHeader.value = col.key
  editingHeaderValue.value = col.title.replace(/^⚠\s*/, '')
  // 定位浮动 input 到表头位置
  nextTick(() => {
    const rect = headerEl.getBoundingClientRect()
    const wrapperRect = wrapperRef.value!.getBoundingClientRect()
    headerEditPos.value = {
      left: rect.left - wrapperRect.left,
      top: rect.top - wrapperRect.top,
      width: rect.width,
      height: rect.height,
    }
    nextTick(() => headerInputRef.value?.focus())
  })
}

const headerEditPos = ref({ left: 0, top: 0, width: 0, height: 0 })

function commitHeaderEdit() {
  if (editingHeader.value !== null) {
    emit('header-update', {
      col: editingHeader.value,
      value: editingHeaderValue.value,
    })
  }
  editingHeader.value = null
}

function cancelHeaderEdit() {
  editingHeader.value = null
}

onMounted(() => {
  const el = wrapperRef.value
  if (!el) return
  el.addEventListener('dblclick', onHeaderDblClick)
  // 表头拖拽放置：拖拽对象到表头建立关联
  el.addEventListener('dragover', (e: DragEvent) => {
    const target = e.target as HTMLElement
    if (target.closest('.el-table-v2__header-cell')) {
      e.preventDefault()
    }
  })
  el.addEventListener('drop', (e: DragEvent) => {
    const target = e.target as HTMLElement
    const headerEl = target.closest('.el-table-v2__header-cell') as HTMLElement | null
    if (!headerEl) return
    e.preventDefault()
    const objName = e.dataTransfer?.getData('text/plain') || e.dataTransfer?.getData('application/x-dnd-node') || ''
    if (!objName) return
    const headerCells = el.querySelectorAll('.el-table-v2__header-cell')
    const cellIndex = Array.from(headerCells).indexOf(headerEl)
    if (cellIndex < 0 || cellIndex >= props.columns.length) return
    const col = props.columns[cellIndex]
    if (!col) return
    emit('header-update', { col: col.key, value: objName })
  })
})

// 暴露给父组件
function isHeaderMatched(colKey: string): boolean {
  return props.objectNames.has(colKey)
}

defineExpose({ isHeaderMatched })
</script>

<style scoped lang="scss">
.dtc-table-wrapper {
  width: 100%;
  height: 100%;
}

.table-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--text-secondary);
  padding: 40px;
  .empty-icon { font-size: 36px; opacity: 0.3; }
}

:deep(.el-table-v2) {
  --el-table-border-color: var(--border-color-light);
  --el-table-header-bg-color: var(--bg-sidebar);
  --el-table-row-hover-bg-color: var(--bg-hover);
  --el-table-bg-color: var(--bg-card);
  --el-table-text-color: var(--text-regular);
  --el-table-header-text-color: var(--text-primary);

  .el-table-v2__header-cell {
    font-weight: 600;
  }
}

:deep(.dtc-cell) {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  padding: 0 8px;
  cursor: text;
  outline: none;
  font-size: 13px;
  color: var(--text-regular);
  box-sizing: border-box;
}

:deep(.dtc-cell-editing) {
  padding: 3px 8px;
}

:deep(.dtc-edit-input) {
  width: 100%;
  height: 100%;
  border: 1px solid var(--color-primary);
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 13px;
  outline: none;
  background: var(--bg-card);
  color: var(--text-primary);
  box-sizing: border-box;

  &:focus {
    box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.2);
  }
}

.dtc-header-input {
  position: absolute;
  z-index: 100;
  border: 2px solid var(--color-primary);
  border-radius: 4px;
  padding: 0 8px;
  font-size: 13px;
  font-weight: 600;
  outline: none;
  background: var(--bg-card);
  color: var(--text-primary);
  box-sizing: border-box;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);

  &:focus {
    box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.2);
  }
}

:deep(.dtc-header-editable) {
  cursor: pointer;

  &:hover {
    background: rgba(79, 70, 229, 0.05);
  }
}

.dtc-add-col-zone {
  position: absolute;
  top: 0;
  right: 0;
  width: 80px;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding-top: 18px;
  cursor: pointer;
  color: var(--text-secondary);
  background: var(--bg-card);
  border-left: 1px dashed var(--border-color-light);
  transition: all 0.2s;
  z-index: 10;

  &:hover, &.drag-over {
    background: rgba(79, 70, 229, 0.08);
    color: var(--color-primary);
    border-left-color: var(--color-primary);
  }

  .add-col-icon {
    font-size: 20px;
    line-height: 1;
  }

  .add-col-text {
    font-size: 12px;
    margin-top: 4px;
  }
}
</style>

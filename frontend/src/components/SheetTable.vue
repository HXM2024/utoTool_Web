<script setup lang="ts">
/**
 * SheetTable - 通用 sheet 表格组件
 *
 * 用于在 UDS 服务节点详情面板中展示和编辑 Excel sheet 数据。
 * 数据格式：{ columns: string[], rows: (string|null)[][] }
 * 第一行通常是表头（来自 Excel 原始行），数据行从第二行开始。
 */
import { computed, ref } from 'vue'
import { Plus, Delete } from '@element-plus/icons-vue'

interface SheetData {
  columns: string[]
  rows: (string | null)[][]
}

const props = defineProps<{
  sheet?: SheetData
  columnsOverride?: string[]
  readonly?: boolean
}>()

// 当传入 columnsOverride 时，用其替换原始列名（用于规范化表头）
const displayColumns = computed(() => {
  if (!props.sheet) return []
  if (props.columnsOverride && props.columnsOverride.length) {
    return props.columnsOverride
  }
  return props.sheet.columns || []
})

// 数据行：跳过第一行（原始表头），保留所有数据行
const displayRows = computed(() => {
  if (!props.sheet || !props.sheet.rows) return []
  // 如果第一行与 columns 相同（原始表头），跳过
  const rows = props.sheet.rows
  if (rows.length === 0) return []
  // 检查第一行是否是表头（与 columns 重复）
  const firstRow = rows[0]
  const cols = props.sheet.columns || []
  const isFirstRowHeader = firstRow && cols.length > 0 &&
    firstRow.slice(0, Math.min(firstRow.length, cols.length)).every((v, i) =>
      v === cols[i] || (v === null && cols[i] === null)
    )
  return isFirstRowHeader ? rows.slice(1) : rows
})

// 列数（用于补齐行数据）
const colCount = computed(() => displayColumns.value.length)

// 确保行数据与列数对齐（补 null）
function getCell(row: (string | null)[], colIndex: number): string {
  if (colIndex >= row.length) return ''
  const v = row[colIndex]
  return v === null || v === undefined ? '' : String(v)
}

function setCell(row: (string | null)[], colIndex: number, value: string) {
  // 补齐到 colIndex+1 长度
  while (row.length < colIndex + 1) row.push(null)
  row[colIndex] = value || null
}

function addRow() {
  if (!props.sheet) return
  if (!props.sheet.rows) props.sheet.rows = []
  const newRow: (string | null)[] = new Array(colCount.value).fill(null)
  props.sheet.rows.push(newRow)
}

function removeRow(index: number) {
  if (!props.sheet || !props.sheet.rows) return
  // index 是 displayRows 中的索引，需转换为 sheet.rows 中的索引
  const rows = props.sheet.rows
  // 如果第一行是表头，实际索引要+1
  const firstRow = rows[0]
  const cols = props.sheet.columns || []
  const isFirstRowHeader = firstRow && cols.length > 0 &&
    firstRow.slice(0, Math.min(firstRow.length, cols.length)).every((v, i) =>
      v === cols[i] || (v === null && cols[i] === null)
    )
  const actualIndex = isFirstRowHeader ? index + 1 : index
  rows.splice(actualIndex, 1)
}

const isEmpty = computed(() => displayRows.value.length === 0)
</script>

<template>
  <div class="sheet-table-wrapper">
    <div class="sheet-table-header">
      <span class="row-count">共 {{ displayRows.length }} 行</span>
      <el-button v-if="!readonly" :icon="Plus" size="small" type="primary" plain @click="addRow">
        添加行
      </el-button>
    </div>

    <el-table
      v-if="!isEmpty"
      :data="displayRows"
      border
      size="small"
      class="sheet-table"
      max-height="280"
    >
      <el-table-column type="index" label="#" width="40" fixed="left" />
      <el-table-column
        v-for="(col, ci) in displayColumns"
        :key="ci"
        :label="col"
        :min-width="col.length > 6 ? 140 : 90"
      >
        <template #default="{ row, $index }">
          <el-input
            v-if="!readonly"
            :model-value="getCell(row, ci)"
            size="small"
            @update:model-value="(v: string) => setCell(row, ci, v)"
          />
          <span v-else>{{ getCell(row, ci) }}</span>
        </template>
      </el-table-column>
      <el-table-column v-if="!readonly" label="操作" width="50" fixed="right">
        <template #default="{ $index }">
          <el-button
            type="danger"
            :icon="Delete"
            size="small"
            link
            @click="removeRow($index)"
          />
        </template>
      </el-table-column>
    </el-table>

    <div v-else class="empty-sheet">
      <span>暂无数据</span>
      <el-button v-if="!readonly" :icon="Plus" size="small" type="primary" plain @click="addRow">
        添加首行
      </el-button>
    </div>
  </div>
</template>

<style scoped>
.sheet-table-wrapper {
  width: 100%;
}

.sheet-table-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  padding: 0 4px;
}

.row-count {
  font-size: 12px;
  color: #909399;
}

.sheet-table {
  width: 100%;
}

.sheet-table :deep(.el-input__inner) {
  padding: 0 6px;
  font-size: 12px;
}

.sheet-table :deep(.el-table__cell) {
  padding: 2px 0;
}

.empty-sheet {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px;
  color: #909399;
  font-size: 12px;
}
</style>

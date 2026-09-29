<template>
  <div class="data-table-wrapper">
    <el-auto-resizer>
      <template #default="{ height: autoHeight, width }">
        <el-table-v2
          :columns="tableColumns"
          :data="data"
          :width="width"
          :height="height || autoHeight"
          :row-height="44"
          :header-height="44"
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
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { DataBoard } from '@element-plus/icons-vue'
import type { Column as ElColumn } from 'element-plus'
import type { Column } from '@/types'

const props = withDefaults(defineProps<{
  columns: Column[]
  data: any[]
  height?: number
}>(), {
  height: 0,
})

const tableColumns = computed<ElColumn<any>[]>(() =>
  props.columns.map((col) => {
    const column: ElColumn<any> = {
      key: col.key,
      dataKey: col.key,
      title: col.title,
      width: col.width ?? 150,
      sortable: col.sortable ?? true,
    }
    return column
  })
)

</script>

<style scoped lang="scss">
.data-table-wrapper {
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

  .empty-icon {
    font-size: 36px;
    opacity: 0.3;
  }
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
</style>

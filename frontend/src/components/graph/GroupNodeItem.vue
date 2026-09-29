<template>
  <div
    class="group-node"
    :class="[`gn-${node.lane}`, { selected }]"
    :style="{ left: node.x + 'px', top: node.y + 'px', width: NODE_W + 'px' }"
    @click.stop="emit('select', node.id)"
    @mousedown.stop="onNodeDown($event)"
  >
    <div class="gn-head">
      <span class="gn-badge">{{ CARD_TYPE_LABEL[node.lane] }}</span>
      <span class="gn-title">{{ nodeLabel }}</span>
      <el-tooltip :content="node.fanout === 'single' ? '单口：卡片合并依次执行' : '多口：每卡一口'">
        <el-button
          size="small"
          class="fanout-btn"
          :type="node.fanout === 'single' ? 'warning' : 'primary'"
          plain
          @click.stop="emit('toggle-fanout', node.id)"
        >
          {{ node.fanout === 'single' ? '单口' : '多口' }} ×{{ portCount }}
        </el-button>
      </el-tooltip>
      <el-icon class="gn-del" @click.stop="emit('remove', node.id)"><Close /></el-icon>
    </div>
    <div class="gn-body">
      <div v-for="card in node.cards" :key="card.id" class="gn-card">
        <el-tooltip v-if="card.refId" content="引用卡片：库里改后自动同步" placement="top">
          <span class="gn-card-ref">⛓</span>
        </el-tooltip>
        <span class="gn-card-name">{{ card.name || '(未命名)' }}</span>
        <span class="gn-card-steps">{{ card.steps.length }}步</span>
      </div>
    </div>

    <!-- 输入端口（sequence/result 左侧） -->
    <template v-if="node.lane !== 'inject'">
      <div
        v-for="p in portIndexes"
        :key="'in-' + p"
        class="gn-port gn-port-in"
        :style="{ top: portTop(p) + 'px' }"
        @mousedown.stop="emit('port-down', node.id, p, 'in')"
        @mouseup.stop="emit('port-up', node.id, p, 'in')"
      />
    </template>
    <!-- 输出端口（inject/sequence 右侧） -->
    <template v-if="node.lane !== 'result'">
      <div
        v-for="p in portIndexes"
        :key="'out-' + p"
        class="gn-port gn-port-out"
        :style="{ top: portTop(p) + 'px' }"
        @mousedown.stop="emit('port-down', node.id, p, 'out')"
        @mouseup.stop="emit('port-up', node.id, p, 'out')"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Close } from '@element-plus/icons-vue'
import type { GroupNode } from '@/types/functionGraph'
import {
  CARD_TYPE_LABEL,
  NODE_W,
  portTop,
  portCountOf,
} from '@/utils/functionGraph'

const props = defineProps<{
  node: GroupNode
  selected: boolean
}>()
const emit = defineEmits<{
  (e: 'select', nodeId: string): void
  (e: 'toggle-fanout', nodeId: string): void
  (e: 'remove', nodeId: string): void
  (e: 'edit-card', nodeId: string, cardId: string): void
  (e: 'node-down', nodeId: string, event: MouseEvent): void
  (e: 'port-down', nodeId: string, portIndex: number, side: 'in' | 'out'): void
  (e: 'port-up', nodeId: string, portIndex: number, side: 'in' | 'out'): void
}>()

const portCount = computed(() => portCountOf(props.node))
const portIndexes = computed(() => Array.from({ length: portCount.value }, (_, i) => i))
const nodeLabel = computed(() =>
  props.node.fanout === 'single'
    ? props.node.cards.map((c) => c.name).join(' + ')
    : props.node.cards.length + ' 张卡片',
)

function onNodeDown(e: MouseEvent) {
  emit('node-down', props.node.id, e)
}
</script>

<style scoped>
.group-node {
  position: absolute;
  background: #fff;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  user-select: none;
  transition: box-shadow 0.15s, border-color 0.15s;
}
.group-node:hover {
  box-shadow: 0 2px 10px rgba(91, 141, 239, 0.2);
  border-color: var(--el-color-primary);
}
.group-node.selected {
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.3);
}
.gn-inject { border-left: 3px solid #e6a23c; }
.gn-sequence { border-left: 3px solid var(--el-color-primary); }
.gn-result { border-left: 3px solid #67c23a; }

.gn-head {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 6px;
  border-bottom: 1px solid #f0f2f5;
  font-size: 11px;
}
.gn-badge {
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 700;
  white-space: nowrap;
}
.gn-inject .gn-badge { background: #fdf6ec; color: #e6a23c; }
.gn-sequence .gn-badge { background: #ecf5ff; color: var(--el-color-primary); }
.gn-result .gn-badge { background: #f0f9eb; color: #67c23a; }
.gn-title {
  flex: 1;
  font-weight: 600;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.fanout-btn {
  padding: 2px 6px !important;
  height: 20px !important;
  font-size: 10px !important;
}
.gn-del {
  cursor: pointer;
  color: #c0c4cc;
  font-size: 12px;
  flex-shrink: 0;
}
.gn-del:hover { color: #f56c6c; }

.gn-body {
  padding: 4px 6px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-height: 24px;
}
.gn-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #f5f7fa;
  border-radius: 3px;
  padding: 2px 6px;
  font-size: 11px;
}
.gn-card-ref {
  font-size: 9px;
  margin-right: 3px;
  flex-shrink: 0;
  color: var(--el-color-primary);
}
.gn-card-name {
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}
.gn-card-steps {
  color: #909399;
  font-size: 10px;
}

.gn-port {
  position: absolute;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #fff;
  border: 2px solid #c0c4cc;
  z-index: 3;
  cursor: crosshair;
  transition: all 0.15s;
}
.gn-port:hover {
  transform: scale(1.4);
  border-color: var(--el-color-primary);
  background: var(--el-color-primary);
}
.gn-port-in { left: -8px; border-color: #67c23a; }
.gn-port-out { right: -8px; border-color: var(--el-color-primary); }
</style>

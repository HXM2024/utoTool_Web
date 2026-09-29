<template>
  <svg class="edge-layer" :style="{ width: svgW + 'px', height: svgH + 'px' }">
    <defs>
      <marker id="graph-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
        <path d="M0,0 L8,4 L0,8 Z" fill="#1890ff" />
      </marker>
      <marker id="graph-arrow-active" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
        <path d="M0,0 L8,4 L0,8 Z" fill="#e6a23c" />
      </marker>
    </defs>
    <path
      v-for="e in edges"
      :key="e.id"
      :d="edgePath(e)"
      :class="['edge-path', { 'edge-selected': selectedEdgeId === e.id }]"
      :stroke="selectedEdgeId === e.id ? '#e6a23c' : '#1890ff'"
      :stroke-width="selectedEdgeId === e.id ? 4 : 2"
      fill="none"
      :marker-end="selectedEdgeId === e.id ? 'url(#graph-arrow-active)' : 'url(#graph-arrow)'"
      @click.stop="onEdgeClick(e.id)"
      @dblclick.stop="onEdgeDblClick(e.id)"
    />
  </svg>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Edge, GroupNode } from '@/types/functionGraph'
import { NODE_W, portTop } from '@/utils/functionGraph'

const props = defineProps<{
  edges: Edge[]
  nodes: GroupNode[]
  svgW: number
  svgH: number
}>()
const emit = defineEmits<{
  (e: 'remove-edge', edgeId: string): void
}>()

// 连线规则：单击高亮（再点一次取消），双击删除
const selectedEdgeId = ref('')
function onEdgeClick(edgeId: string) {
  selectedEdgeId.value = selectedEdgeId.value === edgeId ? '' : edgeId
}
function onEdgeDblClick(edgeId: string) {
  selectedEdgeId.value = ''
  emit('remove-edge', edgeId)
}

function nodeOf(id: string): GroupNode | undefined {
  return props.nodes.find((n) => n.id === id)
}

/** 端口锚点：side=out 右侧，side=in 左侧 */
function portPos(node: GroupNode, portIndex: number, side: 'in' | 'out') {
  return {
    x: side === 'out' ? node.x + NODE_W : node.x,
    y: node.y + portTop(portIndex),
  }
}

function edgePath(e: Edge): string {
  const from = nodeOf(e.from.nodeId)
  const to = nodeOf(e.to.nodeId)
  if (!from || !to) return ''
  const p1 = portPos(from, e.from.portIndex, 'out')
  const p2 = portPos(to, e.to.portIndex, 'in')
  const dx = Math.abs(p2.x - p1.x) * 0.5 + 20
  return `M ${p1.x},${p1.y} C ${p1.x + dx},${p1.y} ${p2.x - dx},${p2.y} ${p2.x},${p2.y}`
}
</script>

<style scoped>
.edge-layer {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  overflow: visible;
}
.edge-path {
  pointer-events: stroke;
  cursor: pointer;
}
.edge-path:hover {
  stroke-width: 3;
  opacity: 0.8;
}
.edge-path.edge-selected,
.edge-path.edge-selected:hover {
  stroke-width: 4;
  opacity: 1;
  filter: drop-shadow(0 0 4px rgba(230, 162, 60, 0.85));
}
</style>

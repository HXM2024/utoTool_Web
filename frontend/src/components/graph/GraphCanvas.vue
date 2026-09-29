<template>
  <div class="graph-canvas">
    <div class="gc-toolbar">
      <el-button-group size="small">
        <el-button :icon="ZoomIn" @click="zoomBy(1.2)" title="放大" />
        <el-button :icon="ZoomOut" @click="zoomBy(0.8)" title="缩小" />
        <el-button :icon="Refresh" @click="resetView" title="重置视图" />
      </el-button-group>
      <span class="gc-scale">{{ Math.round(scale * 100) }}%</span>
      <div class="gc-spacer" />
      <el-tag size="small" type="info">{{ graph.nodes.length }} 节点</el-tag>
      <el-tag size="small" type="warning">{{ graph.edges.length }} 连线</el-tag>
    </div>

    <div class="gc-body">
      <div
        ref="bgRef"
        class="gc-bg"
        @wheel.prevent="onWheel"
        @mousedown.self="onBgDown"
        @drop.prevent="onDrop"
        @dragover.prevent
      >
        <div class="gc-content" :style="contentStyle">
          <!-- 三泳道分区 -->
          <div
            v-for="z in zones"
            :key="z.lane"
            class="gc-zone"
            :class="`zone-${z.lane}`"
            :style="{ left: z.x + 'px', width: ZONE_W + 'px', height: svgH + 'px' }"
          >
            <div class="gc-zone-label">{{ CARD_TYPE_LABEL[z.lane] }}</div>
          </div>

          <EdgeLayer
            :edges="graph.edges"
            :nodes="graph.nodes"
            :svg-w="svgW"
            :svg-h="svgH"
            @remove-edge="removeEdge"
          />

          <!-- 临时连线 -->
          <svg class="gc-temp-svg" :style="{ width: svgW + 'px', height: svgH + 'px' }">
            <path
              v-if="tempLine"
              :d="tempPath"
              stroke="#1890ff"
              stroke-width="2"
              stroke-dasharray="5,3"
              fill="none"
            />
          </svg>

          <GroupNodeItem
            v-for="n in graph.nodes"
            :key="n.id"
            :node="n"
            :selected="selectedNodeId === n.id"
            @select="selectedNodeId = $event; emit('select-node', $event)"
            @toggle-fanout="toggleFanout"
            @remove="removeNode"
            @node-down="onNodeDown"
            @port-down="onPortDown"
            @port-up="onPortUp"
          />
        </div>
      </div>
    </div>

    <div class="gc-hint">
      拖卡片到泳道创建节点 · 双击卡片直接编辑 · 节点右上角切换单口/多口 · 从右端口拖到左端口连线 · 单击连线高亮 · 双击连线删除
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ZoomIn, ZoomOut, Refresh } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import type { Card, CardType, Edge, Graph, GroupNode } from '@/types/functionGraph'
import { genId } from '@/types/functionGraph'
import {
  CARD_TYPE_LABEL,
  NODE_W,
  portTop,
  portCountOf,
  nodeHeightOf,
  newNode,
} from '@/utils/functionGraph'
import GroupNodeItem from './GroupNodeItem.vue'
import EdgeLayer from './EdgeLayer.vue'

const props = defineProps<{
  graph: Graph
}>()
const emit = defineEmits<{
  (e: 'update:graph', graph: Graph): void
  (e: 'select-node', nodeId: string): void
  (e: 'edit-card', nodeId: string, cardId: string): void
}>()

const ZONE_W = 340
const ZONE_GAP = 20
const zones = [
  { lane: 'inject' as CardType, x: 20 },
  { lane: 'sequence' as CardType, x: 20 + ZONE_W + ZONE_GAP },
  { lane: 'result' as CardType, x: 20 + (ZONE_W + ZONE_GAP) * 2 },
]
const svgW = zones[2].x + ZONE_W + 100

const bgRef = ref<HTMLElement>()
const scale = ref(1)
const panX = ref(0)
const panY = ref(0)
const selectedNodeId = ref('')

const contentStyle = computed(() => ({
  transform: `translate(${panX.value}px, ${panY.value}px) scale(${scale.value})`,
  transformOrigin: '0 0',
}))

const svgH = computed(() => {
  let maxY = 0
  for (const n of props.graph.nodes) {
    maxY = Math.max(maxY, n.y + portTop(portCountOf(n) - 1) + 40)
  }
  return Math.max(420, maxY + 120)
})

// ===== 视图缩放/平移 =====
function zoomBy(f: number) {
  scale.value = Math.min(2.5, Math.max(0.3, scale.value * f))
}
function resetView() {
  scale.value = 1
  panX.value = 0
  panY.value = 0
}
function onWheel(e: WheelEvent) {
  const factor = e.deltaY < 0 ? 1.1 : 0.9
  const next = Math.min(2.5, Math.max(0.3, scale.value * factor))
  const rect = bgRef.value?.getBoundingClientRect()
  if (rect) {
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const ratio = next / scale.value
    panX.value = mx - (mx - panX.value) * ratio
    panY.value = my - (my - panY.value) * ratio
  }
  scale.value = next
}
const panDrag = ref<{ x: number; y: number; pX: number; pY: number } | null>(null)
function onBgDown(e: MouseEvent) {
  selectedNodeId.value = ''
  emit('select-node', '')
  panDrag.value = { x: e.clientX, y: e.clientY, pX: panX.value, pY: panY.value }
  window.addEventListener('mousemove', onPanMove)
  window.addEventListener('mouseup', onPanUp)
}
function onPanMove(e: MouseEvent) {
  if (!panDrag.value) return
  panX.value = panDrag.value.pX + (e.clientX - panDrag.value.x)
  panY.value = panDrag.value.pY + (e.clientY - panDrag.value.y)
}
function onPanUp() {
  panDrag.value = null
  window.removeEventListener('mousemove', onPanMove)
  window.removeEventListener('mouseup', onPanUp)
}

// ===== 拖卡片：命中已有同泳道组节点则加入集合，否则创建新节点 =====
function laneZoneOf(lane: CardType) {
  return zones.find((z) => z.lane === lane) || zones[0]
}
function onDrop(e: DragEvent) {
  const rect = bgRef.value?.getBoundingClientRect()
  if (!rect) return
  const lx = (e.clientX - rect.left - panX.value) / scale.value
  const ly = (e.clientY - rect.top - panY.value) / scale.value
  const raw = e.dataTransfer?.getData('application/x-graph-card')
  if (!raw) return
  let card: Card | null = null
  try {
    card = JSON.parse(raw) as Card
  } catch {
    return
  }
  if (!card) return

  // 1. 命中已有同泳道组节点 → 把卡片加入该集合（组节点内含多张卡片）
  //    保留 refId 指向卡片库来源，实现引用式复用（库里改后自动同步）
  const target = props.graph.nodes.find((n) => {
    if (n.lane !== card!.type) return false
    return lx >= n.x && lx <= n.x + NODE_W && ly >= n.y && ly <= n.y + nodeHeightOf(n)
  })
  if (target) {
    const added = { ...card, id: genId('card'), refId: card.refId ?? card.id }
    const next: Graph = {
      ...props.graph,
      nodes: props.graph.nodes.map((n) =>
        n.id === target.id ? { ...n, cards: [...n.cards, added] } : n,
      ),
    }
    emit('update:graph', next)
    selectedNodeId.value = target.id
    emit('select-node', target.id)
    ElMessage.success(`已将「${card.name}」加入组节点（共 ${target.cards.length + 1} 张卡片）`)
    return
  }

  // 2. 否则创建新组节点（初始 fanout=multi，内含 1 张卡片）
  const zone = laneZoneOf(card.type)
  const x = Math.min(zone.x + ZONE_W - NODE_W, Math.max(zone.x + 8, zone.x + 20))
  const node = newNode(card.type, card, x, ly - 30)
  const next: Graph = {
    ...props.graph,
    nodes: [...props.graph.nodes, node],
  }
  emit('update:graph', next)
  selectedNodeId.value = node.id
  emit('select-node', node.id)
  ElMessage.success(`已在「${CARD_TYPE_LABEL[card.type]}」泳道创建组节点`)
}

// ===== 扇出切换 =====
function toggleFanout(nodeId: string) {
  const next: Graph = {
    nodes: props.graph.nodes.map((n) =>
      n.id === nodeId ? { ...n, fanout: n.fanout === 'single' ? 'multi' : 'single' } : n,
    ),
    edges: props.graph.edges,
  }
  emit('update:graph', next)
}

// ===== 删除节点 / 连线 =====
function removeNode(nodeId: string) {
  const next: Graph = {
    ...props.graph,
    nodes: props.graph.nodes.filter((n) => n.id !== nodeId),
    edges: props.graph.edges.filter(
      (e) => e.from.nodeId !== nodeId && e.to.nodeId !== nodeId,
    ),
  }
  emit('update:graph', next)
  if (selectedNodeId.value === nodeId) {
    selectedNodeId.value = ''
    emit('select-node', '')
  }
  ElMessage.success('已删除节点')
}
function removeEdge(edgeId: string) {
  const next: Graph = {
    nodes: props.graph.nodes,
    edges: props.graph.edges.filter((e) => e.id !== edgeId),
  }
  emit('update:graph', next)
}

// ===== 节点拖动 =====
const dragNode = ref<{ id: string; offsetX: number; offsetY: number } | null>(null)
function onNodeDown(nodeId: string, e: MouseEvent) {
  const rect = bgRef.value?.getBoundingClientRect()
  const node = props.graph.nodes.find((n) => n.id === nodeId)
  if (!node || !rect) return
  const lx = (e.clientX - rect.left - panX.value) / scale.value
  const ly = (e.clientY - rect.top - panY.value) / scale.value
  dragNode.value = { id: nodeId, offsetX: lx - node.x, offsetY: ly - node.y }
  window.addEventListener('mousemove', onNodeMove)
  window.addEventListener('mouseup', onNodeMoveEnd)
}
function onNodeMove(e: MouseEvent) {
  if (!dragNode.value) return
  const rect = bgRef.value?.getBoundingClientRect()
  if (!rect) return
  const lx = (e.clientX - rect.left - panX.value) / scale.value
  const ly = (e.clientY - rect.top - panY.value) / scale.value
  const next: Graph = {
    ...props.graph,
    nodes: props.graph.nodes.map((n) =>
      n.id === dragNode.value!.id
        ? { ...n, x: lx - dragNode.value!.offsetX, y: ly - dragNode.value!.offsetY }
        : n,
    ),
  }
  emit('update:graph', next)
}
function onNodeMoveEnd() {
  dragNode.value = null
  window.removeEventListener('mousemove', onNodeMove)
  window.removeEventListener('mouseup', onNodeMoveEnd)
}

// ===== 端口连线 =====
const portDrag = ref<{ nodeId: string; portIndex: number; x: number; y: number } | null>(null)
const tempLine = ref<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
const tempPath = computed(() => {
  const t = tempLine.value
  if (!t) return ''
  return bezier(t.x1, t.y1, t.x2, t.y2)
})
function portPos(node: GroupNode, portIndex: number, side: 'in' | 'out') {
  return {
    x: side === 'out' ? node.x + NODE_W : node.x,
    y: node.y + portTop(portIndex),
  }
}
function onPortDown(nodeId: string, portIndex: number, side: 'in' | 'out') {
  if (side !== 'out') return
  const node = props.graph.nodes.find((n) => n.id === nodeId)
  if (!node) return
  const pos = portPos(node, portIndex, 'out')
  portDrag.value = { nodeId, portIndex, x: pos.x, y: pos.y }
  tempLine.value = { x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y }
  window.addEventListener('mousemove', onPortMove)
  window.addEventListener('mouseup', onPortMoveEnd)
}
function onPortMove(e: MouseEvent) {
  if (!portDrag.value || !tempLine.value) return
  const rect = bgRef.value?.getBoundingClientRect()
  if (!rect) return
  const lx = (e.clientX - rect.left - panX.value) / scale.value
  const ly = (e.clientY - rect.top - panY.value) / scale.value
  tempLine.value = { ...tempLine.value, x2: lx, y2: ly }
}
function onPortMoveEnd() {
  portDrag.value = null
  tempLine.value = null
  window.removeEventListener('mousemove', onPortMove)
  window.removeEventListener('mouseup', onPortMoveEnd)
}
function onPortUp(nodeId: string, portIndex: number, side: 'in' | 'out') {
  if (side !== 'in' || !portDrag.value) return
  const from = portDrag.value
  const toNode = props.graph.nodes.find((n) => n.id === nodeId)
  const fromNode = props.graph.nodes.find((n) => n.id === from.nodeId)
  if (!toNode || !fromNode) {
    onPortMoveEnd()
    return
  }
  const valid =
    (fromNode.lane === 'inject' && toNode.lane === 'sequence') ||
    (fromNode.lane === 'sequence' && (toNode.lane === 'sequence' || toNode.lane === 'result'))
  if (!valid) {
    ElMessage.warning('连线方向无效：注入→序列 / 序列→序列 / 序列→结果')
    onPortMoveEnd()
    return
  }
  const exists = props.graph.edges.some(
    (e) =>
      e.from.nodeId === from.nodeId &&
      e.from.portIndex === from.portIndex &&
      e.to.nodeId === nodeId &&
      e.to.portIndex === portIndex,
  )
  if (exists) {
    ElMessage.info('连线已存在')
  } else {
    const edge: Edge = {
      id: genId('edge'),
      from: { nodeId: from.nodeId, portIndex: from.portIndex },
      to: { nodeId, portIndex },
    }
    const next: Graph = {
      ...props.graph,
      edges: [...props.graph.edges, edge],
    }
    emit('update:graph', next)
    ElMessage.success('已建立连线')
  }
  onPortMoveEnd()
}
function bezier(x1: number, y1: number, x2: number, y2: number) {
  const dx = Math.abs(x2 - x1) * 0.5 + 20
  return `M ${x1},${y1} C ${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`
}

onMounted(() => {
  if (props.graph.nodes.length) {
    selectedNodeId.value = ''
  }
})
onUnmounted(() => {
  window.removeEventListener('mousemove', onPanMove)
  window.removeEventListener('mouseup', onPanUp)
  window.removeEventListener('mousemove', onNodeMove)
  window.removeEventListener('mouseup', onNodeMoveEnd)
  window.removeEventListener('mousemove', onPortMove)
  window.removeEventListener('mouseup', onPortMoveEnd)
})
</script>

<style scoped>
.graph-canvas {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f0f2f5;
}
.gc-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: #fff;
  border-bottom: 1px solid #ebeef5;
  flex-shrink: 0;
}
.gc-scale {
  font-size: 12px;
  color: #606266;
  min-width: 44px;
}
.gc-spacer { flex: 1; }

.gc-body {
  flex: 1;
  display: flex;
  overflow: hidden;
  min-height: 0;
}
.gc-bg {
  flex: 1;
  position: relative;
  overflow: hidden;
  cursor: grab;
  background-image:
    linear-gradient(rgba(91, 141, 239, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(91, 141, 239, 0.05) 1px, transparent 1px);
  background-size: 20px 20px;
}
.gc-bg:active { cursor: grabbing; }
.gc-content {
  position: absolute;
  top: 0;
  left: 0;
}
.gc-zone {
  position: absolute;
  top: 0;
  border-right: 1px dashed #dcdfe6;
  opacity: 0.5;
}
.zone-inject { background: rgba(230, 162, 60, 0.04); }
.zone-sequence { background: rgba(64, 158, 255, 0.04); }
.zone-result { background: rgba(103, 194, 58, 0.04); }
.gc-zone-label {
  position: absolute;
  top: 6px;
  left: 10px;
  font-size: 11px;
  color: #909399;
  font-weight: 600;
  letter-spacing: 1px;
}
.gc-temp-svg {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  overflow: visible;
}
.gc-hint {
  padding: 4px 10px;
  font-size: 11px;
  color: #909399;
  background: #fff;
  border-top: 1px solid #ebeef5;
  flex-shrink: 0;
}
</style>

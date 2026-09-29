<template>
  <div class="mind-map-canvas">
    <!-- 顶部工具条 -->
    <div class="mm-toolbar">
      <el-button-group size="small">
        <el-button :icon="ZoomIn" @click="zoomBy(1.2)" title="放大" />
        <el-button :icon="ZoomOut" @click="zoomBy(0.8)" title="缩小" />
        <el-button :icon="Refresh" @click="resetView" title="重置视图" />
      </el-button-group>
      <span class="mm-scale">{{ Math.round(scale * 100) }}%</span>
      <div class="mm-spacer" />
      <el-tag v-if="caseId" size="small" type="info">{{ caseId }}</el-tag>
      <el-tag size="small" type="success">{{ stepNodes.length }} 步</el-tag>
      <el-tag v-if="edges.length" size="small" type="warning">{{ edges.length }} 连线</el-tag>
      <el-button size="small" :icon="Plus" type="success" @click="addStep" title="添加测试步骤" />
      <el-button
        size="small"
        :icon="Files"
        @click="funcDrawer = !funcDrawer"
        :type="funcDrawer ? 'primary' : 'default'"
      >函数库</el-button>
    </div>

    <!-- 主体：左栏 | 画布 | 右栏 -->
    <div class="mm-body">
    <!-- 左外栏：故障注入卡片库 -->
    <div class="mm-side mm-side-left">
      <CardLibrary
        card-type="inject"
        title="故障注入"
        :cards="injectCards"
        @update:cards="onInjectCardsUpdate"
      />
    </div>

    <!-- 中栏：三栏思维导图画布 -->
    <div class="mm-canvas-wrap">
      <div
        ref="bgRef"
        class="mm-bg"
        @wheel.prevent="onWheel"
        @mousedown.self="onBgDown"
        @mousemove="onBgMove"
      >
        <div class="mm-content" :style="contentStyle">
          <!-- 三栏分区背景 -->
          <div class="zone zone-inject" :style="{ left: ZONE.X1 + 'px', width: ZONE.W + 'px', height: svgH + 'px' }">
            <div class="zone-label">故障注入</div>
          </div>
          <div class="zone zone-step" :style="{ left: ZONE.X2 + 'px', width: ZONE.W + 'px', height: svgH + 'px' }">
            <div class="zone-label">测试序列</div>
          </div>
          <div class="zone zone-result" :style="{ left: ZONE.X3 + 'px', width: ZONE.W + 'px', height: svgH + 'px' }">
            <div class="zone-label">结果</div>
          </div>

          <!-- SVG 连线层 -->
          <svg class="mm-edges" :style="{ width: svgW + 'px', height: svgH + 'px' }">
            <defs>
              <marker id="arrow-inject" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                <path d="M0,0 L8,4 L0,8 Z" fill="#e6a23c" />
              </marker>
              <marker id="arrow-result" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                <path d="M0,0 L8,4 L0,8 Z" fill="#67c23a" />
              </marker>
            </defs>
            <!-- 已有连线 -->
            <path
              v-for="(e, i) in edges"
              :key="'e' + i"
              :d="edgePath(e)"
              :stroke="edgeColor(e)"
              stroke-width="2"
              fill="none"
              :marker-end="edgeMarker(e)"
              class="mm-edge"
              @click.stop="selectEdge(i)"
            />
            <!-- 临时画线 -->
            <path
              v-if="tempLine"
              :d="tempPath"
              stroke="#1890ff"
              stroke-width="2"
              stroke-dasharray="5,3"
              fill="none"
            />
          </svg>

          <!-- 节点层 -->
          <div
            v-for="n in allNodes"
            :key="n.id"
            class="mm-node"
            :class="['node-' + n.type, { selected: selected === n.id }]"
            :style="{ left: n.x + 'px', top: n.y + 'px', width: NODE_W + 'px' }"
            @click.stop="selected = n.id"
            @mousedown.stop="onNodeDown($event, n)"
            @dblclick.stop="onNodeDblClick(n)"
          >
            <div class="node-head">
              <span class="node-badge" :class="'badge-' + n.type">{{ badgeText(n) }}</span>
              <span class="node-title" :title="n.label">{{ n.label }}</span>
              <el-icon class="node-del" @click.stop="removeNode(n)"><Close /></el-icon>
            </div>
            <div class="node-body">
              <pre v-if="n.code" class="node-code">{{ n.code }}</pre>
              <div v-if="n.param" class="node-param">{{ n.param }}</div>
              <div v-if="n.sigs && Object.keys(n.sigs).length" class="node-sigs">
                <span v-for="(v, k) in n.sigs" :key="k" class="sig-chip">
                  <span class="sk">{{ k }}</span>=<span class="sv">{{ v }}</span>
                </span>
              </div>
            </div>

            <!-- 端口：注入节点右侧输出 / 步骤左侧输入+右侧输出 / 结果左侧输入 -->
            <div
              v-if="n.type === 'inject' || n.type === 'step'"
              class="port port-out"
              :class="{ active: portDrag?.from === n.id }"
              @mousedown.stop="onPortDown($event, n, 'out')"
            />
            <div
              v-if="n.type === 'step' || n.type === 'result'"
              class="port port-in"
              :class="{ hover: portDrag && portDrag.from !== n.id }"
              @mouseup.stop="onPortUp($event, n)"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- 右外栏：结果卡片库 -->
    <div class="mm-side mm-side-right">
      <CardLibrary
        card-type="result"
        title="结果"
        :cards="resultCards"
        @update:cards="onResultCardsUpdate"
      />
    </div>
    </div>

    <!-- 函数库抽屉（浮层，可切换） -->
    <transition name="mm-slide">
      <div v-show="funcDrawer" class="mm-func-drawer">
        <FunctionLibrary />
      </div>
    </transition>

    <!-- 步骤编辑弹窗 -->
    <el-dialog
      v-model="editVisible"
      title="编辑测试步骤"
      width="480px"
      append-to-body
    >
      <el-form :model="editForm" label-width="70px" size="small">
        <el-form-item label="函数名">
          <el-input v-model="editForm.fun" placeholder="如 SetSignal / TestWaitForTime" />
        </el-form-item>
        <el-form-item label="参数">
          <el-input v-model="editForm.param" placeholder="函数参数，如 100 / SleepMode" />
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="editForm.type" style="width: 100%">
            <el-option label="普通步骤" value="func" />
            <el-option label="循环开始" value="loop_start" />
            <el-option label="循环结束" value="loop_end" />
            <el-option label="清空" value="clear" />
            <el-option label="复位斜坡" value="reset_ramp" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" @click="saveStepEdit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 底部提示 -->
    <div class="mm-hint">
      测试序列：点击绿色「+」添加步骤 · 拖函数库卡片到画布添加步骤 · 双击步骤编辑 · 点击 X 删除 · 左栏拖注入到左区、右栏拖结果到右区 · 拖节点端口画线连接
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 三栏思维导图画布：
 * - 左外栏：故障注入卡片库（拖到画布左区创建注入节点）
 * - 中栏画布内三列：注入区 | 序列区 | 结果区，节点间可画线连接
 *   - 注入节点（右输出端口）→ 步骤节点（左输入+右输出端口）→ 结果节点（左输入端口）
 * - 右外栏：结果卡片库（拖到画布右区创建结果节点）
 * - 函数库：可切换抽屉
 */
import { ref, computed, reactive, watch, onMounted, onUnmounted } from 'vue'
import {
  ElButton, ElButtonGroup, ElIcon, ElTag, ElMessage,
  ElDialog, ElForm, ElFormItem, ElInput, ElSelect, ElOption,
} from 'element-plus'
import {
  ZoomIn, ZoomOut, Refresh, Files, Close, Plus,
} from '@element-plus/icons-vue'
import CardLibrary from '@/components/CardLibrary.vue'
import FunctionLibrary from '@/components/FunctionLibrary.vue'
import { getGlobalLibrary, saveGlobalLibrary } from '@/api/function'
import type { LibraryCard } from '@/api/function'

interface StepData {
  type: string
  fun: string
  param: string
  signals: Record<string, string>
  indent: number
}
type NodeType = 'inject' | 'step' | 'result'
interface CanvasNode {
  id: string
  type: NodeType
  x: number
  y: number
  label: string
  code?: string
  param?: string
  sigs?: Record<string, string>
  stepIdx?: number
  /** 步骤节点专用：函数名 */
  fun?: string
  /** 步骤节点专用：步骤类型（func/loop_start/loop_end/clear/reset_ramp） */
  stepType?: string
  /** 步骤节点专用：缩进层级 */
  indent?: number
}
interface Edge {
  from: string
  to: string
}

const props = defineProps<{
  steps: StepData[]
  caseId?: string
}>()
const emit = defineEmits<{
  /** 连线变更（增删） */
  (e: 'edges-change', edges: Edge[]): void
  /** 测试序列步骤变更（增删改） */
  (e: 'steps-change', steps: StepData[]): void
}>()

// ===== 常量 =====
const NODE_W = 200
const NODE_H = 70
const ZONE = { X1: 20, X2: 360, X3: 700, W: 320, GAP: 20 }
const COL_X = { inject: ZONE.X1 + 20, step: ZONE.X2 + 20, result: ZONE.X3 + 20 }
const ROW_GAP = 18

// ===== 视图状态 =====
const bgRef = ref<HTMLElement>()
const scale = ref(1)
const panX = ref(0)
const panY = ref(0)
const contentStyle = computed(() => ({
  transform: `translate(${panX.value}px, ${panY.value}px) scale(${scale.value})`,
  transformOrigin: '0 0',
}))
const svgW = ZONE.X3 + ZONE.W + 100
const svgH = computed(() => Math.max(stepNodes.length, injectNodes.length, resultNodes.length) * (NODE_H + ROW_GAP) + 200)

// ===== 节点 =====
const stepNodes = reactive<CanvasNode[]>([])
const injectNodes = reactive<CanvasNode[]>([])
const resultNodes = reactive<CanvasNode[]>([])
const allNodes = computed(() => [...injectNodes, ...stepNodes, ...resultNodes])

// ===== 连线 =====
const edges = reactive<Edge[]>([])
const selected = ref('')
let _nodeIdSeq = 0

// ===== 卡片库 =====
const injectCards = ref<LibraryCard[]>([])
const resultCards = ref<LibraryCard[]>([])

// ===== 函数库抽屉 =====
const funcDrawer = ref(false)

// ===== 端口画线 =====
const portDrag = ref<{ from: string; x: number; y: number } | null>(null)
const tempLine = ref<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
const tempPath = computed(() => {
  const t = tempLine.value
  if (!t) return ''
  return bezierPath(t.x1, t.y1, t.x2, t.y2)
})

// ===== 初始化步骤节点 =====
watch(
  () => props.steps,
  (steps) => rebuildStepNodes(steps),
  { immediate: true, deep: false },
)
// 切换用例时重置临时画布节点（注入/结果/连线）
watch(
  () => props.caseId,
  () => {
    injectNodes.length = 0
    resultNodes.length = 0
    edges.length = 0
    selected.value = ''
  },
)
function rebuildStepNodes(steps: StepData[]) {
  stepNodes.length = 0
  steps.forEach((s, i) => {
    const fun = s.fun || s.type || 'step'
    stepNodes.push({
      id: `step-${i}`,
      type: 'step',
      x: COL_X.step,
      y: i * (NODE_H + ROW_GAP) + 40,
      label: fun,
      param: s.param,
      sigs: s.signals,
      stepIdx: i,
      fun,
      stepType: s.type || 'func',
      indent: s.indent || 0,
    })
  })
  layoutStepNodes()
}

/** 重新排列步骤节点纵向位置 */
function layoutStepNodes() {
  stepNodes.forEach((n, i) => {
    n.stepIdx = i
    n.y = i * (NODE_H + ROW_GAP) + 40
  })
}

/** 序列化步骤节点为 StepData[] 并回传父组件 */
function emitSteps() {
  const arr: StepData[] = stepNodes.map((n) => ({
    type: n.stepType || 'func',
    fun: n.fun || n.label || '',
    param: n.param || '',
    signals: { ...(n.sigs || {}) },
    indent: n.indent || 0,
  }))
  emit('steps-change', arr)
}

// ===== 步骤增删改 =====
const editVisible = ref(false)
const editingStepId = ref('')
const editForm = reactive({ fun: '', param: '', type: 'func' })

/** 添加空白测试步骤 */
function addStep() {
  const idx = stepNodes.length
  stepNodes.push({
    id: `step-${idx}`,
    type: 'step',
    x: COL_X.step,
    y: 0,
    label: 'NewStep',
    stepIdx: idx,
    fun: 'NewStep',
    stepType: 'func',
    indent: 0,
    sigs: {},
    param: '',
  })
  layoutStepNodes()
  emitSteps()
  selected.value = `step-${idx}`
  ElMessage.success('已添加测试步骤，双击可编辑')
}

/** 双击步骤节点打开编辑弹窗 */
function onNodeDblClick(n: CanvasNode) {
  if (n.type !== 'step') return
  editingStepId.value = n.id
  editForm.fun = n.fun || n.label || ''
  editForm.param = n.param || ''
  editForm.type = n.stepType || 'func'
  editVisible.value = true
}

/** 保存步骤编辑 */
function saveStepEdit() {
  const n = stepNodes.find((x) => x.id === editingStepId.value)
  if (n) {
    n.fun = editForm.fun.trim() || 'step'
    n.param = editForm.param
    n.stepType = editForm.type
    n.label = n.fun
    emitSteps()
    ElMessage.success('步骤已更新')
  }
  editVisible.value = false
}

// ===== 加载全局库 =====
async function loadGlobalLibrary() {
  try {
    const res: any = await getGlobalLibrary()
    const data = res?.data?.data ?? res?.data ?? {}
    injectCards.value = Array.isArray(data.inject_library) ? data.inject_library : []
    resultCards.value = Array.isArray(data.result_library) ? data.result_library : []
  } catch (e: any) {
    ElMessage.warning('加载卡片库失败：' + (e?.message || String(e)))
  }
}

// ===== 卡片库持久化 =====
let _saveTimer: any = null
function scheduleSave() {
  if (_saveTimer) clearTimeout(_saveTimer)
  _saveTimer = setTimeout(async () => {
    try {
      await saveGlobalLibrary({
        inject_library: injectCards.value,
        result_library: resultCards.value,
      })
    } catch { /* ignore */ }
  }, 800)
}
function onInjectCardsUpdate(cards: LibraryCard[]) {
  injectCards.value = cards
  scheduleSave()
}
function onResultCardsUpdate(cards: LibraryCard[]) {
  resultCards.value = cards
  scheduleSave()
}

// ===== 画布拖拽接收：从外层卡片库拖入创建节点 =====
function onBgDrop(e: DragEvent) {
  const rect = bgRef.value?.getBoundingClientRect()
  if (!rect) return
  const lx = (e.clientX - rect.left - panX.value) / scale.value
  const ly = (e.clientY - rect.top - panY.value) / scale.value

  // 1. 函数库卡片 → 追加为测试序列步骤
  const mmFunc = e.dataTransfer?.getData('application/x-mm-func')
  if (mmFunc) {
    let payload: { name: string; kind?: string; body?: string } | null = null
    try {
      payload = JSON.parse(mmFunc)
    } catch {
      return
    }
    if (!payload) return
    const idx = stepNodes.length
    const fun = payload.name || 'NewStep'
    stepNodes.push({
      id: `step-${idx}`,
      type: 'step',
      x: COL_X.step,
      y: 0,
      label: fun,
      stepIdx: idx,
      fun,
      stepType: 'func',
      indent: 0,
      sigs: {},
      param: '',
      code: payload.body || '',
    })
    layoutStepNodes()
    emitSteps()
    selected.value = `step-${idx}`
    ElMessage.success(`已从函数库添加步骤：${fun}`)
    return
  }

  // 2. 故障注入 / 结果卡片 → 创建注入或结果节点
  let card: LibraryCard | null = null
  let type: NodeType = 'inject'
  const inj = e.dataTransfer?.getData('application/x-inject-card')
  const res = e.dataTransfer?.getData('application/x-result-card')
  if (inj) {
    card = JSON.parse(inj) as LibraryCard
    type = 'inject'
  } else if (res) {
    card = JSON.parse(res) as LibraryCard
    type = 'result'
  } else {
    return
  }
  _nodeIdSeq++
  const node: CanvasNode = {
    id: `${type}-${_nodeIdSeq}-${Date.now().toString(36)}`,
    type,
    x: lx - NODE_W / 2,
    y: ly - NODE_H / 2,
    label: card.name,
    code: card.code,
  }
  // 限制在对应区域
  if (type === 'inject') {
    node.x = COL_X.inject
    injectNodes.push(node)
  } else {
    node.x = COL_X.result
    resultNodes.push(node)
  }
  selected.value = node.id
  ElMessage.success(`已创建${type === 'inject' ? '注入' : '结果'}节点：${card.name}`)
}

// ===== 端口画线 =====
function nodePortPos(node: CanvasNode, side: 'in' | 'out') {
  return {
    x: side === 'out' ? node.x + NODE_W : node.x,
    y: node.y + 24,
  }
}
function onPortDown(e: MouseEvent, node: CanvasNode, side: 'out') {
  if (side !== 'out') return
  const pos = nodePortPos(node, 'out')
  portDrag.value = { from: node.id, x: pos.x, y: pos.y }
  tempLine.value = { x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y }
  window.addEventListener('mousemove', onPortMove)
  window.addEventListener('mouseup', onPortUpClean)
}
function onPortMove(e: MouseEvent) {
  if (!portDrag.value || !tempLine.value) return
  const rect = bgRef.value?.getBoundingClientRect()
  if (!rect) return
  const lx = (e.clientX - rect.left - panX.value) / scale.value
  const ly = (e.clientY - rect.top - panY.value) / scale.value
  tempLine.value = { ...tempLine.value, x2: lx, y2: ly }
}
function onPortUp(e: MouseEvent, node: CanvasNode) {
  if (!portDrag.value) return
  const from = portDrag.value.from
  if (from === node.id) {
    cleanupPortDrag()
    return
  }
  // 校验方向：inject→step / step→step / step→result
  const fromNode = allNodes.value.find((n) => n.id === from)
  if (!fromNode) {
    cleanupPortDrag()
    return
  }
  const valid =
    (fromNode.type === 'inject' && node.type === 'step') ||
    (fromNode.type === 'step' && node.type === 'step') ||
    (fromNode.type === 'step' && node.type === 'result')
  if (!valid) {
    ElMessage.warning('连线方向无效：注入→步骤 / 步骤→步骤 / 步骤→结果')
    cleanupPortDrag()
    return
  }
  // 去重
  const exists = edges.find((ed) => ed.from === from && ed.to === node.id)
  if (exists) {
    ElMessage.info('连线已存在')
  } else {
    edges.push({ from, to: node.id })
    emit('edges-change', [...edges])
    ElMessage.success('已建立连线')
  }
  cleanupPortDrag()
}
function onPortUpClean() {
  cleanupPortDrag()
}
function cleanupPortDrag() {
  portDrag.value = null
  tempLine.value = null
  window.removeEventListener('mousemove', onPortMove)
  window.removeEventListener('mouseup', onPortUpClean)
}

// ===== 连线渲染 =====
function edgePath(e: Edge) {
  const from = allNodes.value.find((n) => n.id === e.from)
  const to = allNodes.value.find((n) => n.id === e.to)
  if (!from || !to) return ''
  const p1 = nodePortPos(from, 'out')
  const p2 = nodePortPos(to, 'in')
  return bezierPath(p1.x, p1.y, p2.x, p2.y)
}
function bezierPath(x1: number, y1: number, x2: number, y2: number) {
  const dx = Math.abs(x2 - x1) * 0.5 + 20
  return `M ${x1},${y1} C ${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`
}
function edgeColor(e: Edge) {
  const from = allNodes.value.find((n) => n.id === e.from)
  return from?.type === 'inject' ? '#e6a23c' : '#67c23a'
}
function edgeMarker(e: Edge) {
  const from = allNodes.value.find((n) => n.id === e.from)
  return from?.type === 'inject' ? 'url(#arrow-inject)' : 'url(#arrow-result)'
}
function selectEdge(i: number) {
  const e = edges[i]
  edges.splice(i, 1)
  emit('edges-change', [...edges])
  ElMessage.info('已删除连线')
}

// ===== 节点拖动 =====
const dragNode = ref<CanvasNode | null>(null)
const dragOffset = ref({ x: 0, y: 0 })
function onNodeDown(e: MouseEvent, n: CanvasNode) {
  dragNode.value = n
  const rect = bgRef.value?.getBoundingClientRect()
  if (rect) {
    const lx = (e.clientX - rect.left - panX.value) / scale.value
    const ly = (e.clientY - rect.top - panY.value) / scale.value
    dragOffset.value = { x: lx - n.x, y: ly - n.y }
  }
  window.addEventListener('mousemove', onNodeMove)
  window.addEventListener('mouseup', onNodeUp)
}
function onNodeMove(e: MouseEvent) {
  if (!dragNode.value) return
  const rect = bgRef.value?.getBoundingClientRect()
  if (!rect) return
  const lx = (e.clientX - rect.left - panX.value) / scale.value
  const ly = (e.clientY - rect.top - panY.value) / scale.value
  // 限制 x 在对应区域附近
  const n = dragNode.value
  n.x = lx - dragOffset.value.x
  n.y = ly - dragOffset.value.y
}
function onNodeUp() {
  dragNode.value = null
  window.removeEventListener('mousemove', onNodeMove)
  window.removeEventListener('mouseup', onNodeUp)
}
function removeNode(n: CanvasNode) {
  // 删除关联连线
  for (let i = edges.length - 1; i >= 0; i--) {
    if (edges[i].from === n.id || edges[i].to === n.id) edges.splice(i, 1)
  }
  if (n.type === 'step') {
    const idx = stepNodes.findIndex((x) => x.id === n.id)
    if (idx >= 0) stepNodes.splice(idx, 1)
    layoutStepNodes()
    emitSteps()
  } else {
    const arr = n.type === 'inject' ? injectNodes : resultNodes
    const idx = arr.findIndex((x) => x.id === n.id)
    if (idx >= 0) arr.splice(idx, 1)
  }
  emit('edges-change', [...edges])
  ElMessage.success('已删除节点')
}

// ===== 辅助 =====
function badgeText(n: CanvasNode) {
  if (n.type === 'step') return `${(n.stepIdx ?? 0) + 1}`
  if (n.type === 'inject') return '注'
  return '果'
}

// ===== 缩放/平移 =====
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
function zoomBy(f: number) {
  scale.value = Math.min(2.5, Math.max(0.3, scale.value * f))
}
function resetView() {
  scale.value = 1
  panX.value = 0
  panY.value = 0
}
const panDrag = ref<{ x: number; y: number; pX: number; pY: number } | null>(null)
function onBgDown(e: MouseEvent) {
  selected.value = ''
  panDrag.value = { x: e.clientX, y: e.clientY, pX: panX.value, pY: panY.value }
  window.addEventListener('mousemove', onPanMove)
  window.addEventListener('mouseup', onPanUp)
}
function onBgMove() { /* 占位，用于阻止事件冒泡 */ }
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

onMounted(() => {
  loadGlobalLibrary()
  // 注册画布 drop
  bgRef.value?.addEventListener('drop', onBgDrop)
  bgRef.value?.addEventListener('dragover', (e) => e.preventDefault())
})
onUnmounted(() => {
  window.removeEventListener('mousemove', onPanMove)
  window.removeEventListener('mouseup', onPanUp)
  window.removeEventListener('mousemove', onNodeMove)
  window.removeEventListener('mouseup', onNodeUp)
  window.removeEventListener('mousemove', onPortMove)
  window.removeEventListener('mouseup', onPortUpClean)
  bgRef.value?.removeEventListener('drop', onBgDrop)
  if (_saveTimer) clearTimeout(_saveTimer)
})
</script>

<style scoped>
.mind-map-canvas {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f0f2f5;
  position: relative;
}
.mm-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: #fff;
  border-bottom: 1px solid #ebeef5;
  flex-shrink: 0;
}
.mm-scale { font-size: 12px; color: #606266; min-width: 44px; }
.mm-spacer { flex: 1; }

/* 主体：横向 flex（左栏 | 画布 | 右栏） */
.mm-body {
  flex: 1;
  display: flex;
  flex-direction: row;
  overflow: hidden;
  min-height: 0;
}

/* 外层左右栏 */
.mm-side {
  width: 240px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #fff;
}
.mm-side-left { border-right: 1px solid #ebeef5; }
.mm-side-right { border-left: 1px solid #ebeef5; }

/* 画布区 */
.mm-canvas-wrap {
  flex: 1;
  display: flex;
  min-width: 0;
  position: relative;
  overflow: hidden;
}
.mm-bg {
  flex: 1;
  position: relative;
  overflow: hidden;
  cursor: grab;
  background-image:
    linear-gradient(rgba(91,141,239,0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(91,141,239,0.05) 1px, transparent 1px);
  background-size: 20px 20px;
}
.mm-bg:active { cursor: grabbing; }
.mm-content {
  position: absolute;
  top: 0; left: 0;
}

/* 三栏分区背景 */
.zone {
  position: absolute;
  top: 0;
  bottom: 0;
  border-right: 1px dashed #dcdfe6;
  opacity: 0.5;
}
.zone-inject { background: rgba(230,162,60,0.04); }
.zone-step { background: rgba(64,158,255,0.04); }
.zone-result { background: rgba(103,194,58,0.04); }
.zone-label {
  position: absolute;
  top: 6px;
  left: 10px;
  font-size: 11px;
  color: #909399;
  font-weight: 600;
  letter-spacing: 1px;
}

/* SVG 连线层 */
.mm-edges {
  position: absolute;
  top: 0; left: 0;
  pointer-events: none;
  overflow: visible;
}
.mm-edge {
  pointer-events: stroke;
  cursor: pointer;
}
.mm-edge:hover { stroke-width: 3; opacity: 0.8; }

/* 节点 */
.mm-node {
  position: absolute;
  min-height: 60px;
  background: #fff;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
  transition: box-shadow 0.15s, border-color 0.15s;
  user-select: none;
}
.mm-node:hover { box-shadow: 0 2px 10px rgba(91,141,239,0.2); border-color: var(--el-color-primary); }
.mm-node.selected { border-color: var(--el-color-primary); box-shadow: 0 0 0 2px rgba(64,158,255,0.3); }
.node-inject { border-left: 3px solid #e6a23c; }
.node-step { border-left: 3px solid var(--el-color-primary); }
.node-result { border-left: 3px solid #67c23a; }

.node-head {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 8px;
  border-bottom: 1px solid #f0f2f5;
  font-size: 12px;
}
.node-badge {
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 700;
  min-width: 16px;
  text-align: center;
}
.badge-inject { background: #fdf6ec; color: #e6a23c; }
.badge-step { background: #ecf5ff; color: var(--el-color-primary); }
.badge-result { background: #f0f9eb; color: #67c23a; }
.node-title {
  flex: 1;
  font-weight: 600;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: 'Consolas', 'Monaco', monospace;
}
.node-del {
  cursor: pointer;
  color: #c0c4cc;
  font-size: 12px;
}
.node-del:hover { color: #f56c6c; }

.node-body { padding: 4px 8px; font-size: 11px; }
.node-code {
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 10px;
  color: #909399;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 40px;
  overflow: hidden;
}
.node-param { color: var(--el-color-primary); font-family: 'Consolas', monospace; margin-bottom: 3px; }
.node-sigs { display: flex; flex-wrap: wrap; gap: 3px; }
.sig-chip {
  background: #f5f7fa;
  padding: 1px 4px;
  border-radius: 3px;
  font-family: 'Consolas', 'Monaco', monospace;
}
.sig-chip .sk { color: var(--el-color-primary); }
.sig-chip .sv { color: #e6a23c; }

/* 端口 */
.port {
  position: absolute;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #fff;
  border: 2px solid #c0c4cc;
  top: 18px;
  z-index: 3;
  cursor: crosshair;
  transition: all 0.15s;
}
.port:hover, .port.active { transform: scale(1.4); border-color: var(--el-color-primary); background: var(--el-color-primary); }
.port.hover { border-color: #67c23a; background: #f0f9eb; }
.port-out { right: -8px; border-color: var(--el-color-primary); }
.port-in { left: -8px; border-color: #67c23a; }

/* 函数库抽屉 */
.mm-func-drawer {
  position: absolute;
  top: 42px;
  right: 240px;
  bottom: 28px;
  width: 340px;
  background: #fff;
  border: 1px solid #ebeef5;
  box-shadow: -2px 0 10px rgba(0,0,0,0.1);
  z-index: 20;
  overflow: hidden;
}
.mm-slide-enter-active, .mm-slide-leave-active { transition: transform 0.25s; }
.mm-slide-enter-from, .mm-slide-leave-to { transform: translateX(100%); }

.mm-hint {
  padding: 4px 10px;
  font-size: 11px;
  color: #909399;
  background: #fff;
  border-top: 1px solid #ebeef5;
  flex-shrink: 0;
}
</style>

<template>
  <div class="graph-editor">
    <div class="ge-header">
      <div class="ge-title-group">
        <el-button text :icon="Back" @click="emit('close')" />
        <span class="ge-title">功能用例配置</span>
        <el-tag v-if="caseCount" size="small" type="success">当前工况 {{ caseCount }} 条用例</el-tag>
      </div>
      <div class="ge-actions">
        <el-button size="small" plain :type="panelStates.frames.visible ? 'primary' : 'default'" @click="toggleFramesDrawer">工况</el-button>
        <el-button size="small" plain :type="panelStates.inject.visible ? 'primary' : 'default'" @click="toggleInjectDrawer">故障注入</el-button>
        <el-button size="small" plain :type="panelStates.sequence.visible ? 'primary' : 'default'" @click="toggleSequenceDrawer">序列</el-button>
        <el-button size="small" plain :type="panelStates.result.visible ? 'primary' : 'default'" @click="toggleResultDrawer">检查</el-button>
        <el-button size="small" plain :type="panelStates.func.visible ? 'primary' : 'default'" :icon="Files" @click="toggleFuncDrawer">函数库</el-button>
        <el-button size="small" plain :type="panelStates.value.visible ? 'primary' : 'default'" :icon="Grid" @click="toggleValueDrawer">值资源库</el-button>
        <el-button size="small" plain :type="panelStates.obj.visible ? 'primary' : 'default'" :icon="Grid" @click="toggleObjDrawer">对象浏览器</el-button>
        <el-button size="small" type="primary" :icon="Check" @click="onSaveClick">保存</el-button>
        <el-button size="small" type="success" :icon="Promotion" @click="emit('generate')">生成</el-button>
      </div>
    </div>

    <!-- 用例分组：每个分组一份独立图形配置，组内用例以分组名为前缀 -->
    <div class="ge-groups">
      <span class="ge-groups-label">用例分组</span>
      <el-tag
        v-for="g in groupsList"
        :key="g.id"
        :type="g.id === activeGroupId ? 'primary' : 'info'"
        :effect="g.id === activeGroupId ? 'dark' : 'plain'"
        class="ge-group-tag"
        @click="switchGroup(g.id)"
      >
        {{ g.name || '未命名' }}
      </el-tag>
      <el-button size="small" text :icon="Plus" @click="addGroup">新建分组</el-button>
      <el-input
        v-if="activeGroup"
        v-model="activeGroupName"
        size="small"
        class="ge-group-name"
        placeholder="当前分组名（用例名前缀）"
        @change="onGroupNameChange"
      />
      <span class="ge-groups-hint">组内用例命名：分组名_1、分组名_2…（卡片库/映射表/值资源库均按分组隔离）</span>
      <el-button size="small" text @click="importGlobalTemplate">导入全局模板</el-button>
      <el-button size="small" text @click="exportGlobalTemplate">导出为全局模板</el-button>
    </div>

    <div ref="dockBodyEl" class="ge-body">
      <DockLayout
        v-if="visibleDockRoot"
        :node="visibleDockRoot"
        :panels="panelMeta"
        :dragging-id="draggingPanelId ?? undefined"
        @drag-start="onPanelDragStart"
        @activate="activateTab"
      />
    </div>

    <!-- 浮动面板（取消浮动按钮，改为标题拖拽自动浮动） -->
    <DockPanel
      v-for="p in floatingPanels"
      :key="p.id"
      :panel-id="p.id"
      :title="p.title"
      :help="p.help"
      :floating="true"
      :closable="true"
      :dragging="draggingPanelId === p.id"
      :x="p.floating?.x ?? 0"
      :y="p.floating?.y ?? 0"
      :width="p.floating?.width ?? 360"
      :height="p.floating?.height ?? 480"
      @drag-start="onPanelDragStart(p.id)"
      @close="closePanel(p.id)"
    >
      <PanelBody :panel-id="p.id" />
    </DockPanel>

    <!-- 拖拽停靠五向放置区指示器（跟随目标面板） -->
    <div
      v-if="dockOverlayVisible && dockTargetRect"
      class="ge-dock-overlay"
      :style="overlayStyle"
    >
      <div class="dock-zone dz-top" :class="{ active: dockHover === 'top' }">上</div>
      <div class="dock-zone dz-bottom" :class="{ active: dockHover === 'bottom' }">下</div>
      <div class="dock-zone dz-left" :class="{ active: dockHover === 'left' }">左</div>
      <div class="dock-zone dz-right" :class="{ active: dockHover === 'right' }">右</div>
      <div class="dock-zone dz-center" :class="{ active: dockHover === 'center' }">中</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, provide, nextTick, toRaw } from 'vue'
import { Back, Check, Promotion, Files, Grid, Plus } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { Card, CardLibrary, CardType, CardStep, CaseFrame, CaseGroup, Graph, InjectRole, MappingKind, ObjectMapping, ValueResource } from '@/types/functionGraph'
import { emptyCardLibrary, emptyCaseGroup, emptyMapping, emptyValueLibrary, genId, EMPTY_CARDS, EMPTY_MAPPING, EMPTY_VALUES } from '@/types/functionGraph'
import { newCard, frameCaseRowsWithLookups, buildCardLookup, buildValueLookup, syncGraphRefs, migrateRefCopyNodes, reanchorFrameSeqPorts, frameSequenceId, migrateSeqPortKeys, extractCaseBlock } from '@/utils/functionGraph'
import type { FrameCaseRow } from '@/utils/functionGraph'
import { getGlobalLibrary, saveGlobalLibrary, expandCases } from '@/api/function'
import DockPanel from './DockPanel.vue'
import DockLayout from './DockLayout.vue'
import type { LayoutNode } from './DockLayout.vue'
import PanelBody from './PanelBody.vue'
import { useShortcut, isModuleActive } from '@/composables/useShortcuts'

const props = defineProps<{
  graph: Graph
  mapping: ObjectMapping
  /** 配置级卡片库：仅用于旧配置迁移兜底（分组缺少 cards 时） */
  cards?: CardLibrary
  /** 配置级值资源库：仅用于旧配置迁移兜底（分组缺少 valueLibrary 时） */
  valueLibrary?: ValueResource[]
  /** 打开时定位到的用例分组 id */
  activeGroupId?: string
  /** CCP 系统变量类型表（{符号名: int|float|int64}）：供用例代码预览与生成同源 */
  ccpVarTypes?: Record<string, string>
}>()
const emit = defineEmits<{
  (e: 'update:graph', graph: Graph): void
  (e: 'update:mapping', mapping: ObjectMapping): void
  (e: 'close'): void
  (e: 'save'): void
  (e: 'generate'): void
}>()

const graph = ref<Graph>(JSON.parse(JSON.stringify(props.graph)))
// 全局库模板：不再自动注入分组，仅「导入全局模板」时使用
const globalTemplate = ref<{
  cards: CardLibrary
  mapping: ObjectMapping
  valueLibrary: ValueResource[]
}>({
  cards: emptyCardLibrary(),
  mapping: { signals: [], dtcs: [], messages: [], envvars: [], a2l: [] },
  valueLibrary: [],
})

// 三列卡片类型
const cardTabs: Array<{ value: CardType; label: string }> = [
  { value: 'inject', label: '故障注入' },
  { value: 'sequence', label: '测试序列' },
  { value: 'result', label: '结果判断' },
]

const editorTarget = ref<'frames' | 'card'>('frames')
const selectedFrameId = ref('')
const selectedCardId = ref('')
// 列表里单击选中的卡片 id（仅高亮 + 复制用，不切换编辑视图）
const selectionCardId = ref('')
// 列表多选（Ctrl/Shift 点击累加）；selectionCardId 始终为最后一个
const selectionCardIds = ref<string[]>([])
function isCardSelected(id: string): boolean {
  return selectionCardIds.value.includes(id)
}
function selectCardInList(card: Card, e?: MouseEvent) {
  const multi = !!e && (e.ctrlKey || e.metaKey || e.shiftKey)
  if (multi) {
    const i = selectionCardIds.value.indexOf(card.id)
    if (i >= 0) selectionCardIds.value.splice(i, 1)
    else selectionCardIds.value.push(card.id)
  } else {
    selectionCardIds.value = [card.id]
  }
  selectionCardId.value = selectionCardIds.value[selectionCardIds.value.length - 1] || ''
}

/** 画布上点了工况里的卡片：让左侧卡片列表聚焦到它引用的库卡片。
 *  卡片列表按类型分面板，面板被关掉或沉在 tab 后面时先让它可见/到前台，否则「聚焦」看不见。 */
function focusLibraryCard(payload: { cardId: string; type: CardType }) {
  if (!payload?.cardId) return
  const panel = panelStates.value[payload.type]
  if (panel && !panel.visible) panel.visible = true
  activateTab(payload.type)
  selectionCardIds.value = [payload.cardId]
  selectionCardId.value = payload.cardId
}

/** 画布上点了工况框：让左侧工况列表聚焦到该工况。
 *  只动工况高亮，不碰卡片选中态（否则点工况里的卡片时会把刚聚焦的卡片清掉）。 */
function focusFrameItem(frameId: string) {
  // 工况框头里的「复制/删除工况」也会冒泡到这里，已删掉的 id 不该再选中
  if (!frameId || !frames.value.some((f) => f.id === frameId)) return
  selectedFrameId.value = frameId
  // 画布一次只挂载一个工况：点工况框同时把它切到前台
  setActiveFrame(frameId)
}

// 剪贴板实体：工况（frame）或卡片（故障注入/序列/检查），用于 Ctrl+C / Ctrl+V
type ClipEntity = { kind: 'frame'; data: CaseFrame } | { kind: 'cards'; data: Card[] }
const entityClip = ref<ClipEntity | null>(null)
// 最近选中的实体类型，用于 Ctrl+C 时判断复制目标
const selectionKind = ref<'frame' | 'card'>('frame')
// 编辑卡片时触发 StepEditor 保存的信号（Ctrl+S 优先保存当前卡片）
const stepSaveSignal = ref(0)
// 鼠标是否悬停在步骤编辑框（StepEditor）上，用于 Ctrl+S 判断保存目标
const stepEditorHovered = ref(false)

const frames = computed<CaseFrame[]>(() => graph.value.frames || [])

/**
 * 画布当前展示的工况（一次只挂载一个）。
 * 原来 9 个工况 / 642 张卡片全挂在同一个组件里，任何改动都要把整块画布（约 9200 个 DOM 节点）
 * 重新 diff 一遍 —— 实测改 2 张卡的工况和改 8 张卡的工况耗时一样（254ms / 193ms），
 * 与「改了哪个工况」无关。改为只渲染当前工况后，渲染与连线重算都只按这一份来做。
 */
const activeFrameId = ref('')
/** 当前展示的工况（activeFrameId 失效时回落到第一个） */
const activeFrame = computed<CaseFrame | null>(() => {
  const list = frames.value
  return list.find((f) => f.id === activeFrameId.value) || list[0] || null
})
/** activeFrameId 失效（首次加载 / 删除工况 / 切换分组）时回落到第一个工况 */
watch(
  frames,
  (list) => {
    if (!list.length) {
      activeFrameId.value = ''
      return
    }
    if (!list.some((f) => f.id === activeFrameId.value)) activeFrameId.value = list[0].id
  },
  { immediate: true },
)
/** 切换画布展示的工况（标签页 / 左侧工况列表 / 画布内点击工况都会走这里） */
function setActiveFrame(id: string) {
  if (!id || !frames.value.some((f) => f.id === id)) return
  if (activeFrameId.value === id) return
  activeFrameId.value = id
  // 画布「用例展开」的默认用例名按工况拉取，切工况后要重新对齐
  scheduleCaseIdRefresh()
}

// ==================== 用例分组 ====================
// 每个分组是一份独立图形配置；编辑器只编辑「活动分组」的
// frames / cards / mapping / valueLibrary，切换分组时整体替换。
const activeGroupId = ref(props.activeGroupId || '')
const groupsList = computed<CaseGroup[]>(() => graph.value.groups || [])
const activeGroup = computed<CaseGroup | null>(
  () => groupsList.value.find((g) => g.id === activeGroupId.value) || null,
)
// 分组级内容：读写活动分组（新建分组默认空）
const cardLibrary = computed<CardLibrary>({
  get: () => activeGroup.value?.cards ?? EMPTY_CARDS,
  set: (v) => {
    if (activeGroup.value) activeGroup.value.cards = v
  },
})
const mapping = computed<ObjectMapping>({
  get: () => activeGroup.value?.mapping ?? EMPTY_MAPPING,
  set: (v) => {
    if (activeGroup.value) activeGroup.value.mapping = v
  },
})
const valueLibrary = computed<ValueResource[]>({
  get: () => activeGroup.value?.valueLibrary ?? EMPTY_VALUES,
  set: (v) => {
    if (activeGroup.value) activeGroup.value.valueLibrary = v
  },
})
/** 工况 id → 展开后的用例行（只算当前展示的工况）。
 *  画布一次只挂载一个工况，顶部「N 条用例」也按当前工况计；展开要做拓扑遍历 + 参数平铺 +
 *  笛卡尔积拆分，原来对全部工况算，大配置下每次画布回写都要几十毫秒。 */
const frameCaseRowsMap = computed<Record<string, FrameCaseRow[]>>(() => {
  const map: Record<string, FrameCaseRow[]> = {}
  // 查找表只建一次（原来每个工况都要重建一遍卡片库 / 值资源库索引）。
  // 计算用 toRaw：依赖只需到「数组/对象引用」这一层 —— 画布每次改动都会整体替换 frames，
  // 卡片库 / 值资源库也是整体替换（saveCard / createCard / onValueLibraryChange…）。
  const rawFrames = toRaw(frames.value)
  const target = rawFrames.find((f) => f.id === activeFrameId.value) ?? rawFrames[0]
  if (!target) return map
  const cardLookup = buildCardLookup(toRaw(cardLibrary.value))
  const valueLookup = buildValueLookup(toRaw(valueLibrary.value))
  map[target.id] = frameCaseRowsWithLookups(target, cardLookup, valueLookup)
  return map
})
/** 当前工况展开出的用例数（顶部标签展示） */
const caseCount = computed(() =>
  Object.values(frameCaseRowsMap.value).reduce((sum, rows) => sum + rows.length, 0),
)
/** 旧配置中缺少分组级内容字段的分组 id：待全局库加载后补全（保持历史「打开即见全局库内容」的行为） */
const pendingLegacyGroups = new Set<string>()
function isEmptyCards(c?: CardLibrary): boolean {
  return !c || (!(c.inject?.length) && !(c.sequence?.length) && !(c.result?.length))
}
function isEmptyMapping(m?: ObjectMapping): boolean {
  return !m || (!(m.signals?.length) && !(m.dtcs?.length) && !(m.messages?.length) && !(m.envvars?.length) && !(m.a2l?.length))
}
// setup 阶段即补齐分组级字段（cards/mapping/valueLibrary），保证首次渲染前
// 计算属性不会回落到共享的 EMPTY_* 常量
ensureGroups()
const activeGroupName = computed({
  get: () => activeGroup.value?.name || '',
  set: (v: string) => {
    if (activeGroup.value) activeGroup.value.name = v
  },
})
/** 规范化分组结构：无分组时用 frames 迁移为一个默认分组；补齐分组级内容字段；frames 指向活动分组 */
function ensureGroups() {
  const g = graph.value
  if (!Array.isArray(g.groups) || !g.groups.length) {
    const grp = emptyCaseGroup('GraphCase')
    grp.frames = g.frames || []
    g.groups = [grp]
  }
  for (const grp of g.groups) {
    if (!Array.isArray(grp.frames)) grp.frames = []
    // 旧配置迁移：分组缺少分组级内容时，先用配置级内容兜底（保留用户已有数据）；
    // 记录仍为空的分组，待全局库加载后补全（等价于历史「打开编辑器自动载入全局库」）。
    // 新建分组（emptyCaseGroup）带有显式空字段，不会被标记为旧分组。
    const cardsMissing = !grp.cards || typeof grp.cards !== 'object'
    const mappingMissing = !grp.mapping || typeof grp.mapping !== 'object'
    const valuesMissing = !Array.isArray(grp.valueLibrary)
    if (cardsMissing) {
      grp.cards = props.cards ? JSON.parse(JSON.stringify(props.cards)) : emptyCardLibrary()
    }
    if (mappingMissing) {
      grp.mapping = props.mapping
        ? JSON.parse(JSON.stringify(props.mapping))
        : emptyMapping()
    }
    if (valuesMissing) {
      grp.valueLibrary = Array.isArray(props.valueLibrary)
        ? JSON.parse(JSON.stringify(props.valueLibrary))
        : emptyValueLibrary()
    }
    if (grp.id && (cardsMissing || valuesMissing || mappingMissing)) {
      pendingLegacyGroups.add(grp.id)
    }
  }
  if (!activeGroupId.value || !g.groups.some((x) => x.id === activeGroupId.value)) {
    activeGroupId.value = g.groups[0].id
  }
  const active = g.groups.find((x) => x.id === activeGroupId.value)
  if (active) g.frames = active.frames
}

/** 全局库加载完成后：把仍为空的旧分组内容用全局库模板补全 */
function migrateLegacyGroups() {
  if (!pendingLegacyGroups.size) return
  const groups = graph.value.groups || []
  let changed = false
  for (const id of pendingLegacyGroups) {
    const grp = groups.find((x) => x.id === id)
    if (!grp) continue
    if (isEmptyCards(grp.cards) && !isEmptyCards(globalTemplate.value.cards)) {
      grp.cards = JSON.parse(JSON.stringify(globalTemplate.value.cards))
      changed = true
    }
    if ((grp.valueLibrary || []).length === 0 && globalTemplate.value.valueLibrary.length) {
      grp.valueLibrary = JSON.parse(JSON.stringify(globalTemplate.value.valueLibrary))
      changed = true
    }
    if (isEmptyMapping(grp.mapping) && !isEmptyMapping(globalTemplate.value.mapping)) {
      grp.mapping = JSON.parse(JSON.stringify(globalTemplate.value.mapping))
      changed = true
    }
  }
  pendingLegacyGroups.clear()
  if (changed) {
    syncRefsFromLibrary(cardLibrary.value, false)
    emitGroupUpdate()
  }
}
/** 把当前编辑的 frames 写回活动分组（保持 groups 与 frames 一致）。
 *  深拷贝防止 CaseFrameCanvas 的 lastEmittedFrames 引用相等跳过 watch 更新。 */
function syncActiveGroupFrames() {
  const grp = (graph.value.groups || []).find((x) => x.id === activeGroupId.value)
  if (grp) grp.frames = JSON.parse(JSON.stringify(graph.value.frames || []))
}
/**
 * 最近一次由本组件 emit 出去的 graph 对象（引用比对）。
 * `v-model:graph` 会把同一个对象原样回传成 props.graph；若照旧再深拷贝一次，
 * 每次交互都会替换 graph.value，进而让整个编辑器（含画布上百个节点）整树重渲染。
 * 这里按引用相等跳过「自己回传」的那次，只有父级真正改过（新对象）时才同步。
 */
let lastEmittedGraph: unknown = null
/** 整图回写的统一出口：深拷贝一份交给父级，并记下引用供上面的回传判断使用 */
function emitGraph() {
  // toRaw 后再序列化：整图是深层响应式代理，直接 JSON.stringify 会给每个属性访问
  // 加一层 Proxy 取值 + reactive 缓存查找（大配置下每次交互多花几十毫秒）。
  const payload = JSON.parse(JSON.stringify(toRaw(graph.value)))
  lastEmittedGraph = payload
  emit('update:graph', payload)
}
/** 切换活动分组：保存当前分组后载入目标分组 */
function switchGroup(id: string) {
  if (id === activeGroupId.value) return
  syncActiveGroupFrames()
  activeGroupId.value = id
  const grp = (graph.value.groups || []).find((x) => x.id === id)
  graph.value.frames = grp ? grp.frames : []
  selectedFrameId.value = ''
  editorTarget.value = 'frames'
  emitGraph()
  scheduleCaseIdRefresh()
  nextTick(() => {
    if (frames.value.length) selectFrame(frames.value[0].id)
  })
}
/** 在编辑器内新建分组并切过去（内容默认空白） */
function addGroup() {
  syncActiveGroupFrames()
  const g = graph.value
  if (!Array.isArray(g.groups)) g.groups = []
  const grp = emptyCaseGroup(`GraphCase${g.groups.length + 1}`)
  g.groups.push(grp)
  activeGroupId.value = grp.id
  g.frames = grp.frames
  selectedFrameId.value = ''
  emitGraph()
  ElMessage.success(`已新建分组 ${grp.name}（内容为空）`)
}
/** 分组名变更：写回并通知父级 */
function onGroupNameChange() {
  syncActiveGroupFrames()
  emitGraph()
}

const selectedCard = computed<Card | null>(() => {
  if (editorTarget.value !== 'card') return null
  for (const t of cardTabs) {
    const found = cardLibrary.value[t.value].find((c) => c.id === selectedCardId.value)
    if (found) return found
  }
  return null
})

function selectCard(card: Card) {
  editorTarget.value = 'card'
  selectedCardId.value = card.id
  selectionCardId.value = card.id
  selectionCardIds.value = [card.id]
}
// 按 id 跳转到卡片编辑（用于卡片引用步骤的双击跳转）
function selectCardById(cardId: string) {
  if (!cardId) return
  for (const t of cardTabs) {
    const found = cardLibrary.value[t.value].find((c) => c.id === cardId)
    if (found) {
      selectCard(found)
      ElMessage.info(`已跳转到「${found.name || found.id}」`)
      return
    }
  }
  ElMessage.warning('未找到引用的卡片（可能已被删除）')
}
function onCardDragStart(e: DragEvent, card: Card) {
  if (!e.dataTransfer) return
  const isCopy = e.ctrlKey || e.metaKey
  if (isCopy) {
    // Ctrl+拖拽：在面板内复制卡片
    e.dataTransfer.effectAllowed = 'copy'
    e.dataTransfer.setData('application/x-copy-card', card.id)
  } else {
    // 普通拖拽：拖到工况画布创建节点（多选时带上整个选中集合）
    e.dataTransfer.effectAllowed = 'copy'
    const ids = selectionCardIds.value.includes(card.id) ? selectionCardIds.value : [card.id]
    const cards = ids.map((id) => findCardById(id)).filter((c): c is Card => !!c)
    if (cards.length > 1) {
      e.dataTransfer.setData('application/x-graph-cards', JSON.stringify(cards))
    } else {
      e.dataTransfer.setData('application/x-graph-card', JSON.stringify(card))
    }
  }
  e.dataTransfer.setData('text/plain', card.name)
}
function onFrameDragStart(e: DragEvent, frame: CaseFrame) {
  if (!e.dataTransfer) return
  const isCopy = e.ctrlKey || e.metaKey
  if (isCopy) {
    e.dataTransfer.effectAllowed = 'copy'
    e.dataTransfer.setData('application/x-copy-frame', frame.id)
  }
  e.dataTransfer.setData('text/plain', frame.name)
}
/** 生成带序号的复制名：原名 → 原名 2 → 原名 3 … */
function nextCopyName(originalName: string, existingNames: string[]): string {
  const match = originalName.match(/^(.*?)\s+(\d+)$/)
  const base = match ? match[1] : originalName
  let maxNum = 0
  const baseExists = existingNames.some((n) => n === base)
  for (const name of existingNames) {
    const m = name.match(/^(.*?)\s+(\d+)$/)
    if (m && m[1] === base) {
      maxNum = Math.max(maxNum, parseInt(m[2], 10))
    }
  }
  const nextNum = Math.max(maxNum, baseExists ? 1 : 0) + 1
  return `${base} ${nextNum}`
}
/** 复制卡片（Ctrl+拖拽触发，复制到原分类） */
function duplicateCard(cardId: string) {
  const card = findCardById(cardId)
  if (!card) return
  const targetRole: InjectRole = card.type === 'inject' && card.role === 'recover' ? 'recover' : 'inject'
  duplicateCardTo(cardId, targetRole)
}
/** 复制卡片到指定故障角色（inject=故障注入 / recover=故障恢复） */
function duplicateCardTo(cardId: string, role: InjectRole) {
  const card = findCardById(cardId)
  if (!card) return
  const c: Card = JSON.parse(JSON.stringify(card))
  c.id = genId('card')
  c.refId = undefined
  c.steps = (c.steps || []).map((s: CardStep) => ({ ...s, id: genId('step') }))
  // inject 类型按目标 role 归入故障注入/恢复分组
  if (card.type === 'inject') c.role = role
  // 命名：仅与目标分组的已有卡片去重
  const peers = (cardLibrary.value[card.type] || []).filter((x) => {
    if (card.type !== 'inject') return true
    return (x.role === 'recover') === (role === 'recover')
  })
  c.name = nextCopyName(card.name || '卡片', peers.map((x) => x.name))
  const next: CardLibrary = {
    inject: [...cardLibrary.value.inject],
    sequence: [...cardLibrary.value.sequence],
    result: [...cardLibrary.value.result],
  }
  next[card.type].push(c)
  cardLibrary.value = next
  selectedCardId.value = c.id
  selectionCardId.value = c.id
  selectionKind.value = 'card'
  emitGroupUpdate()
  ElMessage.success(`已复制卡片：${c.name}`)
}
/** 复制工况（Ctrl+拖拽触发） */
function duplicateFrame(frameId: string) {
  const frame = frames.value.find((f) => f.id === frameId)
  if (!frame) return
  const f: CaseFrame = JSON.parse(JSON.stringify(frame))
  f.id = genFrameId()
  const existingNames = frames.value.map((x) => x.name)
  f.name = nextCopyName(frame.name || '工况', existingNames)
  const next: Graph = { ...graph.value, frames: [...frames.value, f] }
  onGraphChange(next)
  selectFrame(f.id)
  ElMessage.success(`已复制工况：${f.name}`)
}
function selectFrame(id: string) {
  editorTarget.value = 'frames'
  selectedFrameId.value = id
  selectionCardId.value = ''
  // 左侧工况列表点选 → 画布切到该工况
  setActiveFrame(id)
}
function createCard(type: CardType, role?: InjectRole) {
  const card = newCard(type)
  if (type === 'inject' && role === 'recover') {
    card.role = 'recover'
    card.name = '故障恢复'
  } else {
    card.name = cardTabs.find((t) => t.value === type)?.label || type
  }
  editorTarget.value = 'card'
  selectedCardId.value = card.id
  selectionCardId.value = card.id
  const next: CardLibrary = {
    inject: [...cardLibrary.value.inject],
    sequence: [...cardLibrary.value.sequence],
    result: [...cardLibrary.value.result],
  }
  next[type].push(card)
  cardLibrary.value = next
  emitGroupUpdate()
}
function saveCard(card: Card) {
  const next: CardLibrary = {
    inject: [...cardLibrary.value.inject],
    sequence: [...cardLibrary.value.sequence],
    result: [...cardLibrary.value.result],
  }
  const bucket = card.type
  const idx = next[bucket].findIndex((c) => c.id === card.id)
  if (idx >= 0) next[bucket][idx] = card
  else next[bucket].push(card)
  cardLibrary.value = next
  syncRefsFromLibrary(cardLibrary.value, true)
  emitGroupUpdate()
  ElMessage.success('卡片已保存')
}
function removeCard(card: Card) {
  ElMessageBox.confirm(`确认删除「${card.name}」？`, '提示', { type: 'warning' })
    .then(() => {
      const next: CardLibrary = {
        inject: [...cardLibrary.value.inject],
        sequence: [...cardLibrary.value.sequence],
        result: [...cardLibrary.value.result],
      }
      next[card.type] = next[card.type].filter((c) => c.id !== card.id)
      cardLibrary.value = next
      if (selectedCardId.value === card.id) selectedCardId.value = ''
      if (selectionCardId.value === card.id) selectionCardId.value = ''
      selectionCardIds.value = selectionCardIds.value.filter((id) => id !== card.id)
      emitGroupUpdate()
    })
    .catch(() => {})
}
// 删除：若卡片属于多选集合，则批量删除整个集合
function removeCardSelection(card: Card) {
  if (!(selectionCardIds.value.includes(card.id) && selectionCardIds.value.length > 1)) {
    removeCard(card)
    return
  }
  const ids = new Set(selectionCardIds.value)
  const names = [...ids]
    .map((id) => findCardById(id))
    .filter((c): c is Card => !!c)
    .map((c) => c.name)
    .slice(0, 3)
    .join('、')
  ElMessageBox.confirm(`确认删除选中的 ${ids.size} 张卡片（${names}${ids.size > 3 ? '…' : ''}）？`, '提示', { type: 'warning' })
    .then(() => {
      const next: CardLibrary = {
        inject: cardLibrary.value.inject.filter((c) => !ids.has(c.id)),
        sequence: cardLibrary.value.sequence.filter((c) => !ids.has(c.id)),
        result: cardLibrary.value.result.filter((c) => !ids.has(c.id)),
      }
      cardLibrary.value = next
      selectedCardId.value = ''
      selectionCardId.value = ''
      selectionCardIds.value = []
      emitGroupUpdate()
    })
    .catch(() => {})
}
function addFrame() {
  const f: CaseFrame = { id: genFrameId(), name: `工况${frames.value.length + 1}`, lanes: [{ id: genId('lane'), type: 'main', nodeIds: [] }], nodes: {}, edges: {} }
  const next: Graph = { ...graph.value, frames: [...frames.value, f] }
  onGraphChange(next)
  selectFrame(f.id)
}
function removeFrame(id: string) {
  const next: Graph = { ...graph.value, frames: frames.value.filter((f) => f.id !== id) }
  onGraphChange(next)
  if (selectedFrameId.value === id) selectedFrameId.value = ''
}
function genFrameId(): string {
  return `frame-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

// ==================== 工况 / 卡片 快捷键复制粘贴 ====================
function findCardById(id: string): Card | null {
  for (const t of cardTabs) {
    const found = cardLibrary.value[t.value].find((c) => c.id === id)
    if (found) return found
  }
  return null
}
function cloneCard(card: Card): Card {
  const c: Card = JSON.parse(JSON.stringify(card))
  c.id = genId('card')
  c.name = (card.name || '卡片') + ' 副本'
  c.refId = undefined
  c.steps = (c.steps || []).map((s: CardStep) => ({ ...s, id: genId('step') }))
  return c
}
function cloneFrame(frame: CaseFrame): CaseFrame {
  const f: CaseFrame = JSON.parse(JSON.stringify(frame))
  f.id = genFrameId()
  f.name = (frame.name || '工况') + ' 副本'
  return f
}
function copySelectedEntity() {
  if (selectionKind.value === 'card' && selectionCardIds.value.length) {
    const cards = selectionCardIds.value
      .map((id) => findCardById(id))
      .filter((c): c is Card => !!c)
      .map((c) => JSON.parse(JSON.stringify(c)) as Card)
    if (cards.length) {
      entityClip.value = { kind: 'cards', data: cards }
      ElMessage.success(cards.length > 1 ? `已复制 ${cards.length} 张卡片` : `已复制卡片：${cards[0].name}`)
      return
    }
  }
  const f = frames.value.find((x) => x.id === selectedFrameId.value)
  if (f) {
    entityClip.value = { kind: 'frame', data: JSON.parse(JSON.stringify(f)) }
    ElMessage.success(`已复制工况：${f.name}`)
    return
  }
  ElMessage.warning('请先选中要复制的工况或卡片')
}
function pasteEntity() {
  const clip = entityClip.value
  if (!clip) {
    ElMessage.warning('剪贴板为空，请先复制工况或卡片')
    return
  }
  if (clip.kind === 'cards') {
    const next: CardLibrary = {
      inject: [...cardLibrary.value.inject],
      sequence: [...cardLibrary.value.sequence],
      result: [...cardLibrary.value.result],
    }
    const added: Card[] = []
    for (const src of clip.data) {
      const card = cloneCard(src)
      next[card.type].push(card)
      added.push(card)
    }
    cardLibrary.value = next
    selectionCardIds.value = added.map((c) => c.id)
    selectionCardId.value = added.length ? added[added.length - 1].id : ''
    selectionKind.value = 'card'
    emitGroupUpdate()
    ElMessage.success(added.length > 1 ? `已粘贴 ${added.length} 张卡片` : `已粘贴卡片：${added[0].name}`)
  } else {
    const frame = cloneFrame(clip.data)
    const next: Graph = { ...graph.value, frames: [...frames.value, frame] }
    onGraphChange(next)
    selectFrame(frame.id)
    ElMessage.success(`已粘贴工况：${frame.name}`)
  }
}

// 全局快捷键（Ctrl+C/V/S）已迁移到统一快捷键层：见文件末尾 editorShortcuts()

// ==================== 可停靠面板布局（split 树 + tab 分组） ====================
type PanelId = 'frames' | 'inject' | 'sequence' | 'result' | 'editor' | 'mapping' | 'func' | 'obj' | 'value'
type DockZone = 'left' | 'right' | 'top' | 'bottom' | 'center'

interface PanelState {
  id: PanelId
  title: string
  help?: string
  visible: boolean
  floating: { x: number; y: number; width: number; height: number } | null
}

const panelStates = ref<Record<PanelId, PanelState>>({
  frames: { id: 'frames', title: '工况', help: '一个工况即一个用例模板；拖入卡片节点并连线编排', visible: true, floating: null },
  inject: { id: 'inject', title: '故障注入', help: '拖拽故障注入卡片到工况', visible: true, floating: null },
  sequence: { id: 'sequence', title: '测试序列', help: '拖拽测试序列卡片到工况', visible: true, floating: null },
  result: { id: 'result', title: '结果判断', help: '拖拽结果判断卡片到工况', visible: true, floating: null },
  editor: { id: 'editor', title: '编辑', help: '选择卡片/工况进行编辑；拖入函数/对象自动生成步骤', visible: true, floating: null },
  mapping: { id: 'mapping', title: '对象映射表', help: '变量名（用例中显示）↔ 对象（生成时使用）；拖 ⠿ 手柄把变量拖到步骤/参数处使用', visible: true, floating: null },
  func: { id: 'func', title: '函数库', help: '拖拽函数卡片到工况直接生成卡片，拖到步骤列表则生成函数调用步骤', visible: true, floating: null },
  obj: { id: 'obj', title: '对象浏览器', help: '浏览 DBC/DTC/A2L 对象，拖拽到步骤/参数使用', visible: true, floating: null },
  value: { id: 'value', title: '值资源库', help: '定义常量/列表/区间，参数框可用 @const:/@list:/@range: 引用', visible: true, floating: null },
})

const panelMeta = computed<Record<string, { title: string; help?: string }>>(() => {
  const out: Record<string, { title: string; help?: string }> = {}
  for (const p of Object.values(panelStates.value)) out[p.id] = { title: p.title, help: p.help }
  return out
})

let _nodeSeq = 0
function newNodeId(): string {
  return `n${++_nodeSeq}`
}

// 停靠布局树：根节点是一个 split（row：左中右三栏）
const dockTree = ref<LayoutNode>(initTree())

function initTree(): LayoutNode {
  return {
    id: newNodeId(),
    kind: 'split',
    dir: 'row',
    ratios: [2, 5, 2.5],
    children: [
      // 左栏：2×2 网格（工况|序列 / 故障注入|检查）
      {
        id: newNodeId(),
        kind: 'split',
        dir: 'column',
        ratios: [1, 1],
        children: [
          {
            id: newNodeId(),
            kind: 'split',
            dir: 'row',
            ratios: [1, 1],
            children: [
              { id: newNodeId(), kind: 'tab', tabs: ['frames'], active: 'frames' },
              { id: newNodeId(), kind: 'tab', tabs: ['sequence'], active: 'sequence' },
            ],
          },
          {
            id: newNodeId(),
            kind: 'split',
            dir: 'row',
            ratios: [1, 1],
            children: [
              { id: newNodeId(), kind: 'tab', tabs: ['inject'], active: 'inject' },
              { id: newNodeId(), kind: 'tab', tabs: ['result'], active: 'result' },
            ],
          },
        ],
      },
      // 中栏：编辑器
      {
        id: newNodeId(),
        kind: 'tab',
        tabs: ['editor'],
        active: 'editor',
      },
      // 右栏：左侧（函数库在上、对象映射表在中、值资源库在下），右侧（对象浏览器）
      {
        id: newNodeId(),
        kind: 'split',
        dir: 'row',
        ratios: [1.1, 1],
        children: [
          {
            id: newNodeId(),
            kind: 'split',
            dir: 'column',
            ratios: [1, 1, 1],
            children: [
              { id: newNodeId(), kind: 'tab', tabs: ['func'], active: 'func' },
              { id: newNodeId(), kind: 'tab', tabs: ['mapping'], active: 'mapping' },
              { id: newNodeId(), kind: 'tab', tabs: ['value'], active: 'value' },
            ],
          },
          { id: newNodeId(), kind: 'tab', tabs: ['obj'], active: 'obj' },
        ],
      },
    ],
  }
}

const visibleDockRoot = computed<LayoutNode | null>(() => {
  const root = dockTree.value
  return pruneTree(root)
})

// 移除不可见面板后返回精简树（保留结构）；全空则返回 null
function pruneTree(node: LayoutNode): LayoutNode | null {
  if (node.kind === 'tab') {
    const tabs = (node.tabs ?? []).filter((id) => panelStates.value[id as PanelId]?.visible)
    if (!tabs.length) return null
    const active = node.active && tabs.includes(node.active) ? node.active : tabs[0]
    return { ...node, tabs, active }
  }
  const children = (node.children ?? []).map(pruneTree).filter(Boolean) as LayoutNode[]
  if (!children.length) return null
  return { ...node, children }
}

const floatingPanels = computed<PanelState[]>(() =>
  Object.values(panelStates.value).filter((p) => !!p.floating && p.visible),
)

function defaultFloat(id: PanelId): { width: number; height: number } {
  const map: Record<PanelId, { width: number; height: number }> = {
    frames: { width: 280, height: 360 },
    inject: { width: 280, height: 360 },
    sequence: { width: 280, height: 360 },
    result: { width: 280, height: 360 },
    editor: { width: 640, height: 520 },
    mapping: { width: 300, height: 480 },
    func: { width: 420, height: 560 },
    obj: { width: 380, height: 560 },
    value: { width: 340, height: 480 },
  }
  return map[id]
}

// 从树中移除该面板（若其 tab 分组变空则移除该节点）
function removeFromTree(id: PanelId) {
  function visit(node: LayoutNode): LayoutNode | null {
    if (node.kind === 'tab') {
      const tabs = (node.tabs ?? []).filter((t) => t !== id)
      if (!tabs.length) return null
      return { ...node, tabs, active: node.active === id ? tabs[0] : node.active }
    }
    const children = (node.children ?? []).map(visit).filter(Boolean) as LayoutNode[]
    if (children.length === 1) return children[0]
    return { ...node, children }
  }
  const root = visit(dockTree.value)
  if (root) dockTree.value = root
}

// 找到包含某面板的 tab 节点
function findTabNode(node: LayoutNode, id: string): LayoutNode | null {
  if (node.kind === 'tab' && (node.tabs ?? []).includes(id)) return node
  if (node.kind === 'split') {
    for (const c of node.children ?? []) {
      const r = findTabNode(c, id)
      if (r) return r
    }
  }
  return null
}

// 停靠目标：检测鼠标下的面板，以及它所属 tab 分组
function detectTarget(pos: { x: number; y: number }): { tabNodeId: string; rect: DOMRect } | null {
  const el = document.elementFromPoint(pos.x, pos.y)
  if (!el) return null
  const panelEl = el.closest && el.closest('[data-panel-id]')
  if (!panelEl) return null
  const pid = panelEl.getAttribute('data-panel-id')
  if (!pid || pid === draggingPanelId.value) return null
  const tabNode = findTabNode(dockTree.value, pid)
  if (!tabNode) return null
  // 使用 tab 分组容器（tabbar+body）的整体矩形作为放置区
  const tabGroupEl = el.closest('[data-tab-group]')
  const rect = (tabGroupEl as HTMLElement | null)?.getBoundingClientRect() ?? panelEl.getBoundingClientRect()
  return { tabNodeId: tabNode.id, rect }
}

const dockBodyEl = ref<HTMLElement | null>(null)
const dockOverlayVisible = ref(false)
const dockHover = ref<DockZone | null>(null)
const draggingPanelId = ref<PanelId | null>(null)
const dragGrab = ref<{ dx: number; dy: number } | null>(null)
const dockTargetTabNodeId = ref<string | null>(null)
const dockTargetRect = ref<DOMRect | null>(null)

const overlayStyle = computed(() => {
  const r = dockTargetRect.value
  if (!r) return {}
  return { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` }
})

function zoneWithinRect(pos: { x: number; y: number }, r: DOMRect): DockZone | null {
  if (pos.x < r.left || pos.x > r.right || pos.y < r.top || pos.y > r.bottom) return null
  const x = (pos.x - r.left) / r.width
  const y = (pos.y - r.top) / r.height
  if (y < 0.28) return 'top'
  if (y > 0.72) return 'bottom'
  if (x < 0.28) return 'left'
  if (x > 0.72) return 'right'
  return 'center'
}

function closePanel(id: string) {
  panelStates.value[id as PanelId].visible = false
}

// tab 切换激活
function activateTab(id: string) {
  const node = findTabNode(dockTree.value, id)
  if (node) node.active = id
}

function onPanelDragStart(id: string) {
  draggingPanelId.value = id as PanelId
  dragGrab.value = null
  window.addEventListener('mousemove', onWindowMove)
  window.addEventListener('mouseup', onWindowUp)
}
function onWindowMove(e: MouseEvent) {
  onPanelDragMove({ x: e.clientX, y: e.clientY })
}
function onWindowUp() {
  window.removeEventListener('mousemove', onWindowMove)
  window.removeEventListener('mouseup', onWindowUp)
  onPanelDragEnd()
}
function onPanelDragMove(pos: { x: number; y: number }) {
  const id = draggingPanelId.value
  if (!id) return
  const p = panelStates.value[id]

  // 面板仍在停靠树里时，第一次移动立即脱离树变浮动，跟随鼠标
  if (!p.floating) {
    const el = document.querySelector(`[data-panel-id="${id}"]`) as HTMLElement | null
    const rect = el?.getBoundingClientRect()
    const d = defaultFloat(id)
    const w = rect?.width || d.width
    const h = rect?.height || d.height
    const x = rect ? rect.left : pos.x - w / 2
    const y = rect ? rect.top : pos.y - 16
    p.floating = { x, y, width: w, height: h }
    dragGrab.value = { dx: pos.x - x, dy: pos.y - y }
    removeFromTree(id)
  }

  // 已是浮动面板但尚未记录抓取偏移时，初始化偏移
  if (!dragGrab.value) {
    dragGrab.value = { dx: pos.x - p.floating.x, dy: pos.y - p.floating.y }
  }

  // 跟随鼠标
  p.floating.x = pos.x - dragGrab.value.dx
  p.floating.y = pos.y - dragGrab.value.dy

  const target = detectTarget(pos)
  if (target) {
    dockTargetTabNodeId.value = target.tabNodeId
    dockTargetRect.value = target.rect
    dockHover.value = zoneWithinRect(pos, target.rect)
    dockOverlayVisible.value = dockHover.value !== null
  } else {
    dockTargetTabNodeId.value = null
    dockTargetRect.value = null
    dockHover.value = null
    dockOverlayVisible.value = false
  }
}

function onPanelDragEnd() {
  const id = draggingPanelId.value
  draggingPanelId.value = null
  dragGrab.value = null
  const tabNodeId = dockTargetTabNodeId.value
  const zone = dockHover.value
  dockTargetTabNodeId.value = null
  dockTargetRect.value = null
  dockOverlayVisible.value = false
  dockHover.value = null
  if (!id) return

  if (tabNodeId && zone) {
    // 停靠到目标 tab 分组
    removeFromTree(id)
    panelStates.value[id].floating = null
    const targetNode = findNodeById(dockTree.value, tabNodeId)
    if (targetNode && targetNode.kind === 'tab') {
      if (zone === 'center') {
        // 中：加入同一 tab 分组（页签切换）
        targetNode.tabs = [...(targetNode.tabs ?? []), id]
        targetNode.active = id
      } else {
        // 上下左右：分栏共存，对齐铺满
        splitNode(targetNode, id, zone)
      }
    }
  }
  // 未命中目标：保持浮动（已在 drag-move 时脱离树并跟随鼠标）
}

function findNodeById(node: LayoutNode, id: string): LayoutNode | null {
  if (node.id === id) return node
  if (node.kind === 'split') {
    for (const c of node.children ?? []) {
      const r = findNodeById(c, id)
      if (r) return r
    }
  }
  return null
}

// 在目标 tab 节点处，按方向分栏（上下=column，左右=row），用新 split 包裹目标与面板
function splitNode(targetNode: LayoutNode, newPanelId: PanelId, zone: DockZone) {
  const parent = findParentOfNode(dockTree.value, targetNode.id)
  const newTab: LayoutNode = { id: newNodeId(), kind: 'tab', tabs: [newPanelId], active: newPanelId }
  const dir: 'row' | 'column' = zone === 'top' || zone === 'bottom' ? 'column' : 'row'
  const before = zone === 'top' || zone === 'left'
  const wrapSplit: LayoutNode = {
    id: newNodeId(),
    kind: 'split',
    dir,
    ratios: [1, 1],
    children: before ? [newTab, targetNode] : [targetNode, newTab],
  }

  if (!parent) {
    dockTree.value = wrapSplit
    return
  }
  const siblings = parent.children ?? []
  const idx = siblings.findIndex((c) => c.id === targetNode.id)
  siblings[idx] = wrapSplit
}

function findParentOfNode(root: LayoutNode, childId: string, parent: LayoutNode | null = null): LayoutNode | null {
  if (root.id === childId) return parent
  if (root.kind === 'split') {
    for (const c of root.children ?? []) {
      const r = findParentOfNode(c, childId, root)
      if (r) return r
    }
  }
  return null
}

function toggleFramesDrawer() {
  panelStates.value.frames.visible = !panelStates.value.frames.visible
}
function toggleInjectDrawer() {
  panelStates.value.inject.visible = !panelStates.value.inject.visible
}
function toggleSequenceDrawer() {
  panelStates.value.sequence.visible = !panelStates.value.sequence.visible
}
function toggleResultDrawer() {
  panelStates.value.result.visible = !panelStates.value.result.visible
}
function toggleFuncDrawer() {
  const p = panelStates.value.func
  p.visible = !p.visible
}
function toggleObjDrawer() {
  const p = panelStates.value.obj
  p.visible = !p.visible
}
function toggleValueDrawer() {
  const p = panelStates.value.value
  p.visible = !p.visible
}

// ===== 同步 / 保存 =====
/** 分组内容变更的统一回写出口：同步 frames 到活动分组并通知父级 */
function emitGroupUpdate() {
  syncActiveGroupFrames()
  emitGraph()
}
/** 点击「保存」按钮：先同步当前分组内容再通知父级保存（与 Ctrl+S 快捷键行为一致） */
function onSaveClick() {
  emitGroupUpdate()
  emit('save')
}
function onGraphChange(g: Graph) {
  // 画布回写的是「本编辑器 graph 的浅拷贝 + 新 frames」：只就地换 frames 即可。
  // 整体替换 graph.value 会让画布（大工况上百个节点）在每次交互后再整树重渲染一次。
  const cur = graph.value as unknown as Record<string, unknown>
  const next = g as unknown as Record<string, unknown>
  const sameOthers = Object.keys(next).every((k) => k === 'frames' || next[k] === cur[k])
  if (sameOthers) graph.value.frames = g.frames
  else graph.value = g
  syncActiveGroupFrames()
  emitGraph()
  scheduleCaseIdRefresh()
}
function onMappingChange(m: ObjectMapping) {
  // 只写入当前分组的映射表（不再写回全局库）
  mapping.value = m
  emit('update:mapping', JSON.parse(JSON.stringify(m)))
  emitGroupUpdate()
}
function bucketOfMapping(kind: MappingKind): keyof ObjectMapping {
  const map: Record<MappingKind, keyof ObjectMapping> = {
    signal: 'signals',
    dtc: 'dtcs',
    message: 'messages',
    envvar: 'envvars',
    a2l: 'a2l',
  }
  return map[kind]
}
function onAddMapping(payload: { kind: MappingKind; name: string }) {
  if (!payload?.name) return
  const m: ObjectMapping = JSON.parse(JSON.stringify(mapping.value))
  const bucket = bucketOfMapping(payload.kind)
  if (!m[bucket].some((e) => e.alias === payload.name)) {
    m[bucket].push({ alias: payload.name, kind: payload.kind, name: payload.name, value: '' })
    mapping.value = m
    emit('update:mapping', JSON.parse(JSON.stringify(m)))
    emitGroupUpdate()
    ElMessage.success(`已自动添加映射：${payload.name}`)
  }
}
// 步骤参数里的对象类型 → 映射表分类
function argTypeToMappingKind(t?: string): MappingKind | null {
  switch (t) {
    case 'signal': return 'signal'
    case 'dtc': return 'dtc'
    case 'message': return 'message'
    case 'envvar': return 'envvar'
    case 'sysvar':
    case 'a2l': return 'a2l'
    default: return null
  }
}
// 从卡片步骤提取用到的对象变量（set/reset 对象在 key，其它步骤对象在 value）
function collectCardVariables(): Array<{ kind: MappingKind; name: string }> {
  const out: Array<{ kind: MappingKind; name: string }> = []
  const seen = new Set<string>()
  const buckets: CardType[] = ['inject', 'sequence', 'result']
  for (const b of buckets) {
    for (const card of cardLibrary.value[b] || []) {
      for (const step of card.steps || []) {
        if (step.kind === 'card') continue
        const isSetReset = step.kind === 'set' || step.kind === 'check' || step.kind === 'reset'
        for (const arg of step.args || []) {
          const kind = argTypeToMappingKind(arg.argType)
          if (!kind) continue
          const name = isSetReset ? arg.key : arg.value
          if (!name) continue
          // 还是 {{参数}} 占位符：不是真实对象名，别把它塞进映射表
          if (name.includes('{{')) continue
          const key = `${kind}:${name}`
          if (!seen.has(key)) {
            seen.add(key)
            out.push({ kind, name })
          }
        }
      }
    }
  }
  return out
}
// 把变量合并进映射表（已存在则跳过）
function mergeMappingEntries(m: ObjectMapping, vars: Array<{ kind: MappingKind; name: string }>): ObjectMapping {
  const next: ObjectMapping = JSON.parse(JSON.stringify(m))
  for (const v of vars) {
    const bucket = bucketOfMapping(v.kind)
    if (!next[bucket].some((e) => e.alias === v.name)) {
      next[bucket].push({ alias: v.name, kind: v.kind, name: v.name, value: '' })
    }
  }
  return next
}
function syncRefsFromLibrary(lib: CardLibrary, notify: boolean) {
  // 同步会整块覆盖引用节点的步骤：先按节点 id 记下旧步骤，供被删步骤上的连线就近改锚
  const oldStepsByNode = new Map<string, CardStep[]>()
  for (const f of graph.value.frames || []) {
    for (const [nid, n] of Object.entries(f.nodes || {})) {
      if (n.refId) oldStepsByNode.set(nid, [...(n.steps ?? [])])
    }
  }
  const { graph: synced, synced: n } = syncGraphRefs(graph.value, lib)
  let portFixed = 0
  if (n > 0) {
    graph.value = synced
    // 主序列（引用卡片）步骤变了 → 接线口按锚点自动跟随；锚定步骤被删的就近改锚
    for (const f of graph.value.frames || []) {
      const sid = frameSequenceId(f)
      if (!sid) continue
      portFixed += reanchorFrameSeqPorts(f, oldStepsByNode.get(sid) ?? [])
    }
    syncActiveGroupFrames()
  }
  const migrated = migrateCopyNodes(false)
  if (n > 0 || migrated > 0) {
    emitGraph()
    if (notify && n > 0) ElMessage.info(`已从卡片库同步 ${n} 张引用卡片`)
    if (notify && portFixed > 0) ElMessage.warning(`已自动调整 ${portFixed} 条连线的接线口`)
  }
}

/** 无损迁移：把「库卡片整份副本」形式的工况节点改成「卡片引用」，节点编辑框里才会出现「参数取值」 */
function migrateCopyNodes(notify: boolean): number {
  const n = migrateRefCopyNodes(graph.value, cardLibrary.value)
  if (n > 0) {
    syncActiveGroupFrames()
    emitGraph()
    if (notify) ElMessage.info(`已将 ${n} 个副本卡片节点改为卡片引用（可填「参数取值」）`)
  }
  return n
}

// ===== 全局库模板（不再自动注入/写回分组，改为手动导入导出） =====
function onValueLibraryChange(values: ValueResource[]) {
  valueLibrary.value = values
  emitGroupUpdate()
}

/** 加载全局库到模板（不修改任何分组内容） */
async function loadGlobal() {
  try {
    const res: any = await getGlobalLibrary()
    const data = res?.data?.data ?? res?.data ?? {}
    globalTemplate.value = {
      cards: {
        inject: data.cards?.inject || [],
        sequence: data.cards?.sequence || [],
        result: data.cards?.result || [],
      },
      mapping: {
        signals: data.mapping?.signals || [],
        dtcs: data.mapping?.dtcs || [],
        messages: data.mapping?.messages || [],
        envvars: data.mapping?.envvars || [],
        a2l: data.mapping?.a2l || [],
      },
      valueLibrary: Array.isArray(data.value_library) ? data.value_library : [],
    }
  } catch (e: any) {
    ElMessage.warning('加载全局库失败：' + (e?.message || String(e)))
  }
}

/** 把全局模板导入到当前分组（覆盖式） */
async function importGlobalTemplate() {
  const grp = activeGroup.value
  if (!grp) return
  try {
    await ElMessageBox.confirm(
      `将全局模板（卡片库 / 对象映射表 / 值资源库）导入到当前分组「${grp.name}」？\n当前分组已有的同项内容将被覆盖。`,
      '导入全局模板',
      { confirmButtonText: '导入', cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    return
  }
  await loadGlobal()
  grp.cards = JSON.parse(JSON.stringify(globalTemplate.value.cards))
  grp.mapping = JSON.parse(JSON.stringify(globalTemplate.value.mapping))
  grp.valueLibrary = JSON.parse(JSON.stringify(globalTemplate.value.valueLibrary))
  // 卡片步骤里引用的对象补齐到映射表
  const vars = collectCardVariables()
  if (vars.length && grp.mapping) {
    grp.mapping = mergeMappingEntries(grp.mapping, vars)
  }
  syncRefsFromLibrary(cardLibrary.value, true)
  emitGroupUpdate()
  ElMessage.success('已导入全局模板到当前分组')
}

/** 把当前分组导出为全局模板 */
async function exportGlobalTemplate() {
  const grp = activeGroup.value
  if (!grp) return
  try {
    await ElMessageBox.confirm(
      `把当前分组「${grp.name}」的卡片库 / 对象映射表 / 值资源库导出为全局模板？\n这将覆盖全局库（其它分组不受影响）。`,
      '导出为全局模板',
      { confirmButtonText: '导出', cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    return
  }
  try {
    await saveGlobalLibrary({
      cards: JSON.parse(JSON.stringify(cardLibrary.value)),
      mapping: JSON.parse(JSON.stringify(mapping.value)),
      value_library: JSON.parse(JSON.stringify(valueLibrary.value)),
    })
    ElMessage.success('已导出为全局模板')
  } catch {
    /* 错误由拦截器处理 */
  }
}

watch(
  () => props.graph,
  (v) => {
    // 自己 emit 出去的对象原样回传时跳过：再深拷贝一次会替换 graph.value，
    // 让整个编辑器（含画布上百个节点）在每次按键/拖拽后整树重渲染。
    // 注意父级 graph 是 ref，取到的是响应式代理，必须 toRaw 后才能与原始对象比引用
    if (toRaw(v) === lastEmittedGraph) return
    graph.value = JSON.parse(JSON.stringify(toRaw(v)))
    ensureGroups()
  },
)
watch(
  () => props.mapping,
  (v) => {
    // 仅在外部值确与当前分组不同时应用，避免回写自身 emit 覆盖分组内容
    if (JSON.stringify(mapping.value) === JSON.stringify(v)) return
    mapping.value = JSON.parse(JSON.stringify(v))
  },
)
watch(selectedFrameId, (v) => { if (v) selectionKind.value = 'frame' })
watch(selectionCardId, (v) => { if (v) selectionKind.value = 'card' })

// 提供给 PanelBody 的共享上下文
// ===== 用例名默认值：拉取展开结果，按 frame_id + 行序取自动生成的 case_id =====
// 画布上「用例展开」每行的默认用例名就是后端生成的 case_id（如 ADS_Tq_1），
// 用户在画布上改过的名字存在 frame.caseNames 里，由后端优先使用。
/** frameId → 该工况各行用例的 case_id（行序与画布 caseRows 一致） */
const frameCaseIds = ref<Record<string, string[]>>({})
let caseIdsTimer: number | undefined
// 用例代码预览：整图展开的 TestCase.can 与「case_id → 该用例代码块」缓存（见下方 loadCaseCode）。
// 只用 id 的 expandCases 拿不到代码，所以预览这一次要 idsOnly=false（响应约 120KB）；
// 只在右击预览时拉一次并缓存，不在页面载入时拉，避免拖慢配置切换。
let caseCanCache: string | null = null
const caseCodeCache = ref<Record<string, string>>({})

/** 图变化后延迟拉取：拖拽/输入这类高频改动只发一次请求 */
function scheduleCaseIdRefresh() {
  if (caseIdsTimer) window.clearTimeout(caseIdsTimer)
  caseIdsTimer = window.setTimeout(refreshCaseIds, 500)
}

async function refreshCaseIds() {
  caseIdsTimer = undefined
  // 用例代码预览缓存的是「整图展开的 TestCase.can」，图变了就作废，下次预览重新拿最新的
  caseCanCache = null
  caseCodeCache.value = {}
  try {
    // idsOnly：画布只要「工况 → 各行 case_id」的对应关系。带上每条用例的 steps / CAPL 正文
    // 与整份 TestCase.can 时响应约 120KB（前端只用三个字段），只回 id 后降到几 KB。
    // 仍然按整图展开（而不是只展开当前工况）——用例编号与去重集合是跨工况累积的，
    // 只展开一个工况会让 naming=default 的配置重新编号，与「用例预览」和生成的 CAPL 用例名对不上。
    const res: any = await expandCases(
      graph.value,
      mapping.value,
      activeGroup.value?.cards,
      activeGroup.value?.valueLibrary,
      true,
      props.ccpVarTypes,
    )
    const data = res?.data?.data ?? res?.data ?? {}
    const cases = Array.isArray(data.cases) ? data.cases : []
    const map: Record<string, string[]> = {}
    for (const c of cases) {
      const fid = String(c?.frame_id || '')
      const row = Number(c?.frame_row)
      if (!fid || !Number.isInteger(row) || row < 0) continue
      if (!map[fid]) map[fid] = []
      map[fid][row] = String(c?.case_id || '')
    }
    frameCaseIds.value = map
  } catch {
    // 展开失败（后端未就绪等）保留上一次结果，画布回落到自定义名 /「用例N」
  }
}

// ===== 用例代码预览（缓存见上方 caseCanCache / caseCodeCache）=====
/** 取某条用例的 CAPL 代码（与「生成」同源：按当前图现场展开） */
async function loadCaseCode(caseId: string): Promise<string> {
  const hit = caseCodeCache.value[caseId]
  if (hit !== undefined) return hit
  if (caseCanCache === null) {
    const res: any = await expandCases(
      graph.value,
      mapping.value,
      activeGroup.value?.cards,
      activeGroup.value?.valueLibrary,
      false,
      props.ccpVarTypes,
    )
    const data = res?.data?.data ?? res?.data ?? {}
    caseCanCache = String(data.test_cases || '')
  }
  const code = extractCaseBlock(caseCanCache, caseId)
  caseCodeCache.value = { ...caseCodeCache.value, [caseId]: code }
  return code
}

provide('geCtx', {
  frames,
  selectedFrameId,
  activeFrameId,
  setActiveFrame,
  cardLibrary,
  valueLibrary,
  frameCaseIds,
  frameCaseRowsMap,
  loadCaseCode,
  selectedCardId,
  selectionCardId,
  selectionCardIds,
  isCardSelected,
  selectCardInList,
  focusLibraryCard,
  focusFrameItem,
  removeCardSelection,
  editorTarget,
  selectedCard,
  graph,
  mapping,
  stepSaveSignal,
  stepEditorHovered,
  selectFrame,
  removeFrame,
  addFrame,
  selectCard,
  selectCardById,
  onCardDragStart,
  onFrameDragStart,
  duplicateCard,
  duplicateCardTo,
  duplicateFrame,
  removeCard,
  createCard,
  saveCard,
  onAddMapping,
  onGraphChange,
  onMappingChange,
  onValueLibraryChange,
  hideObj: () => {
    panelStates.value.obj.visible = false
  },
})

// 编辑器级快捷键：注册到统一快捷键层（module 作用域；画布/步骤编辑器是更内层的 context，会优先）
function editorShortcuts() {
  useShortcut({
    id: 'graph:save',
    keys: 'Ctrl+S',
    scope: 'module',
    desc: '保存当前分组并保存配置',
    // 允许在输入框内触发（Ctrl+S 是全局保存语义）
    allowInInput: true,
    when: () => isModuleActive('/function'),
    run: () => {
      if (editorTarget.value === 'card' && stepEditorHovered.value) {
        // 卡片步骤编辑状态下把保存转交给 StepEditor
        stepSaveSignal.value++
      } else {
        // 保存当前分组内容并通知父级保存配置（不再写全局库）
        emitGroupUpdate()
        emit('save')
      }
      return true
    },
  })
  useShortcut({
    id: 'graph:copyEntity',
    keys: 'Ctrl+C',
    scope: 'module',
    desc: '复制选中的工况/库卡片',
    when: () => isModuleActive('/function') && editorTarget.value !== 'card',
    run: () => {
      copySelectedEntity()
      return true
    },
  })
  useShortcut({
    id: 'graph:pasteEntity',
    keys: 'Ctrl+V',
    scope: 'module',
    desc: '粘贴工况/库卡片',
    when: () => isModuleActive('/function') && editorTarget.value !== 'card',
    run: () => {
      pasteEntity()
      return true
    },
  })
}
editorShortcuts()

onMounted(async () => {
  // 先加载全局库模板，再把仍为空的旧分组内容补全（新建分组不受影响）
  await loadGlobal()
  ensureGroups()
  migrateLegacyGroups()
  // 打开配置时先升级旧格式接线口：序号格式与画布渲染的锚定 key 对不上，连线会一条都画不出来
  const portMigrated = migrateSeqPortKeys(graph.value)
  if (portMigrated > 0) {
    syncActiveGroupFrames()
    emitGraph()
    ElMessage.info(`已把 ${portMigrated} 个旧格式接线口升级为「锚定步骤」`)
  }
  // 打开配置时做一次无损迁移：副本形态的工况节点 → 卡片引用（可填「参数取值」）
  migrateCopyNodes(true)
  if (frames.value.length) selectFrame(frames.value[0].id)
  // 画布「用例展开」的默认用例名（后端生成的 case_id）
  scheduleCaseIdRefresh()
})
</script>

<style scoped>
.graph-editor {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: #f0f2f5;
  display: flex;
  flex-direction: column;
}
.ge-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  background: #fff;
  border-bottom: 1px solid #ebeef5;
  flex-shrink: 0;
}
.ge-title-group {
  display: flex;
  align-items: center;
  gap: 8px;
}
.ge-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}
.ge-actions {
  display: flex;
  gap: 6px;
}

.ge-groups {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: #fff;
  border-bottom: 1px solid #ebeef5;
  flex-shrink: 0;
  overflow-x: auto;
}
.ge-groups-label {
  font-size: 12px;
  font-weight: 600;
  color: #909399;
  flex-shrink: 0;
}
.ge-group-tag {
  cursor: pointer;
  flex-shrink: 0;
}
.ge-group-name {
  width: 200px;
  flex-shrink: 0;
}
.ge-groups-hint {
  font-size: 11px;
  color: #c0c4cc;
  flex-shrink: 0;
  margin-left: auto;
}

.ge-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}
.dock-strip {
  display: flex;
  flex-direction: row;
  gap: 6px;
  padding: 6px;
  overflow: hidden;
}
.dock-main {
  flex: 1;
  display: flex;
  flex-direction: row;
  gap: 6px;
  padding: 6px;
  min-height: 0;
}
.dock-side {
  width: 320px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow: hidden;
}
.dock-center {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow: hidden;
}

.ge-dock-overlay {
  position: fixed;
  z-index: 60;
  pointer-events: none;
}
.dock-zone {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  color: #909399;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(144, 147, 153, 0.4);
  border-radius: 6px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
  transition: background 0.12s, color 0.12s, border-color 0.12s;
}
.dock-zone.active {
  background: rgba(64, 158, 255, 0.18);
  color: var(--el-color-primary);
  border-color: var(--el-color-primary);
}
.dz-top { left: 28%; right: 28%; top: 8px; height: 16%; }
.dz-bottom { left: 28%; right: 28%; bottom: 8px; height: 16%; }
.dz-left { top: 26%; bottom: 26%; left: 8px; width: 12%; }
.dz-right { top: 26%; bottom: 26%; right: 8px; width: 12%; }
.dz-center { left: 32%; right: 32%; top: 32%; bottom: 32%; }
</style>

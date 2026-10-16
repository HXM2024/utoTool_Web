<template>
  <div class="graph-editor">
    <div class="ge-header">
      <div class="ge-title-group">
        <el-button text :icon="Back" title="返回（有未保存修改会先询问）" aria-label="返回" @click="requestClose" />
        <span class="ge-title">功能用例配置</span>
        <el-tag v-if="dirty" size="small" type="warning">未保存</el-tag>
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
        <el-button size="small" type="success" :icon="Promotion" :loading="!!generating" @click="emit('generate')">生成</el-button>
        <el-button size="small" :icon="FolderOpened" @click="outputDrawerVisible = true">
          生成结果<span v-if="generateResult?.conflicts?.length" class="ge-out-dot" title="有函数库与内置模板冲突">!</span>
        </el-button>
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
      <el-button size="small" text :icon="Plus" :loading="addingGroup" @click="addGroup">新建分组</el-button>
      <el-input
        v-if="activeGroup"
        ref="groupNameInputRef"
        v-model="activeGroupName"
        size="small"
        class="ge-group-name"
        placeholder="当前分组名（用例名前缀）"
        @change="onGroupNameChange"
      />
      <span class="ge-groups-hint">组内用例命名：分组名_1、分组名_2…（卡片库/映射表/值资源库均按分组隔离）</span>
      <el-button size="small" text :loading="importingTemplate" @click="importGlobalTemplate">导入全局模板</el-button>
      <el-button size="small" text :loading="exportingTemplate" @click="exportGlobalTemplate">导出为全局模板</el-button>
    </div>

    <div ref="dockBodyEl" class="ge-body" v-loading="globalLoading">
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

    <!-- 生成结果抽屉（#10/P1-5）：保留全屏编辑器，产物与冲突提示在编辑器内直接看，不必退出 -->
    <el-drawer
      v-model="outputDrawerVisible"
      title="生成结果"
      size="640px"
      :modal="false"
      append-to-body
      destroy-on-close
      class="ge-output-drawer"
    >
      <div v-if="generating" class="ge-out-empty">正在生成…</div>
      <div v-else-if="!generateResult" class="ge-out-empty">
        还没有生成结果。点顶部「生成」后，这里会显示产物与冲突提示，无需退出编辑器。
      </div>
      <template v-else>
        <div class="ge-out-head">
          <span class="ge-out-msg">{{ generateResult.message }}</span>
          <el-button size="small" text :icon="FolderOpened" @click="emit('open-output-dir')">打开目录</el-button>
        </div>
        <div class="ge-out-dir" :title="generateResult.dir">
          {{ generateResult.dir || '（未返回输出目录）' }}
        </div>
        <div v-if="generateResult.conflicts && generateResult.conflicts.length" class="ge-out-conflict">
          以下函数与内置模板同名同参、实现不同，本次生成已以内置模板为准：{{
            generateResult.conflicts.join('、')
          }}
        </div>
        <el-tabs v-model="outputTab" class="ge-out-tabs">
          <el-tab-pane label="TestCase" name="tc">
            <div class="ge-out-code-head">
              <el-button size="small" text :icon="DocumentCopy" @click="copyOutput(generateResult.testCases)">复制</el-button>
            </div>
            <pre class="ge-out-pre"><code>{{ generateResult.testCases || '（空）' }}</code></pre>
          </el-tab-pane>
          <el-tab-pane label="Function" name="fn">
            <div class="ge-out-code-head">
              <el-button size="small" text :icon="DocumentCopy" @click="copyOutput(generateResult.testFunction)">复制</el-button>
            </div>
            <pre class="ge-out-pre"><code>{{ generateResult.testFunction || '（空）' }}</code></pre>
          </el-tab-pane>
          <el-tab-pane label="ArrayFunc" name="af">
            <div class="ge-out-code-head">
              <el-button size="small" text :icon="DocumentCopy" @click="copyOutput(generateResult.arrayFuncTest)">复制</el-button>
            </div>
            <pre class="ge-out-pre"><code>{{ generateResult.arrayFuncTest || '（空）' }}</code></pre>
          </el-tab-pane>
        </el-tabs>
        <div class="ge-out-at">生成时间：{{ outGeneratedAt }}</div>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, provide, nextTick, toRaw } from 'vue'
import { Back, Check, Promotion, Files, Grid, Plus, FolderOpened, DocumentCopy } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { Card, CardLibrary, CardType, CardStep, CaseFrame, CaseGroup, Graph, InjectRole, MappingEntry, MappingKind, ObjectMapping, ValueResource } from '@/types/functionGraph'
import { emptyCardLibrary, emptyCaseGroup, emptyMapping, emptyValueLibrary, genId, EMPTY_CARDS, EMPTY_MAPPING, EMPTY_VALUES } from '@/types/functionGraph'
import { newCard, frameCaseRowsWithLookups, buildCardLookup, buildValueLookup, syncGraphRefs, syncCardRef, migrateRefCopyNodes, reanchorFrameSeqPorts, frameSequenceId, migrateSeqPortKeys, extractCaseBlock, injectGlobalIntoGroup, cloneFrameWithNewIds, checkExpandLimit, expandLimitMessage } from '@/utils/functionGraph'
import type { FrameCaseRow } from '@/utils/functionGraph'
import { getGlobalLibrary, expandCases, loadGlobalSections, saveGlobalCards, saveGlobalMapping, saveGlobalValueLibrary, parseFunctions, getBuiltinFunctions } from '@/api/function'
import DockPanel from './DockPanel.vue'
import DockLayout from './DockLayout.vue'
import type { LayoutNode } from './DockLayout.vue'
import PanelBody from './PanelBody.vue'
import { useShortcut, isModuleActive } from '@/composables/useShortcuts'
import { useModuleStore } from '@/stores/modules'

const props = defineProps<{
  graph: Graph
  mapping: ObjectMapping
  /** 配置级卡片库：仅用于旧配置迁移兜底（分组缺少 cards 时） */
  cards?: CardLibrary
  /** 配置级值资源库：仅用于旧配置迁移兜底（分组缺少 valueLibrary 时） */
  valueLibrary?: ValueResource[]
  /** 打开时定位到的用例分组 id */
  activeGroupId?: string
  /** 打开后定位到「产出该 case_id 的工况」（用例预览 → 图形配置 直达，P2-3） */
  focusCaseId?: string
  /** CCP 系统变量类型表（{符号名: int|float|int64}）：供用例代码预览与生成同源 */
  ccpVarTypes?: Record<string, string>
  /** DBC 环境变量名单：供用例代码预览兜底判定不带 EV_ 前缀的环境变量（与生成同源） */
  dbcEnvNames?: string[]
  /** 生成进行中（父级状态）：供编辑器内「生成结果」抽屉展示进度 */
  generating?: boolean
  /** 生成结果快照（父级生成成功后回传）：编辑器内抽屉展示产物，免退出全屏编辑器（#10/P1-5） */
  generateResult?: {
    dir: string
    testCases: string
    testFunction: string
    arrayFuncTest: string
    conflicts: string[]
    message: string
    at: number
  } | null
}>()
const emit = defineEmits<{
  (e: 'update:graph', graph: Graph): void
  (e: 'update:mapping', mapping: ObjectMapping): void
  (e: 'close'): void
  (e: 'save'): void
  (e: 'generate'): void
  /** 打开生成产物目录（由父级执行，编辑器不直接碰文件系统） */
  (e: 'open-output-dir'): void
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

/** 函数库里已有的函数名（含 CANoe 内置共用函数）：用于「调用了函数库里不存在的函数」告警 */
const knownFuncNames = ref<string[]>([])

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
// 列表多选（Ctrl 点击累加；Shift 点击 = 范围选择）；selectionCardId 始终为最后一个
const selectionCardIds = ref<string[]>([])
/** Shift 范围选择的锚点：上一次单击选中的卡片 id */
let listAnchorId = ''
function isCardSelected(id: string): boolean {
  return selectionCardIds.value.includes(id)
}
/**
 * 列表里点击卡片。
 * - 普通点击：只选中它；
 * - Ctrl/Cmd 点击：加选 / 减选；
 * - Shift 点击：选中「上一次点击的卡片 → 这次点击的卡片」之间（含两端）的全部卡片，
 *   顺序取列表的可见顺序（故障注入面板 = 注入组 + 恢复组）。
 * orderedIds 由面板传入（面板才知道自己的可见顺序）。
 */
function selectCardInList(card: Card, e?: MouseEvent, orderedIds?: string[]) {
  const shift = !!e && e.shiftKey
  const order = orderedIds && orderedIds.length ? orderedIds : [card.id]
  if (shift && listAnchorId) {
    const a = order.indexOf(listAnchorId)
    const b = order.indexOf(card.id)
    if (a >= 0 && b >= 0 && a !== b) {
      const [lo, hi] = a < b ? [a, b] : [b, a]
      selectionCardIds.value = order.slice(lo, hi + 1)
      selectionCardId.value = card.id
      return
    }
  }
  const multi = !!e && (e.ctrlKey || e.metaKey)
  if (multi) {
    const i = selectionCardIds.value.indexOf(card.id)
    if (i >= 0) selectionCardIds.value.splice(i, 1)
    else selectionCardIds.value.push(card.id)
  } else {
    selectionCardIds.value = [card.id]
  }
  listAnchorId = card.id
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
  listAnchorId = payload.cardId
}

/** 按名称在卡片库里找卡片（用于「独立副本」点击时的兜底定位） */
function findCardByName(name: string): Card | null {
  const key = String(name || '').trim()
  if (!key) return null
  for (const t of cardTabs) {
    const found = cardLibrary.value[t.value].find((c) => String(c.name || '').trim() === key)
    if (found) return found
  }
  return null
}
/**
 * 画布上点了「独立副本」卡片（无 refId，卡片库没有对应条目）：必须有反馈，
 * 否则点了卡片左侧列表毫无动静，看起来像点击失效。
 * - 按名称能匹配到库卡片 → 定位高亮它，并说明二者只是同名、未建立关联；
 * - 匹配不到 → 给出说明（同一张卡片反复点用 grouping 合并提示）。
 */
function onFocusNode(payload: { frameId: string; nodeId: string; name: string }) {
  if (!payload?.nodeId) return
  const name = String(payload.name || '').trim()
  const hit = name ? findCardByName(name) : null
  if (hit) {
    focusLibraryCard({ cardId: hit.id, type: hit.type })
    ElMessage({ message: `「${name}」是独立副本（未与卡片库条目关联），已定位到同名库卡片`, type: 'info', grouping: true })
    return
  }
  ElMessage({ message: `「${name || '未命名'}」是独立副本，卡片库中没有对应条目`, type: 'info', grouping: true })
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
// 保存配置时递增：通知画布清空撤销栈（#22 撤销边界）
const canvasSaveSignal = ref(0)
// 新建卡片后置真：通知 StepEditor 聚焦卡片名并全选（P0-6）；StepEditor 消费后回告复位
const cardNameFocusPending = ref(false)

// ===== 生成结果抽屉（#10/P1-5）：编辑器保持全屏，产物在编辑器内直接看 =====
const outputDrawerVisible = ref(false)
const outputTab = ref<'tc' | 'fn' | 'af'>('tc')
const outGeneratedAt = computed(() =>
  props.generateResult?.at ? new Date(props.generateResult.at).toLocaleString() : '',
)
/** 生成成功后自动展开抽屉，省掉「退出编辑器 → 找产物」两步 */
watch(
  () => props.generateResult?.at,
  (at) => {
    if (at) outputDrawerVisible.value = true
  },
)
async function copyOutput(text: string) {
  const s = String(text || '')
  if (!s) {
    ElMessage.warning('没有可复制的内容')
    return
  }
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(s)
    } else {
      const ta = document.createElement('textarea')
      ta.value = s
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    ElMessage.success('已复制')
  } catch {
    ElMessage.warning('复制失败，请手动选择文本')
  }
}
// 焦点是否在步骤编辑框（StepEditor）内，用于 Ctrl+S 判断保存目标。
// 用「焦点」而不是「鼠标悬停」：悬停会让 Ctrl+S 的语义随鼠标位置漂移，无法预期。
const stepEditorFocused = ref(false)

// 异步操作的进行中标志（新建分组 / 导入·导出全局模板 / 加载全局库）：
// 这几个动作会联网，原来没有任何进行中反馈，慢网下点完像没反应。
const addingGroup = ref(false)
const importingTemplate = ref(false)
const exportingTemplate = ref(false)
const globalLoading = ref(false)

/**
 * 「未保存」标识：以「有内容改动」为判据。
 * 刻意不逐次序列化整图比对 —— 拖拽时每次改动都 JSON.stringify 上百个节点会明显掉帧。
 * 内容回写（emitGraph / onGraphChange）时置位；保存成功 / 载入完成 / 外部整体替换时清零。
 */
const dirty = ref(false)
/** 为 true 时 emitGraph 不改动 dirty（用于切换分组这类纯导航回写） */
let suppressDirty = false

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
  // 内容回写即视为「有未保存改动」（切换分组等纯导航场景由 suppressDirty 抑制）
  if (!suppressDirty) dirty.value = true
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
  // 切换分组只是「换个分组看」：这次整图回写不代表用户改了内容，不要置「未保存」
  suppressDirty = true
  emitGraph()
  suppressDirty = false
  // 全局项内容同步的基线按分组绑定：换分组后重建，避免拿上一个分组的快照去 diff
  resetGlobalBaseline()
  scheduleCaseIdRefresh()
  nextTick(() => {
    if (frames.value.length) selectFrame(frames.value[0].id)
  })
}
/** 在编辑器内新建分组并切过去（内容默认空白，全局项自动带出） */
async function addGroup() {
  syncActiveGroupFrames()
  const g = graph.value
  if (!Array.isArray(g.groups)) g.groups = []
  const grp = emptyCaseGroup(`GraphCase${g.groups.length + 1}`)
  // 会联网（读全局库带出全局项）：按钮进入 loading，慢网下不再「点完没反应」
  addingGroup.value = true
  try {
    const n = await applyGlobalToGroup(grp)
    g.groups.push(grp)
    activeGroupId.value = grp.id
    g.frames = grp.frames
    selectedFrameId.value = ''
    emitGraph()
    ElMessage.success(n ? `已新建分组 ${grp.name}（已带出 ${n} 项全局内容）` : `已新建分组 ${grp.name}（内容为空）`)
    // 全局项内容同步的基线按分组绑定：切到新分组后重建
    resetGlobalBaseline()
    // 新建后自动聚焦「当前分组名」并全选，便于直接改名（默认名是 GraphCaseN）
    focusGroupNameInput()
  } finally {
    addingGroup.value = false
  }
}
/** 聚焦「当前分组名」输入框并全选（新建分组后调用） */
const groupNameInputRef = ref<any>(null)
function focusGroupNameInput() {
  nextTick(() => {
    const inst = groupNameInputRef.value
    const input = inst?.input || inst?.$el?.querySelector?.('input')
    if (input && typeof input.focus === 'function') {
      input.focus()
      input.select?.()
    }
  })
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
  // 副本不继承「全局卡片」：副本不在全局库里，继承标记会显示成全局却带不进新配置
  c.global = undefined
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
  // 复制必须重生成 node/lane/edge id：只换 frame.id 会让两个工况共用 nodeId，
  // 画布上按 id 的查找/删除会误命中另一个工况（与画布自带的「复制工况」保持一致）
  const f: CaseFrame = cloneFrameWithNewIds(frame)
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
  // P0-6：进入编辑后自动聚焦卡片名并全选
  cardNameFocusPending.value = true
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
  if (card.global) {
    // 带「全局」标记的卡片：内容改动要外传（覆盖其它分组的同 id 副本 + 写回全局库）
    void publishGlobalCard(card)
      .then((touched) => {
        ElMessage.success(`卡片已保存${touched ? `（已同步 ${touched} 处全局副本）` : ''}`)
      })
      .catch((e: any) => {
        ElMessage.warning(`卡片已保存，但写回全局库失败：${e?.message || String(e)}`)
      })
    return
  }
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
      // 全局卡片：其它分组里那份副本与全局库里的条目一并删除
      if (card.global) {
        void publishGlobalCardRemoved([card]).catch((e: any) => {
          ElMessage.warning(`已删除卡片，但从全局库移除失败：${e?.message || String(e)}`)
        })
      }
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
  const removedCards = [...ids].map((id) => findCardById(id)).filter((c): c is Card => !!c)
  const names = removedCards
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
      if (removedCards.some((c) => c.global)) {
        void publishGlobalCardRemoved(removedCards).catch((e: any) => {
          ElMessage.warning(`已删除卡片，但从全局库移除失败：${e?.message || String(e)}`)
        })
      }
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
  const target = frames.value.find((f) => f.id === id)
  if (!target) return
  const label = target.name || '未命名'
  // 原来直接删除且无任何提示：误点在列表 ✕ 上会静默丢工况
  ElMessageBox.confirm(`确认删除工况「${label}」？删除后可按 Ctrl+Z 撤销。`, '删除工况', {
    type: 'warning',
    confirmButtonText: '删除',
    cancelButtonText: '取消',
  })
    .then(() => {
      const next: Graph = { ...graph.value, frames: frames.value.filter((f) => f.id !== id) }
      onGraphChange(next)
      if (selectedFrameId.value === id) selectedFrameId.value = ''
      ElMessage.success(`已删除工况「${label}」`)
    })
    .catch(() => {
      /* 用户取消 */
    })
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
  // 副本不继承「全局卡片」：副本自己并不在全局库里，否则会显示成全局却带不进新配置
  c.global = undefined
  c.steps = (c.steps || []).map((s: CardStep) => ({ ...s, id: genId('step') }))
  return c
}
function cloneFrame(frame: CaseFrame): CaseFrame {
  const f: CaseFrame = cloneFrameWithNewIds(frame)
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
    // 右栏（映射表/值资源库/函数库/对象浏览器）宽度减半：3.4 → 1.7，让出的宽度给中栏编辑区
    ratios: [1.9, 6.1, 1.7],
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
      // 右栏：对象映射表 / 值资源库 / 函数库 / 对象浏览器 同格切换。
      // 对象浏览器仅在加载了对象（DBC/DTC/A2L）时可见，可见时会自动高亮该页签（见下方 watch）。
      // collapsible：在「编辑 ↔ 右栏」的分隔条上显示收起/展开控件。
      {
        id: newNodeId(),
        kind: 'tab',
        tabs: ['mapping', 'value', 'func', 'obj'],
        active: 'mapping',
        collapsible: true,
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

// 对象浏览器与映射表/值资源库/函数库同格：
// 1) 只有真正加载了对象（DBC/DTC/A2L）时才让该页签出现（它不再常驻渲染，无法靠自身折叠来隐藏）
// 2) 一旦可见就自动高亮该页签
// 3) 用户手动开关后 60s 内不再自动覆盖（见 toggleObjDrawer 与下方 watcher）
const OBJ_MANUAL_HOLD_MS = 60_000
let userObjOverrideUntil = 0
const objStore = useModuleStore()
const objHasData = computed(() => {
  const raw = (v: any) => !!(v && ((Array.isArray(v) && v.length > 0) || (v.rows && v.rows.length > 0)))
  const a2l: any = objStore.objA2lVars
  return (
    raw(objStore.objMergedDbcRaw) ||
    raw(objStore.objDtcRaw) ||
    !!(a2l && ((a2l.measurements?.length ?? 0) > 0 || (a2l.characteristics?.length ?? 0) > 0))
  )
})
watch(
  objHasData,
  (has) => {
    // 用户刚手动开关过（60s 内），不自动覆盖其选择（P1-6）
    if (Date.now() < userObjOverrideUntil) return
    panelStates.value.obj.visible = has
  },
  { immediate: true },
)
watch(
  () => panelStates.value.obj.visible,
  (visible) => {
    if (visible) activateTab('obj')
  },
  // immediate：打开编辑器时对象已加载（objHasData 初始为真）也要立刻高亮该页签
  { immediate: true },
)

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
  // 手动开关后短暂锁定该面板的显隐，避免被对象数据加载/清空自动覆盖（P1-6）
  userObjOverrideUntil = Date.now() + OBJ_MANUAL_HOLD_MS
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
  // 保存以父级为准（失败会由父级提示）；这里先清掉「未保存」标记
  dirty.value = false
  // #22：保存后清空画布撤销栈（撤销不应回退到已保存状态之前）
  canvasSaveSignal.value++
}
/**
 * 返回守卫：有未保存修改时先问「保存并返回 / 不保存」。
 * 原来直接关闭，改动会静默丢失（编辑器是全屏浮层，关掉就找不回来了）。
 */
async function requestClose() {
  if (!dirty.value) {
    emit('close')
    return
  }
  try {
    await ElMessageBox.confirm('当前分组有未保存的修改，是否保存后返回？', '未保存的修改', {
      confirmButtonText: '保存并返回',
      cancelButtonText: '不保存',
      // 区分「取消按钮」与「右上角关闭/ESC」：前者=不保存直接返回，后者=留在编辑器
      distinguishCancelAndClose: true,
      type: 'warning',
    })
  } catch (action) {
    if (action === 'cancel') emit('close')
    return
  }
  onSaveClick()
  emit('close')
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
  // 画布上的改动（拖拽/增删/连线）同样算「未保存」
  dirty.value = true
  scheduleCaseIdRefresh()
}
function onMappingChange(m: ObjectMapping) {
  // 只写入当前分组；带 global 标记的项由 publishGlobalItems 另行发布（基线缺失时只重建基线）
  mapping.value = m
  emit('update:mapping', JSON.parse(JSON.stringify(m)))
  emitGroupUpdate()
  void publishGlobalItems('mapping').catch((e: any) => {
    ElMessage.warning(`全局映射写回失败：${e?.message || String(e)}`)
  })
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
  // 同步会整块覆盖引用节点的步骤：先记下各节点的旧步骤，供被删步骤上的连线就近改锚。
  // 键用「工况 id + 节点 id」：历史数据里存在不同工况复用同一 node id 的情况（复制分组的残留），
  // 只按 node id 建键会互相覆盖，后一个工况会拿到别人的旧步骤。
  const portKeyOf = (frameId: string, nodeId: string) => `${frameId}|${nodeId}`
  const oldStepsByNode = new Map<string, CardStep[]>()
  for (const f of graph.value.frames || []) {
    for (const [nid, n] of Object.entries(f.nodes || {})) {
      if (n.refId) oldStepsByNode.set(portKeyOf(f.id, nid), [...(n.steps ?? [])])
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
      portFixed += reanchorFrameSeqPorts(f, oldStepsByNode.get(portKeyOf(f.id, sid)) ?? [])
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
  void publishGlobalItems('values').catch((e: any) => {
    ElMessage.warning(`全局值资源写回失败：${e?.message || String(e)}`)
  })
}

// ===== 全局化：卡片 / 映射表对象 / 值资源（列表里右键「设为全局 / 取消全局」） =====
/** 新建分组/新建配置：把全局库里标记为全局的项带进新分组；读全局库失败不阻断建组 */
async function applyGlobalToGroup(grp: CaseGroup): Promise<number> {
  try {
    const g = await loadGlobalSections()
    return injectGlobalIntoGroup(grp, g)
  } catch (e: any) {
    // 读全局库失败 ≠ 内容为空：明确区分，避免把失败误读成「这个分组本来就是空的」
    ElMessage.warning(`读取全局库失败，新分组未带出全局内容：${e?.message || String(e)}`)
    return 0
  }
}
/** 提示文案里的对象名摘要：单个显示名字，多个显示「N 个（前两个…）」 */
function globalLabel(names: string[], unit: string): string {
  const list = names.map((n) => n || '未命名')
  if (list.length <= 1) return `「${list[0] ?? ''}」`
  return `${list.length} 个${unit}（${list.slice(0, 2).join('、')}${list.length > 2 ? '…' : ''}）`
}
/**
 * 把「刚改了全局标记」的项同步进**所有分组**。
 *
 * 语义（2026-10-10 定调）：
 * - 设为全局（on=true）→ 该项进入所有分组的卡片列表 / 对象映射表 / 值资源库；缺失的补一份带 `global` 标记的深拷贝
 * - 取消全局（on=false）→ **不回收**：其它分组里已同步过去的副本内容原样保留（避免删掉别人在各自分组里改过的副本），
 *   只把副本上过期的 `global` 标记清掉 —— 保证「有全局徽标 ⟺ 该项确实在全局库里」
 *
 * 当前分组本来就有这些项（标记就是在它上面改的），直接跳过。返回受影响的其它分组条目数。
 */
function syncGlobalToAllGroups(
  payload: { cards?: Card[]; mapping?: MappingEntry[]; values?: ValueResource[] },
  on: boolean,
): number {
  const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T
  const mappingKeyOf = mappingIdentity
  let n = 0
  for (const grp of groupsList.value) {
    if (!grp || grp.id === activeGroupId.value) continue
    // 卡片：按 id 认为同一条（全局卡片在各分组里是同 id 的副本）
    for (const c of payload.cards || []) {
      const hit = grp.cards?.[c.type]?.find((x) => x.id === c.id)
      if (hit) {
        // 副本已在 → 标记以「是否在全局库里」为准，两个方向都对齐（其它字段一律不动）
        if (on ? !hit.global : hit.global) {
          hit.global = on ? true : undefined
          n++
        }
        continue
      }
      if (!on) continue
      grp.cards = grp.cards || emptyCardLibrary()
      const bucket = grp.cards[c.type] || (grp.cards[c.type] = [])
      bucket.push(clone({ ...c, global: true }))
      n++
    }
    // 对象映射：同 kind + alias + name 视为同一条
    for (const e of payload.mapping || []) {
      const hit = grp.mapping?.[bucketOfMapping(e.kind)]?.find((x) => mappingKeyOf(x) === mappingKeyOf(e))
      if (hit) {
        // 副本已在 → 标记以「是否在全局库里」为准，两个方向都对齐（其它字段一律不动）
        if (on ? !hit.global : hit.global) {
          hit.global = on ? true : undefined
          n++
        }
        continue
      }
      if (!on) continue
      grp.mapping = grp.mapping || emptyMapping()
      const bucket = grp.mapping[bucketOfMapping(e.kind)] || (grp.mapping[bucketOfMapping(e.kind)] = [])
      bucket.push(clone({ ...e, global: true }))
      n++
    }
    // 值资源：按 name 视为同一条
    for (const v of payload.values || []) {
      const hit = grp.valueLibrary?.find((x) => x.name === v.name)
      if (hit) {
        // 副本已在 → 标记以「是否在全局库里」为准，两个方向都对齐（其它字段一律不动）
        if (on ? !hit.global : hit.global) {
          hit.global = on ? true : undefined
          n++
        }
        continue
      }
      if (!on) continue
      grp.valueLibrary = grp.valueLibrary || []
      grp.valueLibrary.push(clone({ ...v, global: true }))
      n++
    }
  }
  return n
}

// ===== 全局项的「内容」同步：编辑 / 删除时写回全局库并广播给其它分组 =====
/**
 * 背景：卡片库 / 映射表 / 值资源库都是**分组级深拷贝**，上面的 syncGlobalToAllGroups
 * 只在「设为全局 / 取消全局」那一刻同步过标记，之后在任何分组里改内容都不会外传，
 * 连全局库那份 master 也不更新（新建分组 / 新建配置带出的还是旧内容）。这里补上这条通道。
 */
/**
 * 同一条映射的判定：`kind + alias`（**不含 name**）。
 * 映射没有稳定 id，name 是可以改的字段；若把 name 也纳入键，改一次对象名就会被当成
 * 「旧的删掉 + 新的新增」，既同步不过去、又会在各处留下同别名的重复条目
 * （生成时映射表按 alias 查找，后者覆盖前者 —— 结果取决于数组顺序）。
 */
const mappingIdentity = (e: MappingEntry) => `${e.kind}|${e.alias}`
/** 同一条值资源的判定：值资源有稳定 id，改名也能识别；老数据缺 id 时回落到 name */
const valueIdentity = (v: ValueResource) => String(v.id || v.name || '')
const cardIdentity = (c: Card) => `${c.type}|${c.id}`
/** 指纹：比较时把 global 标记视作恒为 true，避免「标记本身」被当成内容变化 */
const globalFingerprint = (v: unknown) => JSON.stringify({ ...(v as object), global: true })
const MAPPING_BUCKETS = ['signals', 'dtcs', 'messages', 'envvars', 'a2l'] as const
const CARD_BUCKETS: CardType[] = ['inject', 'sequence', 'result']

/**
 * 当前分组里「带 global 标记」的项快照（键 → 深拷贝对象），按分组 id 绑定。
 * 映射表 / 值资源库是以「整表替换」形式提交的，且字段编辑会就地改对象，
 * 只有留下上一版快照才能 diff 出「哪一条全局项被改了 / 被删了」。
 * 分组切换后旧快照立即失效（只重建基线、不发布），避免拿 A 组的表去 diff B 组。
 */
let globalBaseline: {
  groupId: string
  cards: Map<string, Card>
  mapping: Map<string, MappingEntry>
  values: Map<string, ValueResource>
} | null = null
function resetGlobalBaseline() {
  const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T
  const cards = new Map<string, Card>()
  for (const b of CARD_BUCKETS) for (const c of cardLibrary.value[b] || []) if (c.global) cards.set(cardIdentity(c), clone(c))
  const mappingMap = new Map<string, MappingEntry>()
  for (const b of MAPPING_BUCKETS) for (const e of mapping.value[b] || []) if (e.global) mappingMap.set(mappingIdentity(e), clone(e))
  const values = new Map<string, ValueResource>()
  for (const v of valueLibrary.value || []) if (v.global) values.set(valueIdentity(v), clone(v))
  globalBaseline = { groupId: activeGroupId.value, cards, mapping: mappingMap, values }
}

/**
 * 把全局项的**内容**覆盖到其它分组的同一条上（缺失的不补：补缺失是「设为全局」的职责）。
 *
 * 命中即"整条替换"，而不是只替换第一条：历史漂移会让同一个别名在某个分组里残留**多条**
 * （例如 `x57_Checksum_057_S` 同时指向 `x57_…` 和 `EV_x57_…`），只替换首条会留下脏数据；
 * 生成时映射表按 alias 查找是"后者覆盖前者"，结果取决于数组顺序 —— 必须收敛成一条。
 * 返回被更新的分组条目数（每个分组命中一次算一处）。
 */
function broadcastGlobalContent(payload: {
  cards?: Card[]
  mapping?: MappingEntry[]
  values?: ValueResource[]
}): number {
  const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T
  /** 命中则返回"去掉所有同 key 条目后的列表"，未命中返回 null（不改动） */
  const strip = <T>(list: T[] | undefined, keyOf: (x: T) => string, key: string): T[] | null => {
    if (!list) return null
    const kept = list.filter((x) => keyOf(x) !== key)
    return kept.length === list.length ? null : kept
  }
  let n = 0
  for (const grp of groupsList.value) {
    if (!grp || grp.id === activeGroupId.value) continue
    for (const c of payload.cards || []) {
      const bucket = grp.cards?.[c.type]
      const kept = strip(bucket, cardIdentity, cardIdentity(c))
      if (bucket && kept) {
        kept.push(clone({ ...c, global: true }))
        bucket.splice(0, bucket.length, ...kept)
        n++
      }
      // 工况里已放置的卡片实例（refId 指向这张卡片）也要按同一套规则刷新内容：
      // 只更新卡片列表会出现「列表里是新内容、画布里已放的副本还是旧的」。
      // 活动分组在外层已跳过，它的工况由 syncRefsFromLibrary 负责。
      for (const f of grp.frames || []) {
        const nodes = f.nodes || {}
        for (const [nid, node] of Object.entries(nodes)) {
          if (!node || node.refId !== c.id) continue
          const next = syncCardRef(node, c)
          if (next !== node) {
            nodes[nid] = next
            n++
          }
        }
      }
    }
    for (const e of payload.mapping || []) {
      const b = bucketOfMapping(e.kind)
      const bucket = grp.mapping?.[b]
      const kept = strip(bucket, mappingIdentity, mappingIdentity(e))
      if (bucket && kept) {
        kept.push(clone({ ...e, global: true }))
        bucket.splice(0, bucket.length, ...kept)
        n++
      }
    }
    for (const v of payload.values || []) {
      const bucket = grp.valueLibrary
      const kept = strip(bucket, valueIdentity, valueIdentity(v))
      if (bucket && kept) {
        kept.push(clone({ ...v, global: true }))
        bucket.splice(0, bucket.length, ...kept)
        n++
      }
    }
  }
  return n
}

/** 把全局项从其它分组移除（当前分组由调用方自己删；同 key 的多条一并移除） */
function removeGlobalFromGroups(payload: {
  cards?: Card[]
  mapping?: MappingEntry[]
  values?: ValueResource[]
}): number {
  /** 命中则返回"去掉全部同 key 条目后的列表"，未命中返回 null */
  const strip = <T>(list: T[] | undefined, keyOf: (x: T) => string, key: string): T[] | null => {
    if (!list) return null
    const kept = list.filter((x) => keyOf(x) !== key)
    return kept.length === list.length ? null : kept
  }
  let n = 0
  for (const grp of groupsList.value) {
    if (!grp || grp.id === activeGroupId.value) continue
    for (const c of payload.cards || []) {
      const bucket = grp.cards?.[c.type]
      const kept = strip(bucket, cardIdentity, cardIdentity(c))
      if (bucket && kept) {
        bucket.splice(0, bucket.length, ...kept)
        n++
      }
    }
    for (const e of payload.mapping || []) {
      const bucket = grp.mapping?.[bucketOfMapping(e.kind)]
      const kept = strip(bucket, mappingIdentity, mappingIdentity(e))
      if (bucket && kept) {
        bucket.splice(0, bucket.length, ...kept)
        n++
      }
    }
    for (const v of payload.values || []) {
      const bucket = grp.valueLibrary
      const kept = strip(bucket, valueIdentity, valueIdentity(v))
      if (bucket && kept) {
        bucket.splice(0, bucket.length, ...kept)
        n++
      }
    }
  }
  return n
}

/**
 * 把全局项的增 / 删 / 改写回全局库对应段（按段合并：只发有变化的段，不动其它段）。
 * 失败由调用方兜住：本地编辑结果不受影响，只提示写回失败。
 */
async function persistGlobalChange(payload: {
  upsert?: { cards?: Card[]; mapping?: MappingEntry[]; values?: ValueResource[] }
  remove?: { cards?: Card[]; mapping?: MappingEntry[]; values?: ValueResource[] }
}): Promise<void> {
  const up = payload.upsert ?? {}
  const rm = payload.remove ?? {}
  const touched = [up.cards, rm.cards, up.mapping, rm.mapping, up.values, rm.values].some((l) => !!l?.length)
  if (!touched) return
  const g = await loadGlobalSections()

  if (up.cards?.length || rm.cards?.length) {
    const rmIds = new Set((rm.cards ?? []).map((c) => c.id))
    for (const b of CARD_BUCKETS) {
      let list = g.cards[b] || []
      if (rmIds.size) list = list.filter((c) => !rmIds.has(c.id))
      for (const c of (up.cards ?? []).filter((x) => x.type === b)) {
        const i = list.findIndex((x) => x.id === c.id)
        const item = JSON.parse(JSON.stringify({ ...c, global: true })) as Card
        if (i >= 0) list[i] = item
        else list.push(item)
      }
      g.cards[b] = list
    }
    await saveGlobalCards(g.cards)
  }
  if (up.mapping?.length || rm.mapping?.length) {
    const rmKeys = new Set((rm.mapping ?? []).map(mappingIdentity))
    for (const b of MAPPING_BUCKETS) {
      let list = g.mapping[b] || []
      if (rmKeys.size) list = list.filter((x) => !rmKeys.has(mappingIdentity(x)))
      for (const e of (up.mapping ?? []).filter((x) => bucketOfMapping(x.kind) === b)) {
        const i = list.findIndex((x) => mappingIdentity(x) === mappingIdentity(e))
        const item = JSON.parse(JSON.stringify({ ...e, global: true })) as MappingEntry
        if (i >= 0) list[i] = item
        else list.push(item)
      }
      g.mapping[b] = list
    }
    await saveGlobalMapping(g.mapping)
  }
  if (up.values?.length || rm.values?.length) {
    const rmKeys = new Set((rm.values ?? []).map(valueIdentity))
    const list = (g.valueLibrary || []).filter((x) => !rmKeys.has(valueIdentity(x)))
    for (const v of up.values ?? []) {
      const i = list.findIndex((x) => valueIdentity(x) === valueIdentity(v))
      const item = JSON.parse(JSON.stringify({ ...v, global: true })) as ValueResource
      if (i >= 0) list[i] = item
      else list.push(item)
    }
    await saveGlobalValueLibrary(list)
  }
}

/**
 * 映射表 / 值资源库编辑后的发布：与基线对比，把带 global 标记的项分三类处理 ——
 * 新增 / 内容变了 → 覆盖其它分组的副本并写回全局库；本地已删 → 从两边一并移除。
 * 基线缺失或属于别的分组 → 只重建基线、不发布（宁可漏同步一次，也不拿别的分组去误删）。
 * 返回受影响的其它分组条目数。
 */
async function publishGlobalItems(which: 'mapping' | 'values'): Promise<number> {
  if (!globalBaseline || globalBaseline.groupId !== activeGroupId.value) {
    resetGlobalBaseline()
    return 0
  }
  const base = globalBaseline[which]
  const cur = new Map<string, MappingEntry | ValueResource>()
  if (which === 'mapping') {
    for (const b of MAPPING_BUCKETS) for (const e of mapping.value[b] || []) if (e.global) cur.set(mappingIdentity(e), e)
  } else {
    for (const v of valueLibrary.value || []) if (v.global) cur.set(valueIdentity(v), v)
  }
  const upsert: (MappingEntry | ValueResource)[] = []
  for (const [k, item] of cur) {
    const old = base.get(k)
    if (!old || globalFingerprint(old) !== globalFingerprint(item)) upsert.push(item)
  }
  const removed: (MappingEntry | ValueResource)[] = []
  for (const [k, old] of base) if (!cur.has(k)) removed.push(old)
  // 先把基线推进到当前状态：写回失败也不该让下一次编辑重复发布同一批
  const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T
  const nextMap = new Map<string, any>()
  for (const [k, item] of cur) nextMap.set(k, clone(item))
  ;(globalBaseline as any)[which] = nextMap
  if (!upsert.length && !removed.length) return 0

  // 先广播给其它分组（纯内存），再写回全局库：写回失败也不影响本地一致性
  const n =
    which === 'mapping'
      ? broadcastGlobalContent({ mapping: upsert as MappingEntry[] }) +
        removeGlobalFromGroups({ mapping: removed as MappingEntry[] })
      : broadcastGlobalContent({ values: upsert as ValueResource[] }) +
        removeGlobalFromGroups({ values: removed as ValueResource[] })
  if (n) emitGroupUpdate()
  await persistGlobalChange(
    which === 'mapping'
      ? { upsert: { mapping: upsert as MappingEntry[] }, remove: { mapping: removed as MappingEntry[] } }
      : { upsert: { values: upsert as ValueResource[] }, remove: { values: removed as ValueResource[] } },
  )
  return n
}

/** 卡片内容变动的发布（单条精确事件：saveCard 传出的是刚保存的那张卡片） */
async function publishGlobalCard(card: Card): Promise<number> {
  if (!card.global) return 0
  const touched = broadcastGlobalContent({ cards: [card] })
  await persistGlobalChange({ upsert: { cards: [card] } })
  if (globalBaseline?.groupId === activeGroupId.value) {
    globalBaseline.cards.set(cardIdentity(card), JSON.parse(JSON.stringify(card)) as Card)
  }
  if (touched) emitGroupUpdate()
  return touched
}

/** 卡片删除的发布：同时从全局库与其它分组移除（仅对带 global 标记的卡片） */
async function publishGlobalCardRemoved(cards: Card[]): Promise<number> {
  const globals = cards.filter((c) => c.global)
  if (!globals.length) return 0
  const touched = removeGlobalFromGroups({ cards: globals })
  for (const c of globals) globalBaseline?.cards.delete(cardIdentity(c))
  await persistGlobalChange({ remove: { cards: globals } })
  if (touched) emitGroupUpdate()
  return touched
}

/** 设为 / 取消全局卡片（支持多选批量）：同步全局库 cards 段 + 本地标记（同步失败回滚标记） */
async function setCardsGlobal(cards: Card[], on: boolean) {
  // on=true（设为全局 / 重新发布）时不过滤已带 global 标记的项：
  // 「重新发布」要的就是"以当前分组这一份为准"覆盖所有分组，把已标记的过滤掉会让它变成空操作。
  const list = on ? cards.slice() : cards.filter((c) => c.global)
  if (!list.length) return
  list.forEach((c) => {
    c.global = on
  })
  emitGroupUpdate()
  try {
    const g = await loadGlobalSections()
    const ids = new Set(list.map((c) => c.id))
    const buckets: CardType[] = ['inject', 'sequence', 'result']
    for (const b of buckets) {
      const remain = (g.cards[b] || []).filter((c) => !ids.has(c.id))
      if (on) {
        remain.push(
          ...list
            .filter((c) => c.type === b)
            .map((c) => JSON.parse(JSON.stringify({ ...c, global: true })) as Card),
        )
      }
      g.cards[b] = remain
    }
    await saveGlobalCards(g.cards)
    // on=true：先以当前分组这一份**覆盖**其它分组的同名副本（内容），再补缺失项；
    // 取消全局不回收副本，只清掉副本上的过期标记
    const touched =
      (on ? broadcastGlobalContent({ cards: list }) : 0) + syncGlobalToAllGroups({ cards: list }, on)
    if (touched) emitGroupUpdate()
    ElMessage.success(
      on
        ? `已设为全局卡片：${globalLabel(list.map((c) => c.name), '卡片')}${touched ? `（已同步 ${touched} 处其它分组副本，保存后生效）` : ''}`
        : `已取消全局：${globalLabel(list.map((c) => c.name), '卡片')}${touched ? `（其它分组的 ${touched} 处副本已保留，仅清除全局标记）` : ''}`,
    )
  } catch (e: any) {
    list.forEach((c) => {
      c.global = !on
    })
    emitGroupUpdate()
    ElMessage.warning(`全局库同步失败：${e?.message || String(e)}`)
  }
  // 全局标记变了 → 内容同步的基线要跟着重建（否则下一次编辑会把「刚取消全局」误判成删除）
  resetGlobalBaseline()
}
/** 设为 / 取消全局映射对象（支持多选批量；同 kind + alias 视为同一条） */
async function setMappingsGlobal(entries: MappingEntry[], on: boolean) {
  // on=true 时不过滤已带标记的项：支持「重新发布」（以当前分组这一份覆盖所有分组）
  const list = on ? entries.slice() : entries.filter((e) => e.global)
  if (!list.length) return
  const keyOf = mappingIdentity
  list.forEach((e) => {
    e.global = on
  })
  emitGroupUpdate()
  try {
    const g = await loadGlobalSections()
    const keys = new Set(list.map(keyOf))
    const buckets = ['signals', 'dtcs', 'messages', 'envvars', 'a2l'] as const
    for (const b of buckets) {
      const remain = (g.mapping[b] || []).filter((x) => !keys.has(keyOf(x)))
      if (on) {
        remain.push(
          ...list
            .filter((e) => bucketOfMapping(e.kind) === b)
            .map((e) => JSON.parse(JSON.stringify({ ...e, global: true })) as MappingEntry),
        )
      }
      g.mapping[b] = remain
    }
    await saveGlobalMapping(g.mapping)
    // on=true：先以当前分组这一份覆盖其它分组的同别名条目（内容 + 对象名），再补缺失项
    const touched =
      (on ? broadcastGlobalContent({ mapping: list }) : 0) + syncGlobalToAllGroups({ mapping: list }, on)
    if (touched) emitGroupUpdate()
    const names = list.map((e) => e.alias || e.name)
    ElMessage.success(
      on
        ? `已设为全局：${globalLabel(names, '映射')}${touched ? `（已同步 ${touched} 处其它分组副本，保存后生效）` : ''}`
        : `已取消全局：${globalLabel(names, '映射')}${touched ? `（其它分组的 ${touched} 处副本已保留，仅清除全局标记）` : ''}`,
    )
  } catch (e: any) {
    list.forEach((e) => {
      e.global = !on
    })
    emitGroupUpdate()
    ElMessage.warning(`全局库同步失败：${e?.message || String(e)}`)
  }
  // 全局标记变了 → 内容同步的基线要跟着重建（否则下一次编辑会把「刚取消全局」误判成删除）
  resetGlobalBaseline()
}
/** 设为 / 取消全局值资源（支持多选批量；按 name 视为同一条） */
async function setValuesGlobal(items: ValueResource[], on: boolean) {
  // on=true 时不过滤已带标记的项：支持「重新发布」（以当前分组这一份覆盖所有分组）
  const list = on ? items.slice() : items.filter((v) => v.global)
  if (!list.length) return
  list.forEach((v) => {
    v.global = on
  })
  emitGroupUpdate()
  try {
    const g = await loadGlobalSections()
    const names = new Set(list.map((v) => v.name))
    const next = (g.valueLibrary || []).filter((x) => !names.has(x.name))
    if (on) {
      next.push(...list.map((v) => JSON.parse(JSON.stringify({ ...v, global: true })) as ValueResource))
    }
    await saveGlobalValueLibrary(next)
    // on=true：先以当前分组这一份覆盖其它分组的同一条（按 id），再补缺失项
    const touched =
      (on ? broadcastGlobalContent({ values: list }) : 0) + syncGlobalToAllGroups({ values: list }, on)
    if (touched) emitGroupUpdate()
    const labels = list.map((v) => v.name)
    ElMessage.success(
      on
        ? `已设为全局：${globalLabel(labels, '值资源')}${touched ? `（已同步 ${touched} 处其它分组副本，保存后生效）` : ''}`
        : `已取消全局：${globalLabel(labels, '值资源')}${touched ? `（其它分组的 ${touched} 处副本已保留，仅清除全局标记）` : ''}`,
    )
  } catch (e: any) {
    list.forEach((v) => {
      v.global = !on
    })
    emitGroupUpdate()
    ElMessage.warning(`全局库同步失败：${e?.message || String(e)}`)
  }
  // 全局标记变了 → 内容同步的基线要跟着重建（否则下一次编辑会把「刚取消全局」误判成删除）
  resetGlobalBaseline()
}

/** 加载全局库到模板（不修改任何分组内容） */
async function loadGlobal() {
  // 会联网：慢网下给编辑区一个遮罩，避免「点完没反应」
  globalLoading.value = true
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
    // 顺带把函数库解析成「已知函数名」，供卡片上「调用了不存在的函数」告警使用
    // （自定义卡片 step_library 的名字也一并带上，否则卡片里调用它们会被误报）
    await refreshKnownFuncNames(
      String(data.function_library || ''),
      false,
      Array.isArray(data.step_library)
        ? data.step_library.map((s: any) => String(s?.name || '')).filter(Boolean)
        : [],
    )
  } catch (e: any) {
    ElMessage.warning('加载全局库失败：' + (e?.message || String(e)))
  } finally {
    globalLoading.value = false
  }
}

/** 解析函数库源码 → 刷新已知函数名（source 省略时从全局库现取）
 *  notifyBuiltinConflicts=true 时（函数库面板保存后）额外做一次内置冲突即时提示（#8）
 *  extraNames：自定义卡片（step_library）的函数名，一并算作「已知函数」 */
async function refreshKnownFuncNames(
  source?: string,
  notifyBuiltinConflicts = false,
  extraNames?: string[],
) {
  try {
    let src = source
    if (src === undefined) {
      const res: any = await getGlobalLibrary()
      const data = res?.data?.data ?? res?.data ?? {}
      src = String(data.function_library || '')
      if (!extraNames?.length) {
        extraNames = (Array.isArray(data.step_library) ? data.step_library : [])
          .map((s: any) => String(s?.name || ''))
          .filter(Boolean)
      }
    }
    const raw = String(src || '').trim()
    if (!raw) {
      // 函数库为空时无法判断函数是否存在：留空让画布/卡片列表跳过这项校验，避免全体误报
      knownFuncNames.value = []
      return
    }
    const res: any = await parseFunctions(raw)
    const data = res?.data?.data ?? res?.data ?? res ?? {}
    const list = Array.isArray(data.functions) ? data.functions : []
    const names = list.map((f: any) => String(f?.name || '')).filter(Boolean)
    // 自定义卡片（step_library）里的函数名也并入「已知」：它们不在源码视图文本里，
    // 不并入的话卡片/步骤里调用它们会被误标成「调用了函数库里不存在的函数」
    for (const n of extraNames || []) if (!names.includes(n)) names.push(n)
    knownFuncNames.value = names
    // #8：保存函数库后即时提示「与内置模板同名同参」的冲突（原先要等到点「生成」才知道）
    if (notifyBuiltinConflicts) await reportBuiltinConflicts(list)
  } catch {
    // 解析失败不阻塞编辑：保持上一次结果（空数组时画布会跳过这项校验）
  }
}

// ===== #8 函数库冲突即时提示 =====
/** 内置模板函数签名键集合（懒加载一次；接口不可用时为 null → 跳过提示，不改原有行为） */
let builtinFuncKeys: Set<string> | null = null
async function loadBuiltinFuncKeys(): Promise<Set<string> | null> {
  if (builtinFuncKeys) return builtinFuncKeys
  try {
    const res: any = await getBuiltinFunctions()
    const data = res?.data?.data ?? res?.data ?? {}
    const list = Array.isArray(data.functions) ? data.functions : []
    const keys = new Set<string>(
      list.map((f: any) => String(f?.key || '')).filter((k: string) => !!k),
    )
    if (!keys.size) return null
    builtinFuncKeys = keys
    return keys
  } catch {
    return null
  }
}
/** 签名键（与后端 function_module._fn_key 同规则）：`函数名|参数类型1,参数类型2`，类型去掉空白 */
function funcKeyOf(f: any): string {
  const name = String(f?.name || '')
  const params = Array.isArray(f?.params) ? f.params : []
  const types = params.map((p: any) => String(p?.type || '').replace(/\s+/g, ''))
  return `${name}|${types.join(',')}`
}
/** 列出「与内置函数同名同参」的自定义函数名并提示：这些函数生成时不会被追加（内置优先） */
async function reportBuiltinConflicts(list: any[]) {
  const keys = await loadBuiltinFuncKeys()
  if (!keys) return
  const names = [
    ...new Set(list.map(funcKeyOf).filter((k) => keys.has(k)).map((k) => k.split('|')[0])),
  ].filter(Boolean)
  if (!names.length) return
  ElMessage.warning({
    message: `函数库中的 ${names.join('、')} 与内置函数同名同参，生成时不会被采用（以内置模板为准）。`,
    duration: 8000,
    showClose: true,
  })
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
  importingTemplate.value = true
  try {
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
    // 当前分组的卡片 / 映射 / 值资源被整份替换 → 内容同步基线重建
    resetGlobalBaseline()
  } finally {
    importingTemplate.value = false
  }
}

/** 把当前分组导出为全局模板 */
async function exportGlobalTemplate() {
  const grp = activeGroup.value
  if (!grp) return
  try {
    await ElMessageBox.confirm(
      `把当前分组「${grp.name}」的卡片库 / 对象映射表 / 值资源库合并进全局模板？\n只会覆盖 / 新增这些同名条目，全局库里的其它条目保留，其它分组也不受影响。`,
      '导出为全局模板',
      { confirmButtonText: '导出', cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    return
  }
  exportingTemplate.value = true
  try {
    // 增量合并进全局库：只覆盖 / 新增当前分组里这些条目，**不删除**全局库里的其它条目。
    // 原先是整份覆盖 —— 会把全局库换成"这个分组的快照"，其它配置立刻与全局库不一致，
    // 且全局库原有条目会在所有分组里集体变成「有徽标但库里没有」的孤儿。
    const allCards = CARD_BUCKETS.flatMap((b) => cardLibrary.value[b] || [])
    const allMapping = MAPPING_BUCKETS.flatMap((b) => mapping.value[b] || [])
    await persistGlobalChange({
      upsert: {
        cards: JSON.parse(JSON.stringify(allCards)) as Card[],
        mapping: JSON.parse(JSON.stringify(allMapping)) as MappingEntry[],
        values: JSON.parse(JSON.stringify(valueLibrary.value || [])) as ValueResource[],
      },
    })
    ElMessage.success('已合并进全局模板（全局库其它条目保留）。如需让其它分组也用上这份内容，请在卡片 / 映射 / 值资源列表右键「重新发布到所有分组」。')
  } catch (e: any) {
    ElMessage.warning('导出为全局模板失败：' + (e?.message || String(e)))
  } finally {
    exportingTemplate.value = false
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
    // 外部整体替换（父级载入了别的配置/数据）：以新内容为已保存基线
    dirty.value = false
    resetGlobalBaseline()
  },
)
watch(
  () => props.mapping,
  (v) => {
    // 仅在外部值确与当前分组不同时应用，避免回写自身 emit 覆盖分组内容
    if (JSON.stringify(mapping.value) === JSON.stringify(v)) return
    mapping.value = JSON.parse(JSON.stringify(v))
    resetGlobalBaseline()
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
/** 待定位的 case_id（打开编辑器时由 props.focusCaseId 带入，定位成功即清空）（P2-3） */
let pendingFocusCaseId = String(props.focusCaseId || '')
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
  // #21：展开用量预检（与用例预览同一口径）。超限就跳过本次用例名刷新：
  // 只是拿 case_id 而已，画布可回落到自定义名/「用例N」，不值得为它触发一次超大展开。
  const hit = checkExpandLimit(graph.value.groups)
  if (hit) {
    ElMessage({ message: expandLimitMessage(hit), type: 'warning', grouping: true })
    return
  }
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
      props.dbcEnvNames,
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
    // 打开时若指定了要定位的用例：等 case_id ↔ 工况 的对应关系就绪后跳到该工况（P2-3）
    if (pendingFocusCaseId) {
      const cid = pendingFocusCaseId
      pendingFocusCaseId = ''
      const fid = Object.keys(map).find((k) => (map[k] || []).includes(cid))
      if (fid) {
        selectFrame(fid)
        ElMessage.info(`已定位到用例「${cid}」所在工况`)
      } else {
        ElMessage.warning(`未找到用例「${cid}」对应的工况`)
      }
    }
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
    // #21：同一次「整图展开」，超限不发起（避免为看一条用例把整份产物拉回来）
    const limitHit = checkExpandLimit(graph.value.groups)
    if (limitHit) {
      ElMessage({ message: expandLimitMessage(limitHit), type: 'warning', grouping: true })
      return ''
    }
    const res: any = await expandCases(
      graph.value,
      mapping.value,
      activeGroup.value?.cards,
      activeGroup.value?.valueLibrary,
      false,
      props.ccpVarTypes,
      props.dbcEnvNames,
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
  /** 函数库已有函数名 + 刷新入口（函数库面板保存后由 PanelBody 回调） */
  knownFuncNames,
  refreshKnownFuncNames,
  selectedCardId,
  selectionCardId,
  selectionCardIds,
  isCardSelected,
  selectCardInList,
  focusLibraryCard,
  onFocusNode,
  focusFrameItem,
  removeCardSelection,
  editorTarget,
  selectedCard,
  graph,
  mapping,
  stepSaveSignal,
  /** 新建卡片后置真：StepEditor 据此聚焦卡片名（P0-6） */
  cardNameFocusPending,
  /** StepEditor 已消费一次聚焦请求 → 复位，避免下次打开卡片被误聚焦 */
  consumeCardNameFocus: () => {
    cardNameFocusPending.value = false
  },
  /** 保存配置信号：画布监听后清空撤销栈（#22 撤销边界） */
  canvasSaveSignal,
  stepEditorFocused,
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
  setCardsGlobal,
  setMappingsGlobal,
  setValuesGlobal,
  /** 供卡片编辑面板在「剪贴板无步骤数据」时兜底粘贴工况 / 库卡片（P2-2） */
  pasteEntity,
  hideObj: () => {
    panelStates.value.obj.visible = false
    // 与 toggleObjDrawer 一致：手动关闭后也不被自动覆盖（P1-6）
    userObjOverrideUntil = Date.now() + OBJ_MANUAL_HOLD_MS
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
      if (editorTarget.value === 'card' && stepEditorFocused.value) {
        // 卡片步骤编辑状态下把保存转交给 StepEditor
        stepSaveSignal.value++
      } else {
        // 保存当前分组内容并通知父级保存配置（与顶部「保存」按钮同一入口，避免两处语义漂移）
        onSaveClick()
      }
      return true
    },
  })
  useShortcut({
    id: 'graph:copyEntity',
    keys: 'Ctrl+C',
    scope: 'module',
    desc: '复制选中的工况/库卡片（编辑卡片时若无选中步骤同样生效）',
    // 不再限定「非卡片编辑态」：编辑卡片时画布已卸载，canvas:copy 会自动注销，
    // 而步骤复制 steps:copy 是更内层的 context 作用域，有选中步骤时它先接管；
    // 无选中步骤则落到这里，复制当前分组/库卡片 —— 免得为了复制工况先退出卡片编辑。
    when: () => isModuleActive('/function'),
    run: () => {
      copySelectedEntity()
      return true
    },
  })
  useShortcut({
    id: 'graph:pasteEntity',
    keys: 'Ctrl+V',
    scope: 'module',
    desc: '粘贴工况/库卡片（编辑卡片时若无步骤剪贴板同样生效）',
    when: () => isModuleActive('/function'),
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
  // 载入期的补全/迁移都结束 → 建立「全局项内容同步」的基线（此后编辑才能 diff 出增删改）
  resetGlobalBaseline()
  if (frames.value.length) selectFrame(frames.value[0].id)
  // 画布「用例展开」的默认用例名（后端生成的 case_id）
  scheduleCaseIdRefresh()
  // 载入期的迁移/补全不算「未保存的修改」：全部完成后清掉标记
  dirty.value = false
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
  /* 顶部按钮较多（工况/注入/序列/检查/函数库/值资源库/对象浏览器/保存/生成/生成结果），
     窄窗口下允许换行：否则右侧按钮会被挤出可视区、点不到 */
  flex-wrap: wrap;
  row-gap: 6px;
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

/* ===== 生成结果抽屉（#10/P1-5）===== */
.ge-out-dot {
  display: inline-block;
  margin-left: 4px;
  padding: 0 4px;
  border-radius: 8px;
  background: var(--el-color-warning);
  color: #fff;
  font-size: 11px;
  line-height: 14px;
}
.ge-out-empty {
  color: #909399;
  font-size: 13px;
  line-height: 1.8;
  padding: 8px 0;
}
.ge-out-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.ge-out-msg {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
}
.ge-out-dir {
  margin: 6px 0 10px;
  padding: 6px 8px;
  border-radius: 4px;
  background: #f5f7fa;
  color: #606266;
  font-size: 12px;
  font-family: Consolas, Monaco, monospace;
  word-break: break-all;
}
.ge-out-conflict {
  margin-bottom: 10px;
  padding: 8px 10px;
  border-radius: 4px;
  border: 1px solid var(--el-color-warning-light-5);
  background: var(--el-color-warning-light-9);
  color: #b88230;
  font-size: 12px;
  line-height: 1.6;
}
.ge-out-tabs {
  margin-top: 4px;
}
.ge-out-code-head {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 4px;
}
.ge-out-pre {
  margin: 0;
  padding: 10px 12px;
  max-height: 52vh;
  overflow: auto;
  border-radius: 4px;
  background: #282c34;
  color: #abb2bf;
  font-size: 12px;
  line-height: 1.55;
  font-family: Consolas, Monaco, 'Courier New', monospace;
}
.ge-out-at {
  margin-top: 10px;
  font-size: 11px;
  color: #c0c4cc;
}

/* #27 可访问性：系统开启「减少动态效果」时关闭过渡/动画 */
@media (prefers-reduced-motion: reduce) {
  * {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
  }
}
</style>

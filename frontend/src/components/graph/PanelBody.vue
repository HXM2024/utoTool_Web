<template>
  <div ref="rootEl" class="panel-body">
    <!-- 工况 -->
    <div v-if="panelId === 'frames'" class="pb-list" @dragover.prevent="onListOver" @drop="onFrameDrop">
      <div
        v-for="(f, i) in ctx.frames.value"
        :key="f.id"
        class="obj-item"
        :class="{ active: ctx.selectedFrameId.value === f.id }"
        :data-frame-id="f.id"
        draggable="true"
        @dragstart="ctx.onFrameDragStart($event, f)"
        @dblclick="ctx.selectFrame(f.id)"
        @click="ctx.selectFrame(f.id)"
      >
        <span class="obj-drag" title="Ctrl+拖拽复制">⠿</span>
        <span class="obj-name" :title="f.name">{{ i + 1 }}. {{ f.name }}</span>
        <el-icon class="obj-del" @click.stop="ctx.removeFrame(f.id)"><Close /></el-icon>
      </div>
      <div v-if="!ctx.frames.value.length" class="obj-empty">暂无工况</div>
      <el-button class="pb-add" type="primary" plain size="small" :icon="Plus" @click="ctx.addFrame">新建工况</el-button>
    </div>

    <!-- 故障注入 / 故障恢复（分类卡片库） -->
    <div v-else-if="panelId === 'inject'" class="pb-list" @dragover.prevent="onListOver" @drop="onCardDrop">
      <div class="pb-group inject-group" @dragover.prevent @drop.stop.prevent="onCardDropTo($event, 'inject')">
        <div class="pb-group-title">故障注入</div>
        <div
          v-for="c in injectCards"
          :key="c.id"
          class="obj-item"
          :class="{ active: ctx.isCardSelected(c.id), global: c.global }"
          :data-card-id="c.id"
          draggable="true"
          @dragstart="ctx.onCardDragStart($event, c)"
          @dblclick="ctx.selectCard(c)"
          @click="onCardRowClick(c, $event, orderedCardIds)"
          @contextmenu.prevent.stop="openCardMenu($event, c)"
        >
          <span class="obj-drag" title="拖拽到工况 / Ctrl+拖拽复制">⠿</span>
          <span v-if="c.global" class="obj-global" title="全局卡片：设为全局后自动同步到所有分组的卡片列表">全局</span>
          <span
            v-if="missingFuncsOf(c).length"
            class="obj-warn"
            :title="`调用了函数库里不存在的函数：${missingFuncsOf(c).join('、')}（生成时 CAPL 会编译不过）`"
          >⚠</span>
          <span class="obj-name" :title="c.name">{{ c.name }}</span>
          <el-icon class="obj-del" @click.stop="ctx.removeCardSelection(c)"><Close /></el-icon>
        </div>
        <div v-if="!injectCards.length" class="obj-empty">暂无故障注入</div>
        <el-button class="pb-add" type="primary" plain size="small" :icon="Plus" @click="ctx.createCard('inject')">新建注入</el-button>
      </div>

      <div class="pb-group recover-group" @dragover.prevent @drop.stop.prevent="onCardDropTo($event, 'recover')">
        <div class="pb-group-title recover">故障恢复</div>
        <div
          v-for="c in recoverCards"
          :key="c.id"
          class="obj-item"
          :class="{ active: ctx.isCardSelected(c.id), global: c.global }"
          :data-card-id="c.id"
          draggable="true"
          @dragstart="ctx.onCardDragStart($event, c)"
          @dblclick="ctx.selectCard(c)"
          @click="onCardRowClick(c, $event, orderedCardIds)"
          @contextmenu.prevent.stop="openCardMenu($event, c)"
        >
          <span class="obj-drag" title="拖拽到工况 / Ctrl+拖拽复制">⠿</span>
          <span v-if="c.global" class="obj-global" title="全局卡片：设为全局后自动同步到所有分组的卡片列表">全局</span>
          <span
            v-if="missingFuncsOf(c).length"
            class="obj-warn"
            :title="`调用了函数库里不存在的函数：${missingFuncsOf(c).join('、')}（生成时 CAPL 会编译不过）`"
          >⚠</span>
          <span class="obj-name" :title="c.name">{{ c.name }}</span>
          <el-icon class="obj-del" @click.stop="ctx.removeCardSelection(c)"><Close /></el-icon>
        </div>
        <div v-if="!recoverCards.length" class="obj-empty">暂无故障恢复</div>
        <el-button class="pb-add" type="primary" plain size="small" :icon="Plus" @click="ctx.createCard('inject', 'recover')">新建恢复</el-button>
      </div>
    </div>

    <!-- 卡片列表（测试序列 / 结果判断） -->
    <div v-else-if="isCardPanel" class="pb-list" @dragover.prevent="onListOver" @drop="onCardDrop">
      <div
        v-for="c in cardList"
        :key="c.id"
        class="obj-item"
        :class="{ active: ctx.isCardSelected(c.id), global: c.global }"
        :data-card-id="c.id"
        draggable="true"
        @dragstart="ctx.onCardDragStart($event, c)"
        @dblclick="ctx.selectCard(c)"
        @click="onCardRowClick(c, $event, orderedCardIds)"
        @contextmenu.prevent.stop="openCardMenu($event, c)"
      >
        <span class="obj-drag" title="拖拽到工况 / Ctrl+拖拽复制">⠿</span>
        <span v-if="c.global" class="obj-global" title="全局卡片：设为全局后自动同步到所有分组的卡片列表">全局</span>
        <span
          v-if="missingFuncsOf(c).length"
          class="obj-warn"
          :title="`调用了函数库里不存在的函数：${missingFuncsOf(c).join('、')}（生成时 CAPL 会编译不过）`"
        >⚠</span>
        <span class="obj-name" :title="c.name">{{ c.name }}</span>
        <el-icon class="obj-del" @click.stop="ctx.removeCardSelection(c)"><Close /></el-icon>
      </div>
      <div v-if="!cardList.length" class="obj-empty">暂无</div>
      <el-button class="pb-add" type="primary" plain size="small" :icon="Plus" @click="ctx.createCard(cardType)">新建</el-button>
    </div>

    <!-- 编辑 -->
    <div
      v-else-if="panelId === 'editor'"
      class="pb-fill"
      @focusin="onEditorFocus(true)"
      @focusout="onEditorFocus(false)"
    >
      <StepEditor
        v-if="ctx.editorTarget.value === 'card'"
        :card="ctx.selectedCard.value"
        :cards="ctx.cardLibrary.value"
        :save-signal="ctx.stepSaveSignal.value"
        :focus-name="ctx.cardNameFocusPending.value"
        @focus-name-done="ctx.consumeCardNameFocus"
        @save="ctx.saveCard"
        @add-mapping="ctx.onAddMapping"
        @open-card="ctx.selectCardById"
      />
      <CaseFrameCanvas
        v-else
        :graph="ctx.graph.value"
        :selected-frame-id="ctx.selectedFrameId.value"
        :active-frame-id="ctx.activeFrameId.value"
        :card-library="ctx.cardLibrary.value"
        :value-library="ctx.valueLibrary.value"
        :frame-case-ids="ctx.frameCaseIds.value"
        :case-rows-map="ctx.frameCaseRowsMap.value"
        :load-case-code="ctx.loadCaseCode"
        :func-names="ctx.knownFuncNames.value"
        :save-signal="ctx.canvasSaveSignal.value"
        @update:graph="ctx.onGraphChange"
        @update:active-frame-id="ctx.setActiveFrame"
        @select-card="ctx.focusLibraryCard"
        @focus-node="ctx.onFocusNode"
        @select-frame="ctx.focusFrameItem"
        @save-card="ctx.saveCard"
      />
    </div>

    <!-- 映射表 -->
    <div v-else-if="panelId === 'mapping'" class="pb-fill">
      <MappingManager
        :mapping="ctx.mapping.value"
        @update:mapping="ctx.onMappingChange"
        @toggle-global="(list, on) => ctx.setMappingsGlobal(list, on)"
      />
    </div>

    <!-- 函数库 -->
    <div v-else-if="panelId === 'func'" class="pb-fill">
      <PanelContent panel-key="func" @saved="onFuncLibSaved" />
    </div>

    <!-- 值资源库 -->
    <div v-else-if="panelId === 'value'" class="pb-fill">
      <ValueLibraryPanel
        :values="ctx.valueLibrary.value"
        @update:values="ctx.onValueLibraryChange"
        @toggle-global="(list, on) => ctx.setValuesGlobal(list, on)"
      />
    </div>

    <!-- 对象浏览器 -->
    <div v-else class="pb-fill">
      <PanelContent panel-key="obj" @collapse="ctx.hideObj" />
    </div>

    <!-- 卡片/映射/值资源的右键菜单（列表行右键「设为全局 / 取消全局」） -->
    <CtxMenu ref="ctxMenu" @select="onMenuSelect" />
  </div>
</template>

<script setup lang="ts">
import { computed, inject, nextTick, ref, watch } from 'vue'
import { Plus, Close } from '@element-plus/icons-vue'
import type { Card } from '@/types/functionGraph'
import { collectCalledFunctionNames, EXTERNAL_CALL_WHITELIST } from '@/utils/functionGraph'
import CtxMenu from './CtxMenu.vue'
import type { CtxMenuItem } from './CtxMenu.vue'
import StepEditor from './StepEditor.vue'
import CaseFrameCanvas from './CaseFrameCanvas.vue'
import MappingManager from './MappingManager.vue'
import PanelContent from './PanelContent.vue'
import ValueLibraryPanel from './ValueLibraryPanel.vue'

const props = defineProps<{
  panelId: string
}>()

// 由 FunctionGraphEditor 通过 provide 注入的共享上下文
const ctx = inject<any>('geCtx')!

const isCardPanel = computed(() => props.panelId === 'inject' || props.panelId === 'sequence' || props.panelId === 'result')
const cardType = computed(() => props.panelId as 'inject' | 'sequence' | 'result')
const cardList = computed<Card[]>(() => ctx.cardLibrary.value[cardType.value] || [])
const injectCards = computed<Card[]>(() => (ctx.cardLibrary.value.inject || []).filter((c: Card) => c.role !== 'recover'))
const recoverCards = computed<Card[]>(() => (ctx.cardLibrary.value.inject || []).filter((c: Card) => c.role === 'recover'))
/** 本面板卡片的可见顺序（Shift 范围选择 / 右键批量操作用）：故障注入面板 = 注入组 + 恢复组 */
const orderedCards = computed<Card[]>(() =>
  props.panelId === 'inject' ? [...injectCards.value, ...recoverCards.value] : cardList.value,
)
const orderedCardIds = computed<string[]>(() => orderedCards.value.map((c) => c.id))

const rootEl = ref<HTMLElement | null>(null)

// ===== 「调用了函数库里不存在的函数」告警（卡片行上按 ⚠ 提示） =====
/** 已知函数名集合；函数库还没加载出来（空）时为 null，此时不做这项校验 */
const knownFuncSet = computed<Set<string> | null>(() => {
  const list = (ctx.knownFuncNames?.value as string[]) || []
  return list.length ? new Set(list) : null
})
/** 该卡片调用的、函数库里不存在的函数名（白名单内的外部/内置函数不算） */
function missingFuncsOf(c: Card): string[] {
  const known = knownFuncSet.value
  if (!known) return []
  return collectCalledFunctionNames(c.steps).filter(
    (n) => !known.has(n) && !EXTERNAL_CALL_WHITELIST.has(n),
  )
}
/** 函数库面板保存后：用它回传的新源码刷新「已知函数名」，卡片上的告警随之更新；
 *  customNames = 自定义卡片名（step_library），也计入「已知函数」；
 *  第 2 个参数 notify=true → 顺带做一次「与内置函数同名同参」的即时提示（#8） */
function onFuncLibSaved(functionLibrary?: string, customNames?: string[]) {
  ctx.refreshKnownFuncNames?.(functionLibrary, true, customNames)
}

/**
 * 卡片列表行单击：无修饰键时「选中即进入编辑」，与工况列表（单击即进编辑）保持一致；
 * 带 Ctrl / Shift 时只做多选高亮，避免多选过程中反复把中栏切来切去。
 */
function onCardRowClick(c: Card, e: MouseEvent, orderedIds: string[]) {
  ctx.selectCardInList(c, e, orderedIds)
  if (!e.ctrlKey && !e.metaKey && !e.shiftKey) ctx.selectCard(c)
}
// ===== 卡片右键菜单：设为全局 / 取消全局（右键的那张在多选里时，作用于整批选中卡片） =====
const ctxMenu = ref<InstanceType<typeof CtxMenu> | null>(null)
/** 右键作用的卡片集合：右键目标在多选集合里 → 整批；否则只作用于它自己（并把选中态切到它） */
function menuCards(c: Card): Card[] {
  const ids = (ctx.selectionCardIds.value as string[]) || []
  if (ids.length > 1 && ids.includes(c.id)) {
    const picked = orderedCards.value.filter((x) => ids.includes(x.id))
    if (picked.length) return picked
  }
  ctx.selectCardInList(c)
  return [c]
}
function openCardMenu(e: MouseEvent, c: Card) {
  const list = menuCards(c)
  const globals = list.filter((x) => x.global).length
  const items: CtxMenuItem[] = []
  if (globals < list.length) {
    items.push({ key: 'global', label: list.length > 1 ? `设为全局（${list.length - globals} 张）` : '设为全局' })
  }
  if (globals > 0) {
    // 带「全局」标记的项再点「设为全局」会被过滤成空操作，所以单独给一个发布入口：
    // 以当前分组这一份为准，覆盖其它分组的同名副本（修漂移就靠它）
    items.push({ key: 'republish', label: list.length > 1 ? `重新发布到所有分组（${globals} 张）` : '重新发布到所有分组' })
    items.push({ key: 'unglobal', label: list.length > 1 ? `取消全局（${globals} 张）` : '取消全局' })
  }
  ctxMenu.value?.open(e, items, list)
}
function onMenuSelect(key: string, payload: unknown) {
  const list = (payload as Card[]) || []
  if (!list.length) return
  if (key === 'global') ctx.setCardsGlobal(list.filter((c) => !c.global), true)
  else if (key === 'republish') ctx.setCardsGlobal(list, true)
  else if (key === 'unglobal') ctx.setCardsGlobal(list.filter((c) => c.global), false)
}
/** 把列表里对应条目滚进可视区（条目本来就在视口内时是空操作，不会跳动） */
async function scrollItemIntoView(attr: string, id: string) {
  if (!id) return
  await nextTick()
  const items = rootEl.value?.querySelectorAll<HTMLElement>(`[${attr}]`)
  if (!items) return
  for (const el of items) {
    if (el.getAttribute(attr) === id) {
      el.scrollIntoView({ block: 'nearest' })
      break
    }
  }
}
// 画布上点卡片 / 点工况 → 对应列表聚焦：把该条目滚进可视区
watch(
  () => ctx.selectionCardId.value as string,
  (id) => scrollItemIntoView('data-card-id', id),
)
watch(
  () => ctx.selectedFrameId.value as string,
  (id) => scrollItemIntoView('data-frame-id', id),
)

// 编辑区焦点进出时更新「焦点是否在步骤编辑框内」标志（Ctrl+S 判据）；仅编辑卡片视图时有效。
// 用焦点而不是鼠标悬停：悬停会让 Ctrl+S 保存目标随鼠标移动而变。focusin/focusout 会冒泡，
// 面板内子控件之间移动焦点时会先 focusout 再 focusin，最终状态仍然是「在内部」。
function onEditorFocus(v: boolean) {
  ctx.stepEditorFocused.value = v && ctx.editorTarget.value === 'card'
}

// 列表区允许放置（Ctrl+拖拽复制）
function onListOver(e: DragEvent) {
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
}
// 卡片列表放置：仅处理 Ctrl+拖拽复制
function onCardDrop(e: DragEvent) {
  const cardId = e.dataTransfer?.getData('application/x-copy-card')
  if (!cardId) return
  e.preventDefault()
  ctx.duplicateCard(cardId)
}
// 故障注入/恢复分区放置：Ctrl+拖拽复制到指定角色分组
function onCardDropTo(e: DragEvent, role: 'inject' | 'recover') {
  const cardId = e.dataTransfer?.getData('application/x-copy-card')
  if (!cardId) return
  e.preventDefault()
  ctx.duplicateCardTo(cardId, role)
}
// 工况列表放置：仅处理 Ctrl+拖拽复制
function onFrameDrop(e: DragEvent) {
  const frameId = e.dataTransfer?.getData('application/x-copy-frame')
  if (!frameId) return
  e.preventDefault()
  ctx.duplicateFrame(frameId)
}
</script>

<style scoped>
.panel-body {
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.pb-list {
  flex: 1;
  overflow-y: auto;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.pb-fill {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.pb-add {
  width: 100%;
  margin-top: 4px;
}
.pb-group-title {
  font-size: 11px;
  font-weight: 600;
  color: #909399;
  margin-top: 6px;
  margin-bottom: 2px;
}
.pb-group-title.recover {
  color: #f56c6c;
}
.pb-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.recover-group {
  margin-top: 6px;
  padding-top: 4px;
  border-top: 1px dashed #e4e7ed;
}
.obj-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 6px;
  border-radius: 5px;
  border: 1px solid transparent;
  cursor: grab;
  font-size: 12px;
  color: #303133;
  user-select: none;
  -webkit-user-select: none;
}
.obj-item:active {
  cursor: grabbing;
}
.obj-item:hover {
  background: #f5f7fa;
}
.obj-item.active {
  background: #ecf5ff;
  border-color: var(--el-color-primary);
}
/* 全局卡片标记：琥珀色小胶囊，一眼可辨 */
.obj-global {
  flex-shrink: 0;
  padding: 0 5px;
  border-radius: 8px;
  font-size: 10px;
  line-height: 15px;
  color: #b88230;
  background: #fdf6ec;
  border: 1px solid #f5dab1;
  pointer-events: none;
}
/* 卡片调用了函数库里不存在的函数：与画布上「未连线卡片」同一套 ⚠ 提示样式 */
.obj-warn {
  flex-shrink: 0;
  color: #e6a23c;
  font-weight: 700;
  cursor: help;
}
.obj-drag {
  color: #c0c4cc;
  font-size: 12px;
  flex-shrink: 0;
  cursor: grab;
}
.obj-drag:hover {
  color: var(--el-color-primary);
}
.obj-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  pointer-events: none;
}
.obj-del {
  color: #c0c4cc;
  cursor: pointer;
  flex-shrink: 0;
  font-size: 12px;
}
.obj-del:hover {
  color: #f56c6c;
}
.obj-empty {
  color: #c0c4cc;
  font-size: 12px;
  text-align: center;
  padding: 12px 0;
}
</style>

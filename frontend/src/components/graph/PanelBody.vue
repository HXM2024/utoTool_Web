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
          :class="{ active: ctx.isCardSelected(c.id) }"
          :data-card-id="c.id"
          draggable="true"
          @dragstart="ctx.onCardDragStart($event, c)"
          @dblclick="ctx.selectCard(c)"
          @click="ctx.selectCardInList(c, $event)"
        >
          <span class="obj-drag" title="拖拽到工况 / Ctrl+拖拽复制">⠿</span>
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
          :class="{ active: ctx.isCardSelected(c.id) }"
          :data-card-id="c.id"
          draggable="true"
          @dragstart="ctx.onCardDragStart($event, c)"
          @dblclick="ctx.selectCard(c)"
          @click="ctx.selectCardInList(c, $event)"
        >
          <span class="obj-drag" title="拖拽到工况 / Ctrl+拖拽复制">⠿</span>
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
        :class="{ active: ctx.isCardSelected(c.id) }"
        :data-card-id="c.id"
        draggable="true"
        @dragstart="ctx.onCardDragStart($event, c)"
        @dblclick="ctx.selectCard(c)"
        @click="ctx.selectCardInList(c, $event)"
      >
        <span class="obj-drag" title="拖拽到工况 / Ctrl+拖拽复制">⠿</span>
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
      @mouseenter="onEditorHover(true)"
      @mouseleave="onEditorHover(false)"
    >
      <StepEditor
        v-if="ctx.editorTarget.value === 'card'"
        :card="ctx.selectedCard.value"
        :cards="ctx.cardLibrary.value"
        :save-signal="ctx.stepSaveSignal.value"
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
        @update:graph="ctx.onGraphChange"
        @update:active-frame-id="ctx.setActiveFrame"
        @select-card="ctx.focusLibraryCard"
        @select-frame="ctx.focusFrameItem"
        @save-card="ctx.saveCard"
      />
    </div>

    <!-- 映射表 -->
    <div v-else-if="panelId === 'mapping'" class="pb-fill">
      <MappingManager :mapping="ctx.mapping.value" @update:mapping="ctx.onMappingChange" />
    </div>

    <!-- 函数库 -->
    <div v-else-if="panelId === 'func'" class="pb-fill">
      <PanelContent panel-key="func" />
    </div>

    <!-- 值资源库 -->
    <div v-else-if="panelId === 'value'" class="pb-fill">
      <ValueLibraryPanel :values="ctx.valueLibrary.value" @update:values="ctx.onValueLibraryChange" />
    </div>

    <!-- 对象浏览器 -->
    <div v-else class="pb-fill">
      <PanelContent panel-key="obj" @collapse="ctx.hideObj" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, nextTick, ref, watch } from 'vue'
import { Plus, Close } from '@element-plus/icons-vue'
import type { Card } from '@/types/functionGraph'
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

const rootEl = ref<HTMLElement | null>(null)
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

// 鼠标进入/离开编辑区时更新「是否悬停在步骤编辑框」标志；仅编辑卡片视图时有效
function onEditorHover(v: boolean) {
  ctx.stepEditorHovered.value = v && ctx.editorTarget.value === 'card'
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

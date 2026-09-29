<template>
  <div class="sanbao-sequence-editor">
    <div class="seq-header">
      <span class="seq-title">用例序列</span>
      <span class="seq-count">共 {{ totalCount }} 步</span>
      <el-button v-if="steps.length" text size="small" :icon="Delete" @click="onClearAll">清空</el-button>
    </div>

    <!-- 拖拽放置区 -->
    <div
      class="seq-drop-zone"
      :class="{ 'drag-over': isDragOver }"
      @dragover.prevent="onDragOver"
      @dragenter.prevent="isDragOver = true"
      @dragleave.prevent="onDragLeave"
      @drop="onSequenceDrop($event, steps)"
    >
      <div v-if="!steps.length" class="drop-empty">
        <el-icon class="drop-icon"><Plus /></el-icon>
        <div class="drop-text">拖拽左侧"步骤库"卡片到此处组装用例序列</div>
        <div class="drop-sub">循环卡片可容纳子步骤，对象可拖到参数框填充</div>
      </div>

      <div v-else class="seq-list">
        <template v-for="(step, idx) in steps" :key="step.id">
          <!-- 插入指示线：顶部 -->
          <div v-if="dropIndicator === 'top' && dropIndicatorIdx === idx && dropIndicatorLoopId === ''" class="drop-indicator"></div>

          <!-- 循环容器：卡片头部用于排序，子步骤容器用于接收子步骤 -->
          <div
            v-if="step.type === 'loop'"
            class="seq-card seq-card-loop"
            :class="{ 'dragging': dragState?.id === step.id, 'drag-target': dropTargetId === step.id }"
            draggable="true"
            @dragstart="onCardDragStart($event, step, steps, idx)"
            @dragend="onCardDragEnd"
            @dragover.prevent="onCardDragOver($event, step, idx, 'main', '')"
            @drop.prevent="onCardDrop($event, steps, idx, '')"
          >
            <!-- 循环卡片头部：负责排序（和普通步骤一样绑定 onCardDragOver/onCardDrop） -->
            <div
              class="seq-card-head loop-head"
              @dragover.prevent="onCardDragOver($event, step, idx, 'main', '')"
              @drop.prevent="onCardDrop($event, steps, idx, '')"
            >
              <span class="seq-index">{{ idx + 1 }}</span>
              <el-icon class="loop-icon"><Refresh /></el-icon>
              <span class="seq-card-name">循环</span>
              <el-radio-group v-model="step.loopMode" size="small" class="loop-mode-radio" @mousedown.stop @click.stop @dragstart.prevent>
                <el-radio-button value="count">次数</el-radio-button>
                <el-radio-button value="infinite">无限</el-radio-button>
              </el-radio-group>
              <div v-if="step.loopMode !== 'infinite'" class="loop-count-box" @mousedown.stop @click.stop @dragstart.prevent>
                <el-input-number v-model="step.count" :min="1" :max="9999" size="small" controls-position="right" class="loop-count-input" />
              </div>
              <div v-else class="loop-exit-box" @mousedown.stop @click.stop @dragstart.prevent>
                <el-input v-model="step.exitCondition" size="small" placeholder="退出条件，如 @sysvar::xxx == 1" class="loop-exit-input" />
              </div>
              <div class="seq-card-actions">
                <el-button text size="small" :icon="Top" :disabled="idx === 0" @click.stop="onMove(steps, idx, -1)" />
                <el-button text size="small" :icon="Bottom" :disabled="idx === steps.length - 1" @click.stop="onMove(steps, idx, 1)" />
                <el-button text size="small" :icon="Delete" @click.stop="onRemove(steps, idx)" />
              </div>
            </div>

            <!-- 循环子步骤放置区：专门负责接收子步骤 -->
            <div
              class="loop-children"
              :class="{ 'drag-over': loopDragOver === step.id }"
              @dragover.prevent.stop="onLoopChildrenDragOver($event, step)"
              @dragleave.stop="onLoopChildrenDragLeave($event, step)"
              @drop.prevent.stop="onLoopChildrenDrop($event, step)"
            >
              <div v-if="!step.children || !step.children.length" class="loop-empty">
                拖拽步骤到此处
              </div>
              <!-- 使用递归组件渲染子步骤列表 -->
              <SubStepList
                :parent="step"
                :children="step.children!"
                @update="updateSubList(step)"
                :drag-state="dragState"
                :drop-target-id="dropTargetId"
                :drop-indicator="childDropIndicator"
                :drop-indicator-idx="childDropIndicatorIdx"
                :drop-indicator-loop-id="childDropLoopId"
                :loop-drag-over="loopDragOver"
                @sort-card-start="onCardDragStart"
                @sort-card-end="onCardDragEnd"
                @sort-card-over="sortCardOver"
                @sort-card-drop="sortCardDrop"
                @loop-children-over="onLoopChildrenDragOver"
                @loop-children-leave="onLoopChildrenDragLeave"
                @loop-children-drop="onLoopChildrenDrop"
                @step-param-drop="onParamDrop"
                @step-move="onMove"
                @step-remove="onRemove"
              />
            </div>
          </div>

          <!-- 普通步骤：头部 dragover/drop 负责排序 -->
          <div
            v-else
            class="seq-card"
            :class="{ 'dragging': dragState?.id === step.id, 'drag-target': dropTargetId === step.id }"
            draggable="true"
            @dragstart="onCardDragStart($event, step, steps, idx)"
            @dragend="onCardDragEnd"
            @dragover.prevent="onCardDragOver($event, step, idx, 'main', '')"
            @drop.prevent="onCardDrop($event, steps, idx, '')"
          >
            <div class="seq-card-head">
              <span class="seq-index">{{ idx + 1 }}</span>
              <span class="seq-card-name">{{ step.name }}</span>
              <div class="seq-card-actions">
                <el-button text size="small" :icon="Top" :disabled="idx === 0" @click.stop="onMove(steps, idx, -1)" />
                <el-button text size="small" :icon="Bottom" :disabled="idx === steps.length - 1" @click.stop="onMove(steps, idx, 1)" />
                <el-button text size="small" :icon="Delete" @click.stop="onRemove(steps, idx)" />
              </div>
            </div>
            <div v-if="getParamKeys(step).length" class="seq-params seq-params-compact" @mousedown.stop @click.stop @dragstart.prevent>
              <div v-for="key in getParamKeys(step)" :key="key" class="seq-param-row">
                <label class="seq-param-label">{{ key }}</label>
                <el-input
                  v-model="step.params[key]"
                  size="small"
                  placeholder="拖拽对象填充"
                  class="seq-param-input"
                  @dragover.prevent
                  @drop="onParamDrop($event, step, key)"
                />
              </div>
            </div>
          </div>

          <!-- 主序列插入指示线：底部（当 step.type==='loop' 时 loop-head 顶部用了top指示线，这里补充底部） -->
          <div v-if="dropIndicator === 'bottom' && dropIndicatorIdx === idx && dropIndicatorLoopId === ''" class="drop-indicator"></div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, defineComponent, h, PropType } from 'vue'
import { Plus, Top, Bottom, Delete, Refresh } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox, ElInput, ElInputNumber, ElButton, ElRadioGroup, ElRadioButton } from 'element-plus'

/** 序列中的一个步骤实例 */
export interface SequenceStep {
  id: string
  type: 'step' | 'loop'
  customStepId?: string
  name: string
  code?: string
  params: Record<string, string>
  count?: number
  loopMode?: 'count' | 'infinite'
  exitCondition?: string
  children?: SequenceStep[]
}

const props = defineProps<{ steps: SequenceStep[] }>()
const emit = defineEmits<{ 'update:steps': [SequenceStep[]] }>()

const isDragOver = ref(false)
const loopDragOver = ref('')
const PLACEHOLDER_RE = /\{\{\s*(\w+)\s*\}\}/g

/** 序列内拖拽状态：记录正在拖拽的步骤及来源 */
interface DragState {
  id: string
  step: SequenceStep
  fromList: SequenceStep[]
  fromIdx: number
  fromLoopId?: string
}
const dragState = ref<DragState | null>(null)

/** 插入指示线位置（主序列 + 所有子步骤列表共用结构，通过 dropIndicatorLoopId 区分） */
const dropIndicator = ref<'top' | 'bottom' | ''>('')
const dropIndicatorIdx = ref(-1)
const dropIndicatorLoopId = ref('')   // 空字符串=主序列，否则=该循环step.id
const dropTargetId = ref('')

/** 子步骤插入指示线别名（为了兼容旧逻辑，保留引用关系） */
const childDropIndicator = dropIndicator
const childDropIndicatorIdx = dropIndicatorIdx
const childDropLoopId = dropIndicatorLoopId

/** 总步骤数（含循环子步骤） */
const totalCount = computed(() => {
  let n = 0
  const walk = (list: SequenceStep[]) => {
    for (const s of list) {
      if (s.type === 'loop') {
        n += 1
        if (s.children) walk(s.children)
      } else {
        n += 1
      }
    }
  }
  walk(props.steps)
  return n
})

function getParamKeys(step: SequenceStep): string[] {
  if (!step.code) return []
  const seen: string[] = []
  let m: RegExpExecArray | null
  PLACEHOLDER_RE.lastIndex = 0
  while ((m = PLACEHOLDER_RE.exec(step.code)) !== null) {
    if (!seen.includes(m[1])) seen.push(m[1])
  }
  return seen
}

function genId() {
  return 'step-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7)
}

/** 触发数据更新通知 */
function fireUpdate() {
  emit('update:steps', [...props.steps])
}

function onDragOver(event: DragEvent) {
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
}

function onDragLeave() {
  isDragOver.value = false
}

/** 序列区/循环子步骤区接收拖拽（仅处理从步骤库新增） */
function onSequenceDrop(event: DragEvent, targetList: SequenceStep[], loopId?: string) {
  event.preventDefault()
  event.stopPropagation()
  isDragOver.value = false
  loopDragOver.value = ''

  // 序列内拖拽：直接插入到目标列表（空区域时会追加到末尾）
  if (dragState.value) {
    const ds = dragState.value
    ds.fromList.splice(ds.fromIdx, 1)
    targetList.push(ds.step)
    onCardDragEnd()
    fireUpdate()
    ElMessage.success(loopId ? '已移入循环' : '已移动步骤')
    return
  }

  const json = event.dataTransfer?.getData('application/json')
  if (!json) return
  try {
    const payload = JSON.parse(json)
    let newStep: SequenceStep | null = null

    if (payload.type === 'custom-step') {
      newStep = {
        id: genId(),
        type: 'step',
        customStepId: payload.id,
        name: payload.name,
        code: payload.code,
        params: {},
      }
    } else if (payload.type === 'loop') {
      newStep = {
        id: genId(),
        type: 'loop',
        name: '循环',
        params: {},
        count: 1,
        loopMode: 'count',
        exitCondition: '',
        children: [],
      }
    }

    if (newStep) {
      targetList.push(newStep)
      fireUpdate()
      ElMessage.success(loopId ? `已添加到循环` : `已添加步骤：${newStep.name}`)
    }
  } catch {
    /* ignore */
  }
}

/** 循环子步骤容器拖拽悬停：整容器接收 */
function onLoopChildrenDragOver(event: DragEvent, loop: SequenceStep) {
  if (dragState.value && dragState.value.id === loop.id) {
    return
  }
  loopDragOver.value = loop.id
  // 子步骤容器的排序指示：清空（因为是作为整体接收）
  if (dropIndicatorLoopId.value === loop.id) {
    dropIndicator.value = ''
    dropIndicatorIdx.value = -1
  }
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = dragState.value ? 'move' : 'copy'
  }
}

/** 循环子步骤容器拖拽离开 */
function onLoopChildrenDragLeave(event: DragEvent, loop: SequenceStep) {
  const container = event.currentTarget as HTMLElement
  if (!event.relatedTarget || !container.contains(event.relatedTarget as Node)) {
    if (loopDragOver.value === loop.id) {
      loopDragOver.value = ''
    }
  }
}

/** 循环子步骤容器放置：接收新步骤/移入已有步骤（追加到末尾，或从步骤库拖入） */
function onLoopChildrenDrop(event: DragEvent, loop: SequenceStep) {
  const targetList = loop.children || (loop.children = [])
  loopDragOver.value = ''

  // 没有 dragState：从步骤库拖入，走 onSequenceDrop
  if (!dragState.value) {
    onSequenceDrop(event, targetList, loop.id)
    return
  }

  const ds = dragState.value

  // 自己放到自己：忽略
  if (ds.id === loop.id) {
    onCardDragEnd()
    return
  }

  // 来自同一循环子列表的步骤（排序指示逻辑，走 onCardDrop）：不在这里处理
  // 这里是"拖到循环空白区域=追加到末尾"的场景
  if (ds.fromList === targetList) {
    onCardDragEnd()
    return
  }

  // 从别的列表移入这个循环
  ds.fromList.splice(ds.fromIdx, 1)
  targetList.push(ds.step)
  onCardDragEnd()
  fireUpdate()
  ElMessage.success('已移入循环')
}

/** 参数输入框接收拖拽：用对象的 text/plain 填充参数 */
function onParamDrop(event: DragEvent, step: SequenceStep, key: string) {
  event.preventDefault()
  event.stopPropagation()
  const text = event.dataTransfer?.getData('text/plain') || ''
  if (!text) return
  step.params[key] = text
  fireUpdate()
  ElMessage.success(`${key} 已填充：${text}`)
}

function onMove(list: SequenceStep[], idx: number, delta: number) {
  const newIdx = idx + delta
  if (newIdx < 0 || newIdx >= list.length) return
  ;[list[idx], list[newIdx]] = [list[newIdx], list[idx]]
  fireUpdate()
}

function onRemove(list: SequenceStep[], idx: number) {
  list.splice(idx, 1)
  fireUpdate()
}

/** 卡片开始拖拽：记录来源信息 */
function onCardDragStart(event: DragEvent, step: SequenceStep, fromList: SequenceStep[], fromIdx: number, fromLoopId?: string) {
  const target = event.target as HTMLElement

  // 参数输入框内的拖拽不触发卡片移动
  if (target.tagName === 'INPUT' || target.closest('.seq-param-input') || target.closest('.el-input__inner')) {
    event.preventDefault()
    return
  }

  // 操作按钮/数字输入框/单选组不触发拖拽
  if (target.closest('.seq-card-actions') || target.closest('.el-button') || target.closest('.el-input-number') || target.closest('.el-radio-group')) {
    event.preventDefault()
    return
  }

  // 阻止 dragstart 冒泡到外层 draggable 元素
  event.stopPropagation()

  dragState.value = {
    id: step.id,
    step,
    fromList,
    fromIdx,
    fromLoopId,
  }
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/seq-move', step.id)
  }
}

/** 卡片拖拽结束：清理状态 */
function onCardDragEnd() {
  dragState.value = null
  dropIndicator.value = ''
  dropIndicatorIdx.value = -1
  dropIndicatorLoopId.value = ''
  dropTargetId.value = ''
  loopDragOver.value = ''
}

/** 排序指示逻辑（所有层级共用） */
function sortCardOver(event: DragEvent, step: SequenceStep, idx: number, loopId: string) {
  if (!dragState.value) return
  if (dragState.value.id === step.id) {
    dropTargetId.value = ''
    return
  }
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const midY = rect.top + rect.height / 2
  const isTop = event.clientY < midY

  dropTargetId.value = step.id
  dropIndicator.value = isTop ? 'top' : 'bottom'
  dropIndicatorIdx.value = idx
  dropIndicatorLoopId.value = loopId
  loopDragOver.value = ''
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
}

/** 排序Drop逻辑（所有层级共用） */
function sortCardDrop(event: DragEvent, targetList: SequenceStep[], targetIdx: number, targetLoopId: string) {
  event.preventDefault()
  event.stopPropagation()
  loopDragOver.value = ''

  const ds = dragState.value

  // 从步骤库拖入
  if (!ds) {
    onSequenceDrop(event, targetList, targetLoopId || undefined)
    return
  }

  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const midY = rect.top + rect.height / 2
  const isTop = event.clientY < midY
  let insertIdx = isTop ? targetIdx : targetIdx + 1

  // 自己拖到自己
  if (ds.fromList === targetList && ds.fromIdx === targetIdx && !isTop) {
    onCardDragEnd()
    return
  }

  const sameList = ds.fromList === targetList
  ds.fromList.splice(ds.fromIdx, 1)

  if (sameList && ds.fromIdx < insertIdx) {
    insertIdx -= 1
  }

  if (sameList && insertIdx === ds.fromIdx) {
    onCardDragEnd()
    return
  }

  if (insertIdx < 0) insertIdx = 0
  if (insertIdx > targetList.length) insertIdx = targetList.length

  targetList.splice(insertIdx, 0, ds.step)
  onCardDragEnd()
  fireUpdate()
  ElMessage.success('已移动步骤位置')
}

/** 主序列卡片排序悬停（对外） */
function onCardDragOver(event: DragEvent, step: SequenceStep, idx: number, scope: 'main' | 'child', loopId?: string) {
  sortCardOver(event, step, idx, loopId || '')
}

/** 主序列卡片排序Drop（对外） */
function onCardDrop(event: DragEvent, targetList: SequenceStep[], targetIdx: number, targetLoopId?: string) {
  sortCardDrop(event, targetList, targetIdx, targetLoopId || '')
}

/** 子步骤列表更新时，触发整体更新 */
function updateSubList(_parent: SequenceStep) {
  fireUpdate()
}

function onClearAll() {
  ElMessageBox.confirm('确认清空所有序列步骤？', '提示', { type: 'warning' })
    .then(() => {
      emit('update:steps', [])
      ElMessage.success('已清空')
    })
    .catch(() => {})
}

// ============================================================
// 子步骤列表递归组件（支持任意层级嵌套循环）
// ============================================================
const SubStepList = defineComponent({
  name: 'SubStepList',
  props: {
    parent: { type: Object as PropType<SequenceStep>, required: true },
    children: { type: Array as PropType<SequenceStep[]>, required: true },
    dragState: { type: Object as PropType<DragState | null> },
    dropTargetId: String,
    dropIndicator: String,
    dropIndicatorIdx: Number,
    dropIndicatorLoopId: String,
    loopDragOver: String,
  },
  emits: [
    'update',
    'sort-card-start',
    'sort-card-end',
    'sort-card-over',
    'sort-card-drop',
    'loop-children-over',
    'loop-children-leave',
    'loop-children-drop',
    'step-param-drop',
    'step-move',
    'step-remove',
  ],
  setup(props, { emit }) {
    const loopId = props.parent.id

    return () => {
      const children = props.children || []
      if (!children.length) return null

      const nodes: any[] = []

      children.forEach((child, cIdx) => {
        const isTop = props.dropIndicator === 'top'
          && props.dropIndicatorIdx === cIdx
          && props.dropIndicatorLoopId === loopId
        if (isTop) {
          nodes.push(h('div', { class: 'drop-indicator' }))
        }

        const childListRef = children

        if (child.type === 'loop') {
          // ---------- 子循环 ----------
          const headDrag = {
            onDragover: (e: DragEvent) => {
              e.preventDefault()
              emit('sort-card-over', e, child, cIdx, loopId)
            },
            onDrop: (e: DragEvent) => {
              e.preventDefault()
              emit('sort-card-drop', e, childListRef, cIdx, loopId)
            },
          }

          const headNodes: any[] = []
          headNodes.push(h('span', { class: 'seq-index seq-index-sub' }, `${cIdx + 1}`))
          headNodes.push(h(Refresh, { class: 'loop-icon' }))
          headNodes.push(h('span', { class: 'seq-card-name' }, '循环'))

          // 次数/无限单选
          const radioGroup = h(
            ElRadioGroup,
            {
              modelValue: child.loopMode,
              size: 'small',
              class: 'loop-mode-radio',
              'onUpdate:modelValue': (val: any) => {
                child.loopMode = val as any
                emit('update')
              },
              onMousedown: (e: Event) => e.stopPropagation(),
              onClick: (e: Event) => e.stopPropagation(),
              onDragstart: (e: Event) => e.preventDefault(),
            },
            {
              default: () => [
                h(ElRadioButton, { value: 'count' }, () => '次数'),
                h(ElRadioButton, { value: 'infinite' }, () => '无限'),
              ],
            },
          )
          headNodes.push(radioGroup)

          if (child.loopMode !== 'infinite') {
            headNodes.push(h(
              'div',
              {
                class: 'loop-count-box',
                onMousedown: (e: Event) => e.stopPropagation(),
                onClick: (e: Event) => e.stopPropagation(),
                onDragstart: (e: Event) => e.preventDefault(),
              },
              [h(ElInputNumber, {
                modelValue: child.count,
                min: 1,
                max: 9999,
                size: 'small',
                controlsPosition: 'right',
                class: 'loop-count-input',
                'onUpdate:modelValue': (val: any) => {
                  child.count = val
                  emit('update')
                },
              })],
            ))
          } else {
            headNodes.push(h(
              'div',
              {
                class: 'loop-exit-box',
                onMousedown: (e: Event) => e.stopPropagation(),
                onClick: (e: Event) => e.stopPropagation(),
                onDragstart: (e: Event) => e.preventDefault(),
              },
              [h(ElInput, {
                modelValue: child.exitCondition,
                size: 'small',
                placeholder: '退出条件，如 @sysvar::xxx == 1',
                class: 'loop-exit-input',
                'onUpdate:modelValue': (val: any) => {
                  child.exitCondition = val
                  emit('update')
                },
              })],
            ))
          }

          // 操作按钮
          const btn = (icon: any, dis: boolean, cb: () => void) =>
            h(ElButton,
              {
                text: true, size: 'small', icon, disabled: dis,
                onClick: (e: Event) => {
                  e.stopPropagation()
                  cb()
                },
              } as any)
          headNodes.push(h('div', { class: 'seq-card-actions' }, [
            btn(Top, cIdx === 0, () => emit('step-move', childListRef, cIdx, -1)),
            btn(Bottom, cIdx === childListRef.length - 1, () => emit('step-move', childListRef, cIdx, 1)),
            btn(Delete, false, () => emit('step-remove', childListRef, cIdx)),
          ]))

          const loopCardClass = [
            'seq-card',
            'seq-card-loop-inner',
            props.dragState?.id === child.id ? 'dragging' : '',
            props.dropTargetId === child.id ? 'drag-target' : '',
          ]

          // 子循环容纳框
          const innerChildren = child.children || (child.children = [])
          const loopChildNodes: any[] = []
          if (!innerChildren.length) {
            loopChildNodes.push(h('div', { class: 'loop-empty' }, '拖拽步骤到此处'))
          } else {
            // 递归子子步骤
            loopChildNodes.push(h(SubStepList, {
              parent: child,
              children: innerChildren,
              dragState: props.dragState,
              dropTargetId: props.dropTargetId,
              dropIndicator: props.dropIndicator,
              dropIndicatorIdx: props.dropIndicatorIdx,
              dropIndicatorLoopId: props.dropIndicatorLoopId,
              loopDragOver: props.loopDragOver,
              'onUpdate': () => emit('update'),
              'onSort-card-start': (...a: any[]) => emit('sort-card-start', ...a),
              'onSort-card-end': (...a: any[]) => emit('sort-card-end', ...a),
              'onSort-card-over': (...a: any[]) => emit('sort-card-over', ...a),
              'onSort-card-drop': (...a: any[]) => emit('sort-card-drop', ...a),
              'onLoop-children-over': (...a: any[]) => emit('loop-children-over', ...a),
              'onLoop-children-leave': (...a: any[]) => emit('loop-children-leave', ...a),
              'onLoop-children-drop': (...a: any[]) => emit('loop-children-drop', ...a),
              'onStep-param-drop': (...a: any[]) => emit('step-param-drop', ...a),
              'onStep-move': (...a: any[]) => emit('step-move', ...a),
              'onStep-remove': (...a: any[]) => emit('step-remove', ...a),
            } as any))
          }

          const innerContainer = h('div',
            {
              class: ['loop-children', props.loopDragOver === child.id ? 'drag-over' : ''],
              onDragover: (e: DragEvent) => {
                e.preventDefault()
                e.stopPropagation()
                emit('loop-children-over', e, child)
              },
              onDragleave: (e: DragEvent) => {
                e.stopPropagation()
                emit('loop-children-leave', e, child)
              },
              onDrop: (e: DragEvent) => {
                e.preventDefault()
                e.stopPropagation()
                emit('loop-children-drop', e, child)
              },
            },
            loopChildNodes,
          )

          nodes.push(h('div',
            {
              class: loopCardClass,
              draggable: 'true',
              onDragstart: (e: DragEvent) => emit('sort-card-start', e, child, childListRef, cIdx, loopId),
              onDragend: () => emit('sort-card-end'),
            },
            [
              h('div', { class: 'seq-card-head loop-head', ...headDrag }, headNodes),
              innerContainer,
            ],
          ))
        } else {
          // ---------- 普通子步骤 ----------
          const dragHandlers = {
            onDragover: (e: DragEvent) => {
              e.preventDefault()
              emit('sort-card-over', e, child, cIdx, loopId)
            },
            onDrop: (e: DragEvent) => {
              e.preventDefault()
              emit('sort-card-drop', e, childListRef, cIdx, loopId)
            },
          }

          const headNodes: any[] = []
          headNodes.push(h('span', { class: 'seq-index seq-index-sub' }, `${cIdx + 1}`))
          headNodes.push(h('span', { class: 'seq-card-name' }, child.name))

          const btn = (icon: any, dis: boolean, cb: () => void) =>
            h(ElButton,
              {
                text: true, size: 'small', icon, disabled: dis,
                onClick: (e: Event) => {
                  e.stopPropagation()
                  cb()
                },
              } as any)
          headNodes.push(h('div', { class: 'seq-card-actions' }, [
            btn(Top, cIdx === 0, () => emit('step-move', childListRef, cIdx, -1)),
            btn(Bottom, cIdx === childListRef.length - 1, () => emit('step-move', childListRef, cIdx, 1)),
            btn(Delete, false, () => emit('step-remove', childListRef, cIdx)),
          ]))

          const paramKeys = (() => {
            if (!child.code) return [] as string[]
            const re = /\{\{\s*(\w+)\s*\}\}/g
            const seen: string[] = []
            let m: RegExpExecArray | null
            while ((m = re.exec(child.code)) !== null) {
              if (!seen.includes(m[1])) seen.push(m[1])
            }
            return seen
          })()

          const paramNodes: any[] = []
          if (paramKeys.length) {
            for (const key of paramKeys) {
              paramNodes.push(h('div', { class: 'seq-param-row' }, [
                h('label', { class: 'seq-param-label' }, key),
                h(ElInput, {
                  modelValue: child.params[key] || '',
                  size: 'small',
                  placeholder: '拖拽对象填充',
                  class: 'seq-param-input',
                  'onUpdate:modelValue': (val: any) => {
                    child.params[key] = val
                    emit('update')
                  },
                  onDragover: (e: DragEvent) => e.preventDefault(),
                  onDrop: (e: DragEvent) => {
                    e.preventDefault()
                    e.stopPropagation()
                    emit('step-param-drop', e, child, key)
                  },
                } as any),
              ]))
            }
          }

          const cardClass = [
            'seq-card',
            'seq-child',
            props.dragState?.id === child.id ? 'dragging' : '',
            props.dropTargetId === child.id ? 'drag-target' : '',
          ]

          nodes.push(h('div',
            {
              class: cardClass,
              draggable: 'true',
              onDragstart: (e: DragEvent) => emit('sort-card-start', e, child, childListRef, cIdx, loopId),
              onDragend: () => emit('sort-card-end'),
              ...dragHandlers,
            },
            [
              h('div', { class: 'seq-card-head' }, headNodes),
              paramNodes.length
                ? h('div',
                    {
                      class: 'seq-params seq-params-compact',
                      onMousedown: (e: Event) => e.stopPropagation(),
                      onClick: (e: Event) => e.stopPropagation(),
                      onDragstart: (e: Event) => e.preventDefault(),
                    },
                    paramNodes,
                  )
                : null,
            ],
          ))
        }

        // 底部指示线
        const isBottom = props.dropIndicator === 'bottom'
          && props.dropIndicatorIdx === cIdx
          && props.dropIndicatorLoopId === loopId
        if (isBottom) {
          nodes.push(h('div', { class: 'drop-indicator' }))
        }
      })

      return h('div', { class: 'loop-child-list' }, nodes)
    }
  },
})
</script>

<style lang="scss">
.sanbao-sequence-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-card);
  border-radius: 12px;
  padding: 10px;
  overflow: hidden;
}

.seq-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.seq-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.seq-count {
  font-size: 11px;
  color: var(--text-color-secondary);
  flex: 1;
}

.seq-drop-zone {
  flex: 1;
  overflow-y: auto;
  border: 2px dashed var(--border-color-light);
  border-radius: 6px;
  padding: 8px;
  transition: border-color 0.2s, background 0.2s;
}

.seq-drop-zone.drag-over {
  border-color: var(--color-primary);
  background: rgba(64, 158, 255, 0.04);
}

.drop-empty {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-color-secondary);
  text-align: center;
  gap: 6px;
}

.drop-icon {
  font-size: 32px;
  opacity: 0.4;
}

.drop-text {
  font-size: 12px;
}

.drop-sub {
  font-size: 10px;
  opacity: 0.7;
}

.seq-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.seq-card {
  background: var(--bg-page);
  border: 1px solid var(--border-color-light);
  border-radius: 6px;
  padding: 6px 8px;
}

.seq-child {
  background: var(--bg-card);
  border: 1px solid var(--border-color-light, #e4e7ed);
  padding: 4px 6px;
}

.seq-card-loop {
  border: 1.5px dashed var(--color-success) !important;
  background: rgba(103, 194, 58, 0.03) !important;
  padding: 6px 8px 8px;
}

.seq-card-loop-inner {
  border: 1.5px dashed var(--color-success) !important;
  background: rgba(103, 194, 58, 0.04) !important;
  padding: 4px 6px 6px !important;
}

.seq-card-head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
  cursor: grab;
  &:active {
    cursor: grabbing;
  }
}

.loop-head {
  padding-bottom: 2px;
  border-bottom: 1px dashed var(--border-color-light, #e4e7ed);
  margin-bottom: 6px;
}

.seq-index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--color-primary);
  color: #fff;
  font-size: 10px;
  font-weight: 600;
  flex-shrink: 0;
}

.seq-index-sub {
  background: var(--color-info);
  width: 14px;
  height: 14px;
  font-size: 9px;
}

.loop-icon {
  color: var(--color-success);
  font-size: 12px;
}

.seq-card-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.loop-mode-radio {
  transform: scale(0.85);
}

.loop-count-box {
  display: flex;
  align-items: center;
  gap: 2px;
}

.loop-count-input {
  width: 70px;
}

.loop-exit-box {
  flex: 1;
  max-width: 240px;
}

.loop-exit-input {
  font-size: 11px;
}

.seq-card-actions {
  display: flex;
  gap: 1px;
}

.loop-children {
  margin-top: 4px;
  padding: 6px;
  border: 1px dashed var(--border-color-light);
  border-radius: 4px;
  min-height: 32px;
  transition: border-color 0.2s, background 0.2s;
  background: rgba(255, 255, 255, 0.02);
}

.loop-children.drag-over {
  border-color: var(--color-success);
  background: rgba(103, 194, 58, 0.05);
}

.loop-empty {
  text-align: center;
  color: var(--text-color-secondary);
  font-size: 10px;
  padding: 8px 0;
  font-style: italic;
}

.loop-child-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.seq-params-compact {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
}

.seq-param-row {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 160px;
}

.seq-param-label {
  font-size: 10px;
  color: var(--text-secondary);
  flex-shrink: 0;
  font-family: 'Consolas', 'Monaco', monospace;
  min-width: 50px;
}

.seq-param-input {
  flex: 1;
  min-width: 80px;
}

.seq-card[draggable="true"] {
  cursor: grab;
}

.seq-card[draggable="true"]:active {
  cursor: grabbing;
}

.seq-card.dragging {
  opacity: 0.4;
  transform: scale(0.98);
}

.seq-card.drag-target {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 1.5px var(--color-primary);
}

.drop-indicator {
  height: 2px;
  background: var(--color-primary);
  border-radius: 1px;
  margin: 2px 0;
  animation: pulse-indicator 1s ease-in-out infinite;
}

@keyframes pulse-indicator {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}
</style>

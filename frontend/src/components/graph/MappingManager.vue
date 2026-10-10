<template>
  <div class="mapping-manager">
    <div class="mm-header">
      <span class="mm-hint">点击选中，Ctrl 加选 / Shift 范围选；右键可设为全局</span>
      <el-button
        size="small"
        :icon="Plus"
        type="primary"
        text
        @click="addEntry"
        @dragover.prevent
        @drop.prevent.stop="onAddBtnDrop"
      >新增变量</el-button>
    </div>

    <div class="mm-list" @dragover.prevent @drop="onListDrop">
      <div class="mm-row-head">
        <span class="mm-drag-sp"></span>
        <span class="mm-col">变量名</span>
        <span class="mm-col">对象</span>
        <span class="mm-col-op"></span>
      </div>
      <div
        v-for="(e, i) in allEntries"
        :key="i"
        class="mm-row"
        :class="{ 'drop-over': dropRow === i, 'mm-row-active': isRowSelected(i) }"
        @dragover.prevent="dropRow = i"
        @dragleave="dropRow = -1"
        @drop.prevent.stop="onRowDrop($event, i)"
        @click="onRowClick(i, $event)"
        @contextmenu.prevent.stop="openMenu($event, i)"
      >
        <span class="mm-drag" draggable="true" title="拖拽变量到步骤/参数" @dragstart="onRowDragStart($event, e)">⠿</span>
        <span v-if="e.global" class="mm-global" title="全局对象：新建配置 / 新建分组时自动带出">全局</span>
        <el-input v-model="e.alias" size="small" placeholder="变量名" class="mm-col" />
        <el-input v-model="e.name" size="small" placeholder="对象" class="mm-col" />
        <el-button size="small" :icon="Close" text class="mm-col-op" @click.stop="removeEntry(i)" />
      </div>
      <div v-if="!allEntries.length" class="mm-empty">暂无映射，拖入对象或点「新增变量」</div>
    </div>
    <CtxMenu ref="ctxMenu" @select="onMenuSelect" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Plus, Close } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import type { MappingEntry, MappingKind, ObjectMapping } from '@/types/functionGraph'
import CtxMenu from './CtxMenu.vue'
import type { CtxMenuItem } from './CtxMenu.vue'

const props = defineProps<{
  mapping: ObjectMapping
}>()
const emit = defineEmits<{
  (e: 'update:mapping', m: ObjectMapping): void
  /** 右键「设为全局 / 取消全局」：只发意图（可批量），本地结构与全局库同步由编辑器统一处理 */
  (e: 'toggle-global', entries: MappingEntry[], on: boolean): void
}>()

// ===== 行选中（右键批量操作 / Shift 范围选择）=====
const selRows = ref<number[]>([])
/** Shift 范围选择的锚点行 */
let anchorRow = -1
function isRowSelected(i: number): boolean {
  return selRows.value.includes(i)
}
/** 当前选中的条目（按行下标取，越界自动忽略） */
const selectedEntries = computed<MappingEntry[]>(() =>
  selRows.value.map((i) => allEntries.value[i]).filter(Boolean) as MappingEntry[],
)
function onRowClick(i: number, e?: MouseEvent) {
  if (e?.shiftKey && anchorRow >= 0 && anchorRow !== i) {
    const [lo, hi] = anchorRow < i ? [anchorRow, i] : [i, anchorRow]
    selRows.value = Array.from({ length: hi - lo + 1 }, (_, k) => lo + k)
    return
  }
  if (e && (e.ctrlKey || e.metaKey)) {
    selRows.value = selRows.value.includes(i) ? selRows.value.filter((x) => x !== i) : [...selRows.value, i]
  } else {
    selRows.value = [i]
  }
  anchorRow = i
}

// ===== 行右键菜单：设为全局 / 取消全局（右键行在多选里时作用于整批） =====
const ctxMenu = ref<InstanceType<typeof CtxMenu> | null>(null)
/** 右键作用的条目集合：右键行已在多选中 → 整批；否则只作用于该行（并把选中态切到它） */
function menuEntries(i: number): MappingEntry[] {
  if (selRows.value.length > 1 && selRows.value.includes(i)) {
    const picked = selectedEntries.value
    if (picked.length) return picked
  }
  selRows.value = [i]
  anchorRow = i
  const only = allEntries.value[i]
  return only ? [only] : []
}
function openMenu(e: MouseEvent, i: number) {
  const list = menuEntries(i)
  if (!list.length) return
  const globals = list.filter((x) => x.global).length
  const items: CtxMenuItem[] = []
  if (globals < list.length) {
    items.push({ key: 'global', label: list.length > 1 ? `设为全局（${list.length - globals} 条）` : '设为全局' })
  }
  if (globals > 0) {
    items.push({ key: 'unglobal', label: list.length > 1 ? `取消全局（${globals} 条）` : '取消全局' })
  }
  ctxMenu.value?.open(e, items, list)
}
function onMenuSelect(key: string, payload: unknown) {
  const list = (payload as MappingEntry[]) || []
  if (!list.length) return
  if (key === 'global') emit('toggle-global', list.filter((x) => !x.global), true)
  else if (key === 'unglobal') emit('toggle-global', list.filter((x) => x.global), false)
}

const kinds: Array<{ label: string; value: MappingKind }> = [
  { label: '信号', value: 'signal' },
  { label: 'DTC', value: 'dtc' },
  { label: '报文', value: 'message' },
  { label: '环境变量', value: 'envvar' },
  { label: 'A2L', value: 'a2l' },
]

const allEntries = computed<MappingEntry[]>(() => {
  const out: MappingEntry[] = []
  for (const k of kinds) {
    out.push(...props.mapping[bucketOf(k.value)])
  }
  return out
})

function bucketOf(kind: MappingKind): keyof ObjectMapping {
  const map: Record<MappingKind, keyof ObjectMapping> = {
    signal: 'signals',
    dtc: 'dtcs',
    message: 'messages',
    envvar: 'envvars',
    a2l: 'a2l',
  }
  return map[kind]
}

function commit(entries: MappingEntry[]) {
  const next: ObjectMapping = {
    signals: [],
    dtcs: [],
    messages: [],
    envvars: [],
    a2l: [],
  }
  for (const e of entries) {
    next[bucketOf(e.kind)].push({ ...e })
  }
  emit('update:mapping', next)
}

/** 从对象浏览器拖入的 payload 解析为 {kind, name} */
function parseDrop(event: DragEvent): { kind: MappingKind; name: string } | null {
  const raw = event.dataTransfer?.getData('application/json')
  if (!raw) return null
  let payload: any = null
  try {
    payload = JSON.parse(raw)
  } catch {
    return null
  }
  if (!payload || !payload.type) return null

  // 对象浏览器拖拽时把「对象名」的最终文本写进了 text/plain：
  // A2L 在那里已按 CAN 模块的补全规则拼好（有 A2L_Qualifier 时
  // `sysvar::XCP::<限定符>::<路径>`，mapxml 无限定符时退化为路径本身），
  // 这里直接取用，避免两处各写一份规则、日后漂移。
  const plain = event.dataTransfer?.getData('text/plain') || ''

  let kind: MappingKind | null = null
  let name = ''
  if (payload.type === 'signal') {
    kind = 'signal'
    name = payload.name || ''
  } else if (payload.type === 'message') {
    kind = 'message'
    name = payload.name || ''
  } else if (payload.type === 'dtc') {
    kind = 'dtc'
    name = payload.code || payload.name || ''
  } else if (payload.type === 'envvar') {
    kind = 'envvar'
    name = payload.name || ''
  } else if (payload.type === 'a2l-measurement' || payload.type === 'a2l-characteristic') {
    kind = 'a2l'
    // A2L 对象名用补全后的文本（与 CAN 模块一致），而不是对象浏览器里的原始路径
    name = plain || payload.name || ''
  }
  if (!kind || !name) return null
  return { kind, name }
}

const dropRow = ref(-1)

/** 拖到列表空白：新增变量，变量名默认 = 对象名 */
function onListDrop(event: DragEvent) {
  const parsed = parseDrop(event)
  if (!parsed) return
  addEntryFromParsed(parsed)
}

/** 拖到「新增变量」按钮上：以对象名自动创建变量 */
function onAddBtnDrop(event: DragEvent) {
  const parsed = parseDrop(event)
  if (!parsed) return
  addEntryFromParsed(parsed)
}

/** 根据解析结果新增一条映射变量（去重：同 kind 同变量名已存在则跳过） */
function addEntryFromParsed(parsed: { kind: MappingKind; name: string }) {
  const entries = allEntries.value.map((e) => ({ ...e }))
  if (entries.some((e) => e.alias === parsed.name && e.kind === parsed.kind)) {
    ElMessage.info(`映射「${parsed.name}」已存在`)
    return
  }
  entries.push({ alias: parsed.name, kind: parsed.kind, name: parsed.name, value: '' })
  commit(entries)
  ElMessage.success(`已新增变量：${parsed.name}`)
}

/** 拖到已有行：只替换对象名（保留变量名，也不动所在分类 —— 分类决定行在列表里的位置） */
function onRowDrop(event: DragEvent, i: number) {
  dropRow.value = -1
  const parsed = parseDrop(event)
  if (!parsed) return
  const entries = allEntries.value.map((e) => ({ ...e }))
  const target = entries[i]
  if (!target) return
  // 分类（kind）只用于列表分桶，不参与生成（生成按 alias → name 解析），改它会把整行挪到别的桶里
  target.name = parsed.name
  commit(entries)
  ElMessage.success(`变量「${target.alias}」已替换对象为：${parsed.name}`)
}

/** 拖拽变量到别处：以变量名为文本载荷（生成时对照映射表解析为对象名） */
function onRowDragStart(event: DragEvent, entry: MappingEntry) {
  if (!event.dataTransfer) return
  event.dataTransfer.effectAllowed = 'copy'
  event.dataTransfer.setData('text/plain', entry.alias || entry.name)
  event.dataTransfer.setData(
    'application/x-mapping',
    JSON.stringify({ alias: entry.alias, name: entry.name, kind: entry.kind }),
  )
}

function addEntry() {
  const entries = allEntries.value.map((e) => ({ ...e }))
  entries.push({ alias: '', kind: 'signal', name: '', value: '' })
  commit(entries)
}

function removeEntry(i: number) {
  const entries = allEntries.value.map((e) => ({ ...e }))
  entries.splice(i, 1)
  // 选中态里的下标跟着左移，避免删一行后选中错位
  selRows.value = selRows.value.filter((x) => x !== i).map((x) => (x > i ? x - 1 : x))
  if (anchorRow > i) anchorRow -= 1
  else if (anchorRow === i) anchorRow = -1
  commit(entries)
}
</script>

<style scoped>
.mapping-manager {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}
.mm-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 6px 10px;
  border-bottom: 1px solid #ebeef5;
  flex-shrink: 0;
}
.mm-hint {
  font-size: 11px;
  color: #a8abb2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mm-list {
  flex: 1;
  overflow-y: auto;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.mm-row-head {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #909399;
  padding: 2px 2px;
}
.mm-row {
  display: flex;
  align-items: center;
  gap: 4px;
  border-radius: 4px;
  transition: background 0.15s;
}
.mm-row.drop-over {
  background: #ecf5ff;
  outline: 1px dashed var(--el-color-primary);
}
/* 选中行：右键可对整批选中项做「设为全局 / 取消全局」 */
.mm-row.mm-row-active {
  background: #ecf5ff;
  box-shadow: inset 0 0 0 1px var(--el-color-primary);
  border-radius: 4px;
}
.mm-col {
  flex: 1;
  min-width: 0;
}
.mm-col-op {
  width: 24px;
  flex-shrink: 0;
}
/* 全局对象标记：琥珀色小胶囊 */
.mm-global {
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
.mm-drag {
  width: 16px;
  flex-shrink: 0;
  text-align: center;
  color: #c0c4cc;
  cursor: grab;
  user-select: none;
}
.mm-drag:hover {
  color: var(--el-color-primary);
}
.mm-drag-sp {
  width: 16px;
  flex-shrink: 0;
}
.mm-empty {
  text-align: center;
  color: #c0c4cc;
  font-size: 12px;
  padding: 16px 0;
}
</style>

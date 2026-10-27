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
        <span
          class="mm-col mm-sortable"
          :class="{ 'mm-sort-active': sortKey === 'alias' }"
          title="点击按变量名排序（再点切换升/降序）"
          @click="toggleSort('alias')"
        >变量名<span class="mm-sort-mark">{{ sortMark('alias') }}</span></span>
        <span
          class="mm-col mm-sortable"
          :class="{ 'mm-sort-active': sortKey === 'name' }"
          title="点击按对象名排序（再点切换升/降序）"
          @click="toggleSort('name')"
        >对象<span class="mm-sort-mark">{{ sortMark('name') }}</span></span>
        <span class="mm-col-op"></span>
      </div>
      <div
        v-for="(e, i) in allEntries"
        :key="keyOf(e)"
        class="mm-row"
        :class="{ 'drop-over': dropRow === i, 'mm-row-active': isRowSelected(i) }"
        @dragover.prevent="dropRow = i"
        @dragleave="dropRow = -1"
        @drop.prevent.stop="onRowDrop($event, i)"
        @click="onRowClick(i, $event)"
        @contextmenu.prevent.stop="openMenu($event, i)"
      >
        <span class="mm-drag" draggable="true" title="拖拽变量到步骤/参数" @dragstart="onRowDragStart($event, e)">⠿</span>
        <span v-if="e.global" class="mm-global" title="全局对象：设为全局后自动同步到所有分组的映射表">全局</span>
        <el-input
          v-model="e.alias"
          size="small"
          placeholder="变量名"
          class="mm-col"
          :ref="(el: any) => setAliasInputEl(keyOf(e), el)"
          @focus="beginEdit"
          @blur="endEdit"
          @change="commit(allEntries)"
        />
        <el-input
          v-model="e.name"
          size="small"
          placeholder="对象"
          class="mm-col"
          @focus="beginEdit"
          @blur="endEdit"
          @change="commit(allEntries)"
        />
        <el-button size="small" :icon="Close" text class="mm-col-op" @click.stop="removeEntry(i)" />
      </div>
      <div v-if="!allEntries.length" class="mm-empty">暂无映射，拖入对象或点「新增变量」</div>
    </div>
    <CtxMenu ref="ctxMenu" @select="onMenuSelect" />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
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
    // 已带「全局」标记的项再点「设为全局」会被过滤成空操作，所以单独给一个发布入口：
    // 以当前分组这一份为准，覆盖其它分组的同别名条目（修漂移就靠它）
    items.push({ key: 'republish', label: list.length > 1 ? `重新发布到所有分组（${globals} 条）` : '重新发布到所有分组' })
    items.push({ key: 'unglobal', label: list.length > 1 ? `取消全局（${globals} 条）` : '取消全局' })
  }
  ctxMenu.value?.open(e, items, list)
}
function onMenuSelect(key: string, payload: unknown) {
  const list = (payload as MappingEntry[]) || []
  if (!list.length) return
  if (key === 'global') emit('toggle-global', list.filter((x) => !x.global), true)
  else if (key === 'republish') emit('toggle-global', list, true)
  else if (key === 'unglobal') emit('toggle-global', list.filter((x) => x.global), false)
}

const kinds: Array<{ label: string; value: MappingKind }> = [
  { label: '信号', value: 'signal' },
  { label: 'DTC', value: 'dtc' },
  { label: '报文', value: 'message' },
  { label: '环境变量', value: 'envvar' },
  { label: 'A2L', value: 'a2l' },
]

// ===== 表头点击排序（按「变量名 / 对象」排序）=====
/** 当前排序列：'' = 保持原顺序（先按分类分桶） */
const sortKey = ref<'' | 'alias' | 'name'>('')
const sortAsc = ref(true)

/** 按当前排序列排序（不改动入参；未排序时原样返回） */
function sortEntries(list: MappingEntry[]): MappingEntry[] {
  const key = sortKey.value
  if (!key) return list
  const dir = sortAsc.value ? 1 : -1
  return [...list].sort(
    (a, b) => dir * String(a[key] ?? '').localeCompare(String(b[key] ?? ''), 'zh-Hans-CN', { numeric: true }),
  )
}

/** 点击表头：同一列再点切换升/降序，点另一列则从升序开始 */
function toggleSort(key: 'alias' | 'name') {
  if (sortKey.value === key) {
    sortAsc.value = !sortAsc.value
  } else {
    sortKey.value = key
    sortAsc.value = true
  }
  // 排序后行下标全变，清掉行选中态，避免右键「设为全局」作用到别的行
  selRows.value = []
  anchorRow = -1
}

/** 表头排序标记：▲ 升序 / ▼ 降序 / ⇅ 未按该列排序 */
function sortMark(key: 'alias' | 'name'): string {
  if (sortKey.value !== key) return '⇅'
  return sortAsc.value ? '▲' : '▼'
}

// ===== 行稳定标识（v-for 的 key）=====
// 用 WeakMap 给每条映射对象分配运行时 id：不写进对象、不会落库污染配置。
// 若用数组下标作 key，排序开启时输入变量名会实时重排，Vue 按下标复用 DOM，
// 焦点留在原 DOM 元素上、绑定的却已是另一条数据，后续输入就会写进别的变量。
const entryIds = new WeakMap<MappingEntry, string>()
let entryIdSeq = 0
function keyOf(e: MappingEntry): string {
  let id = entryIds.get(e)
  if (!id) {
    id = `map-${++entryIdSeq}`
    entryIds.set(e, id)
  }
  return id
}

// ===== 编辑期冻结排序 =====
/** 进入编辑时记下的显示顺序（行 id 列表）；非编辑态为 null，恢复实时排序 */
const frozenIds = ref<string[] | null>(null)
function beginEdit() {
  frozenIds.value = allEntries.value.map((e) => keyOf(e))
}
function endEdit() {
  frozenIds.value = null
}

const allEntries = computed<MappingEntry[]>(() => {
  const out: MappingEntry[] = []
  for (const k of kinds) {
    out.push(...props.mapping[bucketOf(k.value)])
  }
  // 编辑中：沿用进入编辑那一刻的顺序，避免「边输入边排序」把光标所在行挪走
  const frozen = frozenIds.value
  if (frozen) {
    const pos = new Map(frozen.map((id, idx) => [id, idx]))
    const rank = (e: MappingEntry) => (pos.has(keyOf(e)) ? pos.get(keyOf(e))! : Number.MAX_SAFE_INTEGER)
    return [...out].sort((a, b) => rank(a) - rank(b))
  }
  return sortEntries(out)
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
  // 直接复用对象引用（不再逐个浅拷贝）：这样 WeakMap 里的行 id 保持不变，
  // v-for 的 key 稳定，提交后焦点不会因行被重建而丢失。
  for (const e of entries) {
    next[bucketOf(e.kind)].push(e)
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
  const entries = [...allEntries.value]
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
  const entries = [...allEntries.value]
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

async function addEntry() {
  const entries = [...allEntries.value]
  const created: MappingEntry = { alias: '', kind: 'signal', name: '', value: '' }
  entries.push(created)
  commit(entries)
  // 新增后自动聚焦新行的「变量名」，省掉一次点击（接着就能直接输入）。
  // 按行 id 定位而不是行下标：排序开启时新行（变量名/对象都为空）落位会变，下标会错位。
  await nextTick()
  focusAliasInput(keyOf(created))
}

/** 变量名输入框实例（按行 id 存）：新增行后用它自动聚焦 */
const aliasInputEls = new Map<string, any>()
function setAliasInputEl(id: string, el: any) {
  if (el) aliasInputEls.set(id, el)
  else aliasInputEls.delete(id)
}
function focusAliasInput(id: string | null) {
  if (!id) return
  nextTick(() => {
    const inst = aliasInputEls.get(id)
    const input = inst?.input || inst?.$el?.querySelector?.('input')
    if (input && typeof input.focus === 'function') {
      input.focus()
      input.select?.()
    }
  })
}

function removeEntry(i: number) {
  const entries = [...allEntries.value]
  const removed = entries[i]
  entries.splice(i, 1)
  // 选中态里的下标跟着左移，避免删一行后选中错位
  selRows.value = selRows.value.filter((x) => x !== i).map((x) => (x > i ? x - 1 : x))
  if (anchorRow > i) anchorRow -= 1
  else if (anchorRow === i) anchorRow = -1
  commit(entries)
  // 删除后给个明确回执：原来静默删除，误点时看不出来
  if (removed) ElMessage.success(`已删除映射：${removed.alias || removed.name || '未命名'}`)
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
/* 可点击排序的表头：悬停/生效时高亮，右侧跟一个 ▲/▼/⇅ 标记 */
.mm-sortable {
  cursor: pointer;
  user-select: none;
}
.mm-sortable:hover,
.mm-sort-active {
  color: var(--el-color-primary);
}
.mm-sort-mark {
  margin-left: 2px;
  font-size: 10px;
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

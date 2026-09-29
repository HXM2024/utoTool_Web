<template>
  <div class="mapping-manager">
    <div class="mm-header">
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
        :class="{ 'drop-over': dropRow === i }"
        @dragover.prevent="dropRow = i"
        @dragleave="dropRow = -1"
        @drop.prevent.stop="onRowDrop($event, i)"
      >
        <span class="mm-drag" draggable="true" title="拖拽变量到步骤/参数" @dragstart="onRowDragStart($event, e)">⠿</span>
        <el-input v-model="e.alias" size="small" placeholder="变量名" class="mm-col" />
        <el-input v-model="e.name" size="small" placeholder="对象" class="mm-col" />
        <el-button size="small" :icon="Close" text class="mm-col-op" @click="removeEntry(i)" />
      </div>
      <div v-if="!allEntries.length" class="mm-empty">暂无映射，拖入对象或点「新增变量」</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Plus, Close } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import type { MappingEntry, MappingKind, ObjectMapping } from '@/types/functionGraph'

const props = defineProps<{
  mapping: ObjectMapping
}>()
const emit = defineEmits<{
  (e: 'update:mapping', m: ObjectMapping): void
}>()

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
  padding: 6px 10px;
  border-bottom: 1px solid #ebeef5;
  flex-shrink: 0;
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
.mm-col {
  flex: 1;
  min-width: 0;
}
.mm-col-op {
  width: 24px;
  flex-shrink: 0;
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

<template>
  <div class="function-library">
    <div class="library-header">
      <div class="header-left">
        <span v-if="parseError" class="parse-err">{{ parseError }}</span>
        <span v-else-if="functions.length" class="parse-count">共 {{ functions.length }} 个函数</span>
        <span v-else class="parse-count">无函数</span>
      </div>
      <div class="header-right">
        <span class="library-file">TestFunction.cin</span>
        <el-radio-group v-model="viewMode" size="small" class="view-switch">
          <el-radio-button value="cards">函数卡片</el-radio-button>
          <el-radio-button value="source">源码编辑</el-radio-button>
        </el-radio-group>
        <el-button
          v-if="viewMode === 'source'"
          type="success"
          size="small"
          :icon="Check"
          :loading="saving"
          @click="onSaveSource"
        >保存</el-button>
        <el-button
          v-if="viewMode === 'cards'"
          size="small"
          :icon="RefreshRight"
          :loading="parsing"
          @click="doParse"
        >重新解析</el-button>
      </div>
    </div>

    <!-- 卡片视图 -->
    <div v-if="viewMode === 'cards'" class="cards-view">

      <!-- 搜索 + 分类过滤 -->
      <div class="filter-bar">
        <el-input
          v-model="searchKey"
          size="small"
          placeholder="搜索函数名/分类"
          clearable
          data-shortcut-search
          class="filter-search"
        >
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-select
          v-if="categories.length"
          v-model="categoryFilter"
          size="small"
          placeholder="分类"
          clearable
          class="filter-cat"
        >
          <el-option
            v-for="c in categories"
            :key="c"
            :label="categoryLabel(c) + ' (' + categoryCount(c) + ')'"
            :value="c"
          />
        </el-select>
        <el-button size="small" :icon="Plus" @click="addCustomCard" title="新建自定义卡片" />
      </div>

      <!-- 函数卡片列表 -->
      <div class="function-list">
        <div
          v-for="(fn, idx) in filteredFunctions"
          :key="fn.name + '|' + fn.signature + '|' + idx"
          class="func-card"
          :class="{ 'is-custom': fn.isCustom }"
          draggable="true"
          @dragstart="onFuncDragStart($event, fn)"
          @dblclick="onFuncCardDblClick(fn)"
        >
          <div class="func-card-head">
            <el-tag v-if="fn.isCustom" type="warning" size="small" effect="light" class="func-cat">自定义</el-tag>
            <el-tag
              v-else-if="fn.category"
              :type="categoryTagType(fn.category)"
              size="small"
              effect="light"
              class="func-cat"
              :title="fn.builtin ? '内置共用函数（来自 ArrayFuncTest.cin 模板）' : ''"
            >
              {{ categoryLabel(fn.category) }}
            </el-tag>
            <span v-if="fn.return_type" class="func-ret">{{ fn.return_type }}</span>
            <span class="func-name" :title="fn.description || fn.signature">
              {{ fn.name }}<span class="fn-args">({{ argList(fn) }})</span>
            </span>
            <template v-if="fn.isCustom">
              <span class="card-mini-btn" title="新增参数并编辑" @click.stop="openCustomEdit(fn, true)">＋参数</span>
              <span class="card-mini-btn" title="编辑卡片" @click.stop="openCustomEdit(fn)">编辑</span>
            </template>
            <el-icon v-if="fn.isCustom" class="card-del" @click.stop="removeCustomCard(fn)"><Close /></el-icon>
          </div>
        </div>
        <div v-if="!filteredFunctions.length && functions.length" class="empty-tip">
          搜索「{{ searchKey }}」在「{{ categoryLabel(categoryFilter) || '全部分类' }}」没有匹配
        </div>
        <div v-if="!functions.length && !parsing && !parseError" class="empty-tip">
          暂无函数，请切换到「源码编辑」编辑 TestFunction.cin
        </div>
      </div>
    </div>

    <!-- 源码编辑视图 -->
    <div v-else class="source-view">
      <div class="library-tip">此处编辑的 CAPL 函数将作为 TestFunction.cin 并 #include 到所有 .can 文件</div>
      <div class="code-editor-wrap">
        <div class="code-gutter" ref="gutterRef">
          <span v-for="n in lineCount" :key="n">{{ n }}</span>
        </div>
        <textarea
          ref="textareaRef"
          v-model="code"
          class="code-textarea"
          spellcheck="false"
          @scroll="onScroll"
          @change="doParseDebounced"
          @blur="doParseDebounced"
        />
      </div>
    </div>

    <!-- 函数详情弹窗 -->
    <el-dialog v-model="detailVisible" :title="detailFn?.name || ''" width="640px" append-to-body>
      <template v-if="detailFn">
        <div class="detail-meta">
          <el-tag v-if="detailFn.isCustom" size="small" type="warning">自定义</el-tag>
          <el-tag v-else-if="detailFn.category" size="small" :type="categoryTagType(detailFn.category)">
            分类：{{ categoryLabel(detailFn.category) }}
          </el-tag>
          <span v-if="detailFn.return_type" class="detail-ret">返回：{{ detailFn.return_type }}</span>
        </div>
        <div class="detail-signature"><code>{{ detailFn.signature }}</code></div>
        <div v-if="detailFn.description" class="detail-desc">
          <div class="detail-label">描述</div>
          <pre class="detail-desc-content">{{ detailFn.description }}</pre>
        </div>
        <div v-if="detailFn.params.length" class="detail-params">
          <div class="detail-label">参数</div>
          <table class="detail-param-table">
            <thead>
              <tr><th>名称</th><th>类型</th><th>描述</th></tr>
            </thead>
            <tbody>
              <tr v-for="(p, i) in detailFn.params" :key="i">
                <td class="pp-name">{{ p.name || '-' }}</td>
                <td class="pp-type"><code>{{ p.type || '-' }}</code></td>
                <td class="pp-desc">{{ p.desc || '-' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="detail-label">函数源码</div>
        <pre class="detail-source">{{ detailFn.source }}</pre>
      </template>
      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
        <el-button type="primary" @click="copyAndClose(detailFn!)">复制名称</el-button>
      </template>
    </el-dialog>

    <!-- 自定义函数卡片编辑（可增删参数） -->
    <el-dialog v-model="customEditVisible" title="编辑自定义函数卡片" width="620px" append-to-body>
      <div v-if="customDraft" class="ce-form">
        <div class="ce-line">
          <span class="ce-label">名称</span>
          <el-input v-model="customDraft.name" size="small" placeholder="函数名" />
          <span class="ce-label">返回类型</span>
          <el-input v-model="customDraft.return_type" size="small" placeholder="void" style="width: 110px" />
        </div>
        <div class="ce-line">
          <span class="ce-label">说明</span>
          <el-input v-model="customDraft.description" size="small" placeholder="卡片描述" />
        </div>

        <div class="ce-params-head">
          <span class="ce-label">参数</span>
          <el-button size="small" text type="primary" @click="addDraftParam">＋ 参数</el-button>
        </div>
        <div v-for="(p, i) in customDraft.params" :key="i" class="ce-param-row">
          <el-input v-model="p.type" size="small" placeholder="类型" style="width: 120px" />
          <el-input v-model="p.name" size="small" placeholder="参数名" style="width: 150px" />
          <el-input v-model="p.desc" size="small" placeholder="说明（可选）" />
          <el-icon class="ce-del" title="删除参数" @click="customDraft.params.splice(i, 1)"><Close /></el-icon>
        </div>
        <div v-if="!customDraft.params.length" class="ce-empty">暂无参数，点击「＋ 参数」添加</div>

        <div class="ce-params-head">
          <span class="ce-label">代码模板</span>
          <span class="ce-hint">用 <code>&#123;&#123;参数名&#125;&#125;</code> 引用参数值</span>
        </div>
        <el-input v-model="customDraft.body" type="textarea" :rows="7" size="small" spellcheck="false" />

        <div class="ce-sign">签名：<code>{{ draftSignature }}</code></div>
      </div>
      <template #footer>
        <el-button @click="customEditVisible = false">取消</el-button>
        <el-button type="primary" @click="saveCustomCard">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * Function 模块的函数库组件（参照 SanbaoFunctionLibrary 模式）。
 * - 卡片视图：解析后的函数 + 用户自定义卡片，支持搜索/分类过滤/拖拽到工况或步骤
 * - 源码视图：编辑 TestFunction.cin 全局函数库
 * - 双击卡片查看函数详情（签名/参数/源码）
 * - 拖拽函数卡片写入 application/x-mm-func（拖成步骤）与 application/x-func-card（拖成工况卡片）
 */
import { ref, computed, watch, onMounted } from 'vue'
import { Check, RefreshRight, Search, Plus, Close } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getGlobalLibrary, saveGlobalLibrary, parseFunctions } from '@/api/function'
import { genId, FUNC_CARD_MIME } from '@/types/functionGraph'
import type { Card } from '@/types/functionGraph'

/** 后端 parse_capl_functions 返回的函数定义结构 */
export interface FunctionParam {
  name: string
  type: string
  desc: string
}
export interface ParsedFunction {
  name: string
  return_type: string
  category: string
  description: string
  params: FunctionParam[]
  signature: string
  source: string
  /** 前端标记：是否为用户自定义卡片 */
  isCustom?: boolean
  /** 后端标记：是否为内置共用函数（来自 ArrayFuncTest.cin 模板） */
  builtin?: boolean
  /** 自定义卡片的代码模板 */
  body?: string
}

const emit = defineEmits<{
  /** 函数库代码变更（源码编辑后触发，父组件可同步保存） */
  (e: 'update:code', code: string): void
  /** 保存全局库后触发 */
  (e: 'saved', functionLibrary: string, stepLibrary: any[]): void
}>()

// ==================== 状态 ====================
const viewMode = ref<'cards' | 'source'>('cards')
const code = ref('')
const saving = ref(false)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const gutterRef = ref<HTMLElement | null>(null)

const functions = ref<ParsedFunction[]>([])
/** 用户自定义卡片（独立于解析的函数，持久化到 step_library） */
const customCards = ref<ParsedFunction[]>([])
// 自定义卡片编辑：draft 为副本，保存时写回 customEditTarget
const customEditVisible = ref(false)
const customDraft = ref<ParsedFunction | null>(null)
const customEditTarget = ref<ParsedFunction | null>(null)
const draftSignature = computed(() => (customDraft.value ? buildCustomSignature(customDraft.value) : ''))

/** 由名称/返回类型/参数生成签名 */
function buildCustomSignature(c: {
  name: string
  return_type?: string
  params: FunctionParam[]
}): string {
  const ret = (c.return_type || 'void').trim()
  const args = (c.params || [])
    .map((p) => [p.type?.trim(), p.name?.trim()].filter(Boolean).join(' '))
    .filter(Boolean)
    .join(', ')
  return `${ret} ${(c.name || '').trim()}(${args})`
}
function addDraftParam() {
  if (!customDraft.value) return
  customDraft.value.params.push({ name: '', type: '', desc: '' })
}
function openCustomEdit(fn: ParsedFunction, addParam = false) {
  if (!fn.isCustom) {
    showFuncDetail(fn)
    return
  }
  customEditTarget.value = fn
  customDraft.value = {
    ...fn,
    params: (fn.params || []).map((p) => ({ ...p })),
  }
  if (addParam) customDraft.value.params.push({ name: '', type: '', desc: '' })
  customEditVisible.value = true
}
async function saveCustomCard() {
  const draft = customDraft.value
  const target = customEditTarget.value
  if (!draft || !target) return
  const name = (draft.name || '').trim() || 'Custom'
  const params = (draft.params || []).filter((p) => p.name?.trim() || p.type?.trim())
  target.name = name
  target.return_type = (draft.return_type || '').trim()
  target.description = draft.description || ''
  target.params = params.map((p) => ({ name: p.name?.trim() || '', type: p.type?.trim() || '', desc: p.desc || '' }))
  target.body = draft.body || ''
  target.source = draft.body || ''
  target.signature = buildCustomSignature(target)
  customEditVisible.value = false
  ElMessage.success(`已保存自定义卡片 ${target.name}`)
  await persistCustomCards()
}
/** 双击：自定义卡片打开编辑器，其余显示详情 */
function onFuncCardDblClick(fn: ParsedFunction) {
  if (fn.isCustom) openCustomEdit(fn)
  else showFuncDetail(fn)
}
const parsing = ref(false)
const parseError = ref('')

const searchKey = ref('')
const categoryFilter = ref('')

const detailVisible = ref(false)
const detailFn = ref<ParsedFunction | null>(null)

/** 合并后的函数列表（解析函数 + 自定义卡片） */
const allFunctions = computed(() => [...customCards.value, ...functions.value])

const lineCount = computed(() => (code.value ? code.value.split('\n').length : 1))

const categories = computed(() => {
  const set = new Set<string>()
  for (const f of allFunctions.value) {
    if (f.category && !f.isCustom) set.add(f.category)
  }
  return Array.from(set)
})
function categoryCount(c: string) {
  return allFunctions.value.filter((f) => f.category === c).length
}
function categoryLabel(c: string) {
  if (!c) return '未分类'
  const map: Record<string, string> = {
    FUN: '功能', Check: '检查', Control: '控制', Bus: '总线',
    arraryFunc: '数组工具', ReadDTCFunc: '读DTC', Common: '共用',
  }
  return map[c] ?? c
}
function categoryTagType(c: string): '' | 'success' | 'warning' | 'danger' | 'info' | 'primary' {
  const map: Record<string, any> = {
    FUN: 'success', Check: 'danger', Control: 'primary', Bus: 'warning',
    arraryFunc: 'info', ReadDTCFunc: 'warning', Common: 'primary',
  }
  return map[c] ?? 'info'
}
function argList(fn: ParsedFunction): string {
  return fn.params.map((p) => p.name || '_').join(', ')
}

const filteredFunctions = computed(() => {
  const key = searchKey.value.trim().toLowerCase()
  const cat = categoryFilter.value
  return allFunctions.value.filter((f) => {
    if (cat && !f.isCustom && f.category !== cat) return false
    if (!key) return true
    return (
      f.name.toLowerCase().includes(key) ||
      categoryLabel(f.category).toLowerCase().includes(key) ||
      f.signature.toLowerCase().includes(key)
    )
  })
})

// ==================== 加载全局库 ====================
async function loadGlobalLibrary() {
  try {
    const res: any = await getGlobalLibrary()
    const data = res?.data?.data ?? res?.data ?? {}
    code.value = data.function_library || ''
    // 恢复自定义卡片
    const steps = Array.isArray(data.step_library) ? data.step_library : []
    customCards.value = steps.map((s: any) => {
      const params = Array.isArray(s.params)
        ? s.params.map((p: any) => ({ name: p?.name || '', type: p?.type || '', desc: p?.desc || '' }))
        : []
      const card: ParsedFunction = {
        name: s.name || 'Custom',
        return_type: s.return_type || '',
        category: '',
        description: s.description || '',
        params,
        signature: '',
        source: s.code || '',
        isCustom: true,
        body: s.code || '',
      }
      card.signature = buildCustomSignature(card)
      return card
    })
    doParseDebounced()
  } catch (e: any) {
    ElMessage.warning('加载全局函数库失败：' + (e?.message || String(e)))
  }
}

// ==================== 解析 ====================
let _parseTimer: any = null
function doParseDebounced() {
  if (_parseTimer) clearTimeout(_parseTimer)
  _parseTimer = setTimeout(doParse, 400)
}
async function doParse() {
  const src = code.value.trim()
  parsing.value = true
  parseError.value = ''
  try {
    // 源码为空也请求一次：后端会返回内置共用函数（ArrayFuncTest.cin 模板）
    const res: any = await parseFunctions(src)
    const data = res?.data?.data ?? res?.data ?? res ?? {}
    functions.value = Array.isArray(data.functions) ? data.functions : []
    if (!functions.value.length && src) {
      parseError.value = '未解析到函数，请检查语法'
    }
  } catch (e: any) {
    parseError.value = '解析失败：' + (e?.message || String(e))
    functions.value = []
  } finally {
    parsing.value = false
  }
}

// ==================== 保存源码 ====================
function onScroll() {
  const ta = textareaRef.value
  if (!ta) return
  if (gutterRef.value) gutterRef.value.scrollTop = ta.scrollTop
}
/** 组装持久化用的 step_library（自定义卡片 → 后端字段） */
function buildStepLibrary() {
  return customCards.value.map((c) => ({
    name: c.name,
    code: c.body || c.source || '',
    description: c.description || '',
    return_type: c.return_type || '',
    params: (c.params || []).map((p) => ({ name: p.name || '', type: p.type || '', desc: p.desc || '' })),
  }))
}
/**
 * 卡片视图增删改后立即落盘。
 * 原先只有「源码编辑 → 保存」才写后端，卡片视图没有保存入口：点 + 新建的自定义函数
 * 只存在内存里，一退出编辑器就丢，再进来 loadGlobalLibrary() 从后端读到的 step_library
 * 还是旧的（空），函数看起来就「消失」了。
 */
async function persistCustomCards() {
  try {
    const stepLibrary = buildStepLibrary()
    await saveGlobalLibrary({ function_library: code.value, step_library: stepLibrary })
    emit('saved', code.value, stepLibrary)
  } catch (e: any) {
    ElMessage.error('保存自定义函数失败：' + (e?.message || String(e)))
  }
}
async function onSaveSource() {
  saving.value = true
  try {
    const stepLibrary = buildStepLibrary()
    await saveGlobalLibrary({ function_library: code.value, step_library: stepLibrary })
    emit('update:code', code.value)
    emit('saved', code.value, stepLibrary)
    ElMessage.success('函数库已保存')
    doParse()
  } catch (e: any) {
    ElMessage.error('保存失败：' + (e?.message || String(e)))
  } finally {
    saving.value = false
  }
}

// ==================== 自定义卡片 ====================
async function addCustomCard() {
  const idx = customCards.value.length + 1
  const name = `Custom_${idx}`
  const card: ParsedFunction = {
    name,
    return_type: 'void',
    category: '',
    description: '自定义函数卡片',
    params: [],
    signature: '',
    source: `void ${name}()\n{\n  // TODO: 自定义代码\n}\n`,
    isCustom: true,
    body: `void ${name}()\n{\n  // TODO: 自定义代码\n}\n`,
  }
  card.signature = buildCustomSignature(card)
  customCards.value.unshift(card)
  ElMessage.success(`已新建自定义卡片 ${name}`)
  await persistCustomCards()
}
function removeCustomCard(fn: ParsedFunction) {
  const i = customCards.value.findIndex((c) => c.name === fn.name && c.isCustom)
  if (i < 0) return
  // 自定义卡片会被引用到卡片/步骤里，删掉后生成时找不到该函数 → 先确认再删
  ElMessageBox.confirm(
    `确认删除自定义卡片「${fn.name}」？\n若已被卡片或步骤引用，生成时会出现找不到该函数的问题。`,
    '删除自定义卡片',
    { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
  )
    .then(async () => {
      customCards.value.splice(i, 1)
      ElMessage.success(`已删除自定义卡片 ${fn.name}`)
      await persistCustomCards()
    })
    .catch(() => {
      /* 用户取消 */
    })
}

// ==================== 拖拽到画布 ====================
/**
 * 拖拽函数卡片时写入两种载荷：
 * - application/x-mm-func：函数名/参数/源码，供「编辑」面板拖成函数调用步骤；
 * - application/x-func-card：卡片 JSON，供「工况」画布直接拖成卡片节点。
 */
function onFuncDragStart(event: DragEvent, fn: ParsedFunction) {
  if (!event.dataTransfer) return
  event.dataTransfer.effectAllowed = 'copy'
  const body = fn.isCustom ? fn.body || fn.source : fn.source
  const payload = {
    name: fn.name,
    kind: fn.isCustom ? 'custom' : 'func',
    params: fn.params.map((p) => p.name),
    body,
  }
  event.dataTransfer.setData('application/x-mm-func', JSON.stringify(payload))
  event.dataTransfer.setData(FUNC_CARD_MIME, JSON.stringify(funcToCard(fn)))
  event.dataTransfer.setData('text/plain', fn.name)
  ElMessage({
    message: `拖拽 ${fn.name}(${fn.params.length} 参数)到工况或步骤`,
    type: 'info',
    duration: 800,
    offset: 40,
  })
}

/**
 * 函数 → 工况卡片：卡片名取函数名，内容为单步「调用该函数」，参数留空待填。
 * 统一按「故障注入」归类（类型可在卡片编辑器里改），不隐式追加等待步骤。
 * refId 置空串：拖入后是独立卡片、不引用卡片库，避免画布显示误导性的「来自卡片库引用」标记
 * （cardToNode 用 `card.refId ?? card.id` 兜底，空串不会被兜底覆盖）。
 */
function funcToCard(fn: ParsedFunction): Card {
  return {
    id: genId('card'),
    type: 'inject',
    name: fn.name,
    description: fn.description || fn.signature,
    refId: '',
    steps: [
      {
        id: genId('step'),
        kind: 'call',
        fun: fn.name,
        args: fn.params.map((p) => ({ key: p.name || '', value: '' })),
        indent: 0,
      },
    ],
  }
}

// ==================== 详情弹窗 ====================
function showFuncDetail(fn: ParsedFunction) {
  detailFn.value = fn
  detailVisible.value = true
}
function copyAndClose(fn: ParsedFunction) {
  try {
    navigator.clipboard?.writeText(fn.name)
  } catch { /* ignore */ }
  ElMessage.info(`已复制函数名「${fn.name}」，请拖拽卡片到画布`)
  detailVisible.value = false
}

// ==================== 生命周期 ====================
watch(code, (v) => {
  emit('update:code', v)
})

onMounted(() => {
  loadGlobalLibrary()
})
</script>

<style lang="scss">
.function-library {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-card, #fff);
  border-radius: 8px;
  padding: 8px;
  overflow: hidden;
}

.library-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
  flex-wrap: wrap;
  flex-shrink: 0;
}
.header-left {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}
.library-file {
  font-size: 11px;
  color: var(--text-color-secondary, #909399);
  font-family: 'Consolas', 'Monaco', monospace;
  background: var(--bg-page, #f5f7fa);
  padding: 2px 6px;
  border-radius: 4px;
}
.header-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 6px;
}
.view-switch {
  transform: scale(0.92);
  transform-origin: right center;
}

/* ====== 卡片视图 ====== */
.cards-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}
.parse-count {
  color: var(--color-primary, var(--el-color-primary));
  font-weight: 500;
  font-size: 11px;
  white-space: nowrap;
}
.parse-err {
  color: var(--color-danger, #f56c6c);
  font-weight: 500;
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.filter-bar {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
  flex-shrink: 0;
}
.filter-search { flex: 1; min-width: 0; }
.filter-cat {
  width: 120px;
  flex-shrink: 0;
}

.function-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-right: 2px;
}

.func-card {
  background: var(--bg-page, #f5f7fa);
  border: 1px solid var(--border-color-light, #e4e7ed);
  border-radius: 8px;
  padding: 6px 8px;
  cursor: grab;
  transition: border-color 0.18s, box-shadow 0.18s, transform 0.1s;
  &:hover {
    border-color: var(--color-primary, var(--el-color-primary));
    box-shadow: 0 2px 10px rgba(64, 158, 255, 0.12);
    transform: translateY(-1px);
  }
  &:active { cursor: grabbing; transform: scale(0.995); }
  &.is-custom {
    border-left: 3px solid #e6a23c;
  }
}
.func-card-head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 0;
  flex-wrap: wrap;
}
.func-cat {
  font-size: 10px !important;
  --el-tag-padding-horizontal: 4px !important;
  --el-tag-height: 18px !important;
}
.func-ret {
  font-size: 10px;
  font-family: 'Consolas', monospace;
  color: var(--text-color-secondary, #909399);
  background: var(--bg-card, #fff);
  padding: 0 4px;
  border-radius: 3px;
  border: 1px solid var(--border-color-lighter, #ebeef5);
}
.func-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary, #303133);
  font-family: 'Consolas', monospace;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.fn-args {
  font-size: 11px;
  font-weight: 400;
  color: var(--text-color-secondary, #909399);
}
.card-del {
  cursor: pointer;
  color: #c0c4cc;
  font-size: 12px;
  flex-shrink: 0;
  &:hover { color: #f56c6c; }
}
.card-mini-btn {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--el-color-primary);
  cursor: pointer;
  padding: 0 4px;
  border-radius: 4px;
  &:hover { background: rgba(64, 158, 255, 0.12); }
}
.ce-form { display: flex; flex-direction: column; gap: 8px; }
.ce-line { display: flex; align-items: center; gap: 8px; }
.ce-label {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--text-color-secondary, #909399);
}
.ce-params-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}
.ce-hint { font-size: 11px; color: #c0c4cc; }
.ce-hint code { color: var(--el-color-primary); background: rgba(64, 158, 255, 0.1); padding: 0 3px; border-radius: 3px; }
.ce-param-row { display: flex; align-items: center; gap: 6px; }
.ce-del {
  cursor: pointer;
  color: #c0c4cc;
  font-size: 12px;
  flex-shrink: 0;
  &:hover { color: #f56c6c; }
}
.ce-empty {
  font-size: 11px;
  color: #c0c4cc;
  padding: 2px 0 2px 2px;
}
.ce-sign {
  font-size: 12px;
  color: var(--text-color-secondary, #909399);
}
.ce-sign code { color: var(--el-color-primary); }
.func-params {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.func-param-tag {
  padding: 0 4px !important;
  display: inline-flex !important;
  gap: 4px;
  align-items: center;
  --el-tag-height: 20px !important;
  font-size: 10px !important;
}
.param-type {
  color: var(--text-color-secondary, #909399);
  opacity: 0.9;
}
.param-name {
  font-weight: 600;
  color: var(--text-primary, #303133);
}
.func-no-params {
  font-size: 10px;
  color: var(--text-color-secondary, #909399);
  font-style: italic;
  opacity: 0.7;
}
.empty-tip {
  text-align: center;
  color: var(--text-color-secondary, #909399);
  font-size: 11px;
  padding: 20px 4px;
  line-height: 1.6;
}

/* ====== 源码视图 ====== */
.source-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}
.code-editor-wrap {
  flex: 1;
  display: flex;
  overflow: hidden;
  border: 1px solid var(--border-color-light, #e4e7ed);
  border-radius: 6px;
  background: #1e1e1e;
  margin-top: 4px;
}
.code-gutter {
  display: flex;
  flex-direction: column;
  padding: 8px 6px;
  background: #252526;
  color: #858585;
  font-size: 12px;
  line-height: 1.6;
  font-family: 'Consolas', 'Monaco', monospace;
  text-align: right;
  user-select: none;
  flex-shrink: 0;
  min-width: 36px;
  overflow: hidden;
}
.code-textarea {
  flex: 1;
  border: none;
  outline: none;
  resize: none;
  padding: 8px 12px;
  background: #1e1e1e;
  color: #d4d4d4;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre;
  overflow: auto;
  tab-size: 2;
  &::-webkit-scrollbar { width: 8px; height: 8px; }
  &::-webkit-scrollbar-thumb { background: #424242; border-radius: 4px; }
  &::-webkit-scrollbar-track { background: #1e1e1e; }
}

/* ====== 详情弹窗 ====== */
.detail-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.detail-ret {
  font-size: 12px;
  font-family: 'Consolas', monospace;
  color: var(--text-color-secondary, #909399);
}
.detail-signature {
  background: var(--bg-page, #f5f7fa);
  padding: 6px 10px;
  border-radius: 4px;
  border: 1px solid var(--border-color-light, #e4e7ed);
  margin-bottom: 10px;
  code {
    font-size: 12px;
    color: var(--color-primary, var(--el-color-primary));
    word-break: break-all;
  }
}
.detail-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary, #303133);
  margin: 10px 0 6px;
}
.detail-desc-content {
  background: var(--bg-page, #f5f7fa);
  border-left: 3px solid var(--color-primary, var(--el-color-primary));
  padding: 6px 10px;
  margin: 0;
  white-space: pre-wrap;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-secondary, #606266);
}
.detail-param-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  th, td {
    border: 1px solid var(--border-color-light, #e4e7ed);
    padding: 4px 8px;
    text-align: left;
  }
  th {
    background: var(--bg-page, #f5f7fa);
    font-weight: 600;
  }
  .pp-name { color: var(--color-primary, var(--el-color-primary)); font-weight: 600; }
  .pp-type code { color: var(--text-secondary, #606266); font-size: 11px; }
  .pp-desc { color: var(--text-secondary, #606266); }
}
.detail-source {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 10px;
  border-radius: 4px;
  font-size: 11px;
  line-height: 1.6;
  max-height: 240px;
  overflow: auto;
  font-family: 'Consolas', 'Monaco', monospace;
  margin: 0;
  white-space: pre;
}
</style>

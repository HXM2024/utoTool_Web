<template>
  <div class="sanbao-function-library">
    <div class="library-header">
      <span class="library-title">函数库</span>
      <span class="library-file">TestFunction.cin</span>
      <div class="header-right">
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
          @click="onSave"
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
      <div class="library-tip">
        拖拽函数卡片到中间序列框使用
        <span v-if="parseError" class="parse-err">{{ parseError }}</span>
        <span v-else-if="functions.length" class="parse-count">共 {{ functions.length }} 个函数</span>
        <span v-else class="parse-count">无函数，请切换到「源码编辑」添加</span>
      </div>

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
      </div>

      <!-- 函数卡片列表 -->
      <div class="function-list">
        <div
          v-for="(fn, idx) in filteredFunctions"
          :key="fn.name + '|' + fn.signature + '|' + idx"
          class="func-card"
          draggable="true"
          @dragstart="onFuncDragStart($event, fn)"
          @dblclick="showFuncDetail(fn)"
        >
          <div class="func-card-head">
            <el-tag v-if="fn.category" :type="categoryTagType(fn.category)" size="small" effect="light" class="func-cat">
              {{ categoryLabel(fn.category) }}
            </el-tag>
            <span v-if="fn.return_type" class="func-ret">{{ fn.return_type }}</span>
            <span class="func-name" :title="fn.description || fn.signature">{{ fn.name }}</span>
          </div>
          <div v-if="fn.params.length" class="func-params">
            <el-tag
              v-for="(p, i) in fn.params"
              :key="i"
              size="small"
              type="info"
              effect="plain"
              class="func-param-tag"
              :title="(p.desc || p.name) + ' : ' + (p.type || 'any')"
            >
              <span class="param-type">{{ p.type || 'any' }}</span>
              <span class="param-name">{{ p.name || '_' }}</span>
            </el-tag>
          </div>
          <div v-else class="func-no-params">无参数</div>
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
        <div class="code-gutter">
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
          <el-tag v-if="detailFn.category" size="small" :type="categoryTagType(detailFn.category)">
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
        <el-button type="primary" @click="dragByButton(detailFn!); detailVisible = false">添加到序列</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { Check, RefreshRight, Search } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { parseFunctions } from '@/api/sanbao'

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
}

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{
  'update:modelValue': [string]
  save: [string]
}>()

// ==================== 状态 ====================
const viewMode = ref<'cards' | 'source'>('cards')
const code = ref(props.modelValue || '')
const saving = ref(false)
const textareaRef = ref<HTMLTextAreaElement | null>(null)

const functions = ref<ParsedFunction[]>([])
const parsing = ref(false)
const parseError = ref('')

const searchKey = ref('')
const categoryFilter = ref('')

const detailVisible = ref(false)
const detailFn = ref<ParsedFunction | null>(null)

watch(() => props.modelValue, (v) => {
  if (v !== code.value) {
    code.value = v || ''
    doParseDebounced()
  }
})
watch(code, (v) => {
  emit('update:modelValue', v)
})

const lineCount = computed(() => code.value ? code.value.split('\n').length : 1)

const categories = computed(() => {
  const set = new Set<string>()
  for (const f of functions.value) {
    if (f.category) set.add(f.category)
  }
  return Array.from(set)
})
function categoryCount(c: string) {
  return functions.value.filter((f) => f.category === c).length
}
function categoryLabel(c: string) {
  if (!c) return '未分类'
  const map: Record<string, string> = {
    FUN: '功能', Check: '检查', Control: '控制', Bus: '总线',
    arraryFunc: '数组工具', ReadDTCFunc: '读DTC',
    SignalCheck: '信号断言', ChkAssert: '背景检测', MsgCheck: '报文检测',
    Timing: '时序检测', PowerCtl: '上下电控制', BusCtl: '总线控制',
    SignalCtl: '信号操作', Diag: '诊断', EnvCfg: '环境配置',
    Utility: '共用工具', Internal: '内部函数',
  }
  return map[c] ?? c
}
function categoryTagType(c: string): '' | 'success' | 'warning' | 'danger' | 'info' | 'primary' {
  const map: Record<string, any> = {
    FUN: 'success', Check: 'danger', Control: 'primary', Bus: 'warning',
    arraryFunc: 'info', ReadDTCFunc: 'warning',
    SignalCheck: 'danger', ChkAssert: 'danger', MsgCheck: 'warning',
    Timing: 'warning', PowerCtl: 'primary', BusCtl: 'warning',
    SignalCtl: 'primary', Diag: 'info', EnvCfg: 'success',
    Utility: 'info', Internal: 'info',
  }
  return map[c] ?? 'info'
}

const filteredFunctions = computed(() => {
  const key = searchKey.value.trim().toLowerCase()
  const cat = categoryFilter.value
  return functions.value.filter((f) => {
    if (cat && f.category !== cat) return false
    if (!key) return true
    return (
      f.name.toLowerCase().includes(key) ||
      categoryLabel(f.category).toLowerCase().includes(key) ||
      f.signature.toLowerCase().includes(key)
    )
  })
})

// ==================== 解析 ====================
let _parseTimer: any = null
function doParseDebounced() {
  if (_parseTimer) clearTimeout(_parseTimer)
  _parseTimer = setTimeout(doParse, 400)
}
async function doParse() {
  const src = code.value.trim()
  if (!src) {
    functions.value = []
    parseError.value = ''
    return
  }
  parsing.value = true
  parseError.value = ''
  try {
    const res: any = await parseFunctions(src)
    const data = res?.data?.data ?? res?.data ?? res ?? {}
    functions.value = Array.isArray(data.functions) ? data.functions : []
    if (!functions.value.length) {
      parseError.value = '未解析到函数，请检查语法'
    }
  } catch (e: any) {
    parseError.value = '解析失败：' + (e?.message || String(e))
    functions.value = []
  } finally {
    parsing.value = false
  }
}
onMounted(() => {
  // 初始进入页面时，如果已有代码，尝试解析一次
  if (code.value.trim()) doParseDebounced()
})

// ==================== 保存源码 ====================
function onScroll() {
  const ta = textareaRef.value
  if (!ta) return
  const gutter = ta.previousElementSibling as HTMLElement
  if (gutter) gutter.scrollTop = ta.scrollTop
}
function onSave() {
  saving.value = true
  emit('save', code.value)
  setTimeout(() => {
    saving.value = false
    ElMessage.success('函数库已保存')
    // 保存后也刷新解析结果
    doParse()
  }, 300)
}

// ==================== 拖拽生成步骤载荷 ====================
/**
 * 把函数信息转换成和自定义步骤（custom-step）同样格式的 payload，
 * 这样 SanbaoSequenceEditor 无需新增类型判断就能直接复用 custom-step 处理逻辑。
 * code 格式：`FuncName({{p1}}, {{p2}}, ...);`
 */
function buildStepPayload(fn: ParsedFunction) {
  const paramNames = fn.params.map((p, i) => p.name || `p${i + 1}`)
  const placeholders = paramNames.map((n) => `{{${n}}}`).join(', ')
  const codeTpl = `${fn.name}(${placeholders});`
  return {
    type: 'custom-step' as const,  // 复用 SequenceEditor 的 custom-step 分支
    id: 'fn-' + fn.name + '-' + Date.now().toString(36),
    name: fn.name,
    code: codeTpl,
    params: paramNames,
    // 附加信息（不影响 SequenceEditor，仅用于扩展）
    func_meta: {
      return_type: fn.return_type,
      category: fn.category,
      signature: fn.signature,
    },
  }
}
function onFuncDragStart(event: DragEvent, fn: ParsedFunction) {
  if (!event.dataTransfer) return
  event.dataTransfer.effectAllowed = 'copy'
  const payload = buildStepPayload(fn)
  event.dataTransfer.setData('application/json', JSON.stringify(payload))
  event.dataTransfer.setData('text/plain', fn.name)
  ElMessage({
    message: `拖拽 ${fn.name}(${fn.params.length} 参数)到序列框`,
    type: 'info',
    duration: 800,
    offset: 40,
  })
}
function showFuncDetail(fn: ParsedFunction) {
  detailFn.value = fn
  detailVisible.value = true
}
/** 详情弹窗中的"添加到序列"按钮：以文本方式把名称写到剪贴板，提示用户使用拖拽 */
function dragByButton(fn: ParsedFunction) {
  // 模拟拷贝名称，提示用户使用拖拽；不直接修改 sequenceSteps（组件间不耦合）
  try {
    navigator.clipboard?.writeText(fn.name)
  } catch { /* ignore */ }
  ElMessage.info(`请拖拽函数卡片「${fn.name}」到序列框`)
}
</script>

<style lang="scss">
.sanbao-function-library {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-card);
  border-radius: 12px;
  padding: 10px;
  overflow: hidden;
}

.library-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
  flex-wrap: wrap;
}
.library-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}
.library-file {
  font-size: 11px;
  color: var(--text-color-secondary);
  font-family: 'Consolas', 'Monaco', monospace;
  background: var(--bg-page);
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
.library-tip {
  font-size: 10px;
  color: var(--text-color-secondary);
  margin-bottom: 6px;
  opacity: 0.85;
}
.parse-count {
  margin-left: 4px;
  color: var(--color-primary);
  font-weight: 500;
}
.parse-err {
  margin-left: 4px;
  color: var(--color-danger);
  font-weight: 500;
}
.filter-bar {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
}
.filter-search { flex: 1; min-width: 0; }
.filter-cat {
  width: 140px;
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
  background: var(--bg-page);
  border: 1px solid var(--border-color-light);
  border-radius: 8px;
  padding: 8px 10px;
  cursor: grab;
  transition: border-color 0.18s, box-shadow 0.18s, transform 0.1s;
  &:hover {
    border-color: var(--color-primary);
    box-shadow: 0 2px 10px rgba(64, 158, 255, 0.12);
    transform: translateY(-1px);
  }
  &:active { cursor: grabbing; transform: scale(0.995); }
}
.func-card-head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
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
  color: var(--text-color-secondary);
  background: var(--bg-card);
  padding: 0 4px;
  border-radius: 3px;
  border: 1px solid var(--border-color-lighter, #ebeef5);
}
.func-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
  font-family: 'Consolas', monospace;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
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
  color: var(--text-color-secondary);
  opacity: 0.9;
}
.param-name {
  font-weight: 600;
  color: var(--text-primary);
}
.func-no-params {
  font-size: 10px;
  color: var(--text-color-secondary);
  font-style: italic;
  opacity: 0.7;
}
.empty-tip {
  text-align: center;
  color: var(--text-color-secondary);
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
  color: var(--text-color-secondary);
}
.detail-signature {
  background: var(--bg-page);
  padding: 6px 10px;
  border-radius: 4px;
  border: 1px solid var(--border-color-light);
  margin-bottom: 10px;
  code {
    font-size: 12px;
    color: var(--color-primary);
    word-break: break-all;
  }
}
.detail-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 10px 0 6px;
}
.detail-desc-content {
  background: var(--bg-page);
  border-left: 3px solid var(--color-primary);
  padding: 6px 10px;
  margin: 0;
  white-space: pre-wrap;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-secondary);
}
.detail-param-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  th, td {
    border: 1px solid var(--border-color-light);
    padding: 4px 8px;
    text-align: left;
  }
  th {
    background: var(--bg-page);
    font-weight: 600;
  }
  .pp-name { color: var(--color-primary); font-weight: 600; }
  .pp-type code { color: var(--text-secondary); font-size: 11px; }
  .pp-desc { color: var(--text-secondary); }
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

<template>
  <div class="sanbao-view">
    <ConfigToolbar
      ref="configToolbarRef"
      module-name="sanbao"
      @refresh="onRefresh"
      @create="onCreate"
      @copy="onCopy"
      @delete="onDelete"
      @save="onSave"
      @generate="onGenerate"
      @config-change="onConfigChange"
    />

    <!-- 模块标题/描述/全局变量配置条 -->
    <div class="sanbao-meta-bar">
      <el-input v-model="moduleTitle" placeholder="模块标题" class="meta-input">
        <template #prepend>标题</template>
      </el-input>
      <el-input v-model="moduleDesc" placeholder="模块描述" class="meta-input">
        <template #prepend>描述</template>
      </el-input>
      <el-popover placement="bottom" :width="400" trigger="click">
        <template #reference>
          <el-button class="global-var-btn" :icon="Setting">全局变量</el-button>
        </template>
        <div class="global-var-pop">
          <div class="global-var-tip">每行一个 CAPL 变量声明，如：<code>int g_count = 0;</code></div>
          <el-input
            v-model="globalVarsText"
            type="textarea"
            :autosize="{ minRows: 4, maxRows: 12 }"
            placeholder="int g_count = 0;&#10;float g_voltage;&#10;char g_name[50];"
          />
        </div>
      </el-popover>
      <div class="meta-cfg-hint">
        <el-icon><Link /></el-icon>
        <span>{{ store.cfgData.cfg_dir ? 'CFG: ' + store.cfgData.cfg_dir : '未解析 CFG' }}</span>
      </div>
      <el-button class="preview-btn" :icon="View" :disabled="!sequenceSteps.length" @click="onPreview">预览</el-button>
    </div>

    <div class="sanbao-layout">
      <div class="sanbao-body" :class="{ 'with-panel': showObjectPanel }">
        <!-- 中间区：步骤库/函数库 + 序列编辑框 -->
        <div class="sanbao-main">
          <div class="col-library">
            <el-tabs v-model="libraryTab" class="library-tabs">
              <el-tab-pane label="步骤库" name="steps">
                <SanbaoStepLibrary
                  :steps="customSteps"
                  @update:steps="onStepsUpdate"
                />
              </el-tab-pane>
              <el-tab-pane label="函数库" name="functions">
                <SanbaoFunctionLibrary
                  v-model="functionLibraryCode"
                  @save="onSaveFunctionLibrary"
                />
              </el-tab-pane>
            </el-tabs>
          </div>
          <SanbaoSequenceEditor
            :steps="sequenceSteps"
            class="col-seq"
            @update:steps="sequenceSteps = $event"
          />
        </div>

        <ResizableSplitter
          direction="horizontal"
          :on-drag="onSideDrag"
          show-toggle
          @toggle="panelCollapsed = !panelCollapsed"
        />

        <!-- 右边：对象框（DBC / A2L / CDD 的 DTC） -->
        <div
          v-if="showObjectPanel && !panelCollapsed"
          class="sanbao-side"
          :style="{ width: sideWidth + 'px' }"
        >
          <ObjectPanel
            :dbc-raw="store.objMergedDbcRaw"
            :dtc-raw="store.objCddDtcRaw"
            :a2l-vars="store.objA2lVars"
            :dbc-env-vars="store.objDbcEnvVars"
            :a2l-qualifier="store.objA2lQualifier"
            @collapse="panelCollapsed = true"
          />
        </div>
        <div v-show="panelCollapsed" class="side-toggle" @click="panelCollapsed = false">
          <el-icon><ArrowLeft /></el-icon>
          <span>对象</span>
        </div>
      </div>
    </div>

    <!-- CAPL 代码预览弹窗 -->
    <el-dialog
      v-model="previewVisible"
      title="CAPL 代码预览"
      width="80%"
      top="5vh"
      :close-on-click-modal="false"
      class="preview-dialog"
    >
      <div class="preview-toolbar">
        <span class="preview-file">{{ previewFileName }}</span>
        <el-button text size="small" :icon="CopyDocument" @click="copyCapl">复制代码</el-button>
      </div>
      <div class="preview-code-block">
        <div class="preview-gutter">
          <span v-for="n in caplLineCount" :key="n">{{ n }}</span>
        </div>
        <pre class="preview-pre"><code v-html="highlightedCapl" class="hljs"></code></pre>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ArrowLeft, Link, Setting, View, CopyDocument } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import hljs from 'highlight.js/lib/core'
import cLang from 'highlight.js/lib/languages/c'
import 'highlight.js/styles/atom-one-dark.css'
import ConfigToolbar from '@/components/ConfigToolbar.vue'
import ObjectPanel from '@/components/ObjectPanel.vue'
import ResizableSplitter from '@/components/ResizableSplitter.vue'
import SanbaoStepLibrary, { type CustomStep } from '@/components/SanbaoStepLibrary.vue'
import SanbaoFunctionLibrary from '@/components/SanbaoFunctionLibrary.vue'
import SanbaoSequenceEditor, { type SequenceStep } from '@/components/SanbaoSequenceEditor.vue'
import { useModuleStore } from '@/stores/modules'
import { getConfig, saveConfig } from '@/api/config'
import { generateSanbao, getGlobalLibrary, saveGlobalLibrary } from '@/api/sanbao'
import { useResizableSize } from '@/composables/useResizableSize'

hljs.registerLanguage('c', cLang)

defineOptions({ name: 'SanbaoView' })

const store = useModuleStore()

// ==================== 状态 ====================
const currentConfig = ref('')
/** 当前内存中数据所归属的配置名（加载/切换过程中为空，用于切换前安全自动保存） */
const loadedConfig = ref('')
/** 配置切换/加载令牌：忽略过期请求，避免快速切换时数据错位 */
let configChangeToken = 0
const moduleTitle = ref('三包测试')
const moduleDesc = ref('SanBao Test Module')
const globalVarsText = ref('')
const customSteps = ref<CustomStep[]>([])
const sequenceSteps = ref<SequenceStep[]>([])

// 全局库（独立于配置，所有配置共享）
const libraryTab = ref('steps')
const functionLibraryCode = ref('')

const configToolbarRef = ref<InstanceType<typeof ConfigToolbar> | null>(null)

// 右侧栏拖拽宽度
const [sideWidth, setSideWidth] = useResizableSize('sanbao-side', 360, 240, 800)
const panelCollapsed = ref(false)
function onSideDrag(delta: number) {
  setSideWidth(sideWidth.value - delta)
}

/** 对象框显示条件：有 DBC / A2L / CDD DTC 任一数据 */
const showObjectPanel = computed(
  () => store.objHasDbc || store.objHasA2l || store.objHasCddDtc
)

// ==================== 配置管理 ====================
function onRefresh() {
  // ConfigToolbar 内部已刷新配置列表，无需额外处理
}

/** 组装当前配置的可保存数据（序列 + 元信息） */
function buildSanbaoSaveData() {
  const globalVariables = globalVarsText.value.split('\n').map((s) => s.trim()).filter((s) => s)
  return {
    module_title: moduleTitle.value,
    module_description: moduleDesc.value,
    globalVariables,
    steps: sequenceSteps.value,
    oem: store.selectedOem,
  }
}

/** 静默持久化指定配置（用于切换前的自动保存），返回是否成功 */
async function persistConfig(name: string): Promise<boolean> {
  if (!name) return false
  try {
    await saveConfig('sanbao', name, buildSanbaoSaveData())
    return true
  } catch {
    return false
  }
}

async function onCreate(name: string) {
  // 新建配置会切走当前配置：先自动保存当前配置，避免未保存内容丢失
  const prevName = loadedConfig.value
  if (prevName && prevName !== name) {
    await persistConfig(prevName)
  }
  moduleTitle.value = '三包测试'
  moduleDesc.value = 'SanBao Test Module'
  globalVarsText.value = ''
  sequenceSteps.value = []
  // 先保存空配置到后端
  try {
    await saveConfig('sanbao', name, {
      module_title: '三包测试',
      module_description: 'SanBao Test Module',
      globalVariables: [],
      steps: [],
      oem: store.selectedOem,
    })
    currentConfig.value = name
    loadedConfig.value = name
    // 刷新列表并选中新配置
    await configToolbarRef.value?.refreshAndSelect(name)
    ElMessage.success(`已新建配置：${name}`)
  } catch (e: any) {
    console.error('[Sanbao] 新建配置失败:', e)
    ElMessage.error(`新建失败: ${e?.message || e}`)
  }
}

async function onCopy(name: string, newName: string) {
  currentConfig.value = newName
  // 复制后的配置内容与源配置一致，视为该新配置的内存数据
  loadedConfig.value = newName
  // 刷新列表并选中新配置
  await configToolbarRef.value?.refreshAndSelect(newName)
  ElMessage.success(`已复制为：${newName}`)
}

function onDelete(name: string) {
  if (currentConfig.value === name) {
    currentConfig.value = ''
    sequenceSteps.value = []
  }
  // 清除内存数据归属，避免切换时自动保存"复活"已删除配置
  if (loadedConfig.value === name) loadedConfig.value = ''
  // ConfigToolbar handleDelete 内部已刷新列表
  ElMessage.success(`已删除配置：${name}`)
}

/** 切换配置时加载配置数据（步骤库和函数库不从配置加载，走全局库） */
async function onConfigChange(name: string) {
  const token = ++configChangeToken
  const prevName = loadedConfig.value
  // 切换配置前自动保存当前配置，避免未保存的编辑内容丢失（静默：失败才提示）
  if (prevName && prevName !== name) {
    const ok = await persistConfig(prevName)
    if (!ok) {
      ElMessage.warning(`配置「${prevName}」自动保存失败，切换后可能丢失改动`)
    }
  }
  // 自动保存期间用户又切换了配置：放弃本次加载，由最新一次调用处理
  if (token !== configChangeToken) return
  currentConfig.value = name
  loadedConfig.value = ''
  if (!name) {
    sequenceSteps.value = []
    return
  }
  try {
    const res: any = await getConfig('sanbao', name)
    if (token !== configChangeToken) return
    const data = res?.data || res || {}
    moduleTitle.value = data.module_title || '三包测试'
    moduleDesc.value = data.module_description || 'SanBao Test Module'
    globalVarsText.value = Array.isArray(data.globalVariables) ? data.globalVariables.join('\n') : ''
    sequenceSteps.value = Array.isArray(data.steps) ? data.steps : []
    // 回填主机厂选择
    if (data.oem) {
      store.setSelectedOem(data.oem)
    }
    // 标记内存数据归属该配置，后续切换时据此安全自动保存
    loadedConfig.value = name
  } catch (e: any) {
    if (token !== configChangeToken) return
    console.error('[Sanbao] 加载配置失败:', e)
    ElMessage.error(`加载配置失败: ${e?.message || e}`)
  }
}

/** 保存配置（序列 + 元信息，步骤库和函数库走全局库独立保存） */
async function onSave() {
  if (!currentConfig.value) {
    ElMessage.warning('请先选择或新建配置')
    return
  }
  try {
    await saveConfig('sanbao', currentConfig.value, buildSanbaoSaveData())
    loadedConfig.value = currentConfig.value
    ElMessage.success(`配置已保存：${currentConfig.value}`)
  } catch (e: any) {
    console.error('[Sanbao] 保存配置失败:', e)
    ElMessage.error(`保存失败: ${e?.message || e}`)
  }
}

/** 生成 CAPL 测试脚本并导入 CFG 添加测试模块 */
async function onGenerate() {
  if (!currentConfig.value) {
    ElMessage.warning('请先选择或新建配置')
    return
  }
  if (!sequenceSteps.value.length) {
    ElMessage.warning('序列为空，请先拖拽步骤组装用例')
    return
  }
  const cfgDir = store.cfgData.cfg_dir
  if (!cfgDir) {
    ElMessage.warning('未解析 CFG，请先在左侧栏解析 .cfg 文件')
    return
  }
  try {
    // 先保存最新数据再生成
    await saveConfig('sanbao', currentConfig.value, buildSanbaoSaveData())
    loadedConfig.value = currentConfig.value

    const res: any = await generateSanbao(currentConfig.value, cfgDir, functionLibraryCode.value)
    const result = res?.data || {}
    const te = result.te_result || {}
    ElMessage.success(
      `CAPL 生成成功：${result.file_name}（${result.step_count} 步），TE 导入${te.success ? '成功' : '失败'}`
    )
    console.log('[Sanbao] CAPL 输出:', result.capl_path, 'TE:', te)
  } catch (e: any) {
    console.error('[Sanbao] 生成 CAPL 失败:', e)
    ElMessage.error(`生成失败: ${e?.message || e}`)
  }
}

// ==================== 全局库（函数库 + 步骤库） ====================
/** 加载全局库（进入页面时调用一次，所有配置共享） */
async function loadGlobalLibrary() {
  try {
    const res: any = await getGlobalLibrary()
    const data = res?.data || res || {}
    functionLibraryCode.value = data.function_library || ''
    customSteps.value = Array.isArray(data.step_library) ? data.step_library : []
  } catch (e: any) {
    console.error('[Sanbao] 加载全局库失败:', e)
  }
}

/** 步骤库变更时自动保存到全局库 */
async function onStepsUpdate(steps: CustomStep[]) {
  customSteps.value = steps
  try {
    await saveGlobalLibrary(functionLibraryCode.value, steps)
  } catch (e: any) {
    console.error('[Sanbao] 保存步骤库失败:', e)
  }
}

/** 函数库保存 */
async function onSaveFunctionLibrary(code: string) {
  functionLibraryCode.value = code
  try {
    await saveGlobalLibrary(code, customSteps.value)
  } catch (e: any) {
    console.error('[Sanbao] 保存函数库失败:', e)
    ElMessage.error(`保存函数库失败: ${e?.message || e}`)
  }
}

// ==================== CAPL 预览 ====================
const previewVisible = ref(false)
const previewCaplCode = ref('')
const previewFileName = ref('')

const caplLineCount = computed(() =>
  previewCaplCode.value ? previewCaplCode.value.split('\n').length : 0,
)

const highlightedCapl = computed(() => {
  if (!previewCaplCode.value) return ''
  try {
    return hljs.highlight(previewCaplCode.value, { language: 'c' }).value
  } catch {
    return previewCaplCode.value
  }
})

/** 前端本地生成 CAPL 预览（无需调用后端 / 不依赖 cfg_dir） */
function buildCaplPreview(): string {
  const vars = globalVarsText.value
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
  const varsBlock = vars.length ? '\n' + vars.map((v) => `  ${v}`).join('\n') + '\n' : ''

  const PLACEHOLDER_RE = /\{\{\s*(\w+)\s*\}\}/g
  const resolveParams = (code: string, params: Record<string, string>): string => {
    return code.replace(PLACEHOLDER_RE, (_, key) => params[key] || `{{${key}}}`)
  }

  const buildBlock = (step: SequenceStep, indent: number): string => {
    const pad = '  '.repeat(indent)
    if (step.type === 'loop') {
      const children = step.children || []
      if (step.loopMode === 'infinite') {
        const body = children.map((c) => buildBlock(c, indent + 1)).join('')
        const exitCond = step.exitCondition || '0'
        return `${pad}while (1)\n${pad}{\n${body}${pad}  if (${exitCond}) break;\n${pad}}\n`
      }
      const count = step.count || 1
      const idxVar = `i_${step.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8)}`
      const body = children.map((c) => buildBlock(c, indent + 2)).join('')
      return `${pad}for (int ${idxVar} = 0; ${idxVar} < ${count}; ${idxVar}++)\n${pad}{\n${body}${pad}}\n`
    }
    const code = resolveParams(step.code || '', step.params || {})
    return code
      .split('\n')
      .map((line) => `${pad}${line}`)
      .join('\n') + '\n'
  }

  const testcaseBody = sequenceSteps.value.map((s) => buildBlock(s, 1)).join('') || '  /* 空序列 */\n'

  return (
    '/*@!Encoding:936*/\n'
    + 'includes\n{\n  #include "TestFunction.cin"\n}\n\n'
    + 'variables\n{'
    + varsBlock
    + '}\n\n'
    + `testcase TestModuleTitle()\n{\n  "${moduleTitle.value}";\n}\n\n`
    + `testcase TestModuleDescription()\n{\n  "${moduleDesc.value}";\n}\n\n`
    + 'testcase Init_Test_Condition()\n{\n  /* 初始化测试条件 */\n  TestWaitForStart();\n}\n\n'
    + 'testcase MainTest()\n{\n'
    + '  Init_Test_Condition();\n'
    + testcaseBody
    + '  stopLogging();\n}\n'
  )
}

function onPreview() {
  if (!sequenceSteps.value.length) {
    ElMessage.warning('序列为空，请先拖拽步骤组装用例')
    return
  }
  previewCaplCode.value = buildCaplPreview()
  previewFileName.value = `SanBao_${currentConfig.value || 'preview'}.can`
  previewVisible.value = true
}

async function copyCapl() {
  try {
    await navigator.clipboard.writeText(previewCaplCode.value)
    ElMessage.success('CAPL 代码已复制到剪贴板')
  } catch {
    ElMessage.error('复制失败，请手动选中复制')
  }
}

// ==================== 生命周期 ====================
onMounted(() => {
  // 加载全局库（函数库 + 步骤库，独立于配置）
  loadGlobalLibrary()
})
</script>

<style scoped lang="scss">
.sanbao-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 12px;
}

.sanbao-meta-bar {
  display: flex;
  gap: 12px;
  background: var(--bg-card);
  border-radius: 12px;
  padding: 10px 12px;
}

.preview-btn {
  flex-shrink: 0;
}

.library-tabs {
  height: 100%;
  display: flex;
  flex-direction: column;

  :deep(.el-tabs__header) {
    margin-bottom: 6px;
    flex-shrink: 0;
  }

  :deep(.el-tabs__content) {
    flex: 1;
    overflow: hidden;
  }

  :deep(.el-tab-pane) {
    height: 100%;
  }
}

.preview-dialog {
  :deep(.el-dialog__body) {
    padding: 0 12px 12px;
  }
}

.preview-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 0 8px;
}

.preview-file {
  font-size: 12px;
  color: var(--text-color-secondary);
  font-family: 'Consolas', 'Monaco', monospace;
}

.preview-code-block {
  display: flex;
  background: #282c34;
  border-radius: 6px;
  overflow: hidden;
  max-height: 70vh;
}

.preview-gutter {
  display: flex;
  flex-direction: column;
  padding: 12px 8px;
  background: #21252b;
  color: #5c6370;
  font-size: 13px;
  line-height: 1.6;
  font-family: 'Consolas', 'Monaco', monospace;
  text-align: right;
  user-select: none;
  flex-shrink: 0;
  min-width: 40px;
}

.preview-pre {
  margin: 0;
  padding: 12px 16px;
  overflow: auto;
  flex: 1;

  code {
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 13px;
    line-height: 1.6;
    background: transparent;
    padding: 0;
  }
}

.meta-input {
  flex: 1;

  :deep(.el-input__wrapper) {
    padding: 4px 10px;
  }
}

.meta-cfg-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-color-secondary);
  background: var(--bg-page);
  border-radius: 8px;
  padding: 0 12px;
  flex: 0 0 auto;
  max-width: 280px;
  overflow: hidden;

  span {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.global-var-btn {
  flex-shrink: 0;
}

.global-var-pop {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.global-var-tip {
  font-size: 11px;
  color: var(--text-color-secondary);

  code {
    background: var(--bg-page);
    padding: 2px 4px;
    border-radius: 3px;
    font-family: 'Consolas', 'Monaco', monospace;
  }
}

.sanbao-layout {
  flex: 1;
  display: flex;
  align-items: flex-start;
  overflow: hidden;
}

.sanbao-body {
  display: flex;
  gap: 12px;
  flex: 1;
  min-width: 0;
  height: 100%;
}

.sanbao-main {
  display: flex;
  gap: 12px;
  flex: 1;
  min-width: 0;
  height: 100%;
}

.col-library {
  flex: 0 0 280px;
  min-width: 0;
}

.col-seq {
  flex: 1;
  min-width: 0;
}

.sanbao-side {
  flex: 0 0 auto;
  position: sticky;
  top: 0;
  height: calc(100vh - var(--header-height) - var(--tab-height) - 140px);
  overflow: hidden;
  background: var(--bg-card);
  border-radius: 12px;
}

.side-toggle {
  flex: 0 0 auto;
  width: 28px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: var(--bg-card);
  border-radius: 8px;
  cursor: pointer;
  color: var(--text-secondary);
  font-size: 12px;
  writing-mode: vertical-rl;
  padding: 12px 0;

  &:hover {
    color: var(--color-primary);
  }
}
</style>

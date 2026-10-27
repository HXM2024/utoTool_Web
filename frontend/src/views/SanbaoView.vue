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
      <el-button class="preview-btn" :icon="View" :disabled="!sequenceSteps.length && !testCases.length" @click="onPreview">预览</el-button>
    </div>

    <!-- 生成参数（替换 TestFunction.cin 模板占位符，与 Function 模块一致） -->
    <div class="sanbao-config-card">
      <el-form :model="configPageData" label-width="110px" class="config-form">
        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="A2L_Qualifier">
              <el-input v-model="configPageData.a2lQualifierLineEdit" placeholder="A2L ECU 名称" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="Ready">
              <div
                class="drop-zone signal-name"
                data-drop-key="config-readySignal"
                @dragenter.prevent="onConfigDragEnter"
                @dragover.prevent
                @dragleave="onConfigDragLeave"
                @drop="onDropField($event, configPageData, 'readySignal')"
              >
                <el-input v-model="configPageData.readySignal" placeholder="信号名（拖拽）" />
              </div>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="CDD_Qualifier">
              <el-input v-model="configPageData.cddQualifierLineEdit" placeholder="CDD在CANoe工程中的Name" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="Ready_On">
              <el-input v-model="configPageData.readyOnValue" placeholder="开启值" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="Ready_Off">
              <el-input v-model="configPageData.readyOffValue" placeholder="关闭值" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
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
              <el-tab-pane label="用例库" name="cases">
                <SanbaoCaseLibrary
                  :cases="caseLibrary"
                  @update:cases="onCaseLibraryUpdate"
                />
              </el-tab-pane>
            </el-tabs>
          </div>
          <SanbaoSequenceEditor
            :steps="sequenceSteps"
            class="col-seq"
            @update:steps="sequenceSteps = $event"
            @save="onSaveSequence"
          />
          <SanbaoTestCaseList
            :cases="testCases"
            :active-id="activeTestCaseId"
            class="col-cases"
            @update:cases="onTestCasesUpdate"
            @load="onLoadTestCase"
            @save-as-library="onSaveCaseAsLibrary"
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
import { ref, computed, watch, onMounted } from 'vue'
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
import SanbaoCaseLibrary, { type CaseLibraryItem } from '@/components/SanbaoCaseLibrary.vue'
import SanbaoSequenceEditor, { type SequenceStep } from '@/components/SanbaoSequenceEditor.vue'
import SanbaoTestCaseList from '@/components/SanbaoTestCaseList.vue'
import { useModuleStore } from '@/stores/modules'
import { defaultAlgoForOem } from '@/utils/securityAlgo'
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
// 生成参数（替换 TestFunction.cin 模板占位符，随配置保存）
const configPageData = ref({
  a2lQualifierLineEdit: '',
  cddQualifierLineEdit: '',
  readySignal: '',
  readyOnValue: '',
  readyOffValue: '',
})
const customSteps = ref<CustomStep[]>([])
const sequenceSteps = ref<SequenceStep[]>([])

// 全局库（独立于配置，所有配置共享）
const libraryTab = ref('steps')
const functionLibraryCode = ref('')
/** 用例库（全局共享，条目=命名后的用例序列） */
const caseLibrary = ref<CaseLibraryItem[]>([])

/** 测试用例（随配置保存，用例序列可保存为测试用例） */
const testCases = ref<CaseLibraryItem[]>([])
const activeTestCaseId = ref('')

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

// ==================== 生成参数（拖拽 + CFG 自动填充） ====================
const dragOverEl = ref<HTMLElement | null>(null)
const dragOverKey = ref('')

function onConfigDragEnter(event: DragEvent) {
  const el = event.currentTarget as HTMLElement
  const key = el.getAttribute('data-drop-key')
  if (!key || dragOverKey.value === key) return
  if (dragOverEl.value) dragOverEl.value.classList.remove('drag-over')
  dragOverKey.value = key
  dragOverEl.value = el
  el.classList.add('drag-over')
}

function onConfigDragLeave(event: DragEvent) {
  const el = event.currentTarget as HTMLElement
  if (dragOverEl.value === el) {
    el.classList.remove('drag-over')
    dragOverEl.value = null
    dragOverKey.value = ''
  }
}

function onDropField(event: DragEvent, target: Record<string, any>, key: string) {
  event.preventDefault()
  if (dragOverEl.value) {
    dragOverEl.value.classList.remove('drag-over')
    dragOverEl.value = null
  }
  dragOverKey.value = ''
  const name = event.dataTransfer?.getData('text/plain')
  if (name) target[key] = name
}

// CFG 解析出 A2L/CDD 限定符后，自动填充表单空项（不覆盖用户输入）
watch(
  () => store.cfgData,
  (cfg) => {
    if (!cfg) return
    if (cfg.a2l_qualifier && !configPageData.value.a2lQualifierLineEdit) {
      configPageData.value.a2lQualifierLineEdit = cfg.a2l_qualifier
    }
    if (cfg.cdd_qualifier && !configPageData.value.cddQualifierLineEdit) {
      configPageData.value.cddQualifierLineEdit = cfg.cdd_qualifier
    }
  },
  { deep: true, immediate: true },
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
    test_cases: testCases.value,
    oem: store.selectedOem,
    securityAlgo: store.selectedAlgo,
    // 生成参数（A2L/CDD 限定符 + Ready 信号），随配置保存
    a2lQualifierLineEdit: configPageData.value.a2lQualifierLineEdit,
    cddQualifierLineEdit: configPageData.value.cddQualifierLineEdit,
    readySignal: configPageData.value.readySignal,
    readyOnValue: configPageData.value.readyOnValue,
    readyOffValue: configPageData.value.readyOffValue,
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
  testCases.value = []
  activeTestCaseId.value = ''
  configPageData.value = {
    a2lQualifierLineEdit: '',
    cddQualifierLineEdit: '',
    readySignal: '',
    readyOnValue: '',
    readyOffValue: '',
  }
  // 先保存空配置到后端
  try {
    await saveConfig('sanbao', name, {
      module_title: '三包测试',
      module_description: 'SanBao Test Module',
      globalVariables: [],
      steps: [],
      test_cases: [],
      oem: store.selectedOem,
      securityAlgo: store.selectedAlgo,
      a2lQualifierLineEdit: '',
      cddQualifierLineEdit: '',
      readySignal: '',
      readyOnValue: '',
      readyOffValue: '',
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
    testCases.value = []
    activeTestCaseId.value = ''
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
    testCases.value = []
    activeTestCaseId.value = ''
    configPageData.value = {
      a2lQualifierLineEdit: '',
      cddQualifierLineEdit: '',
      readySignal: '',
      readyOnValue: '',
      readyOffValue: '',
    }
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
    testCases.value = Array.isArray(data.test_cases) ? data.test_cases : []
    activeTestCaseId.value = ''
    // 生成参数回填；配置里为空时回退到 CFG 解析值（A2L/CDD 限定符）
    configPageData.value = {
      a2lQualifierLineEdit: data.a2lQualifierLineEdit || store.cfgData.a2l_qualifier || '',
      cddQualifierLineEdit: data.cddQualifierLineEdit || store.cfgData.cdd_qualifier || '',
      readySignal: data.readySignal || '',
      readyOnValue: data.readyOnValue || '',
      readyOffValue: data.readyOffValue || '',
    }
    // 回填主机厂选择
    if (data.oem) {
      store.setSelectedOem(data.oem)
    }
    // 回填安全算法；历史配置只有 oem 时按该厂默认算法兜底
    if (data.securityAlgo) {
      store.setSelectedAlgo(data.securityAlgo)
    } else if (data.oem) {
      const fallback = defaultAlgoForOem(data.oem)
      if (fallback) store.setSelectedAlgo(fallback)
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
  if (!sequenceSteps.value.length && !testCases.value.length) {
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

    const res: any = await generateSanbao(
      currentConfig.value,
      cfgDir,
      functionLibraryCode.value,
      store.relayConfigs.sanbao.relayModule,
      store.relayConfigs.sanbao.canChannel,
      {
        a2lQualifier: configPageData.value.a2lQualifierLineEdit,
        cddQualifier: configPageData.value.cddQualifierLineEdit,
        readySignal: configPageData.value.readySignal,
        readyOnValue: configPageData.value.readyOnValue,
        readyOffValue: configPageData.value.readyOffValue,
      },
    )
    const result = res?.data || {}
    const te = result.te_result || {}
    ElMessage.success(
      `CAPL 生成成功：${result.file_name}（${result.case_count ?? 1} 个用例），TE 导入${te.success ? '成功' : '失败'}`
    )
    console.log('[Sanbao] CAPL 输出:', result.capl_path, 'TE:', te)
  } catch (e: any) {
    console.error('[Sanbao] 生成 CAPL 失败:', e)
    ElMessage.error(`生成失败: ${e?.message || e}`)
  }
}

// ==================== 全局库（函数库 + 步骤库 + 用例库） ====================
/** 加载全局库（进入页面时调用一次，所有配置共享） */
async function loadGlobalLibrary() {
  try {
    const res: any = await getGlobalLibrary()
    const data = res?.data || res || {}
    functionLibraryCode.value = data.function_library || ''
    customSteps.value = Array.isArray(data.step_library) ? data.step_library : []
    caseLibrary.value = Array.isArray(data.case_library) ? data.case_library : []
  } catch (e: any) {
    console.error('[Sanbao] 加载全局库失败:', e)
  }
}

/** 保存全局库（函数库 + 步骤库 + 用例库） */
async function persistGlobalLibrary() {
  await saveGlobalLibrary(functionLibraryCode.value, customSteps.value, caseLibrary.value)
}

/** 步骤库变更时自动保存到全局库 */
async function onStepsUpdate(steps: CustomStep[]) {
  customSteps.value = steps
  try {
    await persistGlobalLibrary()
  } catch (e: any) {
    console.error('[Sanbao] 保存步骤库失败:', e)
  }
}

/** 函数库保存 */
async function onSaveFunctionLibrary(code: string) {
  functionLibraryCode.value = code
  try {
    await persistGlobalLibrary()
  } catch (e: any) {
    console.error('[Sanbao] 保存函数库失败:', e)
    ElMessage.error(`保存函数库失败: ${e?.message || e}`)
  }
}

/** 用例库变更时自动保存到全局库 */
async function onCaseLibraryUpdate(cases: CaseLibraryItem[]) {
  caseLibrary.value = cases
  try {
    await persistGlobalLibrary()
  } catch (e: any) {
    console.error('[Sanbao] 保存用例库失败:', e)
    ElMessage.error(`保存用例库失败: ${e?.message || e}`)
  }
}

// ==================== 测试用例（随配置保存） ====================
let _caseSeq = 0
function genCaseId() {
  _caseSeq += 1
  return `case-${Date.now()}-${_caseSeq}-${Math.random().toString(36).slice(2, 6)}`
}
function genStepId() {
  _caseSeq += 1
  return `step-${Date.now()}-${_caseSeq}-${Math.random().toString(36).slice(2, 6)}`
}

/** 深拷贝序列并重新分配 id（避免与已有步骤 id 冲突） */
function cloneSteps(steps: SequenceStep[] = []): SequenceStep[] {
  return steps.map((s) => {
    const c: SequenceStep = { ...s, id: genStepId(), params: { ...(s.params || {}) } }
    if (s.type === 'loop' && s.children) c.children = cloneSteps(s.children)
    return c
  })
}

/** 持久化当前配置（测试用例/序列变更时自动保存） */
async function persistCurrentConfig() {
  if (!currentConfig.value) return
  try {
    await saveConfig('sanbao', currentConfig.value, buildSanbaoSaveData())
    loadedConfig.value = currentConfig.value
  } catch (e: any) {
    console.error('[Sanbao] 保存配置失败:', e)
    ElMessage.error(`保存失败: ${e?.message || e}`)
  }
}

/** 测试用例列表变更（新建/删除/重命名）后保存配置 */
async function onTestCasesUpdate(cases: CaseLibraryItem[]) {
  testCases.value = cases
  if (!cases.some((c) => c.id === activeTestCaseId.value)) activeTestCaseId.value = ''
  await persistCurrentConfig()
}

/** 把当前「用例序列」保存为一个测试用例 */
async function saveSequenceAsTestCase(name: string) {
  if (!sequenceSteps.value.length) {
    ElMessage.warning('序列为空，请先组装用例序列')
    return
  }
  try {
    const tc: CaseLibraryItem = { id: genCaseId(), name, steps: cloneSteps(sequenceSteps.value) }
    testCases.value = [...testCases.value, tc]
    activeTestCaseId.value = tc.id
    await persistCurrentConfig()
    ElMessage.success(`已保存为测试用例：${name}`)
  } catch (e: any) {
    console.error('[Sanbao] 保存测试用例失败:', e)
    ElMessage.error(`保存失败: ${e?.message || e}`)
  }
}

/** 点选测试用例：把其序列加载回「用例序列」编辑区 */
function onLoadTestCase(item: CaseLibraryItem) {
  sequenceSteps.value = cloneSteps(item.steps)
  activeTestCaseId.value = item.id
  ElMessage.success(`已加载测试用例：${item.name}`)
}

/** 右击测试用例「保存为用例库」（写入全局用例库） */
async function onSaveCaseAsLibrary(item: CaseLibraryItem) {
  if (caseLibrary.value.some((c) => c.name === item.name)) {
    ElMessage.warning(`用例库已存在同名用例：${item.name}`)
    return
  }
  caseLibrary.value = [
    ...caseLibrary.value,
    { id: genCaseId(), name: item.name, steps: cloneSteps(item.steps) },
  ]
  try {
    await persistGlobalLibrary()
    ElMessage.success(`已保存到用例库：${item.name}`)
  } catch (e: any) {
    console.error('[Sanbao] 保存用例库失败:', e)
    ElMessage.error(`保存用例库失败: ${e?.message || e}`)
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

// ==================== CAPL 代码生成（序列 → 代码片段） ====================
const PLACEHOLDER_RE = /\{\{\s*(\w+)\s*\}\}/g

/** 提取代码中的 {{参数}} 占位符名（去重保序） */
function extractPlaceholders(code: string): string[] {
  const seen: string[] = []
  let m: RegExpExecArray | null
  PLACEHOLDER_RE.lastIndex = 0
  while ((m = PLACEHOLDER_RE.exec(code)) !== null) {
    if (!seen.includes(m[1])) seen.push(m[1])
  }
  return seen
}

/** 把序列（含循环嵌套）生成 CAPL 代码片段；未填充的占位符保留 {{参数}} */
function buildSequenceSnippet(steps: SequenceStep[], baseIndent = 0): string {
  const resolveParams = (code: string, params: Record<string, string>): string =>
    code.replace(PLACEHOLDER_RE, (_, key) => params[key] || `{{${key}}}`)

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

  return steps.map((s) => buildBlock(s, baseIndent)).join('')
}

/** 「保存」下拉：按所选动作把当前序列保存为步骤 / 测试用例 */
async function onSaveSequence(payload: { type: 'step' | 'case'; name: string }) {
  if (payload.type === 'case') await saveSequenceAsTestCase(payload.name)
  else await saveSequenceAsStep(payload.name)
}

/** 把当前「用例序列」保存为步骤库中的一个自定义步骤（全局共享） */
async function saveSequenceAsStep(name: string) {
  if (!sequenceSteps.value.length) {
    ElMessage.warning('序列为空，请先组装用例序列')
    return
  }
  try {
    const code = buildSequenceSnippet(sequenceSteps.value)
    const step: CustomStep = {
      id: `cs-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      code,
      params: extractPlaceholders(code),
    }
    customSteps.value = [...customSteps.value, step]
    await persistGlobalLibrary()
    libraryTab.value = 'steps'
    ElMessage.success(`已保存为步骤：${name}（${step.params.length} 个参数）`)
  } catch (e: any) {
    console.error('[Sanbao] 保存为步骤失败:', e)
    ElMessage.error(`保存为步骤失败: ${e?.message || e}`)
  }
}

/** 把任意名称清洗为合法 CAPL 标识符（与后端 SanbaoModule._capl_ident 同一套规则） */
function caplIdent(name: string): string {
  let ident = String(name || '').replace(/[^0-9A-Za-z_]/g, '_').replace(/^_+|_+$/g, '')
  if (!ident) ident = 'SanBaoCase'
  if (/^[0-9]/.test(ident)) ident = 'SanBao_' + ident
  return ident
}

/** 继电器操作函数（同步自 CAN 模块 TestFunction.cin，变量名与 relay.py 的 EMBED_* 一致） */
const RELAY_FUNCTIONS = `void RelayON(byte Ctr_state)
{
  if(RelayMode==3)
  {
  Relaymsg.can=RelayCAN;
  Relaymsg.id=0x101;
  switch(Ctr_state)
  {
    case 1:RelayState&=0xFE;break;
    case 2:RelayState&=0xFD;break;
    case 3:RelayState&=0xFB;break;
    case 4:RelayState&=0xF7;break;
    case 5:RelayState&=0xEF;break;
    case 6:RelayState&=0xDF;break;
    case 7:RelayState&=0xBF;break;
    case 8:RelayState&=0x7F;break;
  }
  Relaymsg.byte(0)=RelayState;
  output(Relaymsg);
  }
  if(RelayMode==2)
  {
  Relaymsg.can=RelayCAN;
  Relaymsg.id=0x101;
  switch(Ctr_state)
  {
    case 1:RelayState|=1; break;
    case 2:RelayState|=2;break;
    case 3:RelayState|=4;break;
    case 4:RelayState|=8;break;
    case 5:RelayState|=0x10; break;
    case 6:RelayState|=0x20;break;
    case 7:RelayState|=0x40;break;
    case 8:RelayState|=0x80;break;
  }
  Relaymsg.byte(0)=RelayState;
  output(Relaymsg);
  }  
  if(RelayMode==1)
  {
    if(Ctr_state==1)
    {
      _outIGon();
    }

  }
}
void RelayOFF(byte Ctr_state1)
{
  if(RelayMode==3)
  {
  Relaymsg.can=RelayCAN;
  Relaymsg.id=0x101;
  switch(Ctr_state1)
  {
    case 1:RelayState|=1; break;
    case 2:RelayState|=2;break;
    case 3:RelayState|=4;break;
    case 4:RelayState|=8;break;
    case 5:RelayState|=0x10; break;
    case 6:RelayState|=0x20;break;
    case 7:RelayState|=0x40;break;
    case 8:RelayState|=0x80;break;
  }
  Relaymsg.byte(0)=RelayState;
  output(Relaymsg);
  }
  if(RelayMode==2)
  {
  Relaymsg.can=RelayCAN;
  Relaymsg.id=0x101;
  switch(Ctr_state1)
  {
    case 1:RelayState&=0xFE;break;
    case 2:RelayState&=0xFD;break;
    case 3:RelayState&=0xFB;break;
    case 4:RelayState&=0xF7;break;
    case 5:RelayState&=0xEF;break;
    case 6:RelayState&=0xDF;break;
    case 7:RelayState&=0xBF;break;
    case 8:RelayState&=0x7F;break;
  }
  Relaymsg.byte(0)=RelayState;
  output(Relaymsg);
  }
  if(RelayMode==1)
  {
    if(Ctr_state1==1)
    {
      _outIGoff();
    }

  }
}

_outIGon()
{
  IGON.can=RelayCAN;
  IGON.byte(0)=0x02;
  IGON.byte(1)=0x01;
  IGON.byte(2)=0x01;
  output (IGON);
  writeEx(-3,0,"KL15 on");

}

_outIGoff()
{ IGOFF.can=RelayCAN;
  IGOFF.byte(0)=0x02;
  IGOFF.byte(1)=0x01;
  IGOFF.byte(2)=0x00;
  output (IGOFF);
  writeEx(-3,0,"KL15 off");

}
_outKL30ON()
{ KL30ON.can=RelayCAN;
  KL30ON.byte(0)=0x02;
  KL30ON.byte(1)=0x27;
  KL30ON.byte(2)=0x01;
  output (KL30ON);
  writeEx(-3,0,"KL30 on");

}
_outKL30OFF()
{ KL30OFF.can=RelayCAN;
  KL30OFF.byte(0)=0x02;
  KL30OFF.byte(1)=0x27;
  KL30OFF.byte(2)=0x00;
  output (KL30OFF);
  writeEx(-3,0,"KL30 off");

}`

/** 继电器变量声明（对应 relay.py build_relay_variables，位于 TestFunction.cin 的 variables 块） */
function buildRelayVariables(relayModule: number, canChannel: number): string {
  const rl = Number(relayModule)
  const rm = rl === 0 || rl === 1 || rl === 2 ? rl : 2
  const ch = Number(canChannel) === 1 ? 1 : 2
  const mode = rm + 1
  const stateInit = rm === 2 ? '0' : '0xFF'
  return [
    '// ===== relay begin (auto-generated) =====',
    `const RelayCAN = ${ch};//can通道，推荐使用双通道，配置2`,
    `const RelayMode = ${mode};//1老,2单刀,3双刀`,
    `byte RelayState = ${stateInit};`,
    'message 0x11 IGON={dlc=8};',
    'message 0x11 IGOFF={dlc=8};',
    'message 0x11 KL30ON={dlc=8};',
    'message 0x11 KL30OFF={dlc=8};',
    'message * Relaymsg={dlc=8};',
    '// ===== relay end (auto-generated) =====',
  ].join('\n')
}

/** 前端本地生成 CAPL 预览（无需调用后端 / 不依赖 cfg_dir）
 *  结构与后端 SanbaoModule.generate_capl 一致：.can 为 XML Testmodule 的 CAPL 库，
 *  testcase 名 = 设置名清洗后的标识符（与 XML <capltestcase name> 对应）。 */
function buildCaplPreview(): string {
  const vars = globalVarsText.value
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
  const varsBlock = vars.length ? '\n' + vars.map((v) => `  ${v}`).join('\n') + '\n' : ''

  // 与后端一致：优先配置里的「测试用例」（每个用例一个 testcase），无则回退
  // 「主序列 + 配置名」单个 testcase
  const caseDefs: { ident: string; body: string }[] = []
  if (testCases.value.length) {
    for (const c of testCases.value) {
      caseDefs.push({
        ident: caplIdent(c.name || 'Case'),
        body: buildSequenceSnippet(c.steps || [], 1) || '  /* 空序列 */\n',
      })
    }
  } else {
    caseDefs.push({
      ident: caplIdent(currentConfig.value || 'SanBaoCase'),
      body: buildSequenceSnippet(sequenceSteps.value, 1) || '  /* 空序列 */\n',
    })
  }
  const caseNames = caseDefs.map((c) => c.ident)
  const caseBlocks = caseDefs
    .map((c, idx) => {
      let blk = `testcase ${c.ident}()\n{\n`
      if (idx === 0) {
        blk += `  TestModuleTitle ("${moduleTitle.value}");\n`
        blk += `  TestModuleDescription ("${moduleDesc.value}");\n`
      }
      blk += c.body
      blk += '  stopLogging();\n}\n'
      return blk
    })
    .join('\n')

  return (
    '/* ============================================================================\n'
    + ' *  Sanbao.can  —— XML Testmodule 对应的 CAPL 库\n'
    + ` *  XML 通过 <capltestcase name="${caseNames.join(' / ')}"> 直接调用下方同名 testcase\n`
    + ' * ============================================================================ */\n'
    + '/*@!Encoding:936*/\n'
    + 'includes\n{\n  #include "TestFunction.cin"\n}\n\n'
    + 'variables\n{'
    + varsBlock
    + '}\n\n'
    + caseBlocks
    + '\n'
  )
}

function onPreview() {
  if (!sequenceSteps.value.length && !testCases.value.length) {
    ElMessage.warning('序列为空，请先拖拽步骤组装用例')
    return
  }
  previewCaplCode.value = buildCaplPreview()
  previewFileName.value = 'Sanbao.can'
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

.sanbao-config-card {
  background: var(--bg-card);
  border-radius: 12px;
  padding: 12px 12px 4px;

  .config-form {
    :deep(.el-form-item) {
      margin-bottom: 12px;
    }
  }
}

.drop-zone {
  width: 100%;
  border-radius: 6px;
  transition: all 0.2s;

  &.drag-over {
    background: rgba(24, 144, 255, 0.08);
    box-shadow: 0 0 0 2px var(--color-primary, #1890ff);

    :deep(.el-input__wrapper) {
      box-shadow: 0 0 0 1px var(--color-primary, #1890ff) inset !important;
    }
  }
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

.col-cases {
  flex: 0 0 240px;
  min-width: 0;
  height: 100%;
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

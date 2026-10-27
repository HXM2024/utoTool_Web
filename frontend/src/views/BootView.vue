<template>
  <div class="boot-view">
    <ConfigToolbar
      ref="toolbarRef"
      module-name="boot"
      @config-change="onConfigChange"
      @create="onCreate"
      @save="onSave"
      @delete="onConfigDelete"
      @generate="onGenerate"
      @refresh="onRefresh"
    />

    <div class="boot-content">
      <!-- 主内容区 -->
      <div class="boot-main">
      <el-row :gutter="16">
        <!-- 配置预览 / 编辑 -->
        <el-col :span="24">
          <el-card shadow="hover" class="section-card config-card">
            <template #header>
              <div class="card-header">
                <el-icon><Document /></el-icon>
                <span>配置预览</span>
                <el-tag v-if="currentConfigName" size="small" type="info" class="config-tag">
                  {{ currentConfigName }}
                </el-tag>
                <el-tag v-if="dataSource" size="small" :type="dataSource === 'parse' ? 'success' : 'primary'">
                  {{ dataSource === 'parse' ? 'Excel 解析' : '已保存配置' }}
                </el-tag>
              </div>
            </template>

            <div v-loading="loading" class="config-body">
              <el-tabs v-if="hasConfigData" v-model="activeTab">
                <!-- 基本信息 -->
                <el-tab-pane label="基本信息" name="info">
                  <el-descriptions :column="2" border size="small">
                    <el-descriptions-item label="配置名称">
                      {{ currentConfigName || '—' }}
                    </el-descriptions-item>
                    <el-descriptions-item label="数据来源">
                      <el-tag size="small" :type="dataSource === 'parse' ? 'success' : 'primary'">
                        {{ dataSource === 'parse' ? 'Excel 解析' : '已保存配置' }}
                      </el-tag>
                    </el-descriptions-item>
                    <el-descriptions-item label="INI 文件">
                      <span class="file-path">{{ configData?.output_files?.ini || '—' }}</span>
                    </el-descriptions-item>
                    <el-descriptions-item label="Struct 文件">
                      <span class="file-path">{{ configData?.output_files?.struct_can || '—' }}</span>
                    </el-descriptions-item>
                    <el-descriptions-item label="Other 配置数">
                      {{ otherConfig.length }}
                    </el-descriptions-item>
                    <el-descriptions-item label="DID 数量">
                      {{ didList.length }}
                    </el-descriptions-item>
                    <el-descriptions-item label="服务数量">
                      {{ serviceList.length }}
                    </el-descriptions-item>
                    <el-descriptions-item label="Boot 功能数">
                      {{ bootFunctions.length }}
                    </el-descriptions-item>
                  </el-descriptions>

                  <!-- Boot 功能列表（新建配置的默认数据） -->
                  <div v-if="bootFunctions.length" class="sub-section">
                    <div class="sub-title">Boot 功能列表</div>
                    <el-table :data="bootFunctions" border stripe size="small" style="width: 100%">
                      <el-table-column type="index" label="#" width="50" />
                      <el-table-column prop="function" label="功能名称" sortable />
                      <el-table-column prop="Description" label="描述" show-overflow-tooltip />
                      <el-table-column prop="Parameter" label="参数" show-overflow-tooltip />
                    </el-table>
                  </div>
                </el-tab-pane>

                <!-- Other 配置项 -->
                <el-tab-pane :label="`Other 配置 (${otherConfig.length})`" name="other">
                  <div v-if="otherConfig.length" class="other-form-wrapper">
                    <el-form :model="otherForm" label-width="200px" size="small" label-position="left">
                      <el-row :gutter="16">
                        <el-col v-for="item in otherConfig" :key="item.symbol" :span="12">
                          <el-form-item :label="item.symbol">
                            <el-input v-model="otherForm[item.symbol]" :placeholder="item.value" />
                          </el-form-item>
                        </el-col>
                      </el-row>
                    </el-form>
                  </div>
                  <el-empty v-else description="暂无 Other 配置项" />
                </el-tab-pane>

                <!-- 服务列表 -->
                <el-tab-pane :label="`服务列表 (${serviceList.length})`" name="services">
                  <div v-if="serviceList.length">
                    <el-table
                      :data="serviceList"
                      border
                      stripe
                      size="small"
                      style="width: 100%"
                      :default-sort="{ prop: 'service', order: 'ascending' }"
                    >
                      <el-table-column type="index" label="#" width="50" />
                      <el-table-column prop="service" label="服务 ID" sortable width="120" />
                      <el-table-column prop="content" label="配置内容" show-overflow-tooltip />
                    </el-table>
                  </div>
                  <el-empty v-else description="暂无服务数据" />
                </el-tab-pane>

                <!-- DID 列表 -->
                <el-tab-pane :label="`DID 列表 (${didList.length})`" name="dids">
                  <div v-if="didList.length">
                    <el-table
                      :data="didList"
                      border
                      stripe
                      size="small"
                      style="width: 100%"
                      :default-sort="{ prop: 'did', order: 'ascending' }"
                    >
                      <el-table-column type="index" label="#" width="50" />
                      <el-table-column prop="did" label="DID" sortable width="180" />
                      <el-table-column prop="content" label="配置内容" show-overflow-tooltip />
                    </el-table>
                  </div>
                  <el-empty v-else description="暂无 DID 数据" />
                </el-tab-pane>

                <!-- 生成内容 -->
                <el-tab-pane label="生成内容" name="output">
                  <el-tabs v-model="outputTab" tab-position="left">
                    <el-tab-pane label="INI 内容" name="ini">
                      <pre v-if="iniContent" class="code-block">{{ iniContent }}</pre>
                      <el-empty v-else description="暂无 INI 内容" />
                    </el-tab-pane>
                    <el-tab-pane label="Struct.can" name="struct">
                      <pre v-if="structContent" class="code-block">{{ structContent }}</pre>
                      <el-empty v-else description="暂无 Struct 内容" />
                    </el-tab-pane>
                  </el-tabs>
                </el-tab-pane>
              </el-tabs>

              <!-- 空状态 -->
              <div v-else class="empty-placeholder">
                <el-icon class="empty-icon"><Document /></el-icon>
                <span>选择配置或上传 Excel 文件后显示配置内容</span>
              </div>
            </div>
          </el-card>
        </el-col>
      </el-row>

      <!-- 底部：生成按钮 + 输出结果 -->
      <el-card shadow="hover" class="section-card">
        <template #header>
          <div class="card-header">
            <el-icon><Promotion /></el-icon>
            <span>生成输出</span>
            <el-button
              type="warning"
              :icon="Promotion"
              :loading="generating"
              :disabled="!currentConfigName"
              class="generate-btn"
              @click="handleGenerate"
            >
              生成文件
            </el-button>
          </div>
        </template>

        <div v-if="generateResult" class="generate-result">
          <el-descriptions :column="1" border size="small">
            <el-descriptions-item label="配置名称">
              {{ generateResult.config_name || '—' }}
            </el-descriptions-item>
            <el-descriptions-item label="输出目录">
              <span class="file-path">{{ generateResult.output_dir || '—' }}</span>
              <el-button
                v-if="generateResult.output_dir"
                type="info"
                :icon="FolderOpened"
                size="small"
                @click="handleOpenDir"
              >
                打开
              </el-button>
            </el-descriptions-item>
            <el-descriptions-item label="INI 文件">
              <span class="file-path">{{ generateResult.output_files?.ini || '—' }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="Struct 文件">
              <span class="file-path">{{ generateResult.output_files?.struct_can || '—' }}</span>
            </el-descriptions-item>
          </el-descriptions>

          <!-- 展示生成的内容 -->
          <div class="generated-content">
            <div class="sub-title">INI 内容预览</div>
            <pre v-if="iniContent" class="code-block">{{ iniContent }}</pre>
            <el-empty v-else description="无 INI 内容" :image-size="60" />

            <div class="sub-title">Struct.can 预览</div>
            <pre v-if="structContent" class="code-block">{{ structContent }}</pre>
            <el-empty v-else description="无 Struct 内容" :image-size="60" />
          </div>
        </div>

        <el-empty v-else description="点击「生成文件」按钮生成输出文件" :image-size="80" />
      </el-card>
      </div>

      <!-- 对象浏览器侧边栏（共享全局数据：CFG 优先，上传覆盖刷新） -->
      <div v-show="!panelCollapsed" class="boot-side-wrap">
        <ResizableSplitter direction="horizontal" side="end" :on-drag="onSideDrag" />
        <div class="boot-side" :style="{ width: sideWidth + 'px' }">
          <ObjectPanel
            :dbc-raw="store.objMergedDbcRaw"
            :dtc-raw="store.objDtcRaw"
            :a2l-vars="store.objA2lVars"
            :dbc-env-vars="store.objDbcEnvVars"
            :a2l-qualifier="store.objA2lQualifier"
            @collapse="panelCollapsed = true"
            @expand="panelCollapsed = false"
          />
        </div>
      </div>
      <button
        type="button"
        class="side-toggle"
        :title="panelCollapsed ? '展开对象浏览器' : '收起对象浏览器'"
        :aria-label="panelCollapsed ? '展开对象浏览器' : '收起对象浏览器'"
        :aria-expanded="panelCollapsed ? 'false' : 'true'"
        @click="panelCollapsed = !panelCollapsed"
      >
        <el-icon><component :is="panelCollapsed ? Expand : Fold" /></el-icon>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, watch, onMounted } from 'vue'

defineOptions({ name: 'BootView' })
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Upload,
  Document,
  Promotion,
  FolderAdd,
  Expand,
  Fold,
  FolderOpened,
} from '@element-plus/icons-vue'
import ConfigToolbar from '@/components/ConfigToolbar.vue'
import ObjectPanel from '@/components/ObjectPanel.vue'
import ResizableSplitter from '@/components/ResizableSplitter.vue'
import { useResizableSize } from '@/composables/useResizableSize'
import { generateBoot } from '@/api/boot'
import { getConfig, saveConfig, openFolder } from '@/api/config'
import { useModuleStore } from '@/stores/modules'
import { defaultAlgoForOem } from '@/utils/securityAlgo'

// ===================== 状态 =====================

const store = useModuleStore()
const toolbarRef = ref<InstanceType<typeof ConfigToolbar>>()
const loading = ref(false)
const generating = ref(false)
const panelCollapsed = ref(false)
const [sideWidth, setSideWidth] = useResizableSize('boot-side', 340, 240, 720)
/** 对象面板在右侧：splitter 向左拖（delta<0）时面板变宽 */
function onSideDrag(delta: number) {
  setSideWidth(sideWidth.value - delta)
}
const configData = ref<any>(null)
const parseResult = ref<any>(null)
const generateResult = ref<any>(null)
const activeTab = ref('info')
const outputTab = ref('ini')
const dataSource = ref<'config' | 'parse'>('config')
const currentConfigName = ref('')
/** 当前内存中数据所归属的配置名（加载/切换过程中为空，用于切换前安全自动保存） */
const loadedConfig = ref('')
/** 配置切换/加载令牌：忽略过期请求，避免快速切换时数据错位 */
let configChangeToken = 0

// ===================== 计算属性 =====================

const hasConfigData = computed(() => configData.value !== null)

const iniContent = computed(() => configData.value?.uds_main_info || '')
const structContent = computed(() => configData.value?.struct || '')
const bootFunctions = computed(() => configData.value?.boot_functions || [])

/** 解析 INI 内容，提取结构化数据 */
const parsedData = computed(() => parseIniContent(iniContent.value))

const otherConfig = computed(() => parsedData.value.other)
const serviceList = computed(() => parsedData.value.services)
const didList = computed(() => parsedData.value.dids)

/** Other 配置的可编辑表单数据 */
const otherForm = reactive<Record<string, string>>({})

// ===================== INI 解析 =====================

interface OtherItem {
  symbol: string
  value: string
}
interface ServiceItem {
  service: string
  content: string
}
interface DidItem {
  did: string
  content: string
}

/**
 * 从 INI 内容中提取结构化数据：
 *   - Other 配置: key = value（非 DID、非服务 ID）
 *   - 服务列表: 0xXX = {...}
 *   - DID 列表: DID* = ...
 */
function parseIniContent(ini: string): {
  other: OtherItem[]
  services: ServiceItem[]
  dids: DidItem[]
} {
  const other: OtherItem[] = []
  const services: ServiceItem[] = []
  const dids: DidItem[] = []

  if (!ini) return { other, services, dids }

  const lines = ini.split('\n')
  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue
    // 跳过注释、section header
    if (line.startsWith('#') || line.startsWith('[')) continue

    // 匹配 key = value
    const match = line.match(/^(\S+)\s*=\s*(.+)$/)
    if (!match) continue

    const [, key, value] = match

    if (/^0x[0-9A-Fa-f]+$/i.test(key)) {
      services.push({ service: key, content: value })
    } else if (/^DID/i.test(key)) {
      dids.push({ did: key, content: value })
    } else {
      other.push({ symbol: key, value: value })
    }
  }

  return { other, services, dids }
}

/** 同步 Other 配置到可编辑表单 */
function syncOtherForm() {
  // 清空旧数据
  Object.keys(otherForm).forEach((k) => delete otherForm[k])
  // 填充新数据
  otherConfig.value.forEach((item) => {
    otherForm[item.symbol] = item.value
  })
}

// ===================== 事件处理 =====================

/** 合并 Other 表单编辑值回 configData，返回可保存的数据 */
function buildBootSaveData(): any | null {
  if (!configData.value) return null
  if (configData.value.uds_main_info && otherConfig.value.length) {
    let iniText = configData.value.uds_main_info
    otherConfig.value.forEach((item) => {
      const newVal = otherForm[item.symbol]
      if (newVal !== undefined && newVal !== item.value) {
        const regex = new RegExp(
          `(${item.symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*=\\s*)(.+)`,
        )
        iniText = iniText.replace(regex, `$1${newVal}`)
      }
    })
    configData.value.uds_main_info = iniText
  }
  configData.value.oem = store.selectedOem
  // 全局安全算法选择随配置保存；缺失时由加载兜底补默认值
  configData.value.securityAlgo = store.selectedAlgo
  return configData.value
}

/** 静默持久化指定配置（用于切换前的自动保存），返回是否成功 */
async function persistConfig(name: string): Promise<boolean> {
  if (!name) return false
  const data = buildBootSaveData()
  if (!data) return false
  try {
    await saveConfig('boot', name, data)
    return true
  } catch {
    return false
  }
}

/** 配置被删除：清除内存数据归属，避免切换时自动保存"复活"已删除配置 */
function onConfigDelete(name: string) {
  if (loadedConfig.value === name) loadedConfig.value = ''
}

/** 选择配置 → 加载配置数据 */
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
  currentConfigName.value = name
  loadedConfig.value = ''
  if (!name) {
    configData.value = null
    return
  }
  await loadConfigData(name, token)
}

/** 加载配置数据 */
async function loadConfigData(name: string, token: number = configChangeToken) {
  loading.value = true
  try {
    const res: any = await getConfig('boot', name)
    if (token !== configChangeToken) return
    const data = res?.data ?? res
    configData.value = data
    dataSource.value = 'config'
    parseResult.value = null
    generateResult.value = null
    activeTab.value = 'info'
    syncOtherForm()
    // 回填主机厂选择
    if (data?.oem) {
      store.setSelectedOem(data.oem)
    }
    // 回填安全算法；历史配置只有 oem 时按该厂默认算法兜底
    if (data?.securityAlgo) {
      store.setSelectedAlgo(data.securityAlgo)
    } else if (data?.oem) {
      const fallback = defaultAlgoForOem(data.oem)
      if (fallback) store.setSelectedAlgo(fallback)
    }
    // 标记内存数据归属该配置，后续切换时据此安全自动保存
    loadedConfig.value = name
  } catch {
    if (token !== configChangeToken) return
    configData.value = null
  } finally {
    if (token === configChangeToken) loading.value = false
  }
}

/** 新建配置 */
async function onCreate(name: string) {
  const hasConfig = !!currentConfigName.value
  // 新建配置会切走当前配置：先自动保存当前配置，避免未保存内容丢失
  const prevName = loadedConfig.value
  if (prevName && prevName !== name) {
    await persistConfig(prevName)
  }
  // 有选择配置时使用默认模板，无配置时保留当前数据
  const defaultData = {
    boot_functions: [
      {
        function: 'EnterBoot',
        Description: '进入 Bootloader 模式',
        Parameter: '0x31 0x01',
        subitems: [],
      },
    ],
  }
  const dataToSave = hasConfig ? defaultData : (configData.value || defaultData)
  dataToSave.oem = store.selectedOem
  dataToSave.securityAlgo = store.selectedAlgo
  try {
    await saveConfig('boot', name, dataToSave)
    ElMessage.success(`配置 "${name}" 创建成功`)
    currentConfigName.value = name
    await loadConfigData(name)
    toolbarRef.value?.loadConfigs()
  } catch {
    // 错误已由拦截器处理
  }
}

/** 保存配置 */
async function onSave() {
  const name = toolbarRef.value?.selectedConfig || currentConfigName.value
  if (!name) {
    ElMessage.warning('请先选择一个配置')
    return
  }
  if (!configData.value) {
    ElMessage.warning('没有可保存的配置数据')
    return
  }

  try {
    await saveConfig('boot', name, buildBootSaveData())
    loadedConfig.value = name
    ElMessage.success(`配置 "${name}" 保存成功`)
    toolbarRef.value?.loadConfigs()
  } catch {
    // 错误已由拦截器处理
  }
}

/** 生成文件（由 ConfigToolbar 触发） */
async function onGenerate() {
  const name = toolbarRef.value?.selectedConfig || currentConfigName.value
  if (!name) {
    ElMessage.warning('请先选择一个配置')
    return
  }
  currentConfigName.value = name
  await handleGenerate()
}

/** 生成文件 */
async function handleGenerate() {
  if (!currentConfigName.value) {
    ElMessage.warning('请先选择一个配置')
    return
  }
  generating.value = true
  try {
    const cfgDir = store.cfgData?.cfg_dir || ''
    const res: any = await generateBoot(currentConfigName.value, cfgDir)
    generateResult.value = res?.data ?? res
    ElMessage.success('文件生成成功')
  } catch {
    generateResult.value = null
  } finally {
    generating.value = false
  }
}

async function handleOpenDir() {
  const dir = generateResult.value?.output_dir
  if (!dir) {
    ElMessage.warning('没有可打开的目录')
    return
  }
  try {
    await openFolder(dir)
  } catch {
    /* 错误由拦截器处理 */
  }
}

/** 刷新 */
function onRefresh() {
  toolbarRef.value?.loadConfigs()
  if (currentConfigName.value) {
    loadConfigData(currentConfigName.value)
  }
}

/** 上传 Excel 解析成功 */
function onUploadSuccess(data: any) {
  const parsed = data?.data ?? data
  parseResult.value = parsed
  configData.value = parsed
  dataSource.value = 'parse'
  generateResult.value = null
  activeTab.value = 'info'
  syncOtherForm()
  ElMessage.success('Excel 解析成功')
}

/** 上传失败 */
function onUploadError() {
  parseResult.value = null
}

/** 将解析结果保存为配置 */
async function saveParsedAsConfig() {
  if (!parseResult.value) return
  try {
    const { value } = await ElMessageBox.prompt('请输入配置名称', '保存为配置', {
      confirmButtonText: '保存',
      cancelButtonText: '取消',
      inputValidator: (v: string) => {
        if (!v || !v.trim()) return '配置名称不能为空'
        return true
      },
    })
    const name = value.trim()
    await saveConfig('boot', name, {
      ...parseResult.value,
      oem: store.selectedOem,
      securityAlgo: store.selectedAlgo,
    })
    ElMessage.success(`配置 "${name}" 保存成功`)
    currentConfigName.value = name
    loadedConfig.value = name
    dataSource.value = 'config'
    toolbarRef.value?.loadConfigs()
  } catch {
    // 用户取消或出错
  }
}

watch(() => store.moduleStates.boot.lastUploadResult, (result) => {
  if (result) {
    onUploadSuccess(result)
    store.moduleStates.boot.lastUploadResult = null
  }
})
</script>

<style scoped lang="scss">
.boot-view {
  padding: 4px 0;
}

.boot-content {
  display: flex;
  flex-direction: row;
  gap: 12px;
  align-items: flex-start;
}

.boot-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.boot-side-wrap {
  position: relative;
  flex-shrink: 0;
  display: flex;
  min-height: 0;
}

.boot-side {
  width: 340px;
  flex-shrink: 0;
  position: sticky;
  top: 8px;
}

.side-toggle {
  width: 22px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  font: inherit;
  background: var(--bg-sidebar, #f5f7fa);
  border: 1px solid var(--border-color-light, #e4e7ed);
  border-radius: 6px;
  cursor: pointer;
  align-self: stretch;
  color: var(--text-secondary, #909399);
  transition: all 0.2s;

  &:hover {
    color: var(--color-primary, var(--el-color-primary));
    border-color: var(--color-primary, var(--el-color-primary));
  }
}

.section-card {
  :deep(.el-card__header) {
    padding: 12px 20px;
  }
  :deep(.el-card__body) {
    padding: 20px;
  }
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);

  .config-tag {
    margin-left: auto;
  }
}

.generate-btn {
  margin-left: auto;
}

.parse-info {
  margin-top: 16px;

  .save-btn {
    width: 100%;
    margin-top: 12px;
  }
}

.config-body {
  min-height: 400px;
}

.other-form-wrapper {
  max-height: 500px;
  overflow-y: auto;
}

.sub-section {
  margin-top: 20px;
}

.sub-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 16px 0 8px;
}

.file-path {
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  color: var(--text-secondary);
  word-break: break-all;
}

.code-block {
  background: var(--bg-sidebar);
  border: 1px solid var(--border-color-light);
  border-radius: var(--radius-small);
  padding: 16px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-primary);
  overflow-x: auto;
  max-height: 500px;
  white-space: pre-wrap;
  word-break: break-all;
}

.generated-content {
  margin-top: 16px;
}

.empty-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  color: var(--text-secondary);
  font-size: 14px;
  gap: 12px;

  .empty-icon {
    font-size: 48px;
    opacity: 0.4;
  }
}
</style>

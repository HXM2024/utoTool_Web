<template>
  <aside class="global-sidebar" :style="{ width: width + 'px' }">
    <!-- 主机厂选择 -->
    <div class="sidebar-section">
      <div class="section-title">主机厂选择</div>
      <OemSelector
        v-model="store.selectedAlgo"
        :oem="store.selectedOem"
        @update:oem="store.setSelectedOem"
      />
    </div>
    
    <!-- CAN 模块电机类型：决定解析 .a2l（无刷）还是 .mapxml（有刷），二者只能选一种 -->
    <div v-if="store.activeModule === 'can'" class="sidebar-section">
      <div class="section-title">电机类型</div>
      <el-radio-group v-model="motorMode" size="small" class="motor-mode-group">
        <el-radio-button label="brushless">无刷</el-radio-button>
        <el-radio-button label="brushed">有刷</el-radio-button>
      </el-radio-group>
      <div class="cfg-tip">
        {{ motorMode === 'brushless' ? '无刷：解析 .a2l 变量' : '有刷：解析 .mapxml 符号' }}
      </div>
    </div>

    <!-- 继电器模块 / CAN 通道（Function、CAN、三包 模块生成共用 RelayON/RelayOFF 时使用） -->
    <template v-if="isRelayModule">
      <div class="sidebar-section relay-section">
        <div class="section-title">CAN 通道</div>
        <div class="seg-slider-row">
          <div class="seg-slider two-seg">
            <div
              v-for="opt in CAN_CHANNEL_OPTIONS"
              :key="opt.value"
              class="seg-item"
              :class="{ active: relayConfig.canChannel === opt.value }"
              @click="onRelayChannelChange(opt.value)"
            >{{ opt.label }}</div>
          </div>
        </div>
      </div>

      <div class="sidebar-section relay-section">
        <div class="section-title">继电器模块</div>
        <div class="seg-slider-row">
          <div class="seg-slider three-seg">
            <div
              v-for="opt in RELAY_MODULE_OPTIONS"
              :key="opt.value"
              class="seg-item"
              :class="{ active: relayConfig.relayModule === opt.value }"
              @click="onRelayModuleChange(opt.value)"
            >{{ opt.label }}</div>
          </div>
        </div>
      </div>
    </template>

    <!-- CFG 文件上传（独立，全局共享）/ Creat CANoe 模块时改为输出路径 -->
    <div class="sidebar-section cfg-section">
      <div class="section-title">
        <span>{{ isCreateCanoeMode ? '输出路径' : 'CFG 配置文件' }}</span>
        <el-tag v-if="!isCreateCanoeMode && cfgData.a2l_qualifier" size="small" type="success">已解析</el-tag>
      </div>

      <!-- ===== Creat CANoe 模式：输出路径选择 ===== -->
      <template v-if="isCreateCanoeMode">
        <!-- 点击选择文件夹 -->
        <div
          class="cfg-uploader-native"
          @click="onSelectOutputDir"
        >
          <el-icon class="el-icon--upload"><Folder /></el-icon>
          <div class="el-upload__text">
            <template v-if="createCanoeOutputDir">已选择目录</template>
            <template v-else>点击选择输出文件夹</template>
          </div>
        </div>
        <!-- 路径输入框（始终显示，浏览器模式手动输入） -->
        <el-input
          v-model="createCanoeOutputDir"
          placeholder="输入或选择输出目录路径"
          clearable
          size="small"
          class="output-dir-input"
        >
          <template #append>
            <el-button :icon="Folder" @click="onSelectOutputDir" />
          </template>
        </el-input>
        <div class="cfg-tip">
          生成的 CANoe 配置将输出到此目录
        </div>
      </template>

      <!-- ===== 其他模块：CFG 解析 ===== -->
      <template v-else>
        <!-- Electron 模式：点击触发系统文件选择对话框 -->
        <div
          v-if="isElectron"
          class="cfg-uploader-native"
          @click="onCfgClickNative"
          :class="{ disabled: cfgParsing }"
        >
          <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
          <div class="el-upload__text">
            <template v-if="cfgParsing">解析中...</template>
            <template v-else>点击选择 .cfg 文件</template>
          </div>
        </div>
        <!-- 浏览器模式：路径输入框 + 解析按钮 -->
        <div v-else class="cfg-path-input-row">
          <el-input
            v-model="cfgPathInput"
            placeholder="输入 .cfg 完整路径"
            :disabled="cfgParsing"
            clearable
            @keyup.enter="onCfgPathParse"
          />
          <el-button
            type="primary"
            :loading="cfgParsing"
            :disabled="!cfgPathInput.trim()"
            @click="onCfgPathParse"
          >
            解析
          </el-button>
        </div>
        <div class="cfg-tip">
          通过 CANoe COM 接口解析（需原始路径以加载 a2l/dbc）
        </div>
      </template>
    </div>
    
    <!-- 模块文件上传（三包模块不需要文件上传，复用 CFG 解析的对象） -->
    <div v-if="store.activeModule !== 'sanbao'" class="sidebar-section">
      <div class="section-title">{{ moduleLabel }} 文件上传</div>
      <el-upload
        class="unified-uploader"
        drag
        multiple
        :auto-upload="false"
        :show-file-list="false"
        :accept="currentAccept"
        :on-change="onFileChange"
        :disabled="parsing"
      >
        <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
        <div class="el-upload__text">
          <template v-if="parsing">解析中...</template>
          <template v-else>拖拽文件或 <em>点击上传</em></template>
        </div>
        <template #tip>
          <div class="el-upload__tip">
            {{ acceptTip }}
          </div>
        </template>
      </el-upload>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useModuleStore, type CanMotorMode, type RelayModule, type RelayConfigModule } from '@/stores/modules'
import OemSelector from './OemSelector.vue'
import { UploadFilled, Folder } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { parseCAN, parseDbcFile, parseA2lFile, parseMapxmlFile, parseCfgFromPath, dbcToExcel, excelToDbc } from '@/api/can'
import { parseBoot } from '@/api/boot'
import { parseUDS } from '@/api/uds'
import { parseFunction } from '@/api/function'

defineProps<{ width: number }>()

const store = useModuleStore()
const parsing = ref(false)
const cfgParsing = ref(false)
const isElectron = !!(window as any).electronAPI
const cfgPathInput = ref('')

// Creat CANoe 模块输出目录
const createCanoeOutputDir = ref('')

const isCreateCanoeMode = computed(() => store.activeModule === 'create_canoe')

// CAN 模块电机类型：无刷（默认，解析 .a2l）/ 有刷（解析 .mapxml）
const motorMode = computed<CanMotorMode>({
  get: () => store.canMotorMode,
  set: (v) => store.setCanMotorMode(v),
})

// ==================== 继电器模块 / CAN 通道（Function、CAN 模块） ====================
// 取值与 Create CANoe 一致（0=老 1=单刀 2=双刀；通道 1/2），默认「双刀 + 通道 2」
// 是为了与这两个模块改造前的内联实现保持一致，不配置时生成结果不变。
const RELAY_MODULE_OPTIONS: Array<{ label: string; value: RelayModule }> = [
  { label: '老', value: 0 },
  { label: '单掷', value: 1 },
  { label: '双掷', value: 2 },
]
const CAN_CHANNEL_OPTIONS = [
  { label: '1', value: 1 },
  { label: '2', value: 2 },
]
/** Function / CAN / 三包 三个模块使用继电器配置 */
const relayModuleKey = computed<RelayConfigModule | null>(() =>
  store.activeModule === 'function' || store.activeModule === 'can' || store.activeModule === 'sanbao'
    ? store.activeModule
    : null,
)
const isRelayModule = computed(() => relayModuleKey.value !== null)
const relayConfig = computed(() => store.relayConfigs[relayModuleKey.value ?? 'function'])
function onRelayModuleChange(v: RelayModule) {
  if (relayModuleKey.value) store.setRelayConfig(relayModuleKey.value, { relayModule: v })
}
function onRelayChannelChange(v: number) {
  if (relayModuleKey.value) store.setRelayConfig(relayModuleKey.value, { canChannel: v })
}

// 监听输出目录变化，同步到 store
watch(createCanoeOutputDir, (val) => {
  if (store.activeModule === 'create_canoe') {
    const existing = store.moduleStates.create_canoe.lastUploadResult || {}
    store.setModuleUploadResult('create_canoe', { ...existing, outputDir: val })
  }
})

// CFG 解析结果（全局共享）
const cfgData = ref({
  a2l_qualifier: '',
  a2l_path: '',
  cdd_qualifier: '',
  cdd_path: '',
  databases: [] as Array<{ name: string; path: string }>,
  cfg_dir: '',
})

const moduleLabels: Record<string, string> = {
  boot: 'Boot',
  uds: 'UDS',
  function: 'Function',
  can: 'CAN',
  create_canoe: 'Creat CANoe',
  sanbao: '三包',
}

const moduleLabel = computed(() => moduleLabels[store.activeModule] || '模块')

const acceptMap: Record<string, string> = {
  boot: '.xlsx,.xls',
  uds: '.zip,.xlsx,.xls',
  function: '.xlsx,.xls,.dbc,.a2l',
  create_canoe: '.xlsx,.xls,.dbc',
}

const acceptTipMap: Record<string, string> = {
  boot: '支持 .xlsx / .xls 格式',
  uds: '支持 .zip / .xlsx / .xls 格式',
  function: '支持 .xlsx / .xls / .dbc / .a2l 格式',
  create_canoe: '支持 .xlsx / .xls / .dbc 格式（用于生成 CANoe 配置）',
}

// CAN 模块按电机类型二选一：无刷解析 .a2l，有刷解析 .mapxml
const currentAccept = computed(() => {
  if (store.activeModule === 'can') {
    return store.canMotorMode === 'brushed' ? '.xlsx,.xls,.dbc,.mapxml' : '.xlsx,.xls,.dbc,.a2l'
  }
  return acceptMap[store.activeModule] || '.xlsx,.xls'
})
const acceptTip = computed(() => {
  if (store.activeModule === 'can') {
    return store.canMotorMode === 'brushed'
      ? '支持 .xlsx / .xls / .dbc / .mapxml 格式'
      : '支持 .xlsx / .xls / .dbc / .a2l 格式'
  }
  return acceptTipMap[store.activeModule] || '支持 .xlsx / .xls 格式'
})

function getFileType(filename: string): { type: string; typeLabel: string } | null {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) return { type: 'excel', typeLabel: 'Excel' }
  if (lower.endsWith('.dbc')) return { type: 'dbc', typeLabel: 'DBC' }
  if (lower.endsWith('.cfg')) return { type: 'cfg', typeLabel: 'CFG' }
  if (lower.endsWith('.a2l')) return { type: 'a2l', typeLabel: 'A2L' }
  if (lower.endsWith('.mapxml')) return { type: 'mapxml', typeLabel: 'MAPXML' }
  if (lower.endsWith('.zip')) return { type: 'zip', typeLabel: 'ZIP' }
  return null
}

// Electron 环境：点击弹出系统文件选择对话框
async function onCfgClickNative() {
  if (cfgParsing.value) return

  const filePath = await (window as any).electronAPI.selectFile({
    title: '选择 CFG 配置文件',
    filters: [['CFG 文件', '*.cfg']]
  })
  if (!filePath) return

  cfgParsing.value = true
  try {
    const res: any = await parseCfgFromPath(filePath)
    const data = res?.data || {}

    cfgData.value = {
      a2l_qualifier: data.a2l_qualifier || '',
      a2l_path: data.a2l_path || '',
      cdd_qualifier: data.cdd_qualifier || '',
      cdd_path: data.cdd_path || '',
      databases: data.databases || [],
      cfg_dir: data.cfg_dir || '',
    }

    store.setCfgData(cfgData.value)

    // 加载 CFG 目录下的 DBC 文件到对象浏览器
    if (data.cfg_dir) {
      store.loadDbcFromCfgDir(data.cfg_dir)
    }

    const fields = []
    if (data.a2l_qualifier) fields.push(`A2L: ${data.a2l_qualifier}`)
    if (data.cdd_qualifier) fields.push(`CDD: ${data.cdd_qualifier}`)
    if (data.databases?.length) {
      const dbcNames = data.databases
        .filter((d: any) => d.path?.toLowerCase().endsWith('.dbc'))
        .map((d: any) => d.name)
      if (dbcNames.length) fields.push(`DBC: ${dbcNames.join(', ')}`)
    }

    ElMessage.success(`CFG 解析成功：${fields.join(', ') || '已解析'}`)
  } catch (e: any) {
    console.error('[CFG] 解析失败:', e)
    ElMessage.error(`CFG 解析失败: ${e?.message || e}`)
  } finally {
    cfgParsing.value = false
  }
}

// 浏览器模式：用户手动输入 cfg 完整路径后点击解析
// 走 /parse-cfg-path 接口，使用原始路径，CANoe 才能正确解析 a2l/cdd/dbc 相对路径引用
async function onCfgPathParse() {
  const path = cfgPathInput.value.trim()
  if (!path) {
    ElMessage.warning('请输入 .cfg 文件完整路径')
    return
  }

  if (!path.toLowerCase().endsWith('.cfg')) {
    ElMessage.warning('请输入 .cfg 格式的文件路径')
    return
  }

  cfgParsing.value = true
  try {
    const res: any = await parseCfgFromPath(path)
    const data = res?.data || {}

    cfgData.value = {
      a2l_qualifier: data.a2l_qualifier || '',
      a2l_path: data.a2l_path || '',
      cdd_qualifier: data.cdd_qualifier || '',
      cdd_path: data.cdd_path || '',
      databases: data.databases || [],
      cfg_dir: data.cfg_dir || '',
    }

    store.setCfgData(cfgData.value)

    // 加载 CFG 目录下的 DBC 文件到对象浏览器
    if (data.cfg_dir) {
      store.loadDbcFromCfgDir(data.cfg_dir)
    }

    const fields = []
    if (data.a2l_qualifier) fields.push(`A2L: ${data.a2l_qualifier}`)
    if (data.cdd_qualifier) fields.push(`CDD: ${data.cdd_qualifier}`)
    if (data.databases?.length) {
      const dbcNames = data.databases
        .filter((d: any) => d.path?.toLowerCase().endsWith('.dbc'))
        .map((d: any) => d.name)
      if (dbcNames.length) fields.push(`DBC: ${dbcNames.join(', ')}`)
    }

    ElMessage.success(`CFG 解析成功：${fields.join(', ') || '已解析'}`)
  } catch (e: any) {
    console.error('[CFG] 解析失败:', e)
    ElMessage.error(`CFG 解析失败: ${e?.message || e}`)
  } finally {
    cfgParsing.value = false
  }
}

// 模块文件上传处理
async function onFileChange(uploadFile: any) {
  const file = uploadFile?.raw || uploadFile
  if (!file) return

  // CAN 模块：无刷只解析 .a2l，有刷只解析 .mapxml（二者互斥）
  if (store.activeModule === 'can') {
    const lower = file.name.toLowerCase()
    if (lower.endsWith('.a2l') && store.canMotorMode === 'brushed') {
      ElMessage.warning('有刷模式下请上传 .mapxml 文件')
      return
    }
    if (lower.endsWith('.mapxml') && store.canMotorMode === 'brushless') {
      ElMessage.warning('无刷模式下请上传 .a2l 文件')
      return
    }
  }

  const fileInfo = getFileType(file.name)
  if (!fileInfo) {
    ElMessage.warning('不支持的文件格式')
    return
  }

  parsing.value = true

  try {
    const module = store.activeModule

    if (module === 'can') {
      await handleCanUpload(file, fileInfo)
    } else if (module === 'create_canoe') {
      await handleCreateCanoeUpload(file, fileInfo)
    } else if (module === 'boot') {
      const res: any = await parseBoot(file)
      store.setModuleUploadResult('boot', res)
      ElMessage.success('Excel 解析成功')
    } else if (module === 'uds') {
      // UDS 模块只接受 Excel 配置文件（与源码 AutoTool.py 一致）
      // 模板 zip 通过 PyInstaller 打包到 exe 内部，无需用户上传
      const lowerName = file.name.toLowerCase()
      if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) {
        const res: any = await parseUDS(file)
        store.setModuleUploadResult('uds', res)
        ElMessage.success('Excel 解析成功')
      } else {
        ElMessage.error('UDS 仅支持 .xlsx / .xls 文件')
      }
    } else if (module === 'function') {
      if (fileInfo.type === 'dbc') {
        // 功能模块本身不消费 DBC（配置来自功能用例 Excel），但对象浏览器共享 DBC 数据：
        // .dbc 必须走 DBC 解析并载入对象浏览器。丢给「功能用例 Excel」解析器会直接 500。
        const res: any = await parseDbcFile(file)
        const raw = res?.data || res
        if (raw?.columns && raw?.rows) {
          store.setUploadDbc(raw)
          ElMessage.success(`DBC 解析成功，已载入对象浏览器（${raw.rows.length} 行）`)
        } else {
          ElMessage.error('DBC 解析返回数据异常')
        }
      } else if (fileInfo.type === 'a2l') {
        // 与 .dbc 同理：功能模块本身不消费 A2L，但对象浏览器共享 A2L 变量，
        // 单独解析后直接载入（FunctionView 的 ObjectPanel 读的就是 store.objA2lVars）
        const res: any = await parseA2lFile(file)
        const data = res?.data || {}
        store.setA2lVars({
          measurements: data.measurements || [],
          characteristics: data.characteristics || [],
        })
        ElMessage.success(
          data.total_vars
            ? `A2L 解析成功，已载入对象浏览器（${data.total_vars} 个变量）`
            : 'A2L 解析完成，未提取到变量'
        )
      } else {
        const res: any = await parseFunction(file)
        store.setModuleUploadResult('function', res)
        ElMessage.success('文件解析成功')
      }
    }
  } catch {
    ElMessage.error(`${fileInfo.typeLabel} 解析失败`)
  } finally {
    parsing.value = false
  }
}

async function handleCanUpload(file: File, fileInfo: { type: string; typeLabel: string }) {
  if (fileInfo.type === 'excel') {
    const res: any = await parseCAN(file)
    const parsed = res?.data || res || {}
    // Excel 允许只包含部分工作表：DBC Canmatrix / DTC / DataLinkLayer 任一存在即解析成功
    const sheets: string[] = []
    if (parsed.DBC) sheets.push('DBC Canmatrix')
    if (parsed.DTC) sheets.push('DTC')
    if (parsed.DataLinkLayer) sheets.push('DataLinkLayer')
    if (sheets.length) {
      store.setModuleUploadResult('can', { type: 'excel', data: parsed })
      ElMessage.success(`Excel 解析成功：${sheets.join('、')}`)
    } else {
      ElMessage.error('Excel 解析失败，未找到 DBC Canmatrix / DTC / DataLinkLayer 工作表')
    }
  } else if (fileInfo.type === 'dbc') {
    const res: any = await parseDbcFile(file)
    const raw = res?.data || res
    if (raw?.columns && raw?.rows) {
      store.setModuleUploadResult('can', { type: 'dbc', data: raw })
      ElMessage.success(res?.message || 'DBC 解析成功')
    } else {
      ElMessage.error('DBC 解析返回数据异常')
    }
  } else if (fileInfo.type === 'a2l') {
    const res: any = await parseA2lFile(file)
    store.setModuleUploadResult('can', { type: 'a2l', data: res?.data || {} })
    const data = res?.data || {}
    const fields = []
    if (data.total_vars) fields.push(`${data.total_vars} 个变量`)
    ElMessage.success(
      fields.length
        ? `A2L 解析成功，已回填：${fields.join('、')}`
        : 'A2L 解析完成，未提取到关键字段'
    )
  } else if (fileInfo.type === 'mapxml') {
    const res: any = await parseMapxmlFile(file)
    store.setModuleUploadResult('can', { type: 'mapxml', data: res?.data || {} })
    const data = res?.data || {}
    ElMessage.success(
      data.total_vars
        ? `MAPXML 解析成功，已回填：${data.total_vars} 个符号`
        : 'MAPXML 解析完成，未提取到符号'
    )
  }
}

async function handleCreateCanoeUpload(file: File, fileInfo: { type: string; typeLabel: string }) {
  // 保留之前已设置的 outputDir，避免上传文件时覆盖丢失导致"生成配置"按钮禁用
  const prev = store.moduleStates.create_canoe.lastUploadResult || {}
  if (fileInfo.type === 'excel') {
    const res: any = await parseCAN(file)
    const data = res?.data || {}
    store.setModuleUploadResult('create_canoe', {
      ...prev, type: 'excel', data: data, fileName: file.name, file: file,
    })
    ElMessage.success('Excel 解析成功')
  } else if (fileInfo.type === 'dbc') {
    const res: any = await parseDbcFile(file)
    const raw = res?.data || res
    if (raw?.columns && raw?.rows) {
      store.setModuleUploadResult('create_canoe', {
        ...prev, type: 'dbc', data: raw, fileName: file.name, file: file,
      })
      ElMessage.success('DBC 解析成功')
    } else {
      ElMessage.error('DBC 解析返回数据异常')
    }
  }
}

// 选择输出目录（Electron 环境）
async function onSelectOutputDir() {
  const electronAPI = (window as any).electronAPI
  if (electronAPI?.selectFolder) {
    const dir = await electronAPI.selectFolder({ title: '选择输出目录' })
    if (dir) {
      createCanoeOutputDir.value = dir
      store.setModuleUploadResult('create_canoe', {
        ...(store.moduleStates.create_canoe.lastUploadResult || {}),
        outputDir: dir,
      })
      ElMessage.success('输出目录已设置')
    }
  } else {
    ElMessage.info('浏览器模式下请手动输入输出目录路径')
  }
}
</script>

<style scoped lang="scss">
.global-sidebar {
  width: 280px;
  background: var(--bg-card);
  border-right: 1px solid var(--border-color-light);
  display: flex;
  flex-direction: column;
  padding: 12px;
  gap: 10px;
  flex-shrink: 0;
  overflow-y: auto;
}

.sidebar-section {
  background: var(--bg-page);
  border-radius: 12px;
  padding: 10px;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 12px;
  padding-left: 4px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.cfg-section {
  background: linear-gradient(135deg, var(--bg-page) 0%, rgba(64, 158, 255, 0.05) 100%);
}

.cfg-uploader,
.unified-uploader {
  width: 100%;
}

.cfg-uploader-native {
  width: 100%;
  padding: 16px;
  border: 2px dashed var(--border-color-light);
  border-radius: 8px;
  background: var(--bg-card);
  text-align: center;
  cursor: pointer;
  transition: border-color 0.2s;
}

.cfg-uploader-native:hover {
  border-color: var(--primary-color);
}

.cfg-uploader-native.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cfg-uploader-native .el-icon--upload {
  font-size: 40px;
  color: var(--text-color-secondary);
  margin-bottom: 8px;
}

.cfg-uploader :deep(.el-upload-dragger),
.unified-uploader :deep(.el-upload-dragger) {
  width: 100%;
  padding: 16px;
  border: 2px dashed var(--border-color-light);
  border-radius: 8px;
  background: var(--bg-card);
}

.cfg-uploader :deep(.el-upload-dragger:hover),
.unified-uploader :deep(.el-upload-dragger:hover) {
  border-color: var(--primary-color);
}

// 浏览器模式：路径输入框 + 解析按钮
.cfg-path-input-row {
  display: flex;
  gap: 8px;
  align-items: center;

  :deep(.el-input) {
    flex: 1;
  }

  :deep(.el-input__wrapper) {
    padding: 4px 10px;
  }

  .el-button {
    flex-shrink: 0;
  }
}

.cfg-tip {
  margin-top: 8px;
  font-size: 11px;
  color: var(--text-color-secondary);
  line-height: 1.5;
  padding-left: 2px;
}

.motor-mode-group {
  display: flex;
  width: 100%;

  :deep(.el-radio-button) {
    flex: 1;
  }

  :deep(.el-radio-button__inner) {
    width: 100%;
  }
}

/* ===== 分段式滑块（CAN通道 / 继电器模块） ===== */
/* 内容只有一行滑块，卡片比其它区块更紧凑 */
.relay-section {
  padding: 6px 8px;

  .section-title {
    margin-bottom: 6px;
    font-size: 12px;
  }

  .seg-item {
    padding: 3px 0;
    font-size: 12px;
  }
}

.seg-slider-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.seg-slider {
  display: flex;
  flex: 1;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid var(--el-border-color);
  background: var(--el-fill-color-light);

  &.two-seg .seg-item { flex: 1; }
  &.three-seg .seg-item { flex: 1; }
}

.seg-item {
  padding: 4px 0;
  text-align: center;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  user-select: none;
  color: var(--el-text-color-regular);
  transition: all 0.2s;

  &:hover {
    background: var(--el-fill-color);
  }

  &.active {
    background: var(--el-color-primary);
    color: #fff;
  }
}

.output-dir-input {
  margin-top: 8px;

  :deep(.el-input__wrapper) {
    padding: 4px 8px;
  }
}
</style>
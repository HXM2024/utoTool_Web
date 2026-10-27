<template>
  <div class="create-canoe-view">
    <!-- 配置工具栏（保存/加载/删除/复制/共享/拉取） -->
    <ConfigToolbar
      ref="configToolbarRef"
      module-name="great_canoe"
      @config-change="onConfigChange"
      @save="onSave"
      @generate="onGenerateConfig"
      @create="onCreate"
      @refresh="onRefresh"
    />

    <!-- 顶部工具栏 -->
    <div class="view-header">
      <div class="header-left">
        <h2 class="view-title">Creat CANoe</h2>
        <span class="view-sub">上传 Excel/DBC，拖拽配置 CRC/Counter，一键生成完整 CANoe 工程</span>
      </div>
      <div class="header-center">
        <div class="gen-options">
          <el-checkbox v-model="genOptions.envvar">生成环境变量</el-checkbox>
          <el-checkbox v-model="genOptions.panel">生成面板</el-checkbox>
          <el-checkbox v-model="genOptions.nodes">生成节点仿真</el-checkbox>
        </div>
      </div>
      <div class="header-right">
        <el-button
          type="primary"
          size="large"
          :loading="generating"
          :disabled="!treeData.length || !outputDir"
          @click="onGenerateConfig"
        >
          <el-icon><MagicStick /></el-icon>
          生成配置
        </el-button>
      </div>
    </div>

    <!-- 主内容区：信号矩阵树 -->
    <div class="main-layout">
      <!-- 左侧树形图 -->
      <div class="tree-panel">
        <div class="panel-header">
          <span class="panel-title">信号矩阵</span>
          <div class="panel-tools">
            <el-tag v-if="fileName" size="small" type="info">{{ fileName }}</el-tag>
            <el-tag v-if="msgCount" size="small">{{ msgCount }} 报文</el-tag>
            <el-tag v-if="sigCount" size="small" type="success">{{ sigCount }} 信号</el-tag>
            <el-input
              v-model="searchKeyword"
              placeholder="搜索..."
              :prefix-icon="Search"
              clearable
              size="small"
              data-shortcut-search
              class="search-input"
            />
            <el-button size="small" :icon="Expand" @click="expandAll">全部展开</el-button>
            <el-button size="small" :icon="Fold" @click="collapseAll">全部折叠</el-button>
          </div>
        </div>
        <div class="signal-drag-hint">
          <el-icon><Rank /></el-icon>
          <span>双击属性可编辑；拖拽 CRC/Counter 标签到信号节点上</span>
        </div>
        <div class="tree-wrapper" :style="{ height: treeHeight + 'px' }">
          <el-empty
            v-if="!treeData.length"
            description="请在左侧栏上传 Excel 或 DBC 文件"
            :image-size="80"
          />
          <el-tree
            v-else
            ref="treeRef"
            :data="treeData"
            node-key="id"
            :props="treeProps"
            :expand-on-click-node="false"
            :filter-node-method="filterNode"
            class="signal-tree"
            @node-click="onNodeClick"
            @expand-change="onExpandChange"
          >
            <template #default="{ data }">
              <div
                class="tree-node"
                :class="data.type"
                @dragover.prevent="onDragOver($event, data)"
                @dragleave.prevent="onDragLeave($event, data)"
                @drop.prevent="onDrop($event, data)"
              >
                <el-icon class="node-icon" :class="data.type">
                  <component :is="getNodeIcon(data.type)" />
                </el-icon>

                <template v-if="data.type === 'node'">
                  <template v-if="editingNode === data">
                    <input
                      :value="data.label"
                      class="node-edit-input"
                      @input="e => data.label = (e.target as HTMLInputElement).value"
                      @blur="finishNodeEdit"
                      @keyup.enter="finishNodeEdit"
                      @keyup.esc="cancelNodeEdit"
                    />
                  </template>
                  <template v-else>
                    <span class="node-label" @dblclick="startNodeEdit(data)">{{ data.label }}</span>
                  </template>
                </template>
                <template v-else>
                  <span class="node-label">{{ data.label }}</span>
                </template>

                <template v-if="data.type === 'message'">
                  <el-tag size="small" type="info" class="msg-tag">
                    0x{{ (data.msgId || 0).toString(16).toUpperCase() }}
                  </el-tag>
                  <el-tag size="small" class="msg-tag dlc">
                    DLC: {{ data.dlc }}
                  </el-tag>
                  <div class="node-attrs">
                    <span
                      v-for="attr in data.attrs"
                      :key="attr.key"
                      class="attr-item"
                      @dblclick.stop="startAttrEdit(data, attr)"
                    >
                      <template v-if="editingAttr === attr">
                        <input
                          :value="attr.value"
                          class="attr-edit-input"
                          @input="e => attr.value = (e.target as HTMLInputElement).value"
                          @blur="finishAttrEdit"
                          @keyup.enter="finishAttrEdit"
                          @keyup.esc="cancelAttrEdit"
                        />
                      </template>
                      <template v-else>
                        <span class="attr-key">{{ attr.label }}:</span>
                        <span class="attr-value">{{ attr.value || '-' }}</span>
                      </template>
                    </span>
                  </div>
                </template>

                <template v-else-if="data.type === 'signal'">
                  <div class="signal-tags">
                    <el-tag
                      v-if="data.genSigFuncType"
                      size="small"
                      type="danger"
                      effect="dark"
                      class="sig-tag"
                      closable
                      @close="data.genSigFuncType = ''"
                    >{{ data.genSigFuncType }}</el-tag>
                    <!-- 新增 E2E 算法需要按信号填写 DateID（十六进制，如 0x1122） -->
                    <el-input
                      v-if="isDateIdAlgo(data.genSigFuncType)"
                      :model-value="data.dataId"
                      class="sig-dataid-input"
                      size="small"
                      placeholder="DateID 如 0x1122"
                      @click.stop
                      @keydown.stop
                      @update:model-value="(v: string) => onNodeDateIdInput(data, v)"
                      @change="(v: string) => onNodeDateIdCommit(data, v)"
                    />
                  </div>
                </template>

                <template v-else-if="data.type === 'attr'">
                  <div class="attr-node">
                    <template v-if="editingAttr === data.attrRef">
                      <input
                        :value="data.attrRef.value"
                        class="attr-edit-input"
                        @input="e => data.attrRef.value = (e.target as HTMLInputElement).value"
                        @blur="finishAttrEdit"
                        @keyup.enter="finishAttrEdit"
                        @keyup.esc="cancelAttrEdit"
                      />
                    </template>
                    <template v-else>
                      <span class="attr-key" @dblclick.stop="startAttrEdit(data, data.attrRef)">{{ data.label }}:</span>
                      <span class="attr-value" @dblclick.stop="startAttrEdit(data, data.attrRef)">{{ data.attrRef?.value || '-' }}</span>
                    </template>
                  </div>
                </template>
              </div>
            </template>
          </el-tree>
        </div>
      </div>

      <!-- 右侧配置面板 -->
      <div class="config-panel">
        <div class="panel-header">
          <span class="panel-title">信号配置</span>
        </div>
        <div class="config-body">
          <!-- <div class="drag-hint">
            <el-icon><InfoFilled /></el-icon>
            <span>拖拽下方标签到树形图的信号节点上</span>
          </div> -->

          <!-- unusedByte 开关（控制 EPS 空白位检测的期望值） -->
          <div class="drag-section">
            <div
              class="other-slider-row"
              :class="{ 'other-slider-row--on': unusedByteValue === 1 }"
              @click="unusedByteValue = unusedByteValue === 1 ? 0 : 1"
              style="justify-content: flex-start; gap: 20px;"  
            >
              <span class="other-slider-label">unusedByte</span>
              <el-switch
                :model-value="unusedByteValue === 1"
                @update:model-value="(v: boolean) => unusedByteValue = v ? 1 : 0"
                active-text="TRUE"
                inactive-text="FALSE"
                inline-prompt
                size="small"
                @click.stop
                class="wide-switch"   
              />
            </div>
          </div>

          <!-- Ready 信号配置 -->
          <div class="drag-section">
            <div class="section-label">Ready</div>
            <div class="ready-row">
              <el-input
                v-model="readyConfig.signal"
                placeholder="信号名"
                size="small"
                class="ready-input-signal"
              />
              <el-input
                v-model="readyConfig.onValue"
                placeholder="ReadyOn"
                size="small"
                class="ready-input-value"
              />
              <el-input
                v-model="readyConfig.offValue"
                placeholder="ReadyOff"
                size="small"
                class="ready-input-value"
              />
            </div>
          </div>

          <!-- CarSpd 信号配置 -->
          <div class="drag-section">
            <div class="section-label">CarSpd</div>
            <div class="ready-row">
              <el-input
                v-model="carSpdConfig.signal"
                placeholder="车速信号名"
                size="small"
                class="ready-input-signal"
              />
            </div>
          </div>

          <!-- CAN 通道（两段式滑块 0/1） -->
          <div class="drag-section">
            <div class="section-label">CAN通道</div>
            <div class="seg-slider-row">
              <div class="seg-slider two-seg">
                <div
                  v-for="opt in [{label:'1', value:1}, {label:'2', value:2}]"
                  :key="opt.value"
                  class="seg-item"
                  :class="{ active: canChannel === opt.value }"
                  @click="canChannel = opt.value"
                >{{ opt.label }}</div>
              </div>
            </div>
          </div>

          <!-- 继电器模块（三段式：老/单掷/双掷） -->
          <div class="drag-section">
            <div class="section-label">继电器模块</div>
            <div class="seg-slider-row">
              <div class="seg-slider three-seg">
                <div
                  v-for="opt in relayOptions"
                  :key="opt.value"
                  class="seg-item"
                  :class="{ active: relayModule === opt.value }"
                  @click="relayModule = opt.value"
                >{{ opt.label }}</div>
              </div>
            </div>
          </div>

          <!-- DTC 列表（小卡片） -->
          <div class="drag-section">
            <div class="section-label">DTC白名单</div>
            <div class="dtc-input-row">
              <el-input
                v-model="dtcInput"
                placeholder="输入 DTC（如 0x112233）"
                size="small"
                class="dtc-input"
                @keyup.enter="addDtc"
              />
              <el-button
                type="primary"
                size="small"
                :icon="Plus"
                circle
                @click="addDtc"
              />
            </div>
            <div class="dtc-tags" v-if="dtcList.length">
              <el-tag
                v-for="(dtc, idx) in dtcList"
                :key="idx"
                closable
                size="small"
                type="danger"
                effect="dark"
                @close="removeDtc(idx)"
              >{{ dtc }}</el-tag>
            </div>
          </div>

          <!-- GenSigFuncType 标签 -->
          <div class="drag-section">
            <div class="section-label">
              GenSigFuncType
              <el-button
                size="small"
                text
                type="primary"
                :icon="Plus"
                @click="onAddCrc"
              >新增</el-button>
              <el-button
                size="small"
                text
                type="success"
                :loading="crcLoading"
                @click="onPullCrc"
              >拉取</el-button>
            </div>
            <div class="drag-tags">
              <div
                v-for="ft in genSigFuncTypes"
                :key="ft.value"
                class="drag-tag crc-tag"
                :class="{ 'crc-tag-editable': ft.isCrc }"
                draggable="true"
                @dragstart="onDragStart($event, ft.value, 'gensigfunctype')"
                @dblclick="ft.isCrc && onCrcDblClick(ft.value)"
              >
                <el-icon><Cpu /></el-icon>
                <span>{{ ft.label }}</span>
              </div>
            </div>
            <div class="crc-hint">双击 CRC 算法卡片可编辑代码</div>
          </div>

          <!-- 已配置信号列表 -->
          <div class="drag-section">
            <div class="section-label">
              已配置信号
              <el-tag size="small" type="info">{{ configuredSignals.length }}</el-tag>
            </div>
            <div class="configured-list">
              <div
                v-for="item in configuredSignals"
                :key="item.id"
                class="configured-item"
              >
                <div class="item-info">
                  <span class="item-signal">{{ item.signalName }}</span>
                  <span class="item-msg">{{ item.msgName }}</span>
                </div>
                <div class="item-tags">
                  <el-tag
                    v-if="item.genSigFuncType"
                    size="small"
                    type="danger"
                    effect="dark"
                  >{{ item.genSigFuncType }}</el-tag>
                  <el-button
                    size="small"
                    text
                    type="danger"
                    :icon="Delete"
                    @click="clearSignalConfig(item)"
                  />
                </div>
              </div>
              <el-empty
                v-if="!configuredSignals.length"
                description="尚未配置信号"
                :image-size="40"
              />
            </div>
          </div>

          <!-- 版本发布信息（写入《释放记录.txt》） -->
          <div class="drag-section">
            <div class="section-label">版本发布信息</div>
            <div class="release-form">
              <div class="release-row">
                <span class="release-label">版本号</span>
                <el-input
                  v-model="releaseConfig.version"
                  size="small"
                  placeholder="如 V1.0.01（留空自动递增）"
                />
              </div>
              <div class="release-row">
                <span class="release-label">作者</span>
                <el-input
                  v-model="releaseConfig.author"
                  size="small"
                  placeholder="留空默认「作者」"
                />
              </div>
              <div class="release-row release-row-block">
                <span class="release-label">变更说明</span>
                <el-input
                  v-model="releaseConfig.changeNote"
                  type="textarea"
                  :rows="3"
                  size="small"
                  placeholder="功能调整 / 问题修复等变更记录（追加到《释放记录.txt》）"
                />
              </div>
            </div>
          </div>

          <!-- 清空配置 -->
          <div class="drag-section" v-if="configuredSignals.length">
            <el-button
              type="danger"
              plain
              size="small"
              :icon="Delete"
              @click="clearAllConfig"
            >
              清空所有配置
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <!-- 生成结果弹窗 -->
    <el-dialog v-model="showResult" title="生成结果" width="600px">
      <el-alert type="success" :closable="false" show-icon title="CANoe 配置生成成功！" />
      <div class="result-detail">
        <div class="result-row">
          <span class="result-label">输出目录：</span>
          <span class="result-value">{{ generateResult?.output_dir }}</span>
        </div>
        <div class="result-row">
          <span class="result-label">DBC 文件：</span>
          <span class="result-value">{{ generateResult?.dbc_path }}</span>
        </div>
        <div class="result-row">
          <span class="result-label">节点目录：</span>
          <span class="result-value">{{ generateResult?.nodes_dir }}</span>
        </div>
        <div class="result-row">
          <span class="result-label">面板目录：</span>
          <span class="result-value">{{ generateResult?.panels_dir }}</span>
        </div>
        <div v-if="generateResult?.cdd_dll_dir" class="result-row">
          <span class="result-label">CDD&amp;DLL：</span>
          <span class="result-value">{{ generateResult.cdd_dll_dir }}</span>
          <el-tag v-if="generateResult?.cdd_path" size="small" type="success">CDD已复制</el-tag>
          <el-tag v-else size="small" type="info">无对应主机厂CDD</el-tag>
          <el-tag v-if="generateResult?.dll_path" size="small" type="success">DLL已复制</el-tag>
        </div>
        <div v-if="generateResult?.cdd_import_result" class="result-row">
          <span class="result-label">CDD/DLL 导入：</span>
          <span class="result-value">{{ generateResult.cdd_import_result.message }}</span>
          <el-tag v-if="generateResult.cdd_import_result.success" size="small" type="success">导入成功</el-tag>
          <el-tag v-else size="small" type="danger">导入失败</el-tag>
        </div>
        <div v-if="generateResult?.cfg_path" class="result-row">
          <span class="result-label">CFG 工程：</span>
          <span class="result-value">{{ generateResult.cfg_path }}</span>
          <el-tag size="small" type="success">Application.New 创建成功</el-tag>
        </div>
      </div>
      <template #footer>
        <el-button @click="showResult = false">关闭</el-button>
        <el-button type="primary" @click="openOutputDir">
          打开输出目录
        </el-button>
      </template>
    </el-dialog>

    <!-- CRC 算法编辑弹窗 -->
    <el-dialog
      v-model="showCrcEditor"
      :title="editingCrcName ? '编辑 CRC 算法' : '新增 CRC 算法'"
      width="700px"
      :close-on-click-modal="false"
    >
      <el-form label-width="100px" label-position="left">
        <el-form-item label="算法名称">
          <el-input
            v-model="crcEditForm.name"
            placeholder="如 CRC8_1D_All"
            clearable
          />
        </el-form-item>
        <el-form-item label="CAPL 代码">
          <el-input
            v-model="crcEditForm.code"
            type="textarea"
            :rows="18"
            placeholder="byte CRC8_1D_All(byte da[],byte bytelbit[],int dataLength)&#10;{&#10;  ...&#10;  return CRC;&#10;}"
            class="crc-code-editor"
            spellcheck="false"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button
            v-if="editingCrcName"
            type="danger"
            plain
            @click="onDeleteCrc"
          >删除</el-button>
          <el-button @click="showCrcEditor = false">取消</el-button>
          <el-button type="primary" @click="onSaveCrc">保存</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch, nextTick } from 'vue'
import { useModuleStore } from '@/stores/modules'
import { defaultAlgoForOem } from '@/utils/securityAlgo'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Search, Expand, Fold, MagicStick, Cpu,
  InfoFilled, Delete, Rank, Connection, FolderOpened, Plus,
} from '@element-plus/icons-vue'
import ConfigToolbar from '@/components/ConfigToolbar.vue'
import { getConfig, saveConfig } from '@/api/config'
import {
  generateCanoeConfigFromTree,
  getSuggestedReleaseVersion,
  getCrcAlgorithms,
  saveCrcAlgorithms,
  pullCrcAlgorithms,
  type CrcAlgorithm,
} from '@/api/can'

const store = useModuleStore()

const configToolbarRef = ref<InstanceType<typeof ConfigToolbar> | null>(null)
const currentConfig = ref('')

const generating = ref(false)
const showResult = ref(false)
const generateResult = ref<any>(null)
const searchKeyword = ref('')
const treeHeight = ref(600)

const genOptions = reactive({
  envvar: true,
  panel: true,
  nodes: true,
})

// 空白位检测的期望值（0 或 1），对应后端 EPSCheck.can 中的空白位检测
const unusedByteValue = ref(0)
function formatSliderValue(val: number) {
  return String(val)
}

// Ready 信号配置：信号名 + ReadyOn值 + ReadyOff值
const readyConfig = reactive({
  signal: '',
  onValue: '',
  offValue: '',
})

// CarSpd 信号配置：车速信号名
const carSpdConfig = reactive({
  signal: '',
})

// CAN 通道（两段式：1/2）
const canChannel = ref(1)

// 版本发布信息（生成时写入 CANoe 输出目录下的《释放记录.txt》）
const releaseConfig = reactive({
  version: '',
  author: '',
  changeNote: '',
})

/** 刷新建议版本号（依据输出目录已有《释放记录.txt》推断） */
async function refreshSuggestedVersion() {
  if (!outputDir.value) return
  try {
    const effectiveConfigName = currentConfig.value
      || fileName.value.replace(/\.(xlsx|xls|dbc)$/i, '')
      || 'CANoeConfig'
    const res: any = await getSuggestedReleaseVersion(outputDir.value, effectiveConfigName)
    const data = res?.data ?? res ?? {}
    if (data?.version) releaseConfig.version = data.version
  } catch { /* 忽略：留空由后端自动递增 */ }
}

// 继电器模块（三段式：0=老 1=单掷 2=双掷）
const relayModule = ref(0)
const relayOptions = [
  { label: '老', value: 0 },
  { label: '单掷', value: 1 },
  { label: '双掷', value: 2 },
]

// DTC 列表（小卡片）
const dtcList = ref<string[]>([])
const dtcInput = ref('')

function addDtc() {
  const v = dtcInput.value.trim()
  if (!v) {
    ElMessage.warning('请输入 DTC')
    return
  }
  dtcList.value.push(v)
  dtcInput.value = ''
}

function removeDtc(index: number) {
  dtcList.value.splice(index, 1)
}

const treeRef = ref<any>(null)
const treeProps = { label: 'label', children: 'children', disabled: 'disabled' }
const treeData = ref<any[]>([])
const expandedKeys = ref<string[]>([])

const dragData = ref<{ type: string; value: string } | null>(null)
const editingAttr = ref<any>(null)
const editingNode = ref<any>(null)

// CRC 算法列表（从后端加载，可编辑/新增/远程共享）
const crcAlgorithms = ref<CrcAlgorithm[]>([])
const crcLoading = ref(false)

// 需要 DataID 的 E2E CRC 算法：信号节点上显示 DateID 输入框
const DATE_ID_ALGOS = ['E2E_1D_ID_CRC8', 'E2E_1021_CRC16_ID']
function isDateIdAlgo(value: any): boolean {
  return DATE_ID_ALGOS.includes(String(value || ''))
}

/** DateID 边输入边过滤：只保留十六进制字符（最多 4 位），已带 0x 前缀时保留 */
function sanitizeDateIdTyping(raw: any): string {
  const s = String(raw ?? '')
  const hasPrefix = /^\s*0[xX]/.test(s)
  const body = hasPrefix ? s.replace(/^\s*0[xX]/, '') : s
  const digits = body.replace(/[^0-9a-fA-F]/g, '').slice(0, 4).toUpperCase()
  return hasPrefix ? `0x${digits}` : digits
}

/** DateID 提交格式化：统一补 0x 前缀并大写（空值保持空） */
function normalizeDateId(raw: any): string {
  const digits = sanitizeDateIdTyping(raw).replace(/^0[xX]/, '')
  return digits ? `0x${digits}` : ''
}

function onNodeDateIdInput(node: any, value: string) {
  if (node) node.dataId = sanitizeDateIdTyping(value)
}

function onNodeDateIdCommit(node: any, value: string) {
  if (node) node.dataId = normalizeDateId(value)
}

// GenSigFuncType 卡片列表 = Counter（静态）+ CRC 算法（动态）
const genSigFuncTypes = computed(() => {
  const list: { label: string; value: string; isCrc: boolean }[] = [
    { label: 'Counter', value: 'Counter', isCrc: false },
  ]
  for (const algo of crcAlgorithms.value) {
    list.push({ label: algo.name, value: algo.name, isCrc: true })
  }
  return list
})

// CRC 编辑弹窗
const showCrcEditor = ref(false)
const editingCrcName = ref('')      // 原名（编辑时用于查找，新增时为空）
const crcEditForm = reactive({
  name: '',
  code: '',
})

/** 加载 CRC 算法列表 */
async function loadCrcAlgorithms() {
  crcLoading.value = true
  try {
    const res: any = await getCrcAlgorithms()
    crcAlgorithms.value = res?.data?.algorithms || []
  } catch (e: any) {
    ElMessage.error(`加载 CRC 算法失败：${e?.message || e}`)
  } finally {
    crcLoading.value = false
  }
}

/** 双击 CRC 卡片 → 编辑 */
function onCrcDblClick(algoName: string) {
  const algo = crcAlgorithms.value.find(a => a.name === algoName)
  if (!algo) return
  editingCrcName.value = algo.name
  crcEditForm.name = algo.name
  crcEditForm.code = algo.code
  showCrcEditor.value = true
}

/** 新增 CRC 算法 */
function onAddCrc() {
  editingCrcName.value = ''
  crcEditForm.name = ''
  crcEditForm.code = ''
  showCrcEditor.value = true
}

/** 删除 CRC 算法 */
async function onDeleteCrc() {
  if (!editingCrcName.value) return
  try {
    await ElMessageBox.confirm(
      `确认删除算法 "${editingCrcName.value}" ？`,
      '删除确认',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' }
    )
  } catch { return }

  crcAlgorithms.value = crcAlgorithms.value.filter(a => a.name !== editingCrcName.value)
  try {
    await saveCrcAlgorithms(crcAlgorithms.value)
    ElMessage.success('CRC 算法已删除并保存')
    showCrcEditor.value = false
  } catch (e: any) {
    ElMessage.error(`保存失败：${e?.message || e}`)
  }
}

/** 保存 CRC 算法（新增或编辑） */
async function onSaveCrc() {
  const name = crcEditForm.name.trim()
  if (!name) {
    ElMessage.warning('请输入算法名称')
    return
  }
  if (!crcEditForm.code.trim()) {
    ElMessage.warning('请输入 CAPL 代码')
    return
  }

  // 检查重名（新增时检查全部，编辑时排除自身）
  const isEdit = !!editingCrcName.value
  const duplicate = crcAlgorithms.value.some(
    a => a.name === name && (!isEdit || a.name !== editingCrcName.value)
  )
  if (duplicate) {
    ElMessage.warning(`算法名 "${name}" 已存在`)
    return
  }

  if (isEdit) {
    // 编辑：替换原有项
    const idx = crcAlgorithms.value.findIndex(a => a.name === editingCrcName.value)
    if (idx >= 0) {
      crcAlgorithms.value[idx] = { name, code: crcEditForm.code }
    }
  } else {
    // 新增：追加
    crcAlgorithms.value.push({ name, code: crcEditForm.code })
  }

  try {
    await saveCrcAlgorithms(crcAlgorithms.value)
    ElMessage.success(isEdit ? 'CRC 算法已更新并保存' : 'CRC 算法已新增并保存')
    showCrcEditor.value = false
  } catch (e: any) {
    ElMessage.error(`保存失败：${e?.message || e}`)
  }
}

/** 从远程共享拉取 CRC 算法 */
async function onPullCrc() {
  try {
    crcLoading.value = true
    const res: any = await pullCrcAlgorithms(true)
    crcAlgorithms.value = res?.data?.algorithms || []
    const added = res?.data?.added ?? 0
    ElMessage.success(`CRC 算法拉取成功（新增 ${added} 项，本地同名保留）`)
  } catch (e: any) {
    ElMessage.error(`拉取失败：${e?.message || e}`)
  } finally {
    crcLoading.value = false
  }
}

const fileName = computed(() => {
  const upload = store.moduleStates.create_canoe?.lastUploadResult
  return upload?.fileName || ''
})

const outputDir = computed(() => {
  const upload = store.moduleStates.create_canoe?.lastUploadResult
  return upload?.outputDir || ''
})

const msgCount = computed(() => {
  let count = 0
  for (const node of treeData.value) {
    count += node.children?.length || 0
  }
  return count
})

const sigCount = computed(() => {
  let count = 0
  for (const node of treeData.value) {
    for (const msg of node.children || []) {
      count += msg.children?.filter((c: any) => c.type === 'signal').length || 0
    }
  }
  return count
})

const configuredSignals = computed(() => {
  const list: any[] = []
  for (const node of treeData.value) {
    for (const msg of (node.children || [])) {
      for (const sig of (msg.children || [])) {
        if (sig.type !== 'signal') continue
        if (sig.genSigFuncType) {
          list.push({
            id: sig.id,
            signalName: sig.label,
            msgName: msg.label,
            genSigFuncType: sig.genSigFuncType,
            nodeRef: sig,
          })
        }
      }
    }
  }
  return list
})

watch(
  () => store.moduleStates.create_canoe?.lastUploadResult?.data,
  (result, oldResult) => {
    if (result && result !== oldResult) {
      const upload = store.moduleStates.create_canoe?.lastUploadResult
      buildTreeFromData(upload?.type || '', result)
    }
  },
  { immediate: true }
)

watch(searchKeyword, (val) => {
  treeRef.value?.filter(val)
})

function filterNode(value: string, data: any) {
  if (!value) return true
  return data.label?.toLowerCase().includes(value.toLowerCase())
}

function getNodeIcon(type: string) {
  const icons: Record<string, any> = {
    node: FolderOpened,
    message: Connection,
    signal: Rank,
    attr: InfoFilled,
  }
  return icons[type] || Rank
}

function findColumnIndex(columns: string[], keywords: string[]): number {
  for (let i = 0; i < columns.length; i++) {
    const col = String(columns[i] || '').replace(/\n/g, ' ')
    if (keywords.some(kw => col.toLowerCase().includes(kw.toLowerCase()))) {
      return i
    }
  }
  return -1
}

function buildTreeFromData(type: string, data: any) {
  let columns: string[] = []
  let rows: any[] = []

  if (data?.DBC?.columns) {
    columns = data.DBC.columns
    rows = data.DBC.rows
  } else if (data?.columns) {
    columns = data.columns
    rows = data.rows
  } else {
    for (const key of Object.keys(data || {})) {
      const sheet = data[key]
      if (sheet?.columns && sheet?.rows) {
        if (sheet.columns.some((c: string) => c?.includes('Signal_Name') || c?.includes('信号名称'))) {
          columns = sheet.columns
          rows = sheet.rows
          break
        }
      }
    }
  }

  if (!columns.length || !rows.length) {
    ElMessage.warning('未找到有效的信号矩阵数据')
    return
  }

  const msgNameIdx = findColumnIndex(columns, ['Msg_Name', '报文名称'])
  const msgTypeIdx = findColumnIndex(columns, ['Msg_Type', '报文类型'])
  const msgIdIdx = findColumnIndex(columns, ['Msg_ID', '报文标识符'])
  const msgSendTypeIdx = findColumnIndex(columns, ['Msg_Send_Type', '报文发送类型'])
  const msgCycleTimeIdx = findColumnIndex(columns, ['Msg_Cycle_Time', '报文周期时间'])
  const msgCycleTimeFastIdx = findColumnIndex(columns, ['Msg_Cycle_Time_Fast', '报文发送的快速周期'])
  const msgNrOfReptionIdx = findColumnIndex(columns, ['Msg_Nr_Of_Reption', '报文快速发送的次数'])
  const dlcIdx = findColumnIndex(columns, ['Msg_Length', '报文长度'])
  const sigNameIdx = findColumnIndex(columns, ['Signal_Name', '信号名称'])
  const byteOrderIdx = findColumnIndex(columns, ['Byte_Order', '排列格式'])
  const startByteIdx = findColumnIndex(columns, ['Start_Byte', '起始字节'])
  const startBitIdx = findColumnIndex(columns, ['Start_Bit', '起始位'])
  const signalSendTypeIdx = findColumnIndex(columns, ['Signal_Send_Type', '信号发送类型'])
  const lenIdx = findColumnIndex(columns, ['Bit_Length', '信号长度'])
  const dataTypeIdx = findColumnIndex(columns, ['Data_Type', '数据类型'])
  const factorIdx = findColumnIndex(columns, ['Factor', '精度'])
  const offsetIdx = findColumnIndex(columns, ['Offset', '偏移量'])
  const minIdx = findColumnIndex(columns, ['Signal_Min_Value_Phy', '物理最小值'])
  const maxIdx = findColumnIndex(columns, ['Signal_Max_Value_Phy', '物理最大值'])
  const initialValueIdx = findColumnIndex(columns, ['Initial_Value', '初始值'])
  const unitIdx = findColumnIndex(columns, ['Unit', '单位'])
  const valueDescIdx = findColumnIndex(columns, ['Signal_Value_Descriptions', '信号值描述'])
  const commentsIdx = findColumnIndex(columns, ['Comments', '备注'])
  const invalidValueIdx = findColumnIndex(columns, ['Invalid_Value', '无效值'])
  const signalTypeIdx = findColumnIndex(columns, ['Signal_Type'])
  const genSigFuncTypeIdx = findColumnIndex(columns, ['GenSigFuncType'])
  const sendersIdx = findColumnIndex(columns, ['Senders', '发送节点'])
  if (sigNameIdx === -1) {
    ElMessage.error('未找到信号名称列')
    return
  }

  const nodes = new Map<string, any>()
  const nodeMsgMap = new Map<string, any>()
  let nodeIdCounter = 0

  let lastMsgName = ''
  let lastMsgId: any = ''
  let lastDlc: any = ''
  let lastMsgType = ''
  let lastMsgSendType = ''
  let lastCycleTime = ''
  let lastCycleTimeFast = ''
  let lastNrOfReption = ''
  let lastSender = ''

  for (const row of rows) {
    let msgName = msgNameIdx >= 0 ? row[msgNameIdx] : ''
    let msgId = msgIdIdx >= 0 ? row[msgIdIdx] : ''
    let dlc = dlcIdx >= 0 ? row[dlcIdx] : ''
    let msgType = msgTypeIdx >= 0 ? row[msgTypeIdx] : ''
    let msgSendType = msgSendTypeIdx >= 0 ? row[msgSendTypeIdx] : ''
    let cycleTime = msgCycleTimeIdx >= 0 ? row[msgCycleTimeIdx] : ''
    let cycleTimeFast = msgCycleTimeFastIdx >= 0 ? row[msgCycleTimeFastIdx] : ''
    let nrOfReption = msgNrOfReptionIdx >= 0 ? row[msgNrOfReptionIdx] : ''
    let sender = sendersIdx >= 0 ? row[sendersIdx] : ''

    if (msgName) {
      lastMsgName = msgName
      lastMsgId = msgId
      lastDlc = dlc
      lastMsgType = msgType
      lastMsgSendType = msgSendType
      lastCycleTime = cycleTime
      lastCycleTimeFast = cycleTimeFast
      lastNrOfReption = nrOfReption
      lastSender = sender
    } else {
      msgName = lastMsgName
      msgId = lastMsgId
      dlc = lastDlc
      msgType = lastMsgType
      msgSendType = lastMsgSendType
      cycleTime = lastCycleTime
      cycleTimeFast = lastCycleTimeFast
      nrOfReption = lastNrOfReption
      sender = lastSender
    }

    const sigName = row[sigNameIdx]
    if (!sigName) continue

    const msgIdNum = typeof msgId === 'string'
      ? parseInt(msgId.replace(/0x/i, ''), 16)
      : Number(msgId)

    const msgIdHex = msgIdNum.toString(16).toUpperCase()
    // 节点名优先用 Excel/DBC 中的 Senders 值（如 EPS），无值时才格式化为 Node_{ID}
    // 与后端 build_dbc 中 msg_sender 逻辑一致
    const rawSender = String(sender || '').trim()
    const nodeKey = rawSender ? rawSender : `Node_${msgIdHex}`
    const msgPrefix = `Msg_${msgIdHex}`
    const sigPrefix = `x${msgIdHex}_`
    const formattedMsgName = msgName && String(msgName).startsWith(msgPrefix) ? msgName : msgPrefix
    const formattedSigName = String(sigName).startsWith(sigPrefix) ? sigName : `${sigPrefix}${sigName}`

    if (!nodes.has(nodeKey)) {
      nodes.set(nodeKey, {
        id: `node_${nodeIdCounter++}`,
        type: 'node',
        label: nodeKey,
        originalLabel: nodeKey,
        children: [],
      })
    }

    const nodeNode = nodes.get(nodeKey)

    if (!nodeMsgMap.has(formattedMsgName)) {
      const msgNode = {
        id: `msg_${nodeIdCounter++}`,
        type: 'message',
        label: formattedMsgName,
        originalLabel: msgName,
        msgId: isNaN(msgIdNum) ? 0 : msgIdNum,
        dlc: dlc || 8,
        cycle: cycleTime || '',
        msgType: msgType || 'CAN',
        msgSendType: msgSendType || 'Cyclic',
        msgCycleTimeFast: cycleTimeFast || '',
        msgNrOfReption: nrOfReption || '',
        children: [],
        attrs: [
          { key: 'msgType', label: '类型', value: msgType || 'CAN' },
          { key: 'msgSendType', label: '发送类型', value: msgSendType || 'Cyclic' },
          { key: 'cycle', label: '周期', value: String(cycleTime || '') },
          { key: 'msgCycleTimeFast', label: '快速周期', value: String(cycleTimeFast || '') },
          { key: 'msgNrOfReption', label: '快速次数', value: String(nrOfReption || '') },
        ],
      }
      nodeMsgMap.set(formattedMsgName, msgNode)
      nodeNode.children.push(msgNode)
    }

    const msgNode = nodeMsgMap.get(formattedMsgName)

    const startBit = parseInt(row[startBitIdx]) || 0
    const startByte = parseInt(row[startByteIdx]) || 0
    const length = parseInt(row[lenIdx]) || 8
    const rawByteOrderStr = String(row[byteOrderIdx] || 'Intel Lsb')
    const raw = rawByteOrderStr.toLowerCase()
    let byteOrder = 'Intel LSB'
    if (raw.includes('motorola') || raw.includes('big_endian')) {
      byteOrder = raw.includes('msb') ? 'Motorola MSB' : 'Motorola LSB'
    } else if (raw.includes('intel') || raw.includes('little_endian')) {
      byteOrder = raw.includes('msb') ? 'Intel MSB' : 'Intel LSB'
    }
    const factor = parseFloat(row[factorIdx]) || 1
    const offset = parseFloat(row[offsetIdx]) || 0
    const minVal = parseFloat(row[minIdx]) || 0
    const maxVal = parseFloat(row[maxIdx]) || 0
    const initialValue = row[initialValueIdx] || ''
    const unit = row[unitIdx] || ''
    const valueDesc = row[valueDescIdx] || ''
    const comments = row[commentsIdx] || ''
    const invalidValue = row[invalidValueIdx] || ''
    const signalSendType = row[signalSendTypeIdx] || ''
    const dataType = row[dataTypeIdx] || ''
    const rawSignalType = signalTypeIdx >= 0 ? row[signalTypeIdx] : ''
    const rawGenSigFuncType = genSigFuncTypeIdx >= 0 ? row[genSigFuncTypeIdx] : ''

    // GenSigFuncType 优先级（与后端 resolve_gen_sig_func_type 一致）：
    // 1. Excel Signal_Type 列 → 2. Excel/DBC GenSigFuncType 列 → 3. 信号名关键字默认
    const GENSIG_OPTS = [
      'NoFunction', 'Counter', 'CRC_Hig_xor_low', 'CRC_Xor_FF', 'CRC_CheckSum',
      'CRC8_1D_All', 'CRC8_2F_All', 'CRC8_1D_Cutoff', 'CRC8_2F_Cutoff', 'CRC16_All', 'CRC16_Cutoff',
    ]
    const SIGNAL_TYPE_MAP: Record<string, string> = {
      CRC: 'CRC_Hig_xor_low',
      CRC8: 'CRC8_2F_All',
      CRC16: 'CRC16_All',
    }
    let autoGenSigFuncType = ''
    const normalizeSt = (v: string) => {
      if (!v) return ''
      const s = String(v).trim()
      if (!s || s === 'NoFunction' || s === 'Default') return ''
      if (GENSIG_OPTS.includes(s)) return s
      if (SIGNAL_TYPE_MAP[s]) return SIGNAL_TYPE_MAP[s]
      const low = s.toLowerCase()
      for (const k of Object.keys(SIGNAL_TYPE_MAP)) {
        if (k.toLowerCase() === low) return SIGNAL_TYPE_MAP[k]
      }
      for (const opt of GENSIG_OPTS) {
        if (opt.toLowerCase() === low) return opt
      }
      return ''
    }
    // 优先级：GenSigFuncType 列完整枚举 > Signal_Type 列简写 > GenSigFuncType 列简写
    // NoFunction 视为无功能，不保留（不显示）
    const gsftRaw = String(rawGenSigFuncType || '').trim()
    if (GENSIG_OPTS.includes(gsftRaw) && gsftRaw !== 'NoFunction') {
      autoGenSigFuncType = gsftRaw
    } else {
      autoGenSigFuncType = normalizeSt(rawSignalType)
      if (!autoGenSigFuncType) autoGenSigFuncType = normalizeSt(rawGenSigFuncType)
    }
    if (!autoGenSigFuncType) {
      const sigStr = String(sigName)
      const counterKws = ['RollingCounter', 'Counter', 'RollCnt', 'Roll', 'rollingcounter', 'counter', 'rollcnt', 'roll', 'Cnt', 'cnt']
      const crcKws = ['CRC', 'Checksum', 'checksum', 'crc', 'Cksm', 'CheckSum', 'CHECKSUM']
      if (counterKws.some(k => sigStr.includes(k))) autoGenSigFuncType = 'Counter'
      else if (crcKws.some(k => sigStr.includes(k))) autoGenSigFuncType = 'CRC_Hig_xor_low'
    }

    const sigAttrs = [
      { key: 'label', label: '信号名', value: formattedSigName },
      { key: 'byteOrder', label: '排列', value: byteOrder },
      { key: 'startByte', label: '起始字节', value: String(startByte) },
      { key: 'startBit', label: '起始位', value: String(startBit) },
      { key: 'length', label: '长度', value: String(length) },
      { key: 'signalSendType', label: '发送类型', value: signalSendType },
      { key: 'dataType', label: '数据类型', value: dataType },
      { key: 'factor', label: '精度', value: String(factor) },
      { key: 'offset', label: '偏移', value: String(offset) },
      { key: 'min', label: '最小', value: String(minVal) },
      { key: 'max', label: '最大', value: String(maxVal) },
      { key: 'initialValue', label: '初始值', value: String(initialValue) },
      { key: 'unit', label: '单位', value: unit },
      { key: 'valueDesc', label: '值描述', value: valueDesc },
      { key: 'comments', label: '备注', value: comments },
      { key: 'invalidValue', label: '无效值', value: invalidValue },
    ]

    const sigNode = {
      id: `sig_${nodeIdCounter++}`,
      type: 'signal',
      label: formattedSigName,
      originalLabel: sigName,
      startBit: startByte * 8 + startBit,
      startByte,
      bitStart: startBit,
      length,
      byteOrder,
      factor,
      offset,
      min: minVal,
      max: maxVal,
      initialValue,
      unit,
      valueDesc,
      comments,
      invalidValue,
      signalSendType,
      dataType,
      genSigFuncType: autoGenSigFuncType,
      dataId: '',
      children: sigAttrs.map(attr => ({
        id: `attr_${nodeIdCounter++}`,
        type: 'attr',
        label: attr.label,
        value: attr.value,
        attrRef: attr,
      })),
    }
    msgNode.children.push(sigNode)
  }

  treeData.value = Array.from(nodes.values())
  expandedKeys.value = treeData.value.map(n => n.id)

  nextTick(() => {
    treeRef.value?.setCurrentKey(null)
    expandAll()
  })

  ElMessage.success(`已加载 ${nodes.size} 个节点，${msgCount.value} 个报文，${sigCount.value} 个信号`)
}

function onNodeClick(data: any) {
}

function onExpandChange(_key: string, _expanded: boolean) {
}

function expandAll() {
  const tree = treeRef.value
  if (!tree) return
  Object.values(tree.store.nodesMap).forEach((node: any) => {
    if (node.data?.type === 'node' || node.data?.type === 'message') {
      node.expanded = true
    } else {
      node.expanded = false
    }
  })
}

function collapseAll() {
  const tree = treeRef.value
  if (!tree) return
  Object.values(tree.store.nodesMap).forEach((node: any) => {
    node.expanded = false
  })
}

function startAttrEdit(_data: any, attr: any) {
  editingAttr.value = attr
  nextTick(() => {
    const input = document.querySelector('.attr-edit-input') as HTMLInputElement
    if (input) {
      input.focus()
      input.select()
    }
  })
}

function finishAttrEdit() {
  editingAttr.value = null
}

function cancelAttrEdit() {
  editingAttr.value = null
}

function startNodeEdit(data: any) {
  editingNode.value = data
  nextTick(() => {
    const input = document.querySelector('.node-edit-input') as HTMLInputElement
    if (input) {
      input.focus()
      input.select()
    }
  })
}

function finishNodeEdit() {
  editingNode.value = null
}

function cancelNodeEdit() {
  if (editingNode.value && editingNode.value.originalLabel) {
    editingNode.value.label = editingNode.value.originalLabel
  }
  editingNode.value = null
}

function onDragStart(event: DragEvent, value: string, type: string) {
  dragData.value = { type, value }
  event.dataTransfer?.setData('text/plain', JSON.stringify({ type, value }))
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'copy'
  }
}

function onDragOver(event: DragEvent, data: any) {
  if (data?.type !== 'signal') return
  const target = event.currentTarget as HTMLElement
  target.classList.add('drag-over')
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'copy'
  }
}

function onDragLeave(event: DragEvent, data: any) {
  const target = event.currentTarget as HTMLElement
  target.classList.remove('drag-over')
}

function onDrop(event: DragEvent, data: any) {
  const target = event.currentTarget as HTMLElement
  target.classList.remove('drag-over')

  if (data?.type !== 'signal') {
    ElMessage.warning('请拖拽到信号节点上')
    return
  }

  if (!dragData.value) return

  if (dragData.value.type === 'gensigfunctype') {
    data.genSigFuncType = dragData.value.value
    ElMessage.success(`${data.label} → ${dragData.value.value}`)
  }

  dragData.value = null
}

function clearSignalConfig(item: any) {
  if (item.nodeRef) {
    item.nodeRef.genSigFuncType = ''
  }
}

function clearAllConfig() {
  for (const msg of treeData.value) {
    for (const sig of (msg.children || [])) {
      if (sig.type !== 'signal') continue
      sig.genSigFuncType = ''
    }
  }
  ElMessage.success('已清空所有信号配置')
}

// 与信号节点 el-tag 实时显示逻辑一致：有 genSigFuncType 则返回，否则留空（不显示 NoFunction）
function deriveSigFuncType(sig: any): string {
  const v = sig.genSigFuncType
  if (!v || v === 'NoFunction') return ''
  return v
}

// 提交前为每个 signal 节点派生 'el-tag-content' 顶层字段（后端 get_val 读取该键作为 GenSigFuncType）
// 在提交时刻重新计算，保证反映用户最新的拖拽配置；不改动 node/message/attr 层结构
function enrichTreeForSubmit(tree: any[]): any[] {
  return tree.map(node => ({
    ...node,
    children: (node.children || []).map((msg: any) => ({
      ...msg,
      children: (msg.children || []).map((child: any) =>
        child.type === 'signal'
          ? {
              ...child,
              dataId: normalizeDateId(child.dataId),
              'el-tag-content': deriveSigFuncType(child),
            }
          : child
      ),
    })),
  }))
}

async function onGenerateConfig() {
  if (!treeData.value.length) {
    ElMessage.warning('请先上传 Excel 或 DBC 文件')
    return
  }
  if (!outputDir.value) {
    ElMessage.warning('请先选择输出目录')
    return
  }

  try {
    await ElMessageBox.confirm(
      `将在以下目录生成 CANoe 配置：\n${outputDir.value}\n\n是否继续？`,
      '确认生成',
      { confirmButtonText: '生成', cancelButtonText: '取消', type: 'info' }
    )
  } catch {
    return
  }

  // 生成前先保存配置（若有当前配置选择）
  if (currentConfig.value) {
    try {
      await saveConfig('great_canoe', currentConfig.value, collectConfigData())
    } catch { /* 错误由拦截器处理 */ }
  }

  generating.value = true
  try {
    // 配置名优先级：currentConfig 选择 > 上传文件名 > 默认
    const effectiveConfigName = currentConfig.value
      || fileName.value.replace(/\.(xlsx|xls|dbc)$/i, '')
      || 'CANoeConfig'

    const result: any = await generateCanoeConfigFromTree(
      enrichTreeForSubmit(treeData.value),
      outputDir.value,
      effectiveConfigName,
      true,
      genOptions.envvar,
      genOptions.panel,
      genOptions.nodes,
      unusedByteValue.value,
      readyConfig.signal,
      readyConfig.onValue,
      readyConfig.offValue,
      carSpdConfig.signal,
      store.selectedOem,
      store.selectedAlgo,
      canChannel.value,
      relayModule.value,
      dtcList.value,
      crcAlgorithms.value,
      releaseConfig.version,
      releaseConfig.author,
      releaseConfig.changeNote,
    )

    generateResult.value = result?.data
    showResult.value = true
    ElMessage.success('CANoe 配置生成成功！')
  } catch (e: any) {
    ElMessage.error(`生成失败：${e?.message || e}`)
  } finally {
    generating.value = false
  }
}

function openOutputDir() {
  const electronAPI = (window as any).electronAPI
  if (electronAPI?.openPath && generateResult.value?.output_dir) {
    electronAPI.openPath(generateResult.value.output_dir)
  } else {
    ElMessage.info('浏览器模式下请手动打开目录')
  }
}

function updateTreeHeight() {
  treeHeight.value = Math.max(400, window.innerHeight - 220)
}

// ==================== 配置保存/加载/新建/刷新 ====================

/** 收集当前页面所有状态为 JSON 配置数据（紧凑格式） */
function collectConfigData(): any {
  return {
    tree: serializeTree(treeData.value),
    opt: { e: genOptions.envvar, p: genOptions.panel, n: genOptions.nodes },
    ub: unusedByteValue.value,
    rdy: { ...readyConfig },
    spd: carSpdConfig.signal,
    ch: canChannel.value,
    relay: relayModule.value,
    dtc: [...dtcList.value],
    oem: store.selectedOem,
    securityAlgo: store.selectedAlgo,
  }
}

/** 紧凑序列化树形数据：去除 attr 子节点、attrs 数组、originalLabel、attrRef 等冗余，省略默认值 */
function serializeTree(tree: any[]): any[] {
  return tree.filter((n: any) => n.type === 'node').map((node: any) => ({
    l: node.label,
    c: (node.children || []).filter((m: any) => m.type === 'message').map((msg: any) => {
      const m: any = { l: msg.label, id: msg.msgId }
      if (msg.dlc != null && msg.dlc !== 8) m.d = msg.dlc
      if (msg.cycle) m.cy = msg.cycle
      if (msg.msgType && msg.msgType !== 'CAN') m.mt = msg.msgType
      if (msg.msgSendType && msg.msgSendType !== 'Cyclic') m.st = msg.msgSendType
      if (msg.msgCycleTimeFast) m.cf = msg.msgCycleTimeFast
      if (msg.msgNrOfReption) m.nr = msg.msgNrOfReption
      m.c = (msg.children || []).filter((s: any) => s.type === 'signal').map((sig: any) => {
        const s: any = { l: sig.label }
        if (sig.startByte) s.sb = sig.startByte
        if (sig.bitStart) s.bs = sig.bitStart
        if (sig.length != null && sig.length !== 8) s.ln = sig.length
        if (sig.byteOrder && sig.byteOrder !== 'Intel LSB') s.bo = sig.byteOrder
        if (sig.factor != null && sig.factor !== 1) s.f = sig.factor
        if (sig.offset) s.o = sig.offset
        if (sig.min) s.mn = sig.min
        if (sig.max) s.mx = sig.max
        if (sig.initialValue) s.iv = sig.initialValue
        if (sig.unit) s.u = sig.unit
        if (sig.valueDesc) s.vd = sig.valueDesc
        if (sig.comments) s.cm = sig.comments
        if (sig.invalidValue) s.iv2 = sig.invalidValue
        if (sig.signalSendType) s.sst = sig.signalSendType
        if (sig.dataType) s.dt = sig.dataType
        if (sig.genSigFuncType) s.gs = sig.genSigFuncType
        const did = normalizeDateId(sig.dataId)
        if (did) s.did = did
        return s
      })
      return m
    }),
  }))
}

/** 将 JSON 配置数据应用到页面 */
function applyConfigData(data: any) {
  // 兼容旧格式（treeData）和新格式（tree）
  const treeRaw = data?.tree || data?.treeData
  if (treeRaw && Array.isArray(treeRaw)) {
    treeData.value = data.tree ? deserializeTree(treeRaw) : treeRaw
  }
  // 兼容旧格式（genOptions）和新格式（opt）
  const opt = data?.opt || data?.genOptions
  if (opt) {
    genOptions.envvar = !!(opt.e ?? opt.envvar)
    genOptions.panel = !!(opt.p ?? opt.panel)
    genOptions.nodes = !!(opt.n ?? opt.nodes)
  }
  if (data?.ub !== undefined) {
    unusedByteValue.value = Number(data.ub) || 0
  } else if (data?.unusedByte !== undefined) {
    unusedByteValue.value = Number(data.unusedByte) || 0
  }
  const rdy = data?.rdy || data?.readyConfig
  if (rdy) {
    readyConfig.signal = rdy.signal || ''
    readyConfig.onValue = rdy.onValue || ''
    readyConfig.offValue = rdy.offValue || ''
  }
  if (data?.spd !== undefined) {
    carSpdConfig.signal = data.spd || ''
  } else if (data?.carSpdConfig) {
    carSpdConfig.signal = data.carSpdConfig.signal || ''
  }
  if (data?.ch !== undefined) {
    canChannel.value = Number(data.ch) || 0
  }
  if (data?.relay !== undefined) {
    relayModule.value = Number(data.relay) || 0
  }
  if (Array.isArray(data?.dtc)) {
    dtcList.value = data.dtc.map((d: any) => String(d))
  }
  // 安全算法与主机厂相互独立；仅历史配置缺少 securityAlgo 时，按 oem 取默认算法兜底
  if (data?.securityAlgo) {
    store.setSelectedAlgo(data.securityAlgo)
  } else if (data?.oem) {
    const fallback = defaultAlgoForOem(data.oem)
    if (fallback) store.setSelectedAlgo(fallback)
  }
  if (data?.oem) {
    store.setSelectedOem(data.oem)
  }
}

/** 从紧凑格式反序列化为完整树形结构（恢复 attr 子节点，补全默认值） */
function deserializeTree(compact: any[]): any[] {
  let idc = 0
  return compact.map((node: any) => {
    const nodeNode = {
      id: `node_${idc++}`,
      type: 'node',
      label: node.l,
      originalLabel: node.l,
      children: [],
    }
    nodeNode.children = (node.c || []).map((msg: any) => {
      const mt = msg.mt || 'CAN'
      const st = msg.st || 'Cyclic'
      const cy = msg.cy || ''
      const cf = msg.cf || ''
      const nr = msg.nr || ''
      const msgNode = {
        id: `msg_${idc++}`,
        type: 'message',
        label: msg.l,
        originalLabel: msg.l,
        msgId: msg.id || 0,
        dlc: msg.d ?? 8,
        cycle: cy,
        msgType: mt,
        msgSendType: st,
        msgCycleTimeFast: cf,
        msgNrOfReption: nr,
        children: [],
        attrs: [
          { key: 'msgType', label: '类型', value: mt },
          { key: 'msgSendType', label: '发送类型', value: st },
          { key: 'cycle', label: '周期', value: cy },
          { key: 'msgCycleTimeFast', label: '快速周期', value: cf },
          { key: 'msgNrOfReption', label: '快速次数', value: nr },
        ],
      }
      msgNode.children = (msg.c || []).map((sig: any) => {
        const sb = sig.sb ?? 0
        const bs = sig.bs ?? 0
        const ln = sig.ln ?? 8
        const bo = sig.bo || 'Intel LSB'
        const f = sig.f ?? 1
        const o = sig.o ?? 0
        const mn = sig.mn ?? 0
        const mx = sig.mx ?? 0
        const iv = sig.iv ?? ''
        const u = sig.u || ''
        const vd = sig.vd || ''
        const cm = sig.cm || ''
        const iv2 = sig.iv2 || ''
        const sst = sig.sst || ''
        const dt = sig.dt || ''
        const gs = sig.gs || ''
        const sigAttrs = [
          { key: 'label', label: '信号名', value: sig.l },
          { key: 'byteOrder', label: '排列', value: bo },
          { key: 'startByte', label: '起始字节', value: String(sb) },
          { key: 'startBit', label: '起始位', value: String(bs) },
          { key: 'length', label: '长度', value: String(ln) },
          { key: 'signalSendType', label: '发送类型', value: sst },
          { key: 'dataType', label: '数据类型', value: dt },
          { key: 'factor', label: '精度', value: String(f) },
          { key: 'offset', label: '偏移', value: String(o) },
          { key: 'min', label: '最小', value: String(mn) },
          { key: 'max', label: '最大', value: String(mx) },
          { key: 'initialValue', label: '初始值', value: iv },
          { key: 'unit', label: '单位', value: u },
          { key: 'valueDesc', label: '值描述', value: vd },
          { key: 'comments', label: '备注', value: cm },
          { key: 'invalidValue', label: '无效值', value: iv2 },
        ]
        const sigNode: any = {
          id: `sig_${idc++}`,
          type: 'signal',
          label: sig.l,
          originalLabel: sig.l,
          startBit: sb * 8 + bs,
          startByte: sb,
          bitStart: bs,
          length: ln,
          byteOrder: bo,
          factor: f,
          offset: o,
          min: mn,
          max: mx,
          initialValue: iv,
          unit: u,
          valueDesc: vd,
          comments: cm,
          invalidValue: iv2,
          signalSendType: sst,
          dataType: dt,
          genSigFuncType: gs,
          dataId: normalizeDateId(sig.did),
          children: sigAttrs.map(attr => ({
            id: `attr_${idc++}`,
            type: 'attr',
            label: attr.label,
            value: attr.value,
            attrRef: attr,
          })),
        }
        return sigNode
      })
      return msgNode
    })
    return nodeNode
  })
}

/** 重置数据 */
function resetData() {
  treeData.value = []
  genOptions.envvar = true
  genOptions.panel = true
  genOptions.nodes = true
  unusedByteValue.value = 0
  readyConfig.signal = ''
  readyConfig.onValue = ''
  readyConfig.offValue = ''
  carSpdConfig.signal = ''
  canChannel.value = 1
  relayModule.value = 0
  dtcList.value = []
  dtcInput.value = ''
  generateResult.value = null
  showResult.value = false
}

async function onSave() {
  if (!currentConfig.value) {
    ElMessage.warning('请先选择或新建配置')
    return
  }
  try {
    await saveConfig('great_canoe', currentConfig.value, collectConfigData())
    ElMessage.success('配置保存成功')
  } catch { /* 错误由拦截器处理 */ }
}

async function onCreate(name: string) {
  if (!name) return
  try {
    const hasConfig = !!currentConfig.value
    if (hasConfig) {
      resetData()
    }
    await saveConfig('great_canoe', name, collectConfigData())
    currentConfig.value = name
    await configToolbarRef.value?.refreshAndSelect(name)
    ElMessage.success(`已创建新配置 "${name}"，请编辑后保存`)
  } catch { /* 错误由拦截器处理 */ }
}

function onConfigChange(name: string) {
  currentConfig.value = name
  if (name) {
    loadConfig(name)
  } else {
    resetData()
  }
}

async function loadConfig(name: string) {
  try {
    const res: any = await getConfig('great_canoe', name)
    const data = res?.data || {}
    applyConfigData(data)
  } catch { /* 错误由拦截器处理 */ }
}

function onRefresh() {
  if (currentConfig.value) {
    loadConfig(currentConfig.value)
  } else {
    resetData()
  }
}

onMounted(() => {
  updateTreeHeight()
  window.addEventListener('resize', updateTreeHeight)
  loadCrcAlgorithms()
})

// 输出目录变化时刷新建议版本号（读取该目录下已有《释放记录.txt》）
watch(outputDir, () => {
  refreshSuggestedVersion()
})
</script>

<style scoped lang="scss">
.create-canoe-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.view-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 4px 16px;
  flex-shrink: 0;

  .header-left {
    display: flex;
    align-items: baseline;
    gap: 12px;
  }

  .header-center {
    flex: 1;
    display: flex;
    justify-content: center;
  }

  .gen-options {
    display: flex;
    gap: 20px;
    align-items: center;
    font-size: 13px;
    color: var(--text-regular);
  }

  .view-title {
    font-size: 20px;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
  }

  .view-sub {
    font-size: 13px;
    color: var(--text-secondary);
  }
}

.main-layout {
  flex: 1;
  display: flex;
  gap: 12px;
  min-height: 0;
}

.tree-panel, .config-panel {
  background: var(--bg-card);
  border-radius: 12px;
  border: 1px solid var(--border-color-light);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.tree-panel {
  flex: 1;
  min-width: 0;
}

.config-panel {
  width: 320px;
  flex-shrink: 0;
}

.panel-header {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color-light);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;

  .panel-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .panel-tools {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;

    .search-input {
      width: 160px;
    }
  }
}

.signal-drag-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: var(--el-color-primary-light-9);
  font-size: 12px;
  color: var(--text-secondary);
  flex-shrink: 0;
  border-bottom: 1px solid var(--border-color-light);
}

.tree-wrapper {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.signal-tree {
  background: transparent;

  :deep(.el-tree-node__content) {
    height: auto;
    min-height: 36px;
    padding: 2px 4px;
  }
}

.tree-node {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 4px 8px;
  border-radius: 6px;
  transition: background 0.2s;

  .node-icon {
    font-size: 14px;
    flex-shrink: 0;

    &.sender { color: var(--el-color-primary); }
    &.message { color: var(--el-color-success); }
    &.signal { color: var(--el-color-info); }
    &.attr { color: var(--text-secondary); }
  }

  .node-label {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
  }

  &.sender .node-label {
    font-weight: 700;
    color: var(--text-primary);
  }

  &.message .node-label {
    font-weight: 600;
    color: var(--text-primary);
  }

  &.signal .node-label {
    color: var(--text-regular);
  }

  &.attr .node-label {
    font-size: 12px;
    color: var(--text-secondary);
  }

  &.drag-over {
    background: var(--el-color-primary-light-9);
    outline: 2px dashed var(--el-color-primary);
    outline-offset: -2px;
  }
}

.msg-tag {
  font-weight: normal;
  flex-shrink: 0;
  font-size: 11px;

  &.dlc {
    --el-tag-bg-color: var(--bg-page);
    color: var(--text-secondary);
    border-color: var(--border-color-light);
  }

  &.cycle {
    --el-tag-bg-color: #f0f5ff;
    color: var(--el-color-primary);
    border-color: #b3d8ff;
  }
}

.signal-tags {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
  align-items: center;
}

.sig-dataid-input {
  width: 150px;
}

.attr-node {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--text-secondary);

  .attr-key {
    font-weight: 500;
    color: var(--text-regular);
  }

  .attr-value {
    color: var(--text-secondary);
  }
}

.sig-detail {
  font-size: 11px;
  color: var(--text-color-secondary);
  flex-shrink: 0;
  opacity: 0.7;
}

.node-attrs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-left: auto;
}

.attr-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--text-secondary);
  background: var(--bg-page);
  padding: 2px 6px;
  border-radius: 4px;
  cursor: pointer;

  &:hover {
    background: var(--el-color-primary-light-9);
  }

  .attr-key {
    font-weight: 500;
    color: var(--text-regular);
  }

  .attr-value {
    color: var(--text-secondary);
  }
}

.attr-edit-input {
  width: 80px;
  padding: 2px 6px;
  font-size: 11px;
  border: 1px solid var(--el-color-primary);
  border-radius: 3px;
  outline: none;
}

.config-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.drag-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: var(--el-color-primary-light-9);
  border-radius: 8px;
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 16px;
}

.drag-section {
  margin-bottom: 6px;
}

.section-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 3px;
  display: flex;
  align-items: center;
  gap: 6px;
}

/* 版本发布信息表单 */
.release-form {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.release-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.release-row-block {
  align-items: flex-start;
}

.release-label {
  flex: 0 0 52px;
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.release-row .el-input {
  flex: 1;
}

.drag-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.slider-row {
  padding: 4px 12px 8px;
}

.unused-byte-slider {
  width: 100%;
}

.ready-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.ready-input-signal {
  flex: 2;
}

.ready-input-value {
  flex: 1;
}

/* ===== 分段式滑块（CAN通道/继电器模块） ===== */
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

/* ===== DTC 卡片输入 ===== */
.dtc-input-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dtc-input {
  flex: 1;
}

.dtc-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
}

.drag-tag {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 14px;
  border-radius: 8px;
  cursor: grab;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s;
  user-select: none;
  border: 2px solid transparent;

  &:hover {
    transform: scale(1.05);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  }

  &:active {
    cursor: grabbing;
    transform: scale(0.95);
  }

  .el-icon {
    font-size: 16px;
  }
}

.crc-tag {
  background: #fef0f0;
  color: #f56c6c;
  border-color: #fbc4c4;

  &:hover {
    background: #fde2e2;
  }
}

.crc-tag-editable {
  cursor: pointer;
  border-style: dashed;

  &:hover {
    border-color: #f56c6c;
    box-shadow: 0 0 4px rgba(245, 108, 108, 0.3);
  }
}

.crc-hint {
  font-size: 11px;
  color: var(--text-color-secondary, #909399);
  margin-top: 4px;
}

.crc-code-editor {
  :deep(.el-textarea__inner) {
    font-family: 'Consolas', 'Courier New', monospace;
    font-size: 13px;
    line-height: 1.5;
  }
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.configured-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 300px;
  overflow-y: auto;
}

.configured-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  background: var(--bg-page);
  border-radius: 6px;
  font-size: 12px;

  .item-info {
    display: flex;
    flex-direction: column;
    gap: 2px;

    .item-signal {
      font-weight: 600;
      color: var(--text-primary);
    }

    .item-msg {
      color: var(--text-color-secondary);
      font-size: 11px;
    }
  }

  .item-tags {
    display: flex;
    align-items: center;
    gap: 4px;
  }
}

.result-detail {
  margin-top: 16px;
  padding: 12px;
  background: var(--bg-page);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.result-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 13px;
  line-height: 1.6;

  .result-label {
    color: var(--text-secondary);
    flex-shrink: 0;
    width: 80px;
  }

  .result-value {
    color: var(--text-primary);
    word-break: break-all;
    flex: 1;
  }
}
.drag-section .other-slider-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px; /* 与 .other-card-body--sliders 保持一致 */
}
</style>
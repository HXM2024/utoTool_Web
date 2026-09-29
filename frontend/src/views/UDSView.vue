<template>
  <div class="uds-view">
    <ConfigToolbar
      ref="toolbarRef"
      module-name="uds"
      @config-change="onConfigChange"
      @create="onConfigCreate"
      @save="onSave"
      @delete="onConfigDelete"
      @generate="onGenerate"
      @refresh="onRefresh"
    />

    <!-- 生成结果提示 -->
    <div v-if="generateResult?.output_dir" class="app-card generate-notice">
      <el-icon><FolderOpened /></el-icon>
      <span class="output-path">{{ generateResult.output_dir }}</span>
      <el-button
        type="info"
        :icon="FolderOpened"
        size="small"
        @click="handleOpenDir"
      >
        打开
      </el-button>
    </div>

    <div class="uds-body" ref="bodyRef">
      <!-- ========== 左侧面板: 服务树 (40%) ========== -->
      <div class="app-card tree-pane" :style="{ flexBasis: leftWidth + '%' }">
        <div class="card-title">
          UDS 服务树
          <el-tag size="small" type="info" class="node-count">
            {{ totalNodes }} 节点
          </el-tag>
        </div>

        <div class="tree-container" v-loading="loading" @contextmenu.prevent>
          <el-tree
            ref="treeRef"
            :key="treeKey"
            :data="treeData"
            :props="treeProps"
            node-key="_uid"
            highlight-current
            draggable
            :expand-on-click-node="false"
            :default-expanded-keys="expandedKeys"
            @node-click="onNodeClick"
            @node-contextmenu="onNodeContextmenu"
          >
            <template #default="{ data }">
              <span class="tree-node">
                <el-icon v-if="data.subitems?.length" class="node-icon folder">
                  <FolderOpened />
                </el-icon>
                <el-icon v-else class="node-icon leaf">
                  <Document />
                </el-icon>
                <span class="node-id">{{ data.services }}</span>
                <span class="node-desc">{{ data.Description }}</span>
              </span>
            </template>
          </el-tree>

          <div v-if="!treeData.length && !loading" class="empty-tree">
            <el-icon class="empty-icon"><Files /></el-icon>
            <span>暂无数据，请选择配置或添加节点</span>
          </div>
        </div>

        <div class="tree-footer">
          <el-button :icon="Plus" size="small" type="primary" plain @click="addRootNode">
            添加根节点
          </el-button>
          <el-button :icon="Expand" size="small" @click="expandAll">展开全部</el-button>
          <el-button :icon="Fold" size="small" @click="collapseAll">收起全部</el-button>
        </div>
      </div>

      <!-- ========== 拖拽分隔条 ========== -->
      <div class="splitter" @mousedown="startResize" />

      <!-- ========== 右侧面板: 节点详情 (60%) ========== -->
      <div class="app-card detail-pane">
        <div class="card-title">节点详情</div>

        <div v-if="selectedNode" class="detail-content">
          <!-- ========== 服务节点（顶层）：服务信息 + 分类组/DID 列表 ========== -->
          <template v-if="isServiceNode">
            <el-form :model="selectedNode" label-width="80px" size="small" class="detail-form">
              <el-form-item label="服务ID">
                <el-input v-model="selectedNode.services" placeholder="如 0x10" />
              </el-form-item>
              <el-form-item label="服务名称">
                <el-input v-model="selectedNode.Description" placeholder="服务描述" />
              </el-form-item>
            </el-form>

            <div class="subitems-section">
              <div class="sub-title">
                <span>子节点列表（点击行进入编辑）</span>
                <el-button :icon="Plus" size="small" type="primary" plain @click="addSubitem">
                  添加子节点
                </el-button>
              </div>

              <el-table
                v-if="selectedNode.subitems && selectedNode.subitems.length"
                :data="selectedNode.subitems"
                border
                size="small"
                class="subitems-table"
                max-height="420"
                @row-click="onSubRowClick"
              >
                <el-table-column label="名称" width="100" prop="services" />
                <el-table-column label="描述" min-width="160" prop="Description" />
                <el-table-column label="类型" width="80">
                  <template #default="{ row }">
                    <el-tag size="small" :type="row.nodeKind === 'group' ? 'warning' : 'success'">
                      {{ row.nodeKind === 'group' ? '分类组' : (row.nodeKind === 'did' ? 'DID' : '子功能') }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="子项数" width="70">
                  <template #default="{ row }">
                    <span>{{ (row.subitems || []).length }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="操作" width="60" fixed="right">
                  <template #default="{ $index }">
                    <el-button
                      type="danger"
                      :icon="Delete"
                      size="small"
                      link
                      @click.stop="removeSubitem($index)"
                    />
                  </template>
                </el-table-column>
              </el-table>

              <div v-else class="empty-subitems">
                <el-icon><DocumentRemove /></el-icon>
                <span>暂无子节点，点击"添加子节点"按钮添加</span>
              </div>
            </div>
          </template>

          <!-- ========== 分类组节点（31H/1904/1906 整表编辑） ========== -->
          <template v-else-if="selectedNode.nodeKind === 'group' && selectedNode.sheetName === '31H'">
            <div class="subfunc-header">
              <el-button :icon="Back" size="small" text @click="backToService">返回</el-button>
              <el-tag size="small" type="warning">{{ selectedNode.Description }}</el-tag>
            </div>
            <SheetTable :sheet="selectedNode.routineRows" :readonly="false" />
          </template>
          <template v-else-if="selectedNode.nodeKind === 'group' && selectedNode.sheetName === '1904'">
            <div class="subfunc-header">
              <el-button :icon="Back" size="small" text @click="backToService">返回</el-button>
              <el-tag size="small" type="warning">{{ selectedNode.Description }}</el-tag>
            </div>
            <SheetTable :sheet="selectedNode.snapshot1904Rows" :readonly="false" />
          </template>
          <template v-else-if="selectedNode.nodeKind === 'group' && selectedNode.sheetName === '1906'">
            <div class="subfunc-header">
              <el-button :icon="Back" size="small" text @click="backToService">返回</el-button>
              <el-tag size="small" type="warning">{{ selectedNode.Description }}</el-tag>
            </div>
            <SheetTable :sheet="selectedNode.extended1906Rows" :readonly="false" />
          </template>

          <!-- ========== 分类组节点（DID/DIDs/FunDID/2E_H 组：显示组内 DID 子节点列表） ========== -->
          <template v-else-if="selectedNode.nodeKind === 'group'">
            <div class="subfunc-header">
              <el-button :icon="Back" size="small" text @click="backToService">返回</el-button>
              <el-tag size="small" type="warning">{{ selectedNode.Description }}</el-tag>
            </div>
            <div class="subitems-section">
              <div class="sub-title">
                <span>{{ selectedNode.sheetName }} DID 列表（点击行编辑配置）</span>
                <el-button :icon="Plus" size="small" type="primary" plain @click="addDidToGroup">
                  添加DID
                </el-button>
              </div>
              <el-table
                v-if="selectedNode.subitems && selectedNode.subitems.length"
                :data="selectedNode.subitems"
                border
                size="small"
                class="subitems-table"
                max-height="420"
                @row-click="onSubRowClick"
              >
                <el-table-column label="DID号" width="120" prop="services" />
                <el-table-column label="描述" min-width="180" prop="Description" />
                <el-table-column label="操作" width="60" fixed="right">
                  <template #default="{ $index }">
                    <el-button
                      type="danger"
                      :icon="Delete"
                      size="small"
                      link
                      @click.stop="removeDidFromGroup($index)"
                    />
                  </template>
                </el-table-column>
              </el-table>
              <div v-else class="empty-subitems">
                <el-icon><DocumentRemove /></el-icon>
                <span>暂无DID，点击"添加DID"按钮添加</span>
              </div>
            </div>
          </template>

          <!-- ========== DID 节点（叶子）：显示该 DID 的配置表单（从 didConfig 字典渲染） ========== -->
          <template v-else-if="selectedNode.nodeKind === 'did'">
            <div class="subfunc-header">
              <el-button :icon="Back" size="small" text @click="backToService">返回</el-button>
              <el-tag size="small" type="success">DID: {{ selectedNode.services }}</el-tag>
              <el-tag size="small" type="info">{{ selectedNode.sheetName }}</el-tag>
            </div>
            <DidConfigForm :node="selectedNode" />
          </template>

          <!-- ========== 子功能节点（叶子）：完整字段表单 ========== -->
          <template v-else>
            <div class="subfunc-header">
              <el-button :icon="Back" size="small" text @click="backToService">返回服务</el-button>
              <el-tag size="small" type="warning">子功能编辑</el-tag>
            </div>

            <el-form :model="selectedNode" label-width="100px" size="small" class="detail-form">
              <el-form-item label="子功能ID">
                <el-input v-model="selectedNode.services" placeholder="如 01" style="width:160px" />
              </el-form-item>
              <el-form-item label="子功能描述">
                <el-input v-model="selectedNode.Description" placeholder="如 默认模式" />
              </el-form-item>

              <el-divider content-position="left">寻址与会话</el-divider>
              <el-form-item label="寻址方式">
                <div class="check-group">
                  <el-checkbox v-model="selectedNode.addressDefPhys" :true-label="1" :false-label="0">默认·物理</el-checkbox>
                  <el-checkbox v-model="selectedNode.addressExtPhys" :true-label="1" :false-label="0">扩展·物理</el-checkbox>
                  <el-checkbox v-model="selectedNode.addressDefFunc" :true-label="1" :false-label="0">默认·功能</el-checkbox>
                  <el-checkbox v-model="selectedNode.addressExtFunc" :true-label="1" :false-label="0">扩展·功能</el-checkbox>
                </div>
              </el-form-item>
              <el-form-item label="寻址推导">
                <el-tag size="small" type="info">Addres={{ computedAddres }}</el-tag>
                <el-tag size="small" type="info" style="margin-left:8px">Session={{ computedSession }}</el-tag>
              </el-form-item>

              <el-divider content-position="left">安全与抑制</el-divider>
              <el-form-item label="安全验证">
                <el-radio-group v-model="selectedNode.securityAccess">
                  <el-radio :label="0">不需要</el-radio>
                  <el-radio :label="1">需要</el-radio>
                </el-radio-group>
              </el-form-item>
              <el-form-item label="抑制位">
                <el-radio-group v-model="selectedNode.suppressPos">
                  <el-radio :label="0">不支持</el-radio>
                  <el-radio :label="1">支持</el-radio>
                </el-radio-group>
              </el-form-item>

              <el-divider content-position="left">NRC 优先级</el-divider>
              <el-form-item label="NRC列表">
                <div class="nrc-editor">
                  <el-tag
                    v-for="(n, i) in (selectedNode.nrcList || [])"
                    :key="i"
                    closable
                    size="small"
                    @close="removeNrc(i)"
                    style="margin-right:4px"
                  >{{ n }}</el-tag>
                  <el-input
                    v-model="nrcInputText"
                    size="small"
                    style="width:90px"
                    placeholder="0x13"
                    @keyup.enter="addNrc"
                  />
                  <el-button :icon="Plus" size="small" @click="addNrc">添加</el-button>
                </div>
              </el-form-item>
              <el-form-item label="NRC22条件">
                <el-radio-group v-model="selectedNode.nrc22Condition">
                  <el-radio :label="0">无</el-radio>
                  <el-radio :label="1">有</el-radio>
                </el-radio-group>
              </el-form-item>

              <el-divider content-position="left">参数与长度</el-divider>
              <el-form-item label="发送长度">
                <el-input-number v-model="selectedNode.sendLength" :min="0" :max="255" controls-position="right" size="small" />
              </el-form-item>
              <el-form-item label="参数">
                <el-input
                  v-model="selectedNode.params"
                  type="textarea"
                  :rows="3"
                  placeholder="每行一个参数列表，如 [0x01]；无参数填 /"
                />
              </el-form-item>
            </el-form>
          </template>
        </div>

        <div v-else class="empty-placeholder">
          <el-icon class="empty-icon"><Connection /></el-icon>
          <span>请选择左侧树节点查看详情</span>
        </div>
      </div>

      <!-- ========== 对象浏览器侧边栏（共享全局数据） ========== -->
      <div v-show="!panelCollapsed" class="uds-side-wrap">
        <ResizableSplitter direction="horizontal" side="end" :on-drag="onSideDrag" />
        <div class="uds-side" :style="{ width: sideWidth + 'px' }">
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

    <!-- ========== 底部操作区 ========== -->
    <div class="bottom-actions">
      <el-button
        :icon="Promotion"
        type="warning"
        :loading="generating"
        :disabled="!selectedConfig"
        @click="onGenerate"
      >
        生成测试模块
      </el-button>
      <el-button
        :icon="Check"
        type="success"
        :loading="saving"
        :disabled="!selectedConfig"
        @click="onSave"
      >
        保存树数据
      </el-button>
    </div>

    <!-- ========== 右键上下文菜单 ========== -->
    <div
      v-if="contextMenu.visible"
      class="uds-context-menu"
      :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
      @click.stop
    >
      <div class="context-menu-item" @click="contextAddChild">
        <el-icon><Plus /></el-icon>
        <span>添加子节点</span>
      </div>
      <div class="context-menu-item danger" @click="contextDelete">
        <el-icon><Delete /></el-icon>
        <span>删除节点</span>
      </div>
      <div class="context-menu-divider" />
      <div class="context-menu-item" @click="contextMoveUp">
        <el-icon><Top /></el-icon>
        <span>上移</span>
      </div>
      <div class="context-menu-item" @click="contextMoveDown">
        <el-icon><Bottom /></el-icon>
        <span>下移</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

defineOptions({ name: 'UDSView' })
import {
  Plus, Delete, Top, Bottom, FolderOpened, Document,
  Files, Connection, Promotion, Check,
  Expand, Fold, DocumentRemove, Back,
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import ConfigToolbar from '@/components/ConfigToolbar.vue'
import ObjectPanel from '@/components/ObjectPanel.vue'
import ResizableSplitter from '@/components/ResizableSplitter.vue'
import { useResizableSize } from '@/composables/useResizableSize'
import SheetTable from '@/components/SheetTable.vue'
import DidConfigForm from '@/components/DidConfigForm.vue'
import { getTree, updateTree, generateUDS } from '@/api/uds'
import { saveConfig, openFolder } from '@/api/config'
import { useModuleStore } from '@/stores/modules'
import { useShortcut, isModuleActive } from '@/composables/useShortcuts'

// ===== 类型定义 =====
// 顶层节点 = 服务（services 存服务ID如 0x10）
// 二层节点 = 分类组（如"DID"/"DIDs"/"FunDID"/"例程"/"1904"/"1906"）或子功能（如 01）
// 三层节点 = 具体 DID/例程（来自对应 sheet 的每一行）
interface SheetData {
  columns: string[]
  rows: (string | null)[][]
}

interface UdsNode {
  services: string        // 服务ID(顶层)/分类组名/子功能ID/DID号
  Description: string    // 服务名称/子功能描述
  Code: string            // 兼容旧配置，新配置不再使用
  // —— 子功能专用字段（对齐后端"服务"sheet 列）——
  params?: string                 // 参数(多行，每行一个list如 [0x01])
  securityAccess?: number         // 是否需要安全验证 0/1  (列5)
  suppressPos?: number            // 肯定响应抑制位 0/1      (列6)
  addressDefPhys?: number         // 默认模式·物理寻址 0/1   (列7)
  addressExtPhys?: number         // 扩展模式·物理寻址 0/1   (列8)
  addressDefFunc?: number          // 默认模式·功能寻址 0/1   (列9)
  addressExtFunc?: number          // 扩展模式·功能寻址 0/1   (列10)
  nrcList?: string[]              // NRC优先级(由高到低)如 ['0x13','0x12'] (列11)
  nrc22Condition?: number          // NRC22条件 0/1           (列12)
  sendLength?: number             // 预期发送长度            (列15)
  // —— 节点类型标识 ——
  nodeKind?: 'service' | 'group' | 'did' | 'subfunc'  // service=服务, group=分类组, did=DID节点, subfunc=子功能
  sheetName?: string              // 该节点数据来源的 sheet 名（如 '22_DID'）
  // —— DID 节点的行数据（来自对应 sheet 的一行，键为列名）——
  didConfig?: Record<string, string | null>
  // —— 2E_DID sheet 的写入流程数据（2E_H 的每个 DID 关联一列 2E_DID 数据）——
  writeFlowData?: Record<string, string | null>
  // —— 31H/1904/1906 sheet 数据（整表挂在分类组节点上供 SheetTable 编辑）——
  routineRows?: SheetData          // 31H sheet 数据（例程控制配置）
  snapshot1904Rows?: SheetData     // 1904 sheet 数据（快照数据配置）
  extended1906Rows?: SheetData     // 1906 sheet 数据（扩展数据配置）
  subitems?: UdsNode[]
  _uid?: number
}

// 新建子功能节点的默认字段集
function makeSubFunctionDefaults(): Partial<UdsNode> {
  return {
    params: '/',
    securityAccess: 0,
    suppressPos: 0,
    addressDefPhys: 1,
    addressExtPhys: 0,
    addressDefFunc: 0,
    addressExtFunc: 0,
    nrcList: [],
    nrc22Condition: 0,
    sendLength: 2,
  }
}

// ===== 响应式状态 =====
const store = useModuleStore()
const panelCollapsed = ref(false)
const [sideWidth, setSideWidth] = useResizableSize('uds-side', 340, 240, 720)
/** 对象面板在右侧：splitter 向左拖（delta<0）时面板变宽 */
function onSideDrag(delta: number) {
  setSideWidth(sideWidth.value - delta)
}
const toolbarRef = ref<any>(null)
const treeRef = ref<any>(null)
const bodyRef = ref<HTMLElement | null>(null)
const treeData = ref<UdsNode[]>([])
const selectedNode = ref<UdsNode | null>(null)
const selectedConfig = ref('')
/** 当前内存中数据所归属的配置名（加载/切换过程中为空，用于切换前安全自动保存） */
const loadedConfig = ref('')
/** 配置切换/加载令牌：忽略过期请求，避免快速切换时数据错位 */
let configChangeToken = 0
const loading = ref(false)
const saving = ref(false)
const generating = ref(false)
const generateResult = ref<any>(null)
const leftWidth = ref(40)
const treeKey = ref(0)
const expandedKeys = ref<number[]>([])

const treeProps = {
  label: 'Description',
  children: 'subitems',
}

let uidCounter = 1
function genUid(): number {
  return uidCounter++
}

// ===== 右键菜单状态 =====
const contextMenu = ref({
  visible: false,
  x: 0,
  y: 0,
  node: null as UdsNode | null,
})

// ===== 计算属性 =====
const totalNodes = computed(() => countNodes(treeData.value))

function countNodes(nodes: UdsNode[]): number {
  let count = 0
  for (const node of nodes) {
    count += 1
    if (node.subitems) count += countNodes(node.subitems)
  }
  return count
}

// ===== 节点类型判断与寻址/会话推导（与后端 process_Serve 位运算一致）=====
// 顶层节点视为"服务"，非顶层视为"子功能"
const isServiceNode = computed(() => {
  const n = selectedNode.value
  if (!n) return false
  return treeData.value.some((s) => s === n)
})

// 后端位运算：Addres bit0=物理(列7或8), bit1=功能(列9或10)
//            Session bit2=扩展(列8或10), bit0=默认(列7或9)
function calcAddres(n: UdsNode): number {
  let a = 0
  if ((n.addressDefPhys ?? 0) === 1 || (n.addressExtPhys ?? 0) === 1) a |= 1
  if ((n.addressDefFunc ?? 0) === 1 || (n.addressExtFunc ?? 0) === 1) a |= 2
  return a
}
function calcSession(n: UdsNode): number {
  let s = 0
  if ((n.addressExtPhys ?? 0) === 1 || (n.addressExtFunc ?? 0) === 1) s |= 4
  if ((n.addressDefFunc ?? 0) === 1 || (n.addressDefPhys ?? 0) === 1) s |= 1
  return s
}
const computedAddres = computed(() => selectedNode.value ? calcAddres(selectedNode.value) : 0)
const computedSession = computed(() => selectedNode.value ? calcSession(selectedNode.value) : 0)

function formatAddress(n: UdsNode): string {
  const parts: string[] = []
  if ((n.addressDefPhys ?? 0) === 1) parts.push('默物')
  if ((n.addressExtPhys ?? 0) === 1) parts.push('扩物')
  if ((n.addressDefFunc ?? 0) === 1) parts.push('默功')
  if ((n.addressExtFunc ?? 0) === 1) parts.push('扩功')
  return parts.length ? parts.join('/') : '—'
}

// ===== 子功能表格交互 =====
let lastServiceNode: UdsNode | null = null
function onSubRowClick(row: UdsNode) {
  // 记录父节点以便返回：服务节点或分类组节点都可作为返回点
  if (selectedNode.value && (selectedNode.value.nodeKind === 'service' || selectedNode.value.nodeKind === 'group')) {
    lastServiceNode = selectedNode.value
  }
  selectedNode.value = row
}
function backToService() {
  if (lastServiceNode) {
    selectedNode.value = lastServiceNode
  } else {
    // 兜底：选中第一个顶层服务
    selectedNode.value = treeData.value[0] || null
  }
}

// ===== DID 子节点增删（在分类组节点下操作）=====
function addDidToGroup() {
  const g = selectedNode.value
  if (!g || g.nodeKind !== 'group') return
  if (!g.subitems) g.subitems = []
  const sheetName = g.sheetName || ''
  // 根据来源 sheet 生成空的 didConfig（键为列名，值为空字符串）
  const cfg: Record<string, string | null> = {}
  const cols = getSheetColumns(sheetName)
  for (const c of cols) cfg[c] = ''
  g.subitems.push({
    services: 'F1XX',
    Description: '新DID',
    Code: '',
    nodeKind: 'did',
    sheetName,
    didConfig: cfg,
    _uid: genUid(),
  })
}

function removeDidFromGroup(index: number) {
  const g = selectedNode.value
  if (!g?.subitems) return
  g.subitems.splice(index, 1)
}

// 各 sheet 的列定义（与 Excel 表头一致，用于新建 DID 时初始化空配置）
const SHEET_COLUMNS_MAP: Record<string, string[]> = {
  '22_DID': ['DID号', 'DID描述', '总长度', '是否需安全验证', '是否测试', '数据类型', '数据未使用字节填充值', '解析方式', '响应内容', '是否可写', '备注'],
  '22_DIDs': ['DID号', 'DID描述'],
  'FunDID': ['DID号', 'DID描述', '总长度', '类型', '精度', '偏移', '误差', '解析/起始字节', '信号来源', '信号名称', '设置值'],
  '2E_H': ['DID号', 'DID描述', '正常发送字节数', 'NRC', '结构体', 'INI'],
}
function getSheetColumns(sheetName: string): string[] {
  return SHEET_COLUMNS_MAP[sheetName] || []
}

// ===== NRC 动态标签编辑 =====
const nrcInputText = ref('')
function addNrc() {
  if (!selectedNode.value) return
  const v = nrcInputText.value.trim()
  if (!v) return
  // 规范化：0X -> 0x
  const norm = v.replace('0X', '0x').startsWith('0x') ? v.replace('0X', '0x') : (v.match(/^[0-9A-Fa-f]+$/) ? '0x' + v.toUpperCase() : v)
  if (!selectedNode.value.nrcList) selectedNode.value.nrcList = []
  if (!selectedNode.value.nrcList.includes(norm)) {
    selectedNode.value.nrcList.push(norm)
  }
  nrcInputText.value = ''
}
function removeNrc(index: number) {
  if (!selectedNode.value?.nrcList) return
  selectedNode.value.nrcList.splice(index, 1)
}

// ===== 监听 Excel 上传结果，自动从"服务"sheet 构建树 =====
// 后端 /api/uds/parse 返回 { '服务': { columns, rows }, ... }
// 服务 sheet 列索引: [0]服务名称 [1]服务 [2]子功能 [3]描述 [4]参数 [5]安全
//                    [6]抑制位 [7-10]寻址 [11]NRC [12]NRC22 [15]发送长度
const SERVICE_COL = {
  name: 0, service: 1, subFun: 2, subDesc: 3, params: 4,
  security: 5, suppress: 6,
  addrDefPhys: 7, addrExtPhys: 8, addrDefFunc: 9, addrExtFunc: 10,
  nrc: 11, nrc22: 12, sendLen: 15,
}

function parseNrcCell(v: any): string[] {
  if (!v || v === '/' || v === 'None' || v === 'nan') return []
  const s = String(v).trim()
  if (!s.startsWith('[')) return []
  try {
    // 后端格式如 "[0x13,0x12]"，直接解析
    const arr = s.slice(1, -1).split(',').map((x: string) => x.trim()).filter(Boolean)
    return arr.map((x: string) => x.startsWith('0x') || x.startsWith('0X') ? x.replace('0X', '0x') : '0x' + x)
  } catch {
    return []
  }
}

function num01(v: any): number {
  if (v === 1 || v === '1') return 1
  return 0
}

function buildTreeFromServiceSheet(rows: any[][], allSheets?: Record<string, any>): UdsNode[] {
  const tree: UdsNode[] = []
  let curSvc: UdsNode | null = null
  for (const row of rows) {
    const svcId = row[SERVICE_COL.service]
    if (svcId !== null && svcId !== undefined && String(svcId).trim() !== '' && String(svcId).toLowerCase() !== 'nan') {
      // 新服务行
      const node: UdsNode = {
        services: String(svcId).trim(),
        Description: String(row[SERVICE_COL.name] || '').trim(),
        Code: '',
        nodeKind: 'service',
        subitems: [],
        _uid: genUid(),
      }
      // 按服务ID加载对应的 sheet 数据（DID 作为子节点）
      attachSheetData(node, allSheets)
      tree.push(node)
      curSvc = node
    }
    // 子功能行（有"支持子功能列表"值才算有效子功能）
    const subId = row[SERVICE_COL.subFun]
    if (curSvc && subId !== null && subId !== undefined && String(subId).trim() !== '' && String(subId).toLowerCase() !== 'nan') {
      // 22/2E 服务的"sheet"占位行不作为子功能创建（DID 子节点已由 attachSheetData 生成）
      const sid = curSvc.services.toLowerCase()
      if (sid === '0x22' || sid === '0x2e' || sid === '0x31' || sid === '0x19') {
        continue
      }
      const sub: UdsNode = {
        services: String(subId).trim(),
        Description: String(row[SERVICE_COL.subDesc] || '').trim(),
        Code: '',
        nodeKind: 'subfunc',
        params: String(row[SERVICE_COL.params] || '/'),
        securityAccess: num01(row[SERVICE_COL.security]),
        suppressPos: num01(row[SERVICE_COL.suppress]),
        addressDefPhys: num01(row[SERVICE_COL.addrDefPhys]),
        addressExtPhys: num01(row[SERVICE_COL.addrExtPhys]),
        addressDefFunc: num01(row[SERVICE_COL.addrDefFunc]),
        addressExtFunc: num01(row[SERVICE_COL.addrExtFunc]),
        nrcList: parseNrcCell(row[SERVICE_COL.nrc]),
        nrc22Condition: num01(row[SERVICE_COL.nrc22]),
        sendLength: Number(row[SERVICE_COL.sendLen]) || 2,
        subitems: [],
        _uid: genUid(),
      }
      curSvc.subitems!.push(sub)
    }
  }
  return tree
}

// 按 sheet 列名将行转为 didConfig 字典
function rowToDict(columns: string[], row: (string | null)[]): Record<string, string | null> {
  const cfg: Record<string, string | null> = {}
  for (let i = 0; i < columns.length; i++) {
    const v = row[i]
    cfg[columns[i]] = v === undefined ? null : String(v)
  }
  return cfg
}

// 0x22 服务：把 22_DID / 22_DIDs / FunDID 的每行 DID 作为子节点
// 0x2E 服务：把 2E_H 的每行 DID 作为子节点，关联 2E_DID 列数据
// 0x31 服务：31H 整表挂在分类组节点上
// 0x19 服务：1904/1906 整表挂在分类组节点上
function attachSheetData(node: UdsNode, allSheets?: Record<string, any>) {
  if (!allSheets) return
  const sid = node.services.toLowerCase()

  if (sid === '0x22') {
    // 22_DID: 每行一个 DID，作为"DID"组下的子节点
    const didSheet = allSheets['22_DID']
    const didsSheet = allSheets['22_DIDs']
    const funSheet = allSheets['FunDID']
    const groups: UdsNode[] = []

    if (didSheet && didSheet.rows && didSheet.rows.length) {
      const cols = didSheet.columns || []
      const didGroup: UdsNode = {
        services: 'DID', Description: '单DID读取 (22_DID)', Code: '',
        nodeKind: 'group', sheetName: '22_DID', subitems: [], _uid: genUid(),
      }
      for (const row of didSheet.rows) {
        const didId = row[0] ? String(row[0]).trim() : ''
        if (!didId) continue
        didGroup.subitems!.push({
          services: didId,
          Description: row[1] ? String(row[1]).trim() : '',
          Code: '', nodeKind: 'did', sheetName: '22_DID',
          didConfig: rowToDict(cols, row), _uid: genUid(),
        })
      }
      groups.push(didGroup)
    }
    if (didsSheet && didsSheet.rows && didsSheet.rows.length) {
      const cols = didsSheet.columns || []
      const didsGroup: UdsNode = {
        services: 'DIDs', Description: '多DID读取 (22_DIDs)', Code: '',
        nodeKind: 'group', sheetName: '22_DIDs', subitems: [], _uid: genUid(),
      }
      for (const row of didsSheet.rows) {
        const didId = row[0] ? String(row[0]).trim() : ''
        if (!didId) continue
        didsGroup.subitems!.push({
          services: didId,
          Description: row[1] ? String(row[1]).trim() : '',
          Code: '', nodeKind: 'did', sheetName: '22_DIDs',
          didConfig: rowToDict(cols, row), _uid: genUid(),
        })
      }
      groups.push(didsGroup)
    }
    if (funSheet && funSheet.rows && funSheet.rows.length) {
      const cols = funSheet.columns || []
      const funGroup: UdsNode = {
        services: 'FunDID', Description: '功能DID (FunDID)', Code: '',
        nodeKind: 'group', sheetName: 'FunDID', subitems: [], _uid: genUid(),
      }
      // FunDID 中一个 DID 可能有多行（信号展开），合并到同一子节点的 didConfig（数组形式存备注）
      const didMap = new Map<string, UdsNode>()
      for (const row of funSheet.rows) {
        const didId = row[0] ? String(row[0]).trim() : ''
        if (!didId) continue
        let didNode = didMap.get(didId)
        if (!didNode) {
          didNode = {
            services: didId,
            Description: row[1] ? String(row[1]).trim() : '',
            Code: '', nodeKind: 'did', sheetName: 'FunDID',
            didConfig: rowToDict(cols, row), _uid: genUid(),
          }
          didMap.set(didId, didNode)
          funGroup.subitems!.push(didNode)
        }
      }
      groups.push(funGroup)
    }
    if (groups.length) node.subitems!.push(...groups)
  }
  else if (sid === '0x2e') {
    // 2E_H: 每行一个 DID；2E_DID: 每个 DID 一列，行=步骤
    const hexSheet = allSheets['2E_H']
    const twoDidSheet = allSheets['2E_DID']
    const didGroup: UdsNode = {
      services: 'DID', Description: '写入DID (2E_H+2E_DID)', Code: '',
      nodeKind: 'group', sheetName: '2E_H', subitems: [], _uid: genUid(),
    }
    // 预解析 2E_DID: 列名（第2行起每列是 DID 号），行是步骤
    const twoDidCols = twoDidSheet?.columns || []
    const twoDidRows = twoDidSheet?.rows || []
    // 构建 DID -> { stepName: value } 映射
    const twoDidMap = new Map<string, Record<string, string | null>>()
    for (let ci = 2; ci < twoDidCols.length; ci++) {
      const colDid = twoDidCols[ci] ? String(twoDidCols[ci]).trim() : ''
      if (!colDid) continue
      const flow: Record<string, string | null> = {}
      for (const r of twoDidRows) {
        const stepName = r[0] ? String(r[0]).trim() : ''
        if (!stepName) continue
        flow[stepName] = r[ci] !== undefined && r[ci] !== null ? String(r[ci]) : null
      }
      twoDidMap.set(colDid, flow)
    }
    if (hexSheet && hexSheet.rows && hexSheet.rows.length) {
      const cols = hexSheet.columns || []
      for (const row of hexSheet.rows) {
        const didId = row[0] ? String(row[0]).trim() : ''
        if (!didId) continue
        // 匹配 2E_DID 列（支持 F184 / 0xF184 等格式差异）
        const flowKey = matchDidKey(twoDidMap, didId)
        didGroup.subitems!.push({
          services: didId,
          Description: row[1] ? String(row[1]).trim() : '',
          Code: '', nodeKind: 'did', sheetName: '2E_H',
          didConfig: rowToDict(cols, row),
          writeFlowData: flowKey ? twoDidMap.get(flowKey) : undefined,
          _uid: genUid(),
        })
      }
    }
    if (didGroup.subitems!.length) node.subitems!.push(didGroup)
  }
  else if (sid === '0x31') {
    // 31H: 整表挂在分类组节点上供 SheetTable 编辑
    if (allSheets['31H']) {
      const routineGroup: UdsNode = {
        services: '例程', Description: '例程控制 (31H)', Code: '',
        nodeKind: 'group', sheetName: '31H',
        routineRows: cloneSheet(allSheets['31H']),
        subitems: [], _uid: genUid(),
      }
      node.subitems!.push(routineGroup)
    }
  }
  else if (sid === '0x19') {
    // 1904 / 1906: 整表挂在分类组节点上
    if (allSheets['1904']) {
      node.subitems!.push({
        services: '1904', Description: '快照数据 (1904)', Code: '',
        nodeKind: 'group', sheetName: '1904',
        snapshot1904Rows: cloneSheet(allSheets['1904']),
        subitems: [], _uid: genUid(),
      })
    }
    if (allSheets['1906']) {
      node.subitems!.push({
        services: '1906', Description: '扩展数据 (1906)', Code: '',
        nodeKind: 'group', sheetName: '1906',
        extended1906Rows: cloneSheet(allSheets['1906']),
        subitems: [], _uid: genUid(),
      })
    }
  }
}

// 匹配 2E_DID 列名与 2E_H 的 DID 号（忽略 0x 前缀和大小写）
function matchDidKey(map: Map<string, any>, didId: string): string | null {
  const norm = (s: string) => s.replace(/^0x/i, '').replace(/,/g, '').toLowerCase().trim()
  const target = norm(didId)
  for (const key of map.keys()) {
    if (norm(key) === target) return key
  }
  return null
}

function cloneSheet(sheet: any): SheetData {
  return {
    columns: Array.isArray(sheet.columns) ? [...sheet.columns] : [],
    rows: Array.isArray(sheet.rows) ? sheet.rows.map((r: any[]) => [...r]) : [],
  }
}

watch(
  () => store.moduleStates.uds.lastUploadResult,
  (res) => {
    if (!res) return
    // res 可能是 { data: {...} } 或直接 {...}
    const data = res?.data ?? res
    const serviceSheet = data?.['服务'] || data?.service || data?.['Service']
    if (!serviceSheet || !serviceSheet.rows || !serviceSheet.rows.length) {
      ElMessage.warning('Excel 中未找到"服务"sheet 或为空')
      return
    }
    const rows = serviceSheet.rows as any[][]
    // 传入所有 sheet 数据，供服务节点按ID加载对应的 sheet 配置
    const tree = buildTreeFromServiceSheet(rows, data)
    if (!tree.length) {
      ElMessage.warning('未从"服务"sheet 解析到服务节点')
      return
    }
    treeData.value = tree
    expandedKeys.value = tree.map((s) => s._uid!)
    treeKey.value++
    ElMessage.success(`已从 Excel 解析 ${tree.length} 个服务，共 ${countNodes(tree)} 节点`)
  }
)

// ===== UID 管理 =====
function assignUids(nodes: UdsNode[]) {
  for (const node of nodes) {
    if (!node._uid) node._uid = genUid()
    if (!node.subitems) node.subitems = []
    assignUids(node.subitems)
  }
}

function stripUids(nodes: UdsNode[]): any[] {
  return nodes.map((node) => {
    const o: any = {
      services: node.services,
      Description: node.Description,
      Code: node.Code,
      subitems: node.subitems ? stripUids(node.subitems) : [],
    }
    // 保留子功能扩展字段（undefined 不会进入 JSON.stringify）
    if (node.params !== undefined) o.params = node.params
    if (node.securityAccess !== undefined) o.securityAccess = node.securityAccess
    if (node.suppressPos !== undefined) o.suppressPos = node.suppressPos
    if (node.addressDefPhys !== undefined) o.addressDefPhys = node.addressDefPhys
    if (node.addressExtPhys !== undefined) o.addressExtPhys = node.addressExtPhys
    if (node.addressDefFunc !== undefined) o.addressDefFunc = node.addressDefFunc
    if (node.addressExtFunc !== undefined) o.addressExtFunc = node.addressExtFunc
    if (node.nrcList !== undefined) o.nrcList = node.nrcList
    if (node.nrc22Condition !== undefined) o.nrc22Condition = node.nrc22Condition
    if (node.sendLength !== undefined) o.sendLength = node.sendLength
    // 保留节点类型标识与 DID 配置数据
    if (node.nodeKind !== undefined) o.nodeKind = node.nodeKind
    if (node.sheetName !== undefined) o.sheetName = node.sheetName
    if (node.didConfig !== undefined) o.didConfig = node.didConfig
    if (node.writeFlowData !== undefined) o.writeFlowData = node.writeFlowData
    // 保留分类组节点的整表数据（31H/1904/1906）
    if (node.routineRows !== undefined) o.routineRows = node.routineRows
    if (node.snapshot1904Rows !== undefined) o.snapshot1904Rows = node.snapshot1904Rows
    if (node.extended1906Rows !== undefined) o.extended1906Rows = node.extended1906Rows
    return o
  })
}

// ===== 配置切换 =====

/** 静默持久化指定配置（用于切换前的自动保存），返回是否成功 */
async function persistConfig(name: string): Promise<boolean> {
  if (!name) return false
  try {
    await updateTree(name, { services: stripUids(treeData.value), oem: store.selectedOem })
    return true
  } catch {
    return false
  }
}

/** 配置被删除：清除内存数据归属，避免切换时自动保存"复活"已删除配置 */
function onConfigDelete(name: string) {
  if (loadedConfig.value === name) loadedConfig.value = ''
}

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
  selectedConfig.value = name
  loadedConfig.value = ''
  await loadTree(name, token)
}

async function onConfigCreate(name: string) {
  const hasConfig = !!selectedConfig.value
  // 新建配置会切走当前配置：先自动保存当前配置，避免未保存内容丢失
  const prevName = loadedConfig.value
  if (prevName && prevName !== name) {
    await persistConfig(prevName)
  }
  // 有选择配置时使用默认模板，无配置时保留当前数据
  const dataToSave: { services: UdsNode[]; oem?: string } = hasConfig
    ? { services: [] }
    : { services: treeData.value || [] }
  dataToSave.oem = store.selectedOem
  try {
    await saveConfig('uds', name, dataToSave)
    selectedConfig.value = name
    loadedConfig.value = name
    ElMessage.success(`配置 "${name}" 已创建`)
    // 有配置时清空数据
    if (hasConfig) {
      treeData.value = []
    }
    // 刷新配置列表并选中新配置
    if (toolbarRef.value) {
      await toolbarRef.value.loadConfigs()
      toolbarRef.value.selectedConfig = name
    }
  } catch {
    // 错误已由拦截器处理
  }
}

async function loadTree(config: string, token: number = configChangeToken) {
  if (!config) return
  loading.value = true
  selectedNode.value = null
  try {
    const res: any = await getTree(config)
    if (token !== configChangeToken) return
    const data = res?.data || {}
    const services: UdsNode[] = data.services || []
    assignUids(services)
    treeData.value = services
    expandedKeys.value = services.map((s) => s._uid!)
    treeKey.value++
    // 回填主机厂选择
    if (data.oem) {
      store.setSelectedOem(data.oem)
    }
    // 标记内存数据归属该配置，后续切换时据此安全自动保存
    loadedConfig.value = config
  } catch {
    if (token !== configChangeToken) return
    treeData.value = []
  } finally {
    if (token === configChangeToken) loading.value = false
  }
}

// ===== 树节点操作 =====
function onNodeClick(data: UdsNode) {
  selectedNode.value = data
}

function onNodeContextmenu(event: MouseEvent, data: UdsNode) {
  event.preventDefault()
  event.stopPropagation()
  selectedNode.value = data
  // 边界检查，防止菜单超出视口
  const x = Math.min(event.clientX, window.innerWidth - 160)
  const y = Math.min(event.clientY, window.innerHeight - 200)
  contextMenu.value = { visible: true, x, y, node: data }
}

function closeContextMenu() {
  contextMenu.value.visible = false
}

/** 查找包含目标节点的数组 */
function findContainer(nodes: UdsNode[], target: UdsNode): UdsNode[] | null {
  for (const node of nodes) {
    if (node === target) return nodes
    if (node.subitems) {
      const found = findContainer(node.subitems, target)
      if (found) return found
    }
  }
  return null
}

// ===== 右键菜单动作 =====
function contextAddChild() {
  const parent = contextMenu.value.node
  if (!parent) return
  if (!parent.subitems) parent.subitems = []
  const newNode: UdsNode = {
    services: '00',
    Description: '新子项',
    Code: '',
    subitems: [],
    _uid: genUid(),
    ...makeSubFunctionDefaults(),
  }
  parent.subitems.push(newNode)
  closeContextMenu()
}

function contextDelete() {
  const target = contextMenu.value.node
  if (!target) return
  ElMessageBox.confirm(
    `确定删除节点 "${target.services} ${target.Description}" 吗？`,
    '删除确认',
    { type: 'warning' }
  )
    .then(() => {
      const container = findContainer(treeData.value, target)
      if (container) {
        const idx = container.indexOf(target)
        if (idx > -1) container.splice(idx, 1)
      }
      if (selectedNode.value === target) selectedNode.value = null
      closeContextMenu()
      ElMessage.success('删除成功')
    })
    .catch(() => closeContextMenu())
}

function contextMoveUp() {
  const target = contextMenu.value.node
  if (!target) return
  const container = findContainer(treeData.value, target)
  if (container) {
    const idx = container.indexOf(target)
    if (idx > 0) {
      container.splice(idx, 1)
      container.splice(idx - 1, 0, target)
    }
  }
  closeContextMenu()
}

function contextMoveDown() {
  const target = contextMenu.value.node
  if (!target) return
  const container = findContainer(treeData.value, target)
  if (container) {
    const idx = container.indexOf(target)
    if (idx < container.length - 1) {
      container.splice(idx, 1)
      container.splice(idx + 1, 0, target)
    }
  }
  closeContextMenu()
}

// ===== 快捷键：树节点条目级操作（复用上面的右键菜单动作，不新增删除/移动逻辑）=====
/** 把当前选中节点交给右键菜单动作（这些动作读取 contextMenu.node），再执行 */
function runContextActionOnSelected(action: () => void): boolean {
  const target = selectedNode.value
  if (!target) return false
  // 节点已不在树中（如切换配置后残留的选中）时不处理
  if (!findContainer(treeData.value, target)) return false
  contextMenu.value.node = target
  action()
  return true
}

/** F2：定位详情面板中的名称/描述输入框并聚焦全选（重命名无独立函数，直接绑在表单 v-model 上） */
function focusNodeNameInput(): boolean {
  const pane = document.querySelector('.uds-view .detail-pane')
  if (!pane) return false
  const items = Array.from(pane.querySelectorAll('.el-form-item'))
  for (const item of items) {
    const label = item.querySelector('.el-form-item__label')?.textContent || ''
    if (!label.includes('名称') && !label.includes('描述')) continue
    const input = item.querySelector('input.el-input__inner, textarea.el-textarea__inner') as
      HTMLInputElement | HTMLTextAreaElement | null
    if (!input) continue
    input.focus()
    input.select()
    return true
  }
  return false
}

// 注册到统一快捷键层：module 作用域，未选中节点时不接管
useShortcut({
  id: 'uds:deleteNode',
  keys: 'Delete',
  scope: 'module',
  desc: '删除选中的树节点（同右键「删除节点」，含确认弹窗）',
  when: () => isModuleActive('/uds') && !!selectedNode.value,
  run: () => runContextActionOnSelected(contextDelete),
})
useShortcut({
  id: 'uds:addChildNode',
  keys: 'Insert',
  scope: 'module',
  desc: '为选中节点添加子节点（同右键「添加子节点」）',
  when: () => isModuleActive('/uds') && !!selectedNode.value,
  run: () => runContextActionOnSelected(contextAddChild),
})
useShortcut({
  id: 'uds:moveNodeUp',
  keys: 'Alt+ArrowUp',
  scope: 'module',
  desc: '上移选中的树节点（同右键「上移」）',
  when: () => isModuleActive('/uds') && !!selectedNode.value,
  run: () => runContextActionOnSelected(contextMoveUp),
})
useShortcut({
  id: 'uds:moveNodeDown',
  keys: 'Alt+ArrowDown',
  scope: 'module',
  desc: '下移选中的树节点（同右键「下移」）',
  when: () => isModuleActive('/uds') && !!selectedNode.value,
  run: () => runContextActionOnSelected(contextMoveDown),
})
useShortcut({
  id: 'uds:renameNode',
  keys: 'F2',
  scope: 'module',
  desc: '重命名选中的树节点（聚焦详情面板名称输入框）',
  when: () => isModuleActive('/uds') && !!selectedNode.value,
  run: () => focusNodeNameInput(),
})

// ===== 树底部按钮 =====
function addRootNode() {
  treeData.value.push({
    services: '00',
    Description: '新服务',
    Code: '',
    subitems: [],
    _uid: genUid(),
  })
}

function expandAll() {
  const tree = treeRef.value
  if (!tree?.store) return
  const nodes = tree.store.nodesMap || {}
  Object.values(nodes).forEach((node: any) => {
    node.expanded = true
  })
}

function collapseAll() {
  const tree = treeRef.value
  if (!tree?.store) return
  const nodes = tree.store.nodesMap || {}
  Object.values(nodes).forEach((node: any) => {
    node.expanded = false
  })
}

// ===== 子项操作 =====
function addSubitem() {
  if (!selectedNode.value) return
  if (!selectedNode.value.subitems) selectedNode.value.subitems = []
  selectedNode.value.subitems.push({
    services: '00',
    Description: '新子项',
    Code: '',
    nodeKind: 'subfunc',
    subitems: [],
    _uid: genUid(),
    ...makeSubFunctionDefaults(),
  })
}

function removeSubitem(index: number) {
  if (!selectedNode.value?.subitems) return
  selectedNode.value.subitems.splice(index, 1)
}

// ===== 保存树数据 =====
async function onSave() {
  if (!selectedConfig.value) {
    ElMessage.warning('请先选择配置')
    return
  }
  saving.value = true
  try {
    const cleanData = stripUids(treeData.value)
    await updateTree(selectedConfig.value, { services: cleanData, oem: store.selectedOem })
    loadedConfig.value = selectedConfig.value
    ElMessage.success('树数据保存成功')
  } catch {
    // 错误已由拦截器处理
  } finally {
    saving.value = false
  }
}

// ===== 生成测试模块 =====
async function onGenerate() {
  if (!selectedConfig.value) {
    ElMessage.warning('请先选择配置')
    return
  }
  generating.value = true
  try {
    const cfgDir = store.cfgData?.cfg_dir || ''
    const res: any = await generateUDS(selectedConfig.value, cfgDir)
    generateResult.value = res?.data ?? null
    ElMessage.success(res?.message || 'UDS 测试模块生成成功')
  } catch {
    generateResult.value = null
    // 错误已由拦截器处理
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

// ===== 刷新 =====
function onRefresh() {
  if (selectedConfig.value) {
    loadTree(selectedConfig.value)
  }
}

// ===== 拖拽调整面板宽度 =====
let isResizing = false

function startResize(e: MouseEvent) {
  e.preventDefault()
  isResizing = true
  document.addEventListener('mousemove', onResize)
  document.addEventListener('mouseup', stopResize)
}

function onResize(e: MouseEvent) {
  if (!isResizing || !bodyRef.value) return
  const rect = bodyRef.value.getBoundingClientRect()
  const percent = ((e.clientX - rect.left) / rect.width) * 100
  leftWidth.value = Math.min(70, Math.max(20, percent))
}

function stopResize() {
  isResizing = false
  document.removeEventListener('mousemove', onResize)
  document.removeEventListener('mouseup', stopResize)
}

// ===== 生命周期 =====
onMounted(() => {
  document.addEventListener('click', closeContextMenu)
})

onUnmounted(() => {
  document.removeEventListener('click', closeContextMenu)
  document.removeEventListener('mousemove', onResize)
  document.removeEventListener('mouseup', stopResize)
})
</script>

<style scoped lang="scss">
.uds-view {
  display: flex;
  flex-direction: column;
  height: calc(100vh - var(--header-height) - var(--tab-height) - 32px);
}

.generate-notice {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  margin: 8px 16px 0;
  background: var(--el-color-success-light-9);
  border: 1px solid var(--el-color-success-light-7);
  border-radius: 8px;

  .output-path {
    flex: 1;
    font-size: 13px;
    color: var(--text-secondary);
    word-break: break-all;
  }
}

/* ========== 主体区域 ========== */
.uds-body {
  flex: 1;
  display: flex;
  min-height: 0;
}

/* ========== 左侧树面板 ========== */
.tree-pane {
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
  flex-shrink: 0;
}

.card-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.node-count {
  margin-left: auto;
}

.tree-container {
  flex: 1;
  overflow: auto;
  position: relative;

  :deep(.el-tree) {
    background: transparent;

    .el-tree-node__content {
      height: 32px;

      &:hover {
        background: var(--bg-hover);
      }
    }

    .el-tree-node.is-current > .el-tree-node__content {
      background: rgba(24, 144, 255, 0.08);
    }
  }
}

.tree-node {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;

  .node-icon {
    font-size: 14px;

    &.folder {
      color: var(--color-primary);
    }

    &.leaf {
      color: var(--color-success);
    }
  }

  .node-id {
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 12px;
    font-weight: 600;
    color: var(--color-primary);
    background: var(--bg-hover);
    padding: 1px 6px;
    border-radius: 3px;
    min-width: 28px;
    text-align: center;
  }

  .node-desc {
    font-size: 13px;
    color: var(--text-regular);
  }
}

.empty-tree {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: var(--text-secondary);
  gap: 8px;

  .empty-icon {
    font-size: 40px;
    opacity: 0.3;
  }
}

.tree-footer {
  display: flex;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--border-color-light);
  flex-shrink: 0;
}

/* ========== 拖拽分隔条 ========== */
.splitter {
  width: 6px;
  cursor: col-resize;
  background: transparent;
  flex-shrink: 0;
  position: relative;
  transition: background 0.2s;

  &::after {
    content: '';
    position: absolute;
    left: 2px;
    top: 0;
    bottom: 0;
    width: 2px;
    background: var(--border-color-light);
    transition: background 0.2s;
  }

  &:hover::after {
    background: var(--color-primary);
  }
}

/* ========== 右侧详情面板 ========== */
.detail-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  min-width: 0;
}

/* ========== 对象浏览器侧边栏 ========== */
.uds-side-wrap {
  position: relative;
  flex-shrink: 0;
  display: flex;
  min-height: 0;
}

.uds-side {
  width: 340px;
  flex-shrink: 0;
  overflow: hidden;
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
  color: var(--text-secondary, #909399);
  transition: all 0.2s;

  &:hover {
    color: var(--color-primary, var(--el-color-primary));
    border-color: var(--color-primary, var(--el-color-primary));
  }
}

.detail-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.detail-form {
  max-width: 640px;
}

.subfunc-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.check-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
}

.nrc-editor {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.addr-mini,
.nrc-mini {
  font-size: 12px;
  color: var(--text-secondary);
  font-family: 'Consolas', 'Monaco', monospace;
}

.subitems-section {
  .sub-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-regular);
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
}

/* ========== Sheet Tab 切换区域 ========== */
.sheet-tabs-section {
  margin-bottom: 16px;
  padding: 8px;
  background: var(--bg-page, #f5f7fa);
  border-radius: 4px;
  border: 1px solid var(--border-light, #e4e7ed);

  :deep(.el-tabs__header) {
    margin-bottom: 8px;
  }

  :deep(.el-tabs__item) {
    font-size: 12px;
    height: 28px;
    line-height: 28px;
    padding: 0 10px;
  }

  :deep(.el-table) {
    font-size: 12px;
  }

  :deep(.el-table__cell) {
    padding: 2px 0;
  }

  :deep(.el-input__inner) {
    padding: 0 6px;
    font-size: 12px;
    height: 26px;
  }
}

.subitems-table {
  :deep(.el-input__inner) {
    padding: 0 8px;
  }
}

.empty-subitems {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 30px;
  color: var(--text-secondary);
  gap: 8px;
  font-size: 13px;

  .el-icon {
    font-size: 28px;
    opacity: 0.4;
  }
}

/* ========== 底部操作区 ========== */
.bottom-actions {
  display: flex;
  gap: 12px;
  padding: 16px 20px;
  background: var(--bg-card);
  border-radius: var(--radius-base);
  box-shadow: var(--shadow-card);
  margin-top: 12px;
  flex-shrink: 0;
}

/* ========== 右键上下文菜单 ========== */
.uds-context-menu {
  position: fixed;
  z-index: 3000;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-small);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  padding: 4px 0;
  min-width: 140px;
  user-select: none;

  .context-menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    font-size: 13px;
    color: var(--text-regular);
    cursor: pointer;
    transition: var(--transition-base);

    &:hover {
      background: var(--bg-hover);
      color: var(--color-primary);
    }

    &.danger:hover {
      color: var(--color-error);
    }
  }

  .context-menu-divider {
    height: 1px;
    background: var(--border-color-light);
    margin: 4px 0;
  }
}
</style>

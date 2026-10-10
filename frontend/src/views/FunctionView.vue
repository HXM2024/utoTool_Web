<template>
  <div class="function-view">
    <!-- 顶部: 配置管理工具条 -->
    <ConfigToolbar
      ref="toolbarRef"
      module-name="function"
      @config-change="onConfigChange"
      @create="onCreate"
      @copy="onCopy"
      @delete="onDelete"
      @save="onSave"
      @generate="handleGenerate"
      @refresh="onRefresh"
    />

    <div class="function-body">
    <div class="function-main">
    <!-- 配置参数区（后端生成参数，与图形配置互补） -->
    <div class="app-card config-card">
      <div class="card-title">
        <span>配置参数</span>
      </div>
      <el-form :model="configPageData" label-width="120px" class="config-form">
        <el-row :gutter="24">
          <el-col :span="8">
            <el-form-item label="A2L_Qualifier">
              <el-input
                v-model="configPageData.a2lQualifierLineEdit"
                placeholder="A2L ECU 名称"
              />
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
                <el-input
                  v-model="configPageData.readySignal"
                  placeholder="信号名（拖拽）"
                />
              </div>
            </el-form-item>
          </el-col>
          <el-col :span="8"></el-col>
        </el-row>
        <el-row :gutter="24">
          <el-col :span="8">
            <el-form-item label="CDD_Qualifier">
              <el-input
                v-model="configPageData.cddQualifierLineEdit"
                placeholder="CDD在CANoe工程中的Name"
              />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="Ready_On">
              <el-input
                v-model="configPageData.readyOnValue"
                placeholder="开启值"
              />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="Ready_Off">
              <el-input
                v-model="configPageData.readyOffValue"
                placeholder="关闭值"
              />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
    </div>

    <!-- 用例预览（只读回显）+ 代码预览；用例编排统一在「图形配置」中完成 -->
    <div class="app-card result-card preview-card">
      <div class="card-title">
        <span>用例预览</span>
        <el-tag v-if="testCaseList.length" size="small" type="success">{{ testCaseList.length }} 条用例</el-tag>
        <el-button class="group-add" size="small" plain :icon="Plus" @click="addCaseGroup">新建分组</el-button>
      </div>

      <div class="preview-grid">
        <!-- 左：按分组展示用例（每组一份独立图形配置） -->
        <div class="preview-cases-wrap" :style="{ width: casesWidth + 'px' }">
          <ResizableSplitter direction="horizontal" :on-drag="onCasesDrag" />
          <div class="preview-cases">
          <div class="pane-title">
            <span>用例分组</span>
            <el-button size="small" text @click="collapseAllGroups">全部折叠</el-button>
            <el-button size="small" text @click="expandAllGroups">全部展开</el-button>
          </div>
          <div class="case-list">
            <el-dropdown
              v-for="(grp, gi) in graph.groups || []"
              :key="grp.id"
              class="group-dropdown"
              trigger="contextmenu"
              @command="(cmd: string) => onGroupMenu(cmd, grp)"
            >
              <div class="case-group">
                <div class="group-head">
                  <el-icon
                    class="group-collapse"
                    :title="isGroupCollapsed(grp.id) ? '展开分组' : '收起分组'"
                    @click.stop="toggleGroupCollapse(grp.id)"
                  >
                    <component :is="isGroupCollapsed(grp.id) ? ArrowRight : ArrowDown" />
                  </el-icon>
                  <span class="group-idx">分组{{ gi + 1 }}</span>
                  <el-input
                    v-model="grp.name"
                    size="small"
                    class="group-name-input"
                    placeholder="分组名称（用例名前缀）"
                    @change="onGroupMetaChange"
                  />
                  <span class="group-count">{{ groupCaseCount(grp.id) }} 条</span>
                  <el-button size="small" type="primary" plain :icon="Connection" @click="openGraphEditor(grp.id)">
                    图形配置
                  </el-button>
                  <el-button
                    size="small"
                    text
                    type="danger"
                    :icon="Delete"
                    :disabled="(graph.groups || []).length <= 1"
                    title="删除分组"
                    @click="removeCaseGroup(grp.id)"
                  />
                </div>
                <div v-show="!isGroupCollapsed(grp.id)" class="group-cases">
                  <div
                    v-for="c in casesOfGroup(grp.id)"
                    :key="c.case_id"
                    class="case-item"
                    title="点击定位到右侧代码预览"
                    @click="locateCaseInCode(c)"
                  >
                    <span class="case-name" :title="c.case_id">{{ c.case_id }}</span>
                    <span class="case-meta">{{ c.lines }} 行</span>
                  </div>
                  <div v-if="!casesOfGroup(grp.id).length" class="empty-mini">该分组暂无用例</div>
                </div>
              </div>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="import" :icon="Upload">导入用例</el-dropdown-item>
                  <el-dropdown-item command="export" :icon="Download">导出为 Excel</el-dropdown-item>
                  <el-dropdown-item command="exportAll" :icon="Download" divided>
                    全部导出（每组一个 Sheet）
                  </el-dropdown-item>
                  <el-dropdown-item command="transfer" :icon="CopyDocument" divided>
                    复制 / 推送到其它配置…
                  </el-dropdown-item>
                  <el-dropdown-item command="fileTransfer" :icon="Document">
                    导出 / 导入分组文件…
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>

            <!-- 导入 Excel 等非图形来源的用例（无分组） -->
            <div v-if="ungroupedCases.length" class="case-group">
              <div class="group-head">
                <span class="group-idx">未分组</span>
                <span class="group-count">{{ ungroupedCases.length }} 条</span>
              </div>
              <div class="group-cases">
                <div
                  v-for="c in ungroupedCases"
                  :key="c.case_id"
                  class="case-item"
                  title="点击定位到右侧代码预览"
                  @click="locateCaseInCode(c)"
                >
                  <span class="case-name" :title="c.case_id">{{ c.case_id }}</span>
                  <span class="case-meta">{{ c.lines }} 行</span>
                </div>
              </div>
            </div>

            <div v-if="!testCaseList.length" class="empty-mini">
              暂无用例：点击分组「图形配置」编排用例，或导入 Excel 解析
            </div>
          </div>
        </div>
        </div>

        <!-- 右：代码预览 -->
        <div class="preview-code">
          <div class="pane-title">
            <span>代码预览</span>
            <div class="code-actions">
              <el-radio-group v-model="caplSubTab" size="small">
                <el-radio-button label="testcases">TestCase</el-radio-button>
                <el-radio-button label="function">Function</el-radio-button>
                <el-radio-button label="arrayfunc">ArrayFunc</el-radio-button>
              </el-radio-group>
              <el-button
                v-if="currentCaplCode"
                text
                size="small"
                :icon="CopyDocument"
                @click="copyCode(currentCaplCode)"
              >
                复制
              </el-button>
            </div>
          </div>
          <div v-if="currentCaplCode" class="code-block">
            <div class="code-header">
              <span class="code-lang">{{ caplFileLabel }}</span>
            </div>
            <div class="code-body">
              <pre class="code-pre"><code v-html="highlightedCapl" class="hljs"></code></pre>
            </div>
          </div>
          <div v-else class="empty-mini">暂无 {{ caplFileLabel }} 代码</div>
        </div>
      </div>
    </div>

    <!-- 底部操作区 -->
    <div class="app-card action-bar">
      <div class="action-left">
        <template v-if="generatedDir">
          <el-icon class="dir-icon"><FolderOpened /></el-icon>
          <span class="generated-path" :title="generatedDir">{{ generatedDir }}</span>
          <el-button type="info" :icon="FolderOpened" size="small" @click="handleOpenDir">打开</el-button>
        </template>
        <span v-else class="action-hint">选择配置后可生成文件</span>
      </div>
      <div class="action-right">
        <el-button
          type="primary"
          :icon="Promotion"
          :loading="generating"
          :disabled="!currentConfig"
          @click="handleGenerate"
        >
          生成文件
        </el-button>
      </div>
    </div>
    </div>

    <!-- 对象浏览器侧边栏（共享全局数据：CFG 优先，上传覆盖刷新） -->
    <div v-show="!panelCollapsed" class="function-side-wrap">
      <ResizableSplitter direction="horizontal" side="end" :on-drag="onSideDrag" />
      <div class="function-side" :style="{ width: sideWidth + 'px' }">
        <ObjectPanel
        :dbc-raw="store.objMergedDbcRaw"
        :dtc-raw="store.objDtcRaw"
        :a2l-vars="store.objA2lVars"
        :dbc-env-vars="store.objDbcEnvVars"
        :a2l-qualifier="store.objA2lQualifier"
        @collapse="panelCollapsed = true"
        @expand="panelCollapsed = false"
      >
        <template #header-actions>
          <el-upload
            :show-file-list="false"
            :auto-upload="false"
            accept=".dbc,.xlsx,.xls,.a2l"
            :on-change="onDbcFileChange"
          >
            <el-button
              text
              size="small"
              :icon="Upload"
              :loading="dbcUploading"
              title="上传 DBC / Excel / A2L（解析后载入对象浏览器）"
            />
          </el-upload>
        </template>
      </ObjectPanel>
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

    <!-- 图形化用例配置：独立全屏编辑器 -->
    <FunctionGraphEditor
      v-if="graphEditorVisible"
      v-model:graph="graph"
      v-model:mapping="mapping"
      :cards="cards"
      :value-library="valueLibrary"
      :active-group-id="activeGroupId"
      :ccp-var-types="store.ccpVarTypes"
      @close="graphEditorVisible = false"
      @save="onGraphSave"
      @generate="onGraphGenerate"
    />

    <!-- 分组复制 / 推送（跨配置，整组搬：工况框 + 卡片库 + 映射表 + 值资源库） -->
    <el-dialog v-model="transferVisible" title="复制 / 推送到其它配置" width="620px" append-to-body>
      <div class="grp-form">
        <div class="grp-row">
          <span class="grp-label">方向</span>
          <el-radio-group v-model="transferMode" size="small" @change="loadTransferGroups">
            <el-radio-button label="pull">从其它配置复制到当前配置</el-radio-button>
            <el-radio-button label="push">把当前配置的分组推送到其它配置</el-radio-button>
          </el-radio-group>
        </div>
        <div class="grp-row">
          <span class="grp-label">{{ transferMode === 'pull' ? '源配置' : '目标配置' }}</span>
          <el-select
            v-if="transferMode === 'pull'"
            v-model="transferSourceConfig"
            size="small"
            style="flex: 1"
            placeholder="选择要复制的配置"
            @change="loadTransferGroups"
          >
            <el-option v-for="n in transferConfigList" :key="n" :label="n" :value="n" />
          </el-select>
          <el-select
            v-else
            v-model="transferTargetConfig"
            size="small"
            style="flex: 1"
            placeholder="选择要推送到的配置"
          >
            <el-option
              v-for="n in transferConfigList.filter((x) => x !== currentConfig)"
              :key="n"
              :label="n"
              :value="n"
            />
          </el-select>
        </div>
        <div class="grp-row grp-row-top">
          <span class="grp-label">分组</span>
          <div v-loading="transferLoading" class="grp-list">
            <el-checkbox-group v-model="transferSelected">
              <div v-for="g in transferGroups" :key="g.id" class="grp-item">
                <el-checkbox :value="g.id">
                  <span class="grp-name">{{ g.name }}</span>
                  <span class="grp-meta">
                    {{ g.frames.length }} 个工况框 · {{ cardCountOf(g) }} 张库卡片
                  </span>
                </el-checkbox>
              </div>
            </el-checkbox-group>
            <div v-if="!transferLoading && !transferGroups.length" class="grp-empty">
              {{ transferMode === 'pull' ? '该配置下没有分组' : '当前配置下没有分组' }}
            </div>
          </div>
        </div>
        <div class="grp-hint">
          <template v-if="transferMode === 'pull'">
            复制到当前配置后新增分组（重名自动加「_来自&lt;源配置&gt;」后缀），并带上该分组的卡片库 /
            映射表 / 值资源库；改动需点「保存」落盘。
          </template>
          <template v-else>
            推送会立即写入目标配置：以该配置当前的磁盘内容为基础追加分组后整体写回，目标配置的其它内容保持不变。
          </template>
        </div>
      </div>
      <template #footer>
        <el-button size="small" @click="transferVisible = false">取消</el-button>
        <el-button size="small" text :disabled="!transferGroups.length" @click="toggleTransferAll">
          {{ transferSelected.length === transferGroups.length ? '全不选' : '全选' }}
        </el-button>
        <el-button
          size="small"
          type="primary"
          :disabled="!transferSelected.length || transferLoading"
          @click="confirmTransfer"
        >
          {{ transferMode === 'pull' ? '复制' : '推送' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 分组导出为 .json / 从 .json 导入 -->
    <el-dialog v-model="fileTransferVisible" title="导出 / 导入分组文件" width="620px" append-to-body>
      <div class="grp-form">
        <div class="grp-row">
          <span class="grp-label">方向</span>
          <el-radio-group v-model="fileMode" size="small">
            <el-radio-button label="export">导出分组为文件</el-radio-button>
            <el-radio-button label="import">从文件导入分组</el-radio-button>
          </el-radio-group>
        </div>

        <template v-if="fileMode === 'export'">
          <div class="grp-row grp-row-top">
            <span class="grp-label">分组</span>
            <div class="grp-list">
              <el-checkbox-group v-model="fileExportSelected">
                <div v-for="g in fileExportGroups" :key="g.id" class="grp-item">
                  <el-checkbox :value="g.id">
                    <span class="grp-name">{{ g.name }}</span>
                    <span class="grp-meta">
                      {{ g.frames.length }} 个工况框 · {{ cardCountOf(g) }} 张库卡片
                    </span>
                  </el-checkbox>
                </div>
              </el-checkbox-group>
              <div v-if="!fileExportGroups.length" class="grp-empty">当前配置下没有分组</div>
            </div>
          </div>
          <div class="grp-hint">
            导出为 .json 文件（含工况框 / 卡片库 / 映射表 / 值资源库），可在其它机器或其它配置里导入。
          </div>
        </template>

        <template v-else>
          <div class="grp-row">
            <span class="grp-label">文件</span>
            <el-button size="small" :icon="Document" @click="pickGroupFile">选择分组文件…</el-button>
            <span v-if="fileImportName" class="grp-file-name">{{ fileImportName }}</span>
          </div>
          <div class="grp-row grp-row-top">
            <span class="grp-label">分组</span>
            <div class="grp-list">
              <div v-for="(g, i) in fileImportGroups" :key="i" class="grp-item grp-item-readonly">
                <span class="grp-name">{{ g.name }}</span>
                <span class="grp-meta">
                  {{ (g.frames || []).length }} 个工况框 · {{ cardCountOf(g) }} 张库卡片
                </span>
              </div>
              <div v-if="!fileImportGroups.length" class="grp-empty">请先选择分组文件</div>
            </div>
          </div>
          <div class="grp-hint">
            导入后在当前配置新增分组（重名自动加「_来自&lt;来源&gt;」后缀）；改动需点「保存」落盘。
          </div>
        </template>
      </div>
      <template #footer>
        <el-button size="small" @click="fileTransferVisible = false">取消</el-button>
        <template v-if="fileMode === 'export'">
          <el-button size="small" text :disabled="!fileExportGroups.length" @click="toggleFileExportAll">
            {{ fileExportSelected.length === fileExportGroups.length ? '全不选' : '全选' }}
          </el-button>
          <el-button
            size="small"
            type="primary"
            :disabled="!fileExportSelected.length"
            @click="exportGroupsToFile"
          >
            导出
          </el-button>
        </template>
        <el-button
          v-else
          size="small"
          type="primary"
          :disabled="!fileImportGroups.length"
          @click="confirmFileImport"
        >
          导入
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch, h } from 'vue'

defineOptions({ name: 'FunctionView' })
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Promotion,
  FolderOpened,
  CopyDocument,
  Expand,
  Connection,
  Plus,
  Delete,
  Upload,
  Download,
  Document,
  ArrowRight,
  ArrowDown,
  Fold,
} from '@element-plus/icons-vue'
import hljs from 'highlight.js/lib/core'
import xmlLang from 'highlight.js/lib/languages/xml'
import cLang from 'highlight.js/lib/languages/c'
import jsonLang from 'highlight.js/lib/languages/json'
import 'highlight.js/styles/atom-one-dark.css'
import ConfigToolbar from '@/components/ConfigToolbar.vue'
import ObjectPanel from '@/components/ObjectPanel.vue'
import ResizableSplitter from '@/components/ResizableSplitter.vue'
import { useResizableSize } from '@/composables/useResizableSize'
import FunctionGraphEditor from '@/components/graph/FunctionGraphEditor.vue'
import type { Graph, ObjectMapping, CardLibrary, CaseGroup, ValueResource } from '@/types/functionGraph'
import { emptyGraph, emptyMapping, emptyCardLibrary, emptyValueLibrary, emptyCaseGroup, genId } from '@/types/functionGraph'
import { normalizeStaleSeqAnchors, injectGlobalIntoGroup } from '@/utils/functionGraph'
import { generateFunction, expandCases, exportFunctionCases, importFunctionCases, loadGlobalSections } from '@/api/function'
import { getConfig, getConfigs, saveConfig, openFolder } from '@/api/config'
import { parseCAN, parseDbcFile, parseA2lFile } from '@/api/can'
import { useModuleStore } from '@/stores/modules'

// 注册 highlight.js 语言
hljs.registerLanguage('xml', xmlLang)
hljs.registerLanguage('c', cLang)
hljs.registerLanguage('json', jsonLang)

// ==================== State ====================

const toolbarRef = ref<InstanceType<typeof ConfigToolbar>>()
const currentConfig = ref('')
/** 当前内存中数据所归属的配置名（加载/切换过程中为空，用于切换前安全自动保存） */
const loadedConfig = ref('')
/** 配置切换/加载令牌：忽略过期请求，避免快速切换时数据错位 */
let configChangeToken = 0
const panelCollapsed = ref(false)
const [sideWidth, setSideWidth] = useResizableSize('function-side', 340, 240, 720)
/** 对象面板在右侧：splitter 向左拖（delta<0）时面板变宽 */
function onSideDrag(delta: number) {
  setSideWidth(sideWidth.value - delta)
}
const [casesWidth, setCasesWidth] = useResizableSize('function-cases', 380, 240, 720)
/** 用例分组在左侧：splitter 向右拖（delta>0）时分组列变宽 */
function onCasesDrag(delta: number) {
  setCasesWidth(casesWidth.value + delta)
}
const caplSubTab = ref('testcases')

const funcSteps = ref<Record<string, string>>({})
const testCases = ref('')
const testFunction = ref('')
const arrayFuncTest = ref('')
const xmlContent = ref<any>(null)
/** 后端结构化测试用例列表（Excel 导入或图形展开的结果，只读回显） */
type PreviewCase = {
  case_id: string
  lines: number
  first_line: string
  sheet: string
  steps?: Array<Record<string, any>>
  /** 所属用例分组 id / 名称（分组模式下由后端返回） */
  group_id?: string
  group_name?: string
}
const testCaseList = ref<PreviewCase[]>([])

/** 无分组的用例（如 Excel 导入），单独归入「未分组」 */
const ungroupedCases = computed(() => testCaseList.value.filter((c) => !c.group_id))

const generating = ref(false)
const generatedDir = ref('')

/** 图形化用例配置：图 + 全对象映射表（随配置保存） */
const graphEditorVisible = ref(false)
/** 打开图形配置时定位到的用例分组 id */
const activeGroupId = ref('')
const graph = ref<Graph>(emptyGraph())
const mapping = ref<ObjectMapping>(emptyMapping())
const cards = ref<CardLibrary>(emptyCardLibrary())
/** 值资源库（配置级；分组级内容存于 graph.groups[].valueLibrary） */
const valueLibrary = ref<ValueResource[]>(emptyValueLibrary())
/** 预览页中已展开的分组 id（纯 UI 态，不持久化；默认全部折叠，即集合为空） */
const expandedGroups = ref<Set<string>>(new Set())

const store = useModuleStore()

// ==================== 对象浏览器：DBC 上传 ====================
// 功能模块自身配置不含 DBC，且对象浏览器只读全局 store，这里提供直接上传入口：
// 解析后写入 store.objUploadDbcRaw，与 CAN 模块共享同一份对象浏览器数据
// （上传的 DBC 优先级高于 CFG 目录解析）。
const dbcUploading = ref(false)

async function onDbcFileChange(uploadFile: any) {
  const file: File | undefined = uploadFile?.raw
  if (!file) return
  const lower = file.name.toLowerCase()
  dbcUploading.value = true
  try {
    if (lower.endsWith('.dbc')) {
      const res: any = await parseDbcFile(file)
      const raw = res?.data || res
      if (raw?.columns && raw?.rows) {
        store.setUploadDbc(raw)
        ElMessage.success(`DBC 解析成功，已载入对象浏览器（${raw.rows.length} 行）`)
      } else {
        ElMessage.error('DBC 解析返回数据异常')
      }
    } else if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
      const res: any = await parseCAN(file)
      const parsed = res?.data || res || {}
      if (parsed.DBC) {
        store.setUploadDbc(parsed.DBC)
        ElMessage.success('Excel 解析成功，已载入对象浏览器')
      } else {
        ElMessage.error('该 Excel 中未找到「DBC Canmatrix」工作表')
      }
    } else if (lower.endsWith('.a2l')) {
      // 与侧栏的上传入口一致：功能模块自身不消费 A2L，但对象浏览器共享 A2L 变量
      const res: any = await parseA2lFile(file)
      const data = res?.data || {}
      store.setA2lVars({
        measurements: data.measurements || [],
        characteristics: data.characteristics || [],
      })
      ElMessage.success(
        data.total_vars
          ? `A2L 解析成功，已载入对象浏览器（${data.total_vars} 个变量）`
          : 'A2L 解析完成，未提取到变量',
      )
    } else {
      ElMessage.warning('仅支持 .dbc / .xlsx / .xls / .a2l')
    }
  } catch {
    ElMessage.error('DBC 解析失败')
  } finally {
    dbcUploading.value = false
  }
}

// 配置表单数据（后端生成参数）
const configPageData = ref({
  cddQualifierLineEdit: '',
  a2lQualifierLineEdit: '',
  readySignal: '',
  readyOnValue: '',
  readyOffValue: '',
})

// 监听 CFG 解析数据，自动填充表单（仅在表单为空时填充，不覆盖用户输入）
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

// ==================== Computed ====================

const hasData = computed(
  () =>
    Object.keys(funcSteps.value).length > 0 ||
    !!testCases.value ||
    !!testFunction.value ||
    !!arrayFuncTest.value ||
    !!xmlContent.value ||
    testCaseList.value.length > 0,
)

/** 当前 CAPL 代码（根据子选项卡） */
const currentCaplCode = computed(() => {
  switch (caplSubTab.value) {
    case 'testcases':
      return testCases.value
    case 'function':
      return testFunction.value
    case 'arrayfunc':
      return arrayFuncTest.value
    default:
      return ''
  }
})

const caplFileLabel = computed(() => {
  const labels: Record<string, string> = {
    testcases: 'TestCase.can',
    function: 'TestFunction.cin',
    arrayfunc: 'ArrayFuncTest.cin',
  }
  return labels[caplSubTab.value] || ''
})

const highlightedCapl = computed(() => {
  if (!currentCaplCode.value) return ''
  try {
    return hljs.highlight(currentCaplCode.value, { language: 'c' }).value
  } catch {
    return escapeHtml(currentCaplCode.value)
  }
})

/** 当前数据（用于保存配置） */
const currentData = computed(() => ({
  func_steps: funcSteps.value,
  test_cases: testCases.value,
  test_function: testFunction.value,
  array_func_test: arrayFuncTest.value,
  xml_content: xmlContent.value,
  test_case_list: testCaseList.value,
  cddQualifierLineEdit: configPageData.value.cddQualifierLineEdit,
  a2lQualifierLineEdit: configPageData.value.a2lQualifierLineEdit,
  readySignal: configPageData.value.readySignal,
  readyOnValue: configPageData.value.readyOnValue,
  readyOffValue: configPageData.value.readyOffValue,
  cfgDir: store.cfgData?.cfg_dir || '',
  oem: store.selectedOem,
  securityAlgo: store.selectedAlgo,
  graph: graph.value,
  // 配置级兜底：取第一个分组的内容（真正权威是 graph.groups[].{cards,mapping,valueLibrary}）
  mapping: graph.value.groups?.[0]?.mapping || mapping.value,
  cards: graph.value.groups?.[0]?.cards || cards.value,
  value_library: graph.value.groups?.[0]?.valueLibrary || valueLibrary.value,
  // CCP 系统变量类型表（对象浏览器双击变量指定）：随配置持久化，供生成「设置」系统变量时
  // 决定用 sysSetVariableInt 还是 sysSetVariableFloat
  ccp_var_types: store.ccpVarTypes,
}))

// ==================== Drag & Drop（配置参数 Ready 信号） ====================
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

// ==================== Helpers ====================

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function copyCode(text: string) {
  navigator.clipboard
    .writeText(text)
    .then(() => ElMessage.success('已复制到剪贴板'))
    .catch(() => ElMessage.error('复制失败'))
}

function resetData() {
  funcSteps.value = {}
  testCases.value = ''
  testFunction.value = ''
  arrayFuncTest.value = ''
  xmlContent.value = null
  testCaseList.value = []
  generatedDir.value = ''
  graph.value = emptyGraph()
  mapping.value = emptyMapping()
  cards.value = emptyCardLibrary()
  valueLibrary.value = emptyValueLibrary()
  expandedGroups.value = new Set()
  loadedConfig.value = ''
}

/** 深拷贝（避免多个分组共享同一份配置级数组引用） */
function deepCopy<T>(v: T): T {
  return JSON.parse(JSON.stringify(v))
}

/** 内容非空判定：用于区分「显式空」与「无该字段」 */
function hasCardsContent(c: any): boolean {
  return !!c && ((c.inject?.length || 0) + (c.sequence?.length || 0) + (c.result?.length || 0)) > 0
}
function hasMappingContent(m: any): boolean {
  return !!m && !!((m.signals?.length) || (m.dtcs?.length) || (m.messages?.length) || (m.envvars?.length) || (m.a2l?.length))
}
function hasOwn(o: any, k: string): boolean {
  return !!o && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k)
}

function normalizeGraph(
  data: any,
  fallback?: { mapping?: any; cards?: any; valueLibrary?: any },
  /** 出参：本次载入自愈的结果（接回的失效连线数 / 清理的过时冗余连线数） */
  stats?: { seqRepaired: number; seqRemoved: number },
): Graph {
  if (data && typeof data === 'object') {
    const g: Graph = {
      nodes: Array.isArray(data.nodes) ? data.nodes : [],
      edges: Array.isArray(data.edges) ? data.edges : [],
    }
    if (Array.isArray(data.frames)) g.frames = data.frames
    if (data.naming === 'path' || data.naming === 'default') g.naming = data.naming
    /**
     * 用例分组：每份分组是一份独立图形配置（含分组级卡片库/映射表/值资源库）。
     * 内容填充规则（区分「显式空」与「无字段」）：
     * 1) 分组显式带该字段 → 原样规范化（含显式空，表示该分组就是空的，不迁移）；
     * 2) 分组无该字段 + 配置级有内容 → 用配置级内容迁移（保留旧配置数据）；
     * 3) 分组无该字段 + 配置级也为空 → 留空（不写入），由编辑器在全局库加载后补全
     *    （保持历史「打开编辑器即载入全局库」的行为）。
     */
    const fillGroupContent = (group: CaseGroup, raw: any) => {
      const src = raw && typeof raw === 'object' ? raw : {}
      const fb = fallback ?? {}
      if (hasOwn(src, 'cards')) group.cards = normalizeCards(src.cards)
      else if (hasCardsContent(fb.cards)) group.cards = normalizeCards(fb.cards)

      if (hasOwn(src, 'mapping')) group.mapping = normalizeMapping(src.mapping)
      else if (hasMappingContent(fb.mapping)) group.mapping = normalizeMapping(fb.mapping)

      if (hasOwn(src, 'valueLibrary')) {
        group.valueLibrary = Array.isArray(src.valueLibrary) ? deepCopy(src.valueLibrary) : []
      } else if (Array.isArray(fb.valueLibrary) && fb.valueLibrary.length) {
        group.valueLibrary = deepCopy(fb.valueLibrary)
      }
    }

    if (Array.isArray(data.groups) && data.groups.length) {
      g.groups = (data.groups as any[]).map((grp) => {
        const group: CaseGroup = {
          id: grp?.id || genId('group'),
          name: (grp?.name || '').trim() || 'GraphCase',
          frames: Array.isArray(grp?.frames) ? grp.frames : [],
        }
        fillGroupContent(group, grp)
        if (grp?.naming === 'path' || grp?.naming === 'default') group.naming = grp.naming
        if (Array.isArray(grp?.cases)) group.cases = deepCopy(grp.cases)
        return group
      })
    } else {
      // 旧配置（无 groups）：迁移为一个默认分组，内容同样按上述规则填充
      const group: CaseGroup = {
        id: genId('group'),
        name: 'GraphCase',
        frames: g.frames || [],
      }
      fillGroupContent(group, null)
      g.groups = [group]
    }
    /**
     * 载入自愈：处理历史遗留的「悬空」序列接线口锚点（锚定的步骤在序列里已不存在）。
     * - 同卡片同方向还有活边 → 是过时残留的死副本，删除（看不见也不参与生成，删掉零影响）；
     * - 该卡片已无到序列的活边 → 用例的注入/检查真断了，接回最后一个存活步骤。
     * 键格式不变，因此前后版本读到的 JSON 形态完全一致。
     */
    let seqRepaired = 0
    let seqRemoved = 0
    for (const grp of g.groups ?? []) {
      for (const fr of grp.frames ?? []) {
        const r = normalizeStaleSeqAnchors(fr)
        seqRepaired += r.repaired
        seqRemoved += r.removed
      }
    }
    if (stats) {
      stats.seqRepaired = seqRepaired
      stats.seqRemoved = seqRemoved
    }
    // frames 镜像为第一个分组（编辑器会按活动分组切换）
    g.frames = g.groups[0].frames
    return g
  }
  return emptyGraph()
}

function normalizeMapping(data: any): ObjectMapping {
  const base = emptyMapping()
  if (data && typeof data === 'object') {
    base.signals = Array.isArray(data.signals) ? deepCopy(data.signals) : []
    base.dtcs = Array.isArray(data.dtcs) ? deepCopy(data.dtcs) : []
    base.messages = Array.isArray(data.messages) ? deepCopy(data.messages) : []
    base.envvars = Array.isArray(data.envvars) ? deepCopy(data.envvars) : []
    base.a2l = Array.isArray(data.a2l) ? deepCopy(data.a2l) : []
  }
  return base
}

function normalizeCards(data: any): CardLibrary {
  const base = emptyCardLibrary()
  if (data && typeof data === 'object') {
    base.inject = Array.isArray(data.inject) ? deepCopy(data.inject) : []
    base.sequence = Array.isArray(data.sequence) ? deepCopy(data.sequence) : []
    base.result = Array.isArray(data.result) ? deepCopy(data.result) : []
  }
  return base
}

// ==================== Event Handlers ====================

/** 静默持久化指定配置（用于切换前的自动保存），返回是否成功 */
async function persistConfig(name: string): Promise<boolean> {
  if (!name) return false
  try {
    await saveConfig('function', name, currentData.value)
    return true
  } catch {
    return false
  }
}

async function onConfigChange(name: string) {
  const token = ++configChangeToken
  const prevName = loadedConfig.value
  // 切换配置前自动保存当前配置，避免未保存的编辑内容丢失
  // 仅在内存数据确有归属（loadedConfig 非空）且与新配置不同时才保存
  if (prevName && prevName !== name) {
    // 静默自动保存：成功不提示，失败才警告
    const ok = await persistConfig(prevName)
    if (!ok) {
      ElMessage.warning(`配置「${prevName}」自动保存失败，切换后可能丢失改动`)
    }
  }
  // 自动保存期间用户又切换了配置：放弃本次加载，由最新一次调用处理
  if (token !== configChangeToken) return
  currentConfig.value = name
  loadedConfig.value = ''
  try {
    const res: any = await getConfig('function', name)
    if (token !== configChangeToken) return
    const data = res?.data
    if (data) {
      funcSteps.value = data.func_steps || {}
      testCases.value = data.test_cases || ''
      testFunction.value = data.test_function || ''
      arrayFuncTest.value = data.array_func_test || ''
      xmlContent.value = data.xml_content || null
      testCaseList.value = Array.isArray(data.test_case_list) ? data.test_case_list : []
      const healStats = { seqRepaired: 0, seqRemoved: 0 }
      graph.value = normalizeGraph(
        data.graph,
        {
          mapping: data.mapping,
          cards: data.cards,
          valueLibrary: data.value_library,
        },
        healStats,
      )
      // 只清理了「过时残留」时不提示：那种线本来就看不见、也不参与生成
      if (healStats.seqRepaired) {
        const extra = healStats.seqRemoved ? `，并清理 ${healStats.seqRemoved} 条过时冗余连线` : ''
        ElMessage.info(
          `已自动接回 ${healStats.seqRepaired} 条断开的序列连线（原锚定的步骤已不存在）${extra}，保存后写入配置`,
        )
      }
      mapping.value = normalizeMapping(data.mapping)
      cards.value = normalizeCards(data.cards)
      valueLibrary.value = Array.isArray(data.value_library) ? deepCopy(data.value_library) : emptyValueLibrary()
      generatedDir.value = ''
      configPageData.value = {
        cddQualifierLineEdit: data.cddQualifierLineEdit || '',
        a2lQualifierLineEdit: data.a2lQualifierLineEdit || '',
        readySignal: data.readySignal || '',
        readyOnValue: data.readyOnValue || '',
        readyOffValue: data.readyOffValue || '',
      }
      if (data.oem) {
        store.setSelectedOem(data.oem)
      }
      if (data.securityAlgo) {
        store.setSelectedAlgo(data.securityAlgo)
      }
    }
    // 标记内存数据归属该配置，后续切换时据此安全自动保存
    loadedConfig.value = name
    // 用例列表与 TestCase.can 预览已由后端 GET 时按当前 graph 一并重算返回
    // （见 config_routes._refresh_graph_case_list），此处不再重复调 /expand-cases。
  } catch {
    if (token !== configChangeToken) return
    resetData()
  }
}

async function onCreate(name: string) {
  const hasConfig = !!currentConfig.value
  // 新建配置会切走当前配置：先自动保存当前配置，避免未保存内容丢失
  const prevName = loadedConfig.value
  if (prevName && prevName !== name) {
    await persistConfig(prevName)
  }
  const defaultData = {
    func_steps: {},
    test_cases: '',
    test_function: '',
    array_func_test: '',
    test_case_list: [],
    graph: emptyGraph(),
    mapping: emptyMapping(),
    cards: emptyCardLibrary(),
    value_library: emptyValueLibrary(),
  }
  // 新建配置：把全局库里标记为全局的卡片/映射/值资源带进默认分组，并同步到配置根级兜底字段
  const seeded = defaultData.graph.groups?.[0]
  if (seeded) {
    const n = await applyGlobalToGroup(seeded)
    if (n) {
      defaultData.cards = seeded.cards ?? defaultData.cards
      defaultData.mapping = seeded.mapping ?? defaultData.mapping
      defaultData.value_library = seeded.valueLibrary ?? defaultData.value_library
    }
  }
  const dataToSave = hasConfig ? defaultData : (hasData.value ? currentData.value : defaultData)
  try {
    await saveConfig('function', name, dataToSave)
    currentConfig.value = name
    if (hasConfig) resetData()
    loadedConfig.value = name
    await nextTick()
    if (toolbarRef.value) {
      await toolbarRef.value.loadConfigs()
      toolbarRef.value.selectedConfig = name
    }
    ElMessage.success('配置已创建')
  } catch {
    /* 错误由拦截器处理 */
  }
}

function onCopy() {
  // 复制操作由 ConfigToolbar 内部处理
}

function onDelete(name: string) {
  if (name === currentConfig.value) {
    currentConfig.value = ''
    resetData()
  }
}

async function onSave() {
  if (!currentConfig.value && hasData.value) {
    ElMessageBox.prompt('请输入配置名称', '保存配置', {
      confirmButtonText: '保存',
      cancelButtonText: '取消',
      inputPattern: /^[\w\-_\u4e00-\u9fa5]{1,50}$/,
      inputErrorMessage: '配置名称只能包含字母、数字、下划线、横线和中文',
    }).then(async ({ value: configName }) => {
      try {
        await saveConfig('function', configName, currentData.value)
        currentConfig.value = configName
        loadedConfig.value = configName
        await nextTick()
        if (toolbarRef.value) {
          await toolbarRef.value.loadConfigs()
          toolbarRef.value.selectedConfig = configName
        }
        ElMessage.success('配置保存成功')
      } catch {
        ElMessage.error('配置保存失败')
      }
    }).catch(() => {
      // 用户取消
    })
    return
  }

  if (!currentConfig.value) {
    ElMessage.warning('请先上传 Excel 文件或选择配置')
    return
  }

  try {
    await saveConfig('function', currentConfig.value, currentData.value)
    loadedConfig.value = currentConfig.value
    ElMessage.success('配置保存成功')
  } catch {
    /* 错误由拦截器处理 */
  }
}

async function handleGenerate() {
  if (hasData.value && !currentConfig.value) {
    ElMessageBox.confirm(
      '当前已导入数据但未选择配置，是否先保存配置后再生成文件？',
      '提示',
      { confirmButtonText: '保存配置', cancelButtonText: '取消', type: 'warning' },
    ).then(async () => {
      ElMessageBox.prompt('请输入配置名称', '保存配置', {
        confirmButtonText: '保存',
        cancelButtonText: '取消',
        inputPattern: /^[\w\-_\u4e00-\u9fa5]{1,50}$/,
        inputErrorMessage: '配置名称只能包含字母、数字、下划线、横线和中文',
      }).then(async ({ value: configName }) => {
        try {
          await saveConfig('function', configName, currentData.value)
          currentConfig.value = configName
          loadedConfig.value = configName
          await nextTick()
          if (toolbarRef.value) toolbarRef.value.selectedConfig = configName
          ElMessage.success('配置保存成功，正在生成文件...')
          await doGenerate()
        } catch {
          ElMessage.error('配置保存失败')
        }
      }).catch(() => {
        // 用户取消输入配置名称
      })
    }).catch(() => {
      // 用户取消保存配置
    })
    return
  }

  if (!currentConfig.value) {
    ElMessage.warning('请先上传 Excel 文件或选择配置')
    return
  }

  await doGenerate()
}

async function doGenerate() {
  generating.value = true
  try {
    const cfgDir = store.cfgData?.cfg_dir || ''
    // 继电器模块 / CAN 通道：侧边栏配置，写入 TestFunction.cin 里共用的 RelayON/RelayOFF
    const relayCfg = store.relayConfigs.function
    const res: any = await generateFunction(
      currentConfig.value,
      cfgDir,
      relayCfg.relayModule,
      relayCfg.canChannel,
    )
    const data = res?.data
    if (data) {
      funcSteps.value = data.func_steps || {}
      testCases.value = data.test_cases || ''
      testFunction.value = data.test_function || ''
      arrayFuncTest.value = data.array_func_test || ''
      xmlContent.value = data.xml_content || null
      testCaseList.value = Array.isArray(data.test_case_list) ? data.test_case_list : []
      if (data.output_dir) generatedDir.value = data.output_dir
    }
    ElMessage.success(res?.message || '文件生成成功')
    // 函数库里与内置模板同名同参、实现不同的函数：生成时以内置模板为准，这里弹窗提示
    const conflicts: string[] = Array.isArray(data?.function_conflicts) ? data.function_conflicts : []
    if (conflicts.length) {
      ElMessageBox.alert(
        `函数库里以下函数与内置模板同名同参数、但实现不同，本次生成已以内置模板为准：\n\n${
          conflicts.join('、')}\n\n如需使用你自己的实现，请改用别的函数名（或改参数）。`,
        '函数库与内置模板冲突',
        { type: 'warning', confirmButtonText: '知道了' },
      ).catch(() => { /* 关闭弹窗即可 */ })
    }
  } catch {
    /* 错误由拦截器处理 */
  } finally {
    generating.value = false
  }
}

function openGraphEditor(groupId?: string) {
  const groups = graph.value.groups || []
  activeGroupId.value = groupId || groups[0]?.id || ''
  graphEditorVisible.value = true
}

// ==================== 用例分组 ====================
/** 新建分组/新建配置时，把全局库里标记为全局的卡片/映射/值资源带进新分组；读全局库失败不阻断建组 */
async function applyGlobalToGroup(grp: CaseGroup): Promise<number> {
  try {
    const g = await loadGlobalSections()
    return injectGlobalIntoGroup(grp, g)
  } catch {
    return 0
  }
}
/** 新建分组：每个分组是一份独立图形配置（卡片库/映射表/值资源库默认空，全局项自动带出），组内用例以分组名为前缀 */
async function addCaseGroup() {
  if (!graph.value.groups) graph.value.groups = []
  const idx = graph.value.groups.length + 1
  const group = emptyCaseGroup(`GraphCase${idx}`)
  const n = await applyGlobalToGroup(group)
  graph.value.groups.push(group)
  ElMessage.success(n ? `已新建分组 ${group.name}（已带出 ${n} 项全局内容）` : `已新建分组 ${group.name}（内容为空）`)
}
/** 切换预览页某个分组的收起/展开 */
function toggleGroupCollapse(groupId: string) {
  const next = new Set(expandedGroups.value)
  if (next.has(groupId)) next.delete(groupId)
  else next.add(groupId)
  expandedGroups.value = next
}
function isGroupCollapsed(groupId: string): boolean {
  return !expandedGroups.value.has(groupId)
}
/** 全部折叠（预览页所有分组收起） */
function collapseAllGroups() {
  expandedGroups.value = new Set()
}
/** 全部展开 */
function expandAllGroups() {
  expandedGroups.value = new Set((graph.value.groups || []).map((g) => g.id))
}
/** 最近一次删除的分组：分组删除不经过画布的撤销栈，这里单独留一次回退机会 */
const lastRemovedGroup = ref<{ group: CaseGroup; index: number; activeId: string } | null>(null)
let removedGroupToast: ReturnType<typeof ElMessage> | null = null

async function removeCaseGroup(groupId: string) {
  const groups = graph.value.groups || []
  if (groups.length <= 1) return
  const i = groups.findIndex((g) => g.id === groupId)
  if (i < 0) return
  const grp = groups[i]
  try {
    await ElMessageBox.confirm(
      `确认删除分组「${grp.name || `分组${i + 1}`}」？将同时删除该分组的 ` +
        `${(grp.frames || []).length} 个工况、${groupCaseCount(groupId)} 条用例，` +
        '以及组内的卡片库 / 映射表 / 值资源库。删除后可在提示里点「撤销」找回。',
      '删除分组',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    )
  } catch {
    return
  }
  // 弹窗期间分组可能已被其它操作改动，这里按 id 重新定位
  const list = graph.value.groups || []
  const at = list.findIndex((g) => g.id === groupId)
  if (at < 0) return
  lastRemovedGroup.value = { group: list[at], index: at, activeId: activeGroupId.value }
  list.splice(at, 1)
  if (activeGroupId.value === groupId) activeGroupId.value = list[0]?.id || ''
  graph.value.frames = list[0]?.frames || []
  refreshCasePreview()
  showRemovedGroupToast()
}

/** 删除后的提示：带「撤销」入口，避免误删分组后无法找回 */
function showRemovedGroupToast() {
  removedGroupToast?.close()
  const name = lastRemovedGroup.value?.group.name || '分组'
  removedGroupToast = ElMessage({
    type: 'success',
    duration: 8000,
    message: h('span', null, [
      `已删除分组「${name}」`,
      h(
        'button',
        {
          // 用 button 而不是裸 <a>：可聚焦、可回车触发，无障碍与自动化都能点到
          style:
            'margin-left:10px;padding:0;border:0;background:none;font:inherit;' +
            'font-weight:600;color:var(--el-color-primary);cursor:pointer',
          onClick: undoRemoveCaseGroup,
        },
        '撤销',
      ),
    ]),
  })
}

function undoRemoveCaseGroup() {
  const snap = lastRemovedGroup.value
  if (!snap) return
  lastRemovedGroup.value = null
  removedGroupToast?.close()
  removedGroupToast = null
  const groups = graph.value.groups || (graph.value.groups = [])
  groups.splice(Math.min(Math.max(snap.index, 0), groups.length), 0, snap.group)
  activeGroupId.value = snap.activeId || groups[0]?.id || ''
  graph.value.frames = groups[0]?.frames || []
  refreshCasePreview()
  ElMessage.success(`已恢复分组「${snap.group.name || '分组'}」`)
}
/** 分组名变更后重新展开（用例名前缀随之变化） */
function onGroupMetaChange() {
  const groups = graph.value.groups || []
  if (activeGroupId.value && !groups.some((g) => g.id === activeGroupId.value)) {
    activeGroupId.value = groups[0]?.id || ''
  }
  refreshCasePreview()
}
function groupCaseCount(groupId: string): number {
  return testCaseList.value.filter((c) => c.group_id === groupId).length
}
function casesOfGroup(groupId: string): PreviewCase[] {
  return testCaseList.value.filter((c) => c.group_id === groupId)
}

/** 点击用例：把右侧代码预览滚动到该用例（TestCase.can 中 testcase <case_id>() 那一行） */
async function locateCaseInCode(c: PreviewCase) {
  if (!c.case_id) return
  if (caplSubTab.value !== 'testcases') caplSubTab.value = 'testcases'
  await nextTick()
  const code = currentCaplCode.value
  const idx = code ? code.indexOf(`testcase ${c.case_id}(`) : -1
  if (idx < 0) return
  const codeEl = document.querySelector<HTMLElement>('.preview-code .code-pre code')
  if (!codeEl) return
  // 高亮只做标签包裹、不改动文本，按字符偏移在 DOM 文本节点里找到同一位置
  let offset = idx
  const walker = document.createTreeWalker(codeEl, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode() as Text | null
  while (node && offset >= node.data.length) {
    offset -= node.data.length
    node = walker.nextNode() as Text | null
  }
  if (!node) return
  const range = document.createRange()
  range.setStart(node, offset)
  range.setEnd(node, Math.min(offset + 1, node.data.length))
  const rect = range.getBoundingClientRect()
  // 只滚动最近的可滚动祖先（代码区），避免带动整页
  let scroller = node.parentElement
  while (scroller) {
    const style = getComputedStyle(scroller)
    if (/(auto|scroll)/.test(style.overflowY) && scroller.scrollHeight > scroller.clientHeight) break
    scroller = scroller.parentElement
  }
  if (!scroller) return
  scroller.scrollTop += rect.top - scroller.getBoundingClientRect().top - 8
}

// ==================== 分组右击菜单：导入 / 导出用例 / 复制推送 / 文件 ====================

function onGroupMenu(cmd: string, group: CaseGroup) {
  if (cmd === 'import') importCasesIntoGroup(group)
  else if (cmd === 'export') exportGroupCases(group)
  else if (cmd === 'exportAll') exportGroupCases(null)
  else if (cmd === 'transfer') openTransferDialog(group)
  else if (cmd === 'fileTransfer') openFileTransferDialog(group)
}

// ==================== 分组复制 / 推送 / 导出导入（跨配置与文件） ====================
// 一律「整组搬」：工况框 + 卡片库 + 映射表 + 值资源库 一起走，所以组内引用天然自洽。
// 只重生成 group.id，组内 frame/lane/node/edge/card 的 id 原样保留 —— 组内 id 只在组内被引用
// （lane.nodeIds / edge.from|to 是 node:<id> 或 seq:<id>@<stepId>；Card.refId 按本分组的 cards 解析），
// 跨分组重复是既有常态，重生成反而要连带重写这些引用，风险高、收益零。

/** 分组导出文件的标识与版本（导入时校验，便于以后兼容） */
const GROUP_FILE_TYPE = 'autotool-function-groups'
const GROUP_FILE_VERSION = 1

/** 分组里卡片库的条目数（三个桶之和），用于弹窗展示 */
function cardCountOf(group: CaseGroup): number {
  const c = group.cards
  if (!c) return 0
  return (c.inject?.length || 0) + (c.sequence?.length || 0) + (c.result?.length || 0)
}

/** 生成不重复的分组名：重名 → `<原名>_来自<来源>`，再冲突 → 追加 _2、_3… */
function uniqueGroupName(base: string, from: string, used: Set<string>): string {
  const b = (base || '').trim() || 'GraphCase'
  if (!used.has(b)) {
    used.add(b)
    return b
  }
  let name = `${b}_来自${from || '其它配置'}`
  if (!used.has(name)) {
    used.add(name)
    return name
  }
  let n = 2
  while (used.has(`${name}_${n}`)) n += 1
  name = `${name}_${n}`
  used.add(name)
  return name
}

/** 克隆分组用于导入：只重生成分组 id，组内 id 原样保留 */
function makeGroupCopy(src: CaseGroup, name: string): CaseGroup {
  const g: CaseGroup = deepCopy(src)
  g.id = genId('group')
  g.name = name
  if (!Array.isArray(g.frames)) g.frames = []
  g.cards = normalizeCards(g.cards)
  g.mapping = normalizeMapping(g.mapping)
  g.valueLibrary = Array.isArray(g.valueLibrary) ? g.valueLibrary : []
  return g
}

/** 把源分组批量追加进当前配置（组名自动去重），返回新增的分组名 */
function appendGroupsToCurrent(source: CaseGroup[], from: string): string[] {
  if (!Array.isArray(graph.value.groups)) graph.value.groups = []
  const used = new Set(graph.value.groups.map((g) => g.name))
  const added: string[] = []
  for (const src of source) {
    const name = uniqueGroupName(src.name, from, used)
    graph.value.groups.push(makeGroupCopy(src, name))
    added.push(name)
  }
  return added
}

// ---- 配置之间：复制进来（拉取）/ 推送出去 ----

const transferVisible = ref(false)
/** pull=从其它配置复制到当前配置；push=把当前配置的分组推送到其它配置 */
const transferMode = ref<'pull' | 'push'>('pull')
const transferConfigList = ref<string[]>([])
const transferSourceConfig = ref('')
const transferTargetConfig = ref('')
/** 弹窗里展示的分组（拉取=源配置的分组；推送=当前配置的分组） */
const transferGroups = ref<CaseGroup[]>([])
const transferSelected = ref<string[]>([])
const transferLoading = ref(false)
/** 右击的那个分组 id：推送模式预勾选 */
const transferPresetId = ref('')

/** 打开「复制 / 推送到其它配置」弹窗 */
async function openTransferDialog(group?: CaseGroup) {
  transferVisible.value = true
  transferMode.value = 'pull'
  transferSelected.value = []
  transferGroups.value = []
  transferTargetConfig.value = ''
  transferPresetId.value = group?.id || ''
  try {
    const res: any = await getConfigs('function')
    const list: string[] = Array.isArray(res?.data) ? res.data : []
    transferConfigList.value = list
    if (!list.length) {
      ElMessage.warning('没有可选的配置文件')
      return
    }
    transferSourceConfig.value = list.find((n) => n !== currentConfig.value) || list[0]
    await loadTransferGroups()
  } catch (e: any) {
    ElMessage.error('读取配置列表失败：' + (e?.message || String(e)))
  }
}

/** 切换方向 / 换源配置时刷新分组列表 */
async function loadTransferGroups() {
  transferSelected.value = []
  if (transferMode.value === 'push') {
    transferGroups.value = graph.value.groups || []
    // 右击的那个分组预勾选
    if (transferPresetId.value && transferGroups.value.some((g) => g.id === transferPresetId.value)) {
      transferSelected.value = [transferPresetId.value]
    }
    return
  }
  const name = transferSourceConfig.value
  transferGroups.value = []
  if (!name) return
  transferLoading.value = true
  try {
    const res: any = await getConfig('function', name)
    const data = res?.data
    const g = normalizeGraph(data?.graph, {
      mapping: data?.mapping,
      cards: data?.cards,
      valueLibrary: data?.value_library,
    })
    transferGroups.value = g.groups || []
  } catch (e: any) {
    ElMessage.error(`读取配置「${name}」失败：` + (e?.message || String(e)))
  } finally {
    transferLoading.value = false
  }
}

function toggleTransferAll() {
  transferSelected.value =
    transferSelected.value.length === transferGroups.value.length
      ? []
      : transferGroups.value.map((g) => g.id)
}

/** 确认：拉取只改内存（等用户点保存）；推送立即写目标配置 */
async function confirmTransfer() {
  const picked = transferGroups.value.filter((g) => transferSelected.value.includes(g.id))
  if (!picked.length) {
    ElMessage.warning('请先勾选要复制的分组')
    return
  }
  if (transferMode.value === 'pull') {
    const from = transferSourceConfig.value
    const added = appendGroupsToCurrent(picked, from)
    transferVisible.value = false
    await refreshCasePreview()
    ElMessage.success(`已从「${from}」复制 ${added.length} 个分组：${added.join('、')}`)
    return
  }
  await pushGroupsToConfig(transferTargetConfig.value, picked)
}

/** 推送到其它配置：读目标配置 → 追加分组 → 整份写回（只替换 graph，其余字段原样带回） */
async function pushGroupsToConfig(targetName: string, picked: CaseGroup[]) {
  const name = String(targetName || '').trim()
  if (!name) {
    ElMessage.warning('请选择要推送到的目标配置')
    return
  }
  if (name === currentConfig.value) {
    ElMessage.warning('目标配置不能是当前配置（当前配置的改动请直接点「保存」）')
    return
  }
  try {
    await ElMessageBox.confirm(
      `把选中的 ${picked.length} 个分组推送到配置「${name}」？\n` +
        '将以该配置当前的磁盘内容为基础追加分组后整体写回，该配置的其它内容保持不变。',
      '推送到其它配置',
      { confirmButtonText: '推送', cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    return
  }
  try {
    const res: any = await getConfig('function', name)
    const data = res?.data
    if (!data || typeof data !== 'object') {
      ElMessage.error(`配置「${name}」内容为空，已取消`)
      return
    }
    const srcGraph: any = data.graph && typeof data.graph === 'object' ? data.graph : {}
    // 直接追加到目标配置的原始分组数组：不规范化已有分组，
    // 避免把配置级兜底内容写进分组、或改动既有分组的字段顺序
    const targetGroups: any[] = Array.isArray(srcGraph.groups) ? [...srcGraph.groups] : []
    if (!targetGroups.length) {
      // 旧结构（无 groups）：把 frames 迁移成一个默认分组
      targetGroups.push({
        id: genId('group'),
        name: 'GraphCase',
        frames: Array.isArray(srcGraph.frames) ? srcGraph.frames : [],
      })
    }
    const used = new Set(targetGroups.map((g: any) => String(g?.name || '')))
    const from = currentConfig.value || '当前配置'
    const added: string[] = []
    for (const src of picked) {
      const gname = uniqueGroupName(src.name, from, used)
      targetGroups.push(makeGroupCopy(src, gname))
      added.push(gname)
    }
    // GET 响应会补一个 name 字段（见 backend/api/config_routes.get_config 的注释），
    // 不能把它写回文件
    delete data.name
    data.graph = {
      ...srcGraph,
      nodes: Array.isArray(srcGraph.nodes) ? srcGraph.nodes : [],
      edges: Array.isArray(srcGraph.edges) ? srcGraph.edges : [],
      groups: targetGroups,
      // frames 是「活动分组」的镜像：追加分组不影响 groups[0]，原样保留
      frames: Array.isArray(srcGraph.frames) ? srcGraph.frames : targetGroups[0]?.frames || [],
    }
    await saveConfig('function', name, data)
    transferVisible.value = false
    ElMessage.success(`已推送 ${added.length} 个分组到「${name}」：${added.join('、')}`)
  } catch {
    /* 错误由拦截器处理 */
  }
}

// ---- 文件：导出为 .json / 从 .json 导入 ----

const fileTransferVisible = ref(false)
const fileMode = ref<'export' | 'import'>('export')
const fileExportGroups = ref<CaseGroup[]>([])
const fileExportSelected = ref<string[]>([])
const fileImportGroups = ref<CaseGroup[]>([])
const fileImportName = ref('')
/** 导入来源标签（文件里的源配置名，或文件名），用于组名后缀 */
const fileImportFrom = ref('')

function openFileTransferDialog(group?: CaseGroup) {
  fileTransferVisible.value = true
  fileMode.value = 'export'
  fileExportGroups.value = graph.value.groups || []
  fileExportSelected.value =
    group && fileExportGroups.value.some((g) => g.id === group.id) ? [group.id] : []
  fileImportGroups.value = []
  fileImportName.value = ''
  fileImportFrom.value = ''
}

function toggleFileExportAll() {
  fileExportSelected.value =
    fileExportSelected.value.length === fileExportGroups.value.length
      ? []
      : fileExportGroups.value.map((g) => g.id)
}

/** 弹出系统文件选择框，选择分组导出文件（Electron 与浏览器均可用） */
function pickJsonFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.style.display = 'none'
    input.addEventListener('change', () => {
      resolve(input.files?.[0] || null)
      input.remove()
    })
    // 用户取消时 change 不触发：兜底在窗口重新聚焦后判定
    window.addEventListener(
      'focus',
      () => setTimeout(() => {
        if (!input.files?.length) {
          resolve(null)
          input.remove()
        }
      }, 300),
      { once: true },
    )
    document.body.appendChild(input)
    input.click()
  })
}

/** 文本内容触发浏览器下载（Web 与 Electron 均可用，Electron 会弹保存框） */
function downloadTextFile(text: string, filename: string) {
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** 选择并解析分组文件（校验 type / version） */
async function pickGroupFile() {
  const file = await pickJsonFile()
  if (!file) return
  try {
    const text = await file.text()
    const parsed = JSON.parse(text)
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      parsed.type !== GROUP_FILE_TYPE ||
      !Array.isArray(parsed.groups)
    ) {
      ElMessage.error('文件格式不正确：不是本工具导出的「分组文件」')
      return
    }
    if (Number(parsed.version || 0) > GROUP_FILE_VERSION) {
      ElMessage.warning(
        `文件版本（${parsed.version}）高于当前支持的版本（${GROUP_FILE_VERSION}），将尝试导入`,
      )
    }
    fileImportGroups.value = parsed.groups
    fileImportName.value = file.name
    fileImportFrom.value =
      String(parsed.source_config || '').trim() || file.name.replace(/\.json$/i, '')
  } catch (e: any) {
    ElMessage.error('读取文件失败：' + (e?.message || String(e)))
  }
}

/** 导出选中分组为 .json（纯前端 Blob 下载） */
function exportGroupsToFile() {
  const picked = fileExportGroups.value.filter((g) => fileExportSelected.value.includes(g.id))
  if (!picked.length) {
    ElMessage.warning('请先勾选要导出的分组')
    return
  }
  const payload = {
    type: GROUP_FILE_TYPE,
    version: GROUP_FILE_VERSION,
    exported_at: new Date().toISOString(),
    source_config: currentConfig.value || '',
    groups: picked.map((g) => deepCopy(g)),
  }
  const base = (currentConfig.value || 'Function').replace(/[\\/:*?\[\]]/g, '_')
  downloadTextFile(JSON.stringify(payload, null, 2), `${base}_分组_${picked.length}个.json`)
  fileTransferVisible.value = false
  ElMessage.success(`已导出 ${picked.length} 个分组`)
}

/** 确认：从文件导入分组（追加到当前配置，不写盘） */
async function confirmFileImport() {
  if (!fileImportGroups.value.length) {
    ElMessage.warning('请先选择要导入的分组文件')
    return
  }
  const from = fileImportFrom.value || '文件'
  const added = appendGroupsToCurrent(fileImportGroups.value, from)
  fileTransferVisible.value = false
  await refreshCasePreview()
  ElMessage.success(`已从文件导入 ${added.length} 个分组：${added.join('、')}`)
}

/** 弹出系统文件选择框，选择 Excel 文件（Electron 与浏览器均可用） */
function pickExcelFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.xlsx'
    input.style.display = 'none'
    input.addEventListener('change', () => {
      resolve(input.files?.[0] || null)
      input.remove()
    })
    // 用户取消时 change 不触发：兜底在窗口重新聚焦后判定
    window.addEventListener(
      'focus',
      () => setTimeout(() => {
        if (!input.files?.length) {
          resolve(null)
          input.remove()
        }
      }, 300),
      { once: true },
    )
    document.body.appendChild(input)
    input.click()
  })
}

/** 从 Excel 导入用例到分组：按工作表名匹配分组，匹配不到的归入右击的分组 */
async function importCasesIntoGroup(group: CaseGroup) {
  const file = await pickExcelFile()
  if (!file) return
  try {
    const res: any = await importFunctionCases(file)
    const sheets: Record<string, Array<{ case_id: string; code: string }>> =
      res?.data?.sheets || {}
    const groups = graph.value.groups || []
    let imported = 0
    let touched = 0
    for (const [sheetName, list] of Object.entries(sheets)) {
      if (!Array.isArray(list) || !list.length) continue
      const target =
        groups.find((g) => (g.name || '').trim() === (sheetName || '').trim()) || group
      if (!target) continue
      if (!Array.isArray(target.cases)) target.cases = []
      for (const item of list) {
        const cid = String(item?.case_id || '').trim()
        const code = String(item?.code || '')
        if (!cid || !code.trim()) continue
        const idx = target.cases.findIndex((c) => c.case_id === cid)
        if (idx >= 0) target.cases[idx] = { case_id: cid, code }
        else target.cases.push({ case_id: cid, code })
        imported += 1
      }
      touched += 1
    }
    if (!imported) {
      ElMessage.warning('未从 Excel 中解析到用例')
      return
    }
    // 已选配置时立即持久化：生成文件会从磁盘读取配置，未保存会导致导入用例丢失
    if (currentConfig.value) {
      try {
        await saveConfig('function', currentConfig.value, currentData.value)
      } catch {
        /* 保存失败由拦截器提示，仍继续刷新预览 */
      }
    }
    await refreshCasePreview()
    ElMessage.success(`已导入 ${imported} 条用例（${touched} 个工作表）`)
  } catch {
    /* 错误由拦截器处理 */
  }
}

/** base64 内容触发浏览器下载（Web 环境兜底） */
function downloadBase64(base64: string, filename: string) {
  const bin = atob(base64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  const blob = new Blob([bytes], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** 导出用例为 Excel：group 为空时导出全部分组（每组一个 Sheet） */
async function exportGroupCases(group: CaseGroup | null) {
  const defaultName = group
    ? `${(group.name || 'GraphCase').replace(/[\\/:*?\[\]]/g, '_')}.xlsx`
    : 'Function_Cases.xlsx'
  let savePath = ''
  const api = (window as any).electronAPI
  if (api?.saveDialog) {
    savePath = (await api.saveDialog({
      title: group ? `导出分组「${group.name}」用例` : '导出全部用例',
      defaultPath: defaultName,
      filters: [['Excel 文件', '*.xlsx']],
    })) || ''
    if (!savePath) return
  }
  try {
    const res: any = await exportFunctionCases({
      graph: graph.value,
      mapping: mapping.value,
      cards: cards.value,
      group_id: group?.id || '',
      save_path: savePath,
      ccp_var_types: store.ccpVarTypes,
    })
    const data = res?.data || {}
    if (savePath) {
      ElMessage.success(res?.message || `已导出至 ${savePath}`)
    } else if (data.content_base64) {
      downloadBase64(data.content_base64, data.filename || defaultName)
      ElMessage.success(res?.message || '已导出用例 Excel')
    }
  } catch {
    /* 错误由拦截器处理 */
  }
}

function onGraphSave() {
  onSave()
  refreshCasePreview()
}

function onGraphGenerate() {
  handleGenerate()
}

/** 保存后按当前 graph + mapping 展开用例，回填用例预览列表 */
async function refreshCasePreview() {
  try {
    const res: any = await expandCases(
      graph.value, mapping.value, cards.value, undefined, false, store.ccpVarTypes,
    )
    const data = res?.data?.data ?? res?.data ?? {}
    const cases = Array.isArray(data.cases) ? data.cases : []
    testCaseList.value = cases.map((c: any) => {
      const steps = Array.isArray(c.steps) ? c.steps : []
      const stepLines = steps
        .map((s: any) => (s?.capl ?? '').trim())
        .filter((ln: string) => !!ln)
      // 从 Excel 导入的用例没有 steps，改用 code（CAPL 用例体）统计行数
      const codeLines =
        typeof c.code === 'string'
          ? c.code.split('\n').map((ln: string) => ln.trim()).filter((ln: string) => !!ln)
          : []
      const bodyLines = stepLines.length ? stepLines : codeLines
      return {
        case_id: c.case_id || '',
        lines: bodyLines.length,
        first_line: bodyLines[0] ? bodyLines[0].slice(0, 120) : '',
        sheet: 'graph',
        steps: steps,
        group_id: c.group_id || '',
        group_name: c.group_name || '',
      }
    })
    if (typeof data.test_cases === 'string') {
      testCases.value = data.test_cases
    }
  } catch {
    /* 预览展开失败静默处理 */
  }
}

function onRefresh() {
  // 配置列表刷新由 ConfigToolbar 处理
}

function onUploadSuccess(res: any) {
  const data = res?.data
  if (data) {
    funcSteps.value = data.func_steps || {}
    testCases.value = data.test_cases || ''
    testFunction.value = data.test_function || ''
    arrayFuncTest.value = data.array_func_test || ''
    xmlContent.value = data.xml_content || null
    testCaseList.value = Array.isArray(data.test_case_list) ? data.test_case_list : []
    generatedDir.value = ''
  }
}

async function handleOpenDir() {
  if (!generatedDir.value) {
    ElMessage.warning('没有可打开的目录')
    return
  }
  try {
    await openFolder(generatedDir.value)
  } catch {
    /* 错误由拦截器处理 */
  }
}

// ==================== Lifecycle ====================

watch(() => store.moduleStates.function.lastUploadResult, (result) => {
  if (result) {
    onUploadSuccess(result)
    store.moduleStates.function.lastUploadResult = null
  }
})
</script>

<style scoped lang="scss">
.function-view {
  display: flex;
  flex-direction: column;
  gap: var(--gap-block, 10px);
  /* 100vh - tab 栏 - .app-main 上下 padding(10px×2) */
  height: calc(100vh - var(--header-height) - var(--tab-height) - 20px);
  padding: 0;
}

.function-body {
  flex: 1;
  display: flex;
  flex-direction: row;
  gap: var(--gap-block, 10px);
  min-height: 0;
}

.function-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 0;
}

.function-side-wrap {
  position: relative;
  flex-shrink: 0;
  display: flex;
  min-height: 0;
}

.function-side {
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

.card-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.graph-entry {
  margin-left: auto;
}
.group-add {
  margin-left: auto;
}

/* ---------- 用例预览（只读回显 + 代码预览） ---------- */
.result-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 300px;
}

.preview-card {
  padding: 0;
}
.preview-grid {
  flex: 1;
  display: flex;
  flex-direction: row;
  overflow: hidden;
  min-height: 0;
}
/* 包一层 relative 给拖拽条当锚点（拖拽条贴宿主容器右缘） */
.preview-cases-wrap {
  position: relative;
  flex-shrink: 0;
  display: flex;
  min-width: 0;
  min-height: 0;
}
.preview-cases,
.preview-code {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}
.preview-cases {
  border-right: 1px solid #ebeef5;
  width: 100%;
  min-width: 0;
}
.preview-code {
  flex: 1;
  min-width: 0;
}
.pane-title {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  border-bottom: 1px solid #ebeef5;
  background: #fafafa;
  flex-shrink: 0;
}
.code-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
}
.case-list {
  flex: 1;
  overflow-y: auto;
  padding: 6px;
}
.case-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid transparent;
  margin-bottom: 2px;
  cursor: pointer;
}
.case-item:hover { background: #f5f7fa; }
.case-name {
  font-size: 12px;
  color: #303133;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: 'Consolas', 'Monaco', monospace;
}
.case-meta {
  font-size: 11px;
  color: #909399;
  flex-shrink: 0;
}
.empty-mini {
  color: #c0c4cc;
  font-size: 12px;
  text-align: center;
  padding: 24px 12px;
  line-height: 1.6;
}

/* ---------- 用例分组 ---------- */
/* 分组右击菜单容器：el-dropdown 默认 inline-flex，会压缩分组框宽度，这里恢复为块级 */
.group-dropdown {
  display: block;
}
.case-group {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  margin-bottom: 8px;
  overflow: hidden;
}
.group-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  background: #fafafa;
  border-bottom: 1px solid #ebeef5;
}
.group-idx {
  font-size: 11px;
  font-weight: 600;
  color: #909399;
  flex-shrink: 0;
}
.group-collapse {
  cursor: pointer;
  color: #909399;
  flex-shrink: 0;
  font-size: 14px;
}
.group-collapse:hover {
  color: var(--el-color-primary);
}
.group-name-input {
  flex: 1;
  min-width: 80px;
}
.group-count {
  font-size: 11px;
  color: #909399;
  flex-shrink: 0;
}
.group-cases {
  padding: 4px;
}

/* ===== 分组复制 / 推送 / 导出导入 弹窗 ===== */
.grp-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.grp-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.grp-row-top {
  align-items: flex-start;
}
.grp-label {
  flex: 0 0 56px;
  font-size: 12px;
  color: #909399;
}
.grp-list {
  flex: 1;
  min-width: 0;
  max-height: 240px;
  overflow-y: auto;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  padding: 6px 10px;
}
.grp-item {
  padding: 2px 0;
}
.grp-item-readonly {
  display: flex;
  align-items: center;
  gap: 6px;
}
.grp-name {
  font-size: 13px;
  color: #303133;
}
.grp-meta {
  margin-left: 8px;
  font-size: 11px;
  color: #909399;
}
.grp-empty {
  padding: 12px 0;
  text-align: center;
  font-size: 12px;
  color: #909399;
}
.grp-hint {
  font-size: 11px;
  line-height: 1.7;
  color: #909399;
}
.grp-file-name {
  font-size: 12px;
  color: #606266;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ---------- 代码块 ---------- */
.code-block {
  flex: 1;
  display: flex;
  flex-direction: column;
  border-radius: var(--radius-base);
  overflow: hidden;
  border: 1px solid var(--border-color-light);
  background: #282c34;
  min-height: 0;
  margin: 10px;
}
.code-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  background: #21252b;
  border-bottom: 1px solid #181a1f;
  flex-shrink: 0;

  .code-lang {
    font-size: 12px;
    color: #abb2bf;
    font-family: 'Consolas', 'Monaco', monospace;
  }
}
.code-body {
  flex: 1;
  display: flex;
  overflow: auto;
  min-height: 0;
}
.code-pre {
  flex: 1;
  margin: 0;
  padding: 12px 16px;
  overflow: auto;

  code {
    font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
    font-size: 13px;
    line-height: 1.6;
    background: transparent;
    padding: 0;
  }
}

/* ---------- 底部操作区 ---------- */
.action-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  flex-shrink: 0;
}
.action-left {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-secondary);
  min-width: 0;
  flex: 1;

  .dir-icon {
    color: var(--color-primary);
    flex-shrink: 0;
  }
}
.generated-path {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: 'Consolas', monospace;
  font-size: 12px;
}
.action-hint {
  font-size: 13px;
  color: var(--text-placeholder);
}
.action-right {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
</style>

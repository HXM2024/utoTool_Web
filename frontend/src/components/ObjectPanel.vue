<template>
  <div ref="rootEl" class="object-panel">
    <!-- Header -->
    <div class="panel-header">
      <span class="panel-title">
        <el-icon class="title-icon"><Grid /></el-icon>
        对象展示区
      </span>
      <div class="header-actions">
        <!-- 宿主模块可在此插入自己的操作按钮（如上传 DBC） -->
        <slot name="header-actions" />
        <el-button
          v-if="activeView !== 'dtc'"
          text
          size="small"
          :icon="Plus"
          @click="expandAll"
          title="全部展开"
        />
        <el-button
          v-if="activeView !== 'dtc'"
          text
          size="small"
          :icon="Minus"
          @click="collapseAll"
          title="全部折叠"
        />
        <el-button
          text
          size="small"
          :icon="Fold"
          @click="$emit('collapse')"
          title="收起面板"
        />
      </div>
    </div>

    <!-- DBC / DTC / A2L 切换（滑块控件，仅显示已加载的对象） -->
    <div class="panel-toggle" v-if="availableViews.length">
      <div class="obj-slider">
        <div class="obj-slider-thumb" :style="thumbStyle"></div>
        <div
          v-for="view in availableViews"
          :key="view.value"
          class="obj-slider-item"
          :class="{ active: activeView === view.value }"
          @click="activeView = view.value"
        >
          <el-icon class="slider-icon"><component :is="view.icon" /></el-icon>
          <span>{{ view.label }}</span>
        </div>
      </div>
    </div>

    <!-- DBC 树形展示 -->
    <div v-show="activeView === 'dbc'" class="panel-view">
      <el-input
        v-model="dbcFilter"
        placeholder="搜索 DBC..."
        :prefix-icon="Search"
        clearable
        size="small"
        data-shortcut-search
        class="panel-search"
      />
      <div class="panel-scroll">
        <el-tree
          ref="dbcTreeRef"
          v-if="filteredDbcTree.length"
          :key="'dbc-' + treeRenderKey"
          :data="filteredDbcTree"
          node-key="id"
          :props="treeProps"
          :expand-on-click-node="true"
          :default-expanded-keys="expandedKeys.length ? expandedKeys : defaultExpandedKeys"
          class="dbc-tree"
        >
          <template #default="{ data }">
            <div
              class="tree-node"
              :draggable="data.draggable !== false"
              @dragstart="onDragStart($event, data)"
            >
              <el-icon class="node-icon" :class="data.type">
                <component :is="getNodeIcon(data.type)" />
              </el-icon>
              <span class="node-label">{{ data.label }}</span>
              <span v-if="data.info" class="node-info">{{ data.info }}</span>
            </div>
          </template>
        </el-tree>
        <div v-else class="panel-empty">
          <el-icon class="empty-icon"><Connection /></el-icon>
          <span>{{ props.dbcRaw ? '无匹配结果' : '暂无 DBC 数据' }}</span>
        </div>
      </div>
    </div>

    <!-- DTC 列表展示 -->
    <div v-show="activeView === 'dtc'" class="panel-view">
      <el-input
        v-model="dtcFilter"
        placeholder="搜索 DTC..."
        :prefix-icon="Search"
        clearable
        size="small"
        class="panel-search"
      />
      <div class="panel-scroll">
        <div v-if="filteredDtcList.length" class="dtc-list">
          <div
            v-for="item in filteredDtcList"
            :key="item.id"
            class="dtc-card"
            draggable="true"
            @dragstart="onDragStart($event, item)"
            @dblclick="openDtcDetail(item)"
          >
            <div class="dtc-card-header">
              <span class="dtc-code">{{ item.code || 'N/A' }}</span>
              <span v-if="item.desc" class="dtc-card-desc">{{ item.desc }}</span>
              <span v-if="item.detail" class="dtc-card-detail">{{ item.detail }}</span>
              <el-icon class="drag-hint"><Rank /></el-icon>
            </div>
          </div>
        </div>
        <div v-else class="panel-empty">
          <el-icon class="empty-icon"><Warning /></el-icon>
          <span>{{ props.dtcRaw ? '无匹配结果' : '暂无 DTC 数据' }}</span>
        </div>
      </div>
    </div>

    <!-- A2L 对象展示 -->
    <div v-show="activeView === 'a2l'" class="panel-view">
      <el-input
        v-model="a2lFilter"
        placeholder="搜索 A2L 变量..."
        :prefix-icon="Search"
        clearable
        size="small"
        class="panel-search"
      />
      <!-- 有刷模式：新增自定义 CCP 变量（结构体可在此按地址+长度拆分后逐条录入） -->
      <el-button
        v-if="store.canMotorMode === 'brushed'"
        size="small"
        class="panel-add-btn"
        @click="openCcpNewDialog"
      >
        + 新增变量
      </el-button>
      <div class="panel-scroll">
        <el-tree
          ref="a2lTreeRef"
          v-if="filteredA2lTree.length"
          :key="'a2l-' + treeRenderKey"
          :data="filteredA2lTree"
          node-key="id"
          :props="treeProps"
          :expand-on-click-node="true"
          :default-expanded-keys="expandedKeys.length ? expandedKeys : a2lDefaultExpanded"
          class="dbc-tree"
        >
          <template #default="{ data }">
            <div
              class="tree-node"
              :draggable="data.draggable !== false"
              @dragstart="onDragStart($event, data)"
              @dblclick="onA2lNodeDblClick(data)"
            >
              <el-icon class="node-icon" :class="data.type">
                <component :is="getNodeIcon(data.type)" />
              </el-icon>
              <span class="node-label">{{ data.label }}</span>
              <span v-if="data.info" class="node-info">{{ data.info }}</span>
            </div>
          </template>
        </el-tree>
        <div v-else class="panel-empty">
          <el-icon class="empty-icon"><Document /></el-icon>
          <span>{{ hasA2l ? '无匹配结果' : '请上传 .a2l / .mapxml 文件' }}</span>
        </div>
      </div>
    </div>

    <!-- 测试参数卡片（CAN 报文信号表专用） -->
    <div v-show="activeView === 'testparam'" class="panel-view">
      <div class="panel-scroll">
        <div v-if="testParamGroups.length" class="testparam-groups">
          <div v-for="group in testParamGroups" :key="group.key" class="testparam-group">
            <div class="testparam-group-title">{{ group.label }}</div>
            <div class="testparam-cards">
              <div
                v-for="card in group.cards"
                :key="card.value"
                class="testparam-card"
                :class="{ configured: card.configured, 'is-selected': activeTestParamCard === card }"
                draggable="true"
                @dragstart="onDragStart($event, { type: 'testParam', ...card })"
                @click.stop="selectTestParamCard(card)"
                @dblclick="openTestParamHelp(card)"
              >
                <el-icon class="testparam-icon"><Cpu /></el-icon>
                <span class="testparam-label">{{ card.label }}</span>
                <span class="testparam-target">{{ targetLabel(card.target) }}</span>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="panel-empty">
          <el-icon class="empty-icon"><Cpu /></el-icon>
          <span>暂无测试参数</span>
        </div>
      </div>
    </div>

    <!-- DTC 详情弹窗 -->
    <el-dialog
      v-model="dtcDetailVisible"
      :title="selectedDtc ? `DTC 详情：${selectedDtc.code || 'N/A'}` : 'DTC 详情'"
      width="560px"
      append-to-body
    >
      <div v-if="selectedDtc" class="dtc-detail-body">
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item
            v-for="(value, key) in selectedDtc.fields"
            :key="key"
            :label="key || '（空）'"
          >
            <span class="dtc-detail-value">{{ value || '-' }}</span>
          </el-descriptions-item>
        </el-descriptions>
      </div>
      <template #footer>
        <el-button @click="dtcDetailVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 测试参数说明弹窗 -->
    <el-dialog
      v-model="testParamHelpVisible"
      :title="selectedTestParamCard ? `测试参数说明：${selectedTestParamCard.label}` : '测试参数说明'"
      width="520px"
      append-to-body
    >
      <div v-if="selectedTestParamCard" class="testparam-help-body">
        <div class="testparam-help-row">
          <span class="testparam-help-label">作用对象</span>
          <span>{{ targetLabel(selectedTestParamCard.target) }}</span>
        </div>
        <div class="testparam-help-row">
          <span class="testparam-help-label">说明</span>
          <span class="testparam-help-desc">{{ getTestParamHelp(selectedTestParamCard).desc }}</span>
        </div>
        <div v-if="cardConfigHint(selectedTestParamCard)" class="testparam-help-hint">
          {{ cardConfigHint(selectedTestParamCard) }}
        </div>
      </div>
      <template #footer>
        <el-button @click="testParamHelpVisible = false">关闭</el-button>
        <el-button
          v-if="selectedTestParamCard && selectedTestParamCard.target !== 'eps'"
          type="primary"
          @click="configureFromHelp"
        >配置</el-button>
      </template>
    </el-dialog>

    <!-- 有刷模式：CCP 系统变量全属性编辑（双击对象浏览器变量 / 工具栏「新增变量」） -->
    <el-dialog
      v-model="ccpTypeVisible"
      :title="ccpEditIsNew ? '新增 CCP 系统变量' : `CCP 系统变量：${ccpTypeTarget}`"
      width="520px"
      append-to-body
    >
      <div class="ccp-type-body">
        <div class="ccp-type-tip">
          该变量在生成脚本中会发布为 sysvar::NsCcp::{{ ccpNameValue || '<变量名>' }}；
          结构体请用地址 + 长度手工拆分出各成员。
        </div>
        <el-form label-width="72px" size="small" class="ccp-edit-form">
          <el-form-item label="变量名">
            <el-input v-model="ccpNameValue" placeholder="符号名（生成 sysvar::NsCcp:: &lt;此名&gt;）" />
          </el-form-item>
          <el-form-item label="地址">
            <el-input v-model="ccpAddrValue" placeholder="如 0x700034ae" />
          </el-form-item>
          <el-form-item label="长度">
            <el-input-number
              v-model="ccpSizeValue"
              :min="1"
              :max="CCP_MAX_SIZE"
              :controls="false"
              class="ccp-scale-input"
            />
            <span class="ccp-scale-label">字节（1–{{ CCP_MAX_SIZE }}）</span>
          </el-form-item>
          <el-form-item label="类型">
            <el-radio-group v-model="ccpTypeValue">
              <el-radio-button label="int">int</el-radio-button>
              <el-radio-button label="float">float</el-radio-button>
              <el-radio-button label="int64">int64</el-radio-button>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="换算">
            <span class="ccp-scale-label">精度</span>
            <el-input-number
              v-model="ccpPrecValue"
              :step="0.01"
              :controls="false"
              size="small"
              class="ccp-scale-input"
            />
            <span class="ccp-scale-label">偏移</span>
            <el-input-number
              v-model="ccpOffsetValue"
              :step="0.01"
              :controls="false"
              size="small"
              class="ccp-scale-input"
            />
          </el-form-item>
        </el-form>
        <div class="ccp-type-tip">
          发布物理值 = 原始值 × 精度 + 偏移（默认 1 / 0）；精度或偏移带小数时类型自动用 float。
          地址 / 长度会覆盖 .mapxml 原值（配置优先），重新上传 .mapxml 不会冲掉这里的手工修正。
        </div>
        <div v-if="ccpEditIsCustom" class="ccp-type-tip">
          这是手工新增 / 拆分的变量，删除后即从对象浏览器移除。
        </div>
      </div>
      <template #footer>
        <el-button @click="ccpTypeVisible = false">取消</el-button>
        <el-button v-if="ccpEditIsCustom" type="danger" plain @click="onCcpEditDelete">删除变量</el-button>
        <el-button v-else @click="onCcpScaleClear">恢复默认</el-button>
        <el-button type="primary" @click="onCcpTypeConfirm">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, type Ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useModuleStore, DEFAULT_CCP_PRECISION, DEFAULT_CCP_OFFSET, type CcpVarType } from '@/stores/modules'
import {
  Search,
  Connection,
  Warning,
  Rank,
  Fold,
  Grid,
  Cpu,
  Document,
  Link,
  Menu,
  Plus,
  Minus,
} from '@element-plus/icons-vue'
import { parseDbcRecords } from '@/utils/dbc'
import { useShortcut } from '@/composables/useShortcuts'
import type { A2lVars, A2lVar, DbcEnvVar } from '@/stores/modules'

// 测试参数卡片（CAN 报文信号表专用，可选传入）
export interface TestParamCard {
  value: string
  label: string
  target: 'message' | 'signal' | 'eps'
  category: 'msg' | 'sig' | 'eps'
  params?: Record<string, any>
  configured?: boolean
}

const props = defineProps<{
  dbcRaw: any
  dtcRaw: any
  a2lVars?: A2lVars
  a2lQualifier?: string
  dbcEnvVars?: DbcEnvVar[]
  testParamCards?: TestParamCard[]
}>()

const emit = defineEmits<{
  (e: 'collapse'): void
  (e: 'expand'): void
  (e: 'test-param-configure', card: TestParamCard): void
  (e: 'test-param-copy', card: TestParamCard): void
}>()

const store = useModuleStore()

// ==================== 状态 ====================
const activeView = ref<'dbc' | 'dtc' | 'a2l' | 'testparam'>('dbc')
const dbcFilter = ref('')
const dtcFilter = ref('')
const a2lFilter = ref('')
/**
 * 搜索防抖：过滤要递归遍历整棵树（大 DBC/A2L 下节点数万级），原来每敲一个字符就整体重算一次，
 * 输入明显卡顿。这里让「参与过滤的关键字」延后 200ms 生效，输入框本身（v-model）仍即时回显。
 */
const dbcFilterQuery = ref('')
const dtcFilterQuery = ref('')
const a2lFilterQuery = ref('')
function debounceFilter(source: Ref<string>, target: Ref<string>) {
  let timer: ReturnType<typeof setTimeout> | undefined
  watch(source, (v) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      target.value = v
    }, 200)
  })
}
debounceFilter(dbcFilter, dbcFilterQuery)
debounceFilter(dtcFilter, dtcFilterQuery)
debounceFilter(a2lFilter, a2lFilterQuery)

const dbcTreeRef = ref()
const a2lTreeRef = ref()
const treeRenderKey = ref(0)
const expandedKeys = ref<string[]>([])

// DTC 详情查看
const dtcDetailVisible = ref(false)
const selectedDtc = ref<any>(null)

function openDtcDetail(item: any) {
  selectedDtc.value = item
  dtcDetailVisible.value = true
}

// 测试参数说明查看
const testParamHelpVisible = ref(false)
const selectedTestParamCard = ref<TestParamCard | null>(null)

// 各测试参数的功能说明（与 CANView 中卡片 value 一一对应）
const testParamHelpText: Record<string, string> = {
  LostTest: '报文丢失测试：让被测报文在总线上消失，校验 ECU 能否按确认阈值上报对应 DTC（丢失故障）。需填写 DTC。',
  DlcTest: '报文 DLC 错误测试：人为篡改报文的 DLC（数据长度码），校验 ECU 能否识别长度异常并上报对应 DTC。需填写 DTC。',
  CRCTest: '校验和（CRC）测试：篡改信号的校验和，校验 ECU 能否识别并上报对应 DTC。报/不报值由后台写死，仅需填写 DTC。',
  CounterTest: '滚动计数器测试：篡改信号的滚动计数器，校验 ECU 能否识别并上报对应 DTC。报/不报值由后台写死，仅需填写 DTC。',
  SigInvalidTest: '信号无效值测试：设置信号为无效值，校验 ECU 是否正确识别并上报对应 DTC。「报 DTC 的值」与「不报 DTC 的值」按需填写（填哪项生成哪组用例，可留空其一）；填「报 DTC 的值」时需同时填「DTC」；类型滑块选择 SigInvalid（信号无效）或 SigvalueInvalid（信号值无效）。',
  FactorTest: '精度偏移测试：通过 XCP/CCP 变量监控被测信号，按设定的测试值逐个写入并比对精度。需填写变量名；可手动输入测试值，或开启「自动遍历」（从最小值到最大值）。',
  Counter: 'EPS 计数器类型：作为 EPS 发送节点的计数器信号，用于滚动计数器连续性校验。拖拽到 EPS 信号节点即生效，无需额外参数。',
}

function getTestParamHelp(card: TestParamCard): { title: string; desc: string } {
  const known = testParamHelpText[card.value]
  if (known) {
    return { title: card.label, desc: known }
  }
  // EPS 的具体 CRC 算法名
  if (card.target === 'eps') {
    return {
      title: card.label,
      desc: `EPS CRC 校验类型（${card.label}）：作为 EPS 发送节点的 CRC 校验信号，按该算法计算校验和。拖拽到 EPS 信号节点即生效，无需额外参数。`,
    }
  }
  return { title: card.label, desc: '暂无详细说明。' }
}

function openTestParamHelp(card: TestParamCard) {
  selectedTestParamCard.value = card
  testParamHelpVisible.value = true
}

// 从说明弹窗进入配置
function configureFromHelp() {
  if (!selectedTestParamCard.value) return
  const card = selectedTestParamCard.value
  testParamHelpVisible.value = false
  emit('test-param-configure', card)
}

// 说明弹窗中的额外提示
function cardConfigHint(card: TestParamCard): string {
  if (card.target === 'eps') return ''
  if (card.configured) return '当前参数已配置，可拖拽到报文/信号节点使用。'
  return '当前参数尚未配置，点击下方「配置」按钮填写参数后再拖拽使用。'
}

// 点击选中的测试参数卡片（用于 Ctrl+C 复制到对象）
const activeTestParamCard = ref<TestParamCard | null>(null)
/** 根元素：判断本面板当前是否可见（多模块复用 + keep-alive 缓存） */
const rootEl = ref<HTMLElement | null>(null)

function selectTestParamCard(card: TestParamCard) {
  activeTestParamCard.value = card
}

// 复制当前点选的测试参数卡片（Ctrl+C，统一快捷键层 module 作用域，
// 低于表格/列表的 context 作用域，焦点在表格里时不会与表格的复制同时触发）
useShortcut({
  id: 'objPanel:copyTestParam',
  keys: 'Ctrl+C',
  scope: 'module',
  desc: '复制当前点选的测试参数卡片',
  // 面板被多个模块复用且被 keep-alive 缓存，必须判可见性，否则隐藏模块的面板会抢 Ctrl+C
  when: () => !!activeTestParamCard.value && !!rootEl.value && rootEl.value.getClientRects().length > 0,
  run: () => {
    emit('test-param-copy', activeTestParamCard.value!)
    return true
  },
})

const treeProps = {
  label: 'label',
  children: 'children',
}

const hasDbc = computed(() => {
  return props.dbcRaw && (Array.isArray(props.dbcRaw) && props.dbcRaw.length > 0 || 
    (props.dbcRaw.rows && props.dbcRaw.rows.length > 0))
})

const hasDtc = computed(() => {
  return props.dtcRaw && (Array.isArray(props.dtcRaw) && props.dtcRaw.length > 0 || 
    (props.dtcRaw.rows && props.dtcRaw.rows.length > 0))
})

const hasA2l = computed(() => {
  return props.a2lVars && (props.a2lVars.measurements?.length > 0 || props.a2lVars.characteristics?.length > 0)
})

// 测试参数卡片是否已提供
const hasTestParams = computed(() => {
  return !!(props.testParamCards && props.testParamCards.length > 0)
})

// 滑块控件：仅显示已加载的对象类型
const availableViews = computed(() => {
  const views: Array<{ value: 'dbc' | 'dtc' | 'a2l' | 'testparam'; label: string; icon: any }> = []
  if (hasDbc.value) views.push({ value: 'dbc', label: 'DBC', icon: Connection })
  if (hasDtc.value) views.push({ value: 'dtc', label: 'DTC', icon: Warning })
  if (hasA2l.value) views.push({ value: 'a2l', label: 'A2L', icon: Document })
  if (hasTestParams.value) views.push({ value: 'testparam', label: '测试参数', icon: Cpu })
  return views
})

// 当前激活视图在 availableViews 中的索引
const activeIndex = computed(() => {
  const idx = availableViews.value.findIndex((v) => v.value === activeView.value)
  return idx >= 0 ? idx : 0
})

// 测试参数卡片分组（报文 / 信号 / EPS）
const testParamGroups = computed(() => {
  const cards = props.testParamCards || []
  const groups: Array<{ key: string; label: string; cards: TestParamCard[] }> = [
    { key: 'msg', label: '报文测试参数', cards: cards.filter((c) => c.category === 'msg') },
    { key: 'sig', label: '信号测试参数', cards: cards.filter((c) => c.category === 'sig') },
    { key: 'eps', label: 'EPS 测试参数', cards: cards.filter((c) => c.category === 'eps') },
  ]
  return groups.filter((g) => g.cards.length > 0)
})

// 滑块指示器样式：根据已加载对象数量等分，按激活索引平移
// 容器有 3px padding，滑块宽度 = (100% - 6px) / count；translateX(100%) 按自身宽度平移
const thumbStyle = computed(() => {
  const count = availableViews.value.length
  if (!count) return { display: 'none' }
  return {
    width: `calc((100% - 6px) / ${count})`,
    transform: `translateX(${activeIndex.value * 100}%)`,
  }
})

// 初始化 activeView 为第一个有数据的视图；当前视图数据被移除时自动切换
watch(availableViews, (views) => {
  if (!views.length) return
  if (!views.some((v) => v.value === activeView.value)) {
    activeView.value = views[0].value
  }
}, { immediate: true })

// 没有任何对象可展示时通知宿主收起侧栏（不占着宽度显示「暂无数据」）；
// 数据从无到有时再展开，保证解析/上传完成后用户能看到结果。
watch(
  () => availableViews.value.length > 0,
  (hasData) => {
    if (hasData) emit('expand')
    else emit('collapse')
  },
  { immediate: true },
)

// ==================== 展开/折叠 ====================
// Element Plus 的 :default-expanded-keys 仅在初始化生效，运行时修改数组不会
// 让已渲染的树重新展开/折叠。这里直接操作 tree store 的节点，保证动态生效。

function setAllExpanded(treeRef: any, expanded: boolean) {
  const treeStore = treeRef?.value?.store
  if (!treeStore) return
  Object.values(treeStore.nodesMap).forEach((node: any) => {
    node.expanded = expanded
  })
}

function expandAll() {
  const treeRef = activeView.value === 'a2l' ? a2lTreeRef : dbcTreeRef
  setAllExpanded(treeRef, true)
}

function collapseAll() {
  const treeRef = activeView.value === 'a2l' ? a2lTreeRef : dbcTreeRef
  setAllExpanded(treeRef, false)
}

// ==================== 工具函数 ====================

/** 按关键字查找列索引 */
function findColIndex(columns: string[], keywords: string[]): number {
  for (let i = 0; i < columns.length; i++) {
    const col = String(columns[i]).toLowerCase().replace(/\n/g, ' ')
    if (keywords.some((k) => col.includes(k.toLowerCase()))) return i
  }
  return -1
}

// ==================== DBC 树形构建 ====================
//
// 层级结构：
// 报文(Message)
// ├── 属性
// │   ├── ID / 周期 / 长度 / LostDTC / DlcDTC
// └── 信号(Signal)
//     └── 信号名
//         ├── 精度 / 偏移量 / 物理最小值 / 物理最大值 / 初始值
//         ├── 无效值 / Data_Type / DTC / Signal_Type / XCP_CCP_varname

const dbcTree = computed(() => {
  const records = parseDbcRecords(props.dbcRaw)
  if (!records.length) return []

  const msgMap = new Map<string, typeof records>()
  for (const rec of records) {
    const key = rec.msgName || rec.msgId || 'Unknown'
    if (!msgMap.has(key)) msgMap.set(key, [] as any)
    msgMap.get(key)!.push(rec)
  }

  let id = 0
  const msgNodes: any[] = []

  for (const [msgName, msgRecords] of msgMap) {
    const first = msgRecords[0]
    const msg = {
      senders: first.senders,
      msgName: first.msgName,
      msgType: first.msgType,
      msgId: first.msgId,
      msgSendType: first.msgSendType,
      cycle: first.cycle,
      cycleFast: first.cycleFast,
      nrOfReption: first.nrOfReption,
      length: first.length,
      lostDtc: first.lostDtc,
      dlcDtc: first.dlcDtc,
    }

    const msgInfo = [
      first.msgId,
      first.cycle ? `${first.cycle}ms` : '',
      first.length ? `${first.length}B` : '',
    ].filter(Boolean).join(', ')

    const msgNode: any = {
      id: `m${id++}`,
      label: msgName,
      type: 'message',
      name: msgName,
      info: msgInfo,
      msg,
      children: [],
    }

    const msgAttrDefs: Array<[string, string, string]> = [
      ['发送节点', 'senders', first.senders],
      ['报文名称', 'msgName', first.msgName],
      ['报文类型', 'msgType', first.msgType],
      ['报文标识符', 'msgId', first.msgId],
      ['报文发送类型', 'msgSendType', first.msgSendType],
      ['报文周期时间', 'cycle', first.cycle],
      ['报文发送的快速周期(ms)', 'cycleFast', first.cycleFast],
      ['报文快速发送的次数', 'nrOfReption', first.nrOfReption],
      ['报文长度', 'length', first.length],
    ]
    const attrGroup: any = {
      id: `ag${id++}`,
      label: '属性',
      type: 'group',
      draggable: false,
      children: msgAttrDefs.map(([label, tableKey, value]) => ({
        id: `a${id++}`,
        label,
        type: 'attr',
        tableKey,
        value,
        info: value || '-',
      })),
    }

    msgNode.children.push(attrGroup)

    for (const rec of msgRecords) {
      if (!rec.signalName) continue
      const fields = {
        invalidValue: rec.invalidValue,
        dataType: rec.dataType,
        lostDtc: rec.lostDtc,
        dlcDtc: rec.dlcDtc,
        dtc: rec.dtc,
        signalType: rec.signalType,
        xcpVar: rec.xcpVar,
      }

      const configTags = [
        rec.invalidValue ? `无效值:${rec.invalidValue}` : '',
        rec.dataType ? `数据类型:${rec.dataType}` : '',
        rec.dtc ? `DTC:${rec.dtc}` : '',
        rec.signalType ? `信号类型:${rec.signalType}` : '',
      ].filter(Boolean).join(' | ')

      const sigAttrDefs: Array<[string, string, string]> = [
        ['排列格式', 'byteOrder', rec.byteOrder],
        ['起始字节', 'startByte', rec.startByte],
        ['起始位', 'startBit', rec.startBit],
        ['信号发送类型', 'signalSendType', rec.signalSendType],
        ['信号长度', 'bitLength', rec.bitLength],
        ['数据类型', 'dataType', rec.dataType],
        ['精度', 'factor', rec.factor],
        ['偏移量', 'offset', rec.offset],
        ['物理最小值', 'minPhy', rec.minPhy],
        ['物理最大值', 'maxPhy', rec.maxPhy],
        ['初始值', 'initialValue', rec.initialValue],
        ['单位', 'unit', rec.unit],
        ['信号值描述', 'valueDesc', rec.valueDesc],
      ]
      msgNode.children.push({
        id: `s${id++}`,
        label: rec.signalName,
        type: 'signal',
        name: rec.signalName,
        fields,
        msg,
        info: configTags,
        children: [
          {
            id: `sag${id++}`,
            label: '属性',
            type: 'group',
            draggable: false,
            children: sigAttrDefs.map(([label, tableKey, value]) => ({
              id: `sa${id++}`,
              label,
              type: 'attr',
              tableKey,
              value,
              info: value || '-',
            })),
          },
        ],
      })
    }

    msgNodes.push(msgNode)
  }

  const tree: any[] = []

  // 通信矩阵分组（报文）：默认展开
  tree.push({
    id: `comm${id++}`,
    label: `通信矩阵 (${msgNodes.length})`,
    type: 'group',
    isCommGroup: true,
    draggable: false,
    children: msgNodes,
  })

  // 环境变量分组（EV_）：默认折叠
  const envVars = props.dbcEnvVars || []
  if (envVars.length) {
    const envGroup: any = {
      id: `ev${id++}`,
      label: `环境变量 (${envVars.length})`,
      type: 'group',
      isEnvGroup: true,
      draggable: false,
      children: envVars.map((ev) => {
        const attrs = [
          ev.type ? `类型:${ev.type}` : '',
          ev.minimum !== null && ev.minimum !== undefined ? `最小值:${ev.minimum}` : '',
          ev.maximum !== null && ev.maximum !== undefined ? `最大值:${ev.maximum}` : '',
          ev.unit ? `单位:${ev.unit}` : '',
          ev.initial_value !== null && ev.initial_value !== undefined ? `初始值:${ev.initial_value}` : '',
        ].filter(Boolean).join(' | ')
        return {
          id: `evv${id++}`,
          label: ev.name,
          type: 'envvar',
          name: ev.name,
          info: ev.type || '环境变量',
          attrs,
          draggable: true,
        }
      }),
    }
    tree.push(envGroup)
  }

  return tree
})

// 默认全部折叠：通信矩阵与环境变量两个分组均不展开
const defaultExpandedKeys = computed<string[]>(() => [])

const filteredDbcTree = computed(() => {
  if (!dbcFilterQuery.value) return dbcTree.value
  const search = dbcFilterQuery.value.toLowerCase()

  // 搜索时仅返回匹配的对象节点（报文/信号/环境变量），不再展示分组层级
  const out: any[] = []
  function walk(nodes: any[]) {
    for (const node of nodes) {
      const isObject =
        node.type === 'message' || node.type === 'signal' || node.type === 'envvar'
      if (isObject) {
        const match =
          (node.label || '').toLowerCase().includes(search) ||
          (node.name || '').toLowerCase().includes(search) ||
          (node.info || '').toLowerCase().includes(search)
        if (match) {
          const { children, ...rest } = node
          out.push(rest)
        }
      }
      if (node.children?.length) walk(node.children)
    }
  }

  walk(dbcTree.value)
  return out
})

// ==================== DTC 列表构建 ====================

const dtcList = computed(() => {
  const raw = props.dtcRaw
  if (!raw?.columns || !raw?.rows) return []

  const cols = raw.columns as string[]
  const rows = raw.rows as any[][]

  const iCode = findColIndex(cols, ['dtc', 'code', '故障码'])
  const iDesc = findColIndex(cols, ['desc', '描述', 'description'])
  const iCond = findColIndex(cols, ['condition', '条件', '检测'])

  const codeIdx = iCode >= 0 ? iCode : 0
  const descIdx = iDesc >= 0 ? iDesc : Math.min(1, cols.length - 1)
  const condIdx = iCond >= 0 ? iCond : Math.min(2, cols.length - 1)

  const cleanCols = cols.map((c: string) => String(c).replace(/\n/g, ' / '))

  return rows.map((row, idx) => {
    const code = row[codeIdx] ? String(row[codeIdx]).trim() : ''
    const desc = row[descIdx] ? String(row[descIdx]).trim() : ''
    const detail = row[condIdx] ? String(row[condIdx]).trim() : ''

    const fields: Record<string, string> = {}
    cleanCols.forEach((col: string, i: number) => {
      fields[col] = row[i] != null ? String(row[i]).trim() : ''
    })

    return {
      id: `dtc${idx}`,
      type: 'dtc',
      name: code || desc || `DTC_${idx}`,
      code,
      desc,
      detail,
      fields,
    }
  })
})

const filteredDtcList = computed(() => {
  if (!dtcFilterQuery.value) return dtcList.value
  const search = dtcFilterQuery.value.toLowerCase()
  return dtcList.value.filter(
    (item) =>
      item.code.toLowerCase().includes(search) ||
      item.desc.toLowerCase().includes(search) ||
      Object.values(item.fields).some((v) =>
        String(v).toLowerCase().includes(search),
      ),
  )
})

// ==================== A2L 树形构建 ====================

const a2lTree = computed(() => {
  const v = props.a2lVars
  if (!v) return []
  const tree: any[] = []
  let id = 0
  // 节点说明：种类 · 数据类型或地址 · 字节长度 · 换算系数（非默认时）
  const a2lInfo = (kind: string, vv: A2lVar): string => {
    const parts = [kind]
    if (vv.type) parts.push(vv.type)
    if (vv.size) parts.push(`${vv.size}B`)
    const { precision, offset } = resolveCcpScale(vv)
    if (precision !== DEFAULT_CCP_PRECISION || offset !== DEFAULT_CCP_OFFSET) {
      parts.push(`×${precision}+${offset}`)
    }
    return parts.join(' · ')
  }
  const toVar = (item: A2lVar | string): A2lVar =>
    typeof item === 'string'
      ? { name: item, type: '' }
      : {
          name: item?.name ?? '',
          type: item?.type ?? '',
          size: item?.size,
          precision: item?.precision,
          offset: item?.offset,
        }
  if (v.measurements?.length) {
    tree.push({
      id: `a2lM${id++}`,
      label: `测量变量 MEASUREMENT (${v.measurements.length})`,
      type: 'group',
      draggable: false,
      children: v.measurements.map((item: A2lVar | string) => {
        const vv = toVar(item)
        return {
          id: `a2lMV${id++}`,
          label: vv.name,
          type: 'a2l-measurement',
          name: vv.name,
          addr: vv.type,
          size: vv.size,
          precision: vv.precision,
          offset: vv.offset,
          info: a2lInfo('MEASUREMENT', vv),
          draggable: true,
        }
      }),
    })
  }
  if (v.characteristics?.length) {
    tree.push({
      id: `a2lC${id++}`,
      label: `标定参数 CHARACTERISTIC (${v.characteristics.length})`,
      type: 'group',
      draggable: false,
      children: v.characteristics.map((item: A2lVar | string) => {
        const vv = toVar(item)
        return {
          id: `a2lCV${id++}`,
          label: vv.name,
          type: 'a2l-characteristic',
          name: vv.name,
          addr: vv.type,
          size: vv.size,
          precision: vv.precision,
          offset: vv.offset,
          info: a2lInfo('CHARACTERISTIC', vv),
          draggable: true,
        }
      }),
    })
  }
  return tree
})

const a2lDefaultExpanded = computed(() => a2lTree.value.map((n) => n.id))

const filteredA2lTree = computed(() => {
  if (!a2lFilterQuery.value) return a2lTree.value
  let rawSearch = a2lFilterQuery.value.toLowerCase()
  // 支持直接粘贴完整 sysvar 形式再搜索：sysvar::NsCcp::<name>（有刷）
  // 或 sysvar::XCP::<限定符>::<name>（无刷）——统一取最后一段作为变量名。
  // 否则整体会被当成一个子串，永远匹配不上变量名（用户从 FactorTest / CAPL
  // 里复制出完整形式再粘到检索框是很常见的操作）。
  if (rawSearch.includes('::')) {
    const segs = rawSearch.split('::')
    rawSearch = segs[segs.length - 1].trim()
  }
  const qualifier = (props.a2lQualifier || '').toLowerCase()

  // 标准化：:: 替换为 .，去除任意形式的 XCP/qualifier 前缀（支持复制不全）
  // 例：
  //   sysvar::XCP::LRD008::IoHwAb::Voltage::_9_ → iohwab.voltage._9_
  //   var::XCP::LRD008::IoHwAb::Voltage::_9_   → iohwab.voltage._9_（缺 sys 也能匹配）
  //   XCP::LRD008::IoHwAb::Voltage::_9_        → iohwab.voltage._9_
  //   LRD008::IoHwAb::Voltage::_9_             → iohwab.voltage._9_
  function normalize(s: string): string {
    let v = s.toLowerCase().replace(/::/g, '.')
    if (qualifier) {
      // 1. 任何位置的 .xcp.qualifier. 子串：截取之后部分
      const markerXcp = `xcp.${qualifier}.`
      const idxXcp = v.indexOf(markerXcp)
      if (idxXcp >= 0) {
        v = v.slice(idxXcp + markerXcp.length)
      } else if (v.startsWith(`${qualifier}.`)) {
        // 2. 以 qualifier. 开头：截取之后部分
        v = v.slice(qualifier.length + 1)
      }
    }
    return v
  }

  const normalizedSearch = normalize(rawSearch)

  // 反向：原始名 → sysvar::XCP::qualifier::xxx::yyy
  let convertedSearch = ''
  if (qualifier && rawSearch.includes('.')) {
    convertedSearch = `sysvar::xcp::${qualifier}::${rawSearch.replace(/\./g, '::')}`
  }

  function matchStr(s: string): boolean {
    if (!s) return false
    const lower = s.toLowerCase()
    return (
      lower.includes(rawSearch) ||
      lower.includes(normalizedSearch) ||
      (!!convertedSearch && lower.includes(convertedSearch))
    )
  }

  // 搜索时仅返回匹配的对象节点（测量/标定变量），不再展示分组层级
  const out: any[] = []
  function walk(nodes: any[]) {
    for (const node of nodes) {
      const isObject =
        node.type === 'a2l-measurement' || node.type === 'a2l-characteristic'
      if (isObject && (matchStr(node.label) || matchStr(node.name))) {
        const { children, ...rest } = node
        out.push(rest)
      }
      if (node.children?.length) walk(node.children)
    }
  }
  walk(a2lTree.value)
  return out
})

// ==================== 有刷模式：CCP 系统变量类型 / 精度 / 偏移 ====================

const ccpTypeVisible = ref(false)
const ccpTypeTarget = ref('')
const ccpTypeValue = ref<CcpVarType>('float')
const ccpPrecValue = ref<number>(DEFAULT_CCP_PRECISION)
const ccpOffsetValue = ref<number>(DEFAULT_CCP_OFFSET)
// 新增 / 编辑弹窗的可编辑字段：变量名 / 地址 / 长度
const ccpNameValue = ref('')
const ccpAddrValue = ref('')
const ccpSizeValue = ref<number>(2)
const ccpEditIsNew = ref(false)
const ccpEditIsCustom = ref(false)
// 单个 CCP 符号的最大字节数：与后端 ns_ccp_capl.CCP_MAX_SYMBOL_SIZE 保持一致。
// 超过此长度的符号后端会静默过滤（不进 vsysvar / 不进 gCcpTab），故这里就拦住。
// 结构体需按成员拆成多条，每条长度 ≤ 此值。
const CCP_MAX_SIZE = 4

/** 按字节长度推断类型（与后端 ns_ccp_capl.ccp_var_type 保持一致） */
function inferCcpType(size?: number): CcpVarType {
  if (!size || size <= 2) return 'int'
  if (size === 4) return 'float'
  return 'int64'
}

/** 该符号的 CCP 精度/偏移：对象自带的默认值作底，对象浏览器里的覆盖优先，再缺省回退 1 / 0 */
function resolveCcpScale(v: { name?: string; precision?: number; offset?: number } | null | undefined) {
  const name = String(v?.name || '').trim()
  const override = name ? store.ccpVarScales[name] : undefined
  return {
    precision: override?.precision ?? v?.precision ?? DEFAULT_CCP_PRECISION,
    offset: override?.offset ?? v?.offset ?? DEFAULT_CCP_OFFSET,
  }
}

/** 双击对象浏览器变量：编辑 CCP 全属性（仅有刷模式的测量变量/标定参数节点） */
function onA2lNodeDblClick(data: any) {
  if (store.canMotorMode !== 'brushed') return
  if (!data || (data.type !== 'a2l-measurement' && data.type !== 'a2l-characteristic')) return
  const name = String(data.name || '').trim()
  if (!name) return
  ccpEditIsNew.value = false
  ccpTypeTarget.value = name
  ccpNameValue.value = name
  // 地址取覆盖表优先（用户改过的），否则 .mapxml 原值
  const override = store.ccpVarOverrides[name]
  ccpAddrValue.value = override?.addr ?? String(data.addr ?? '').trim()
  ccpSizeValue.value = Number(override?.size ?? data.size) || 2
  ccpTypeValue.value = store.ccpVarTypes[name] || inferCcpType(ccpSizeValue.value)
  const { precision, offset } = resolveCcpScale(data)
  ccpPrecValue.value = precision
  ccpOffsetValue.value = offset
  ccpEditIsCustom.value = store.ccpCustomVars.some((c) => c.name === name)
  ccpTypeVisible.value = true
}

/** 工具栏「新增变量」：空白表单，用于录入结构体拆分出的成员 */
function openCcpNewDialog() {
  if (store.canMotorMode !== 'brushed') return
  ccpEditIsNew.value = true
  ccpEditIsCustom.value = true
  ccpTypeTarget.value = ''
  ccpNameValue.value = ''
  ccpAddrValue.value = ''
  ccpSizeValue.value = 2
  ccpTypeValue.value = 'int'
  ccpPrecValue.value = DEFAULT_CCP_PRECISION
  ccpOffsetValue.value = DEFAULT_CCP_OFFSET
  ccpTypeVisible.value = true
}

function onCcpTypeConfirm() {
  const name = String(ccpNameValue.value || '').trim()
  const addr = String(ccpAddrValue.value || '').trim()
  const size = Number(ccpSizeValue.value) || 0
  if (!name) {
    ElMessage.warning('请填写变量名')
    return
  }
  if (!addr || size <= 0) {
    ElMessage.warning('请填写地址与长度（字节）')
    return
  }
  if (size > CCP_MAX_SIZE) {
    ElMessage.warning(`单个变量长度不能超过 ${CCP_MAX_SIZE} 字节（后端采集限制）；结构体请按成员拆成多条`)
    return
  }
  // 自定义变量（新增 / 拆分）走独立登记；.mapxml 符号只登记「覆盖属性」
  if (ccpEditIsCustom.value) {
    store.upsertCcpCustomVar({ name, type: addr, size, kind: 'measurement' })
    store.setCcpVarOverride(name, { addr, size })
  } else {
    // 改名：先移除旧覆盖，避免残留旧名的地址
    const oldName = ccpTypeTarget.value
    if (oldName && oldName !== name) {
      store.removeCcpVarOverride(oldName)
      store.setCcpVarType(oldName, '')
      store.setCcpVarScale(oldName, {})
    }
    store.setCcpVarOverride(name, { addr, size })
  }
  store.setCcpVarType(name, ccpTypeValue.value)
  store.setCcpVarScale(name, {
    precision: ccpPrecValue.value,
    offset: ccpOffsetValue.value,
  })
  ccpTypeVisible.value = false
}

/** 删除自定义变量（.mapxml 符号不可删，只能「恢复默认」） */
function onCcpEditDelete() {
  const name = String(ccpNameValue.value || '').trim()
  if (!name) return
  store.removeCcpCustomVar(name)
  store.removeCcpVarOverride(name)
  store.setCcpVarType(name, '')
  store.setCcpVarScale(name, {})
  ccpTypeVisible.value = false
}

/** 恢复默认：清除覆盖（地址/长度回退 .mapxml），精度/偏移回到 1 / 0 */
function onCcpScaleClear() {
  const name = ccpTypeTarget.value
  store.setCcpVarType(name, '')
  store.setCcpVarScale(name, {})
  store.removeCcpVarOverride(name)
  ccpTypeVisible.value = false
}

// ==================== 拖拽 ====================

function targetLabel(target: string): string {
  if (target === 'message') return '报文'
  if (target === 'signal') return '信号'
  if (target === 'eps') return 'EPS'
  return ''
}

function onDragStart(event: DragEvent, data: any) {
  if (!event.dataTransfer) return
  // 分组节点（属性/信号）不携带有效数据，禁止拖拽
  if (data.draggable === false) {
    event.preventDefault()
    return
  }
  event.dataTransfer.effectAllowed = 'copy'

  const name = data.name || data.label || ''
  let plain = data.type === 'attr' ? (data.value ?? name) : name
  if (data.type === 'a2l-measurement' || data.type === 'a2l-characteristic') {
    if (store.canMotorMode === 'brushed') {
      // 有刷模式：mapxml 符号由生成脚本发布到 NsCcp 命名空间（见后端 ns_ccp_capl.CCP_NAMESPACE），
      // 引用形式固定为 sysvar::NsCcp::<符号名>。这里不能带 A2L 限定符 —— 那是无刷 XCP 的写法，
      // 用了会拼出 sysvar::XCP::<限定符>::<符号名>，CANoe 里解析不到该符号
      plain = `sysvar::NsCcp::${name}`
    } else {
      const qualifier = props.a2lQualifier || ''
      const varPath = name.replace(/\./g, '::')
      plain = qualifier ? `sysvar::XCP::${qualifier}::${varPath}` : varPath
    }
  }
  event.dataTransfer.setData('text/plain', String(plain))

  const payload: Record<string, any> = {
    type: data.type || 'unknown',
    name,
    info: data.info || '',
  }
  if (data.type === 'signal') {
    payload.fields = data.fields || {}
    payload.msg = data.msg || {}
  } else if (data.type === 'message') {
    payload.msg = data.msg || {}
  } else if (data.type === 'attr') {
    payload.tableKey = data.tableKey || ''
    payload.value = data.value ?? ''
  } else if (data.type === 'dtc') {
    payload.code = data.code || ''
    payload.desc = data.desc || ''
    payload.detail = data.detail || ''
  } else if (data.type === 'testParam') {
    payload.value = data.value
    payload.label = data.label
    payload.target = data.target
    payload.category = data.category || ''
    payload.params = data.params || {}
  }
  event.dataTransfer.setData('application/json', JSON.stringify(payload))
}

// ==================== 节点图标 ====================

function getNodeIcon(type: string) {
  if (type === 'message') return Document
  if (type === 'group') return Menu
  if (type === 'signal') return Cpu
  return Link
}
</script>

<style scoped lang="scss">
.object-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-card);
  border-radius: var(--radius-base);
  box-shadow: var(--shadow-card);
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color-light);
  flex-shrink: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);

  .title-icon {
    color: var(--color-primary);
    font-size: 16px;
  }
}

.panel-toggle {
  padding: 8px 16px 4px;
  flex-shrink: 0;
}

// 滑块控件：仅显示已加载的对象，滑动指示器动画切换
.obj-slider {
  position: relative;
  display: flex;
  width: 100%;
  height: 32px;
  background: var(--bg-sidebar);
  border: 1px solid var(--border-color-light);
  border-radius: 8px;
  padding: 3px;
  box-sizing: border-box;
  overflow: hidden;
}

.obj-slider-thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  height: calc(100% - 6px);
  background: var(--color-primary);
  border-radius: 6px;
  transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1), width 0.28s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 6px rgba(24, 144, 255, 0.3);
  z-index: 1;
  // 滑块宽度通过 inline style 动态设置（100% / 已加载数量）
  // left 起始留出 padding，平移通过 transform 控制
  box-sizing: border-box;
}

.obj-slider-item {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  user-select: none;
  position: relative;
  z-index: 2;
  transition: color 0.2s ease;

  .slider-icon {
    font-size: 14px;
  }

  &:hover {
    color: var(--text-primary);
  }

  &.active {
    color: #fff;
    font-weight: 600;
  }
}

.panel-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.panel-search {
  margin: 0 16px 8px;
  width: auto;
}

.panel-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 0 12px 8px;
}

// ====== DBC 树 ======
.dbc-tree {
  background: transparent;

  :deep(.el-tree-node__content) {
    height: auto;
    min-height: 32px;
    padding: 2px 0;
  }
}

.tree-node {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: var(--radius-small);
  cursor: grab;
  transition: background 0.15s ease;
  width: 100%;

  &:hover {
    background: var(--bg-hover);
  }

  &:active {
    cursor: grabbing;
  }
}

.node-icon {
  font-size: 14px;
  flex-shrink: 0;

  &.message {
    color: var(--color-warning);
  }

  &.group {
    color: var(--color-primary);
  }

  &.signal {
    color: var(--color-success);
  }

  &.attr {
    color: var(--text-secondary);
  }
}

.node-label {
  font-size: 13px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.node-info {
  font-size: 11px;
  color: var(--text-secondary);
  margin-left: auto;
  padding-left: 8px;
  white-space: nowrap;
  background: var(--bg-hover);
  padding: 1px 6px;
  border-radius: 3px;
  max-width: 55%;
  overflow: hidden;
  text-overflow: ellipsis;
}

// ====== DTC 列表 ======
.dtc-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dtc-card {
  padding: 6px 10px;
  background: var(--bg-sidebar);
  border: 1px solid var(--border-color-light);
  border-radius: var(--radius-small);
  cursor: grab;
  transition: var(--transition-base);

  &:hover {
    border-color: var(--color-primary-light);
    box-shadow: 0 2px 8px rgba(24, 144, 255, 0.1);
  }

  &:active {
    cursor: grabbing;
    opacity: 0.7;
  }
}

.dtc-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.dtc-code {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-primary);
  font-family: 'Consolas', 'Courier New', monospace;
  flex-shrink: 0;
}

.drag-hint {
  font-size: 12px;
  color: var(--text-placeholder);
  margin-left: auto;
  flex-shrink: 0;
}

.dtc-card-desc {
  font-size: 12px;
  color: var(--text-regular);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dtc-card-detail {
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

// ====== DTC 详情弹窗 ======
.dtc-detail-body {
  max-height: 60vh;
  overflow-y: auto;
}

.dtc-detail-value {
  white-space: pre-wrap;
  word-break: break-all;
}

// ====== 测试参数说明弹窗 ======
.testparam-help-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ccp-type-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ccp-type-tip {
  font-size: 12px;
  color: var(--text-color-secondary);
  line-height: 1.5;
}

.ccp-scale-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ccp-scale-label {
  flex: none;
  font-size: 12px;
  color: var(--text-color-secondary);
}

.ccp-scale-input {
  flex: 1;
  min-width: 0;
}

/* 有刷模式：新增变量按钮（紧贴检索框下方） */
.panel-add-btn {
  width: 100%;
  margin-bottom: 6px;
}

/* CCP 编辑弹窗：表单项紧凑排布（地址/长度/类型/换算同屏可见） */
.ccp-edit-form :deep(.el-form-item) {
  margin-bottom: 10px;
}

.ccp-edit-form :deep(.el-form-item__content) {
  gap: 6px;
}

.testparam-help-row {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.testparam-help-label {
  flex-shrink: 0;
  min-width: 60px;
  font-weight: 600;
  color: var(--text-regular);
}

.testparam-help-desc {
  color: var(--text-regular);
  line-height: 1.6;
  word-break: break-word;
}

.testparam-help-hint {
  padding: 10px 12px;
  font-size: 12px;
  color: var(--color-primary);
  background: rgba(79, 70, 229, 0.06);
  border-radius: var(--radius-small);
}

// ====== 空状态 ======
.panel-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  color: var(--text-secondary);
  font-size: 13px;
  gap: 8px;

  .empty-icon {
    font-size: 36px;
    opacity: 0.3;
  }
}

// ====== 测试参数卡片 ======
.testparam-groups {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.testparam-group-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 6px;
  padding-left: 4px;
}

.testparam-cards {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.testparam-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--bg-sidebar);
  border: 1px solid var(--border-color-light);
  border-radius: var(--radius-small);
  cursor: grab;
  transition: var(--transition-base);
  user-select: none;

  &:hover {
    border-color: var(--color-primary-light);
    box-shadow: 0 2px 8px rgba(24, 144, 255, 0.1);
  }

  &:active {
    cursor: grabbing;
    opacity: 0.7;
  }

  &.configured {
    border-color: var(--color-success);
    background: rgba(103, 194, 58, 0.06);
  }

  &.is-selected {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.2);
  }
}

.testparam-icon {
  font-size: 14px;
  color: var(--color-primary);
  flex-shrink: 0;
}

.testparam-card.configured .testparam-icon {
  color: var(--color-success);
}

.testparam-label {
  flex: 1;
  font-size: 13px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.testparam-target {
  font-size: 11px;
  color: var(--text-secondary);
  background: var(--bg-hover);
  padding: 1px 6px;
  border-radius: 3px;
  flex-shrink: 0;
}
</style>

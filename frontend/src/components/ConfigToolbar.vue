<template>
  <div class="config-toolbar">
    <!-- 配置选择 -->
    <div class="toolbar-left">
      <span class="toolbar-label">配置:</span>
      <el-select
        v-model="selectedConfig"
        placeholder="请选择配置"
        class="config-select"
        :loading="loading"
        filterable
        @change="onConfigChange"
      >
        <el-option
          v-for="item in configList"
          :key="item"
          :label="item"
          :value="item"
        />
      </el-select>
    </div>

    <!-- 操作按钮组：按「刷新 / 配置增删 / 产出」分三段，只有主动作「生成」是实心 -->
    <div class="toolbar-right">
      <el-button-group>
        <el-button :icon="Refresh" :loading="loading" @click="$emit('refresh')">
          刷新
        </el-button>
      </el-button-group>

      <span class="toolbar-sep" />

      <el-button-group>
        <el-button :icon="Plus" @click="handleCreate">
          新建
        </el-button>
        <el-button :icon="CopyDocument" :disabled="!selectedConfig" @click="handleCopy">
          复制
        </el-button>
        <el-button type="danger" plain :icon="Delete" :disabled="!selectedConfig" @click="handleDelete">
          删除
        </el-button>
      </el-button-group>

      <span class="toolbar-sep" />

      <el-button-group>
        <el-button
          v-if="moduleName === 'can'"
          :icon="Document"
          :disabled="!selectedConfig"
          @click="$emit('export-excel')"
        >
          导出Excel
        </el-button>
        <el-button :icon="Check" :disabled="!selectedConfig || !!busy" @click="$emit('save')">
          保存
        </el-button>
        <el-button
          type="primary"
          :icon="Promotion"
          :loading="!!busy"
          :disabled="!selectedConfig || !!busy"
          @click="$emit('generate')"
        >
          生成
        </el-button>
      </el-button-group>
      
      <!-- 远程存储操作按钮：拉取 / 推送 -->
      <el-dropdown trigger="click" @click.prevent>
        <el-button :icon="Download">
          拉取/推送
        </el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item @click="openRemoteDialog('pull')">
              <el-icon><Download /></el-icon>
              拉取（共享盘 → 本地）
            </el-dropdown-item>
            <el-dropdown-item @click="openRemoteDialog('push')">
              <el-icon><Upload /></el-icon>
              推送（本地 → 共享盘）
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>

    <!-- 拉取 / 推送配置弹窗（可多选、全选；拉取支持按时间戳选择历史版本） -->
    <el-dialog
      v-model="remoteVisible"
      :title="remoteMode === 'pull' ? '拉取配置' : '推送配置'"
      width="640px"
    >
      <div class="remote-desc">
        {{ remoteMode === 'pull'
          ? '从共享盘拉取配置到本地。树中根节点为「最新配置」，展开可看到各历史版本；勾选后拉取，本地同名配置会被直接覆盖。'
          : '把勾选的配置项上传到共享盘并生成新版本（不覆盖服务端已存在的同名配置），可填写备注便于追溯。' }}
      </div>

      <!-- 拉取：时间戳筛选（过滤后仅展示范围内的历史版本子节点） -->
      <div v-if="remoteMode === 'pull'" class="remote-filter">
        <span class="remote-filter-label">时间戳筛选：</span>
        <el-date-picker
          v-model="versionRange"
          type="datetimerange"
          value-format="YYYYMMDD-HHmmss"
          range-separator="至"
          start-placeholder="起始时间"
          end-placeholder="结束时间"
          size="default"
          @change="loadVersionTree"
        />
        <el-button link type="primary" :icon="Refresh" :loading="versionLoading" @click="loadVersionTree">
          刷新
        </el-button>
      </div>

      <div v-if="remoteMode === 'push'" class="remote-remark">
        <span class="remote-filter-label">用户备注：</span>
        <el-input
          v-model="pushRemark"
          placeholder="填写本次推送备注（可选，例如：修正信号映射）"
          maxlength="120"
          show-word-limit
        />
      </div>

      <template v-if="remoteMode === 'pull'">
        <!-- 树形图：根节点=最新配置，展开=历史版本 -->
        <div class="remote-toolbar">
          <span class="remote-count">共 {{ versionTotal }} 个配置 / {{ versionLeafCount }} 个历史版本（可多选）</span>
          <div class="remote-toolbar-right">
            <el-button link type="primary" :disabled="!versionTree.length" @click="toggleExpandAll">
              {{ allExpanded ? '折叠全部' : '展开全部' }}
            </el-button>
            <el-button link type="primary" :disabled="!versionTree.length" @click="selectAllVersions">
              全选
            </el-button>
            <el-button link type="primary" :disabled="!versionTree.length" @click="clearSelectedVersions">
              清空
            </el-button>
          </div>
        </div>
        <el-alert
          v-if="versionWarn"
          :title="versionWarn"
          type="warning"
          :closable="false"
          show-icon
          class="remote-alert"
        />
        <div v-loading="versionLoading" class="remote-list">
          <el-tree
            ref="versionTreeRef"
            :data="versionTree"
            node-key="key"
            show-checkbox
            :default-expand-all="false"
            :expand-on-click-node="false"
            :check-on-click-node="true"
            :props="{ label: 'label', children: 'children' }"
            class="version-tree"
            @check="onVersionTreeCheck"
          >
            <template #default="{ data }">
              <span v-if="data.isRoot" class="tree-root">
                <span class="version-name" :title="data.name">{{ data.name }}</span>
                <span class="version-remark" :title="data.remark">{{ data.remark || '—' }}</span>
                <el-tag size="small" type="success" effect="plain" class="tree-badge">最新</el-tag>
              </span>
              <span v-else class="tree-child">
                <el-tag size="small" type="info" effect="plain" class="version-timestamp">{{ data.timestamp }}</el-tag>
                <span class="version-remark" :title="data.remark">{{ data.remark || '—' }}</span>
              </span>
            </template>
          </el-tree>
          <div v-if="!versionLoading && !versionTree.length" class="remote-empty">
            共享盘上没有可拉取的配置
          </div>
        </div>
      </template>

      <template v-else>
        <div class="remote-toolbar">
          <el-checkbox
            :model-value="remoteAllChecked"
            :indeterminate="remoteIndeterminate"
            :disabled="!remoteItems.length"
            @change="onRemoteCheckAllChange"
          >
            全选
          </el-checkbox>
          <span class="remote-count">已选 {{ remoteChecked.length }} / {{ remoteItems.length }}</span>
          <div class="remote-toolbar-right">
            <el-button link type="primary" :disabled="!remoteItems.length" @click="invertRemoteChecked">
              反选
            </el-button>
            <el-button link type="primary" :icon="Refresh" :loading="remoteLoading" @click="loadRemoteList">
              刷新
            </el-button>
          </div>
        </div>

        <el-alert
          v-if="remoteWarn"
          :title="remoteWarn"
          type="warning"
          :closable="false"
          show-icon
          class="remote-alert"
        />

        <div v-loading="remoteLoading" class="remote-list">
          <el-checkbox-group v-model="remoteChecked">
            <el-checkbox
              v-for="item in remoteItems"
              :key="item.name"
              :value="item.name"
              class="remote-item"
            >
              <span class="remote-item-name">{{ item.name }}</span>
              <el-tag size="small" :type="item.tagType" effect="plain">{{ item.tagText }}</el-tag>
            </el-checkbox>
          </el-checkbox-group>
          <div v-if="!remoteLoading && !remoteItems.length" class="remote-empty">
            本地没有可推送的配置项
          </div>
        </div>
      </template>

      <div class="remote-path">共享盘：{{ remoteSharePath || '默认远程存储路径' }}</div>

      <template #footer>
        <el-button @click="remoteVisible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="remoteSubmitting"
          :disabled="remoteSubmitDisabled"
          @click="confirmRemote"
        >
          {{ remoteMode === 'pull' ? '确定拉取' : '确定推送' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 新建配置弹窗 -->
    <el-dialog v-model="createVisible" :title="copyMode ? '复制配置' : '新建配置'" width="420px">
      <el-form :model="createForm" label-width="80px">
        <el-form-item label="配置名称">
          <el-input
            v-model="createForm.name"
            placeholder="请输入配置名称"
            @keyup.enter="confirmCreate"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmCreate">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue'
import {
  Refresh,
  Plus,
  CopyDocument,
  Delete,
  Check,
  Promotion,
  Download,
  Upload,
  Document,
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getConfigs, copyConfig, deleteConfig, pullConfig, pushConfig, getRemoteConfigs, getRemoteVersions, pullConfigVersion } from '@/api/config'
import { useShortcut, isModuleActive } from '@/composables/useShortcuts'

const props = defineProps<{
  moduleName: string
  /** 宿主模块是否正在执行耗时动作（如生成文件）：用于让「保存/生成」同步进入禁用与 loading 态 */
  busy?: boolean
}>()

const emit = defineEmits<{
  (e: 'refresh'): void
  (e: 'create', name: string): void
  (e: 'copy', name: string, newName: string): void
  (e: 'delete', name: string): void
  (e: 'save'): void
  (e: 'generate'): void
  (e: 'export-excel'): void
  (e: 'config-change', name: string): void
}>()

const selectedConfig = ref('')
const configList = ref<string[]>([])
const loading = ref(false)
const createVisible = ref(false)
const copyMode = ref(false)
const createForm = ref({ name: '' })

// 模块名 → 路由路径：用于限定快捷键只在当前模块生效
// （视图被 keep-alive 缓存，组件不会卸载，必须靠路由判断，否则多个模块会同时响应）
const MODULE_PATH: Record<string, string> = {
  boot: '/boot',
  uds: '/uds',
  function: '/function',
  can: '/can',
  great_canoe: '/create-canoe',
  sanbao: '/sanbao',
}
const activePath = computed(() => MODULE_PATH[props.moduleName] || '')
const shortcutReady = () => !!selectedConfig.value && isModuleActive(activePath.value)

// 全局保存 / 生成：Ctrl+S、Ctrl+Enter（六个模块共用这一个工具条）
useShortcut({
  id: 'config:save',
  keys: 'Ctrl+S',
  scope: 'global',
  desc: '保存当前配置',
  allowInInput: true,
  when: shortcutReady,
  run: () => {
    emit('save')
    return true
  },
})
useShortcut({
  id: 'config:generate',
  keys: 'Ctrl+Enter',
  scope: 'global',
  desc: '生成文件',
  when: shortcutReady,
  run: () => {
    emit('generate')
    return true
  },
})

/** 加载配置列表 */
async function loadConfigs() {
  loading.value = true
  try {
    const res: any = await getConfigs(props.moduleName)
    configList.value = Array.isArray(res) ? res : res?.data ?? []
  } catch {
    configList.value = []
  } finally {
    loading.value = false
  }
}

function onConfigChange(val: string) {
  emit('config-change', val)
}

function handleCreate() {
  copyMode.value = false
  createForm.value.name = ''
  createVisible.value = true
}

function handleCopy() {
  copyMode.value = true
  createForm.value.name = `${selectedConfig.value}_copy`
  createVisible.value = true
}

function confirmCreate() {
  const name = createForm.value.name.trim()
  if (!name) {
    ElMessage.warning('请输入配置名称')
    return
  }
  if (copyMode.value && selectedConfig.value) {
    copyConfig(props.moduleName, selectedConfig.value, name)
      .then(() => {
        ElMessage.success('复制成功')
        emit('copy', selectedConfig.value, name)
        createVisible.value = false
        loadConfigs()
      })
      .catch(() => {})
  } else {
    // 新建：交由父组件持久化后再刷新列表并选中（避免在保存完成前提前刷新的竞态）
    emit('create', name)
    createVisible.value = false
  }
}

function handleDelete() {
  const currentName = selectedConfig.value
  ElMessageBox.confirm(
    `确定要删除配置 "${currentName}" 吗？`,
    '删除确认',
    { type: 'warning' }
  )
    .then(() => {
      deleteConfig(props.moduleName, currentName)
        .then(() => {
          ElMessage.success('删除成功')
          emit('delete', currentName)
          // 删除后自动选择下一配置
          loadConfigs().then(() => {
            const list = configList.value
            if (list.length === 0) {
              selectedConfig.value = ''
              emit('config-change', '')
              return
            }
            // 找字典序下一个，找不到则取列表最后一个
            const sorted = [...list].sort((a, b) => a.localeCompare(b, 'zh-CN'))
            const next = sorted.find((n) => n > currentName) || sorted[sorted.length - 1]
            selectedConfig.value = next
            emit('config-change', next)
          })
        })
        .catch(() => {})
    })
    .catch(() => {})
}

watch(
  () => props.moduleName,
  () => {
    selectedConfig.value = ''
    loadConfigs()
  }
)

onMounted(() => {
  loadConfigs()
})

/** 拉取 / 推送：可勾选的配置项列表 */
type RemoteMode = 'pull' | 'push'
interface RemoteItem {
  name: string
  tagText: string
  tagType: 'success' | 'warning' | 'info' | 'primary'
}

const remoteVisible = ref(false)
const remoteMode = ref<RemoteMode>('pull')
const remoteLoading = ref(false)
const remoteSubmitting = ref(false)
const remoteAvailable = ref(false)
const remoteSharePath = ref('')
const remoteWarn = ref('')
const remoteChecked = ref<string[]>([])
const remoteItems = ref<RemoteItem[]>([])

// 推送备注（写入版本元数据）
const pushRemark = ref('')

// 拉取：树形图（根节点=最新配置，子节点=历史版本）
interface VersionTreeNode {
  key: string          // 唯一键：root 用 `cfg::<name>`；子节点用 `<name>::<version>`
  label: string
  name: string
  version: string      // 最新节点为空（表示拉取最新）
  timestamp: string
  remark: string
  isRoot: boolean
  children?: VersionTreeNode[]
}
const versionLoading = ref(false)
const versionWarn = ref('')
const versionTree = ref<VersionTreeNode[]>([])
const versionRange = ref<[string, string] | null>(null)
const versionTreeRef = ref<any>(null)
const allExpanded = ref(false)
/** 已勾选的节点 key 集合（由 el-tree 的 getCheckedNodes 同步） */
const versionCheckedKeys = ref<string[]>([])

const versionTotal = computed(() => versionTree.value.length)
const versionLeafCount = computed(() =>
  versionTree.value.reduce((sum, n) => sum + (n.children?.length || 0), 0)
)

const remoteAllChecked = computed(
  () => remoteItems.value.length > 0 && remoteChecked.value.length === remoteItems.value.length
)
const remoteIndeterminate = computed(
  () => remoteChecked.value.length > 0 && remoteChecked.value.length < remoteItems.value.length
)

// 确定按钮是否禁用：拉取需至少勾选一个节点；推送需勾选至少一个配置项
const remoteSubmitDisabled = computed(() => {
  if (remoteMode.value === 'pull') {
    return !versionCheckedKeys.value.length
  }
  return !remoteChecked.value.length
})

/** 打开拉取/推送弹窗 */
function openRemoteDialog(mode: RemoteMode) {
  remoteMode.value = mode
  remoteVisible.value = true
  remoteChecked.value = []
  remoteItems.value = []
  remoteWarn.value = ''
  pushRemark.value = ''
  versionTree.value = []
  versionRange.value = null
  versionWarn.value = ''
  versionCheckedKeys.value = []
  allExpanded.value = false
  if (mode === 'pull') {
    loadVersionTree()
  } else {
    loadRemoteList()
  }
}

/** 加载可勾选项（推送=本地已有的配置项） */
async function loadRemoteList() {
  remoteLoading.value = true
  remoteWarn.value = ''
  try {
    const res: any = await getRemoteConfigs(props.moduleName)
    const data = res?.data ?? res ?? {}
    remoteAvailable.value = !!data.available
    remoteSharePath.value = data.share_path || ''
    const remoteNames: string[] = data.remote_configs || []
    const localNames: string[] = data.local_configs?.length ? data.local_configs : configList.value
    const sortNames = (arr: string[]) => [...arr].sort((a, b) => a.localeCompare(b, 'zh-CN'))

    remoteItems.value = sortNames(localNames).map((name) => ({
      name,
      tagText: remoteNames.includes(name) ? '覆盖远程' : '远程新增',
      tagType: remoteNames.includes(name) ? 'warning' : 'success',
    }))
    // 推送默认只勾选当前配置，避免误推全部
    const cur = selectedConfig.value
    remoteChecked.value = cur && localNames.includes(cur) ? [cur] : []
    if (!remoteAvailable.value) {
      remoteWarn.value = '共享盘不可访问，或远程还没有该模块的配置文件（推送将新建远程文件）'
    }
  } catch {
    remoteItems.value = []
    remoteChecked.value = []
    remoteWarn.value = '获取共享盘配置列表失败，请检查共享盘是否可访问'
  } finally {
    remoteLoading.value = false
  }
}

function onRemoteCheckAllChange(val: boolean | string | number) {
  remoteChecked.value = val ? remoteItems.value.map((i) => i.name) : []
}

function invertRemoteChecked() {
  const checked = new Set(remoteChecked.value)
  remoteChecked.value = remoteItems.value.filter((i) => !checked.has(i.name)).map((i) => i.name)
}

/** 加载拉取树：每个配置一个根节点（最新），子节点为历史版本 */
async function loadVersionTree() {
  versionLoading.value = true
  versionWarn.value = ''
  versionCheckedKeys.value = []
  try {
    const opts: { since?: string; until?: string } = {}
    if (versionRange.value && versionRange.value.length === 2) {
      opts.since = versionRange.value[0]
      opts.until = versionRange.value[1]
    }
    const res: any = await getRemoteVersions(props.moduleName, opts)
    const data = res?.data ?? res ?? {}
    remoteSharePath.value = data.share_path || remoteSharePath.value
    const versionsMap: Record<string, any[]> = data.versions || {}

    const nodes: VersionTreeNode[] = Object.keys(versionsMap)
      .sort((a, b) => a.localeCompare(b, 'zh-CN'))
      .map((name) => {
        const versions = [...(versionsMap[name] || [])]
          .map((v) => ({
            key: `${name}::${String(v.version || v.timestamp || '')}`,
            label: String(v.timestamp || v.version || ''),
            name,
            version: String(v.version || v.timestamp || ''),
            timestamp: String(v.timestamp || v.version || ''),
            remark: v.remark || '',
            isRoot: false,
          }))
          .filter((v) => v.version)
          .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))

        const latest = versions[0]
        return {
          key: `cfg::${name}`,
          label: name,
          name,
          version: '', // 空表示拉取「最新」
          timestamp: latest ? latest.timestamp : '',
          remark: latest ? latest.remark : '',
          isRoot: true,
          children: versions,
        }
      })

    versionTree.value = nodes
    if (!nodes.length) {
      versionWarn.value = data.available === false
        ? '共享盘不可访问，或该模块还没有任何配置版本'
        : '所选时间范围内没有可拉取的配置版本'
    }
  } catch {
    versionTree.value = []
    versionWarn.value = '获取远程配置版本失败，请检查共享盘是否可访问'
  } finally {
    versionLoading.value = false
  }
}

/** 树勾选变化：记录已勾选的节点 key（含最新根与历史子节点） */
function onVersionTreeCheck() {
  const nodes = versionTreeRef.value?.getCheckedNodes?.() || []
  versionCheckedKeys.value = nodes.map((n: VersionTreeNode) => n.key)
}

/** 展开 / 折叠全部 */
function toggleExpandAll() {
  allExpanded.value = !allExpanded.value
  const root = versionTreeRef.value?.store?.root
  if (!root) return
  const walk = (node: any) => {
    node.expanded = allExpanded.value
    ;(node.childNodes || []).forEach(walk)
  }
  ;(root.childNodes || []).forEach(walk)
}

/** 全选：勾选所有根与其子节点 */
function selectAllVersions() {
  const allKeys: string[] = []
  versionTree.value.forEach((n) => {
    allKeys.push(n.key)
    ;(n.children || []).forEach((c) => allKeys.push(c.key))
  })
  versionTreeRef.value?.setCheckedKeys?.(allKeys)
  onVersionTreeCheck()
}

function clearSelectedVersions() {
  versionTreeRef.value?.setCheckedKeys?.([])
  versionCheckedKeys.value = []
}

/** 确认拉取 / 推送 */
async function confirmRemote() {
  const isPull = remoteMode.value === 'pull'

  // 拉取：按勾选的树节点逐项拉取（根节点=最新配置；子节点=指定历史版本）
  if (isPull) {
    const checked = [...versionCheckedKeys.value]
    if (!checked.length) {
      ElMessage.warning('请至少勾选一个要拉取的配置或版本')
      return
    }
    // 解析为「配置名 -> 指定版本（空=最新）」，同一配置取最具体的选择（子节点优先）
    const plan = new Map<string, string>()
    checked.forEach((key) => {
      if (key.startsWith('cfg::')) {
        const name = key.slice(5)
        if (!plan.has(name)) plan.set(name, '')
      } else {
        const [name, version] = key.split('::')
        plan.set(name, version) // 子节点覆盖根节点的「最新」选择
      }
    })

    remoteSubmitting.value = true
    try {
      let lastMessage = ''
      for (const [name, version] of plan) {
        const res: any = version
          ? await pullConfigVersion(props.moduleName, name, version)
          : await pullConfig(props.moduleName, [name], true)
        lastMessage = res?.message || lastMessage
      }
      ElMessage.success(lastMessage || `已拉取 ${plan.size} 项配置`)
      remoteVisible.value = false
      await loadConfigs()
      const firstName = [...plan.keys()][0]
      if (firstName && configList.value.includes(firstName)) {
        selectedConfig.value = firstName
        emit('config-change', firstName)
      } else if (configList.value.length > 0) {
        selectedConfig.value = configList.value[0]
        emit('config-change', selectedConfig.value)
      }
    } catch {
      // 错误提示已由请求拦截器统一弹出
    } finally {
      remoteSubmitting.value = false
    }
    return
  }

  // 推送：多选本地配置项
  const names = [...remoteChecked.value]
  if (!names.length) {
    ElMessage.warning('请至少选择一个配置项')
    return
  }
  remoteSubmitting.value = true
  try {
    const res: any = await pushConfig(props.moduleName, names, true, pushRemark.value.trim())
    ElMessage.success(res?.message || '推送成功')
    remoteVisible.value = false
    await loadConfigs()
  } catch {
    // 错误提示已由请求拦截器统一弹出
  } finally {
    remoteSubmitting.value = false
  }
}

function refreshAndSelect(name: string) {
  return loadConfigs().then(() => {
    if (name && configList.value.includes(name)) {
      selectedConfig.value = name
    }
    return configList.value
  })
}

defineExpose({ loadConfigs, refreshAndSelect, selectedConfig, configList })
</script>

<style scoped lang="scss">
.config-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--pad-bar, 8px 12px);
  background: var(--bg-card);
  border-radius: var(--radius-base);
  box-shadow: var(--shadow-card);
  margin-bottom: var(--gap-block, 10px);
  flex-wrap: wrap;
  gap: var(--gap-inline, 8px);
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.toolbar-label {
  font-size: 14px;
  color: var(--text-regular);
  white-space: nowrap;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: var(--gap-inline, 8px);
  flex-wrap: wrap;
}

/* 按钮分组之间的分隔线：让「刷新 / 配置增删 / 产出」三段在视觉上断开 */
.toolbar-sep {
  width: 1px;
  height: 16px;
  flex-shrink: 0;
  background: var(--border-color-light);
}

.config-select {
  width: 190px;
}

/* 工具栏按钮收窄内边距：让 7 个按钮 + 下拉能挤进一行（换行会多占 44px） */
.config-toolbar .el-button {
  padding-left: 10px;
  padding-right: 10px;
}

/* ===== 拉取 / 推送弹窗 ===== */
.remote-desc {
  font-size: 13px;
  color: var(--text-regular);
  margin-bottom: 12px;
}

.remote-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 0 10px;
  border-bottom: 1px solid var(--border-base, #e4e7ed);
}

.remote-count {
  font-size: 13px;
  color: var(--text-secondary);
}

.remote-toolbar-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
}

.remote-alert {
  margin-top: 10px;
}

/* 历史版本时间戳筛选 / 推送备注行 */
.remote-filter,
.remote-remark {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.remote-filter-label {
  font-size: 13px;
  color: var(--text-regular);
  white-space: nowrap;
}

.remote-remark .el-input {
  flex: 1;
  min-width: 240px;
}

/* 拉取树形图 */
.version-tree {
  width: 100%;
  --el-tree-node-hover-bg-color: var(--bg-hover, #f5f7fa);

  :deep(.el-tree-node__content) {
    height: auto;
    min-height: 30px;
    padding-top: 2px;
    padding-bottom: 2px;
  }

  /* 让节点内容横向铺满，便于备注与时间戳对齐 */
  :deep(.el-tree-node__label) {
    flex: 1;
    min-width: 0;
    overflow: hidden;
  }
}

/* 根节点行（最新配置）：配置名 + 备注 + 最新标记 */
.tree-root {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
}

/* 子节点行（历史版本）：时间戳 + 备注 */
.tree-child {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
}

.tree-badge {
  flex: 0 0 auto;
}

/* 配置名：自适应宽度，并限制在 [120px, 220px] 之间 */
.version-name {
  flex: 0 1 auto;
  min-width: 120px;
  max-width: 220px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 备注：占据中间剩余空间并左对齐，超长省略 */
.version-remark {
  flex: 1 1 auto;
  min-width: 0;
  color: var(--text-secondary);
  font-size: 12px;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 时间戳：固定在最右端 */
.version-timestamp {
  flex: 0 0 auto;
  margin-left: auto;
  font-variant-numeric: tabular-nums;
}

.remote-list {
  margin-top: 10px;
  max-height: 320px;
  overflow-y: auto;
  min-height: 80px;
}

.remote-item {
  display: flex;
  align-items: center;
  width: 100%;
  height: auto;
  padding: 6px 8px;
  margin-right: 0;
  border-radius: var(--radius-sm, 4px);

  &:hover {
    background: var(--bg-hover, #f5f7fa);
  }

  :deep(.el-checkbox__label) {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    overflow: hidden;
  }
}

.remote-item-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.remote-empty {
  padding: 24px 0;
  text-align: center;
  font-size: 13px;
  color: var(--text-secondary);
}

.remote-path {
  margin-top: 10px;
  font-size: 12px;
  color: var(--text-secondary);
  word-break: break-all;
}
</style>

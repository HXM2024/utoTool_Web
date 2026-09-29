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
        <el-button :icon="Check" :disabled="!selectedConfig" @click="$emit('save')">
          保存
        </el-button>
        <el-button type="primary" :icon="Promotion" :disabled="!selectedConfig" @click="$emit('generate')">
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

    <!-- 拉取 / 推送配置弹窗（可多选、全选） -->
    <el-dialog
      v-model="remoteVisible"
      :title="remoteMode === 'pull' ? '拉取配置' : '推送配置'"
      width="560px"
    >
      <div class="remote-desc">
        {{ remoteMode === 'pull'
          ? '从共享盘拉取勾选的配置项到本地，未勾选的本地配置不受影响。'
          : '把勾选的配置项上传到共享盘，未勾选的远程配置不受影响。' }}
      </div>

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
          {{ remoteMode === 'pull' ? '共享盘上没有可拉取的配置项' : '本地没有可推送的配置项' }}
        </div>
      </div>

      <div class="remote-path">共享盘：{{ remoteSharePath || '默认远程存储路径' }}</div>

      <template #footer>
        <el-button @click="remoteVisible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="remoteSubmitting"
          :disabled="!remoteChecked.length"
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
import { getConfigs, copyConfig, deleteConfig, pullConfig, pushConfig, getRemoteConfigs } from '@/api/config'
import { useShortcut, isModuleActive } from '@/composables/useShortcuts'

const props = defineProps<{
  moduleName: string
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

const remoteAllChecked = computed(
  () => remoteItems.value.length > 0 && remoteChecked.value.length === remoteItems.value.length
)
const remoteIndeterminate = computed(
  () => remoteChecked.value.length > 0 && remoteChecked.value.length < remoteItems.value.length
)

/** 打开拉取/推送弹窗 */
function openRemoteDialog(mode: RemoteMode) {
  remoteMode.value = mode
  remoteVisible.value = true
  remoteChecked.value = []
  remoteItems.value = []
  remoteWarn.value = ''
  loadRemoteList()
}

/** 加载可勾选项：拉取=远程已有的配置项；推送=本地已有的配置项 */
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

    if (remoteMode.value === 'pull') {
      remoteItems.value = sortNames(remoteNames).map((name) => ({
        name,
        tagText: localNames.includes(name) ? '本地已有（合并）' : '本地新增',
        tagType: localNames.includes(name) ? 'warning' : 'success',
      }))
      // 拉取默认全选，便于一次取回全部
      remoteChecked.value = remoteItems.value.map((i) => i.name)
      if (!remoteAvailable.value) {
        remoteWarn.value = '共享盘不可访问，或远程还没有该模块的配置文件，无法拉取'
      }
    } else {
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

/** 确认拉取 / 推送 */
async function confirmRemote() {
  const names = [...remoteChecked.value]
  if (!names.length) {
    ElMessage.warning('请至少选择一个配置项')
    return
  }
  const isPull = remoteMode.value === 'pull'
  remoteSubmitting.value = true
  try {
    const res: any = isPull
      ? await pullConfig(props.moduleName, names, true)
      : await pushConfig(props.moduleName, names, true)
    ElMessage.success(res?.message || (isPull ? '拉取成功' : '推送成功'))
    remoteVisible.value = false
    await loadConfigs()
    // 拉取后列表可能新增配置项，保持原选中，否则选第一个
    if (isPull) {
      if (selectedConfig.value && configList.value.includes(selectedConfig.value)) {
        emit('config-change', selectedConfig.value)
      } else if (configList.value.length > 0) {
        selectedConfig.value = configList.value[0]
        emit('config-change', selectedConfig.value)
      }
    }
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

<template>
  <el-dialog
    v-model="visible"
    width="min(1220px, 96vw)"
    top="5vh"
    append-to-body
    :close-on-click-modal="false"
    :before-close="handleBeforeClose"
    class="feedback-dialog"
    @closed="onDialogClosed"
  >
    <template #header>
      <div class="fb-header">
        <div class="fb-brand">
          <div class="fb-logo">
            <el-icon><ChatLineSquare /></el-icon>
          </div>
          <div class="fb-brand-text">
            <div class="fb-title">问题反馈</div>
            <div class="fb-sub">记录使用问题与需求建议，团队共享查看</div>
          </div>
        </div>
        <div class="fb-header-actions">
          <el-button
            v-if="adminUnlocked"
            type="success"
            plain
            size="small"
            :icon="Unlock"
            @click="lockAdmin()"
          >
            退出管理
          </el-button>
          <el-tooltip v-else content="修改问题清单需要管理密钥" placement="bottom" :show-after="300">
            <el-button plain size="small" :icon="Lock" @click="openAdmin">管理</el-button>
          </el-tooltip>
        </div>
      </div>
    </template>

    <!-- ==================== 问题清单 ==================== -->
    <div v-if="activeView === 'list'" class="fb-list">
      <div class="fb-toolbar">
        <div class="fb-status-chips">
          <button
            v-for="label in STATUS_FILTERS"
            :key="label"
            class="fb-chip"
            :class="{ active: statusFilter === label }"
            @click="statusFilter = label"
          >
            <span class="dot" :class="chipDotClass(label)" />
            {{ label }}
            <span class="num">{{ counts[label] || 0 }}</span>
          </button>
        </div>
        <div class="fb-tools-right">
          <el-input
            v-model="query"
            class="fb-search"
            size="small"
            clearable
            placeholder="搜索描述 / 汇报人 / 来源"
          >
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
          <el-select v-model="sortOrder" size="small" class="fb-sort">
            <el-option label="表格序号" value="seq" />
            <el-option label="表格序号倒序" value="seqDesc" />
            <el-option label="最新优先" value="desc" />
            <el-option label="最早优先" value="asc" />
          </el-select>
          <el-tooltip content="刷新问题清单" placement="top">
            <el-button circle size="small" :icon="Refresh" :loading="refreshing" @click="loadIssues(true)" />
          </el-tooltip>
        </div>
      </div>

      <el-alert
        v-if="storage === 'local'"
        type="warning"
        :closable="false"
        show-icon
        class="fb-alert"
        title="共享盘暂不可达，当前显示本地缓存；网络恢复后再次提交会自动写入共享盘"
      />

      <el-alert
        v-if="adminUnlocked"
        type="success"
        :closable="false"
        show-icon
        class="fb-alert"
        title="管理模式已开启，可编辑或删除问题记录"
      />

      <el-table
        v-loading="loading"
        :data="filtered"
        size="small"
        class="fb-table"
        max-height="54vh"
        :row-class-name="rowClassName"
        @row-click="openDetail"
      >
        <el-table-column prop="id" label="编号" width="118" fixed />
        <el-table-column prop="description" label="描述" min-width="250" show-overflow-tooltip />
        <el-table-column prop="reporter" label="汇报人" width="86" show-overflow-tooltip />
        <el-table-column prop="source" label="需求来源" width="116" show-overflow-tooltip />
        <el-table-column prop="createdAt" label="创建时间" width="104" />
        <el-table-column prop="status" label="状态" width="86">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" size="small" effect="light" round>{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="solution" label="解决方案" min-width="150" show-overflow-tooltip>
          <template #default="{ row }">
            <span :class="{ 'cell-empty': !row.solution }">{{ row.solution || '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="assignee" label="受理人" width="82" show-overflow-tooltip>
          <template #default="{ row }">
            <span :class="{ 'cell-empty': !row.assignee }">{{ row.assignee || '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="closedAt" label="关闭时间" width="104">
          <template #default="{ row }">
            <span :class="{ 'cell-empty': !row.closedAt }">{{ row.closedAt || '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column v-if="adminUnlocked" label="操作" width="96" fixed="right">
          <template #default="{ row }">
            <div class="row-actions" @click.stop>
              <el-button link type="primary" size="small" :icon="EditPen" @click="openEdit(row)">编辑</el-button>
              <el-button link type="danger" size="small" :icon="Delete" @click="removeIssue(row)">删除</el-button>
            </div>
          </template>
        </el-table-column>

        <template #empty>
          <el-empty
            :image-size="86"
            :description="issues.length ? '没有符合筛选条件的问题' : '暂无问题记录，欢迎提交第一个问题'"
          >
            <el-button v-if="!issues.length" type="primary" :icon="Plus" @click="openCreate">创建新问题</el-button>
          </el-empty>
        </template>
      </el-table>
    </div>

    <!-- ==================== 创建 / 编辑 ==================== -->
    <div v-else class="fb-view">
      <div class="fb-view-head">
        <el-button link :icon="ArrowLeft" @click="backToList">返回问题清单</el-button>
        <span class="fb-view-title">{{ isEdit ? '编辑问题' : '创建新问题' }}</span>
        <span class="fb-view-sub">
          {{ isEdit ? '修改后立即同步到共享盘' : '提交后自动记录创建时间（精确到日）' }}
        </span>
      </div>

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        class="fb-form"
        @submit.prevent
      >
        <div class="form-row">
          <el-form-item label="汇报人" prop="reporter">
            <el-input v-model="form.reporter" maxlength="50" placeholder="填写汇报人姓名" />
          </el-form-item>
          <el-form-item label="需求来源" prop="source">
            <el-input v-model="form.source" maxlength="200" placeholder="填写用例 ID，如 CAN_交互层_0002" />
          </el-form-item>
        </div>

        <el-form-item label="问题描述" prop="description">
          <el-input
            ref="descInputRef"
            v-model="form.description"
            type="textarea"
            :autosize="{ minRows: 4, maxRows: 8 }"
            maxlength="2000"
            show-word-limit
            placeholder="请描述问题现象、复现步骤或需求内容…（Ctrl + Enter 快捷提交）"
            @keydown.ctrl.enter.prevent="submitForm"
          />
        </el-form-item>

        <div class="form-row">
          <el-form-item label="创建时间">
            <el-input :model-value="form.createdAt" disabled>
              <template #prefix><el-icon><Calendar /></el-icon></template>
            </el-input>
            <div class="field-tip">系统自动获取，精确到日</div>
          </el-form-item>
          <el-form-item label="状态">
            <template v-if="isEdit">
              <el-select v-model="form.status" class="status-select">
                <el-option v-for="s in STATUSES" :key="s" :label="s" :value="s" />
              </el-select>
            </template>
            <template v-else>
              <div class="status-preview">
                <el-tag type="warning" effect="light" round>打开</el-tag>
                <span class="field-tip">新建问题默认打开</span>
              </div>
            </template>
          </el-form-item>
        </div>

        <template v-if="isEdit">
          <el-form-item label="解决方案">
            <el-input
              v-model="form.solution"
              type="textarea"
              :autosize="{ minRows: 2, maxRows: 6 }"
              maxlength="2000"
              show-word-limit
              placeholder="填写处理方案或进展说明（可留空）"
            />
          </el-form-item>
          <div class="form-row">
            <el-form-item label="受理人">
              <el-input v-model="form.assignee" maxlength="50" placeholder="填写受理人（可留空）" />
            </el-form-item>
            <el-form-item label="关闭时间">
              <el-date-picker
                v-model="form.closedAt"
                type="date"
                value-format="YYYY-MM-DD"
                format="YYYY-MM-DD"
                placeholder="关闭后自动记录"
                :disabled="form.status !== '已关闭'"
                class="close-date"
              />
              <div class="field-tip">状态改为「已关闭」时自动填写当天日期</div>
            </el-form-item>
          </div>
        </template>
      </el-form>
    </div>

    <template #footer>
      <div class="fb-footer">
        <div class="fb-footer-info">
          <template v-if="activeView === 'list'">
            <span>共 {{ issues.length }} 条</span>
            <span class="sep">·</span>
            <span>打开 {{ counts['打开'] || 0 }} 条</span>
            <span class="fb-path" :title="sharePath">{{ storage === 'remote' ? '共享盘' : '本地缓存' }}</span>
          </template>
          <template v-else>
            <span>{{ isEdit ? '保存后立即同步到共享盘' : '提交后自动记录创建时间并同步到共享盘' }}</span>
          </template>
        </div>
        <div class="fb-footer-actions">
          <template v-if="activeView === 'list'">
            <el-button @click="visible = false">关闭</el-button>
            <el-button type="primary" :icon="Plus" @click="openCreate">创建新问题</el-button>
          </template>
          <template v-else>
            <el-button @click="backToList">取消</el-button>
            <el-button type="primary" :loading="submitting" @click="submitForm">
              {{ isEdit ? '保存修改' : '提交问题' }}
            </el-button>
          </template>
        </div>
      </div>
    </template>
  </el-dialog>

  <!-- 管理密钥验证 -->
  <el-dialog
    v-model="adminDialogVisible"
    title="管理模式验证"
    width="420px"
    append-to-body
    :close-on-click-modal="false"
    @opened="focusAdminInput"
  >
    <div class="admin-body">
      <el-icon class="admin-icon"><Lock /></el-icon>
      <p class="admin-desc">输入管理密钥后可编辑或删除问题记录</p>
      <el-input
        ref="adminInputRef"
        v-model="adminKeyInput"
        type="password"
        show-password
        placeholder="请输入管理密钥"
        @input="adminError = ''"
        @keyup.enter="confirmAdmin"
      />
      <div v-if="adminError" class="admin-error">{{ adminError }}</div>
      <div class="admin-tip">密钥仅用于本机问题清单管理，不会写入反馈数据</div>
    </div>
    <template #footer>
      <el-button @click="adminDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="adminVerifying" @click="confirmAdmin">验证并进入</el-button>
    </template>
  </el-dialog>

  <!-- 问题详情 -->
  <el-dialog v-model="detailVisible" title="问题详情" width="680px" append-to-body>
    <div v-if="detailIssue" class="detail">
      <div class="detail-head">
        <span class="detail-id">{{ detailIssue.id }}</span>
        <el-tag :type="statusType(detailIssue.status)" effect="light" round>{{ detailIssue.status }}</el-tag>
      </div>
      <div class="detail-desc">{{ detailIssue.description }}</div>
      <div class="detail-grid">
        <div>
          <div class="detail-meta-label">汇报人</div>
          <div class="detail-meta-value">{{ detailIssue.reporter || '—' }}</div>
        </div>
        <div>
          <div class="detail-meta-label">需求来源</div>
          <div class="detail-meta-value">{{ detailIssue.source || '—' }}</div>
        </div>
        <div>
          <div class="detail-meta-label">创建时间</div>
          <div class="detail-meta-value">{{ detailIssue.createdAt || '—' }}</div>
        </div>
        <div>
          <div class="detail-meta-label">受理人</div>
          <div class="detail-meta-value">{{ detailIssue.assignee || '—' }}</div>
        </div>
        <div>
          <div class="detail-meta-label">关闭时间</div>
          <div class="detail-meta-value">{{ detailIssue.closedAt || '未关闭' }}</div>
        </div>
        <div>
          <div class="detail-meta-label">最后更新</div>
          <div class="detail-meta-value">{{ formatUpdated(detailIssue.updatedAt) }}</div>
        </div>
      </div>
      <div class="detail-block">
        <div class="detail-label">解决方案</div>
        <div class="detail-text">{{ detailIssue.solution || '暂无解决方案' }}</div>
      </div>
    </div>
    <template #footer>
      <el-button @click="detailVisible = false">关闭</el-button>
      <el-button v-if="adminUnlocked" type="primary" :icon="EditPen" @click="editFromDetail">编辑</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import {
  ArrowLeft,
  Calendar,
  ChatLineSquare,
  Delete,
  EditPen,
  Lock,
  Plus,
  Refresh,
  Search,
  Unlock,
} from '@element-plus/icons-vue'
import {
  createFeedbackIssue,
  deleteFeedbackIssue,
  getFeedbackIssues,
  updateFeedbackIssue,
  verifyFeedbackKey,
  type FeedbackIssue,
  type FeedbackStatus,
} from '@/api/feedback'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ (e: 'update:modelValue', value: boolean): void }>()

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

// ==================== 清单状态 ====================
const STATUSES: FeedbackStatus[] = ['打开', '处理中', '已解决', '已关闭']
const STATUS_FILTERS: Array<'全部' | FeedbackStatus> = ['全部', ...STATUSES]

const activeView = ref<'list' | 'create' | 'edit'>('list')
const issues = ref<FeedbackIssue[]>([])
const loading = ref(false)
const refreshing = ref(false)
const storage = ref<'remote' | 'local'>('remote')
const sharePath = ref('')
const query = ref('')
const statusFilter = ref<'全部' | FeedbackStatus>('全部')
const sortOrder = ref<'seq' | 'seqDesc' | 'desc' | 'asc'>('seqDesc')
const highlightId = ref('')

const counts = computed<Record<string, number>>(() => {
  const result: Record<string, number> = { 全部: issues.value.length }
  for (const s of STATUSES) result[s] = 0
  for (const issue of issues.value) {
    if (result[issue.status] !== undefined) result[issue.status] += 1
  }
  return result
})

const filtered = computed(() => {
  const keyword = query.value.trim().toLowerCase()
  let list = issues.value
  if (statusFilter.value !== '全部') {
    list = list.filter((item) => item.status === statusFilter.value)
  }
  if (keyword) {
    list = list.filter((item) =>
      [item.id, item.description, item.reporter, item.source, item.solution, item.assignee]
        .some((value) => String(value || '').toLowerCase().includes(keyword))
    )
  }
  return [...list].sort((a, b) => {
    if (sortOrder.value === 'seq' || sortOrder.value === 'seqDesc') {
      const sa = Number(a.seq) || 0
      const sb = Number(b.seq) || 0
      const desc = sortOrder.value === 'seqDesc'
      if (sa !== sb) {
        if (!sa) return desc ? -1 : 1 // 新建（无序号）：倒序时置顶，正序时排最后
        if (!sb) return desc ? 1 : -1
        return desc ? sb - sa : sa - sb
      }
    }
    const cmp =
      String(a.createdAt || '').localeCompare(String(b.createdAt || '')) ||
      String(a.id || '').localeCompare(String(b.id || ''))
    return sortOrder.value === 'asc' ? cmp : -cmp
  })
})

function statusType(status: FeedbackStatus): 'warning' | 'primary' | 'success' | 'info' {
  const map: Record<FeedbackStatus, 'warning' | 'primary' | 'success' | 'info'> = {
    打开: 'warning',
    处理中: 'primary',
    已解决: 'success',
    已关闭: 'info',
  }
  return map[status] || 'info'
}

function chipDotClass(label: string) {
  const map: Record<string, string> = {
    全部: 'dot-all',
    打开: 'dot-open',
    处理中: 'dot-doing',
    已解决: 'dot-done',
    已关闭: 'dot-closed',
  }
  return map[label] || 'dot-all'
}

function rowClassName({ row }: { row: FeedbackIssue }) {
  return row.id === highlightId.value ? 'fb-row-new' : ''
}

function formatUpdated(value?: string) {
  if (!value) return '—'
  return value.replace('T', ' ')
}

// ==================== 清单加载 ====================
let autoTimer: ReturnType<typeof setInterval> | null = null
let highlightTimer: ReturnType<typeof setTimeout> | null = null
const AUTO_REFRESH_MS = 45000

async function loadIssues(silent = false) {
  if (loading.value || refreshing.value) return
  if (silent) refreshing.value = true
  else loading.value = true
  try {
    const res: any = await getFeedbackIssues()
    const data = res?.data || {}
    issues.value = Array.isArray(data.issues) ? data.issues : []
    storage.value = data.storage === 'local' ? 'local' : 'remote'
    sharePath.value = data.path || ''
  } catch {
    // 错误提示由 axios 拦截器统一处理
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

function startAutoRefresh() {
  stopAutoRefresh()
  autoTimer = setInterval(() => {
    if (props.modelValue && activeView.value === 'list' && !adminDialogVisible.value) {
      loadIssues(true)
    }
  }, AUTO_REFRESH_MS)
}

function stopAutoRefresh() {
  if (autoTimer) {
    clearInterval(autoTimer)
    autoTimer = null
  }
}

// ==================== 表单 ====================
interface IssueForm {
  description: string
  reporter: string
  source: string
  status: FeedbackStatus
  solution: string
  assignee: string
  closedAt: string
  createdAt: string
}

const formRef = ref<FormInstance>()
const descInputRef = ref<any>(null)
const form = reactive<IssueForm>({
  description: '',
  reporter: '',
  source: '',
  status: '打开',
  solution: '',
  assignee: '',
  closedAt: '',
  createdAt: '',
})
const submitting = ref(false)
const editTarget = ref<FeedbackIssue | null>(null)
const isEdit = computed(() => activeView.value === 'edit')

const rules: FormRules = {
  description: [{ required: true, message: '请填写问题描述', trigger: 'blur' }],
  reporter: [{ required: true, message: '请填写汇报人', trigger: 'blur' }],
  source: [{ required: true, message: '请填写需求来源', trigger: 'blur' }],
}

function localToday() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function resetForm() {
  form.description = ''
  form.reporter = ''
  form.source = ''
  form.status = '打开'
  form.solution = ''
  form.assignee = ''
  form.closedAt = ''
  form.createdAt = localToday()
  editTarget.value = null
  nextTick(() => formRef.value?.clearValidate())
}

function openCreate() {
  resetForm()
  activeView.value = 'create'
  nextTick(() => descInputRef.value?.focus())
}

function openEdit(row: FeedbackIssue) {
  editTarget.value = row
  form.description = row.description
  form.reporter = row.reporter
  form.source = row.source
  form.status = row.status
  form.solution = row.solution
  form.assignee = row.assignee
  form.closedAt = row.closedAt
  form.createdAt = row.createdAt
  activeView.value = 'edit'
  nextTick(() => formRef.value?.clearValidate())
}

function backToList() {
  activeView.value = 'list'
  resetForm()
}

async function submitForm() {
  if (submitting.value) return
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    if (isEdit.value && editTarget.value) {
      const res: any = await updateFeedbackIssue(editTarget.value.id, adminKey.value, {
        description: form.description.trim(),
        reporter: form.reporter.trim(),
        source: form.source.trim(),
        status: form.status,
        solution: form.solution.trim(),
        assignee: form.assignee.trim(),
        closedAt: form.closedAt || '',
      })
      const updated = res?.data?.issue
      if (updated) upsertIssue(updated)
      storage.value = 'remote'
      ElMessage.success(res?.message || '问题已更新')
      activeView.value = 'list'
      resetForm()
    } else {
      const res: any = await createFeedbackIssue({
        description: form.description.trim(),
        reporter: form.reporter.trim(),
        source: form.source.trim(),
      })
      const issue = res?.data?.issue
      if (issue) {
        issues.value.unshift(issue)
        highlightId.value = issue.id
        if (highlightTimer) clearTimeout(highlightTimer)
        highlightTimer = setTimeout(() => { highlightId.value = '' }, 4000)
      }
      storage.value = 'remote'
      ElMessage.success(res?.message || '问题提交成功')
      activeView.value = 'list'
      resetForm()
    }
  } catch (e: any) {
    // 403：密钥失效，退回管理模式，错误提示由拦截器给出
    if (e?.response?.status === 403) lockAdmin(true)
  } finally {
    submitting.value = false
  }
}

function upsertIssue(issue: FeedbackIssue) {
  const index = issues.value.findIndex((item) => item.id === issue.id)
  if (index >= 0) issues.value.splice(index, 1, issue)
  else issues.value.unshift(issue)
}

// 状态联动：切到「已关闭」自动补当天，切回其它状态清空关闭时间
watch(() => form.status, (status, oldStatus) => {
  if (!isEdit.value || status === oldStatus) return
  if (status === '已关闭') {
    if (!form.closedAt) form.closedAt = localToday()
  } else {
    form.closedAt = ''
  }
})

// ==================== 详情 ====================
const detailVisible = ref(false)
const detailIssue = ref<FeedbackIssue | null>(null)

function openDetail(row: FeedbackIssue) {
  detailIssue.value = row
  detailVisible.value = true
}

function editFromDetail() {
  if (!detailIssue.value) return
  const row = detailIssue.value
  detailVisible.value = false
  openEdit(row)
}

// ==================== 管理密钥 ====================
const adminUnlocked = ref(false)
const adminKey = ref('')
const adminDialogVisible = ref(false)
const adminKeyInput = ref('')
const adminVerifying = ref(false)
const adminError = ref('')
const adminInputRef = ref<any>(null)

function openAdmin() {
  adminError.value = ''
  adminKeyInput.value = ''
  adminDialogVisible.value = true
}

function focusAdminInput() {
  nextTick(() => adminInputRef.value?.focus())
}

async function confirmAdmin() {
  const key = adminKeyInput.value.trim()
  if (!key) {
    adminError.value = '请输入管理密钥'
    return
  }
  if (adminVerifying.value) return
  adminVerifying.value = true
  try {
    const res: any = await verifyFeedbackKey(key)
    if (res?.data?.valid) {
      adminKey.value = key
      adminUnlocked.value = true
      adminDialogVisible.value = false
      adminKeyInput.value = ''
      adminError.value = ''
      ElMessage.success('管理模式已开启')
    } else {
      adminError.value = '密钥不正确，请重试'
      adminKeyInput.value = ''
      focusAdminInput()
    }
  } catch {
    adminError.value = '验证失败，请稍后重试'
  } finally {
    adminVerifying.value = false
  }
}

function lockAdmin(silent = false) {
  adminUnlocked.value = false
  adminKey.value = ''
  if (!silent) ElMessage.info('已退出管理模式')
}

// ==================== 删除 ====================
async function removeIssue(row: FeedbackIssue) {
  try {
    await ElMessageBox.confirm(
      `确认删除「${row.id}」？删除后不可恢复。`,
      '删除问题',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  try {
    const res: any = await deleteFeedbackIssue(row.id, adminKey.value)
    issues.value = issues.value.filter((item) => item.id !== row.id)
    if (detailIssue.value?.id === row.id) detailVisible.value = false
    storage.value = 'remote'
    ElMessage.success(res?.message || '问题已删除')
  } catch (e: any) {
    if (e?.response?.status === 403) lockAdmin(true)
  }
}

// ==================== 生命周期 ====================
watch(() => props.modelValue, (open) => {
  if (open) {
    activeView.value = 'list'
    detailVisible.value = false
    adminDialogVisible.value = false
    adminUnlocked.value = false
    adminKey.value = ''
    adminKeyInput.value = ''
    adminError.value = ''
    highlightId.value = ''
    resetForm()
    loadIssues()
    startAutoRefresh()
  } else {
    stopAutoRefresh()
    lockAdmin(true)
  }
}, { immediate: true })

function onDialogClosed() {
  stopAutoRefresh()
  lockAdmin(true)
  detailVisible.value = false
  adminDialogVisible.value = false
  adminKeyInput.value = ''
  adminError.value = ''
  resetForm()
  activeView.value = 'list'
}

// 表单填写中直接关闭时提醒，避免辛苦填的内容被误丢弃
function handleBeforeClose(done: () => void) {
  if (activeView.value === 'list' || submitting.value) {
    done()
    return
  }
  const dirty = [
    form.description,
    form.reporter,
    form.source,
    form.solution,
    form.assignee,
  ].some((value) => value.trim())
  if (!dirty) {
    done()
    return
  }
  ElMessageBox.confirm(
    '当前填写内容尚未提交，确认关闭问题反馈？',
    '未提交的内容',
    { type: 'warning', confirmButtonText: '关闭并放弃', cancelButtonText: '继续填写' }
  ).then(() => done()).catch(() => {})
}

onBeforeUnmount(() => {
  stopAutoRefresh()
  if (highlightTimer) clearTimeout(highlightTimer)
})
</script>

<style scoped lang="scss">
/* ---------- 头部 ---------- */
.fb-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-right: 34px;
}

.fb-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.fb-logo {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  font-size: 20px;
  color: #fff;
  background: linear-gradient(135deg, var(--el-color-primary), #36cfc9);
  box-shadow: 0 6px 16px rgba(24, 144, 255, 0.25);
  flex-shrink: 0;
}

.fb-title {
  font-size: 17px;
  font-weight: 600;
  line-height: 1.3;
  color: var(--text-primary);
}

.fb-sub {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.4;
}

/* ---------- 工具条 ---------- */
.fb-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.fb-status-chips {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.fb-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 11px;
  border: 1px solid var(--border-color-light);
  border-radius: 999px;
  background: var(--bg-card);
  color: var(--text-regular);
  font-size: 12px;
  line-height: 1.4;
  cursor: pointer;
  transition: var(--transition-base);

  &:hover {
    border-color: var(--el-color-primary-light-5);
    color: var(--color-primary);
  }

  &.active {
    background: var(--el-color-primary-light-9);
    border-color: var(--el-color-primary-light-5);
    color: var(--color-primary);
    font-weight: 600;
  }

  .num {
    color: var(--text-secondary);
    font-variant-numeric: tabular-nums;
  }

  &.active .num {
    color: var(--color-primary);
  }

  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--text-placeholder);
    flex-shrink: 0;
  }
}

.dot-all { background: var(--color-primary); }
.dot-open { background: var(--color-warning); }
.dot-doing { background: var(--el-color-primary); }
.dot-done { background: var(--color-success); }
.dot-closed { background: var(--color-info); }

.fb-tools-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
}

.fb-search {
  width: 220px;
}

.fb-sort {
  width: 108px;
}

.fb-alert {
  margin-bottom: 10px;
}

/* ---------- 表格 ---------- */
.fb-table {
  width: 100%;
  border-radius: 8px;
  overflow: hidden;

  :deep(.el-table__header th) {
    background: var(--bg-page);
    color: var(--text-secondary);
    font-weight: 600;
  }

  :deep(.el-table__row) {
    cursor: pointer;
  }

  :deep(.fb-row-new td) {
    background: var(--el-color-warning-light-9);
  }
}

.cell-empty {
  color: var(--text-placeholder);
}

.row-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

/* ---------- 表单视图 ---------- */
.fb-view-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 14px;
  padding-bottom: 10px;
  border-bottom: 1px dashed var(--border-color-light);
}

.fb-view-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.fb-view-sub {
  font-size: 12px;
  color: var(--text-secondary);
}

.fb-form {
  padding: 0 2px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 16px;
}

.field-tip {
  font-size: 11px;
  color: var(--text-secondary);
  line-height: 1.5;
  margin-top: 2px;
}

.status-preview {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 32px;

  .field-tip {
    margin-top: 0;
  }
}

.status-select,
.close-date {
  width: 100%;
}

/* ---------- 底部 ---------- */
.fb-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.fb-footer-info {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 12px;
  color: var(--text-secondary);

  .sep {
    color: var(--text-placeholder);
  }
}

.fb-path {
  margin-left: 4px;
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--bg-page);
  color: var(--text-placeholder);
  font-size: 11px;
  max-width: 420px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fb-footer-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

/* ---------- 管理密钥 ---------- */
.admin-body {
  text-align: center;
  padding: 2px 8px 0;
}

.admin-icon {
  width: 48px;
  height: 48px;
  margin: 0 auto 10px;
  display: grid;
  place-items: center;
  font-size: 22px;
  color: var(--color-primary);
  border-radius: 50%;
  background: var(--el-color-primary-light-9);
}

.admin-desc {
  font-size: 13px;
  color: var(--text-regular);
  margin-bottom: 14px;
}

.admin-error {
  margin-top: 8px;
  font-size: 12px;
  color: var(--color-error);
  text-align: left;
}

.admin-tip {
  margin-top: 10px;
  font-size: 11px;
  color: var(--text-secondary);
}

/* ---------- 详情 ---------- */
.detail-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.detail-id {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

.detail-desc {
  margin-top: 12px;
  padding: 12px 14px;
  border-radius: 8px;
  background: var(--bg-page);
  font-size: 14px;
  line-height: 1.7;
  color: var(--text-primary);
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 220px;
  overflow-y: auto;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px 16px;
  margin: 14px 0;
  padding: 12px;
  border: 1px solid var(--border-color-light);
  border-radius: 8px;
}

.detail-meta-label {
  font-size: 11px;
  color: var(--text-secondary);
  margin-bottom: 2px;
}

.detail-meta-value {
  font-size: 13px;
  color: var(--text-primary);
  word-break: break-word;
}

.detail-block {
  margin-top: 4px;
}

.detail-label {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.detail-text {
  font-size: 13px;
  line-height: 1.7;
  color: var(--text-regular);
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 180px;
  overflow-y: auto;
}
</style>

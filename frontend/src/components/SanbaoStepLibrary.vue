<template>
  <div class="sanbao-step-library">
    <div class="library-header">
      <span class="library-title">步骤库</span>
      <el-button type="primary" size="small" :icon="Plus" @click="onCreate">新建步骤</el-button>
    </div>
    <div class="library-tip">拖拽卡片到中间序列框，循环可容纳子步骤</div>

    <div class="step-list">
      <!-- 内置：循环容器 -->
      <div
        class="step-card step-card-loop"
        draggable="true"
        @dragstart="onLoopDragStart"
      >
        <div class="step-card-head">
          <el-icon class="loop-icon"><Refresh /></el-icon>
          <span class="step-card-name">循环</span>
        </div>
        <div class="step-card-desc">循环 N 次，可容纳多个子步骤</div>
      </div>

      <!-- 自定义步骤 -->
      <div
        v-for="step in steps"
        :key="step.id"
        class="step-card"
        draggable="true"
        @dragstart="onDragStart($event, step)"
        @dblclick="onEdit(step)"
      >
        <div class="step-card-head">
          <span class="step-card-name">{{ step.name }}</span>
          <div class="step-card-actions">
            <el-button text size="small" :icon="Edit" @click.stop="onEdit(step)" />
            <el-button text size="small" :icon="Delete" @click.stop="onDelete(step.id)" />
          </div>
        </div>
        <div class="step-card-params" v-if="step.params.length">
          <el-tag v-for="p in step.params" :key="p" size="small" type="info">{{ p }}</el-tag>
        </div>
      </div>
      <div v-if="!steps.length" class="empty-tip">暂无自定义步骤，点击"新建步骤"创建</div>
    </div>

    <!-- 新建/编辑对话框 -->
    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑步骤' : '新建步骤'" width="640px" append-to-body>
      <el-form label-width="80px">
        <el-form-item label="步骤名">
          <el-input v-model="form.name" placeholder="如：设置信号" />
        </el-form-item>
        <el-form-item label="CAPL 代码">
          <el-input
            v-model="form.code"
            type="textarea"
            :autosize="{ minRows: 6, maxRows: 16 }"
            placeholder="输入 CAPL 代码段，用 {{参数名}} 标记参数占位符，例如：&#10;setSignal({{signal}}, {{value}});"
          />
        </el-form-item>
        <el-form-item label="参数">
          <div class="param-tags">
            <el-tag v-for="p in formParams" :key="p" size="small" type="success">{{ p }}</el-tag>
            <span v-if="!formParams.length" class="empty-param">代码中无 {{ paramPlaceholder }} 占位符</span>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="onSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Plus, Edit, Delete, Refresh } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'

/** 自定义步骤定义（CAPL 代码模板 + 参数占位符） */
export interface CustomStep {
  id: string
  name: string
  code: string
  params: string[]
}

const props = defineProps<{ steps: CustomStep[] }>()
const emit = defineEmits<{ 'update:steps': [CustomStep[]] }>()

const PLACEHOLDER_RE = /\{\{\s*(\w+)\s*\}\}/g
const paramPlaceholder = '{{参数名}}'

/** 从 CAPL 代码中提取占位符参数名（去重保序） */
function extractParams(code: string): string[] {
  const seen: string[] = []
  let m: RegExpExecArray | null
  PLACEHOLDER_RE.lastIndex = 0
  while ((m = PLACEHOLDER_RE.exec(code)) !== null) {
    if (!seen.includes(m[1])) seen.push(m[1])
  }
  return seen
}

const dialogVisible = ref(false)
const editingId = ref('')
const form = ref({ name: '', code: '' })

const formParams = computed(() => extractParams(form.value.code))

function genId() {
  return 'cs-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7)
}

function onCreate() {
  editingId.value = ''
  form.value = { name: '', code: '' }
  dialogVisible.value = true
}

function onEdit(step: CustomStep) {
  editingId.value = step.id
  form.value = { name: step.name, code: step.code }
  dialogVisible.value = true
}

function onSave() {
  if (!form.value.name.trim()) {
    ElMessage.warning('请输入步骤名')
    return
  }
  if (!form.value.code.trim()) {
    ElMessage.warning('请输入 CAPL 代码')
    return
  }
  const params = extractParams(form.value.code)
  const list = [...props.steps]
  if (editingId.value) {
    const idx = list.findIndex((s) => s.id === editingId.value)
    if (idx >= 0) {
      list[idx] = { id: editingId.value, name: form.value.name.trim(), code: form.value.code, params }
    }
  } else {
    list.push({ id: genId(), name: form.value.name.trim(), code: form.value.code, params })
  }
  emit('update:steps', list)
  dialogVisible.value = false
  ElMessage.success(editingId.value ? '已更新' : '已创建')
}

function onDelete(id: string) {
  ElMessageBox.confirm('确认删除该自定义步骤？', '提示', { type: 'warning' })
    .then(() => {
      emit('update:steps', props.steps.filter((s) => s.id !== id))
      ElMessage.success('已删除')
    })
    .catch(() => {})
}

/** 拖拽自定义步骤卡片到序列框 */
function onDragStart(event: DragEvent, step: CustomStep) {
  if (!event.dataTransfer) return
  event.dataTransfer.effectAllowed = 'copy'
  const payload = {
    type: 'custom-step',
    id: step.id,
    name: step.name,
    code: step.code,
    params: step.params,
  }
  event.dataTransfer.setData('application/json', JSON.stringify(payload))
  event.dataTransfer.setData('text/plain', step.name)
}

/** 拖拽内置循环卡片 */
function onLoopDragStart(event: DragEvent) {
  if (!event.dataTransfer) return
  event.dataTransfer.effectAllowed = 'copy'
  const payload = { type: 'loop' }
  event.dataTransfer.setData('application/json', JSON.stringify(payload))
  event.dataTransfer.setData('text/plain', '循环')
}
</script>

<style scoped lang="scss">
.sanbao-step-library {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-card);
  border-radius: 12px;
  padding: 12px;
  overflow: hidden;
}

.library-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.library-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.library-tip {
  font-size: 11px;
  color: var(--text-color-secondary);
  margin-bottom: 10px;
  padding-left: 2px;
}

.step-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.step-card {
  background: var(--bg-page);
  border: 1px solid var(--border-color-light);
  border-radius: 8px;
  padding: 10px;
  cursor: grab;
  transition: border-color 0.2s, box-shadow 0.2s;

  &:hover {
    border-color: var(--color-primary);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }

  &:active {
    cursor: grabbing;
  }
}

.step-card-loop {
  border-style: dashed;
  border-color: var(--color-success);
  background: rgba(103, 194, 58, 0.04);
}

.step-card-head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.loop-icon {
  color: var(--color-success);
  font-size: 14px;
}

.step-card-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  flex: 1;
}

.step-card-actions {
  display: flex;
  gap: 2px;
}

.step-card-desc {
  font-size: 11px;
  color: var(--text-color-secondary);
}

.step-card-params {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.empty-tip {
  text-align: center;
  color: var(--text-color-secondary);
  font-size: 12px;
  padding: 24px 0;
}

.param-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}

.empty-param {
  font-size: 12px;
  color: var(--text-color-secondary);
}
</style>

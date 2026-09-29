<template>
  <div class="signal-manager">
    <div class="sm-head">
      <span>全局信号列表</span>
      <el-tag size="small" type="info">{{ signalPool.length }}</el-tag>
      <el-button size="small" :icon="Plus" text type="primary" @click="addSignal" title="新增信号" />
    </div>
    <div class="sm-tip">修改信号值后，所有用例中引用该信号的步骤会自动更新</div>

    <!-- 搜索 -->
    <el-input v-model="filter" size="small" placeholder="搜索信号名" clearable class="sm-filter">
      <template #prefix><el-icon><Search /></el-icon></template>
    </el-input>

    <!-- 信号列表 -->
    <div class="sm-list">
      <div v-for="sig in filteredSignals" :key="sig.name" class="sig-row">
        <span class="sig-n" :title="sig.name">{{ sig.name }}</span>
        <el-input
          v-model="sig.value"
          size="small"
          class="sig-v-input"
          @change="onSignalChange(sig.name, sig.value)"
        />
        <el-tag v-if="sig.usageCount > 1" size="small" type="warning" effect="plain" title="被多少步骤引用">
          ×{{ sig.usageCount }}
        </el-tag>
        <el-icon class="sig-del" @click="removeSignal(sig.name)"><Close /></el-icon>
      </div>
      <div v-if="!filteredSignals.length" class="sm-empty">
        {{ signalPool.length ? '无匹配信号' : '暂无信号，用例中的信号会自动收集到这里' }}
      </div>
    </div>

    <!-- 新增信号弹窗 -->
    <el-dialog v-model="addDialog" title="新增信号" width="360px" append-to-body>
      <el-form label-width="60px">
        <el-form-item label="信号名">
          <el-input v-model="newName" placeholder="如 EPS_SteerAngle" />
        </el-form-item>
        <el-form-item label="默认值">
          <el-input v-model="newValue" placeholder="如 0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addDialog = false">取消</el-button>
        <el-button type="primary" @click="confirmAdd">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * 信号管理：全局信号池
 * - 自动从所有用例的步骤中收集信号名
 * - 修改信号值后同步更新所有用例
 */
import { ref, computed, watch } from 'vue'
import { ElInput, ElButton, ElIcon, ElTag, ElDialog, ElForm, ElFormItem, ElMessage } from 'element-plus'
import { Plus, Close, Search } from '@element-plus/icons-vue'

interface CaseData {
  case_id: string
  steps?: Array<Record<string, any>>
}
interface SignalEntry {
  name: string
  value: string
  unit?: string
  usageCount: number
}

const props = defineProps<{ cases: CaseData[] }>()
const emit = defineEmits<{
  (e: 'update-signal', signalName: string, newValue: string): void
}>()

const filter = ref('')
const addDialog = ref(false)
const newName = ref('')
const newValue = ref('')

/** 自定义新增的信号（不在用例中出现的） */
const customSignals = ref<Map<string, string>>(new Map())

/** 信号池：从用例收集 + 自定义 */
const signalPool = computed<SignalEntry[]>(() => {
  const map = new Map<string, SignalEntry>()
  // 从所有用例步骤收集
  for (const c of props.cases) {
    const steps = c.steps || []
    for (const s of steps) {
      const sigs = s.signals || {}
      for (const [k, v] of Object.entries(sigs)) {
        if (!map.has(k)) {
          map.set(k, { name: k, value: String(v), usageCount: 1 })
        } else {
          map.get(k)!.usageCount++
        }
      }
    }
  }
  // 合并自定义信号
  for (const [k, v] of customSignals.value) {
    if (!map.has(k)) {
      map.set(k, { name: k, value: v, usageCount: 0 })
    }
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
})

const filteredSignals = computed(() => {
  const k = filter.value.trim().toLowerCase()
  if (!k) return signalPool.value
  return signalPool.value.filter((s) => s.name.toLowerCase().includes(k))
})

/** 信号值变更：通知父组件更新所有用例 */
function onSignalChange(name: string, value: string) {
  customSignals.value.set(name, value)
  emit('update-signal', name, value)
}

function addSignal() {
  newName.value = ''
  newValue.value = ''
  addDialog.value = true
}
function confirmAdd() {
  const name = newName.value.trim()
  if (!name) {
    ElMessage.warning('请输入信号名')
    return
  }
  if (signalPool.value.find((s) => s.name === name)) {
    ElMessage.warning('信号已存在')
    return
  }
  customSignals.value.set(name, newValue.value)
  emit('update-signal', name, newValue.value)
  ElMessage.success(`已新增信号 ${name}`)
  addDialog.value = false
}

function removeSignal(name: string) {
  customSignals.value.delete(name)
  // 不从用例中删除信号引用（信号来自用例本身），只删除自定义的
  ElMessage.info(`已移除自定义信号 ${name}（用例中引用的信号仍保留）`)
}
</script>

<style scoped>
.signal-manager {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 8px;
}
.sm-head {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 4px;
}
.sm-tip {
  font-size: 11px;
  color: #909399;
  margin-bottom: 8px;
}
.sm-filter { margin-bottom: 8px; }
.sm-list {
  flex: 1;
  overflow-y: auto;
}
.sig-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  border-bottom: 1px solid #f5f7fa;
}
.sig-row:hover { background: #f9fafc; }
.sig-n {
  flex: 1;
  font-size: 12px;
  font-family: 'Consolas', 'Monaco', monospace;
  color: var(--el-color-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sig-v-input { width: 100px; }
.sig-del {
  cursor: pointer;
  color: #c0c4cc;
  font-size: 14px;
}
.sig-del:hover { color: #f56c6c; }
.sm-empty {
  color: #c0c4cc;
  font-size: 12px;
  padding: 20px;
  text-align: center;
}
</style>

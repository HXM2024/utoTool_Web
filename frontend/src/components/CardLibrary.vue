<template>
  <div class="card-library" :class="`lib-${cardType}`">
    <!-- 标题栏 -->
    <div class="lib-header">
      <span class="lib-icon" :style="{ background: accentColor }">
        <el-icon><component :is="iconComp" /></el-icon>
      </span>
      <span class="lib-title">{{ title }}</span>
      <el-tag size="small" type="info" effect="plain">{{ filteredCards.length }}</el-tag>
      <el-button size="small" :icon="Plus" text @click="openEditor()" title="新建卡片" />
    </div>

    <!-- 搜索框 -->
    <div class="lib-search">
      <el-input
        v-model="searchKey"
        size="small"
        :placeholder="`搜索${title}`"
        clearable
      >
        <template #prefix><el-icon><Search /></el-icon></template>
      </el-input>
    </div>

    <!-- 卡片列表 -->
    <div class="lib-body">
      <div
        v-for="card in filteredCards"
        :key="card.id"
        class="lib-card"
        draggable="true"
        @dragstart="onDragStart($event, card)"
        @dblclick="openEditor(card)"
      >
        <div class="card-head">
          <span class="card-name" :title="card.description || card.name">{{ card.name }}</span>
          <el-icon class="card-edit" @click.stop="openEditor(card)"><Edit /></el-icon>
          <el-icon class="card-del" @click.stop="removeCard(card.id)"><Close /></el-icon>
        </div>
        <pre v-if="card.code" class="card-code">{{ card.code }}</pre>
      </div>
      <div v-if="!filteredCards.length" class="lib-empty">
        {{ searchKey ? `无匹配「${searchKey}」` : `暂无${title}卡片，点击 + 新建` }}
      </div>
    </div>

    <!-- 卡片编辑弹窗 -->
    <el-dialog
      v-model="editorVisible"
      :title="editingCard?.id ? `编辑${title}` : `新建${title}`"
      width="560px"
      append-to-body
    >
      <el-form :model="editingCard" label-width="80px" size="small">
        <el-form-item label="名称">
          <el-input v-model="editingCard.name" placeholder="卡片名称（如：设置信号值）" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="editingCard.description" placeholder="可选，卡片用途说明" />
        </el-form-item>
        <el-form-item label="代码模板">
          <el-input
            v-model="editingCard.code"
            type="textarea"
            :rows="6"
            placeholder="CAPL 代码模板，用 {{param}} 标记参数，如：${{signal}} = {{value}};"
            spellcheck="false"
          />
        </el-form-item>
        <el-form-item v-if="extractedParams.length" label="参数">
          <div class="param-list">
            <el-tag v-for="p in extractedParams" :key="p" size="small" type="info" effect="plain">
              {{ p }}
            </el-tag>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editorVisible = false">取消</el-button>
        <el-button type="primary" @click="saveCard">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * 通用卡片库组件，左栏（故障注入）和右栏（结果）共用。
 * - 支持新建/编辑/删除卡片
 * - 拖拽卡片设置 application/x-inject-card 或 application/x-result-card
 * - 代码模板自动提取 {{param}} 占位符
 * - 通过 v-model 双向绑定 cards 数组，父组件统一持久化
 */
import { ref, computed } from 'vue'
import { ElDialog, ElForm, ElFormItem, ElInput, ElTag, ElButton, ElIcon, ElMessage } from 'element-plus'
import { Plus, Search, Edit, Close, Lightning, CircleCheck } from '@element-plus/icons-vue'
import type { LibraryCard } from '@/api/function'

const props = defineProps<{
  /** 卡片类型：inject（故障注入）/ result（结果） */
  cardType: 'inject' | 'result'
  /** 标题 */
  title: string
  /** 卡片列表（v-model） */
  cards: LibraryCard[]
}>()
const emit = defineEmits<{
  (e: 'update:cards', cards: LibraryCard[]): void
}>()

const accentColor = computed(() =>
  props.cardType === 'inject' ? '#e6a23c' : '#67c23a',
)
const iconComp = computed(() =>
  props.cardType === 'inject' ? Lightning : CircleCheck,
)

/** 拖拽数据 MIME 类型 */
const dragMime = computed(() =>
  props.cardType === 'inject'
    ? 'application/x-inject-card'
    : 'application/x-result-card',
)

// ===== 搜索 =====
const searchKey = ref('')
const filteredCards = computed(() => {
  const k = searchKey.value.trim().toLowerCase()
  if (!k) return props.cards
  return props.cards.filter(
    (c) => c.name.toLowerCase().includes(k) || (c.description || '').toLowerCase().includes(k),
  )
})

// ===== 拖拽 =====
function onDragStart(event: DragEvent, card: LibraryCard) {
  if (!event.dataTransfer) return
  event.dataTransfer.effectAllowed = 'copy'
  event.dataTransfer.setData(dragMime.value, JSON.stringify(card))
  event.dataTransfer.setData('text/plain', card.name)
}

// ===== 编辑器 =====
const editorVisible = ref(false)
const editingCard = ref<LibraryCard>({ id: '', name: '', code: '', description: '' })

/** 从代码模板提取 {{param}} 占位符 */
const extractedParams = computed(() => {
  const re = /\{\{(\w+)\}\}/g
  const set = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = re.exec(editingCard.value.code || '')) !== null) {
    set.add(m[1])
  }
  return Array.from(set)
})

function openEditor(card?: LibraryCard) {
  if (card) {
    editingCard.value = { ...card }
  } else {
    editingCard.value = {
      id: `${props.cardType}_${Date.now().toString(36)}`,
      name: '',
      code: '',
      description: '',
    }
  }
  editorVisible.value = true
}

function saveCard() {
  if (!editingCard.value.name.trim()) {
    ElMessage.warning('请输入卡片名称')
    return
  }
  const idx = props.cards.findIndex((c) => c.id === editingCard.value.id)
  const updated = [...props.cards]
  if (idx >= 0) {
    updated[idx] = { ...editingCard.value }
  } else {
    updated.push({ ...editingCard.value })
  }
  emit('update:cards', updated)
  editorVisible.value = false
  ElMessage.success(idx >= 0 ? '卡片已更新' : '卡片已新建')
}

function removeCard(id: string) {
  const updated = props.cards.filter((c) => c.id !== id)
  emit('update:cards', updated)
  ElMessage.success('卡片已删除')
}
</script>

<style scoped>
.card-library {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #fff;
  overflow: hidden;
}

.lib-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-bottom: 1px solid #ebeef5;
  flex-shrink: 0;
}
.lib-icon {
  width: 22px;
  height: 22px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 13px;
}
.lib-title {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  flex: 1;
}
.lib-header .el-button { margin-left: auto; }

.lib-search {
  padding: 6px 10px;
  border-bottom: 1px solid #f0f2f5;
  flex-shrink: 0;
}

.lib-body {
  flex: 1;
  overflow-y: auto;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.lib-card {
  border: 1px solid #ebeef5;
  border-radius: 6px;
  padding: 6px 8px;
  cursor: grab;
  background: #fff;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.lib-card:hover {
  border-color: v-bind('accentColor');
  box-shadow: 0 1px 6px rgba(0,0,0,0.08);
}
.lib-card:active { cursor: grabbing; }

.lib-inject .lib-card { border-left: 3px solid #e6a23c; }
.lib-result .lib-card { border-left: 3px solid #67c23a; }

.card-head {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 4px;
}
.card-name {
  flex: 1;
  font-size: 12px;
  font-weight: 600;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.card-edit, .card-del {
  cursor: pointer;
  color: #c0c4cc;
  font-size: 12px;
  flex-shrink: 0;
}
.card-edit:hover { color: var(--el-color-primary); }
.card-del:hover { color: #f56c6c; }

.card-code {
  font-size: 10px;
  color: #909399;
  font-family: 'Consolas', 'Monaco', monospace;
  background: #f5f7fa;
  padding: 3px 5px;
  border-radius: 3px;
  margin: 0;
  max-height: 50px;
  overflow: hidden;
  white-space: pre-wrap;
  word-break: break-all;
}

.lib-empty {
  color: #c0c4cc;
  font-size: 11px;
  text-align: center;
  padding: 20px 4px;
  line-height: 1.6;
}

.param-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
</style>

<template>
  <div class="node-inspector">
    <div class="ni-header">
      <span class="ni-title">节点参数</span>
    </div>
    <div v-if="!node" class="ni-empty">在画布中选择一个组节点以编辑其卡片与参数</div>
    <template v-else>
      <div class="ni-meta">
        <el-tag size="small" :type="laneTagType">{{ CARD_TYPE_LABEL[node.lane] }}</el-tag>
        <el-select v-model="node.fanout" size="small" style="width: 90px" @change="onFanoutChange">
          <el-option label="单口" value="single" />
          <el-option label="多口" value="multi" />
        </el-select>
        <el-button size="small" :icon="Plus" type="primary" text @click="addCard">添加卡片</el-button>
      </div>

      <div class="ni-cards">
        <div v-for="card in node.cards" :key="card.id" class="ni-card">
          <div class="ni-card-head">
            <span class="ni-card-name">{{ card.name || '(未命名)' }}</span>
            <el-icon class="ni-edit" @click="editCard(card)"><Edit /></el-icon>
            <el-icon class="ni-del" @click="removeCard(card.id)"><Close /></el-icon>
          </div>
          <div v-for="s in card.steps" :key="s.id" class="ni-step">
            <span class="ni-step-kind">{{ STEP_KIND_LABEL[s.kind] }}</span>
            <span v-if="s.fun" class="ni-step-fun">{{ s.fun }}</span>
            <span v-if="s.raw" class="ni-step-raw">{{ s.raw }}</span>
            <div v-if="s.args && s.args.length" class="ni-args">
              <span v-for="(a, ai) in s.args" :key="ai" class="ni-arg">
                {{ a.key }}:
                <el-input
                  :model-value="a.value"
                  size="small"
                  style="width: 120px"
                  @change="(v: string) => onArgChange(card.id, s.id, ai, v)"
                />
              </span>
            </div>
          </div>
        </div>
      </div>

      <div class="ni-aliases">
        <div class="ni-sub">映射别名</div>
        <div class="ni-alias-list">
          <el-tag v-for="al in aliases" :key="al" size="small" type="info" effect="plain">{{ al }}</el-tag>
          <span v-if="!aliases.length" class="ni-no-alias">暂无别名，请在「对象映射」中新增</span>
        </div>
      </div>
    </template>

    <CardEditor
      ref="cardEditorRef"
      :visible="cardEditorVisible"
      :card="editingCard"
      @update:visible="cardEditorVisible = $event"
      @save="saveCard"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Plus, Edit, Close } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import type { Card, CardType, GroupNode, ObjectMapping } from '@/types/functionGraph'
import { CARD_TYPE_LABEL, STEP_KIND_LABEL, newCard } from '@/utils/functionGraph'
import CardEditor from './CardEditor.vue'

const props = defineProps<{
  node: GroupNode | null
  mapping: ObjectMapping
}>()
const emit = defineEmits<{
  (e: 'update:node', node: GroupNode): void
}>()

const aliases = computed<string[]>(() => {
  const out: string[] = []
  for (const bucket of ['signals', 'dtcs', 'messages', 'envvars', 'a2l'] as const) {
    for (const e of props.mapping[bucket]) out.push(e.alias)
  }
  return out
})

const laneTagType = computed(() => {
  const map: Record<CardType, 'warning' | 'primary' | 'success'> = {
    inject: 'warning',
    sequence: 'primary',
    result: 'success',
  }
  return map[props.node?.lane || 'sequence']
})

function patchNode(mutator: (n: GroupNode) => void) {
  if (!props.node) return
  const node = JSON.parse(JSON.stringify(props.node))
  mutator(node)
  emit('update:node', node)
}

function onFanoutChange() {
  emit('update:node', JSON.parse(JSON.stringify(props.node!)))
}
function addCard() {
  patchNode((n) => n.cards.push(newCard(n.lane)))
}
function removeCard(cardId: string) {
  patchNode((n) => (n.cards = n.cards.filter((c) => c.id !== cardId)))
  ElMessage.success('已删除卡片')
}
function onArgChange(cardId: string, stepId: string, argIdx: number, value: string) {
  patchNode((n) => {
    const card = n.cards.find((c) => c.id === cardId)
    const step = card?.steps.find((s) => s.id === stepId)
    if (step && step.args[argIdx]) step.args[argIdx].value = value
  })
}

const cardEditorVisible = ref(false)
const editingCard = ref<Card | null>(null)
/** 卡片编辑器实例：切换编辑对象前用它做「有未保存修改 → 提示保存」的守卫 */
const cardEditorRef = ref<InstanceType<typeof CardEditor> | null>(null)
/** 切换卡片前先过守卫：选保存且保存成功才切过去（取消/失败则留在当前卡片） */
async function editCard(card: Card) {
  if (cardEditorVisible.value && cardEditorRef.value) {
    const ok = await cardEditorRef.value.confirmBeforeSwitch()
    if (!ok) return
  }
  editingCard.value = JSON.parse(JSON.stringify(card))
  cardEditorVisible.value = true
}
function saveCard(card: Card) {
  patchNode((n) => {
    const idx = n.cards.findIndex((c) => c.id === card.id)
    if (idx >= 0) n.cards[idx] = card
    else n.cards.push(card)
  })
  ElMessage.success('卡片已更新')
}
</script>

<style scoped>
.node-inspector {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}
.ni-header {
  padding: 8px 10px;
  border-bottom: 1px solid #ebeef5;
  flex-shrink: 0;
}
.ni-title {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
}
.ni-empty {
  padding: 16px 10px;
  color: #c0c4cc;
  font-size: 12px;
  text-align: center;
}
.ni-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-bottom: 1px solid #f0f2f5;
  flex-shrink: 0;
  flex-wrap: wrap;
}
.ni-cards {
  flex: 1;
  overflow-y: auto;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.ni-card {
  border: 1px solid #ebeef5;
  border-radius: 6px;
  padding: 6px 8px;
}
.ni-card-head {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 4px;
}
.ni-card-name {
  flex: 1;
  font-size: 12px;
  font-weight: 600;
  color: #303133;
}
.ni-edit, .ni-del {
  cursor: pointer;
  color: #c0c4cc;
  font-size: 12px;
}
.ni-edit:hover { color: var(--el-color-primary); }
.ni-del:hover { color: #f56c6c; }
.ni-step {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  padding: 2px 0;
  flex-wrap: wrap;
}
.ni-step-kind {
  color: var(--el-color-primary);
  font-weight: 600;
}
.ni-step-fun {
  font-family: 'Consolas', monospace;
  color: #606266;
}
.ni-step-raw {
  font-family: 'Consolas', monospace;
  color: #909399;
  font-style: italic;
}
.ni-args {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  width: 100%;
}
.ni-arg {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #909399;
}
.ni-aliases {
  border-top: 1px solid #f0f2f5;
  padding: 8px 10px;
  flex-shrink: 0;
  max-height: 140px;
  overflow-y: auto;
}
.ni-sub {
  font-size: 11px;
  color: #909399;
  margin-bottom: 4px;
}
.ni-alias-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.ni-no-alias {
  font-size: 11px;
  color: #c0c4cc;
}
</style>

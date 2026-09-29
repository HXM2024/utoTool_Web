<template>
  <div class="tree-editor">
    <!-- 工具栏 -->
    <div v-if="editable" class="tree-toolbar">
      <el-button :icon="Plus" size="small" type="primary" plain @click="handleAddRoot">
        添加根节点
      </el-button>
      <el-button :icon="Plus" size="small" :disabled="!currentNode" @click="handleAddChild">
        添加子节点
      </el-button>
      <el-button :icon="Delete" size="small" type="danger" plain :disabled="!currentNode" @click="handleDeleteNode">
        删除节点
      </el-button>
    </div>

    <div class="tree-body">
      <!-- 树区域 -->
      <div class="tree-section">
        <el-input
          v-model="filterText"
          placeholder="搜索节点..."
          :prefix-icon="Search"
          clearable
          class="filter-input"
        />
        <el-tree
          ref="treeRef"
          :data="data"
          :props="treeProps"
          node-key="id"
          highlight-current
          draggable
          :expand-on-click-node="false"
          :filter-node-method="filterNode"
          @node-click="onNodeClick"
        >
          <template #default="{ node, data: nodeData }">
            <span class="tree-node">
              <el-icon v-if="nodeData.children?.length" class="node-icon"><Folder /></el-icon>
              <el-icon v-else class="node-icon"><Document /></el-icon>
              <span class="node-label">{{ node.label }}</span>
            </span>
          </template>
        </el-tree>
        <div v-if="!data.length" class="empty-tree">
          <el-icon class="empty-icon"><Files /></el-icon>
          <span>暂无数据，请添加节点或上传文件</span>
        </div>
      </div>

      <!-- 属性编辑面板 -->
      <div v-if="currentNode" class="property-panel">
        <div class="panel-header">属性编辑</div>
        <el-form label-width="80px" size="small" class="property-form">
          <el-form-item label="节点ID">
            <el-input v-model="currentNode.id" disabled />
          </el-form-item>
          <el-form-item label="名称">
            <el-input v-model="currentNode.label" @input="onPropUpdate" />
          </el-form-item>
          <el-form-item label="描述">
            <el-input
              v-model="currentNode.description"
              type="textarea"
              :rows="3"
              @input="onPropUpdate"
            />
          </el-form-item>
          <el-form-item v-if="editable" label="">
            <el-button type="primary" size="small" @click="confirmUpdate">保存修改</el-button>
          </el-form-item>
        </el-form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { Plus, Delete, Search, Folder, Document, Files } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { TreeNode } from '@/types'

const props = withDefaults(defineProps<{
  data: TreeNode[]
  editable?: boolean
}>(), {
  editable: true,
})

const emit = defineEmits<{
  (e: 'node-add', parentNode: TreeNode | null, newNode: TreeNode): void
  (e: 'node-delete', node: TreeNode): void
  (e: 'node-update', node: TreeNode): void
  (e: 'node-select', node: TreeNode): void
}>()

const treeRef = ref()
const currentNode = ref<TreeNode | null>(null)
const filterText = ref('')
const treeProps = { label: 'label', children: 'children' }

let nodeIdCounter = Date.now()

function filterNode(value: string, data: TreeNode) {
  if (!value) return true
  return data.label.includes(value)
}

watch(filterText, (val) => {
  treeRef.value?.filter(val)
})

function onNodeClick(data: TreeNode) {
  currentNode.value = { ...data }
  emit('node-select', data)
}

function handleAddRoot() {
  const newNode: TreeNode = {
    id: `node_${nodeIdCounter++}`,
    label: '新节点',
    description: '',
    children: [],
  }
  props.data.push(newNode)
  emit('node-add', null, newNode)
}

function handleAddChild() {
  if (!currentNode.value) return
  const newNode: TreeNode = {
    id: `node_${nodeIdCounter++}`,
    label: '新子节点',
    description: '',
    children: [],
  }
  const parent = findNode(props.data, currentNode.value.id)
  if (parent) {
    if (!parent.children) parent.children = []
    parent.children.push(newNode)
    emit('node-add', parent, newNode)
  }
}

function handleDeleteNode() {
  if (!currentNode.value) return
  ElMessageBox.confirm(`确定删除节点 "${currentNode.value.label}" 吗？`, '删除确认', {
    type: 'warning',
  })
    .then(() => {
      removeNode(props.data, currentNode.value!.id)
      emit('node-delete', currentNode.value!)
      currentNode.value = null
      ElMessage.success('删除成功')
    })
    .catch(() => {})
}

function findNode(nodes: TreeNode[], id: string | number): TreeNode | null {
  for (const node of nodes) {
    if (node.id === id) return node
    if (node.children) {
      const found = findNode(node.children, id)
      if (found) return found
    }
  }
  return null
}

function removeNode(nodes: TreeNode[], id: string | number): boolean {
  const idx = nodes.findIndex((n) => n.id === id)
  if (idx > -1) {
    nodes.splice(idx, 1)
    return true
  }
  for (const node of nodes) {
    if (node.children && removeNode(node.children, id)) return true
  }
  return false
}

function onPropUpdate() {
  // 实时预览编辑
}

function confirmUpdate() {
  if (!currentNode.value) return
  const target = findNode(props.data, currentNode.value.id)
  if (target) {
    target.label = currentNode.value.label
    target.description = currentNode.value.description
    emit('node-update', target)
    ElMessage.success('更新成功')
  }
}
</script>

<style scoped lang="scss">
.tree-editor {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.tree-toolbar {
  display: flex;
  gap: 8px;
  padding: 8px 0;
  flex-wrap: wrap;
}

.tree-body {
  display: flex;
  flex: 1;
  gap: 16px;
  min-height: 0;
}

.tree-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.filter-input {
  margin-bottom: 8px;
}

:deep(.el-tree) {
  background: transparent;
  flex: 1;
  overflow: auto;

  .el-tree-node__content {
    height: 32px;
  }
}

.tree-node {
  display: flex;
  align-items: center;
  gap: 6px;

  .node-icon {
    color: var(--color-primary);
    font-size: 14px;
  }

  .node-label {
    font-size: 13px;
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

.property-panel {
  width: 300px;
  flex-shrink: 0;
  background: var(--bg-card);
  border-radius: var(--radius-base);
  border: 1px solid var(--border-color-light);
  padding: 16px;

  .panel-header {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 16px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border-color-light);
  }
}

.property-form {
  :deep(.el-form-item__label) {
    font-size: 13px;
  }
}
</style>

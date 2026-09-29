<script setup lang="ts">
/**
 * DidConfigForm - DID 节点配置表单
 *
 * 展示并编辑 DID 子节点的 didConfig 字典（键为 sheet 列名，值为字符串）。
 * 对于 2E_H 来源的 DID，额外展示 writeFlowData（写入流程验证数据）。
 */
import { computed } from 'vue'

interface UdsNode {
  services: string
  Description: string
  nodeKind?: string
  sheetName?: string
  didConfig?: Record<string, string | null>
  writeFlowData?: Record<string, string | null>
}

const props = defineProps<{
  node: UdsNode
}>()

// didConfig 的键值对（过滤掉 null/空值的备注列）
const configEntries = computed<[string, string | null][]>(() => {
  const cfg = props.node.didConfig
  if (!cfg) return []
  return Object.entries(cfg)
})

// 是否为 2E_H 来源（需展示写入流程数据）
const is2E = computed(() => props.node.sheetName === '2E_H')

const writeFlowEntries = computed<[string, string | null][]>(() => {
  if (!is2E.value) return []
  const flow = props.node.writeFlowData
  if (!flow) return []
  return Object.entries(flow)
})

// 更新 didConfig 某个键的值
function updateConfig(key: string, value: string) {
  if (!props.node.didConfig) props.node.didConfig = {}
  props.node.didConfig[key] = value || null
}

// 更新 writeFlowData 某个键的值
function updateFlow(key: string, value: string) {
  if (!props.node.writeFlowData) props.node.writeFlowData = {}
  props.node.writeFlowData[key] = value || null
}
</script>

<template>
  <div class="did-config-form">
    <el-form label-width="180px" size="small" class="detail-form">
      <el-form-item label="DID号">
        <el-input v-model="node.services" style="width:200px" />
      </el-form-item>
      <el-form-item label="描述">
        <el-input v-model="node.Description" />
      </el-form-item>

      <el-divider content-position="left">{{ node.sheetName }} 配置项</el-divider>
      <el-form-item
        v-for="[key, val] in configEntries"
        :key="key"
        :label="key"
      >
        <el-input
          :model-value="val || ''"
          @update:model-value="(v: string) => updateConfig(key, v)"
          :placeholder="`请输入${key}`"
        />
      </el-form-item>

      <template v-if="is2E && writeFlowEntries.length">
        <el-divider content-position="left">写入流程验证 (2E_DID)</el-divider>
        <el-form-item
          v-for="[key, val] in writeFlowEntries"
          :key="'flow-' + key"
          :label="key"
        >
          <el-input
            :model-value="val || ''"
            @update:model-value="(v: string) => updateFlow(key, v)"
            :placeholder="`请输入${key}`"
          />
        </el-form-item>
      </template>
    </el-form>
  </div>
</template>

<style scoped>
.did-config-form {
  width: 100%;
}

.detail-form :deep(.el-form-item) {
  margin-bottom: 12px;
}
</style>

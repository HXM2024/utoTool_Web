<template>
  <div class="docked-panel" :class="['dp-' + orient]">
    <div class="dp-head">
      <span class="dp-title">{{ title }}</span>
      <el-button text size="small" @click="emit('float')">浮动</el-button>
      <el-button text size="small" @click="emit('close')">关闭</el-button>
    </div>
    <div class="dp-body"><slot /></div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  orient: 'horizontal' | 'vertical'
}>()
const emit = defineEmits<{
  (e: 'float'): void
  (e: 'close'): void
}>()
</script>

<style scoped>
.docked-panel {
  display: flex;
  background: #fff;
  overflow: hidden;
  flex-shrink: 0;
}
.dp-horizontal {
  flex-direction: column;
  width: 100%;
  border-bottom: 1px solid #ebeef5;
}
.dp-horizontal:last-child {
  border-bottom: none;
}
.dp-vertical {
  flex-direction: column;
  height: 100%;
  border-right: 1px solid #ebeef5;
}
.dp-vertical:last-child {
  border-right: none;
}
.dp-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: #f5f7fa;
  border-bottom: 1px solid #ebeef5;
  flex-shrink: 0;
}
.dp-title {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  color: #303133;
}
.dp-body {
  flex: 1;
  overflow: hidden;
  min-height: 0;
  min-width: 0;
}
</style>

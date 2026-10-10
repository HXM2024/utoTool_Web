<template>
  <component :is="comp" v-bind="attrs" @collapse="emit('collapse')" @saved="onSaved" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import FunctionLibrary from '@/components/FunctionLibrary.vue'
import ObjectPanel from '@/components/ObjectPanel.vue'
import { useModuleStore } from '@/stores/modules'

const props = defineProps<{
  panelKey: 'func' | 'obj'
}>()
const emit = defineEmits<{
  (e: 'collapse'): void
  /** 函数库保存后透出新的函数库源码（用于刷新「已知函数名」） */
  (e: 'saved', functionLibrary?: string): void
}>()

const store = useModuleStore()

const comp = computed(() => (props.panelKey === 'func' ? FunctionLibrary : ObjectPanel))

/** FunctionLibrary 保存后回传新的函数库源码；其它面板不发这个事件（动态组件的事件参数是 unknown，这里做一次收窄） */
function onSaved(functionLibrary: unknown) {
  emit('saved', typeof functionLibrary === 'string' ? functionLibrary : undefined)
}

const attrs = computed(() => {
  if (props.panelKey === 'func') return {}
  return {
    dbcRaw: store.objMergedDbcRaw,
    dtcRaw: store.objDtcRaw,
    a2lVars: store.objA2lVars,
    dbcEnvVars: store.objDbcEnvVars,
    a2lQualifier: store.objA2lQualifier,
  }
})
</script>

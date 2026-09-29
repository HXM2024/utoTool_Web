<template>
  <component :is="comp" v-bind="attrs" @collapse="emit('collapse')" />
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
}>()

const store = useModuleStore()

const comp = computed(() => (props.panelKey === 'func' ? FunctionLibrary : ObjectPanel))

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

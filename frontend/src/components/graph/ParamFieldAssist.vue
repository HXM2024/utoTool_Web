<template>
  <span class="pfa" @mousedown.prevent>
    <!-- 把当前框里的值就地提为参数：自动建参数（默认值=当前值）并把框里替换成 {{参数名}} -->
    <button
      v-if="allowParamify && canParamify"
      type="button"
      class="pfa-btn"
      title="提为参数：按信号名自动命名建参数（值取当前内容），并把此处替换成占位符"
      @click.stop="emit('paramify', {})"
    >
      ⟨⟩
    </button>
    <!-- 取消参数：把 {{参数}} 回填为其默认值，并清理不再被引用的参数声明 -->
    <button
      v-if="inlineNames.length"
      type="button"
      class="pfa-btn pfa-btn-inline"
      :title="inlineTitle"
      @click.stop="emit('inline', inlineNames)"
    >
      ↩
    </button>
    <!-- 输入框里打出 {{ 后列出已声明参数，选择即插入 -->
    <div v-if="suggesting" class="pfa-suggest">
      <div class="pfa-suggest-title">插入参数</div>
      <div
        v-for="p in suggestList"
        :key="p.name"
        class="pfa-suggest-item"
        @mousedown.prevent
        @click.stop="pick(p.name)"
      >
        <span class="pfa-suggest-code">{{ brace(p.name) }}</span>
        <span v-if="p.default" class="pfa-suggest-def">默认 {{ p.default }}</span>
      </div>
      <div v-if="!suggestList.length" class="pfa-suggest-empty">暂无匹配参数</div>
      <div class="pfa-suggest-item pfa-suggest-new" @mousedown.prevent @click.stop="pickNew">
        ＋ 新建参数…
      </div>
    </div>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { CardParam } from '@/types/functionGraph'

const props = withDefaults(
  defineProps<{
    /** 当前输入框的文本 */
    text: string
    /** 卡片已声明的参数 */
    params: CardParam[]
    /** 是否允许「提为参数」（原始 CAPL 行只支持插占位符/取消参数） */
    allowParamify?: boolean
  }>(),
  { allowParamify: true },
)

const emit = defineEmits<{
  /** prefix 存在时表示「从 {{ 处新建参数」，此时占位符插在 prefix 之后而非整体替换 */
  (e: 'paramify', payload: { prefix?: string }): void
  (e: 'inline', names: string[]): void
  (e: 'setText', text: string): void
}>()

/** 占位符文本：模板里不能直接拼 {{ }}，否则会被 Vue 当成插值 */
function brace(name: string): string {
  return `{{${name}}}`
}

const declared = computed(() => (props.params || []).filter((p) => String(p.name || '').trim()))
const declaredByName = computed(() => new Map(declared.value.map((p) => [String(p.name), p])))

/** 文本里出现的、且已声明的参数名 → 可一键取消参数 */
const inlineNames = computed<string[]>(() => {
  const names = new Set<string>()
  const re = /\{\{(\w+)\}\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(props.text || '')) !== null) {
    if (declaredByName.value.has(m[1])) names.add(m[1])
  }
  return [...names]
})
const inlineTitle = computed(
  () => `取消参数：把 ${inlineNames.value.map((n) => `{{${n}}}`).join('、')} 回填为默认值`,
)

/** 文本整体已经是单个占位符时无需再提；空值也允许提（先建出参数，值后续在「参数（接口）」或引用处填） */
const canParamify = computed(() => !/^\s*\{\{\w+\}\}\s*$/.test(String(props.text ?? '')))

/** 未闭合的 {{ 前缀：text 以 {{ 或 {{部分名 结尾时触发补全 */
const partial = computed<string | null>(() => {
  const m = /\{\{([A-Za-z_]\w*)?$/.exec(props.text || '')
  return m ? (m[1] ?? '') : null
})
const suggesting = computed(() => partial.value !== null)
const suggestList = computed<CardParam[]>(() => {
  const q = (partial.value || '').trim().toLowerCase()
  const list = declared.value
  if (!q) return list
  return list.filter((p) => String(p.name).toLowerCase().includes(q))
})

function pick(name: string) {
  const text = props.text || ''
  const m = /\{\{([A-Za-z_]\w*)?$/.exec(text)
  const prefix = m ? text.slice(0, text.length - m[0].length) : text
  emit('setText', `${prefix}{{${name}}}`)
}
function pickNew() {
  const text = props.text || ''
  const m = /\{\{([A-Za-z_]\w*)?$/.exec(text)
  const prefix = m ? text.slice(0, text.length - m[0].length) : text
  emit('paramify', { prefix })
}
</script>

<style scoped lang="scss">
.pfa {
  /* 覆盖在输入框右内侧：不占布局空间，父级需 position: relative */
  position: absolute;
  top: 0;
  bottom: 0;
  /* 让开 el-autocomplete 右侧的展开箭头，避免覆盖功能控件 */
  right: 22px;
  display: flex;
  align-items: center;
  gap: 2px;
  z-index: 6;
  pointer-events: none;
}
.pfa-btn {
  border: none;
  background: transparent;
  color: #909399;
  font-size: 12px;
  line-height: 1;
  padding: 2px 3px;
  border-radius: 4px;
  cursor: pointer;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s, color 0.15s, background 0.15s;
}
.pfa-btn:hover {
  color: var(--el-color-primary);
  background: rgba(64, 158, 255, 0.12);
}
.pfa-btn-inline:hover {
  color: #e6a23c;
  background: rgba(230, 162, 60, 0.14);
}
.pfa-suggest {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  min-width: 190px;
  max-height: 220px;
  overflow-y: auto;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.14);
  padding: 4px;
  z-index: 30;
  pointer-events: auto;
}
.pfa-suggest-title {
  font-size: 11px;
  color: #c0c4cc;
  padding: 2px 6px 4px;
}
.pfa-suggest-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 6px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
}
.pfa-suggest-item:hover {
  background: #ecf5ff;
}
.pfa-suggest-code {
  font-family: Consolas, Monaco, monospace;
  color: var(--el-color-primary);
}
.pfa-suggest-def {
  color: #c0c4cc;
  font-size: 11px;
}
.pfa-suggest-empty {
  padding: 4px 6px;
  font-size: 12px;
  color: #c0c4cc;
}
.pfa-suggest-new {
  color: var(--el-color-primary);
  border-top: 1px solid #f2f6fc;
}
</style>

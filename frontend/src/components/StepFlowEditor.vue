<template>
  <div class="step-flow-editor">
    <div v-if="!flatSteps.length" class="empty-hint">
      <el-icon><DataBoard /></el-icon>
      <span>暂无步骤数据</span>
    </div>
    <template v-else>
      <template v-for="(node, i) in tree" :key="i">
        <FlowNodeItem :node="node" :is-last="i === tree.length - 1" />
      </template>
    </template>
  </div>
</template>

<script lang="ts">
/**
 * 步骤流程编辑器：用 SVG 连线把步骤卡片串联起来。
 *
 * 数据来源：后端 test_case_list[].steps，扁平数组，通过 loop_start/loop_end 配对构建嵌套树。
 * 连线：卡片间固定间隙 + SVG 箭头，无需测量高度，天然适配任意卡片尺寸。
 * 循环容器：loop_start 渲染为带框容器，内部子步骤递归连线。
 */
import { computed, defineComponent, h, resolveComponent } from 'vue'
import { ElIcon, ElTag, ElTooltip } from 'element-plus'
import {
  DataBoard,
  Rank,
  Timer,
  Connection,
  RefreshRight,
  VideoPause,
  Cpu,
} from '@element-plus/icons-vue'

/** 单个步骤对象 */
export interface StepNode {
  type: 'step' | 'func_call' | 'clear' | 'reset_ramp' | 'loop_start' | 'loop_end'
  fun: string
  param: string
  signals: Record<string, string>
  indent: number
  loop_depth?: number
  error?: string
  body_preview?: string
  children?: StepNode[]
}

/** 连接线：卡片间的 SVG 箭头 */
const Connector = () =>
  h('div', { class: 'connector' }, [
    h('svg', { width: '2', height: '28', viewBox: '0 0 2 28' }, [
      h('line', { x1: '1', y1: '0', x2: '1', y2: '22', stroke: '#1890ff', 'stroke-width': '2' }),
      h('polygon', { points: '0,22 4,22 2,28', fill: '#1890ff' }),
    ]),
  ])

/** 步骤卡片 */
const StepCard = defineComponent({
  name: 'StepCard',
  props: { node: { type: Object as () => StepNode, required: true } },
  setup(props) {
    const funIcon = (fun: string): any => {
      const f = (fun || '').toLowerCase()
      if (f.includes('wait')) return Timer
      if (f.includes('signalcheck') || f.includes('signalwaitcheck')) return Connection
      if (f.includes('clear') || f.includes('reset')) return RefreshRight
      if (f.includes('stoplog')) return VideoPause
      if (f.includes('setsignal')) return Cpu
      return Rank
    }
    const funColor = (fun: string): string => {
      const f = (fun || '').toLowerCase()
      if (f.includes('wait')) return '#e6a23c'
      if (f.includes('signalcheck') || f.includes('signalwaitcheck')) return '#1890ff'
      if (f.includes('clear') || f.includes('reset')) return '#909399'
      if (f.includes('stoplog')) return '#f56c6c'
      if (f.includes('setsignal')) return '#67c23a'
      return '#1890ff'
    }
    return () => {
      const n = props.node
      const sigEntries = Object.entries(n.signals || {})
      return h('div', { class: 'step-card', draggable: true }, [
        h('div', { class: 'card-left', style: { background: funColor(n.fun) } }),
        h('div', { class: 'card-body' }, [
          h('div', { class: 'card-head' }, [
            h(ElIcon, { class: 'card-icon' }, () => h(funIcon(n.fun))),
            h('span', { class: 'card-fun' }, n.fun || '(空)'),
            n.param ? h(ElTag, { size: 'small', type: 'info', effect: 'plain' }, () => n.param) : null,
            n.error ? h(ElTag, { size: 'small', type: 'danger' }, () => n.error) : null,
          ]),
          sigEntries.length
            ? h(
                'div',
                { class: 'card-sigs' },
                sigEntries.map(([sig, val]) =>
                  h(ElTooltip, { content: `${sig} = ${val}`, placement: 'top' }, () =>
                    h('span', { class: 'sig-chip' }, [
                      h('span', { class: 'sig-name' }, sig),
                      h('span', { class: 'sig-eq' }, '='),
                      h('span', { class: 'sig-val' }, val),
                    ]),
                  ),
                ),
              )
            : null,
          n.body_preview
            ? h('pre', { class: 'card-preview' }, n.body_preview.split('\n').slice(0, 3).join('\n'))
            : null,
        ]),
      ])
    }
  },
})

/**
 * 流程节点：递归组件，处理普通卡片和循环容器。
 * 通过 name 自引用（resolveComponent），避免变量级循环引用导致 TS 类型推断失败。
 */
const FlowNodeItem = defineComponent({
  name: 'FlowNodeItem',
  props: {
    node: { type: Object as () => StepNode, required: true },
    isLast: { type: Boolean, default: false },
  },
  setup(props) {
    return () => {
      const n = props.node
      let inner: any
      if (n.type === 'loop_start') {
        // 循环容器：带框，头部+子步骤+尾部+连线
        inner = h('div', { class: 'loop-container' }, [
          h('div', { class: 'loop-head' }, [
            h(ElIcon, { class: 'loop-icon' }, () => h(Rank)),
            h('span', { class: 'loop-label' }, `循环 × ${n.param || '?'}`),
            n.loop_depth ? h(ElTag, { size: 'small', type: 'warning' }, () => `depth ${n.loop_depth}`) : null,
          ]),
          h('div', { class: 'loop-body' }, [
            n.children && n.children.length
              ? n.children.map((c, i) =>
                  h(resolveComponent('FlowNodeItem') as any, {
                    node: c,
                    isLast: i === n.children!.length - 1,
                    key: i,
                  }),
                )
              : h('div', { class: 'loop-empty' }, '拖拽步骤到循环内'),
          ]),
          h('div', { class: 'loop-foot' }, '↻ end'),
          !props.isLast ? h(Connector) : null,
        ])
      } else {
        inner = h(StepCard, { node: n })
      }
      return h('div', { class: 'flow-node' }, [
        inner,
        n.type !== 'loop_start' && !props.isLast ? h(Connector) : null,
      ])
    }
  },
})

export default defineComponent({
  name: 'StepFlowEditor',
  components: { FlowNodeItem, ElIcon },
  props: {
    steps: { type: Array as () => StepNode[], default: () => [] },
    caseId: { type: String, default: '' },
  },
  setup(props) {
    /** 构建嵌套树：loop_start 作为父节点，其后的步骤挂到 children，直到 loop_end */
    const tree = computed<StepNode[]>(() => {
      const root: StepNode[] = []
      const stack: StepNode[] = []
      const pushTo = (node: StepNode) => {
        if (stack.length) (stack[stack.length - 1].children ||= []).push(node)
        else root.push(node)
      }
      for (const s of props.steps) {
        if (s.type === 'loop_start') {
          s.children = []
          pushTo(s)
          stack.push(s)
        } else if (s.type === 'loop_end') {
          stack.pop()
        } else {
          pushTo(s)
        }
      }
      return root
    })
    const flatSteps = computed(() => props.steps)
    return { tree, flatSteps }
  },
})
</script>

<style scoped>
.step-flow-editor {
  padding: 16px;
  min-height: 200px;
}
.empty-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #909399;
  gap: 8px;
  padding: 40px;
}
.empty-hint .el-icon { font-size: 32px; }

/* 连接线 */
.connector {
  width: 2px;
  height: 28px;
  margin: 0 auto;
  display: flex;
  justify-content: center;
}
.connector svg { display: block; }

/* 流程节点 */
.flow-node { display: flex; flex-direction: column; align-items: stretch; }

/* 步骤卡片 */
.step-card {
  display: flex;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  background: #fff;
  overflow: hidden;
  transition: box-shadow 0.2s, border-color 0.2s;
  cursor: grab;
}
.step-card:hover {
  box-shadow: 0 2px 12px rgba(91, 141, 239, 0.15);
  border-color: var(--el-color-primary);
}
.step-card:active { cursor: grabbing; }
.card-left { width: 4px; flex-shrink: 0; }
.card-body { flex: 1; padding: 8px 12px; min-width: 0; }
.card-head { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.card-icon { color: #606266; }
.card-fun { font-weight: 600; font-size: 13px; color: #303133; }
.card-sigs { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
.sig-chip {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px 6px;
  background: #f5f7fa;
  border-radius: 4px;
  font-size: 12px;
  max-width: 220px;
  overflow: hidden;
}
.sig-name { color: var(--el-color-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sig-eq { color: #c0c4cc; }
.sig-val { color: #e6a23c; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.card-preview {
  margin-top: 6px;
  padding: 4px 6px;
  background: #f5f7fa;
  border-radius: 4px;
  font-size: 11px;
  color: #606266;
  max-height: 60px;
  overflow: hidden;
  white-space: pre-wrap;
}

/* 循环容器 */
.loop-container {
  border: 1px dashed var(--el-color-primary);
  border-radius: 8px;
  background: rgba(91, 141, 239, 0.03);
  padding: 8px;
  position: relative;
}
.loop-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: var(--el-color-primary);
  color: #fff;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  width: fit-content;
}
.loop-icon { color: #fff; }
.loop-body { padding: 8px 4px 4px 12px; border-left: 2px solid var(--el-color-primary); margin-left: 8px; }
.loop-empty { color: #c0c4cc; font-size: 12px; padding: 8px; font-style: italic; }
.loop-foot { color: var(--el-color-primary); font-size: 11px; padding: 2px 8px; text-align: right; }
</style>

<script setup lang="ts">
import { CardStep, CardStepArg, StepKind, STEP_KIND_LABEL, CAPL_FUNCS, genId } from '../types'

const props = defineProps<{ steps: CardStep[] }>()
const emit = defineEmits<{ (e: 'change'): void }>()

const KIND_OPTIONS = Object.keys(STEP_KIND_LABEL) as StepKind[]

function setKind(s: CardStep, kind: StepKind) {
  s.kind = kind
  if (kind === 'raw') { s.raw = s.raw ?? '' }
  else { s.raw = undefined }
  emit('change')
}

function ensureArgs(s: CardStep): CardStepArg[] {
  if (!Array.isArray(s.args)) s.args = []
  return s.args
}

function addArg(s: CardStep) {
  ensureArgs(s).push({ key: '', kind: 'literal', value: '' })
  emit('change')
}

function removeArg(s: CardStep, i: number) {
  ensureArgs(s).splice(i, 1)
  emit('change')
}

function addStep() {
  props.steps.push({ id: genId('step'), kind: 'call', fun: '', args: [], indent: 0 })
  emit('change')
}

function removeStep(i: number) {
  props.steps.splice(i, 1)
  emit('change')
}
</script>

<template>
  <table class="step-table">
    <thead>
      <tr>
        <th class="col-kind">类型</th>
        <th class="col-fun">函数名</th>
        <th class="col-args">参数（key=值，支持 mapping 别名）</th>
        <th class="col-op"></th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="(s, i) in steps" :key="s.id" class="step-row">
        <td>
          <select :value="s.kind" @change="setKind(s, ($event.target as HTMLSelectElement).value as StepKind)">
            <option v-for="k in KIND_OPTIONS" :key="k" :value="k">{{ STEP_KIND_LABEL[k] }}</option>
          </select>
        </td>
        <td>
          <input
            v-if="s.kind !== 'raw' && s.kind !== 'loop_end'"
            v-model="s.fun"
            list="capl-funcs"
            placeholder="函数名联想…"
            @input="emit('change')"
          />
          <span v-else class="muted">—</span>
        </td>
        <td>
          <textarea
            v-if="s.kind === 'raw'"
            v-model="s.raw"
            rows="1"
            placeholder="原始 CAPL 行"
            @input="emit('change')"
          ></textarea>
          <div v-else class="arg-list">
            <div v-for="(a, ai) in s.args" :key="ai" class="arg-item">
              <input v-model="a.key" placeholder="参数名" class="arg-key" @input="emit('change')" />
              <select v-model="a.kind" class="arg-kind" @change="emit('change')">
                <option value="literal">字面量</option>
                <option value="mapping">别名</option>
              </select>
              <input
                v-model="a.value"
                :list="a.kind === 'mapping' ? 'mapping-aliases' : undefined"
                placeholder="值 / 别名"
                class="arg-val"
                @input="emit('change')"
              />
              <button class="mini del" title="删除参数" @click="removeArg(s, ai)">×</button>
            </div>
            <button class="mini add" @click="addArg(s)">+ 参数</button>
          </div>
        </td>
        <td>
          <button class="mini del" title="删除步骤" @click="removeStep(i)">删除</button>
        </td>
      </tr>
    </tbody>
  </table>
  <button class="mini add add-step" @click="addStep">+ 添加步骤</button>
</template>

<style scoped>
.step-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.step-table th, .step-table td { padding: 3px 4px; text-align: left; vertical-align: top; }
.step-table th { color: #6b7280; font-weight: 600; }
.col-kind { width: 88px; }
.col-fun { width: 150px; }
.col-op { width: 52px; }
.step-row td { border-top: 1px solid #eef0f4; }
input, select, textarea {
  border: 1px solid #d7dbe2; border-radius: 5px; padding: 4px 6px;
  font-size: 12px; width: 100%; background: #fff;
}
.arg-list { display: flex; flex-direction: column; gap: 3px; }
.arg-item { display: flex; gap: 3px; }
.arg-key { width: 90px; flex: 0 0 90px; }
.arg-kind { width: 70px; flex: 0 0 70px; }
.arg-val { flex: 1; }
.muted { color: #9ca3af; }
.mini { border: none; border-radius: 5px; font-size: 12px; padding: 3px 8px; }
.mini.add { background: #eef3ff; color: #2563eb; }
.mini.del { background: #fdeaea; color: #dc2626; }
.add-step { margin-top: 6px; }
</style>

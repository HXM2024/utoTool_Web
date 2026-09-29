export type StageType = 'inject' | 'sequence' | 'result'

export interface CardStepArg {
  key: string
  kind: 'literal' | 'mapping'
  value: string
}

export type StepKind = 'call' | 'set' | 'wait' | 'check' | 'loop_start' | 'loop_end' | 'raw'

export interface CardStep {
  id: string
  kind: StepKind
  fun?: string
  args: CardStepArg[]
  raw?: string
  indent?: number
}

export interface Card {
  id: string
  type: StageType
  name: string
  refId?: string
  steps: CardStep[]
}

export interface Stage {
  type: StageType
  cards: Card[]
}

export interface CaseTrack {
  id: string
  name: string
  stages: Stage[]
}

export interface MappingEntry {
  alias: string
  kind: string
  name: string
}

export interface LibraryCard extends Card {}

export interface Workspace {
  tracks: CaseTrack[]
  library: LibraryCard[]
  mapping: MappingEntry[]
}

export const STAGE_LABEL: Record<StageType, string> = {
  inject: '故障注入',
  sequence: '测试序列',
  result: '结果判断',
}

export const STAGE_ORDER: StageType[] = ['inject', 'sequence', 'result']

export const STEP_KIND_LABEL: Record<StepKind, string> = {
  call: '函数调用',
  set: '设值',
  wait: '等待',
  check: '检查',
  loop_start: '循环开始',
  loop_end: '循环结束',
  raw: '原始行',
}

export function genId(prefix = 'id'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export function newStep(kind: StepKind = 'call'): CardStep {
  return { id: genId('step'), kind, fun: '', args: [], raw: kind === 'raw' ? '' : undefined, indent: 0 }
}

export function newCard(type: StageType, name = ''): Card {
  return { id: genId('card'), type, name: name || '新卡片', steps: [newStep('call')] }
}

export const CAPL_FUNCS: string[] = [
  'TestWaitForTime', 'TestStepPass', 'TestStepFail', 'setSignal', 'write',
  'Diag_SetTarget', 'Diag_SetParameter', 'TestWaitForDiagRequestSent',
  'TestWaitForTimeout', 'testWaitForDiagResponse', 'CddSetValue', 'IoControl',
]

export const DEMO_MAPPING: MappingEntry[] = [
  { alias: '车速信号', kind: 'signal', name: 'VehSpd' },
  { alias: '发动机转速', kind: 'signal', name: 'EngSpd' },
  { alias: 'DTC_欠压', kind: 'dtc', name: 'DTC_U001_88' },
  { alias: '报文_EMS01', kind: 'message', name: 'EMS_01' },
]

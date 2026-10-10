import type {
  Card,
  CardLibrary,
  CardParam,
  CardStep,
  CardStepArg,
  CardType,
  CaseFrame,
  CaseGroup,
  FrameEdge,
  FrameLane,
  FrameLaneType,
  GroupNode,
  Graph,
  InjectRole,
  ObjectMapping,
  Port,
  ValueResource,
} from '@/types/functionGraph'
import { genId } from '@/types/functionGraph'

/**
 * 步骤文本的展示形式：把 {{参数}} 换成可读内容，避免界面上出现 {{占位符}}。
 * 与后端 _resolve_label_params 一致：按节点生效的参数值解析；
 * 未声明或无值时显示参数名本身（读起来就是一个变量名）。
 *
 * values 传「参数名 → 值」映射（见 nodeParamValues）或旧的 params 数组（只取 default）。
 */
export function paramDisplayText(
  text: string,
  values?: Record<string, string> | CardParam[],
): string {
  if (!text || !text.includes('{{')) return text
  const map = new Map<string, string>()
  if (Array.isArray(values)) {
    for (const p of values) {
      const n = String(p?.name ?? '').trim()
      if (!n) continue
      const dv = p?.default
      map.set(n, dv === undefined || dv === null ? '' : String(dv))
    }
  } else {
    for (const [n, v] of Object.entries(values ?? {})) map.set(String(n).trim(), String(v ?? ''))
  }
  return text.replace(CARD_PARAM_REF_RE, (_m, raw: string) => {
    const n = String(raw).trim()
    const v = map.get(n)
    return v === undefined || v === '' ? n : v
  })
}

/** 泳道/卡片类型中文名 */
export const CARD_TYPE_LABEL: Record<CardType, string> = {
  inject: '故障注入',
  sequence: '测试序列',
  result: '结果判断',
}

/** 故障注入分类中文名 */
export const INJECT_ROLE_LABEL: Record<InjectRole, string> = {
  inject: '故障注入',
  recover: '故障恢复',
}

/** 节点几何常量（GraphCanvas / GroupNodeItem / EdgeLayer 共享） */
export const NODE_W = 200
export const NODE_HEAD_H = 30
export const NODE_CARD_H = 24
export const NODE_BASE_H = 44

/** 端口数量：single=1，multi=卡片数 */
export function portCountOf(node: GroupNode): number {
  return node.fanout === 'single' ? 1 : Math.max(1, node.cards.length)
}

/** 节点高度（估算） */
export function nodeHeightOf(node: GroupNode): number {
  return NODE_HEAD_H + Math.max(1, node.cards.length) * (NODE_CARD_H + 4) + 8
}

/** 第 p 个端口的纵向偏移（相对节点顶部） */
export function portTop(p: number): number {
  return NODE_HEAD_H + 6 + p * (NODE_CARD_H + 4) + NODE_CARD_H / 2
}

/** 步骤类型中文名 */
export const STEP_KIND_LABEL: Record<CardStep['kind'], string> = {
  call: '函数调用',
  set: '设置',
  reset: '恢复',
  reset_all: '恢复全部',
  wait: '等待',
  check: '检查',
  wait_check: '限时检查',
  rate: '斜率请求',
  ramp: '斜率请求(同步)',
  tester_prompt: '弹窗提示',
  loop_start: 'Loop Start',
  loop_end: 'Loop End',
  raw: '原始行',
  card: '卡片引用',
}

/** 对象行类步骤在步骤头部要填的「步骤级数值参数」（按生成的 CAPL 形参顺序）：
 *  - 斜率请求      SetSignalRate(信号, 步长, 目标值)
 *  - 斜率请求(同步) SetSignalRamp(信号, 周期时间, 步长, 最大值)
 *  - 限时检查      SignalWaitCheck(信号, 期望值, 时间)
 *  - 弹窗提示      testWaitForTesterConfirmation(Str_Temp, 超时)
 *  留空时后端按 placeholder 的值生成。 */
export interface StepNumField {
  key: 'rate' | 'cycleTime' | 'time'
  label: string
  placeholder: string
  title: string
}
export const STEP_NUM_FIELDS: Partial<Record<CardStep['kind'], StepNumField[]>> = {
  rate: [
    { key: 'rate', label: '斜率', placeholder: '10', title: '步长，SetSignalRate 的第 2 个参数（留空按 10 生成）' },
  ],
  ramp: [
    { key: 'cycleTime', label: '周期时间', placeholder: '10', title: '周期时间(ms)，SetSignalRamp 的第 2 个参数（留空按 10 生成）' },
    { key: 'rate', label: '斜率', placeholder: '10', title: '步长，SetSignalRamp 的第 3 个参数（留空按 10 生成）' },
  ],
  wait_check: [
    { key: 'time', label: '时间', placeholder: '1000', title: '超时时间(ms)，SignalWaitCheck 的第 3 个参数（留空按 1000 生成）' },
  ],
  tester_prompt: [
    { key: 'time', label: '超时', placeholder: '60000', title: '等待确认超时(ms)，testWaitForTesterConfirmation 的第 2 个参数（留空按 60000 生成）' },
  ],
}
export function stepNumFieldsOf(kind: CardStep['kind']): StepNumField[] {
  return STEP_NUM_FIELDS[kind] || []
}

/** 限时检查的判定方式 —— 对应 func_test_function.py 里 SignalWaitCheck 的四个重载：
 *  等于/不等于期望值  → SignalWaitCheck[Not](sig, compareValue, time)
 *  在/不在区间内      → SignalWaitCheck[Not](sig, RangeValue1, RangeValue2, time) */
export interface WaitFormOption {
  value: 'eq' | 'ne' | 'in' | 'out'
  label: string
  not: boolean
  range: boolean
}
export const WAIT_FORMS: WaitFormOption[] = [
  { value: 'eq', label: '等于期望值', not: false, range: false },
  { value: 'ne', label: '不等于期望值', not: true, range: false },
  { value: 'in', label: '在区间内', not: false, range: true },
  { value: 'out', label: '不在区间内', not: true, range: true },
]
/** 当前步骤的判定方式 value（用于下拉回显） */
export function waitFormOf(step: CardStep): WaitFormOption['value'] {
  const hit = WAIT_FORMS.find((f) => f.not === !!step.waitNot && f.range === !!step.waitRange)
  return hit ? hit.value : 'eq'
}
/** 写入判定方式（落到 waitNot / waitRange 两个标记上） */
export function applyWaitForm(step: CardStep, value: WaitFormOption['value']) {
  const hit = WAIT_FORMS.find((f) => f.value === value)
  if (!hit) return
  step.waitNot = hit.not
  step.waitRange = hit.range
}
/** 限时检查当前判定方式是否需要区间（两个值） */
export function isWaitRange(step: CardStep): boolean {
  return step.kind === 'wait_check' && !!step.waitRange
}
/** 限时检查要生成的 CAPL 函数名 */
export function waitCheckFunOf(step: CardStep): string {
  return step.waitNot ? 'SignalWaitCheckNot' : 'SignalWaitCheck'
}

/** 新建空白步骤 */
export function newStep(kind: CardStep['kind'] = 'call'): CardStep {
  const withFun = kind === 'call' || kind === 'wait'
  const step: CardStep = {
    id: genId('step'),
    kind,
    fun: withFun ? '' : undefined,
    args: kind === 'check' || kind === 'wait_check' ? [{ key: '', value: '' }] : [],
    raw: kind === 'raw' ? '' : undefined,
    rate: kind === 'rate' || kind === 'ramp' ? '10' : undefined,
    cycleTime: kind === 'ramp' ? '10' : undefined,
    time: kind === 'wait_check' ? '1000' : kind === 'tester_prompt' ? '60000' : undefined,
    prompt: kind === 'tester_prompt' ? '' : undefined,
    waitNot: kind === 'wait_check' ? false : undefined,
    waitRange: kind === 'wait_check' ? false : undefined,
    indent: 0,
  }
  if (kind === 'loop_start') {
    step.loopMode = 'for'
    step.args = [
      { key: 'init', value: '' },
      { key: 'count', value: '' },
      { key: 'step', value: '' },
    ]
  }
  return step
}

/** 新建空白卡片 */
export function newCard(type: CardType): Card {
  return {
    id: genId('card'),
    type,
    name: '',
    description: '',
    steps: [newStep('call')],
    /* 卡片参数（接口）：步骤内用 {{名称}} 占位，引用卡片时可填不同值 */
    params: [],
    locals: [],
  }
}

/** 新建空白组节点 */
export function newNode(lane: CardType, card: Card, x: number, y: number): GroupNode {
  return {
    id: genId('node'),
    lane,
    cards: [{ ...card, id: genId('card'), refId: card.refId ?? card.id }],
    fanout: 'multi',
    x,
    y,
  }
}

/** 计算组节点的口 */
export function portsOf(node: GroupNode): Port[] {
  if (node.fanout === 'single') {
    const steps: CardStep[] = []
    for (const card of node.cards) steps.push(...card.steps)
    return [{ label: node.id, steps }]
  }
  return node.cards.map((card) => ({
    label: card.name || card.id,
    steps: card.steps,
  }))
}

/** 某泳道的全部口；空泳道等价 1 个空口 */
export function lanePorts(nodes: GroupNode[], lane: CardType): Port[] {
  const ports: Port[] = []
  for (const node of nodes.filter((n) => n.lane === lane)) {
    ports.push(...portsOf(node))
  }
  if (!ports.length) ports.push({ label: '', steps: [] })
  return ports
}

/**
 * 有 edges 时按拓扑展开：同链串联、分叉并联，用例数 = 注入起点到死端的全部路径数。
 * 与后端 function_graph._expand_by_edges 对齐（起点=注入泳道所有口；
 * 注入为空时退回无入边的口；带环保护 DFS）。
 */
export function countCasesByEdges(graph: Graph): number {
  const nodes = graph.nodes
  const nodeLane = new Map<string, CardType>()
  const nodePortCount = new Map<string, number>()
  for (const node of nodes) {
    nodeLane.set(node.id, node.lane)
    nodePortCount.set(node.id, portCountOf(node))
  }

  const adj = new Map<string, string[]>()
  const incoming = new Set<string>()
  const keyOf = (nodeId: string, portIndex: number) => `${nodeId}#${portIndex}`
  for (const edge of graph.edges) {
    const fromKey = keyOf(edge.from.nodeId, edge.from.portIndex ?? 0)
    const toKey = keyOf(edge.to.nodeId, edge.to.portIndex ?? 0)
    const list = adj.get(fromKey) ?? []
    list.push(toKey)
    adj.set(fromKey, list)
    incoming.add(toKey)
  }

  const sources: string[] = []
  for (const node of nodes) {
    if (nodeLane.get(node.id) !== 'inject') continue
    for (let p = 0; p < (nodePortCount.get(node.id) ?? 0); p++) {
      sources.push(keyOf(node.id, p))
    }
  }
  if (!sources.length) {
    for (const node of nodes) {
      for (let p = 0; p < (nodePortCount.get(node.id) ?? 0); p++) {
        const key = keyOf(node.id, p)
        if (!incoming.has(key)) sources.push(key)
      }
    }
  }
  if (!sources.length) return 0

  let count = 0
  const dfs = (key: string, visited: Set<string>) => {
    if (visited.has(key)) return
    visited.add(key)
    const next = adj.get(key) ?? []
    if (!next.length) count += 1
    else for (const t of next) dfs(t, visited)
    visited.delete(key)
  }
  for (const src of sources) dfs(src, new Set<string>())
  return count
}

/** 合并参数声明：声明以库卡片（lib）为准，节点自己的同名参数原样保留（默认值/显示名），
 *  节点多出来的参数追加在后面。节点没有参数时直接沿用库卡片声明。 */
function mergeCardParams(nodeParams?: CardParam[], libParams?: CardParam[]): CardParam[] | undefined {
  if (!nodeParams?.length) return libParams
  if (!libParams?.length) return nodeParams
  const own = new Map(nodeParams.map((p) => [String(p?.name ?? '').trim(), p]))
  const merged = libParams.map((p) => own.get(String(p?.name ?? '').trim()) ?? p)
  for (const p of nodeParams) {
    if (!merged.includes(p)) merged.push(p)
  }
  return merged
}

/**
 * 引用式复用同步：把画布中带 refId 的卡片内容覆盖为卡片库最新版本。
 * 保留画布实例 id/refId 不动（避免端口/连线引用失效），仅同步 name/description/steps/type。
 * 返回 { graph, synced }；无变化时返回原 graph 引用（synced=0）。
 */
export function syncGraphRefs(
  graph: Graph,
  library: CardLibrary,
): { graph: Graph; synced: number } {
  const libIndex = new Map<string, Card>()
  for (const cards of [library.inject, library.sequence, library.result]) {
    for (const c of cards) libIndex.set(c.id, c)
  }
  let synced = 0
  let changed = false

  const syncCard = (card: Card): Card => {
    if (!card.refId) return card
    const src = libIndex.get(card.refId)
    if (!src) return card
    // 卡片引用节点（唯一一步就是「引用该卡片」）不能整块覆盖：
    // 它的内容是按实例填的参数取值（args）决定的，覆盖成库卡片原件会丢掉这些取值，
    // 参数没默认值时就会退化成显示/生成 `{{参数}}`。这里只同步显示用的卡片名。
    const isRefNode =
      card.steps?.length === 1 && card.steps[0].kind === 'card' && card.steps[0].cardId === card.refId
    if (isRefNode) {
      const step = card.steps[0]
      if (step.cardName === src.name && step.cardType === src.type) return card
      synced += 1
      return { ...card, steps: [{ ...step, cardName: src.name, cardType: src.type }] }
    }
    // 节点自己的参数值不能被库卡片覆盖：整块覆盖会把节点上填好的默认值回滚成库卡片的值
    // （经常是空），界面随即退回显示参数名/占位符，像是「填了值没生效」。
    // 参数声明仍以库卡片为准，只保留节点上的同名参数（含默认值/显示名）。
    const next: Card = {
      ...src,
      id: card.id,
      refId: card.refId,
      params: mergeCardParams(card.params, src.params),
      // 「全局卡片」是卡片库条目的作用域标记，不该带到工况节点副本上
      global: undefined,
    }
    if (JSON.stringify(next) !== JSON.stringify(card)) {
      synced += 1
      return next
    }
    return card
  }

  const nodes = graph.nodes.map((node) => {
    let nodeChanged = false
    const cards = node.cards.map((card) => {
      const next = syncCard(card)
      if (next !== card) nodeChanged = true
      return next
    })
    if (!nodeChanged) return node
    changed = true
    return { ...node, cards }
  })

  let frames = graph.frames
  if (frames && frames.length) {
    let framesChanged = false
    frames = frames.map((frame) => {
      let frameChanged = false
      const nodes: Record<string, Card> = {}
      for (const [id, card] of Object.entries(frame.nodes)) {
        const next = syncCard(card)
        if (next !== card) frameChanged = true
        nodes[id] = next
      }
      if (!frameChanged) return frame
      framesChanged = true
      return { ...frame, nodes }
    })
    if (framesChanged) changed = true
  }

  if (!changed) return { graph, synced }
  const nextGraph: Graph = { ...graph, nodes }
  if (frames) nextGraph.frames = frames
  return { graph: nextGraph, synced }
}

/** 步骤签名：忽略步骤 id（每个副本各自生成 id），其余字段逐字段比较 */
function stepSignature(step: CardStep): string {
  return JSON.stringify({ ...step, id: '' })
}

/** 节点是否只是库卡片的一份整份副本（步骤逐条一致）→ 换成卡片引用后生成结果不变。
 *  refSigs 可传入已算好的库卡片步骤签名（同一个库卡片常被多个节点引用，避免每个节点重算一遍） */
function isLosslessCopy(node: Card, ref: Card, refSigs?: string[]): boolean {
  const steps = node.steps ?? []
  const refSteps = refSigs ?? (ref.steps ?? []).map((s) => stepSignature(s))
  if (!steps.length || steps.length !== refSteps.length) return false
  return steps.every((s, i) => stepSignature(s) === refSteps[i])
}

/** 副本节点 → 卡片引用节点：保留 id/refId/name/params，步骤换成「引用库卡片」一步。
 *  节点自己填过、且与库卡片默认值不同的参数值搬进引用步骤 args（生成时 args 覆盖卡片默认值），
 *  其余留空走库卡片默认值——避免迁移改变生成结果。 */
function refCardNode(node: Card, ref: Card): Card {
  const declared = new Map<string, string>()
  for (const p of ref.params ?? []) {
    const name = String(p?.name ?? '').trim()
    if (name) declared.set(name, p.default === undefined || p.default === null ? '' : String(p.default))
  }
  const args: CardStepArg[] = []
  for (const p of node.params ?? []) {
    const name = String(p?.name ?? '').trim()
    if (!name) continue
    const value = p.default === undefined || p.default === null ? '' : String(p.default)
    if (value !== '' && value !== (declared.get(name) ?? '')) args.push({ key: name, value })
  }
  return {
    ...node,
    refId: ref.id,
    steps: [
      {
        id: genId('step'),
        kind: 'card',
        cardId: ref.id,
        cardType: ref.type,
        cardName: ref.name,
        args,
        indent: 0,
      },
    ],
  }
}

/**
 * 副本节点 → 卡片引用节点（无损迁移）。
 *
 * 历史数据里「从卡片库拖进工况」得到的是库卡片的整份副本（refId 指向库卡片、steps 已展开），
 * 副本里的 {{参数}} 没有任何可按实例填值的地方，只能看着参数名干瞪眼。
 * 转成「卡片引用」后，节点编辑框里会出现「参数取值」，同一张卡片的不同实例能各填各的值。
 *
 * 只有「refId 能在卡片库中解析 且 节点步骤与库卡片逐字段一致（仅步骤 id 不同）」的副本才转换：
 * - refId 悬空（库卡片已删除/改名）→ 转换会丢光节点内容，跳过；
 * - 节点步骤被本地改过 → 转换会丢改动，跳过；
 * - 主序列/按步骤接线的节点 → 接线口按步骤编号，压缩成一步会错位，跳过；
 * - 库卡片没有参数 → 不做引用化（与手动拖拽一致：内容留在节点里，编辑时能看到步骤）。
 *
 * 每个分组按「自己的卡片库」解析 refId（与后端按分组生成、工况画布按分组查表一致）：
 * 拿别的分组的卡片解析，会把节点改成「引用一张本组没有的卡片」，生成时整步被丢掉。
 * 就地修改 graph（含各分组的 frames），返回迁移的节点数。
 */
export function migrateRefCopyNodes(graph: Graph, library: CardLibrary): number {
  const groupFrames = new Set<CaseFrame[]>()
  let migrated = 0
  for (const grp of graph.groups ?? []) {
    if (!Array.isArray(grp.frames)) continue
    groupFrames.add(grp.frames)
    migrated += migrateFrames(grp.frames, grp.cards ?? library)
  }
  if (Array.isArray(graph.frames) && !groupFrames.has(graph.frames)) {
    migrated += migrateFrames(graph.frames, library)
  }
  return migrated
}

/** 对一组工况执行「副本节点 → 卡片引用」迁移（library 为该组自己的卡片库） */
function migrateFrames(frames: CaseFrame[], library: CardLibrary): number {
  const libIndex = new Map<string, Card>()
  for (const cards of [library.inject, library.sequence, library.result]) {
    for (const c of cards) libIndex.set(c.id, c)
  }
  // 库卡片的步骤签名只算一次：stepSignature 是逐步骤 JSON.stringify，
  // 同一个库卡片常被多个节点引用，原来每个节点都要把它的签名重算一遍
  const refSigCache = new Map<string, string[]>()
  const refSignatures = (ref: Card): string[] => {
    let sig = refSigCache.get(ref.id)
    if (!sig) {
      sig = (ref.steps ?? []).map((s) => stepSignature(s))
      refSigCache.set(ref.id, sig)
    }
    return sig
  }
  let migrated = 0
  for (const frame of frames) {
    // 主序列与「按步骤接线」的节点不能压缩成一步卡片引用：它们靠每个步骤各一个接线口挂注入/结果，
    // 压成一步后步骤序号整体错位（注入会落到整张卡片之后），所以这些节点保持副本形态。
    const stepPortNodes = new Set<string>()
    for (const lane of frameLanes(frame)) {
      if (lane.type === 'main') for (const id of lane.nodeIds) stepPortNodes.add(id)
    }
    for (const edge of Object.values(frame.edges ?? {})) {
      for (const key of [edge.from, edge.to]) {
        const parsed = parseSeqPortKey(key)
        if (parsed) stepPortNodes.add(parsed.seqId)
      }
    }
    for (const [nodeId, node] of Object.entries(frame.nodes ?? {})) {
      if (stepPortNodes.has(nodeId)) continue
      const ref = node.refId ? libIndex.get(node.refId) : undefined
      if (!ref || !isLosslessCopy(node, ref, refSignatures(ref))) continue
      // 无参数卡片不做「引用化」：与手动拖拽（cardToNode）保持一致——卡片内容留在节点里，
      // 编辑节点时能看到步骤；压成一步引用只会多出一个看不到步骤的「中转卡片」。
      if (!(ref.params ?? []).some((p) => String(p?.name ?? '').trim())) continue
      frame.nodes[nodeId] = refCardNode(node, ref)
      migrated += 1
    }
  }
  return migrated
}

// ==================== 工况框（frames）展开 ====================

/** 泳道类型中文名 */
export const FRAME_LANE_LABEL: Record<FrameLaneType, string> = {
  main: '主序列',
  other: '其它',
}

const LEGACY_LANE_TYPE_MAP: Record<string, FrameLaneType> = {
  inject: 'other',
  recover: 'other',
  sequence: 'main',
  result: 'other',
}

/** 归一化泳道类型：旧的四类（inject/recover/sequence/result）折叠为 main/other */
export function normalizeLaneType(t: string): FrameLaneType {
  if (t === 'main' || t === 'other') return t
  return LEGACY_LANE_TYPE_MAP[t] || 'other'
}

/** 获取工况框的泳道列表；旧数据（injects/recovers/sequenceId/results 或四类 lanes）就地迁移为 main/other */
export function frameLanes(frame: CaseFrame): FrameLane[] {
  if (frame.lanes && frame.lanes.length) {
    // 类型已规范时直接返回原数组：调用方只读 id/type/nodeIds，若一律 `{ ...l }` 展开，
    // 会把纯展示用的 lane.width 也读成响应式依赖 —— 拖泳道宽度就会让「用例展开」
    // 与「连线校验」两个 computed 对所有工况整体失效重算（大配置下每帧上百毫秒）。
    if (frame.lanes.every((l) => l.type === normalizeLaneType(l.type))) return frame.lanes
    return frame.lanes.map((l) => ({ ...l, type: normalizeLaneType(l.type) }))
  }
  const lanes: FrameLane[] = []
  if (frame.injects?.length) lanes.push({ id: 'legacy-inject', type: 'other', nodeIds: [...frame.injects] })
  if (frame.recovers?.length) lanes.push({ id: 'legacy-recover', type: 'other', nodeIds: [...frame.recovers] })
  if (frame.sequenceId) lanes.push({ id: 'legacy-main', type: 'main', nodeIds: [frame.sequenceId] })
  if (frame.results?.length) lanes.push({ id: 'legacy-result', type: 'other', nodeIds: [...frame.results] })
  return lanes
}

/** 主序列节点 id（主序列泳道的第一张卡片，即用例主干） */
export function frameSequenceId(frame: CaseFrame): string | null {
  const lane = frameLanes(frame).find((l) => l.type === 'main')
  return lane?.nodeIds?.[0] ?? null
}

/** 某个节点所属的泳道（按 nodeId 查找） */
export function frameLaneOf(frame: CaseFrame, nodeId: string): FrameLane | null {
  for (const lane of frameLanes(frame)) {
    if (lane.nodeIds.includes(nodeId)) return lane
  }
  return null
}

/** 某个节点所属泳道类型 */
export function frameNodeLaneType(frame: CaseFrame, nodeId: string): FrameLaneType | null {
  return frameLaneOf(frame, nodeId)?.type ?? null
}

/** 是否故障注入口 key */
export function isInjectKey(key: string): boolean {
  return key.startsWith('inj:')
}

/** 是否故障恢复口 key */
export function isRecoverKey(key: string): boolean {
  return key.startsWith('rec:')
}

/** 是否结果判断口 key */
export function isResultKey(key: string): boolean {
  return key.startsWith('res:')
}

/** 是否普通卡片口 key（其它泳道卡片，node:<nodeId>） */
export function isNodeKey(key: string): boolean {
  return key.startsWith('node:')
}

/** 是否卡片口 key（node: 或旧键 inj:/rec:/res:，用于兼容历史数据） */
export function isCardKey(key: string): boolean {
  return (
    key.startsWith('node:') ||
    key.startsWith('inj:') ||
    key.startsWith('rec:') ||
    key.startsWith('res:')
  )
}

/** 卡片口 key → nodeId（node: 或旧键 inj:/rec:/res:） */
export function cardKeyNodeId(key: string): string {
  if (key.startsWith('node:')) return key.slice(5)
  return key.slice(4)
}

/**
 * 序列接线口 key 的解析结果。
 * - 新格式 `seq:<seqId>@<stepId>`：锚定到某个步骤，步骤增删/重排后连线自动跟随；
 * - 旧格式 `seq:<seqId>:<idx>`：按步骤序号，仅作历史数据兼容。
 */
export interface SeqPortKey {
  seqId: string
  /** 锚定的步骤 id（新格式） */
  stepId?: string
  /** 步骤序号（旧格式） */
  idx?: number
}

/** 序列接线口 key（锚定到步骤 id） */
export function seqPortKey(seqId: string, stepId: string): string {
  return `seq:${seqId}@${stepId}`
}

/** 解析序列接线口 key（新旧两种格式都认） */
export function parseSeqPortKey(key: string): SeqPortKey | null {
  if (typeof key !== 'string' || !key.startsWith('seq:')) return null
  const body = key.slice(4)
  const at = body.lastIndexOf('@')
  if (at >= 0) {
    const seqId = body.slice(0, at)
    const stepId = body.slice(at + 1)
    return seqId && stepId ? { seqId, stepId } : null
  }
  const p = body.lastIndexOf(':')
  if (p < 0) return null
  const idx = Number(body.slice(p + 1))
  if (!Number.isInteger(idx)) return null
  return { seqId: body.slice(0, p), idx }
}

/** 接线口 → 步骤下标：锚定的步骤已删除、或旧序号越界时返回 null（悬空） */
export function resolveSeqPortIdx(port: SeqPortKey, steps: CardStep[]): number | null {
  if (port.stepId !== undefined) {
    const i = steps.findIndex((s) => s.id === port.stepId)
    return i < 0 ? null : i
  }
  const idx = port.idx ?? -1
  return idx >= 0 && idx < steps.length ? idx : null
}

/**
 * 历史数据迁移：把「按序号」的序列接线口 `seq:<seqId>:<idx>` 升级成锚定格式
 * `seq:<seqId>@<stepId>`。序号格式在步骤增删后会错位，而且画布渲染的端口 key 是锚定格式，
 * 对不上就一条线都画不出来（静默失效），所以打开配置时先就地升级一遍。
 * 就地修改 graph（含各分组的 frames），返回升级的端口数。
 */
export function migrateSeqPortKeys(graph: Graph): number {
  let fixed = 0
  const seen = new Set<CaseFrame[]>()
  const doFrames = (frames?: CaseFrame[]): void => {
    for (const frame of frames ?? []) {
      const seqId = frameSequenceId(frame)
      if (!seqId) continue
      const steps = frame.nodes?.[seqId]?.steps ?? []
      for (const e of Object.values(frame.edges ?? {})) {
        for (const end of ['from', 'to'] as const) {
          const port = parseSeqPortKey(e[end])
          if (!port || port.stepId !== undefined || port.seqId !== seqId) continue
          const idx = resolveSeqPortIdx(port, steps)
          const stepId = idx === null ? undefined : steps[idx]?.id
          if (!stepId) continue
          e[end] = seqPortKey(seqId, stepId)
          fixed += 1
        }
      }
    }
  }
  for (const grp of graph.groups ?? []) {
    if (!Array.isArray(grp.frames)) continue
    seen.add(grp.frames)
    doFrames(grp.frames)
  }
  if (Array.isArray(graph.frames) && !seen.has(graph.frames)) doFrames(graph.frames)
  return fixed
}

/**
 * 主序列步骤变化后修正接线口锚点（保存主序列卡片 / 从卡片库同步后调用）：
 * - 锚定的步骤仍在 → 不动（锚点自动跟随，这正是锚定的意义）；
 * - 锚定的步骤被删 → 就近改锚到相邻的存活步骤（先往前找，再往后找）；
 * - 旧序号格式 → 转成锚定格式（序号越界时吸附到最近的合法步骤）。
 * 返回被修正的连线条数。
 */
export function reanchorFrameSeqPorts(frame: CaseFrame, oldSeqSteps: CardStep[]): number {
  const seqId = frameSequenceId(frame)
  if (!seqId || !frame.edges) return 0
  const steps = frame.nodes?.[seqId]?.steps ?? []
  const live = new Set(steps.map((s) => s.id))
  const oldIds = oldSeqSteps.map((s) => s.id)
  /** 被删步骤 → 就近的存活步骤 id（先往前找，再往后找） */
  const nearestAlive = (stepId: string): string | null => {
    const k = oldIds.indexOf(stepId)
    if (k < 0) return null
    for (let i = k - 1; i >= 0; i--) if (live.has(oldIds[i])) return oldIds[i]
    for (let i = k + 1; i < oldIds.length; i++) if (live.has(oldIds[i])) return oldIds[i]
    return null
  }
  let fixed = 0
  for (const eid of Object.keys(frame.edges)) {
    const e = frame.edges[eid]
    let touched = false
    for (const end of ['from', 'to'] as const) {
      const port = parseSeqPortKey(e[end])
      if (!port || port.seqId !== seqId) continue
      if (port.stepId !== undefined && live.has(port.stepId)) continue
      const stepId =
        port.stepId !== undefined
          ? nearestAlive(port.stepId)
          : steps[Math.min(Math.max(port.idx ?? 0, 0), steps.length - 1)]?.id ?? null
      if (!stepId) continue
      e[end] = seqPortKey(seqId, stepId)
      touched = true
    }
    if (touched) fixed += 1
  }
  return fixed
}

/**
 * 载入自愈：处理「悬空」的序列接线口锚点（锚定的步骤在序列里已不存在）。
 *
 * 覆盖 reanchorFrameSeqPorts 够不到的场景：离线脚本改过配置、从共享盘/别人机器导入、
 * 整张主序列卡片被删掉重拖等，都会留下锚点失效的连线。这类连线当前既画不出来、
 * 也不参与用例展开，所以只动它们对现有可见行为零影响。
 *
 * 按「另一端卡片 + 端侧」分组判定，两类分开处理（实测 A47B：260 条悬空里 236 条属第一类）：
 * - **过时残留**：同组里还有一条活边（锚在存活步骤上）→ 用户意图已由活边承载，
 *   这条是看不见也不参与生成的死副本；一律吸附会凭空造出重复用例（实测用例数翻倍），
 *   所以直接删除。
 * - **唯一断线**：同组里没有任何活边 → 用例的注入/检查真的断了，吸附到最后一个存活步骤接回来。
 *
 * 键格式不变（仍是 seq:<seqId>@<stepId>），因此前后版本读到的 JSON 形态完全一致。
 * 就地修改 frame，返回 { repaired: 接回的连线条数, removed: 清理的残留连线条数 }。
 */
export function normalizeStaleSeqAnchors(frame: CaseFrame): {
  repaired: number
  removed: number
} {
  const seqId = frameSequenceId(frame)
  if (!seqId || !frame.edges) return { repaired: 0, removed: 0 }
  const steps = frame.nodes?.[seqId]?.steps ?? []
  const last = steps[steps.length - 1]?.id
  if (!last) return { repaired: 0, removed: 0 }

  // 一次扫描：把序列端口按「另一端卡片 + 端侧」分组，标出该组是否已有活边
  const groups = new Map<string, { live: boolean; stale: string[] }>()
  for (const [eid, e] of Object.entries(frame.edges)) {
    for (const side of ['from', 'to'] as const) {
      const port = parseSeqPortKey(e[side])
      if (!port || port.seqId !== seqId) continue
      const key = `${side === 'from' ? e.to : e.from}|${side}`
      let g = groups.get(key)
      if (!g) {
        g = { live: false, stale: [] }
        groups.set(key, g)
      }
      if (resolveSeqPortIdx(port, steps) !== null) g.live = true
      else g.stale.push(eid)
    }
  }
  const residue = new Set<string>()
  for (const g of groups.values()) {
    if (!g.live) continue
    for (const eid of g.stale) residue.add(eid)
  }

  let repaired = 0
  let removed = 0
  for (const eid of Object.keys(frame.edges)) {
    if (residue.has(eid)) {
      delete frame.edges[eid]
      removed += 1
      continue
    }
    const e = frame.edges[eid]
    let touched = false
    for (const end of ['from', 'to'] as const) {
      const port = parseSeqPortKey(e[end])
      if (!port || port.seqId !== seqId) continue
      if (resolveSeqPortIdx(port, steps) !== null) continue
      e[end] = seqPortKey(seqId, last)
      touched = true
    }
    if (touched) repaired += 1
  }
  return { repaired, removed }
}

/** 参数占位符 {{name}} 的展示替换：有值用值，没值显示参数名本身（永不显示花括号） */
function resolveParamsText(text: string, values: Record<string, string>): string {
  if (!text || !text.includes('{{')) return text
  return text.replace(CARD_PARAM_REF_RE, (_m, raw: string) => {
    const n = String(raw).trim()
    const v = values[n]
    return v === undefined || String(v).trim() === '' ? n : String(v)
  })
}

/** 节点可用参数默认值：先取它引用的库卡片（refId）的 params，再被节点自己的 params 覆盖。
 *  副本节点常常没带 params，而参数声明留在库卡片上——不回落到库卡片就解析不出值。 */
function nodeParamDefaults(node: Card, cardLookup?: Map<string, Card>): Record<string, string> {
  const values: Record<string, string> = {}
  const ref = node.refId && cardLookup ? cardLookup.get(node.refId) : undefined
  for (const src of [ref, node]) {
    for (const p of src?.params ?? []) {
      const n = String(p.name ?? '').trim()
      if (!n) continue
      values[n] = p.default === undefined || p.default === null ? '' : String(p.default)
    }
  }
  return values
}

/**
 * 节点生效的参数值（与后端 _node_param_values + 引用处 args 覆盖一致）：
 * 1) 引用卡片（refId）声明的 params 默认值；2) 节点自己的 params 覆盖；
 * 3) 节点内「卡片引用」步骤的 args（即编辑面板里「参数取值」填的值）覆盖。
 * 展示与生成必须用同一套值，否则界面会停在参数名/占位符上。
 */
export function nodeParamValues(node: Card, cardLookup?: Map<string, Card>): Record<string, string> {
  const values = nodeParamDefaults(node, cardLookup)
  for (const s of node.steps ?? []) {
    if (s.kind !== 'card') continue
    for (const a of s.args ?? []) {
      const k = String(a.key ?? '').trim()
      if (!k) continue
      values[k] = a.value === undefined || a.value === null ? '' : String(a.value)
    }
  }
  return values
}

/** 端口 key 对应的展示标签（与后端 _frame_node_label 对齐）；标签里的 {{参数}} 一并解析掉 */
export function frameNodeLabel(frame: CaseFrame, key: string, cardLookup?: Map<string, Card>): string {
  if (isNodeKey(key)) {
    const node = frame.nodes[key.slice(5)]
    if (node) return node.name || node.id || key
    return key
  }
  if (isInjectKey(key) || isRecoverKey(key) || isResultKey(key)) {
    const node = frame.nodes[key.slice(4)]
    if (node) return node.name || node.id || key
    return key
  }
  const parsed = parseSeqPortKey(key)
  if (parsed) {
    const seqNode = frame.nodes[parsed.seqId]
    const idx = seqNode ? resolveSeqPortIdx(parsed, seqNode.steps ?? []) : null
    const step = idx === null ? undefined : seqNode?.steps[idx]
    if (step) {
      if (step.kind === 'card') return step.cardName || step.cardId || '卡片引用'
      // 步骤名也可能被参数化（如 fun = "Sensor{{ch}}_oN"）
      return resolveParamsText(step.fun || step.kind || '(空)', nodeParamValues(seqNode, cardLookup))
    }
  }
  return key
}

// ==================== 工况框校验（悬空连线 / 孤立卡片） ====================

/** 工况框校验问题类型 */
export type FrameIssueKind =
  | 'no-sequence'
  | 'empty-sequence'
  | 'dangling-edge'
  | 'cross-main-edge'
  | 'orphan-node'
  | 'floating-node'
  | 'param-unresolved'
  | 'missing-func'

/** 单条校验问题 */
export interface FrameIssue {
  kind: FrameIssueKind
  /** 展示文本（连线为「A → B」，卡片为卡片名） */
  label: string
  /** 原因说明 */
  reason: string
  /** 悬空连线的稳定 key（frameEdgeKey） */
  edgeId?: string
  /** 涉及卡片 id（孤立/未接入主序列） */
  nodeId?: string
}

/** 工况框校验结果 */
export interface FrameDiagnostics {
  issues: FrameIssue[]
  /** 悬空连线 key 集合 */
  danglingEdgeIds: Set<string>
  /** 异常卡片 id 集合：孤立（无连线）或未接入主序列 */
  invalidNodeIds: Set<string>
  /** 是否存在问题 */
  ok: boolean
}

/** 端口相对主序列的位置类别：主序列泳道（含序列接线口）= main，其左侧泳道 = left，右侧 = right */
export type FramePortSide = 'left' | 'right' | 'main' | 'unknown'

/** 端口所在侧别。序列接线口恒为 main；卡片口按所在泳道与主序列泳道的先后判定 */
export function framePortSide(frame: CaseFrame, key: string): FramePortSide {
  if (parseSeqPortKey(key)) return 'main'
  if (!isCardKey(key)) return 'unknown'
  const lanes = frameLanes(frame)
  const mi = lanes.findIndex((l) => l.type === 'main')
  if (mi < 0) return 'unknown'
  const li = lanes.findIndex((l) => l.nodeIds.includes(cardKeyNodeId(key)))
  if (li < 0) return 'unknown'
  if (li === mi) return 'main'
  return li < mi ? 'left' : 'right'
}

/**
 * 连线是否「压过主序列」。
 *
 * 主序列卡片占住主序列列，它的输入口在卡片**左缘**、输出口在**右缘**，所以：
 * - 入口 `卡片 → 主序列`：卡片必须在主序列**左侧**，否则连线是从右往左压过主序列卡片；
 * - 出口 `主序列 → 卡片`：卡片必须在主序列**右侧**，否则同样是从右往左压过主序列卡片；
 * - 链式 `卡片 → 卡片`：两端必须在主序列**同一侧**，否则连线跨过主序列。
 *
 * 侧别判不出来（没有主序列泳道、卡片不在任何泳道）时一律放行，避免误判。
 */
export function frameEdgeCrossesMain(frame: CaseFrame, fromKey: string, toKey: string): boolean {
  const fromSeq = !!parseSeqPortKey(fromKey)
  const toSeq = !!parseSeqPortKey(toKey)
  if (fromSeq && !toSeq) return framePortSide(frame, toKey) === 'left'
  if (!fromSeq && toSeq) return framePortSide(frame, fromKey) === 'right'
  if (!fromSeq && !toSeq) {
    const a = framePortSide(frame, fromKey)
    const b = framePortSide(frame, toKey)
    return (a === 'left' && b === 'right') || (a === 'right' && b === 'left')
  }
  return false
}

/**
 * 校验工况框，找出「悬空连线」与「孤立卡片」。
 * - 悬空连线：端点卡片已被删除、或序列接线口失效（锚定的步骤已删除 / 旧序号越界）。这类线在画布上画不出来
 *   （端口找不到 → 跳过绘制），也不会参与用例展开，属于静默失效，必须显式提示。
 * - 孤立卡片：完全没有连线，或连了线但整条链未接入主序列，都不会出现在任何用例里。
 */
export function frameDiagnostics(
  frame: CaseFrame,
  cardLookup?: Map<string, Card>,
  funcNames?: ReadonlySet<string>,
): FrameDiagnostics {
  const issues: FrameIssue[] = []
  const danglingEdgeIds = new Set<string>()
  const invalidNodeIds = new Set<string>()

  const nodes = frame.nodes || {}
  const nodeIds = Object.keys(nodes)
  const seqId = frameSequenceId(frame)
  const laneNodeIds = new Set<string>()
  for (const lane of frameLanes(frame)) for (const nid of lane.nodeIds) laneNodeIds.add(nid)
  const stepCount = (nid: string): number => nodes[nid]?.steps?.length ?? 0
  const nameOf = (nid: string): string => nodes[nid]?.name || nid
  /** 端口 key 的可读展示：已知卡片用卡片名，已删除的用 `已删除卡片(id)` 而非内部端口键 */
  const labelOf = (key: string): string => {
    if (isCardKey(key) && !nodeIds.includes(cardKeyNodeId(key))) {
      return `已删除卡片(${cardKeyNodeId(key)})`
    }
    const seq = parseSeqPortKey(key)
    if (seq && !nodeIds.includes(seq.seqId)) return `已删除序列(${seq.seqId})`
    return frameNodeLabel(frame, key, cardLookup)
  }

  /** 接线口是否为「锚点漂移」：主序列还在，但锚定的步骤已被删除 / 旧序号越界。
   *  这类线画不出来、也不参与生成，但属于步骤增删后的正常漂移（改锚即可恢复），
   *  不作为「悬空连线」提示 —— 提示只留给「端点卡片已删除」这种真正丢内容的线。 */
  const isStaleSeqAnchor = (key: string): boolean => {
    const seq = parseSeqPortKey(key)
    if (!seq) return false
    const seqNode = nodes[seq.seqId]
    if (!seqNode) return false
    return resolveSeqPortIdx(seq, seqNode.steps ?? []) === null
  }

  /** 端口 key 是否有效：返回 null 表示有效，否则返回失效原因 */
  const portIssue = (key: string): string | null => {
    const seq = parseSeqPortKey(key)
    if (seq) {
      const seqNode = nodes[seq.seqId]
      if (!seqNode) return '主序列卡片已删除'
      const steps = seqNode.steps ?? []
      if (resolveSeqPortIdx(seq, steps) !== null) return null
      if (seq.stepId !== undefined) return `锚定的步骤已删除（${seq.stepId}）`
      return `接线口越界（第 ${(seq.idx ?? 0) + 1} 个，序列共 ${steps.length} 步）`
    }
    if (isCardKey(key)) {
      const nid = cardKeyNodeId(key)
      if (!nodeIds.includes(nid)) return '卡片已删除'
      if (!laneNodeIds.has(nid)) return '卡片不在任何泳道中'
      return null
    }
    return '无法识别的端口'
  }

  // 1) 悬空连线
  const validEdges: FrameEdge[] = []
  for (const e of Object.values(frame.edges || {})) {
    const fromIssue = portIssue(e.from)
    const toIssue = portIssue(e.to)
    if (!fromIssue && !toIssue) {
      validEdges.push(e)
      continue
    }
    const key = frameEdgeKey(e)
    danglingEdgeIds.add(key)
    // 两端都是「锚点漂移」→ 不提示（只提示端点卡片已删除这类真正丢内容的线）
    const fails = [
      { key: e.from, issue: fromIssue },
      { key: e.to, issue: toIssue },
    ].filter((x) => x.issue)
    if (fails.every((x) => isStaleSeqAnchor(x.key))) continue
    issues.push({
      kind: 'dangling-edge',
      edgeId: key,
      label: `${labelOf(e.from)} → ${labelOf(e.to)}`,
      reason: fromIssue || toIssue || '端口无效',
    })
  }

  // 1.5) 压过主序列的连线：入口来自右侧卡片 / 出口落到左侧卡片 / 两侧卡片互连。
  //      创建时已拦截，这里兜住「先连线、后把卡片拖到另一侧」这类位置变动造成的违规。
  for (const e of validEdges) {
    if (!frameEdgeCrossesMain(frame, e.from, e.to)) continue
    issues.push({
      kind: 'cross-main-edge',
      edgeId: frameEdgeKey(e),
      label: `${labelOf(e.from)} → ${labelOf(e.to)}`,
      reason: '连线压过了主序列：入口要接主序列左侧的卡片、出口要接主序列右侧的卡片，两侧卡片不能互连',
    })
  }

  // 2) 缺少主序列 / 主序列为空（完全空白的工况不提示）
  if (!seqId) {
    if (nodeIds.length) {
      issues.push({
        kind: 'no-sequence',
        label: '缺少主序列',
        reason: '工况内没有主序列卡片，无法展开用例',
      })
    }
  } else if (!stepCount(seqId)) {
    issues.push({
      kind: 'empty-sequence',
      nodeId: seqId,
      label: nameOf(seqId),
      reason: '主序列没有任何步骤',
    })
  }

  // 3) 卡片连通性：孤立（无连线）/ 未接入主序列（悬浮链）
  if (seqId) {
    const adj = new Map<string, Set<string>>()
    const link = (a: string, b: string): void => {
      if (!adj.has(a)) adj.set(a, new Set())
      if (!adj.has(b)) adj.set(b, new Set())
      ;(adj.get(a) as Set<string>).add(b)
      ;(adj.get(b) as Set<string>).add(a)
    }
    const touched = new Set<string>()
    for (const e of validEdges) {
      const a = isCardKey(e.from) ? cardKeyNodeId(e.from) : parseSeqPortKey(e.from)?.seqId
      const b = isCardKey(e.to) ? cardKeyNodeId(e.to) : parseSeqPortKey(e.to)?.seqId
      if (!a || !b) continue
      touched.add(a)
      touched.add(b)
      link(a, b)
    }
    const reachable = new Set<string>()
    if (adj.has(seqId)) {
      reachable.add(seqId)
      const stack = [seqId]
      while (stack.length) {
        const cur = stack.pop() as string
        for (const nx of adj.get(cur) ?? []) {
          if (!reachable.has(nx)) {
            reachable.add(nx)
            stack.push(nx)
          }
        }
      }
    }
    for (const nid of nodeIds) {
      if (nid === seqId) continue
      if (!touched.has(nid)) {
        invalidNodeIds.add(nid)
        issues.push({
          kind: 'orphan-node',
          nodeId: nid,
          label: nameOf(nid),
          reason: '没有任何连线，不会出现在任何用例中',
        })
      } else if (!reachable.has(nid)) {
        invalidNodeIds.add(nid)
        issues.push({
          kind: 'floating-node',
          nodeId: nid,
          label: nameOf(nid),
          reason: '未接入主序列，不会出现在任何用例中',
        })
      }
    }
  }

  // 4) 参数占位符解析不到值：生成时该项会被按「不参与」丢掉（见后端 _substitute_card_params），
  //    这里显式提示，避免「用例里少了一步」这种静默失效。
  for (const [nid, node] of Object.entries(nodes)) {
    const missing = unresolvedParamNames(node, cardLookup)
    if (!missing.length) continue
    issues.push({
      kind: 'param-unresolved',
      nodeId: nid,
      label: nameOf(nid),
      reason: `参数 ${missing.join('、')} 没有值：请在引用处的「参数取值」里填值，或给卡片参数设默认值（生成时这些项不会参与）`,
    })
  }

  // 5) 步骤调用的函数在函数库里找不到（函数被裁剪 / 改名后卡片仍在调用）。
  //    这类卡片生成出的 CAPL 会编译不过，必须显式提示；节点一并标为异常，画布上按 ⚠ 显示。
  if (funcNames && funcNames.size) {
    for (const [nid, node] of Object.entries(nodes)) {
      const missing = collectCalledFunctionNames(node.steps).filter(
        (n) => !funcNames.has(n) && !EXTERNAL_CALL_WHITELIST.has(n),
      )
      if (!missing.length) continue
      invalidNodeIds.add(nid)
      issues.push({
        kind: 'missing-func',
        nodeId: nid,
        label: nameOf(nid),
        reason: `调用了函数库里不存在的函数：${missing.join('、')}（生成时 CAPL 会编译不过）`,
      })
    }
  }

  return { issues, danglingEdgeIds, invalidNodeIds, ok: !issues.length }
}

/** 步骤里会参与 {{参数}} 替换的文本字段（与 substituteCardParams 保持一致） */
const STEP_TEXT_FIELDS = ['raw', 'fun', 'rate', 'cycleTime', 'time'] as const
/** 参数行里会参与 {{参数}} 替换的文本字段（与 substituteCardParams 保持一致） */
const ARG_TEXT_FIELDS = ['value', 'key', 'argType', 'value2'] as const

/** 节点里解析不到值的参数名（节点/其库卡片都没默认值，引用步骤也没填） */
function unresolvedParamNames(node: Card, cardLookup?: Map<string, Card>): string[] {
  const names = new Set<string>()
  // 直接扫「参与替换的文本字段」：原来是把整个 steps 序列化后正则匹配，
  // 而画布诊断对每个节点都要调一次（大工况下上百个节点），这一步就是每次交互的主要开销
  const scan = (s: unknown) => {
    if (typeof s !== 'string' || !s.includes('{{')) return
    for (const m of s.matchAll(CARD_PARAM_REF_RE)) names.add(String(m[1]).trim())
  }
  for (const step of node.steps ?? []) {
    if (!step) continue
    for (const k of STEP_TEXT_FIELDS) scan(step[k])
    for (const a of step.args ?? []) {
      if (!a) continue
      for (const k of ARG_TEXT_FIELDS) scan(a[k])
    }
  }
  if (!names.size) return []
  const values = nodeParamValues(node, cardLookup)
  return [...names].filter((n) => !(n in values) || String(values[n] ?? '').trim() === '')
}

/** 步骤里出现过的 {{参数}} 名（去重）。用于把步骤里的占位符「反推」成卡片参数声明：
 *  历史卡片 / 手工写的步骤常常只有占位符没声明参数，界面上就没有可填值的参数接口。 */
export function collectStepParamNames(steps?: CardStep[]): string[] {
  const names = new Set<string>()
  const scan = (s: unknown) => {
    if (typeof s !== 'string' || !s.includes('{{')) return
    for (const m of s.matchAll(CARD_PARAM_REF_RE)) {
      const n = String(m[1]).trim()
      if (n) names.add(n)
    }
  }
  for (const step of steps ?? []) {
    if (!step) continue
    for (const k of STEP_TEXT_FIELDS) scan(step[k])
    for (const a of step.args ?? []) {
      if (!a) continue
      for (const k of ARG_TEXT_FIELDS) scan(a[k])
    }
  }
  return [...names]
}

/** 卡片步骤里「直接调用」的函数名（call / wait / loop_start 的 fun 字段）；
 *  带 {{参数}} 的动态函数名无法静态判定，跳过。 */
export function collectCalledFunctionNames(steps?: CardStep[]): string[] {
  const names = new Set<string>()
  for (const s of steps ?? []) {
    if (!s || (s.kind !== 'call' && s.kind !== 'wait' && s.kind !== 'loop_start')) continue
    const n = String(s.fun ?? '').trim()
    if (n && !n.includes('{{')) names.add(n)
  }
  return [...names]
}

/**
 * 「外部函数」白名单：不属于函数库、但生成出的 CAPL 里仍然可用（CANoe 内置 test / 系统变量 API、
 * 以及 .cin 里定义的公共函数）。这些不会出现在函数库解析结果里，属于正常调用，
 * 不参与「调用了函数库里不存在的函数」的告警。遇到新的外部函数，往这里追加即可。
 */
export const EXTERNAL_CALL_WHITELIST: ReadonlySet<string> = new Set<string>([
  // CANoe 系统变量 API
  'putValue',
  'getValue',
  // CANoe Test Feature Set
  'testEnableMsg',
  'testDisableMsg',
  // 项目 .cin 里定义的公共函数（非函数库内容）
  'setSignal',
  'testenableMsg',
])

/** 连线编号解析结果 */
export interface FrameNumberInfo {
  /** 边 id → 生效编号（含继承） */
  edgeNums: Map<string, number[]>
  /** 用例编号集合（主序列入口连线生效编号的并集） */
  caseNums: number[]
}

interface FrameLink {
  id: string
  from: string
  to: string
  explicit: number[] | null
  /** 连线在配置中的先后顺序（用于按连线先后排号） */
  ord: number
}

/** 工况框连线的稳定 key（优先用边 id） */
export function frameEdgeKey(e: FrameEdge): string {
  return e.id || `${e.from}->${e.to}`
}

/**
 * 解析工况框每条连线生效的编号：
 * - 显式填写的编号优先；
 * - 起始卡片（无左侧入线）的每根出线按顺序独立排号（分叉即新用例，1、2、3…）；
 * - 非起始卡片的出线默认继承其左侧入线编号的并集（汇合处继承多个编号）。
 */
export function resolveFrameNumbers(frame: CaseFrame): FrameNumberInfo {
  const seqId = frameSequenceId(frame)
  const lanes = frameLanes(frame)
  const laneIndex = new Map<string, number>()
  const nodeIndex = new Map<string, number>()
  const allNodeIds: string[] = []
  lanes.forEach((lane, li) => {
    lane.nodeIds.forEach((nid, ni) => {
      laneIndex.set(nid, li)
      nodeIndex.set(nid, ni)
      allNodeIds.push(nid)
    })
  })
  for (const nid of Object.keys(frame.nodes || {})) {
    if (!laneIndex.has(nid)) {
      laneIndex.set(nid, Number.MAX_SAFE_INTEGER)
      nodeIndex.set(nid, Number.MAX_SAFE_INTEGER)
      allNodeIds.push(nid)
    }
  }

  const entryLinks: FrameLink[] = []
  const exitLinks: FrameLink[] = []
  const chainLinks: FrameLink[] = []
  let ord = 0
  for (const e of Object.values(frame.edges)) {
    const cur = ord++
    const fromSeq = parseSeqPortKey(e.from)
    const toSeq = parseSeqPortKey(e.to)
    const pair = e.pair ?? []
    let explicit: number[] | null = pair.length ? [...pair] : null
    if (isCardKey(e.from) && toSeq && toSeq.seqId === seqId) {
      if (!explicit && (e.seq ?? 0) > 0) explicit = [e.seq as number]
      entryLinks.push({ id: frameEdgeKey(e), from: cardKeyNodeId(e.from), to: seqId || '', explicit, ord: cur })
    } else if (fromSeq && fromSeq.seqId === seqId && isCardKey(e.to)) {
      exitLinks.push({ id: frameEdgeKey(e), from: seqId || '', to: cardKeyNodeId(e.to), explicit, ord: cur })
    } else if (isCardKey(e.from) && isCardKey(e.to)) {
      chainLinks.push({ id: frameEdgeKey(e), from: cardKeyNodeId(e.from), to: cardKeyNodeId(e.to), explicit, ord: cur })
    }
  }
  const allLinks = [...entryLinks, ...exitLinks, ...chainLinks]

  const incomingOf = (nid: string): FrameLink[] => [
    ...chainLinks.filter((l) => l.to === nid),
    ...exitLinks.filter((l) => l.to === nid),
  ]

  // 能到达主序列的卡片集合（用于「决定用例号」的优先排号）
  const rev = new Map<string, string[]>()
  for (const l of [...chainLinks, ...entryLinks]) {
    const arr = rev.get(l.to) ?? []
    arr.push(l.from)
    rev.set(l.to, arr)
  }
  const reachable = new Set<string>()
  if (seqId) {
    const stack = [seqId]
    while (stack.length) {
      const cur = stack.pop() as string
      for (const p of rev.get(cur) ?? []) {
        if (!reachable.has(p)) {
          reachable.add(p)
          stack.push(p)
        }
      }
    }
  }

  const memo = new Map<string, number[]>()
  const edgeNums = new Map<string, number[]>()
  const visiting = new Set<string>()
  let nextNum = 1

  // 锚点已失效的连线（锚定的主序列步骤被删 / 旧序号越界）：画不出来、也不参与用例生成。
  // 自动排号必须跳过它们，否则这些死线会把 1、2、3… 的用例号白白占掉
  // （新画的起始卡片出线就只能从「死线数 + 1」开始排）。
  const seqNode = seqId ? frame.nodes?.[seqId] : null
  const staleEdgeIds = new Set<string>()
  for (const e of Object.values(frame.edges ?? {})) {
    for (const port of [parseSeqPortKey(e.from), parseSeqPortKey(e.to)]) {
      if (!port || port.seqId !== seqId) continue
      if (resolveSeqPortIdx(port, seqNode?.steps ?? []) !== null) continue
      staleEdgeIds.add(frameEdgeKey(e))
      break
    }
  }

  // 起始卡片（无左侧入线）的每根出线按顺序独立排号（分叉即新用例）
  const assignStartOutgoing = (onlyReachable: boolean) => {
    const candidates: FrameLink[] = []
    for (const nid of allNodeIds) {
      if (nid === seqId || incomingOf(nid).length) continue
      if (onlyReachable !== reachable.has(nid)) continue
      for (const l of allLinks) {
        if (l.from !== nid) continue
        if (l.explicit && l.explicit.length) continue
        if ((edgeNums.get(l.id) ?? []).length) continue
        if (staleEdgeIds.has(l.id)) continue
        candidates.push(l)
      }
    }
    // 按连线先后顺序排号
    candidates.sort((a, b) => a.ord - b.ord)
    for (const l of candidates) {
      edgeNums.set(l.id, [nextNum])
      nextNum++
    }
  }
  // 先给「能到达主序列」的起始卡片排号（决定用例号），再给其余起始卡片排号
  assignStartOutgoing(true)
  assignStartOutgoing(false)

  const edgeNumsOf = (l: FrameLink): number[] => {
    const cached = edgeNums.get(l.id)
    if (cached) return cached
    if (l.explicit && l.explicit.length) {
      edgeNums.set(l.id, l.explicit)
      return l.explicit
    }
    // 起点有入线 → 继承其入线编号的并集；起点无入线 → 已在上面排号
    const res = nodeNums(l.from)
    edgeNums.set(l.id, res)
    return res
  }
  function nodeNums(nid: string): number[] {
    if (!nid) return []
    const cached = memo.get(nid)
    if (cached) return cached
    if (visiting.has(nid)) return []
    visiting.add(nid)
    const set = new Set<number>()
    // 主序列的「入线」是入口连线（卡片→主序列）；其余节点为链/出口入线
    const inc = nid === seqId ? entryLinks : incomingOf(nid)
    for (const l of inc) for (const n of edgeNumsOf(l)) set.add(n)
    visiting.delete(nid)
    const res = [...set].sort((a, b) => a - b)
    memo.set(nid, res)
    return res
  }

  // 主序列右侧的出线（主序列 → 卡片）：未显式填编号时，按「泳道从左到右、同泳道从上到下」
  // 与左侧入线的编号**按顺序一一配对**（左边 1、2、3 → 右边三根就是 1、2、3），
  // 而不是继承左侧编号的全集（否则每根出线都会出现在所有用例里）。出线多于入线时循环取号。
  // 必须赶在下面 allLinks 循环之前落号，否则会被 nodeNums(seqId) 的全集覆盖。
  const leftNums = seqId ? nodeNums(seqId) : []
  if (leftNums.length) {
    const unnumbered = exitLinks
      .filter((l) => !(edgeNums.get(l.id) ?? []).length && !(l.explicit && l.explicit.length))
      .sort(
        (a, b) =>
          (laneIndex.get(a.to) ?? Number.MAX_SAFE_INTEGER) - (laneIndex.get(b.to) ?? Number.MAX_SAFE_INTEGER) ||
          (nodeIndex.get(a.to) ?? Number.MAX_SAFE_INTEGER) - (nodeIndex.get(b.to) ?? Number.MAX_SAFE_INTEGER),
      )
    unnumbered.forEach((l, k) => edgeNums.set(l.id, [leftNums[k % leftNums.length]]))
  }

  for (const l of allLinks) edgeNumsOf(l)
  let caseNums = seqId ? nodeNums(seqId) : []

  // 用例号由「主序列两侧的接线口」共同定义：
  //   入口连线（卡片 → 主序列）= 注入；出口连线（主序列 → 卡片）= 结果。
  // 某编号只画了「结果」而没画「注入」时同样成用例（无注入：整条主序列 + 该结果卡片），
  // 否则该编号的连线会被静默忽略。需与后端 _resolve_frame_numbers 保持一致。
  const exitNums = new Set<number>()
  for (const l of exitLinks) for (const n of edgeNumsOf(l)) exitNums.add(n)
  if (exitNums.size) {
    caseNums = [...new Set([...caseNums, ...exitNums])].sort((a, b) => a - b)
  }

  // 兜底：入口连线若仍解析不出编号，按入口连线顺序逐一给号
  if (!caseNums.length && entryLinks.length) {
    let i = 1
    for (const l of entryLinks) {
      if (!(edgeNums.get(l.id) ?? []).length) {
        edgeNums.set(l.id, [i])
        i++
      }
    }
    memo.clear()
    caseNums = seqId ? nodeNums(seqId) : []
  }

  // 兜底：仍无编号的连线统一给 1（此时只有一条用例），避免显示「全部」
  if (!caseNums.length) {
    for (const l of allLinks) {
      if (!(edgeNums.get(l.id) ?? []).length) edgeNums.set(l.id, [1])
    }
  }

  return { edgeNums, caseNums }
}

/**
 * 按工况框连线语义展开为有序端口 key 路径（与后端 _expand_frame_paths 一致）。
 * - 主序列为主干（按步骤从上到下，保留多个接线口）。
 * - 其它卡片（含辅序列）可互相串联成链，链头/链尾接到主序列的接线口。
 * - 连线编号由 resolveFrameNumbers 解析（显式优先，未填则继承左入线编号）。
 * - 同编号的线：按泳道从左到右，同泳道从上到下。
 */
export function expandFramePaths(frame: CaseFrame): string[][] {
  const seqId = frameSequenceId(frame)
  const seqNode = seqId ? frame.nodes[seqId] : null
  if (!seqId || !seqNode || !seqNode.steps.length) return []

  const lanes = frameLanes(frame)
  const laneIndexOf = (nodeId: string): number => {
    const i = lanes.findIndex((l) => l.nodeIds.includes(nodeId))
    return i < 0 ? Number.MAX_SAFE_INTEGER : i
  }
  const nodeIndexOf = (nodeId: string): number => {
    const lane = lanes.find((l) => l.nodeIds.includes(nodeId))
    if (!lane) return Number.MAX_SAFE_INTEGER
    const i = lane.nodeIds.indexOf(nodeId)
    return i < 0 ? Number.MAX_SAFE_INTEGER : i
  }
  const nodeIdOf = (key: string): string => cardKeyNodeId(key)

  const { edgeNums, caseNums } = resolveFrameNumbers(frame)

  const entryEdges: Array<{ key: string; stepIdx: number; nums: number[] }> = []
  const exitEdges: Array<{ key: string; stepIdx: number; nums: number[] }> = []
  const chainOut = new Map<string, Array<{ to: string; nums: number[] }>>()
  const chainIn = new Map<string, Array<{ from: string; nums: number[] }>>()
  for (const e of Object.values(frame.edges)) {
    const fromSeq = parseSeqPortKey(e.from)
    const toSeq = parseSeqPortKey(e.to)
    const nums = edgeNums.get(frameEdgeKey(e)) ?? []
    if (isCardKey(e.from) && toSeq && toSeq.seqId === seqId) {
      // 锚定的步骤已删除 → 该线悬空，不参与展开（与后端一致）
      const idx = resolveSeqPortIdx(toSeq, seqNode.steps)
      if (idx !== null) entryEdges.push({ key: nodeIdOf(e.from), stepIdx: idx, nums })
    } else if (fromSeq && fromSeq.seqId === seqId && isCardKey(e.to)) {
      const idx = resolveSeqPortIdx(fromSeq, seqNode.steps)
      if (idx !== null) exitEdges.push({ key: nodeIdOf(e.to), stepIdx: idx, nums })
    } else if (isCardKey(e.from) && isCardKey(e.to)) {
      const a = nodeIdOf(e.from)
      const b = nodeIdOf(e.to)
      const out = chainOut.get(a) ?? []
      out.push({ to: b, nums })
      chainOut.set(a, out)
      const inc = chainIn.get(b) ?? []
      inc.push({ from: a, nums })
      chainIn.set(b, inc)
    }
  }

  // 编号匹配：s=null 表示不过滤；连线编号为空表示对所有用例生效
  const numsMatch = (nums: number[], s: number | null): boolean =>
    s === null || !nums.length || nums.includes(s)
  // 某卡片在该用例号下所有可跟的出线（多条出线=并列结果，都要串联）
  const nextAll = (nodeId: string, s: number | null): string[] =>
    (chainOut.get(nodeId) ?? [])
      .filter((x) => numsMatch(x.nums, s))
      .map((x) => x.to)
      .sort((a, b) => laneIndexOf(a) - laneIndexOf(b) || nodeIndexOf(a) - nodeIndexOf(b))
  const prevFrom = (nodeId: string, s: number | null): string | undefined =>
    (chainIn.get(nodeId) ?? []).find((x) => numsMatch(x.nums, s))?.from

  // 从主序列相邻卡片向链头回溯（链头在前）
  const walkLeft = (nodeId: string, s: number | null): string[] => {
    const cards: string[] = []
    const seen = new Set<string>()
    let cur: string | undefined = nodeId
    while (cur && !seen.has(cur)) {
      seen.add(cur)
      cards.push('node:' + cur)
      cur = prevFrom(cur, s)
    }
    cards.reverse()
    return cards
  }
  // 从主序列相邻卡片向链尾延伸（并列结果全部串联，深度优先、按泳道从左到右）
  const walkRight = (nodeId: string, s: number | null): string[] => {
    const cards: string[] = []
    const seen = new Set<string>()
    const visit = (cur: string) => {
      if (seen.has(cur)) return
      seen.add(cur)
      cards.push('node:' + cur)
      for (const nx of nextAll(cur, s)) visit(nx)
    }
    visit(nodeId)
    return cards
  }

  const buildPath = (
    entries: Array<{ stepIdx: number; cards: string[] }>,
    exits: Array<{ stepIdx: number; cards: string[] }>,
  ): string[] => {
    const seg: string[] = []
    for (let s = 0; s <= seqNode.steps.length; s++) {
      for (const en of entries) if (en.stepIdx === s) seg.push(...en.cards)
      for (const ex of exits) if (ex.stepIdx === s - 1) seg.push(...ex.cards)
      if (s < seqNode.steps.length) seg.push(seqPortKey(seqId, seqNode.steps[s].id))
    }
    return seg
  }

  // 同编号线：泳道从左到右，同泳道从上到下（以「与主序列相邻的卡片」为排序依据）
  const orderByAdjacent = (a: { adjacent: string }, b: { adjacent: string }): number => {
    return laneIndexOf(a.adjacent) - laneIndexOf(b.adjacent) || nodeIndexOf(a.adjacent) - nodeIndexOf(b.adjacent)
  }

  const caseList: Array<number | null> = caseNums.length ? caseNums : [null]
  const paths: string[][] = []
  for (const s of caseList) {
    const entries = entryEdges
      .filter((e) => numsMatch(e.nums, s))
      .map((e) => ({ adjacent: e.key, stepIdx: e.stepIdx, cards: walkLeft(e.key, s) }))
      .sort(orderByAdjacent)
    const exits = exitEdges
      .filter((e) => numsMatch(e.nums, s))
      .map((e) => ({ adjacent: e.key, stepIdx: e.stepIdx, cards: walkRight(e.key, s) }))
      .sort(orderByAdjacent)
    paths.push(buildPath(entries, exits))
  }
  return paths
}

/** 工况框模式的用例数（各框展开路径数求和；传入卡片/值资源库时含 @list 拆分） */
export function countCasesByFrames(
  graph: Graph,
  cardLibrary?: CardLibrary,
  valueLibrary?: ValueResource[],
): number {
  let count = 0
  for (const frame of graph.frames ?? []) count += frameCaseRows(frame, cardLibrary, valueLibrary).length
  return count
}

/** 工况框模式的用例链预览（端口 label 串联） */
export function listFrameChains(graph: Graph, cardLibrary?: CardLibrary): string[][] {
  const cardLookup = buildCardLookup(cardLibrary)
  const chains: string[][] = []
  for (const frame of graph.frames ?? []) {
    for (const path of expandFramePaths(frame)) {
      chains.push(path.map((k) => frameNodeLabel(frame, k, cardLookup)))
    }
  }
  return chains
}

// ==================== 值资源（@const/@list/@range）拆分 ====================

const VALUE_REF_RE = /@(const|list|range):([A-Za-z_]\w*)/g

/** 端口 key 对应的步骤列表（与后端 _frame_node_steps 一致） */
export function frameNodeSteps(frame: CaseFrame, key: string): CardStep[] {
  if (isCardKey(key)) {
    const node = frame.nodes[cardKeyNodeId(key)]
    return node?.steps ?? []
  }
  const parsed = parseSeqPortKey(key)
  if (parsed) {
    const steps = frame.nodes[parsed.seqId]?.steps ?? []
    const idx = resolveSeqPortIdx(parsed, steps)
    const step = idx === null ? undefined : steps[idx]
    return step ? [step] : []
  }
  return []
}

/** 卡片参数占位符：{{名称}}。名称允许中文/下划线/点号等任意非花括号字符，两侧空白忽略——
 *  与后端 _CARD_PARAM_REF_RE 保持一致，否则这类参数会原样泄漏成 {{名称}}。 */
const CARD_PARAM_REF_RE = /\{\{\s*([^{}]+?)\s*\}\}/g

/** 计算卡片引用的参数值：卡片 params 的默认值被引用步骤 args 覆盖 */
function cardParamValues(ref: Card, refStep: CardStep): Record<string, string> {
  const values: Record<string, string> = {}
  for (const p of ref.params ?? []) {
    const name = String(p.name ?? '').trim()
    if (!name) continue
    values[name] = p.default === undefined || p.default === null ? '' : String(p.default)
  }
  for (const a of refStep.args ?? []) {
    const key = String(a.key ?? '').trim()
    if (!key) continue
    values[key] = a.value === undefined || a.value === null ? '' : String(a.value)
  }
  return values
}

/** 空值跳过：解析为空串的参数行可单独丢弃的步骤类型（与后端 _ARGS_SKIP_KINDS 一致） */
const ARGS_SKIP_KINDS = new Set<CardStep['kind']>([
  'check', 'wait_check', 'set', 'reset', 'rate', 'ramp',
])

/** 替换文本里的 {{参数}}，并返回是否出现了「解析为空」的参数。
 *  strict（默认）：找不到值的占位符按「不参与」处理（与后端一致），
 *  保证预览/生成里不会再出现 `{{var}}`——参数漏填应当靠提示暴露，而不是把占位符写进内容。 */
function resolveCardParams(
  s: string,
  values: Record<string, string>,
  strict = true,
): { text: string; blank: boolean } {
  if (!s.includes('{{')) return { text: s, blank: false }
  let blank = false
  const text = s.replace(CARD_PARAM_REF_RE, (m, raw: string) => {
    const n = String(raw).trim()
    if (!(n in values)) {
      if (!strict) return m
      blank = true
      return ''
    }
    const v = String(values[n] ?? '')
    if (v.trim() === '') blank = true
    return v
  })
  return { text, blank }
}

/** 把卡片步骤里的 {{参数}} 替换为具体值，不修改原卡片。
 *  空值跳过语义与后端一致：check/set/reset 只丢该参数行（全丢则整步丢弃）；
 *  card 引用丢该参数（回落默认值）；call/wait 与 raw/fun 出现空值/未解析则整步丢弃。 */
function substituteCardParams(steps: CardStep[], values: Record<string, string>): CardStep[] {
  const out: CardStep[] = []
  for (const step of steps) {
    const next: CardStep = { ...step }
    let dropStep = false
    for (const k of ['raw', 'fun', 'rate', 'cycleTime', 'time'] as const) {
      const cur = next[k]
      if (typeof cur === 'string') {
        const r = resolveCardParams(cur, values)
        next[k] = r.text
        dropStep = dropStep || r.blank
      }
    }
    if (dropStep) continue

    const args = step.args ?? []
    let skipped = 0
    const kept: CardStepArg[] = []
    for (const a of args) {
      const na: CardStepArg = { ...a }
      let blank = false
      if (typeof na.value === 'string') {
        const r = resolveCardParams(na.value, values)
        na.value = r.text
        blank = blank || r.blank
      }
      if (typeof na.key === 'string') {
        const r = resolveCardParams(na.key, values)
        na.key = r.text
        blank = blank || r.blank
      }
      if (typeof na.argType === 'string') {
        const r = resolveCardParams(na.argType, values)
        na.argType = r.text as CardStepArg['argType']
        blank = blank || r.blank
      }
      if (typeof na.value2 === 'string') {
        const r = resolveCardParams(na.value2, values)
        na.value2 = r.text
        blank = blank || r.blank
      }
      if (blank) {
        skipped += 1
        continue
      }
      kept.push(na)
    }
    if (skipped) {
      if (step.kind === 'card') {
        next.args = kept
      } else if (ARGS_SKIP_KINDS.has(step.kind)) {
        next.args = kept
        if (!kept.length) continue
      } else {
        continue
      }
    } else if (args.length) {
      next.args = kept
    }
    out.push(next)
  }
  return out
}

/** 递归内联步骤中的「卡片引用」（与后端 _flatten_card_steps 一致）
 *  内联前先按「引用步骤 args + 卡片 params 默认值」替换卡片内的 {{参数}} 占位符。 */
export function flattenCardSteps(
  steps: CardStep[],
  cardLookup: Map<string, Card>,
  stack: Set<string> = new Set(),
): CardStep[] {
  const out: CardStep[] = []
  for (const step of steps) {
    if (step.kind !== 'card') {
      out.push(step)
      continue
    }
    const cardId = step.cardId
    const ref = cardId ? cardLookup.get(cardId) : undefined
    if (!ref || (cardId && stack.has(cardId))) continue
    if (cardId) stack.add(cardId)
    const refSteps = substituteCardParams(ref.steps ?? [], cardParamValues(ref, step))
    out.push(...flattenCardSteps(refSteps, cardLookup, stack))
    if (cardId) stack.delete(cardId)
  }
  return out
}

function valueResourceItems(res: ValueResource): string[] {
  if (res.kind === 'const') return [String(res.values)]
  if (res.kind === 'list') {
    return Array.isArray(res.values) ? res.values.map((v) => String(v)) : [String(res.values)]
  }
  const r = res.values as { from: number; to: number; step: number }
  if (!r || typeof r !== 'object') return []
  const step = Number(r.step)
  if (!step) return []
  const out: string[] = []
  let v = Number(r.from)
  const to = Number(r.to)
  let guard = 0
  while (step > 0 ? v <= to + 1e-9 : v >= to - 1e-9) {
    out.push(Number.isInteger(v) ? String(v) : String(Number(v.toPrecision(12))))
    v += step
    if (++guard > 10000) break
  }
  return out
}

/** 收集步骤中 split 类型的 @list/@range 维度（按出现顺序去重） */
export function collectSplitDims(
  steps: CardStep[],
  valueLookup: Map<string, ValueResource>,
): Array<{ name: string; items: string[] }> {
  const dims: Array<{ name: string; items: string[] }> = []
  const seen = new Set<string>()
  const scan = (text?: string) => {
    if (!text) return
    VALUE_REF_RE.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = VALUE_REF_RE.exec(text))) {
      const kind = m[1]
      const name = m[2]
      if (kind === 'const') continue
      const res = valueLookup.get(name)
      if (!res || res.expand !== 'split' || seen.has(name)) continue
      seen.add(name)
      dims.push({ name, items: valueResourceItems(res) })
    }
  }
  for (const step of steps) {
    for (const a of step.args ?? []) {
      scan(a.value)
      scan(a.key)
    }
    scan(step.raw)
    scan(step.fun)
  }
  return dims
}

/**
 * 深拷贝一个工况，并把所有 id 重新生成：node / step / lane / edge。
 * 复制工况必须走这里 —— 只换 frame.id 会让孪生工况共用 nodeId，
 * 画布上按 id 的查找/删除就会命中另一个工况（卡片挂到两条泳道、删一张整帧空白都是这么来的）。
 */
export function cloneFrameWithNewIds(src: CaseFrame): CaseFrame {
  const cp: CaseFrame = JSON.parse(JSON.stringify(src))
  cp.id = genId('frame')

  // 1) 先建 id 映射：步骤 id 被序列接线口的锚点引用（seq:<seqId>@<stepId>），要一起换
  const nodeIdMap = new Map<string, string>()
  const stepIdMap = new Map<string, string>()
  for (const oldId of Object.keys(cp.nodes ?? {})) nodeIdMap.set(oldId, genId('node'))
  for (const [oldId, node] of Object.entries(cp.nodes ?? {})) {
    const nextNodeId = nodeIdMap.get(oldId) ?? oldId
    node.id = nextNodeId
    for (const step of node.steps ?? []) {
      const nextStepId = genId('step')
      stepIdMap.set(step.id, nextStepId)
      step.id = nextStepId
    }
  }

  // 2) nodes 字典换键
  const nodes: Record<string, Card> = {}
  for (const [oldId, node] of Object.entries(cp.nodes ?? {})) nodes[nodeIdMap.get(oldId) ?? oldId] = node
  cp.nodes = nodes

  // 3) 泳道 id + 泳道内的 nodeId
  for (const lane of cp.lanes ?? []) {
    lane.id = genId('lane')
    lane.nodeIds = lane.nodeIds.map((nid) => nodeIdMap.get(nid) ?? nid)
  }
  // 旧字段（迁移到 lanes 后不再写入，历史配置里可能还有）
  const mapNode = (nid: string): string => nodeIdMap.get(nid) ?? nid
  cp.sequenceId = cp.sequenceId ? mapNode(cp.sequenceId) : cp.sequenceId
  if (cp.injects) cp.injects = cp.injects.map(mapNode)
  if (cp.recovers) cp.recovers = cp.recovers.map(mapNode)
  if (cp.results) cp.results = cp.results.map(mapNode)

  // 4) 连线：边 id 换新，端口键里的 nodeId / seqId / stepId 按映射改写
  const remapPort = (key: string): string => {
    const seq = parseSeqPortKey(key)
    if (seq) {
      const seqId = mapNode(seq.seqId)
      // 锚点步骤已不存在（悬空锚点）时保留原 stepId，仍由「悬空连线」逻辑兜着
      if (seq.stepId !== undefined) return seqPortKey(seqId, stepIdMap.get(seq.stepId) ?? seq.stepId)
      return `seq:${seqId}:${seq.idx ?? 0}`
    }
    if (isCardKey(key)) {
      const nodeId = cardKeyNodeId(key)
      return key.slice(0, key.length - nodeId.length) + mapNode(nodeId)
    }
    return key
  }
  const edges: Record<string, FrameEdge> = {}
  for (const edge of Object.values(cp.edges ?? {})) {
    edge.id = genId('edge')
    edge.from = remapPort(edge.from)
    edge.to = remapPort(edge.to)
    edges[edge.id] = edge
  }
  cp.edges = edges
  return cp
}

/** 把卡片库平铺为 id -> Card */
export function buildCardLookup(library?: CardLibrary): Map<string, Card> {
  const map = new Map<string, Card>()
  if (!library) return map
  for (const bucket of [library.inject, library.sequence, library.result]) {
    for (const c of bucket ?? []) if (c?.id) map.set(c.id, c)
  }
  return map
}

export function buildValueLookup(values?: ValueResource[]): Map<string, ValueResource> {
  const map = new Map<string, ValueResource>()
  for (const v of values ?? []) if (v?.name) map.set(v.name, v)
  return map
}

/** 一条展开用例的展示信息 */
export interface FrameCaseRow {
  /** 端口 label 串联 */
  chain: string
  /** 值资源拆分标签，如 ['value2=0'] */
  labels: string[]
}

/**
 * 工况框的用例行（在连线路径基础上，按 @list/@range(split) 做笛卡尔积拆分）。
 * 与后端 _split_value_variants 一致：无 split 维度时每个路径 1 行。
 */
export function frameCaseRows(
  frame: CaseFrame,
  cardLibrary?: CardLibrary,
  valueLibrary?: ValueResource[],
): FrameCaseRow[] {
  return frameCaseRowsWithLookups(frame, buildCardLookup(cardLibrary), buildValueLookup(valueLibrary))
}

/**
 * 从整份 TestCase.can 里抽出某条用例的 testcase 块（含 `testcase <caseId>()` 函数头与配对的大括号）。
 * 找不到该用例（名字还没在后端展开中生效）时返回空串。
 * 用花括号计数配对，避免用例体内的嵌套 `{}`（if / for / while）把块提前截断；
 * 函数头要求独占一行，避免 `testcase Foo_2(` 被 `testcase Foo(` 前缀误命中。
 */
export function extractCaseBlock(testCases: string, caseId: string): string {
  if (!testCases || !caseId) return ''
  const needle = `testcase ${caseId}(`
  let at = testCases.indexOf(needle)
  while (at >= 0) {
    const lineStart = testCases.lastIndexOf('\n', at - 1) + 1
    if (!testCases.slice(lineStart, at).trim()) break
    at = testCases.indexOf(needle, at + needle.length)
  }
  if (at < 0) return ''
  const open = testCases.indexOf('{', at + needle.length)
  if (open < 0) return ''
  let depth = 0
  for (let i = open; i < testCases.length; i++) {
    if (testCases[i] === '{') depth++
    else if (testCases[i] === '}' && --depth === 0) return testCases.slice(at, i + 1)
  }
  return testCases.slice(at)
}

/** 全局库内容（前端字段名归一；global 标记只在全局库/被注入的副本里才有意义） */
export interface GlobalContent {
  cards: CardLibrary
  mapping: ObjectMapping
  valueLibrary: ValueResource[]
}

/**
 * 把全局库里带 `global` 标记的项注入到新分组 —— 新建配置 / 新建分组时调用。
 * 只注入被标记为全局的卡片 / 映射条目 / 值资源，其它内容不受影响；注入的是深拷贝（保留 global 标记）。
 * 返回注入的条目数（0 表示没有全局内容，分组保持空白）。
 */
export function injectGlobalIntoGroup(grp: CaseGroup, g: GlobalContent): number {
  const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T
  const pickCards = (list?: Card[]): Card[] => (list || []).filter((c) => !!c?.global).map(clone)
  const cards: CardLibrary = {
    inject: pickCards(g?.cards?.inject),
    sequence: pickCards(g?.cards?.sequence),
    result: pickCards(g?.cards?.result),
  }
  let n = cards.inject.length + cards.sequence.length + cards.result.length
  const mapping = {
    signals: [],
    dtcs: [],
    messages: [],
    envvars: [],
    a2l: [],
  } as ObjectMapping
  const buckets = ['signals', 'dtcs', 'messages', 'envvars', 'a2l'] as const
  for (const b of buckets) {
    const list = (g?.mapping?.[b] || []).filter((e) => !!e?.global).map(clone)
    mapping[b] = list
    n += list.length
  }
  const values = (g?.valueLibrary || []).filter((v) => !!v?.global).map(clone)
  n += values.length
  if (!n) return 0
  grp.cards = cards
  grp.mapping = mapping
  grp.valueLibrary = values
  return n
}

/**
 * frameCaseRows 的复用版：卡片 / 值资源查找表由调用方预先构建。
 * 画布与顶部「N 条用例」都是「一批工况」整体展开，查找表只需建一次；
 * 否则每个工况都要把卡片库 / 值资源库重新索引一遍（工况数 × 卡片数），大配置下是明显开销。
 */
export function frameCaseRowsWithLookups(
  frame: CaseFrame,
  cardLookup: Map<string, Card>,
  valueLookup: Map<string, ValueResource>,
): FrameCaseRow[] {
  const rows: FrameCaseRow[] = []
  for (const path of expandFramePaths(frame)) {
    const steps: CardStep[] = []
    for (const key of path) steps.push(...frameNodeSteps(frame, key))
    const flat = flattenCardSteps(steps, cardLookup)
    const dims = collectSplitDims(flat, valueLookup)
    const chain = path.map((k) => frameNodeLabel(frame, k, cardLookup)).join(' → ')
    if (!dims.length) {
      rows.push({ chain, labels: [] })
      continue
    }
    let combos: Array<Record<string, string>> = [{}]
    for (const d of dims) {
      const items = d.items.length ? d.items : ['']
      const next: Array<Record<string, string>> = []
      for (const c of combos) for (const item of items) next.push({ ...c, [d.name]: item })
      combos = next
    }
    for (const c of combos) {
      rows.push({ chain, labels: dims.map((d) => `${d.name}=${c[d.name]}`) })
    }
  }
  return rows
}

/** 用例数：有 frames 时按工况框展开；有 edges 时按拓扑路径数；无 edges 走泳道口笛卡尔积 */
export function computeCaseCount(graph: Graph): number {
  if (graph.frames && graph.frames.length) return countCasesByFrames(graph)
  const nodes = graph.nodes
  if (graph.edges.length) return countCasesByEdges(graph)
  return (
    lanePorts(nodes, 'inject').length *
    lanePorts(nodes, 'sequence').length *
    lanePorts(nodes, 'result').length
  )
}

/**
 * 自由画布（nodes/edges）连线即语义预览：枚举每条将生成的用例链路（步骤口 label 串联）。
 * 与后端 _expand_by_edges 同规则：注入口为起点（空则退回无入边的口）、
 * 带环保护 DFS、分叉并联各成一条。返回每项为端口标签数组，如
 * ['注入A', '序列A', '结果A']。无 edges 时返回空数组（由笛卡尔积负责）。
 */
export function listEdgeChains(graph: Graph): string[][] {
  if (!graph.edges.length) return []
  const nodes = graph.nodes
  const nodeLane = new Map<string, CardType>()
  const nodePorts = new Map<string, Port[]>()
  const keyOf = (nodeId: string, portIndex: number) => `${nodeId}#${portIndex}`
  for (const node of nodes) {
    nodeLane.set(node.id, node.lane)
    nodePorts.set(node.id, portsOf(node))
  }

  const adj = new Map<string, string[]>()
  const incoming = new Set<string>()
  for (const edge of graph.edges) {
    const fromKey = keyOf(edge.from.nodeId, edge.from.portIndex ?? 0)
    const toKey = keyOf(edge.to.nodeId, edge.to.portIndex ?? 0)
    const list = adj.get(fromKey) ?? []
    list.push(toKey)
    adj.set(fromKey, list)
    incoming.add(toKey)
  }

  const labelOf = (key: string): string => {
    const hash = key.lastIndexOf('#')
    const nodeId = key.slice(0, hash)
    const portIndex = Number(key.slice(hash + 1))
    const ports = nodePorts.get(nodeId) ?? []
    return ports[portIndex]?.label ?? ''
  }

  const sources: string[] = []
  for (const node of nodes) {
    if (nodeLane.get(node.id) !== 'inject') continue
    for (let p = 0; p < (nodePorts.get(node.id)?.length ?? 0); p++) {
      sources.push(keyOf(node.id, p))
    }
  }
  if (!sources.length) {
    for (const node of nodes) {
      for (let p = 0; p < (nodePorts.get(node.id)?.length ?? 0); p++) {
        const key = keyOf(node.id, p)
        if (!incoming.has(key)) sources.push(key)
      }
    }
  }

  const chains: string[][] = []
  const dfs = (key: string, path: string[], visited: Set<string>) => {
    if (visited.has(key)) return
    visited.add(key)
    path.push(key)
    const next = adj.get(key) ?? []
    if (!next.length) chains.push(path.map(labelOf))
    else for (const t of next) dfs(t, path, visited)
    path.pop()
    visited.delete(key)
  }
  for (const src of sources) dfs(src, [], new Set<string>())
  return chains
}

/**
 * 连线即语义预览：有 frames 时按工况框展开；否则按自由画布拓扑展开。
 */
export function listCaseChains(graph: Graph, cardLibrary?: CardLibrary): string[][] {
  if (graph.frames && graph.frames.length) return listFrameChains(graph, cardLibrary)
  return listEdgeChains(graph)
}

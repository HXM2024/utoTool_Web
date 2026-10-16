/**
 * Function 模块图形化用例配置 —— 前端数据模型。
 * 与后端 Python dict 存储等价，见 docs/function_graph_config_design.md 第 3 节。
 */

/** 卡片类型（对应三泳道） */
export type CardType = 'inject' | 'sequence' | 'result'

/** 故障注入分类：故障注入 / 故障恢复 */
export type InjectRole = 'inject' | 'recover'

/** 映射表对象类型 */
export type MappingKind = 'signal' | 'dtc' | 'message' | 'envvar' | 'a2l'

/** 步骤参数：key=参数名，value=值/别名（生成时对照映射表解析） */
export interface CardStepArg {
  /** 参数名 */
  key: string
  /** 值或映射表别名（生成时自动对照映射表解析为真实对象名） */
  value: string
  /** 对象类型标记：拖拽对象时写入，后端据此生成 setSignal/sysSetVariable/putValue 等 */
  argType?: 'signal' | 'sysvar' | 'envvar' | 'a2l' | 'message' | 'dtc'
  /** 区间形式的第二个值（限时检查的区间形式用：value=下限、value2=上限） */
  value2?: string
}

/** 步骤（卡片内部最小执行单元） */
export interface CardStep {
  id: string
  kind:
    | 'call'
    | 'set'
    | 'reset'
    | 'reset_all'
    | 'wait'
    /** 检查：SignalCheck(信号, 期望值) */
    | 'check'
    /** 限时检查：SignalWaitCheck(信号, 期望值, 时间) */
    | 'wait_check'
    /** 斜率请求：SetSignalRate(信号, 步长, 目标值) */
    | 'rate'
    /** 斜率请求(同步)：SetSignalRamp(信号, 周期时间, 步长, 最大值) */
    | 'ramp'
    /** 弹窗提示：人工确认弹窗，testWaitForTesterConfirmation(Str_Temp, 超时) */
    | 'tester_prompt'
    | 'loop_start'
    | 'loop_end'
    | 'raw'
    | 'card'
  /** kind != 'raw' 时的 CAPL 函数名 */
  fun?: string
  /** 参数列表（可空） */
  args: CardStepArg[]
  /** kind = 'raw' 时的原始 CAPL 行 */
  raw?: string
  /** 步骤级数值参数（留空按各自缺省生成）：
   *  rate / ramp 的「步长」= 斜率；ramp 另有「周期时间」；wait_check 的「时间」（超时 ms）；
   *  tester_prompt 的「时间」（等待确认超时 ms，缺省 60000） */
  rate?: string
  cycleTime?: string
  time?: string
  /** kind = 'tester_prompt' 时：弹窗提示内容（生成 char Str_Temp[]="…"） */
  prompt?: string
  /** 限时检查：取反（SignalWaitCheckNot） */
  waitNot?: boolean
  /** 限时检查：区间形式（两个值 = 下限 / 上限，生成 4 参数重载） */
  waitRange?: boolean
  /** 限时检查：大于 / 小于期望值标记（仅用于下拉回显）。
   *  生成仍走区间形式（waitRange=true），上下限由 applyWaitForm 按「两倍预期值」自动填入。 */
  waitCmp?: 'gt' | 'lt'
  /** 缩进层级（循环体） */
  indent?: number
  /** 循环类型（loop_start 使用）：for=次数可控，while=条件满足退出；默认 for */
  loopMode?: 'for' | 'while'
  /** kind = 'card' 时：被引用卡片的 id（步骤列表里显示为一个卡片节点，生成时递归展开被引用卡片的 steps） */
  cardId?: string
  /** kind = 'card' 时：被引用卡片的类型（用于显示标签） */
  cardType?: CardType
  /** kind = 'card' 时：被引用卡片名（用于显示，避免每次查表） */
  cardName?: string
}

/** 用例局部变量（生成时在 testcase 内声明） */
export interface LocalVar {
  name: string
  type: string
  value?: string
}

/** 卡片参数（接口）：引用卡片时可覆盖，卡片内部用 {{name}} 占位 */
export interface CardParam {
  /** 参数名（卡片内占位符 {{name}}） */
  name: string
  /** 显示名（可选，仅用于界面说明） */
  label?: string
  /** 默认值：引用步骤未提供该参数时使用 */
  default?: string
}

/** 组合卡片（可复用步骤集合） */
export interface Card {
  id: string
  type: CardType
  name: string
  description?: string
  /** 组合卡片：steps 长度 >= 1 */
  steps: CardStep[]
  /** 卡片参数接口：卡片内部用 {{name}} 占位，引用时通过步骤 args 填值 */
  params?: CardParam[]
  /** 引用来源：指向卡片库中卡片 id；库里改后由编辑器同步覆盖内容 */
  refId?: string
  /** 用例局部变量（编辑序列时定义，生成时声明在 testcase 顶部） */
  locals?: LocalVar[]
  /** 故障注入分类：默认 inject（故障注入），recover 为故障恢复 */
  role?: InjectRole
  /** 工况画布内：卡片上方的额外留白(px)，用于在泳道里自由摆放。
   *  只加不减（>=0），所以卡片之间永远不会重叠；与用例生成无关。 */
  topGap?: number
  /** 全局卡片：随全局库同步，新建配置/新建分组时自动带出 */
  global?: boolean
}

/** 组节点（画布上的节点，内含 N 张卡片，带扇出开关） */
export interface GroupNode {
  id: string
  lane: CardType
  cards: Card[]
  fanout: 'single' | 'multi'
  x: number
  y: number
}

/** 连线 */
export interface Edge {
  id: string
  from: { nodeId: string; portIndex: number }
  to: { nodeId: string; portIndex: number }
}

/**
 * 工况框连线。端口 key 约定：
 * - 故障注入：'inj:<nodeId>'（仅右口/输出）
 * - 结果判断：'res:<nodeId>'（仅左口/输入）
 * - 序列步骤：'seq:<seqId>@<stepId>'（左口输入 + 右口输出，锚定步骤；
 *   旧数据 'seq:<seqId>:<stepIdx>' 按序号解析，仍兼容）
 */
export interface FrameEdge {
  id: string
  from: string
  to: string
  /** 注入→序列连线的序号（1,2,3…），为空回退 0 */
  seq?: number
  /** 序列→结果连线的配对序号（从小到大，空数组 = 对应全部注入） */
  pair?: number[]
}

/** 泳道（分栏）类型：主序列 / 其它（卡片） */
export type FrameLaneType = 'main' | 'other'

/** 工况框内的一个分栏（泳道）。main 为主序列主干（至多一张），other 为普通卡片列（可多列） */
export interface FrameLane {
  id: string
  type: FrameLaneType
  /** 本栏内节点 id，从上到下排列（main 栏最多一个） */
  nodeIds: string[]
  /** 手动调节后的泳道宽度（px）；为空表示在 [最小宽度, 最大宽度] 区间内自适应 */
  width?: number
}

/** 工况框：一个用例模板，纵向排列，宽度填满容器 */
export interface CaseFrame {
  id: string
  name: string
  /** 分栏（泳道），从左到右排列；序列为主干，注入/恢复/结果按序号挂接 */
  lanes: FrameLane[]
  /** 框内节点：故障注入/测试序列/结果判断 */
  nodes: Record<string, Card>
  /** 框内连线：按边 id 索引 */
  edges: Record<string, FrameEdge>
  /** 兼容旧数据：迁移到 lanes 后不再写入 */
  injects?: string[]
  recovers?: string[]
  sequenceId?: string | null
  results?: string[]
  /**
   * 用例名覆盖：按本工况「用例展开」的行序存放（与 frameCaseRows 的行一一对应）。
   * 空串 / 缺省 = 用默认名（后端自动生成的 case_id）。
   * 非空时该名字会作为生成用例的 case_id（testcase 函数名）与 XML title 的前半段。
   */
  caseNames?: string[]
}

/** 映射表条目 */
export interface MappingEntry {
  alias: string
  kind: MappingKind
  name: string
  value?: string
  extra?: Record<string, string>
  /** 全局对象：随全局库同步，新建配置/新建分组时自动带出 */
  global?: boolean
}

/** 全对象映射表 */
export interface ObjectMapping {
  signals: MappingEntry[]
  dtcs: MappingEntry[]
  messages: MappingEntry[]
  envvars: MappingEntry[]
  a2l: MappingEntry[]
}

/** 从 Excel 导入到分组的用例：以 CAPL 用例体为权威内容 */
export interface ImportedCase {
  /** 用例名 */
  case_id: string
  /** 用例体 CAPL 代码（不含 testcase 包裹） */
  code: string
}

/** 用例分组：一份独立的图形配置（工况框集合），组内用例以分组名为前缀 */
export interface CaseGroup {
  id: string
  /** 分组名称：作为该组用例名前缀（<名称>_1、<名称>_2…） */
  name: string
  /** 该分组独立的图形配置（工况框） */
  frames: CaseFrame[]
  /** 命名策略：default=<名称>_序号；path=按链路卡片名生成 TC_x_y */
  naming?: 'default' | 'path'
  /** 从 Excel 导入的用例：与图形展开用例一起参与预览与代码生成 */
  cases?: ImportedCase[]
  /** 分组级卡片库（故障注入/序列/检查）：新建分组默认空 */
  cards?: CardLibrary
  /** 分组级对象映射表：不同分组不同内容 */
  mapping?: ObjectMapping
  /** 分组级值资源库 */
  valueLibrary?: ValueResource[]
}

/** 图 */
export interface Graph {
  nodes: GroupNode[]
  edges: Edge[]
  /** 工况框（新版用例编排）：非空时优先按工况框展开；分组模式下为「当前活动分组」的镜像 */
  frames?: CaseFrame[]
  /** 用例命名策略：default=GraphCase_N；path=按链路卡片名生成 TC_x_y */
  naming?: 'default' | 'path'
  /** 用例分组：每个分组一份独立图形配置；组内用例以分组名为前缀 */
  groups?: CaseGroup[]
}

/** 统一卡片库（按类型分桶） */
export interface CardLibrary {
  inject: Card[]
  sequence: Card[]
  result: Card[]
}

/** 值资源类型 */
export type ValueResourceKind = 'const' | 'list' | 'range'

/** 值资源（可复用常量 / 列表 / 区间，供参数 @const:/@list:/@range: 引用） */
export interface ValueResource {
  id: string
  name: string
  kind: ValueResourceKind
  /** const=单值字符串；list=字符串数组；range={from,to,step} */
  values: string | string[] | { from: number; to: number; step: number }
  /** split=遍历拆成多条用例；loop=单用例内 for 循环 */
  expand: 'split' | 'loop'
  label?: string
  /** 全局值资源：随全局库同步，新建配置/新建分组时自动带出 */
  global?: boolean
}

/** 展开后的单个端口 */
export interface Port {
  label: string
  steps: CardStep[]
}

/** 展开后的单个用例 */
export interface ExpandedCase {
  case_id: string
  inject: string
  sequence: string
  result: string
  steps: Array<CardStep & { capl?: string }>
  /** 用例局部变量（工况框模式下后端返回） */
  locals?: LocalVar[]
  /** 从 Excel 导入的用例：CAPL 用例体（此时 steps 为空） */
  code?: string
  /** 所属分组 id / 名称（存在 groups 时后端返回） */
  group_id?: string
  group_name?: string
}

/** 空映射表 */
export function emptyMapping(): ObjectMapping {
  return { signals: [], dtcs: [], messages: [], envvars: [], a2l: [] }
}

/** 空卡片库 */
export function emptyCardLibrary(): CardLibrary {
  return { inject: [], sequence: [], result: [] }
}

/** 空值资源库 */
export function emptyValueLibrary(): ValueResource[] {
  return []
}

/** 空值常量：供计算属性默认返回，避免每次新建对象导致的响应式抖动 */
export const EMPTY_CARDS: CardLibrary = { inject: [], sequence: [], result: [] }
export const EMPTY_MAPPING: ObjectMapping = { signals: [], dtcs: [], messages: [], envvars: [], a2l: [] }
export const EMPTY_VALUES: ValueResource[] = []

/** 新建分组：内容完全空白（卡片库 / 对象映射表 / 值资源库 均为空） */
export function emptyCaseGroup(name: string): CaseGroup {
  return {
    id: genId('group'),
    name,
    frames: [],
    cards: emptyCardLibrary(),
    mapping: emptyMapping(),
    valueLibrary: emptyValueLibrary(),
  }
}

/** 空图 */
export function emptyGraph(): Graph {
  // frames 与首个分组的 frames 共享同一引用（编辑器依赖此镜像）
  const grp = emptyCaseGroup('GraphCase')
  return {
    nodes: [],
    edges: [],
    frames: grp.frames,
    groups: [grp],
  }
}

/** 生成唯一 ID */
export function genId(prefix = 'id'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

/**
 * 拖拽载荷类型：函数库卡片 → 工况画布。
 * 单独一种类型，与卡片库的 `application/x-graph-card` 区分开：
 * 步骤编辑器会优先把 x-graph-card 当作「卡片引用」处理，用独立类型可避免
 * 把函数库拖拽误判成引用一张不存在的卡片。
 */
export const FUNC_CARD_MIME = 'application/x-func-card'

/** 拖拽载荷类型：卡片参数行 → 步骤参数框（拖入后插入 {{参数名}} 占位符） */
export const CARD_PARAM_MIME = 'application/x-card-param'

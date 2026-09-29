/**
 * DBC Canmatrix 解析共享工具。
 *
 * 后端 import_excel 将 "DBC Canmatrix" 工作表原样转为 { columns, rows }，
 * 列名保持 Excel 原始表头。前端通过关键字匹配将原始行解析为结构化记录，
 * 供 ObjectPanel 的 DBC 树形与 CANView 的报文信号表复用。
 * 缺失字段以空字符串占位。
 */

/** 结构化 DBC 记录（一行 = 一个信号） */
export interface DbcRecord {
  senders: string
  msgName: string
  msgType: string
  msgId: string
  msgSendType: string
  cycle: string
  cycleFast: string
  nrOfReption: string
  length: string
  lostDtc: string
  dlcDtc: string
  signalName: string
  byteOrder: string
  startByte: string
  startBit: string
  signalSendType: string
  bitLength: string
  dataType: string
  testDataType: string
  factor: string
  offset: string
  minPhy: string
  maxPhy: string
  initialValue: string
  unit: string
  invalidValue: string
  valueDesc: string
  dtc: string
  signalType: string
  xcpVar: string
  test: string
  msgTest: string
  /** 「报文测试参数」列原始 JSON 文本（无则空） */
  msgTestParams: string
  /** 「信号测试参数」列原始 JSON 文本（无则空） */
  sigTestParams: string
  /**
   * 测试参数明细 8 列的原始单元格文本，顺序同 PARAM_DETAIL_LABELS
   * （测试参数 / 报DTC值 / 不报DTC值 / DTC / 变量名 / 测试值 / 自动遍历 / 类型）。
   * 一个参数一行，用 \n 分隔；缺列时为空数组。
   */
  paramCells: string[]
}

/** 归一化列名：转小写并移除空白/下划线/斜杠 */
function norm(s: unknown): string {
  return String(s ?? '').toLowerCase().replace(/[\s\n\r_/]/g, '')
}

/** 按关键字列表查找列索引（任一关键字被列名包含即命中）；exclude 用于跳过测试参数类列 */
function findIdx(cols: string[], keys: string[], exclude: number[] = []): number {
  const ncols = cols.map(norm)
  for (let i = 0; i < ncols.length; i++) {
    if (exclude.includes(i)) continue
    if (keys.some((k) => ncols[i].includes(norm(k)))) return i
  }
  return -1
}

/** 精确查找 DTC 列（排除 lostDTC / dlcDTC） */
function findDtcIdx(cols: string[]): number {
  const ncols = cols.map(norm)
  const exact = ncols.indexOf('dtc')
  if (exact >= 0) return exact
  for (let i = 0; i < ncols.length; i++) {
    // 跳过 lostDTC/dlcDTC，以及测试参数明细里的「报DTC值 / 不报DTC值」（它们不是信号级 DTC 列）
    if (ncols[i].includes('dtc') && !ncols[i].includes('lost') && !ncols[i].includes('dlc') && !ncols[i].includes('报')) {
      return i
    }
  }
  return -1
}

/** 精确查找列（归一化后完全相等）。
 * 用于区分「数据类型\nData_Type」(物理类型, 归一化为 "数据类型datatype")
 * 与裸「Data_Type」列(测试值列表/处理器类型 ENM/BLN/UNM/SNM, 归一化为 "datatype")。 */
function findExactIdx(cols: string[], key: string, exclude: number[] = []): number {
  const nk = norm(key)
  for (let i = 0; i < cols.length; i++) {
    if (exclude.includes(i)) continue
    if (norm(cols[i]) === nk) return i
  }
  return -1
}

/** 判断归一化列名是否属于「测试参数」类列 */
function isParamCol(n: string): boolean {
  return n.includes('test_params') || n.includes('testparams') || n.includes('测试参数')
}

/** 定位测试参数列：msg = 报文级 JSON / sig = 信号级 JSON / row = 表格自带「测试参数」列 */
function findParamIdx(cols: string[], kind: 'msg' | 'sig' | 'row'): number {
  const ncols = cols.map(norm)
  for (let i = 0; i < ncols.length; i++) {
    if (!isParamCol(ncols[i])) continue
    const isMsg = ncols[i].includes('msgtestparams') || ncols[i].includes('报文测试参数')
    const isSig = ncols[i].includes('sigtestparams') || ncols[i].includes('信号测试参数')
    if (kind === 'msg' && isMsg) return i
    if (kind === 'sig' && isSig) return i
    if (kind === 'row' && !isMsg && !isSig) return i
  }
  return -1
}

/**
 * 测试参数明细列：导出时用这 8 列替换原「测试参数」可读列（顺序与后端 PARAM_DETAIL_COLUMNS 一致）。
 * 一个测试参数占一行（单元格内用 \n 分隔），第 1 行 = 第 1 个参数。
 */
export const PARAM_DETAIL_LABELS = [
  '测试参数',
  '报DTC值',
  '不报DTC值',
  'DTC',
  '变量名',
  '测试值',
  '自动遍历',
  '类型',
] as const

/** 与 PARAM_DETAIL_LABELS 一一对应的 params 字段名（'' = 该列取参数名本身） */
const PARAM_DETAIL_FIELDS = ['', 'dtcValue', 'noDtcValue', 'dtc', 'variable', 'testValues', 'autoRange', 'invalidType'] as const

/** 按表头中文名（换行前那段）定位 8 个明细列；未命中的为 -1 */
function findParamDetailIdx(cols: string[]): number[] {
  const labels = cols.map((c) => String(c ?? '').split('\n')[0].trim())
  return PARAM_DETAIL_LABELS.map((label) => labels.indexOf(label))
}

/** 单元格文本按行拆开（去掉末尾空行；行内空行保留，用于逐行对齐） */
function cellLines(text: string): string[] {
  const lines = String(text ?? '')
    .split('\n')
    .map((l) => l.trim())
  while (lines.length && lines[lines.length - 1] === '') lines.pop()
  return lines
}

/**
 * 测试参数明细 8 列 → 测试参数数组（第 1 行对应第 1 个参数，第 2 行对应第 2 个参数）。
 * 「测试参数」列有值的行才算一个参数；该行其它列为空就不写该字段。
 */
export function parseParamColumns(
  cells: string[],
  target: 'message' | 'signal'
): Array<{ value: string; target: string; params: Record<string, any> }> {
  if (!cells.length || cells.every((c) => !String(c ?? '').trim())) return []
  const perCol = PARAM_DETAIL_LABELS.map((_, i) => cellLines(cells[i] ?? ''))
  const count = perCol.reduce((n, lines) => Math.max(n, lines.length), 0)
  const out: Array<{ value: string; target: string; params: Record<string, any> }> = []
  for (let i = 0; i < count; i++) {
    const value = (perCol[0][i] || '').trim()
    if (!value) continue
    const params: Record<string, any> = {}
    for (let c = 1; c < PARAM_DETAIL_FIELDS.length; c++) {
      const text = (perCol[c][i] || '').trim()
      if (!text) continue
      const field = PARAM_DETAIL_FIELDS[c]
      params[field] = field === 'autoRange' ? /^(y|yes|是|true|1)$/i.test(text) : text
    }
    out.push({ value, target, params })
  }
  return out
}

/** 从报文名中推断发送节点。
 * 适用场景：Excel 表头缺少"发送节点/Senders"列时，常见格式如
 *   "HCU_0x201" / "EPS_0x605" / "GW_0x123"
 *   取第一个下划线前的片段作为发送节点；
 *   若报文名中不包含下划线则返回空字符串，由调用方决定如何兜底。 */
function inferSenderFromMsgName(msgName: string): string {
  if (!msgName) return ''
  const trimmed = msgName.trim()
  if (!trimmed) return ''
  // 仅当报文名同时含下划线和 0x 前缀（典型 "节点_0xID" 格式）时才拆分
  if (trimmed.includes('_0x') || trimmed.includes('_0X')) {
    const idx = Math.max(trimmed.indexOf('_0x'), trimmed.indexOf('_0X'))
    const sender = trimmed.slice(0, idx).trim()
    if (sender) return sender
  }
  return ''
}

/** 将后端 { columns, rows } 原始数据解析为结构化 DbcRecord 数组 */
export function parseDbcRecords(raw: any): DbcRecord[] {
  if (!raw?.columns || !raw?.rows) return []
  const cols = raw.columns as string[]
  const rows = raw.rows as any[][]

  console.log('[dbc] parseDbcRecords - cols:', cols.slice(0, 5))
  console.log('[dbc] parseDbcRecords - rows count:', rows.length)
  console.log('[dbc] parseDbcRecords - first row:', rows[0])

  // 测试参数类列（导出时追加的「报文/信号测试参数」JSON 列 + 表格自带「测试参数」列
  // + 导出的 8 个测试参数明细列）：这些列不参与其它字段的关键字匹配
  const msgParamsIdx = findParamIdx(cols, 'msg')
  const sigParamsIdx = findParamIdx(cols, 'sig')
  const rowParamsIdx = findParamIdx(cols, 'row')
  const paramDetailIdx = findParamDetailIdx(cols)
  const paramIdxList = [msgParamsIdx, sigParamsIdx, rowParamsIdx, ...paramDetailIdx].filter((i) => i >= 0)
  // Test 列优先精确匹配（避免命中含 "test" 的测试参数列）
  const testExact = findExactIdx(cols, 'test')

  const idx = {
    senders: findIdx(cols, ['senders', '发送节点']),
    msgName: findIdx(cols, ['msg_name', '报文名称']),
    msgType: findIdx(cols, ['msg_type', '报文类型']),
    msgId: findIdx(cols, ['msg_id', '报文标识符']),
    msgSendType: findIdx(cols, ['msg_send_type', '报文发送类型']),
    cycle: findIdx(cols, ['cycle_time', '周期', '报文周期时间']),
    cycleFast: findIdx(cols, ['cycle_time_fast', '快速周期', '报文发送的快速周期']),
    nrOfReption: findIdx(cols, ['nr_of_reption', '快速发送次数', '报文快速发送的次数']),
    length: findIdx(cols, ['msg_length', '报文长度', 'length', '长度']),
    signalName: findIdx(cols, ['signal_name', '信号名称']),
    byteOrder: findIdx(cols, ['byte_order', '排列格式', '字节序']),
    startByte: findIdx(cols, ['start_byte', '起始字节']),
    startBit: findIdx(cols, ['start_bit', '起始位']),
    signalSendType: findIdx(cols, ['signal_send_type', '信号发送类型']),
    bitLength: findIdx(cols, ['bit_length', '信号长度', '位长度']),
    dataType: findIdx(cols, ['data_type', '数据类型']),
    testDataType: findExactIdx(cols, 'data_type'),
    factor: findIdx(cols, ['factor', '精度']),
    offset: findIdx(cols, ['offset', '偏移']),
    minPhy: findIdx(cols, ['min_value_phy', 'signal_min', '物理最小值', '最小值']),
    maxPhy: findIdx(cols, ['max_value_phy', 'signal_max', '物理最大值', '最大值']),
    initialValue: findIdx(cols, ['initial_value', '初始值']),
    unit: findIdx(cols, ['unit', '单位']),
    invalidValue: findIdx(cols, ['invalid_value', '无效值']),
    valueDesc: findIdx(cols, ['value_descriptions', '信号值描述', '值描述']),
    lostDtc: findIdx(cols, ['lostdtc']),
    dlcDtc: findIdx(cols, ['dlcdtc']),
    signalType: findIdx(cols, ['signal_type', '信号类型']),
    xcpVar: findIdx(cols, ['xcp_ccp_varname', 'xcpccpvarname', 'xcp', 'ccp']),
    test: testExact >= 0 ? testExact : findIdx(cols, ['test'], paramIdxList),
    msgTest: findIdx(cols, ['msgtest', 'msg_test', '报文test'], paramIdxList),
  }
  // 记录缺失列，用于调试
  const missingCols: string[] = []
  for (const [key, val] of Object.entries(idx)) {
    if (val < 0 && !['msgType', 'msgSendType', 'cycleFast', 'nrOfReption', 'startByte', 'signalSendType', 'unit'].includes(key)) {
      missingCols.push(key)
    }
  }
  if (missingCols.length > 0) {
    console.warn(`[dbc] 以下列未找到: ${missingCols.join(', ')}`)
  }
  // 兜底：若 Excel 表头中无"发送节点"列，则尝试从报文名(形如 "HCU_0x201") 推断。
  // 推断结果仅在原 senders 字段为空时使用，避免覆盖真实数据。
  const hasSenderCol = idx.senders >= 0
  const dtcIdx = findDtcIdx(cols)

  const get = (row: any[], i: number): string =>
    i >= 0 && row[i] != null ? String(row[i]).trim() : ''
  // 测试参数明细列要保留「行内空行」（各列靠空行逐行对齐，如某参数没有 DTC 就该行留空），
  // 所以不能整串 trim，只按行 trim（见 cellLines）。
  const getRaw = (row: any[], i: number): string => (i >= 0 && row[i] != null ? String(row[i]) : '')

  // 报文级字段：在 DBC Canmatrix 中通常为合并单元格，仅报文的首个信号行有值，
  // 同一报文的后续信号行这些单元格为空。若不做前向填充，除首行外的信号会因
  // msgName/msgId 为空而错误归入 "Unknown" 报文。此处按合并单元格语义做前向填充。
  const MSG_KEYS = [
    'senders', 'msgName', 'msgType', 'msgId', 'msgSendType',
    'cycle', 'cycleFast', 'nrOfReption', 'length',
    'lostDtc', 'dlcDtc',
  ] as const
  const carry: Record<string, string> = {}

  return rows.map((row) => {
    const rec: DbcRecord = {
      senders: get(row, idx.senders),
      msgName: get(row, idx.msgName),
      msgType: get(row, idx.msgType),
      msgId: get(row, idx.msgId),
      msgSendType: get(row, idx.msgSendType),
      cycle: get(row, idx.cycle),
      cycleFast: get(row, idx.cycleFast),
      nrOfReption: get(row, idx.nrOfReption),
      length: get(row, idx.length),
      lostDtc: get(row, idx.lostDtc),
      dlcDtc: get(row, idx.dlcDtc),
      signalName: get(row, idx.signalName),
      byteOrder: get(row, idx.byteOrder),
      startByte: get(row, idx.startByte),
      startBit: get(row, idx.startBit),
      signalSendType: get(row, idx.signalSendType),
      bitLength: get(row, idx.bitLength),
      dataType: get(row, idx.dataType),
      testDataType: get(row, idx.testDataType),
      factor: get(row, idx.factor),
      offset: get(row, idx.offset),
      minPhy: get(row, idx.minPhy),
      maxPhy: get(row, idx.maxPhy),
      initialValue: get(row, idx.initialValue),
      unit: get(row, idx.unit),
      invalidValue: get(row, idx.invalidValue),
      valueDesc: get(row, idx.valueDesc),
      dtc: get(row, dtcIdx),
      signalType: get(row, idx.signalType),
      xcpVar: get(row, idx.xcpVar),
      test: get(row, idx.test),
      msgTest: get(row, idx.msgTest),
      msgTestParams: get(row, msgParamsIdx),
      sigTestParams: get(row, sigParamsIdx),
      paramCells: paramDetailIdx.map((i) => getRaw(row, i)),
    }

    // 检测是否进入新报文：与后端 process_dbc_canmatrix 一致，以 Msg_ID 非空作为报文边界
    // （报文行的 Msg_ID/Msg_Name 通常为合并单元格，仅首行有值）。
    // Msg_ID 为权威依据，缺失时回退到 Msg_Name。命中新报文时重置继承值，避免跨报文污染。
    const isNewMsg =
      (!!rec.msgId && rec.msgId !== carry.msgId) ||
      (!rec.msgId && !!rec.msgName && rec.msgName !== carry.msgName)
    if (isNewMsg) {
      for (const k of MSG_KEYS) delete carry[k]
    }

    // 前向填充报文级字段
    for (const k of MSG_KEYS) {
      const v = (rec as any)[k] as string
      if (v) carry[k] = v
      else if (carry[k]) (rec as any)[k] = carry[k]
    }

    // 兜底：缺少发送节点列时，从报文名(如 "HCU_0x201") 推断
    // 在前向填充之后执行，确保合并单元格下信号行也能拿到继承后的 msgName
    if (!hasSenderCol && !rec.senders && rec.msgName) {
      rec.senders = inferSenderFromMsgName(rec.msgName)
    }
    // 推断结果也写入 carry，让本报文后续信号行继承
    if (!hasSenderCol && rec.senders) {
      carry.senders = rec.senders
    }

    return rec
  })
}

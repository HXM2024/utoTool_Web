import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { getConfigs } from '@/api/config'
import { parseA2lFileFromPath, parseDbcFromCfgDir } from '@/api/can'
import { parseCddFromPath } from '@/api/sanbao'

export interface CfgData {
  a2l_qualifier: string
  a2l_path: string
  cdd_qualifier: string
  cdd_path: string
  cfg_dir: string
  /** CANoe 实例引用的数据库（Bus.Databases），含 DBC / A2L / CDD 的权威路径 */
  databases: Array<{ name: string; path: string }>
}

export interface ModuleState {
  loading: boolean
  currentConfig: string
  configList: string[]
  lastUploadResult: any | null
}

/** A2L 变量（含数据类型）/ mapxml 符号（含地址与字节长度） */
export interface A2lVar {
  name: string
  type: string
  /** mapxml 符号的字节长度（A2L 变量无此字段） */
  size?: number
  /** mapxml 符号的精度（工程量 = 原始值 × 精度 + 偏移，默认 1；A2L 变量无此字段） */
  precision?: number
  /** mapxml 符号的偏移（默认 0；A2L 变量无此字段） */
  offset?: number
}

/** A2L 变量集合 */
export interface A2lVars {
  measurements: A2lVar[]
  characteristics: A2lVar[]
}

/** CAN 模块电机类型：无刷解析 .a2l，有刷解析 .mapxml（二选一） */
export type CanMotorMode = 'brushless' | 'brushed'

/** CCP 系统变量类型（有刷模式，对象浏览器双击变量手动指定） */
export type CcpVarType = 'int' | 'float' | 'int64'

/** CCP 符号的精度 / 偏移（有刷模式；物理值 = 原始值 × 精度 + 偏移，默认 1 / 0） */
export interface CcpVarScale {
  precision?: number
  offset?: number
}

/** CCP 精度 / 偏移的默认值（与后端 ns_ccp_capl 保持一致） */
export const DEFAULT_CCP_PRECISION = 1
export const DEFAULT_CCP_OFFSET = 0

/** 规整单个符号的精度/偏移：非法值或两项都为默认值时返回 null（表示无需记录覆盖） */
function normalizeCcpScale(scale: CcpVarScale | null | undefined): CcpVarScale | null {
  const precision = Number(scale?.precision ?? DEFAULT_CCP_PRECISION)
  const offset = Number(scale?.offset ?? DEFAULT_CCP_OFFSET)
  if (!Number.isFinite(precision) || !Number.isFinite(offset)) return null
  if (precision === DEFAULT_CCP_PRECISION && offset === DEFAULT_CCP_OFFSET) return null
  return { precision, offset }
}

/** 继电器模块取值：0=老 1=单刀（单掷）2=双刀（双掷），与 Create CANoe 一致 */
export type RelayModule = 0 | 1 | 2

/** 继电器配置：Function / CAN 模块生成共用 RelayON/RelayOFF 时使用 */
export interface RelayConfig {
  /** 继电器模块（0=老 1=单刀 2=双刀） */
  relayModule: RelayModule
  /** CAN 通道（1 或 2） */
  canChannel: number
}

/** 使用继电器配置的模块 */
export type RelayConfigModule = 'function' | 'can'

/** 默认值：双刀 + 通道 2 —— 与 Function / CAN 改造前的内联实现一致，不配置时生成结果不变 */
export const DEFAULT_RELAY_CONFIG: RelayConfig = { relayModule: 2, canChannel: 2 }

/** DBC 环境变量 */
export interface DbcEnvVar {
  name: string
  type: string
  minimum: number | null
  maximum: number | null
  unit: string
  initial_value: number | null
}

const MODULE_NAMES = ['boot', 'uds', 'function', 'can', 'create_canoe', 'sanbao'] as const
export type ModuleName = (typeof MODULE_NAMES)[number]

// 判断是否为 { columns, rows } 格式的 DBC 数据
function isDbcArrayFormat(val: any): boolean {
  return val && Array.isArray(val.columns) && Array.isArray(val.rows)
}

/** 列名模糊匹配（大小写不敏感），未找到返回 -1 */
function findDbcColumnIndex(columns: any, keywords: string[]): number {
  if (!Array.isArray(columns)) return -1
  return columns.findIndex((c: any) => keywords.some((k) => String(c).toLowerCase().includes(k)))
}

/** 合并两路 { columns, rows } 的 DBC 数据，按「报文名 + 信号名」去重（保留先出现者）
 *
 *  上传的 DBC 与 CFG 引用的 DBC 可能是同一份（或高度重叠），
 *  直接拼接会让同一信号在对象浏览器里出现两次，故此处去重。
 */
function mergeDbcRows(base: any, extra: any) {
  const columns = base.columns
  const rows = [...base.rows]
  const msgIdx = findDbcColumnIndex(columns, ['msg_name', '报文名称'])
  const sigIdx = findDbcColumnIndex(columns, ['signal_name', '信号名称'])

  const keyOf = (row: any): string => {
    if (msgIdx < 0 || sigIdx < 0) return ''
    const sig = String(row?.[sigIdx] ?? '').trim()
    if (!sig || sig === 'None') return ''
    return `${String(row?.[msgIdx] ?? '').trim()}:::${sig}`
  }

  const seen = new Set<string>()
  for (const row of rows) {
    const key = keyOf(row)
    if (key) seen.add(key)
  }

  let dropped = 0
  for (const row of extra.rows) {
    const key = keyOf(row)
    if (key && seen.has(key)) {
      dropped++
      continue
    }
    if (key) seen.add(key)
    rows.push(row)
  }
  if (dropped) console.log('[Store] 对象浏览器 DBC 合并去重，移除重复行:', dropped)
  return { columns, rows }
}

export const useModuleStore = defineStore('modules', () => {
  // 当前活跃模块
  const activeModule = ref<ModuleName>('boot')

  // 全局主机厂选择（平台判断用，对应配置里的 serviceObject）
  const selectedOem = ref<string>('BYD')

  // 全局安全算法选择（每算法一项，值为算法 id，如 BYD_CBC；随配置保存为 securityAlgo）
  const selectedAlgo = ref<string>('BYD_CBC')

  // 全局 CFG 解析结果（模块间共享）
  const cfgData = ref<CfgData>({
    a2l_qualifier: '',
    a2l_path: '',
    cdd_qualifier: '',
    cdd_path: '',
    cfg_dir: '',
    databases: [],
  })

  // 各模块独立状态
  const moduleStates = ref<Record<ModuleName, ModuleState>>({
    boot: { loading: false, currentConfig: '', configList: [], lastUploadResult: null },
    uds: { loading: false, currentConfig: '', configList: [], lastUploadResult: null },
    function: { loading: false, currentConfig: '', configList: [], lastUploadResult: null },
    can: { loading: false, currentConfig: '', configList: [], lastUploadResult: null },
    create_canoe: { loading: false, currentConfig: '', configList: [], lastUploadResult: null },
    sanbao: { loading: false, currentConfig: '', configList: [], lastUploadResult: null },
  })

  // ==================== 对象浏览器共享数据 ====================
  // 优先加载 CFG 解析的数据，上传的 Excel/A2L/DBC 覆盖刷新
  // A2L 变量（来自 CFG 的 a2l_path 或上传的 .a2l 文件）
  const objA2lVars = ref<A2lVars>({ measurements: [], characteristics: [] })
  // CFG 目录解析的 DBC 数据（{ columns, rows } 格式）
  const objCfgDbcRaw = ref<any>(null)
  // 上传的 DBC / Excel DBC 数据（{ columns, rows } 格式）
  const objUploadDbcRaw = ref<any>(null)
  // DBC 环境变量（来自 .dbc 解析）
  const objDbcEnvVars = ref<DbcEnvVar[]>([])
  // DTC 数据（来自上传的 Excel）
  const objDtcRaw = ref<any>(null)
  // DTC 数据（来自 CDD 解析，三包模块专用）
  const objCddDtcRaw = ref<any>(null)
  // A2L Qualifier（用于 sysvar 拖拽转换）
  const objA2lQualifier = ref('')
  // CAN 模块电机类型：无刷（默认，解析 .a2l）/ 有刷（解析 .mapxml）
  const canMotorMode = ref<CanMotorMode>('brushless')
  // 有刷模式：手动指定的 CCP 系统变量类型 {符号名: int|float|int64}，未指定时后端按字节长度推断
  const ccpVarTypes = ref<Record<string, CcpVarType>>({})
  // 有刷模式：CCP 符号的精度/偏移 {符号名: {precision, offset}}，未指定时用默认 1 / 0
  const ccpVarScales = ref<Record<string, CcpVarScale>>({})
  // 继电器模块 / CAN 通道：Function、CAN 模块各自一份（侧边栏配置，生成时随请求下发）
  const relayConfigs = ref<Record<RelayConfigModule, RelayConfig>>({
    function: { ...DEFAULT_RELAY_CONFIG },
    can: { ...DEFAULT_RELAY_CONFIG },
  })

  /** 合并 DBC 数据（上传 + CFG 引用），用于对象浏览器；按「报文名 + 信号名」去重 */
  const objMergedDbcRaw = computed(() => {
    const hasUpload = isDbcArrayFormat(objUploadDbcRaw.value)
    const hasCfg = isDbcArrayFormat(objCfgDbcRaw.value)
    if (!hasUpload && !hasCfg) return null
    if (!hasUpload) return objCfgDbcRaw.value
    if (!hasCfg) return objUploadDbcRaw.value
    // 两路都存在时去重合并，避免同一信号重复显示（上传的 DBC 优先）
    return mergeDbcRows(objUploadDbcRaw.value, objCfgDbcRaw.value)
  })

  const objHasDbc = computed(() => isDbcArrayFormat(objMergedDbcRaw.value) && objMergedDbcRaw.value.rows.length > 0)
  const objHasDtc = computed(() => !!objDtcRaw.value && Array.isArray(objDtcRaw.value.rows) && objDtcRaw.value.rows.length > 0)
  const objHasA2l = computed(() => (objA2lVars.value.measurements?.length > 0 || objA2lVars.value.characteristics?.length > 0))
  const objHasCddDtc = computed(() => !!objCddDtcRaw.value && Array.isArray(objCddDtcRaw.value.rows) && objCddDtcRaw.value.rows.length > 0)

  /** 归一化 A2L 变量列表：兼容旧格式（string[]）与新格式（A2lVar[]） */
function normalizeA2lVars(list: any): A2lVar[] {
  if (!Array.isArray(list)) return []
  return list.map((v: any) => {
    if (typeof v === 'string') return { name: v, type: '' }
    const size = Number(v?.size)
    return {
      name: v?.name ?? '',
      type: v?.type ?? '',
      size: Number.isFinite(size) && size > 0 ? size : undefined,
    }
  })
}

/** 从路径加载 A2L 文件（CFG 解析后自动调用，或外部主动调用） */
  async function loadA2lFromPath(a2lPath: string) {
    if (!a2lPath) return
    try {
      const res: any = await parseA2lFileFromPath(a2lPath)
      const data = res?.data || {}
      objA2lVars.value = {
        measurements: normalizeA2lVars(data.measurements),
        characteristics: normalizeA2lVars(data.characteristics),
      }
      console.log('[Store] A2L loaded from path:', a2lPath, 'vars:', objA2lVars.value)
    } catch (e) {
      console.warn('[Store] Failed to load A2L from path:', a2lPath, e)
    }
  }

  /** 从 cfg 同目录下的 DBC 文件夹加载 DBC 文件（仅加载到对象浏览器）
   *  优先使用 CANoe 实例引用的 DBC（唯一且权威），无引用时后端回退扫描目录 */
  async function loadDbcFromCfgDir(cfgDir: string) {
    if (!cfgDir) return
    const dbcPaths = (cfgData.value.databases || [])
      .map((d) => String(d?.path || '').trim())
      .filter((p) => p.toLowerCase().endsWith('.dbc'))
    try {
      const res: any = await parseDbcFromCfgDir(cfgDir, dbcPaths)
      const data = res?.data || {}
      if (data.columns && data.rows && data.rows.length > 0) {
        objCfgDbcRaw.value = data
        if (Array.isArray(data.environment_variables)) {
          objDbcEnvVars.value = data.environment_variables
        }
        console.log('[Store] CFG DBC loaded:', cfgDir, 'rows:', data.rows.length)
      } else {
        console.log('[Store] CFG 目录 DBC 文件夹为空或无数据:', cfgDir)
      }
    } catch (e: any) {
      console.error('[Store] loadDbcFromCfgDir 失败:', cfgDir, e?.message || e)
    }
  }

  /** 从路径加载 CDD 文件解析 DTC（三包模块专用，CFG 解析后自动调用） */
  async function loadCddFromPath(cddPath: string) {
    if (!cddPath) return
    try {
      const res: any = await parseCddFromPath(cddPath)
      const data = res?.data || {}
      if (data.columns && data.rows) {
        objCddDtcRaw.value = data
        console.log('[Store] CDD DTC loaded:', cddPath, 'count:', data.dtc_count)
      }
    } catch (e: any) {
      console.error('[Store] loadCddFromPath 失败:', cddPath, e?.message || e)
    }
  }

  /** 设置上传的 DBC 数据（Excel / .dbc 文件） */
  function setUploadDbc(data: any) {
    const valid = isDbcArrayFormat(data) ? data : null
    objUploadDbcRaw.value = valid
    if (valid && Array.isArray(valid.environment_variables)) {
      objDbcEnvVars.value = valid.environment_variables
    }
  }
  /** 设置 DTC 数据 */
  function setDtc(data: any) {
    objDtcRaw.value = data
  }
  /** 设置 CDD DTC 数据 */
  function setCddDtc(data: any) {
    objCddDtcRaw.value = data
  }
  /** 设置 A2L 变量数据 */
  function setA2lVars(data: A2lVars | null) {
    objA2lVars.value = data
      ? { measurements: normalizeA2lVars(data.measurements), characteristics: normalizeA2lVars(data.characteristics) }
      : { measurements: [], characteristics: [] }
  }
  /** 设置 A2L Qualifier */
  function setA2lQualifier(q: string) {
    objA2lQualifier.value = q || ''
  }

  /** 切换 CAN 模块电机类型：两种模式解析的变量互斥，切换时清空对象浏览器；
   *  有刷模式不使用 A2L 限定符，一并清空 */
  function setCanMotorMode(mode: CanMotorMode) {
    if (mode === canMotorMode.value) return
    canMotorMode.value = mode
    objA2lVars.value = { measurements: [], characteristics: [] }
    if (mode === 'brushed') objA2lQualifier.value = ''
    else {
      ccpVarTypes.value = {}
      ccpVarScales.value = {}
    }
  }

  /** 设置某符号的 CCP 系统变量类型（空值清除，回退按字节长度推断） */
  function setCcpVarType(name: string, type: CcpVarType | '') {
    const key = String(name || '').trim()
    if (!key) return
    const next = { ...ccpVarTypes.value }
    if (type) next[key] = type
    else delete next[key]
    ccpVarTypes.value = next
  }

  /** 设置某符号的 CCP 精度 / 偏移（两项都是默认 1 / 0 时删除该条目） */
  function setCcpVarScale(name: string, scale: CcpVarScale) {
    const key = String(name || '').trim()
    if (!key) return
    const next = { ...ccpVarScales.value }
    const norm = normalizeCcpScale(scale)
    if (norm) next[key] = norm
    else delete next[key]
    ccpVarScales.value = next
  }

  /** 整表设置 CCP 精度 / 偏移（加载配置时回填；非法项与默认值项都不记录） */
  function setCcpVarScales(scales: Record<string, CcpVarScale> | null | undefined) {
    const next: Record<string, CcpVarScale> = {}
    for (const [rawKey, rawScale] of Object.entries(scales || {})) {
      const key = String(rawKey || '').trim()
      if (!key || !rawScale || typeof rawScale !== 'object') continue
      const norm = normalizeCcpScale(rawScale)
      if (norm) next[key] = norm
    }
    ccpVarScales.value = next
  }

  /** 设置 Function / CAN 模块的继电器配置（部分更新） */
  function setRelayConfig(module: RelayConfigModule, cfg: Partial<RelayConfig>) {
    const cur = relayConfigs.value[module]
    relayConfigs.value[module] = {
      relayModule: cfg.relayModule ?? cur.relayModule,
      canChannel: cfg.canChannel ?? cur.canChannel,
    }
  }

  // 监听全局 CFG 数据变化：优先加载 CFG 解析的 A2L / DBC 数据
  watch(cfgData, (data) => {
    if (!data) return
    // A2L Qualifier 同步（仅无刷模式；有刷模式不使用 A2L 限定符）
    if (data.a2l_qualifier && canMotorMode.value === 'brushless') setA2lQualifier(data.a2l_qualifier)
    // 优先加载 CFG 解析的 A2L（仅无刷模式；有刷模式改用 .mapxml）
    if (data.a2l_path && canMotorMode.value === 'brushless') loadA2lFromPath(data.a2l_path)
    // 优先加载 CFG 目录的 DBC
    if (data.cfg_dir) loadDbcFromCfgDir(data.cfg_dir)
  }, { deep: true })

  /** 拉取指定模块的配置列表 */
  async function fetchConfigList(module: ModuleName) {
    const state = moduleStates.value[module]
    state.loading = true
    try {
      const res: any = await getConfigs(module)
      state.configList = Array.isArray(res) ? res : res?.data ?? []
    } catch {
      state.configList = []
    } finally {
      state.loading = false
    }
  }

  /** 设置当前配置 */
  function setCurrentConfig(module: ModuleName, name: string) {
    moduleStates.value[module].currentConfig = name
  }

  /** 设置活跃模块 */
  function setActiveModule(module: ModuleName) {
    activeModule.value = module
  }

  /** 设置主机厂 */
  function setSelectedOem(oem: string) {
    selectedOem.value = oem
  }

  /** 设置安全算法 */
  function setSelectedAlgo(algo: string) {
    selectedAlgo.value = algo
  }

  /** 设置模块上传结果 */
  function setModuleUploadResult(module: ModuleName, result: any) {
    moduleStates.value[module].lastUploadResult = result
  }

  /** 设置 CFG 数据 */
  function setCfgData(data: CfgData) {
    cfgData.value = { ...data }
  }

  return {
    activeModule,
    selectedOem,
    selectedAlgo,
    cfgData,
    moduleStates,
    // 对象浏览器共享数据
    objA2lVars,
    objCfgDbcRaw,
    objUploadDbcRaw,
    objDbcEnvVars,
    objDtcRaw,
    objCddDtcRaw,
    objA2lQualifier,
    canMotorMode,
    ccpVarTypes,
    ccpVarScales,
    relayConfigs,
    objMergedDbcRaw,
    objHasDbc,
    objHasDtc,
    objHasA2l,
    objHasCddDtc,
    loadA2lFromPath,
    loadDbcFromCfgDir,
    loadCddFromPath,
    setUploadDbc,
    setDtc,
    setCddDtc,
    setA2lVars,
    setA2lQualifier,
    setCanMotorMode,
    setCcpVarType,
    setCcpVarScale,
    setCcpVarScales,
    setRelayConfig,
    fetchConfigList,
    setCurrentConfig,
    setActiveModule,
    setSelectedOem,
    setSelectedAlgo,
    setModuleUploadResult,
    setCfgData,
  }
})

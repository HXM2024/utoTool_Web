import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { getConfigs, getRelayConfig, saveRelayConfig } from '@/api/config'
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

/** 继电器配置：Function / CAN / 三包 模块生成共用 RelayON/RelayOFF 时使用 */
export interface RelayConfig {
  /** 继电器模块（0=老 1=单刀 2=双刀） */
  relayModule: RelayModule
  /** CAN 通道（1 或 2） */
  canChannel: number
}

/** 使用继电器配置的模块 */
export type RelayConfigModule = 'function' | 'can' | 'sanbao'

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

/** 是否为「有内容」的 A2L 变量集（对象浏览器按优先级取一路时判定用） */
function hasA2lVars(v: A2lVars | null | undefined): boolean {
  return !!v && ((v.measurements?.length || 0) > 0 || (v.characteristics?.length || 0) > 0)
}

/** { columns, rows } 是否是有数据的 DBC */
function hasDbcRows(v: any): boolean {
  return isDbcArrayFormat(v) && v.rows.length > 0
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
  // 三个来源，按优先级取一路展示（高优先级有内容就整体替换，不合并、不续写）：
  //   独立上传文件 > CFG 解析 > 配置自带
  // A2L 变量：CFG 的 a2l_path 解析
  const objCfgA2lVars = ref<A2lVars>({ measurements: [], characteristics: [] })
  // A2L 变量：配置自带（加载配置时恢复的 CCP 符号表）
  const objConfigA2lVars = ref<A2lVars>({ measurements: [], characteristics: [] })
  // 上传的 A2L / mapxml 按电机模式分别缓存：切换模式时各自保留，
  // 切回来立即恢复原来的符号列表（原先切换会无条件清空，且无处恢复 —— 切回后对象浏览器永久空白）。
  const objUploadA2lVarsByMode = ref<Record<CanMotorMode, A2lVars>>({
    brushless: { measurements: [], characteristics: [] },
    brushed: { measurements: [], characteristics: [] },
  })
  // CFG 目录解析的 DBC 数据（{ columns, rows } 格式）
  const objCfgDbcRaw = ref<any>(null)
  // 上传的 DBC / Excel DBC 数据（{ columns, rows } 格式）
  const objUploadDbcRaw = ref<any>(null)
  // DBC 环境变量（来自 .dbc 解析）：分两路存，与 DBC 用同一套优先级取一路
  const objUploadDbcEnvVars = ref<DbcEnvVar[]>([])
  const objCfgDbcEnvVars = ref<DbcEnvVar[]>([])
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
  // 有刷模式：CCP 符号的地址/长度覆盖 {符号名: {addr, size}}。
  // .mapxml 允许手工修正地址长度，结构体拆分出的子变量也登记在这里；配置优先于 .mapxml。
  const ccpVarOverrides = ref<Record<string, { addr?: string; size?: number }>>({})
  // 有刷模式：手工新增 / 结构体拆分出的自定义符号（.mapxml 里没有的）。
  // 与 .mapxml 符号同库展示、同样可拖拽引用、同样参与生成。
  const ccpCustomVars = ref<Array<A2lVar & { kind?: 'measurement' | 'characteristic' }>>([])
  /** 当前电机模式对应的「独立上传」槽位：读写都落在本模式，切换模式不互相覆盖
   *
   *  无刷 = 上传的 .a2l，有刷 = 上传的 .mapxml。两模式各存一份，
   *  来回切换时对象浏览器的符号列表原样恢复，不需要重新上传。
   */
  const objUploadA2lVars = computed<A2lVars>({
    get: () => objUploadA2lVarsByMode.value[canMotorMode.value],
    set: (next: A2lVars) => {
      objUploadA2lVarsByMode.value[canMotorMode.value] = next
    },
  })
  // 继电器模块 / CAN 通道：Function、CAN、三包 模块各自一份（侧边栏配置，生成时随请求下发）
  const relayConfigs = ref<Record<RelayConfigModule, RelayConfig>>({
    function: { ...DEFAULT_RELAY_CONFIG },
    can: { ...DEFAULT_RELAY_CONFIG },
    sanbao: { ...DEFAULT_RELAY_CONFIG },
  })

  /** 对象浏览器 A2L 变量：独立上传 > CFG 解析 > 配置自带，取最高优先级的一路（不合并）
   *
   *  之后再叠加「CCP 覆盖」：地址/长度按 ccpVarOverrides 覆盖 .mapxml 原值，
   *  自定义变量（ccpCustomVars）追加进来。这样对象浏览器显示、拖拽、生成三处
   *  看到的是同一份数据，不会出现「改了地址但生成还用旧值」的错位。 */
  const objA2lVars = computed<A2lVars>(() => {
    // CFG 的 a2l_path 只在无刷模式解析（有刷改用 .mapxml），有刷模式不吃这一路，
    // 否则「切到有刷但还没传 mapxml」会看到无刷的 A2L 变量（地址是数据类型串，生成必错）
    const cfgVars = canMotorMode.value === 'brushless' ? objCfgA2lVars.value : null
    const base = hasA2lVars(objUploadA2lVars.value)
      ? objUploadA2lVars.value
      : hasA2lVars(cfgVars)
        ? (cfgVars as A2lVars)
        : objConfigA2lVars.value
    // 覆盖表 / 自定义变量属于有刷模式（mapxml 符号），无刷模式不叠加，避免串到 A2L 变量树上
    const isBrushed = canMotorMode.value === 'brushed'
    const ov = isBrushed ? ccpVarOverrides.value : {}
    const custom = isBrushed ? ccpCustomVars.value : []
    if (!Object.keys(ov).length && !custom.length) return base
    const applyOv = (v: A2lVar): A2lVar => {
      const o = ov[v.name]
      if (!o) return v
      return { ...v, type: o.addr ?? v.type, size: o.size ?? v.size }
    }
    return {
      measurements: [...base.measurements.map(applyOv), ...custom.filter((c) => c.kind !== 'characteristic')],
      characteristics: [...base.characteristics.map(applyOv), ...custom.filter((c) => c.kind === 'characteristic')],
    }
  })

  /** 对象浏览器 DBC 数据：独立上传 > CFG 解析，取最高优先级的一路（不合并）
   *
   *  过去这里把「上传」与「CFG」两路合并去重，去重键依赖列名/index 对齐，
   *  一旦两路列结构不一致就会去重失效 —— 表现为上传 DBC 后对象浏览器里出现两份相同内容。
   *  现在改为单选：有上传就整体替换 CFG 那一路。
   */
  const objMergedDbcRaw = computed(() => {
    if (hasDbcRows(objUploadDbcRaw.value)) return objUploadDbcRaw.value
    if (hasDbcRows(objCfgDbcRaw.value)) return objCfgDbcRaw.value
    return null
  })

  const objHasDbc = computed(() => hasDbcRows(objMergedDbcRaw.value))

  /** 对象浏览器 DBC 环境变量：与 DBC 同源优先级（独立上传 > CFG 解析）
   *
   *  必须与 objMergedDbcRaw 取同一路，否则会出现「显示的是上传的 DBC、
   *  环境变量名单却来自 CFG」的错位。
   */
  const objDbcEnvVars = computed<DbcEnvVar[]>(() =>
    objUploadDbcEnvVars.value.length ? objUploadDbcEnvVars.value : objCfgDbcEnvVars.value,
  )
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
      objCfgA2lVars.value = {
        measurements: normalizeA2lVars(data.measurements),
        characteristics: normalizeA2lVars(data.characteristics),
      }
      console.log('[Store] A2L loaded from path:', a2lPath, 'vars:', objCfgA2lVars.value)
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
          objCfgDbcEnvVars.value = data.environment_variables
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
    // 清空上传（切配置 / 重置）时一并清掉上传侧环境变量；带 environment_variables 时覆盖
    if (!valid) objUploadDbcEnvVars.value = []
    else if (Array.isArray(valid.environment_variables)) objUploadDbcEnvVars.value = valid.environment_variables
  }
  /** 设置 DTC 数据 */
  function setDtc(data: any) {
    objDtcRaw.value = data
  }
  /** 设置 CDD DTC 数据 */
  function setCddDtc(data: any) {
    objCddDtcRaw.value = data
  }
  /** 设置 A2L 变量数据
   *
   *  source 决定写入哪一路（对象浏览器按 独立上传 > CFG解析 > 配置自带 取最高优先级）：
   *    'upload' —— 独立上传的 .a2l（默认，保持既有调用语义）
   *    'config' —— 配置自带（加载配置时恢复的 CCP 符号表）
   */
  function setA2lVars(data: A2lVars | null, source: 'upload' | 'config' = 'upload') {
    const next = data
      ? { measurements: normalizeA2lVars(data.measurements), characteristics: normalizeA2lVars(data.characteristics) }
      : { measurements: [], characteristics: [] }
    if (source === 'config') objConfigA2lVars.value = next
    else objUploadA2lVars.value = next
  }
  /** 设置 A2L Qualifier */
  function setA2lQualifier(q: string) {
    objA2lQualifier.value = q || ''
  }

  /** 切换 CAN 模块电机类型
   *
   *  两种模式的 A2L / mapxml 各自保留（objUploadA2lVars 按模式分槽），切换只清模式专属设置，
   *  不动任何符号数据 —— 原先无条件清空三路 A2L 且无处恢复，表现为「切走再切回，对象浏览器永久空白」。
   */
  function setCanMotorMode(mode: CanMotorMode) {
    if (mode === canMotorMode.value) return
    canMotorMode.value = mode
    // 无刷不使用 A2L 限定符（有刷侧不适用，保留原值以便切回）
    if (mode === 'brushed') objA2lQualifier.value = ''
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

  /** 整表设置 CCP 系统变量类型（加载配置 / 导入分组文件依赖时回填） */
  function setCcpVarTypes(table: Record<string, CcpVarType> | null | undefined) {
    const next: Record<string, CcpVarType> = {}
    for (const [k, v] of Object.entries(table || {})) {
      if (v === 'int' || v === 'float' || v === 'int64') next[k] = v
    }
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

  /** 设置某符号的 CCP 覆盖属性（地址 / 长度）。
   *
   *  用途：.mapxml 解析出的地址/长度允许手工修正，结构体拆分出的子变量也走这里登记。
   *  覆盖表优先于 .mapxml 自带值 —— 重新上传 .mapxml 不会冲掉手工修正（配置优先）。
   *  两项都给空串/0 时删除条目（回退 .mapxml 原值）。
   */
  function setCcpVarOverride(name: string, patch: { addr?: string; size?: number }) {
    const key = String(name || '').trim()
    if (!key) return
    const cur = ccpVarOverrides.value[key] || {}
    const addr = patch.addr !== undefined ? String(patch.addr || '').trim() : cur.addr
    const size = patch.size !== undefined ? Number(patch.size) || 0 : cur.size
    const next = { ...ccpVarOverrides.value }
    if (!addr && !size) delete next[key]
    else next[key] = { addr: addr || undefined, size: size || undefined }
    ccpVarOverrides.value = next
  }

  /** 整表设置 CCP 覆盖属性（加载配置时回填） */
  function setCcpVarOverrides(table: Record<string, { addr?: string; size?: number }> | null | undefined) {
    const next: Record<string, { addr?: string; size?: number }> = {}
    for (const [rawKey, rawVal] of Object.entries(table || {})) {
      const key = String(rawKey || '').trim()
      if (!key || !rawVal || typeof rawVal !== 'object') continue
      const addr = String(rawVal.addr || '').trim()
      const size = Number(rawVal.size) || 0
      if (addr || size) next[key] = { addr: addr || undefined, size: size || undefined }
    }
    ccpVarOverrides.value = next
  }

  /** 设置某符号的原始名称映射（自定义变量用于生成时的符号名） */
  function removeCcpVarOverride(name: string) {
    const key = String(name || '').trim()
    if (!key) return
    const next = { ...ccpVarOverrides.value }
    delete next[key]
    ccpVarOverrides.value = next
  }

  /** 新增 / 更新一个自定义 CCP 符号（同名则覆盖）。地址与长度必须都有，否则忽略。 */
  function upsertCcpCustomVar(v: A2lVar & { kind?: 'measurement' | 'characteristic' }) {
    const name = String(v?.name || '').trim()
    const addr = String(v?.type || '').trim()
    const size = Number(v?.size) || 0
    if (!name || !addr || size <= 0) return
    const entry: A2lVar & { kind?: 'measurement' | 'characteristic' } = {
      name,
      type: addr,
      size,
      precision: v.precision,
      offset: v.offset,
      kind: v.kind === 'characteristic' ? 'characteristic' : 'measurement',
    }
    const next = ccpCustomVars.value.filter((x) => x.name !== name)
    next.push(entry)
    ccpCustomVars.value = next
  }

  /** 删除一个自定义 CCP 符号（.mapxml 符号不受影响，只能通过覆盖表改属性） */
  function removeCcpCustomVar(name: string) {
    const key = String(name || '').trim()
    if (!key) return
    ccpCustomVars.value = ccpCustomVars.value.filter((x) => x.name !== key)
  }

  /** 整表设置自定义符号（加载配置时回填） */
  function setCcpCustomVars(list: Array<A2lVar & { kind?: 'measurement' | 'characteristic' }> | null | undefined) {
    const next: Array<A2lVar & { kind?: 'measurement' | 'characteristic' }> = []
    for (const v of list || []) {
      const name = String(v?.name || '').trim()
      const addr = String(v?.type || '').trim()
      const size = Number(v?.size) || 0
      if (!name || !addr || size <= 0) continue
      next.push({
        name,
        type: addr,
        size,
        precision: v.precision,
        offset: v.offset,
        kind: v.kind === 'characteristic' ? 'characteristic' : 'measurement',
      })
    }
    ccpCustomVars.value = next
  }

  /** 设置 Function / CAN / 三包 模块的继电器配置（部分更新，并落盘到后端） */
  function setRelayConfig(module: RelayConfigModule, cfg: Partial<RelayConfig>) {
    const cur = relayConfigs.value[module]
    const next: RelayConfig = {
      relayModule: cfg.relayModule ?? cur.relayModule,
      canChannel: cfg.canChannel ?? cur.canChannel,
    }
    relayConfigs.value[module] = next
    // 落盘：原先只存内存，刷新页面 / 重启客户端即回落默认值
    void saveRelayConfig({ module, ...next }).catch(() => {
      /* 写入失败不打断交互：本地值已生效，下次修改会再写一次 */
    })
  }

  /** 启动时从后端加载继电器配置（Function / CAN / 三包 共用，失败保留默认值） */
  async function loadRelayConfig() {
    try {
      const res: any = await getRelayConfig()
      const data = res?.data?.data ?? res?.data ?? {}
      const conf = data?.relay_configs
      if (!conf || typeof conf !== 'object') return
      for (const module of ['function', 'can', 'sanbao'] as RelayConfigModule[]) {
        const item = conf[module]
        if (!item) continue
        relayConfigs.value[module] = {
          relayModule: Number(item.relayModule) as RelayModule,
          canChannel: Number(item.canChannel),
        }
      }
    } catch {
      /* 加载失败保留默认值（双刀 + 通道 2） */
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

  /** 切换模块时清掉「独立上传」这一路的数据（属于上一个模块的会话内容）
   *
   *  只清上传路，不动 CFG 解析（全局同一个工程的权威数据，重新解析代价高）与配置自带数据：
   *  - 避免 CAN 上传的大 DBC 常驻 store，被 Function 的对象浏览器复用（内容错位 + 建树卡顿）
   *  - 上传的文件本身是「这一次操作」，切模块后需要重新上传
   */
  function clearModuleUploads() {
    objUploadDbcRaw.value = null
    objUploadDbcEnvVars.value = []
    clearUploadA2lVars()
  }

  /** 清空两种模式的「独立上传」A2L 槽位
   *
   *  上传路优先级最高，会在加载配置时遮住配置自带的 CCP 符号表，
   *  所以加载配置 / 切模块时两种模式一起清（不只是当前模式）。
   */
  function clearUploadA2lVars() {
    objUploadA2lVarsByMode.value = {
      brushless: { measurements: [], characteristics: [] },
      brushed: { measurements: [], characteristics: [] },
    }
  }

  // ==================== 模块离开守卫（切换模块前询问是否保存） ====================
  /** 返回 false 表示取消离开（例如用户在弹窗上点了关闭） */
  type ModuleLeaveGuard = () => Promise<boolean> | boolean
  const moduleLeaveGuards = new Map<ModuleName, ModuleLeaveGuard>()

  /** 注册当前模块的「离开前守卫」（各视图 setup 时注册一次） */
  function registerModuleLeaveGuard(module: ModuleName, guard: ModuleLeaveGuard) {
    moduleLeaveGuards.set(module, guard)
  }

  /** 执行指定模块的离开守卫：无守卫视为可直接离开 */
  async function runModuleLeaveGuard(module: ModuleName): Promise<boolean> {
    const guard = moduleLeaveGuards.get(module)
    if (!guard) return true
    return (await guard()) !== false
  }

  /** 设置活跃模块 */
  function setActiveModule(module: ModuleName) {
    if (module !== activeModule.value) clearModuleUploads()
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
    ccpVarOverrides,
    ccpCustomVars,
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
    clearUploadA2lVars,
    setA2lQualifier,
    setCanMotorMode,
    setCcpVarType,
    setCcpVarTypes,
    setCcpVarScale,
    setCcpVarScales,
    setCcpVarOverride,
    setCcpVarOverrides,
    removeCcpVarOverride,
    upsertCcpCustomVar,
    removeCcpCustomVar,
    setCcpCustomVars,
    setRelayConfig,
    loadRelayConfig,
    fetchConfigList,
    setCurrentConfig,
    setActiveModule,
    setSelectedOem,
    setSelectedAlgo,
    setModuleUploadResult,
    setCfgData,
    clearModuleUploads,
    registerModuleLeaveGuard,
    runModuleLeaveGuard,
  }
})

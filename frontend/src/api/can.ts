import client from './client'

/** CAN 模块接口 */

/** 上传 Excel 解析 CAN 数据（multipart/form-data, field: "file"） */
export const parseCAN = (file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  return client.post('/can/parse', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

/** 上传 .dbc 文件解析报文信号数据（multipart/form-data, field: "file"） */
export const parseDbcFile = (file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  return client.post('/can/parse-dbc', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

/** 获取图表数据（type: communication / diagnostic / power_assist） */
export const getChartData = (type: string) =>
  client.get(`/can/chart-data/${type}`)

/** 更新图表参数（type: communication / diagnostic / power_assist） */
export const updateParams = (type: string, params: any) =>
  client.put(`/can/params/${type}`, params)

/** 生成 CAN 脚本（body: { config_name, service_object, cfg_dir, motor_mode, ccp_symbols, relay_module, can_channel }）
 *  motor_mode：brushless 无刷（A2L/XCP）/ brushed 有刷（mapxml + CCP 采集）
 *  ccp_symbols：有刷模式下用到的符号 → { addr, size, type? }，用于生成 CCP 采集模块
 *  relay_module / can_channel：继电器模块（0老/1单刀/2双刀）与 CAN 通道（1/2），
 *  写入 TestFunction.cin 里共用的 RelayON/RelayOFF（见 backend/templates/relay.py） */
export const generateCAN = (
  configName: string,
  serviceObject: string,
  cfgDir?: string,
  motorMode: 'brushless' | 'brushed' = 'brushless',
  ccpSymbols: Record<string, { addr: string; size: number; type?: string }> = {},
  relayModule?: number,
  canChannel?: number,
) =>
  client.post('/can/generate', {
    config_name: configName,
    service_object: serviceObject,
    cfg_dir: cfgDir,
    motor_mode: motorMode,
    ccp_symbols: ccpSymbols,
    relay_module: relayModule,
    can_channel: canChannel,
  })

/** 上传 .cfg 文件解析配置信息（multipart/form-data, field: "file"） */
export const parseCfgFile = (file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  return client.post('/can/parse-cfg', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

/** 通过 CANoe COM 接口解析 .cfg 文件（multipart/form-data, field: "file"） */
export const parseCfgCanoe = (file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  return client.post('/can/parse-cfg-canoe', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
  })
}

/** 从本地路径解析 CFG 文件（通过 CANoe COM 接口，不另存到临时目录） */
export const parseCfgFromPath = (cfgPath: string) => {
  return client.post('/can/parse-cfg-path', { path: cfgPath }, { timeout: 120000 })
}

/** 从 cfg 同目录下的 DBC 文件夹解析 DBC
 *  dbcPaths：CANoe 实例引用的 DBC 路径（唯一），传入时后端只解析这些文件；
 *            为空时后端回退为扫描 DBC 文件夹 */
export const parseDbcFromCfgDir = (cfgDir: string, dbcPaths: string[] = []) => {
  return client.post('/can/parse-dbc-from-cfg-dir', { cfg_dir: cfgDir, dbc_paths: dbcPaths })
}

/** 上传 .a2l 文件解析变量信息（multipart/form-data, field: "file"） */
export const parseA2lFile = (file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  return client.post('/can/parse-a2l', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

/** 把当前配置导出为 Excel（三张矩阵表）
 * columns：表格视图当前显示的列定义 [{key, label, en?}]，Excel 按此顺序与显隐导出；
 * save_path 非空时由后端直接写盘；为空时返回 base64 供浏览器下载 */
export const exportConfigExcel = (
  data: any,
  name: string,
  savePath: string = '',
  columns: Array<{ key: string; label: string; en?: string; scope?: string }> = [],
) => client.post('/can/export-excel', { data, name, save_path: savePath, columns })

/** 从路径解析 A2L 文件 */
export const parseA2lFileFromPath = (a2lPath: string) => {
  return client.post('/can/parse-a2l-path', { path: a2lPath })
}

/** 上传 .mapxml（链接器映射）文件解析全局符号信息（multipart/form-data, field: "file"） */
export const parseMapxmlFile = (file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  return client.post('/can/parse-mapxml', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

// ==================== Great Canoe 模块接口 ====================

/** DBC 文件转 Excel（multipart/form-data, field: "file"） */
export const dbcToExcel = (file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  return client.post('/great-canoe/dbc-to-excel', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

/** Excel 文件转 DBC（multipart/form-data, field: "file"） */
export const excelToDbc = (file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  return client.post('/great-canoe/excel-to-dbc', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

/** 创建新的 CANoe 配置（Application.New 方法）
 * body: { save_path, auto_save, prompt_user }
 */
export const newCanoeConfig = (savePath: string, autoSave: boolean = true, promptUser: boolean = false) => {
  return client.post('/great-canoe/new-config', {
    save_path: savePath,
    auto_save: autoSave,
    prompt_user: promptUser,
  }, { timeout: 120000 })
}

/** 根据 Excel 生成完整 CANoe 配置（含 DBC、CAPL、面板等）
 * multipart/form-data: file + output_dir + dbc_name + create_canoe_cfg + generate_envvar + generate_panel + generate_nodes
 */
export const generateCanoeConfig = (
  file: File,
  outputDir: string = '',
  dbcName: string = '',
  createCanoeCfg: boolean = true,
  generateEnvvar: boolean = true,
  generatePanel: boolean = true,
  generateNodes: boolean = true,
) => {
  const formData = new FormData()
  formData.append('file', file)
  if (outputDir) formData.append('output_dir', outputDir)
  if (dbcName) formData.append('dbc_name', dbcName)
  formData.append('create_canoe_cfg', String(createCanoeCfg))
  formData.append('generate_envvar', String(generateEnvvar))
  formData.append('generate_panel', String(generatePanel))
  formData.append('generate_nodes', String(generateNodes))
  return client.post('/great-canoe/generate-config', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 300000,
  })
}

/** 根据前端树形图数据生成完整 CANoe 配置
 * JSON: { tree_data, dbc_name, output_dir, create_canoe_cfg, generate_envvar, generate_panel, generate_nodes,
 *         unused_byte, ready_signal, ready_on, ready_off, car_spd_signal, oem,
 *         can_channel, relay_module, dtc_list }
 * 不再重新解析文件，直接使用树形图上的编辑结果。
 */
export const generateCanoeConfigFromTree = (
  treeData: any[],
  outputDir: string = '',
  dbcName: string = '',
  createCanoeCfg: boolean = true,
  generateEnvvar: boolean = true,
  generatePanel: boolean = true,
  generateNodes: boolean = true,
  unusedByte: number = 0,
  readySignal: string = '',
  readyOn: string = '',
  readyOff: string = '',
  carSpdSignal: string = '',
  oem: string = '',
  canChannel: number = 1,
  relayModule: number = 0,
  dtcList: string[] = [],
  crcAlgorithms: any[] | null = null,
) => {
  return client.post('/great-canoe/generate-config-from-tree', {
    tree_data: treeData,
    dbc_name: dbcName,
    output_dir: outputDir,
    create_canoe_cfg: createCanoeCfg,
    generate_envvar: generateEnvvar,
    generate_panel: generatePanel,
    generate_nodes: generateNodes,
    unused_byte: unusedByte,
    ready_signal: readySignal,
    ready_on: readyOn,
    ready_off: readyOff,
    car_spd_signal: carSpdSignal,
    oem: oem,
    can_channel: canChannel,
    relay_module: relayModule,
    dtc_list: dtcList,
    crc_algorithms: crcAlgorithms,
  }, {
    timeout: 300000,
  })
}

// ==================== CRC 算法管理接口 ====================

/** CRC 算法项 */
export interface CrcAlgorithm {
  name: string
  code: string
}

/** 加载所有 CRC 算法 */
export const getCrcAlgorithms = () => {
  return client.get('/crc/algorithms')
}

/** 保存所有 CRC 算法（自动上传到远程共享） */
export const saveCrcAlgorithms = (algorithms: CrcAlgorithm[]) => {
  return client.post('/crc/algorithms', { algorithms })
}

/** 从远程共享拉取 CRC 算法（并集模式） */
export const pullCrcAlgorithms = (mergeMode: boolean = true) => {
  return client.post('/crc/algorithms/pull', { merge_mode: mergeMode })
}

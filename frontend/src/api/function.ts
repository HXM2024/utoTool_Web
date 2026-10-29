import client from './client'
import type { Card, ObjectMapping, Graph, ExpandedCase, ValueResource } from '@/types/functionGraph'

/** Function 模块接口 */

/** 解析 Excel 文件（封装 FormData 上传） */
export const parseFunction = (file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  return client.post('/function/parse', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

/** 生成输出文件（XML / CAPL 代码）
 *  relay_module / can_channel：继电器模块（0老/1单刀/2双刀）与 CAN 通道（1/2），
 *  写入 TestFunction.cin 里共用的 RelayON/RelayOFF（见 backend/templates/relay.py） */
export const generateFunction = (
  configName: string,
  cfgDir?: string,
  relayModule?: number,
  canChannel?: number,
  envVarNames?: string[],
  oem?: string,
  securityAlgo?: string,
) => {
  return client.post('/function/generate', {
    config_name: configName,
    cfg_dir: cfgDir,
    relay_module: relayModule,
    can_channel: canChannel,
    env_var_names: envVarNames,
    // 主机厂 / 安全算法：取侧边栏当前选择，避免生成时读到配置里的旧值
    oem,
    security_algo: securityAlgo,
  })
}

/** 故障注入/结果卡片定义 */
export interface LibraryCard {
  id: string
  name: string
  code: string
  description?: string
}

/** 全局库数据结构 */
export interface GlobalLibraryData {
  function_library: string
  step_library: any[]
  inject_library: LibraryCard[]
  result_library: LibraryCard[]
  /** 统一组合卡片库：inject/sequence/result 三桶 */
  cards?: { inject: Card[]; sequence: Card[]; result: Card[] }
  /** 全对象映射表 */
  mapping?: ObjectMapping
  /** 值资源库：常量 / 列表 / 区间 */
  value_library?: ValueResource[]
}

/** 获取全局函数库（函数库 + 步骤库 + 故障注入/结果卡片，独立于配置） */
export const getGlobalLibrary = () =>
  client.get('/function/global-library')

/** 保存全局函数库（函数库 + 步骤库 + 故障注入/结果卡片，独立于配置） */
export const saveGlobalLibrary = (data: Partial<GlobalLibraryData>) =>
  client.post('/function/global-library', data)

/** 用后端内置模板重置全局函数库源码（保留卡片库 / 映射表 / 值资源库） */
export const resetGlobalFunctions = () =>
  client.post('/function/global-library/reset-functions', {})

/** 全局库内容（前端字段名归一：value_library → valueLibrary） */
export interface GlobalSections {
  cards: { inject: Card[]; sequence: Card[]; result: Card[] }
  mapping: ObjectMapping
  valueLibrary: ValueResource[]
}

/** 读取全局库并归一字段名。后端按顶层键与既有数据合并，只写其中一段不会动其它段。 */
export async function loadGlobalSections(): Promise<GlobalSections> {
  const res: any = await getGlobalLibrary()
  const data = res?.data?.data ?? res?.data ?? {}
  return {
    cards: {
      inject: data.cards?.inject || [],
      sequence: data.cards?.sequence || [],
      result: data.cards?.result || [],
    },
    mapping: {
      signals: data.mapping?.signals || [],
      dtcs: data.mapping?.dtcs || [],
      messages: data.mapping?.messages || [],
      envvars: data.mapping?.envvars || [],
      a2l: data.mapping?.a2l || [],
    },
    valueLibrary: Array.isArray(data.value_library) ? data.value_library : [],
  }
}

/** 只更新全局库的卡片段 */
export const saveGlobalCards = (cards: GlobalSections['cards']) => saveGlobalLibrary({ cards })

/** 只更新全局库的映射表段 */
export const saveGlobalMapping = (mapping: ObjectMapping) => saveGlobalLibrary({ mapping })

/** 只更新全局库的值资源段（后端字段名 value_library） */
export const saveGlobalValueLibrary = (valueLibrary: ValueResource[]) =>
  saveGlobalLibrary({ value_library: valueLibrary })

/** 解析 CAPL 函数库源码，提取函数定义列表 */
export const parseFunctions = (code: string) =>
  client.post('/function/parse-functions', { code })

/** 从函数调用序列文本中提取函数名列表（去重、保留顺序），返回字符串数组 */
export const parseFunctionNames = (code: string) =>
  client.post('/function/parse-function-names', { code })

/** 内置模板函数签名表（只读）
 *  用途：#8「函数库冲突即时提示」——保存函数库后拿它与自定义函数比对（名称+参数类型序列），
 *  命中即提示「生成时不会被采用」，不必等到生成后才报。
 *  返回 data: { functions: [{name, param_types, key, signature}], count } */
export const getBuiltinFunctions = () => client.get('/function/builtin-functions')

/** 展开用例（口数乘积）
 *  - ccpTypes：CCP 系统变量类型表（{符号名: int|float|int64}），决定「设置」系统变量
 *    时用 sysSetVariableInt 还是 sysSetVariableFloat（与生成 TestCase.can 同源）
 *  - envVarNames：DBC 环境变量名单（store.objDbcEnvVars 的名字），兜底判定不带 EV_
 *    前缀的环境变量（与生成同源）
 *  - idsOnly=true：只要「工况 → 各行 case_id」的对应关系，服务端跳过 TestCase.can 生成
 *    并只回 {case_id, frame_id, frame_row}（响应从约 120KB 降到几 KB）；
 *    用例编号与全量展开一致，所以 case_id 与「用例预览」完全相同。 */
export const expandCases = (
  graph: Graph,
  mapping: ObjectMapping,
  cards?: any,
  values?: ValueResource[],
  idsOnly = false,
  ccpTypes?: Record<string, string>,
  envVarNames?: string[],
) =>
  client.post('/function/expand-cases', {
    graph,
    mapping,
    cards,
    values,
    ids_only: idsOnly,
    ccp_var_types: ccpTypes,
    env_var_names: envVarNames,
  })

/** 导出用例为 Excel（单分组或全部分组，每个分组一个工作表）
 *  - 传 save_path：后端直接写盘（Electron 另存为路径）
 *  - 不传 save_path：返回 base64 内容，由前端触发下载
 */
export const exportFunctionCases = (payload: {
  graph: Graph
  mapping: ObjectMapping
  cards?: any
  values?: ValueResource[]
  group_id?: string
  save_path?: string
  ccp_var_types?: Record<string, string>
  env_var_names?: string[]
}) => client.post('/function/export-cases', payload)

/** 上传用例 Excel，解析出各工作表的用例（供导入到分组） */
export const importFunctionCases = (file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  return client.post('/function/import-cases', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export type { Card, CardStep, GroupNode, Edge, ObjectMapping, Graph, ExpandedCase, ValueResource } from '@/types/functionGraph'

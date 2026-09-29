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
) => {
  return client.post('/function/generate', {
    config_name: configName,
    cfg_dir: cfgDir,
    relay_module: relayModule,
    can_channel: canChannel,
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

/** 解析 CAPL 函数库源码，提取函数定义列表 */
export const parseFunctions = (code: string) =>
  client.post('/function/parse-functions', { code })

/** 从函数调用序列文本中提取函数名列表（去重、保留顺序），返回字符串数组 */
export const parseFunctionNames = (code: string) =>
  client.post('/function/parse-function-names', { code })

/** 展开用例（口数乘积）
 *  - ccpTypes：CCP 系统变量类型表（{符号名: int|float|int64}），决定「设置」系统变量
 *    时用 sysSetVariableInt 还是 sysSetVariableFloat（与生成 TestCase.can 同源）
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
) =>
  client.post('/function/expand-cases', {
    graph,
    mapping,
    cards,
    values,
    ids_only: idsOnly,
    ccp_var_types: ccpTypes,
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

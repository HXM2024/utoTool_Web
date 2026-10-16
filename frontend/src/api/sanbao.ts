import client from './client'

/** 三包模块接口 */

/** 从路径解析 CDD 文件提取 DTC 列表 */
export const parseCddFromPath = (cddPath: string) =>
  client.post('/sanbao/parse-cdd-from-path', { path: cddPath }, { timeout: 120000 })

/** 提取 CAPL 代码模板中的占位符参数名 */
export const extractParams = (code: string) =>
  client.post('/sanbao/extract-params', { code })

/** 解析 CAPL 函数库源码，提取函数定义列表 */
export const parseFunctions = (code: string) =>
  client.post('/sanbao/parse-functions', { code })

/** 生成时用于替换 TestFunction.cin 模板占位符的参数（与 Function 模块对齐） */
export interface SanbaoTestParams {
  /** A2L ECU 名，替换模板 XCPDemo */
  a2lQualifier?: string
  /** CDD 在 CANoe 工程中的名字，替换模板 ABS_ESP/CDD_Qualifier */
  cddQualifier?: string
  /** Ready 信号名（可拖拽），与开关值组装为 $信号=值; */
  readySignal?: string
  /** Ready 开启值 */
  readyOnValue?: string
  /** Ready 关闭值 */
  readyOffValue?: string
}

/** 根据序列生成 CAPL 测试脚本并导入 CFG 添加为测试模块。
 *  function_library 不传则由后端从全局库读取生成 TestFunction.cin；
 *  relay_module / can_channel：继电器模块（0老/1单刀/2双刀）与 CAN 通道（1/2），
 *  写入 TestFunction.cin 里共用的 RelayON/RelayOFF（见 backend/templates/relay.py）；
 *  testParams：A2L/CDD 限定符与 Ready 信号，替换模板占位符 */
export const generateSanbao = (
  configName: string,
  cfgDir: string,
  functionLibrary?: string,
  relayModule?: number,
  canChannel?: number,
  testParams?: SanbaoTestParams,
) =>
  client.post('/sanbao/generate', {
    config_name: configName,
    cfg_dir: cfgDir,
    function_library: functionLibrary ?? '',
    relay_module: relayModule,
    can_channel: canChannel,
    a2l_qualifier: testParams?.a2lQualifier ?? '',
    cdd_qualifier: testParams?.cddQualifier ?? '',
    ready_signal: testParams?.readySignal ?? '',
    ready_on_value: testParams?.readyOnValue ?? '',
    ready_off_value: testParams?.readyOffValue ?? '',
  })

/** 获取全局库（函数库 + 步骤库，独立于配置） */
export const getGlobalLibrary = () =>
  client.get('/sanbao/global-library')

/** 保存全局库（函数库 + 步骤库 + 用例库，独立于配置） */
export const saveGlobalLibrary = (
  functionLibrary: string,
  stepLibrary: any[],
  caseLibrary: any[] = [],
) =>
  client.post('/sanbao/global-library', {
    function_library: functionLibrary,
    step_library: stepLibrary,
    case_library: caseLibrary,
  })

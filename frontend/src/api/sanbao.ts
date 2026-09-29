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

/** 根据序列生成 CAPL 测试脚本并导入 CFG 添加为测试模块。
 *  function_library 不传则由后端从全局库读取生成 TestFunction.cin */
export const generateSanbao = (configName: string, cfgDir: string, functionLibrary?: string) =>
  client.post('/sanbao/generate', {
    config_name: configName,
    cfg_dir: cfgDir,
    function_library: functionLibrary ?? '',
  })

/** 获取全局库（函数库 + 步骤库，独立于配置） */
export const getGlobalLibrary = () =>
  client.get('/sanbao/global-library')

/** 保存全局库（函数库 + 步骤库，独立于配置） */
export const saveGlobalLibrary = (functionLibrary: string, stepLibrary: any[]) =>
  client.post('/sanbao/global-library', { function_library: functionLibrary, step_library: stepLibrary })

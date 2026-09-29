import client from './client'

/** UDS 模块接口 */

/** 获取树形数据 */
export const getTree = (config: string) => client.get(`/uds/tree/${config}`)

/** 更新树形数据 */
export const updateTree = (config: string, data: any) =>
  client.put(`/uds/tree/${config}`, data)

/** 上传 Excel 文件解析 */
export const parseUDS = (file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  return client.post('/uds/parse', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

/** 生成 UDS 测试模块 */
export const generateUDS = (configName: string, cfgDir?: string) =>
  client.post('/uds/generate', { config_name: configName, cfg_dir: cfgDir })

import client from './client'

/** Boot 模块接口 */

/**
 * 上传 Excel 文件解析
 * POST /api/boot/parse (multipart/form-data, field: "file")
 */
export const parseBoot = (file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  return client.post('/boot/parse', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

/**
 * 根据配置名生成输出文件
 * POST /api/boot/generate (body: { config_name: "xxx" })
 */
export const generateBoot = (configName: string, cfgDir?: string) => {
  return client.post('/boot/generate', { config_name: configName, cfg_dir: cfgDir })
}

import client from './client'

/** 通用配置 CRUD 接口 */
export const getConfigs = (module: string) =>
  client.get(`/${module}/configs`)

export const getConfig = (module: string, name: string) =>
  client.get(`/${module}/configs/${name}`)

export const saveConfig = (module: string, name: string, data: any) =>
  client.post(`/${module}/configs/${name}`, data)

export const deleteConfig = (module: string, name: string) =>
  client.delete(`/${module}/configs/${name}`)

export const copyConfig = (module: string, name: string, newName: string) =>
  client.post(`/${module}/configs/${name}/copy`, { new_name: newName })

/** 从远程存储拉取配置（names 为空表示整文件拉取） */
export const pullConfig = (module: string, names?: string[], mergeMode: boolean = true) =>
  client.post(`/${module}/configs/pull`, { names, merge_mode: mergeMode })

/** 推送指定配置项到远程存储 */
export const pushConfig = (module: string, names: string[], mergeMode: boolean = true) =>
  client.post(`/${module}/configs/push`, { names, merge_mode: mergeMode })

/** 获取远程/本地的配置项列表（用于拉取、推送时勾选） */
export const getRemoteConfigs = (module: string) =>
  client.get(`/${module}/configs/remote`)

/** 打开指定文件夹（在文件资源管理器中显示） */
export const openFolder = (path: string) =>
  client.post('/open-folder', { path })

/** 继电器配置（Function / CAN / 三包 三个模块共用的 CAN 通道 + 继电器模块，全局持久化） */
export const getRelayConfig = () =>
  client.get('/relay/config')

/** 保存继电器配置（按模块部分更新：module + relayModule / canChannel） */
export const saveRelayConfig = (data: {
  module: 'function' | 'can' | 'sanbao'
  relayModule?: number
  canChannel?: number
}) => client.post('/relay/config', data)

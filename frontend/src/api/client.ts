import axios from 'axios'
import { ElMessage } from 'element-plus'

const client = axios.create({
  // 统一使用 /api 路径：
  // - Electron 环境：由 Electron main 进程代理
  // - 生产构建：由 Flask 直接 serve
  // - Dev Vite 模式：由 vite.config.ts 的 server.proxy 代理到 localhost:18735
  baseURL: '/api',
  timeout: 30000,
})

// 响应拦截器 — 统一错误处理
client.interceptors.response.use(
  (res) => res.data,
  (err) => {
    let msg = '请求失败'
    if (err.response) {
      const { status, data } = err.response
      msg = (data && data.message) || `服务器错误 (${status})`
    } else if (err.request) {
      msg = '网络异常，无法连接服务器'
    } else {
      msg = err.message || '未知错误'
    }
    ElMessage.error(msg)
    return Promise.reject(err)
  }
)

export default client

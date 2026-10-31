import client from './client'

/** 问题状态：新建默认「打开」 */
export type FeedbackStatus = '打开' | '处理中' | '已解决' | '已关闭'

/** 一条问题记录（创建时间精确到日） */
export interface FeedbackIssue {
  id: string
  /** 导入数据的表格序号（新建问题无此字段） */
  seq?: number
  description: string
  reporter: string
  source: string
  createdAt: string
  status: FeedbackStatus
  solution: string
  assignee: string
  closedAt: string
  updatedAt?: string
}

/** 读取问题清单（共享盘优先，共享盘不可达时回落本地缓存） */
export const getFeedbackIssues = () =>
  client.get('/feedback/list') as unknown as Promise<any>

/** 校验管理密钥（错误只返回 valid=false，由前端在弹窗内提示） */
export const verifyFeedbackKey = (key: string) =>
  client.post('/feedback/verify', { key }) as unknown as Promise<any>

/** 新建问题（描述 / 汇报人 / 需求来源必填，时间与状态由服务端生成） */
export const createFeedbackIssue = (data: {
  description: string
  reporter: string
  source: string
}) => client.post('/feedback/create', data) as unknown as Promise<any>

/** 修改问题（需管理密钥） */
export const updateFeedbackIssue = (
  id: string,
  key: string,
  patch: Partial<Pick<FeedbackIssue, 'description' | 'reporter' | 'source' | 'status' | 'solution' | 'assignee' | 'closedAt'>>
) => client.post('/feedback/update', { id, key, patch }) as unknown as Promise<any>

/** 删除问题（需管理密钥） */
export const deleteFeedbackIssue = (id: string, key: string) =>
  client.post('/feedback/delete', { id, key }) as unknown as Promise<any>

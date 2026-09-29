/**
 * CAN「报文信号表」表格视图类型定义（CANView 与 DbcSignalTable 共用）。
 */

/** 列作用域：common = 两类行通用 / msg = 报文级 / sig = 信号级 / both = 两类行都渲染 */
export type DbcTableColumnScope = 'common' | 'msg' | 'sig' | 'both'

/** 列渲染类型：text = 文本（可双击编辑）/ dtc = 只读 DTC / params = 测试参数标签 / test = 测试勾选 */
export type DbcTableColumnType = 'text' | 'dtc' | 'params' | 'test'

export interface DbcTableColumn {
  /** 唯一 key，同时作为表格列的 prop */
  key: string
  /** 表头中文名 */
  label: string
  /** 表头英文名（通信矩阵列名，便于对照 Excel） */
  en?: string
  scope: DbcTableColumnScope
  type?: DbcTableColumnType
  /** 取值路径（相对行/节点）：'senderName' | 'msg.xxx' | 'fields.xxx' */
  path?: string
  /** 是否可双击编辑（msg 列仅报文行可编辑，sig 列仅信号行可编辑） */
  editable?: boolean
  /** 默认是否可见 */
  defaultVisible?: boolean
  width?: number
  minWidth?: number
}

export interface DbcTableRow {
  /** 与 node.id 一致，作为 el-table 的 row-key */
  id: string
  kind: 'message' | 'signal'
  /** 真实树节点引用（写入即改真源，保证保存生效） */
  node: any
  /** 发送节点名（公共列取值） */
  senderName?: string
  children?: DbcTableRow[]
}

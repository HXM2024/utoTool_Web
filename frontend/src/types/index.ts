/** 共享类型定义 */

/** 树节点 */
export interface TreeNode {
  id: string | number
  label: string
  description?: string
  children?: TreeNode[]
  [key: string]: any
}

/** 图表数据（旧接口，保留兼容） */
export interface ChartData {
  categories: (string | number)[]
  series: { name: string; data: number[] }[]
}

/** 电压波形分段数据 */
export interface VoltageSegment {
  x_data: number[]
  y_data: number[]
  color: string
  lineStyle: 'solid' | 'dashed' | 'dotted' | 'dashdot'
  lineWidth: number
  name: string
  segType?: string
}

/** 阈值线 */
export interface ThresholdLine {
  value: number
  color: string
  lineStyle: 'solid' | 'dashed' | 'dotted' | 'dashdot'
  alpha: number
  width?: number
  label: string
}

/** 垂直标志线 */
export interface VerticalLine {
  value: number
  yStart: number
  yEnd: number
  color: string
  lineStyle: 'solid' | 'dashed' | 'dotted'
  alpha: number
  label: string
}

/** 文本标注 */
export interface TextAnnotation {
  x: number
  y: number
  text: string
  fontSize: number
  fontWeight: string
  color?: string
}

/** 电压波形图表完整配置 */
export interface VoltageChartData {
  title: string
  xAxis: { label: string; min: number; max: number; interval: number }
  yAxis: { label: string; min: number; max: number; interval: number }
  segments: VoltageSegment[]
  thresholdLines: ThresholdLine[]
  verticalLines: VerticalLine[]
  textAnnotations: TextAnnotation[]
  legend: string[]
  params: Record<string, any>
}

/** 表格列定义 */
export interface Column {
  key: string
  title: string
  width?: number
  sortable?: boolean
  filterable?: boolean
}

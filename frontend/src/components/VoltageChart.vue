<template>
  <div class="voltage-chart">
    <div class="chart-header">
      <span class="chart-title">{{ chartData?.title || title }}</span>
      <el-button-group class="chart-actions">
        <el-button :icon="Download" size="small" @click="exportImage">导出图片</el-button>
      </el-button-group>
    </div>
    <div class="chart-container">
      <!-- 参数信息框 -->
      <div v-if="chartData?.params && hasData" class="param-info-box">
        <div class="param-info-title">参数信息</div>
        <div
          v-for="(val, key) in chartData.params"
          :key="key"
          class="param-item"
        >
          <span class="param-key">{{ key }}:</span>
          <span class="param-val">{{ val }}</span>
        </div>
      </div>
      <v-chart
        ref="chartRef"
        :option="chartOption"
        autoresize
        class="echarts-instance"
      />
      <div v-if="!hasData" class="chart-empty">
        <el-icon class="empty-icon"><TrendCharts /></el-icon>
        <span>暂无图表数据</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart, ScatterChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  ToolboxComponent,
  MarkLineComponent,
  GraphicComponent,
} from 'echarts/components'
import { Download, TrendCharts } from '@element-plus/icons-vue'
import type { VoltageChartData } from '@/types'

use([
  CanvasRenderer,
  LineChart,
  ScatterChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  ToolboxComponent,
  MarkLineComponent,
  GraphicComponent,
])

const props = withDefaults(defineProps<{
  chartData: VoltageChartData | null
  title?: string
}>(), {
  title: '电压波形',
})

const chartRef = ref<InstanceType<typeof VChart>>()

const hasData = computed(
  () => (props.chartData?.segments?.length ?? 0) > 0
)

/** 线型映射：matplotlib → ECharts */
function mapLineStyle(style: string): string | number[] {
  switch (style) {
    case 'dashed': return [5, 5]
    case 'dotted': return [2, 2]
    case 'dashdot': return [10, 3, 2, 3]
    default: return 'solid'
  }
}

/** 将 alpha (0~1) 转为 hex 透明度前缀 */
function alphaToHex(alpha: number): string {
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
  return a.toString(16).padStart(2, '0')
}

/** 构建阈值线 markLine 数据（水平线，单点格式） */
const thresholdMarkLines = computed(() => {
  if (!props.chartData?.thresholdLines) return []
  return props.chartData.thresholdLines.map(t => ({
    yAxis: t.value,
    label: {
      formatter: t.label,
      position: 'insideEndTop',
      fontSize: 10,
    },
    lineStyle: {
      color: t.color + alphaToHex(t.alpha ?? 0.7),
      type: mapLineStyle(t.lineStyle) as any,
      width: t.width ?? 1.5,
    },
  }))
})

/** 构建垂直标志线 markLine 数据（两点连线格式） */
const verticalMarkLines = computed(() => {
  if (!props.chartData?.verticalLines) return []
  return props.chartData.verticalLines
    .filter(v => v.value !== undefined)
    .map(v => [
      {
        coord: [v.value, v.yStart ?? 0],
        label: v.label ? {
          formatter: v.label,
          position: 'start',
          fontSize: 9,
          color: v.color + alphaToHex(v.alpha ?? 0.7),
        } : undefined,
        lineStyle: {
          color: v.color + alphaToHex(v.alpha ?? 0.7),
          type: mapLineStyle(v.lineStyle) as any,
          width: 1.5,
        },
      },
      {
        coord: [v.value, v.yEnd ?? 0],
      },
    ])
})

/** 图例去重列表 — 仅保留与实际 series name 匹配的项，避免 ECharts 警告 */
const legendData = computed(() => {
  if (!props.chartData?.legend) return []
  const seriesNames = new Set((props.chartData.segments ?? []).map(s => s.name))
  return [...new Set(props.chartData.legend.filter(n => seriesNames.has(n)))]
})

const chartOption = computed(() => {
  const cd = props.chartData
  if (!cd) return {}

  // 构建各分段 series
  const series: any[] = (cd.segments ?? []).map((seg) => ({
    name: seg.name,
    type: 'line' as const,
    data: seg.x_data.map((x, i) => [x, seg.y_data[i]]),
    smooth: false,
    symbol: 'none',
    lineStyle: {
      color: seg.color,
      type: mapLineStyle(seg.lineStyle) as any,
      width: seg.lineWidth ?? 2,
    },
    emphasis: { focus: 'series' as const },
  }))

  // 在第一个 series 上挂 markLine（阈值线 + 垂直线）
  if (series.length > 0) {
    const markLineData: any[] = [...thresholdMarkLines.value, ...verticalMarkLines.value]
    if (markLineData.length > 0) {
      series[0].markLine = {
        silent: true,
        symbol: ['none', 'none'],
        data: markLineData,
      }
    }
  }

  // 文本标注 → 使用 scatter series + label（基于数据坐标精确定位）
  if (cd.textAnnotations && cd.textAnnotations.length > 0) {
    series.push({
      type: 'scatter' as const,
      name: '__annotations__',
      data: cd.textAnnotations.map((ann) => ({
        value: [ann.x, ann.y],
        label: {
          show: true,
          formatter: ann.text,
          fontSize: ann.fontSize ?? 12,
          fontWeight: ann.fontWeight ?? 'normal',
          color: ann.color ?? '#333',
          position: 'top',
          distance: 5,
          backgroundColor: 'rgba(255,255,255,0.7)',
          padding: [2, 4],
          borderRadius: 3,
        },
      })),
      symbol: 'circle',
      symbolSize: 1,
      itemStyle: { opacity: 0 },
      z: 100,
      silent: true,
    })
  }

  return {
    backgroundColor: 'transparent',
    title: {
      text: cd.title,
      left: 'center',
      textStyle: { fontSize: 14, fontWeight: 'bold' },
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      formatter: (params: any) => {
        if (!Array.isArray(params)) return ''
        return params
          .filter((p) => p.seriesName !== '__annotations__')
          .map((p) => {
            const [x, y] = p.value
            return `${p.seriesName}<br/>Time: ${typeof x === 'number' ? x.toFixed(2) : x}s<br/>Voltage: ${typeof y === 'number' ? y.toFixed(2) : y}V`
          }).join('<br/>')
      },
    },
    legend: {
      data: legendData.value,
      top: 28,
      textStyle: { color: '#606266', fontSize: 10 },
      type: 'scroll',
    },
    grid: {
      left: '6%',
      right: '5%',
      bottom: '18%',
      top: '20%',
      containLabel: true,
    },
    toolbox: {
      right: 10,
      top: 0,
      feature: {
        dataZoom: { yAxisIndex: 'none' },
        restore: {},
        dataView: { readOnly: true, title: '数据视图' },
        saveAsImage: {},
      },
    },
    xAxis: {
      type: 'value',
      name: cd.xAxis?.label || 'Time',
      nameLocation: 'middle',
      nameGap: 30,
      min: cd.xAxis?.min,
      max: cd.xAxis?.max,
      interval: cd.xAxis?.interval ?? 1,
      axisLine: { lineStyle: { color: '#909399' } },
      axisLabel: { color: '#606266' },
    },
    yAxis: {
      type: 'value',
      name: cd.yAxis?.label || 'Voltage (V)',
      nameLocation: 'middle',
      nameGap: 40,
      min: cd.yAxis?.min,
      max: cd.yAxis?.max,
      interval: cd.yAxis?.interval ?? 1,
      axisLine: { lineStyle: { color: '#909399' } },
      axisLabel: { color: '#606266' },
      splitLine: { lineStyle: { color: '#e4e7ed', type: 'dashed' } },
    },
    dataZoom: [
      { type: 'inside', start: 0, end: 100 },
      { start: 0, end: 100, height: 20, bottom: 8 },
    ],
    series,
  }
})

function exportImage() {
  if (!chartRef.value) return
  const url = chartRef.value.getDataURL({
    type: 'png',
    pixelRatio: 2,
    backgroundColor: '#fff',
  })
  const a = document.createElement('a')
  a.href = url
  a.download = `${props.chartData?.title || props.title || 'chart'}_${Date.now()}.png`
  a.click()
}

/** 供父组件在 tab 切换后手动触发重绘，解决在隐藏容器中初始化尺寸为 0 的问题 */
function resize() {
  chartRef.value?.resize?.()
}

defineExpose({ resize })
</script>

<style scoped lang="scss">
.voltage-chart {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-card);
  border-radius: var(--radius-base);
  box-shadow: var(--shadow-card);
  padding: 16px;
}

.chart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.chart-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.chart-container {
  flex: 1;
  position: relative;
  min-height: 480px;
}

.echarts-instance {
  width: 100%;
  height: 100%;
}

.param-info-box {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 10;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(8px);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 11px;
  line-height: 1.6;
  max-width: 200px;
  max-height: 60%;
  overflow-y: auto;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  border: 1px solid rgba(0, 0, 0, 0.06);

  .param-info-title {
    font-weight: 700;
    color: #4f46e5;
    margin-bottom: 4px;
    font-size: 12px;
  }

  .param-item {
    display: flex;
    gap: 4px;
    color: #606266;
  }

  .param-key {
    font-weight: 500;
    white-space: nowrap;
  }

  .param-val {
    color: #303133;
  }
}

.chart-empty {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--text-secondary);

  .empty-icon {
    font-size: 48px;
    opacity: 0.3;
  }
}
</style>

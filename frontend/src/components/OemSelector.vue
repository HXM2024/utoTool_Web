<template>
  <div class="oem-selector">
    <!-- 滚轮一：主机厂 -->
    <div class="wheel-group">
      <div class="wheel-label">主机厂</div>
      <div
        class="carousel-wrapper"
        @wheel.prevent="onWheel('oem', $event)"
        @mousedown="onDragStart('oem', $event)"
        @mousemove="onDragMove"
        @mouseup="onDragEnd"
        @mouseleave="onDragEnd"
      >
        <div class="carousel-container">
          <div
            v-for="(item, i) in oemList"
            :key="item.value"
            class="carousel-card"
            :class="{ current: i === oemIndex }"
            :style="cardStyle(i, oemIndex, oemList.length)"
            @click="selectOem(i)"
          >
            <div class="card-name">{{ item.label }}</div>
            <div class="card-desc">{{ item.code }} · {{ item.count }} 种算法</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 滚轮二：安全算法（全部算法均可选，属于当前主机厂的填充背景色） -->
    <div class="wheel-group">
      <div class="wheel-label">
        安全算法
        <span class="wheel-hint">可选其它主机厂</span>
      </div>
      <div
        class="carousel-wrapper"
        @wheel.prevent="onWheel('algo', $event)"
        @mousedown="onDragStart('algo', $event)"
        @mousemove="onDragMove"
        @mouseup="onDragEnd"
        @mouseleave="onDragEnd"
      >
        <div class="carousel-container">
          <div
            v-for="(item, i) in algoOptions"
            :key="item.value"
            class="carousel-card"
            :class="{ current: i === algoIndex }"
            :style="{ ...cardStyle(i, algoIndex, algoOptions.length), background: item.bg }"
            @click="selectAlgo(i)"
          >
            <div class="card-name">{{ item.algo }}</div>
            <div class="card-desc">{{ item.description }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  modelValue: string
  /** 当前主机厂（与算法 id 配合使用，外部算法变更时用于同步） */
  oem?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'update:oem', value: string): void
}>()

/**
 * 安全算法清单：每项 = 一种算法。
 * value 为算法 id（会作为 securityAlgo 保存，并决定生成的 Unlock() 调用哪个算法）；
 * oem 为该算法所属主机厂（仍写入 serviceObject，供平台判断使用）；
 * algo 为算法滚轮上显示的算法名，description 为补充说明。
 * 主机厂与安全算法是两个独立滚轮：算法滚轮展示全部算法，不受主机厂限制；
 * 属于当前主机厂的算法卡填充背景色，其余保持白色，仅作视觉提示，仍可跨主机厂选择。
 */
const oemOptions = [
  { value: 'BYD_CBC',         oem: 'BYD',      algo: 'CBC',     description: 'BYD CBC（AES-128-CBC）' },
  { value: 'BYD_SeedKey',     oem: 'BYD',      algo: 'SeedKey', description: 'BYD SeedKey（32 位）' },
  { value: 'ChangAn_SeedKey', oem: 'ChangAn',  algo: 'SeedKey', description: 'ChangAn SeedKey（32 位）' },
  { value: 'Chery_SeedKey',   oem: 'CheRy',    algo: 'SeedKey', description: 'Chery SeedKey（32 位）' },
  { value: 'Chery_CMAC',      oem: 'CheRy',    algo: 'CMAC',    description: 'Chery CMAC（AES-128-CMAC）' },
  { value: 'Geely10_SeedKey', oem: 'GEEA_1.0', algo: 'SeedKey', description: 'Geely1.0 SeedKey（32 位）' },
  { value: 'Geely_CMAC',      oem: 'GEEA_3.0', algo: 'CMAC',    description: 'Geely3.0 CMAC（AES-128-CMAC）' },
  { value: 'Geely30_CBC',     oem: 'GEEA_3.0', algo: 'CBC',     description: 'Geely3.0 CBC（AES-128-CBC）' },
  { value: 'SGMW_SeedKey',    oem: 'SGWM',     algo: 'SeedKey', description: 'SGWM SeedKey（32 位）' },
  { value: 'BaoTeng_SeedKey', oem: 'BaoTeng',  algo: 'SeedKey', description: 'BaoTeng SeedKey（32 位）' },
  { value: 'DongFeng_SeedKey', oem: 'DongFeng', algo: 'SeedKey', description: 'DongFeng SeedKey（32 位）' },
  { value: 'Seres_SeedKey',   oem: 'Seres',    algo: 'SeedKey', description: 'Seres SeedKey（32 位）' },
  { value: 'SRM_SeedKey',     oem: 'SRM',      algo: 'SeedKey', description: 'SRM SeedKey（32 位）' },
  { value: 'GAC_SeedKey',     oem: 'GAC',      algo: 'SeedKey', description: 'GAC SeedKey（32 位）' },
  { value: 'RC_CMAC',         oem: 'RC',       algo: 'CMAC',    description: 'RC CMAC（AES-128-CMAC）' },
  { value: 'DongFeng_CMAC',   oem: 'DongFeng', algo: 'CMAC',    description: 'DongFeng CMAC（AES-128-CMAC）' },
  { value: 'CCAG_CMAC',       oem: 'CCAG',     algo: 'CMAC',    description: 'CCAG CMAC（AES-128-CMAC）' },
]

/**
 * 主机厂清单：由算法清单的 oem 去重得到。
 * code 即写入配置 serviceObject 的主机厂标识；长安存在 ChangAn / CCAG 两个主体，用 code 区分。
 */
const OEM_LIST = [
  { value: 'BYD',      label: '比亚迪',   code: 'BYD' },
  { value: 'ChangAn',  label: '长安',     code: 'ChangAn' },
  { value: 'CheRy',    label: '奇瑞',     code: 'CheRy' },
  { value: 'GEEA_1.0', label: '吉利1.0',  code: 'GEEA_1.0' },
  { value: 'GEEA_3.0', label: '吉利3.0',  code: 'GEEA_3.0' },
  { value: 'SGWM',     label: '五菱',     code: 'SGWM' },
  { value: 'BaoTeng',  label: '宝腾',     code: 'BaoTeng' },
  { value: 'DongFeng', label: '东风',     code: 'DongFeng' },
  { value: 'Seres',    label: '赛力斯',   code: 'Seres' },
  { value: 'SRM',      label: '鑫源',     code: 'SRM' },
  { value: 'GAC',      label: '广汽',     code: 'GAC' },
  { value: 'RC',       label: '瑞驰',     code: 'RC' },
  { value: 'CCAG',     label: '长安(CCAG)', code: 'CCAG' },
]

/** 算法卡背景色：属于当前主机厂的算法用该厂配色，其他主机厂算法不填充 */
const OEM_TINT: Record<string, string> = {
  BYD: '#fef3c7',
  ChangAn: '#dbeafe',
  CheRy: '#dcfce7',
  'GEEA_1.0': '#ede9fe',
  'GEEA_3.0': '#f3e8ff',
  SGWM: '#ccfbf1',
  BaoTeng: '#ffedd5',
  DongFeng: '#fee2e2',
  Seres: '#fce7f3',
  SRM: '#ecfccb',
  GAC: '#e0e7ff',
  RC: '#fae8ff',
  CCAG: '#cffafe',
}

/** 主机厂滚轮数据（附带该厂算法数量，便于一眼看出哪些厂有多种算法） */
const oemList = computed(() =>
  OEM_LIST.map((o) => ({
    ...o,
    count: oemOptions.filter((a) => a.oem === o.value).length,
  }))
)

/** 算法滚轮数据：全部算法均可选；属于当前主机厂的算法填充背景色，其余保持白色 */
const algoOptions = computed(() =>
  oemOptions.map((a) => ({
    ...a,
    bg: a.oem === props.oem ? (OEM_TINT[a.oem] || '#ffffff') : '#ffffff',
  }))
)

const oemIndex = computed(() => Math.max(0, oemList.value.findIndex((o) => o.value === props.oem)))
const algoIndex = computed(() => Math.max(0, algoOptions.value.findIndex((a) => a.value === props.modelValue)))

type WheelKind = 'oem' | 'algo'

/** 选中主机厂：只更新主机厂，不改动已选算法 */
function selectOem(i: number) {
  const oem = oemList.value[i]
  if (!oem) return
  if (oem.value !== props.oem) emit('update:oem', oem.value)
}

/** 选中算法：只更新算法，不改动主机厂（允许跨主机厂选择） */
function selectAlgo(i: number) {
  const algo = algoOptions.value[i]
  if (!algo) return
  if (algo.value !== props.modelValue) emit('update:modelValue', algo.value)
}

function onWheel(kind: WheelKind, e: WheelEvent) {
  step(kind, e.deltaY > 0 ? 1 : -1)
}

/** 滚轮/拖拽步进（两个滚轮各自在自己的列表里循环） */
function step(kind: WheelKind, direction: number) {
  const total = kind === 'oem' ? oemList.value.length : algoOptions.value.length
  if (!total) return
  const current = kind === 'oem' ? oemIndex.value : algoIndex.value
  let next = current + direction
  if (next < 0) next = total - 1
  if (next >= total) next = 0
  if (kind === 'oem') selectOem(next)
  else selectAlgo(next)
}

// 拖拽支持（两个滚轮各记各的起点）
let dragKind: WheelKind | null = null
let dragStartY = 0
let isDragging = false

function onDragStart(kind: WheelKind, e: MouseEvent) {
  dragKind = kind
  isDragging = true
  dragStartY = e.clientY
}

function onDragMove(e: MouseEvent) {
  if (!isDragging || !dragKind) return
  const delta = e.clientY - dragStartY
  if (Math.abs(delta) > 30) {
    step(dragKind, delta > 0 ? 1 : -1)
    isDragging = false
    dragKind = null
  }
}

function onDragEnd() {
  isDragging = false
  dragKind = null
}

/** 计算卡片样式（翻书式轮播，两个滚轮共用） */
function cardStyle(i: number, current: number, total: number) {
  let diff = i - current
  // 环绕处理
  if (Math.abs(diff) > total / 2) {
    diff = diff > 0 ? diff - total : diff + total
  }

  let yOffset = 0
  let scale = 1
  let opacity = 1
  let blur = 0
  let zIndex = 10

  if (diff === 0) {
    yOffset = 0; scale = 1.08; opacity = 1; blur = 0; zIndex = 50
  } else if (Math.abs(diff) === 1) {
    yOffset = diff * 28; scale = 0.9; opacity = 0.85; blur = 0.5; zIndex = 30
  } else if (Math.abs(diff) === 2) {
    yOffset = diff * 50; scale = 0.8; opacity = 0.6; blur = 1.5; zIndex = 15
  } else if (Math.abs(diff) === 3) {
    yOffset = diff * 68; scale = 0.7; opacity = 0.3; blur = 2.5; zIndex = 5
  } else {
    opacity = 0; zIndex = 0
  }

  return {
    transform: `translateX(-50%) translateY(${yOffset}px) scale(${scale})`,
    opacity,
    filter: `blur(${blur}px)`,
    zIndex,
    pointerEvents: zIndex > 0 ? 'auto' as const : 'none' as const,
  }
}
</script>

<style scoped lang="scss">
.oem-selector {
  margin-bottom: 16px;
}

.wheel-group + .wheel-group {
  margin-top: 8px;
  padding-top: 10px;
  border-top: 1px dashed #e2e8f0;
}

.wheel-label {
  font-size: 11px;
  font-weight: 600;
  color: #94a3b8;
  letter-spacing: 0.5px;
  padding-left: 6px;
  margin-bottom: 4px;
}

.wheel-hint {
  font-weight: 400;
  color: #b6c2d2;
  margin-left: 6px;
}

.carousel-wrapper {
  height: 150px;
  padding: 0.4rem 0.4rem 0.2rem;
  position: relative;
  user-select: none;
  cursor: grab;
  overflow: hidden;
  -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 20%, #000 80%, transparent 100%);
  mask-image: linear-gradient(to bottom, transparent 0, #000 20%, #000 80%, transparent 100%);

  &:active {
    cursor: grabbing;
  }
}

.carousel-container {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}

.carousel-card {
  position: absolute;
  width: 92%;
  max-width: 260px;
  background: #ffffff;
  border-radius: 14px;
  padding: 0.85rem 0.9rem;
  cursor: pointer;
  transition: all 0.4s cubic-bezier(0.2, 0.9, 0.4, 1.1);
  border: 1px solid #e2e8f0;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.08);
  text-align: center;
  left: 50%;
  transform: translateX(-50%);
  will-change: transform, opacity;
  user-select: none;

  .card-name {
    font-weight: 700;
    font-size: 1.2rem;
    color: #510280;
    transition: color 0.3s;
  }

  .card-desc {
    font-size: 0.72rem;
    color: #64748b;
    margin-top: 0.2rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &.current {
    border-left: 3px solid #4f46e5;
    box-shadow: 0 10px 25px rgba(79, 70, 229, 0.25);

    .card-name {
      color: #4f46e5;
    }
  }
}
</style>

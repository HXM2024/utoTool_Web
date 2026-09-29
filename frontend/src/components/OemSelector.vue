<template>
  <div class="oem-selector">
    <div
      class="carousel-wrapper"
      @wheel.prevent="onWheel"
      @mousedown="onDragStart"
      @mousemove="onDragMove"
      @mouseup="onDragEnd"
      @mouseleave="onDragEnd"
    >
      <div class="carousel-container">
        <div
          v-for="(item, i) in oemOptions"
          :key="item.value"
          class="carousel-card"
          :class="{ current: i === currentIndex }"
          :style="cardStyle(i)"
          @click="selectCard(i)"
        >
          <div class="card-name">{{ item.label }}</div>
          <div class="card-desc">{{ item.description }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

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
 * 每个选项 = 一种「主机厂 + 安全算法」。
 * value 为算法 id（会作为 securityAlgo 保存，并决定生成的 Unlock() 调用哪个算法）；
 * oem 为该算法所属主机厂（仍写入 serviceObject，供平台判断使用）。
 * 第一行显示主机厂名，第二行显示对应安全算法。
 */
const oemOptions = [
  { value: 'BYD_CBC',         oem: 'BYD',      label: '比亚迪',    description: 'BYD CBC（AES-128-CBC）' },
  { value: 'BYD_SeedKey',     oem: 'BYD',      label: '比亚迪',    description: 'BYD SeedKey（32 位）' },
  { value: 'ChangAn_SeedKey', oem: 'ChangAn',  label: '长安',      description: 'ChangAn SeedKey（32 位）' },
  { value: 'Chery_SeedKey',   oem: 'CheRy',    label: '奇瑞',      description: 'Chery SeedKey（32 位）' },
  { value: 'Chery_CMAC',      oem: 'CheRy',    label: '奇瑞',      description: 'Chery CMAC（AES-128-CMAC）' },
  { value: 'Geely10_SeedKey', oem: 'GEEA_1.0', label: '吉利1.0',   description: 'Geely1.0 SeedKey（32 位）' },
  { value: 'Geely_CMAC',      oem: 'GEEA_3.0', label: '吉利3.0',   description: 'Geely3.0 CMAC（AES-128-CMAC）' },
  { value: 'Geely30_CBC',     oem: 'GEEA_3.0', label: '吉利3.0',   description: 'Geely3.0 CBC（AES-128-CBC）' },
  { value: 'SGMW_SeedKey',    oem: 'SGWM',     label: '五菱',      description: 'SGWM SeedKey（32 位）' },
  { value: 'BaoTeng_SeedKey', oem: 'BaoTeng',  label: '宝腾',      description: 'BaoTeng SeedKey（32 位）' },
  { value: 'DongFeng_SeedKey', oem: 'DongFeng', label: '东风',     description: 'DongFeng SeedKey（32 位）' },
  { value: 'Seres_SeedKey',   oem: 'Seres',    label: '赛力斯',    description: 'Seres SeedKey（32 位）' },
  { value: 'SRM_SeedKey',     oem: 'SRM',      label: '鑫源',      description: 'SRM SeedKey（32 位）' },
  { value: 'GAC_SeedKey',     oem: 'GAC',      label: '广汽',      description: 'GAC SeedKey（32 位）' },
  { value: 'RC_CMAC',         oem: 'RC',       label: '瑞驰',      description: 'RC CMAC（AES-128-CMAC）' },
  { value: 'DongFeng_CMAC',   oem: 'DongFeng', label: '东风',      description: 'DongFeng CMAC（AES-128-CMAC）' },
  { value: 'CCAG_CMAC',       oem: 'CCAG',     label: '长安',      description: 'CCAG CMAC（AES-128-CMAC）' },
]

const currentIndex = ref(0)

// 同步 modelValue → currentIndex
watch(
  () => props.modelValue,
  (val) => {
    const idx = oemOptions.findIndex((o) => o.value === val)
    if (idx >= 0 && idx !== currentIndex.value) {
      currentIndex.value = idx
    }
    // 算法被外部改动时，同步其所属主机厂（幂等，不会回环）
    if (idx >= 0 && props.oem !== oemOptions[idx].oem) {
      emit('update:oem', oemOptions[idx].oem)
    }
  },
  { immediate: true }
)

function selectCard(i: number) {
  if (i !== currentIndex.value) {
    currentIndex.value = i
    emit('update:modelValue', oemOptions[i].value)
    emit('update:oem', oemOptions[i].oem)
  }
}

function onWheel(e: WheelEvent) {
  const direction = e.deltaY > 0 ? 1 : -1
  let next = currentIndex.value + direction
  if (next < 0) next = oemOptions.length - 1
  if (next >= oemOptions.length) next = 0
  selectCard(next)
}

// 拖拽支持
let dragStartY = 0
let isDragging = false

function onDragStart(e: MouseEvent) {
  isDragging = true
  dragStartY = e.clientY
}

function onDragMove(e: MouseEvent) {
  if (!isDragging) return
  const delta = e.clientY - dragStartY
  if (Math.abs(delta) > 30) {
    const direction = delta > 0 ? 1 : -1
    let next = currentIndex.value + direction
    if (next < 0) next = oemOptions.length - 1
    if (next >= oemOptions.length) next = 0
    selectCard(next)
    isDragging = false
  }
}

function onDragEnd() {
  isDragging = false
}

/** 计算卡片样式（翻书式轮播） */
function cardStyle(i: number) {
  const total = oemOptions.length
  let diff = i - currentIndex.value
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
    yOffset = 0; scale = 1.15; opacity = 1; blur = 0; zIndex = 50
  } else if (diff === -1) {
    yOffset = -40; scale = 0.92; opacity = 0.9; blur = 0.5; zIndex = 30
  } else if (diff === 1) {
    yOffset = 40; scale = 0.92; opacity = 0.9; blur = 0.5; zIndex = 30
  } else if (diff === -2) {
    yOffset = -70; scale = 0.82; opacity = 0.7; blur = 1.5; zIndex = 15
  } else if (diff === 2) {
    yOffset = 70; scale = 0.82; opacity = 0.7; blur = 1.5; zIndex = 15
  } else if (diff === -3) {
    yOffset = -95; scale = 0.72; opacity = 0.4; blur = 3; zIndex = 5
  } else if (diff === 3) {
    yOffset = 95; scale = 0.72; opacity = 0.4; blur = 3; zIndex = 5
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

.carousel-wrapper {
  height: 210px;
  padding: 0.8rem 0.8rem 0.4rem;
  position: relative;
  user-select: none;
  cursor: grab;

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
  width: 88%;
  max-width: 260px;
  background: #ffffff;
  border-radius: 14px;
  padding: 1.5rem 1rem;
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
    font-size: 1.5rem;
    color: #510280;
    transition: color 0.3s;
  }

  .card-desc {
    font-size: 0.8rem;
    color: #64748b;
    margin-top: 0.3rem;
  }

  &.current {
    background: white;
    border-left: 3px solid #4f46e5;
    box-shadow: 0 10px 25px rgba(79, 70, 229, 0.25);

    .card-name {
      color: #4f46e5;
    }
  }
}
</style>

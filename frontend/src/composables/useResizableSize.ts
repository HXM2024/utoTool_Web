import { ref, watch, type Ref } from 'vue'

const STORAGE_PREFIX = 'autotool:resize:'

/**
 * 通用容器尺寸持久化 composable
 * @param key 唯一键（用于 localStorage）
 * @param defaultValue 默认尺寸（像素）
 * @param min 最小值
 * @param max 最大值
 * @returns [sizeRef, setSize]
 */
export function useResizableSize(
  key: string,
  defaultValue: number,
  min: number,
  max: number
): [Ref<number>, (v: number) => void] {
  const fullKey = STORAGE_PREFIX + key
  let initial = defaultValue
  try {
    const stored = localStorage.getItem(fullKey)
    if (stored !== null) {
      const parsed = Number(stored)
      if (!isNaN(parsed) && parsed >= min && parsed <= max) {
        initial = parsed
      }
    }
  } catch {
    // localStorage 不可用时使用默认值
  }
  const size = ref<number>(initial)

  function setSize(v: number) {
    const clamped = Math.max(min, Math.min(max, v))
    size.value = clamped
    try {
      localStorage.setItem(fullKey, String(clamped))
    } catch {
      // 忽略
    }
  }

  watch(size, (v) => {
    try {
      localStorage.setItem(fullKey, String(v))
    } catch {
      // 忽略
    }
  })

  return [size, setSize]
}

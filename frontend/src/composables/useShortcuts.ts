/**
 * 统一快捷键层
 *
 * 目标：把散落在各组件里的 window/document keydown 处理收敛成一处，按「作用域 + 优先级」派发，
 * 解决同一个按键被多个组件同时响应的问题（例如 Ctrl+C 被表格、对象面板、画布同时处理）。
 *
 * 规则：
 *  1. 只有一个派发器（window 捕获阶段，最先执行），按作用域由内到外匹配：
 *     context（画布/表格/步骤编辑等具体控件） > module（当前模块） > global（全局）
 *  2. 同一作用域内，后注册者优先（后挂载的通常更具体）
 *  3. run() 返回 true = 已接管（preventDefault + stopPropagation，外层的旧处理不会再跑）
 *     返回 'soft' = 已处理但不拦截（例如 Esc 清选中，要保留弹窗/输入框的 Esc 行为）
 *     返回 false / undefined = 未接管，继续向外层匹配
 *  4. 焦点在输入框/文本域/下拉里时默认不触发（allowInInput: true 的例外，如 Ctrl+S 保存）
 *  5. 未匹配到任何注册项的按键一律放行，浏览器原生行为不受影响
 */
import { onUnmounted } from 'vue'
import router from '@/router'

export type ShortcutScope = 'global' | 'module' | 'context'
export type ShortcutResult = boolean | 'soft' | void

export interface ShortcutDef {
  /** 唯一 id（模块:动作），便于排查冲突与生成帮助 */
  id: string
  /** 组合键，如 'Ctrl+S'、'Ctrl+Enter'、'Insert'、'Alt+ArrowUp'、'Shift+Delete'、'F2' */
  keys: string
  /** 作用域，默认 module */
  scope?: ShortcutScope
  /** 说明文字 */
  desc: string
  /** 条件不满足时跳过本次（不接管，继续向外层匹配） */
  when?: () => boolean
  /** 焦点在输入框/文本域/下拉里是否也触发，默认 false */
  allowInInput?: boolean
  /** 执行体：见文件头部的返回值约定 */
  run: (e: KeyboardEvent) => ShortcutResult
}

interface RegisteredShortcut extends ShortcutDef {
  scope: ShortcutScope
  seq: number
}

const SCOPE_WEIGHT: Record<ShortcutScope, number> = { context: 2, module: 1, global: 0 }

/**
 * 注册表 / 安装标记挂在 globalThis 上，全应用共用一份。
 * 原因：dev 下 HMR 可能把本模块实例化成多份（模块环上的 `?t=` 失效传播会让同一文件被求值两次），
 * 各持一份注册表时会出现「组件注册进了新表、而派发器还在监听旧表」—— 表现为画布的
 * Delete / Ctrl+Z 等快捷键时好时坏（改一次代码就失效，刷新页面又恢复）。挂到 globalThis 上就不会分裂。
 */
interface ShortcutSharedState {
  registry: RegisteredShortcut[]
  seq: number
  installed: boolean
  enterConfirmInstalled: boolean
  log: string[]
}
const SHORTCUT_STATE_KEY = '__TRAE_SHORTCUT_STATE__'
function shortcutState(): ShortcutSharedState {
  const g = globalThis as unknown as Record<string, ShortcutSharedState | undefined>
  if (!g[SHORTCUT_STATE_KEY]) {
    g[SHORTCUT_STATE_KEY] = {
      registry: [],
      seq: 0,
      installed: false,
      enterConfirmInstalled: false,
      log: [],
    }
  }
  return g[SHORTCUT_STATE_KEY] as ShortcutSharedState
}
/** 本次求值拿到的共享状态；若本模块被 HMR 求值多次，各次拿到的都是同一个对象 */
const sharedShortcuts = shortcutState()
const registry: RegisteredShortcut[] = sharedShortcuts.registry

/** 最近触发的快捷键（调试/自查用，最多 50 条） */
export const shortcutLog: string[] = sharedShortcuts.log
function pushLog(id: string) {
  shortcutLog.push(`${new Date().toISOString().slice(11, 19)} ${id}`)
  if (shortcutLog.length > 50) shortcutLog.shift()
}

/** 把事件归一化成 'Ctrl+Shift+Z' / 'Alt+ArrowUp' / 'Insert' 这样的字符串 */
export function shortcutKeyOf(e: KeyboardEvent): string {
  const k = e.key
  if (k === 'Control' || k === 'Meta' || k === 'Alt' || k === 'Shift') return ''
  const parts: string[] = []
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  if (k === ' ') parts.push('Space')
  else if (k.length === 1) parts.push(k.toUpperCase())
  else parts.push(k) // Enter / Escape / ArrowUp / Insert / Delete / F2 …
  return parts.join('+')
}

function isEditableEl(el: Element | null): boolean {
  const t = el as HTMLElement | null
  if (!t) return false
  const tag = t.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!t.isContentEditable
}

/** 当前是否处于指定模块（路由）下；用于 module 作用域的守卫 */
export function isModuleActive(path: string): boolean {
  const p = router.currentRoute.value.path
  return p === path || p.startsWith(path + '/')
}

/**
 * 指针当前是否位于指定元素内（含其子孙）。
 * 供「只有指针在画布上时才生效」的快捷键使用：`Insert` / `Delete` 在右侧面板按到时，
 * 不应误建 / 误删画布内容。元素未挂载（null）时返回 false。
 */
export function isPointerIn(el: HTMLElement | null | undefined): boolean {
  if (!el) return false
  try {
    return el.matches(':hover')
  } catch {
    return false
  }
}

/** 注册一个快捷键，返回注销函数 */
export function registerShortcut(def: ShortcutDef): () => void {
  const item: RegisteredShortcut = { scope: 'module', ...def, seq: sharedShortcuts.seq++ }
  registry.push(item)
  return () => {
    const i = registry.indexOf(item)
    if (i >= 0) registry.splice(i, 1)
  }
}

/** 组件内注册（组件卸载自动注销） */
export function useShortcut(def: ShortcutDef): () => void {
  const off = registerShortcut(def)
  onUnmounted(off)
  return off
}

/** 列出当前所有快捷键（按作用域），用于自查/帮助面板 */
export function listShortcuts(): Array<{ id: string; keys: string; scope: ShortcutScope; desc: string }> {
  return [...registry]
    .sort((a, b) => SCOPE_WEIGHT[b.scope] - SCOPE_WEIGHT[a.scope] || a.seq - b.seq)
    .map((d) => ({ id: d.id, keys: d.keys, scope: d.scope, desc: d.desc }))
}

export function installShortcutDispatcher() {
  if (sharedShortcuts.installed) return
  sharedShortcuts.installed = true
  // 暴露自查入口：控制台里 __SHORTCUTS__.list() 看所有注册项，__SHORTCUTS__.log 看最近触发记录
  ;(window as any).__SHORTCUTS__ = {
    list: () => listShortcuts(),
    log: shortcutLog,
    keyOf: (e: KeyboardEvent) => shortcutKeyOf(e),
    /**
     * 按 id 直接执行某个已注册快捷键的处理体（自查/回归用）。
     * 用途：某些组合键会被浏览器自身吃掉（例如 Ctrl+Z 的原生撤销），页面上按不出来时，
     * 可以用它确认「注册项与处理体本身是否正常」，把「键位没生效」与「处理逻辑有 bug」区分开。
     */
    run: (id: string) => {
      const d = registry.find((x) => x.id === id)
      if (!d) return 'not-registered'
      if (d.when && !d.when()) return 'when-false'
      const r = d.run(new KeyboardEvent('keydown'))
      pushLog(d.id)
      return r === undefined ? 'handled' : r
    },
  }
  window.addEventListener(
    'keydown',
    (e: KeyboardEvent) => {
      if (e.defaultPrevented) return
      const key = shortcutKeyOf(e)
      if (!key) return
      const editable = isEditableEl(document.activeElement)
      const candidates = registry
        .filter((d) => d.keys === key)
        .sort((a, b) => SCOPE_WEIGHT[b.scope] - SCOPE_WEIGHT[a.scope] || b.seq - a.seq)
      for (const d of candidates) {
        if (editable && !d.allowInInput) continue
        if (d.when && !d.when()) continue
        const r = d.run(e)
        if (r === false || r === undefined || r === null) continue
        if (r !== 'soft') {
          e.preventDefault()
          e.stopPropagation()
        }
        pushLog(d.id)
        return
      }
    },
    true, // 捕获阶段：必须早于各组件自己注册的监听，才能统一裁决
  )
}

/**
 * 弹窗回车确认：Element Plus 的 MessageBox 不响应回车，而「删除 / 覆盖 / 清空」这类
 * 确认弹窗在键盘流里回车就是默认动作，这里统一补上（含 prompt 的输入框）。
 * 不走快捷键注册表的原因：派发器会跳过输入框内的按键，而 prompt 的焦点恰好就在输入框里。
 */
export function installDialogEnterConfirm() {
  if (sharedShortcuts.enterConfirmInstalled) return
  sharedShortcuts.enterConfirmInstalled = true
  window.addEventListener(
    'keydown',
    (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.isComposing) return
      const box = document.querySelector('.el-message-box')
      if (!box) return
      const active = document.activeElement as HTMLElement | null
      // 多行输入回车应换行；焦点已落在弹窗按钮上时交给浏览器原生点击，不抢
      if (active && active.tagName === 'TEXTAREA') return
      if (active && active.tagName === 'BUTTON' && box.contains(active)) return
      const btn = box.querySelector('.el-message-box__btns .el-button--primary') as HTMLElement | null
      // 关闭动画期间弹窗仍留在 DOM 里，用可见性兜底
      if (!btn || btn.offsetParent === null) return
      e.preventDefault()
      e.stopPropagation()
      btn.click()
    },
    true,
  )
}

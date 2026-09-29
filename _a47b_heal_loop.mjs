// 序列接线口自愈的闭环验证 · 前端侧
//
// 直接跑前端真实实现 normalizeStaleSeqAnchors（由 _a47b_heal_check.py 用 esbuild 打包后执行），
// 断言自愈对现有数据「只做该做的」，并把 before/after 写出供后端侧比对。
//
// 用法：node _a47b_heal_bundle.mjs <out.json>
import fs from 'node:fs'
import {
  normalizeStaleSeqAnchors,
  resolveSeqPortIdx,
  parseSeqPortKey,
  frameSequenceId,
} from './frontend/src/utils/functionGraph.ts'

const OUT = process.argv[2]
const PATH = 'e:/Python/AutoTool_Web/configs/function/Function_configs.json'
const cfg = JSON.parse(fs.readFileSync(PATH, 'utf8'))
// 前端 normalizeGraph 实际使用 groups[*].frames（graph.frames 只是镜像，会被覆盖）
const frames = cfg.A47B.graph.groups[0].frames

const fails = []
const ok = (cond, msg) => {
  console.log((cond ? '  PASS  ' : '  FAIL  ') + msg)
  if (!cond) fails.push(msg)
}

/** 悬空（锚定步骤已不存在）的序列端口 */
function stalePorts(frame) {
  const seqId = frameSequenceId(frame)
  if (!seqId) return []
  const steps = frame.nodes?.[seqId]?.steps ?? []
  const out = []
  for (const [eid, e] of Object.entries(frame.edges ?? {})) {
    for (const end of ['from', 'to']) {
      const p = parseSeqPortKey(e[end])
      if (p && p.seqId === seqId && resolveSeqPortIdx(p, steps) === null) out.push([eid, end, e[end]])
    }
  }
  return out
}

/** 「另一端卡片 + 端侧」分组：组里有活边 → 悬空边是过时残留；没活边 → 真断线 */
function classify(frame) {
  const seqId = frameSequenceId(frame)
  const steps = frame.nodes?.[seqId]?.steps ?? []
  const g = new Map()
  for (const e of Object.values(frame.edges ?? {})) {
    for (const side of ['from', 'to']) {
      const p = parseSeqPortKey(e[side])
      if (!p || p.seqId !== seqId) continue
      const k = (side === 'from' ? e.to : e.from) + '|' + side
      if (!g.has(k)) g.set(k, { live: false, stale: 0 })
      const it = g.get(k)
      if (resolveSeqPortIdx(p, steps) !== null) it.live = true
      else it.stale++
    }
  }
  let residue = 0
  let broken = 0
  for (const it of g.values()) residue += it.live ? it.stale : 0
  for (const it of g.values()) broken += it.live ? 0 : it.stale
  return { residue, broken }
}

/** 所有「活着」的端口键（不应被改动） */
function liveSnapshot(frame) {
  const seqId = frameSequenceId(frame)
  const steps = frame.nodes?.[seqId]?.steps ?? []
  const snap = new Map()
  for (const [eid, e] of Object.entries(frame.edges ?? {})) {
    for (const end of ['from', 'to']) {
      const p = parseSeqPortKey(e[end])
      if (!p || p.seqId !== seqId) continue
      if (resolveSeqPortIdx(p, steps) === null) continue
      snap.set(eid + '|' + end, e[end])
    }
  }
  return snap
}

const before = JSON.parse(JSON.stringify(frames))
const snaps = before.map(liveSnapshot)
const staleBefore = before.map(stalePorts)
const totalBefore = staleBefore.reduce((a, s) => a + s.length, 0)
const clsBefore = before.map(classify)
const residueExpect = clsBefore.reduce((a, c) => a + c.residue, 0)
const brokenExpect = clsBefore.reduce((a, c) => a + c.broken, 0)

console.log('工况 %d 个，载入前悬空序列端口 %d 个（过时残留 %d，真断线 %d）',
  before.length, totalBefore, residueExpect, brokenExpect)

// ==== 跑真实的自愈实现 ====
const res = frames.map((f) => normalizeStaleSeqAnchors(f))
const totalFixed = res.reduce((a, r) => a + r.repaired, 0)
const totalRemoved = res.reduce((a, r) => a + r.removed, 0)

console.log('\n[1] 自愈结果与分类一致')
ok(totalRemoved === residueExpect, `清理过时残留 ${totalRemoved} 条 == 分组判定 ${residueExpect} 条`)
ok(totalFixed === brokenExpect, `接回真断线 ${totalFixed} 条 == 分组判定 ${brokenExpect} 条`)
ok(totalFixed + totalRemoved === totalBefore, `接回 + 清理 == 悬空总数 ${totalBefore}`)

console.log('\n[2] 悬空清零')
const staleAfter = frames.reduce((a, f) => a + stalePorts(f).length, 0)
ok(staleAfter === 0, `自愈后悬空端口 ${staleAfter} 个`)

console.log('\n[3] 活锚点一个都没动')
let touchedLive = 0
let liveTotal = 0
for (let i = 0; i < frames.length; i++) {
  for (const [k, v] of snaps[i]) {
    liveTotal++
    const [eid, end] = k.split('|')
    if (frames[i].edges[eid]?.[end] !== v) touchedLive++
  }
}
ok(touchedLive === 0, `现有活锚点 ${liveTotal} 个，被改动 ${touchedLive} 个`)

console.log('\n[4] 幂等')
const again = frames.map((f) => normalizeStaleSeqAnchors(f))
ok(again.every((r) => r.repaired === 0 && r.removed === 0), '重复载入不再触发修复/清理')

console.log('\n[5] 键形态未引入新语法（必须仍是 seq:<seqId>@<stepId>）')
const badShape = []
for (const f of frames) {
  for (const e of Object.values(f.edges ?? {})) {
    for (const end of ['from', 'to']) {
      const k = e[end]
      if (typeof k === 'string' && k.startsWith('seq:') && !/^seq:[^@#]+@[^@#]+$/.test(k)) badShape.push(k)
    }
  }
}
ok(badShape.length === 0, `形态异常键 ${badShape.length} 个` + (badShape[0] ? ' 例：' + badShape[0] : ''))

console.log('\n[6] 各工况处理明细')
for (let i = 0; i < frames.length; i++) {
  if (!staleBefore[i].length) continue
  const name = (frames[i].name || frames[i].id).slice(0, 30)
  console.log('  · ' + name.padEnd(32) + ' 接回 ' + String(res[i].repaired).padStart(2)
    + '，清理 ' + String(res[i].removed).padStart(3))
}

fs.writeFileSync(OUT, JSON.stringify({ before, after: frames }), 'utf8')
console.log('\n前端侧结果：' + (fails.length ? `失败 ${fails.length} 项` : '全部通过'))
if (fails.length) process.exit(1)
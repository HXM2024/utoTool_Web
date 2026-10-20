import { reactive, watch } from 'vue'
import {
  Workspace, CaseTrack, Card, StageType,
  genId, newCard, newStep, DEMO_MAPPING, STAGE_ORDER,
} from './types'

const KEY = 'fce-workspace-v1'

function demoWorkspace(): Workspace {
  const inj = newCard('inject', '注入_总线欠压')
  inj.steps = [
    { id: genId('step'), kind: 'set', fun: '', args: [
      { key: 'signal', kind: 'mapping', value: '车速信号' },
      { key: 'value', kind: 'literal', value: '0' },
    ], indent: 0 },
    { id: genId('step'), kind: 'wait', fun: 'TestWaitForTime', args: [
      { key: 'ms', kind: 'literal', value: '200' },
    ], indent: 0 },
  ]
  const seq = newCard('sequence', '序列_读取DTC')
  seq.steps = [
    { id: genId('step'), kind: 'call', fun: 'Diag_SetParameter', args: [
      { key: 'p1', kind: 'literal', value: '19 02' },
    ], indent: 0 },
    { id: genId('step'), kind: 'raw', raw: 'testWaitForDiagResponse(500);', args: [], indent: 0 },
  ]
  const res = newCard('result', '结果_检查DTC')
  res.steps = [
    { id: genId('step'), kind: 'check', fun: '', args: [
      { key: 'signal', kind: 'mapping', value: 'DTC_欠压' },
      { key: 'expect', kind: 'literal', value: '1' },
    ], indent: 0 },
  ]
  const track: CaseTrack = {
    id: genId('case'),
    name: 'TC_欠压DTC读取',
    stages: STAGE_ORDER.map((t) => ({ type: t, cards: [] })),
  }
  track.stages[0].cards.push(inj)
  track.stages[1].cards.push(seq)
  track.stages[2].cards.push(res)
  return {
    tracks: [track],
    library: [],
    mapping: DEMO_MAPPING.slice(),
  }
}

function load(): Workspace {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const ws = JSON.parse(raw) as Workspace
      if (Array.isArray(ws.tracks) && Array.isArray(ws.library)) return ws
    }
  } catch { /* ignore */ }
  return demoWorkspace()
}

export const ws = reactive<Workspace>(load())

watch(ws, () => {
  try { localStorage.setItem(KEY, JSON.stringify(ws)) } catch { /* ignore */ }
}, { deep: true })

export function addTrack(): CaseTrack {
  const t: CaseTrack = {
    id: genId('case'),
    name: `TC_${ws.tracks.length + 1}`,
    stages: STAGE_ORDER.map((type) => ({ type, cards: [] })),
  }
  ws.tracks.push(t)
  return t
}

export function removeTrack(id: string) {
  const i = ws.tracks.findIndex((t) => t.id === id)
  if (i >= 0) ws.tracks.splice(i, 1)
}

export function insertCard(track: CaseTrack, stageType: StageType, afterIndex: number): Card {
  const stage = track.stages.find((s) => s.type === stageType)
  if (!stage) throw new Error('stage not found')
  const card = newCard(stageType)
  stage.cards.splice(afterIndex + 1, 0, card)
  return card
}

export function removeCard(track: CaseTrack, stageType: StageType, cardId: string) {
  const stage = track.stages.find((s) => s.type === stageType)
  if (!stage) return
  const i = stage.cards.findIndex((c) => c.id === cardId)
  if (i >= 0) stage.cards.splice(i, 1)
}

export function moveCard(
  track: CaseTrack, stageType: StageType, fromIndex: number, toIndex: number,
) {
  const stage = track.stages.find((s) => s.type === stageType)
  if (!stage) return
  const [c] = stage.cards.splice(fromIndex, 1)
  if (!c) return
  let dst = toIndex
  if (toIndex > fromIndex) dst -= 1
  stage.cards.splice(Math.max(0, Math.min(dst, stage.cards.length)), 0, c)
}

export function saveToLibrary(card: Card): void {
  const idx = ws.library.findIndex((c) => c.id === card.refId || c.id === card.id)
  const entry: Card = JSON.parse(JSON.stringify({ ...card, refId: undefined }))
  if (idx >= 0) {
    ws.library.splice(idx, 1, entry)
    card.refId = entry.id
    syncRefs(card.id)
  } else {
    ws.library.push(entry)
    card.refId = entry.id
  }
}

export function syncRefs(libId: string) {
  for (const t of ws.tracks) {
    for (const s of t.stages) {
      for (const c of s.cards) {
        if (c.refId === libId) {
          const src = ws.library.find((l) => l.id === libId)
          if (src) {
            c.name = src.name
            c.steps = JSON.parse(JSON.stringify(src.steps))
          }
        }
      }
    }
  }
}

export function referenceFromLibrary(track: CaseTrack, stageType: StageType, libId: string) {
  const lib = ws.library.find((l) => l.id === libId)
  if (!lib) return
  const stage = track.stages.find((s) => s.type === stageType)
  if (!stage) return
  const card: Card = { ...JSON.parse(JSON.stringify(lib)), id: genId('card'), refId: lib.id }
  stage.cards.push(card)
}

export function newStepRow() {
  return newStep('call')
}

interface GraphPort { nodeId: string; portIndex: number }
interface GraphEdge { id: string; from: GraphPort; to: GraphPort }
interface GraphNode {
  id: string
  lane: StageType
  cards: Card[]
  fanout: 'single' | 'multi'
  x: number
  y: number
}

export function buildGraphJson(): { nodes: GraphNode[]; edges: GraphEdge[]; naming: string } {
  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []
  ws.tracks.forEach((track, ti) => {
    let prev: GraphNode | null = null
    track.stages.forEach((stage, si) => {
      if (!stage.cards.length) return
      const node: GraphNode = {
        id: `${track.id}-${stage.type}`,
        lane: stage.type,
        fanout: 'multi',
        x: 40 + si * 380,
        y: 40 + ti * 140,
        cards: stage.cards.map((c) => ({
          id: c.id,
          type: c.type,
          name: c.name || c.id,
          refId: c.refId,
          steps: JSON.parse(JSON.stringify(c.steps)),
        })),
      }
      nodes.push(node)
      if (prev) {
        const count = Math.min(prev.cards.length, node.cards.length)
        for (let p = 0; p < count; p++) {
          edges.push({
            id: genId('edge'),
            from: { nodeId: prev.id, portIndex: p },
            to: { nodeId: node.id, portIndex: p },
          })
        }
      }
      prev = node
    })
  })
  return { nodes, edges, naming: 'path' }
}

export function exportGraphJson(): string {
  return JSON.stringify(buildGraphJson(), null, 2)
}

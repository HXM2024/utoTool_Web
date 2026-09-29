<script setup lang="ts">
import { ws, addTrack, exportGraphJson } from './store'
import { CAPL_FUNCS } from './types'
import CaseTrack from './components/CaseTrack.vue'
import LibraryPanel from './components/LibraryPanel.vue'

function downloadGraph() {
  const blob = new Blob([exportGraphJson()], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'function-graph.json'
  a.click()
  URL.revokeObjectURL(a.href)
}
</script>

<template>
  <div class="app">
    <header class="topbar">
      <h1>Function 用例「卡片流水线」原型</h1>
      <div class="topbar-actions">
        <button class="ghost" @click="downloadGraph">导出 Graph JSON</button>
        <button class="primary" @click="addTrack">＋ 新增用例</button>
      </div>
    </header>

    <datalist id="capl-funcs">
      <option v-for="f in CAPL_FUNCS" :key="f" :value="f"></option>
    </datalist>
    <datalist id="mapping-aliases">
      <option v-for="m in ws.mapping" :key="m.alias" :value="m.alias">
        {{ m.alias }}（{{ m.name }}）
      </option>
    </datalist>

    <main class="layout">
      <section class="tracks">
        <CaseTrack v-for="t in ws.tracks" :key="t.id" :track="t" />
      </section>
      <LibraryPanel />
    </main>
  </div>
</template>

<style scoped>
.app { min-height: 100vh; }
.topbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 20px; background: #fff; border-bottom: 1px solid #e3e7ee;
  position: sticky; top: 0; z-index: 10;
}
h1 { font-size: 16px; margin: 0; }
.topbar-actions { display: flex; gap: 8px; }
.ghost { background: #fff; color: #2563eb; border: 1px solid #2563eb; border-radius: 6px; padding: 7px 14px; font-size: 13px; cursor: pointer; }
.ghost:hover { background: #eff6ff; }
.primary { background: #2563eb; color: #fff; border: none; border-radius: 6px; padding: 7px 14px; font-size: 13px; }
.layout { display: flex; gap: 16px; padding: 16px 20px; }
.tracks { flex: 1; min-width: 0; }
</style>

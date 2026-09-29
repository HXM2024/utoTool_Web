# Function 模块 —— 跨配置「复制分组」实施计划

## 1. 概述

**需求**：把**其它配置文件里的分组**复制到当前配置，**连同该分组的卡片库、映射表、值资源库一起**。

**已确认的三个决策**（来自本轮澄清）：

| 决策点 | 结论 |
|---|---|
| 产物形态 | **整组复制为新分组**：工况框 + 卡片库 + 映射表 + 值资源库 一起搬；新组内容与原组完全一致 |
| 入口 | **预览页分组右键菜单**新增「从其它配置复制分组…」→ 弹窗选「源配置 + 源分组（可多选）」 |
| 重名 | **组名自动加后缀**，全程无弹窗阻断 |

**改动范围**：**只改前端 1 个文件** `frontend/src/views/FunctionView.vue`（模板 + 脚本），**后端零改动**（复用已有的 `GET /api/function/configs` 与 `GET /api/function/configs/{name}`）。

---

## 2. 现状分析（已核实，均带证据）

### 2.1 分组本身就是「自带三个库」的自洽单元

`frontend/src/types/functionGraph.ts:175-191`：

```ts
export interface CaseGroup {
  id: string
  name: string
  frames: CaseFrame[]                 // 该组的工况框
  naming?: 'default' | 'path'
  cases?: ImportedCase[]              // 从 Excel 导入的用例
  cards?: CardLibrary                 // 分组级卡片库
  mapping?: ObjectMapping             // 分组级映射表
  valueLibrary?: ValueResource[]      // 分组级值资源库
}
```

编辑器只读写「活动分组」的这三项（`FunctionGraphEditor.vue:189-206` 三个 computed 直接落在 `activeGroup` 上），后端展开用例时也按分组取（`backend/services/function_graph.py:1537-1559`，分组级缺失才回落配置级）。

**这就是本方案成立的关键**：把整组搬过来，组内的 `refId`（卡片引用）指向的库卡片**也一起搬过来了**，所以引用天然自洽，不需要任何 id 重映射。

### 2.2 现有分组操作（本方案要贴着它们的写法做）

`frontend/src/views/FunctionView.vue`：

- 分组列表模板：`:98-159`（`el-dropdown trigger="contextmenu" @command="onGroupMenu(cmd, grp)"`）
- 右键菜单项：`:150-157`（现有 `import` / `export` / `exportAll` 三项）
- `onGroupMenu(cmd, group)`：`:996-1000`
- `addCaseGroup()`：`:910-916`（`emptyCaseGroup()` 后 push，**不自动保存**）
- `removeCaseGroup()`：`:935-945`（删除后 `graph.frames = groups[0].frames` + `refreshCasePreview()`）
- `onGroupMetaChange()`：`:947-953`（改名后 `refreshCasePreview()`）
- `groupCaseCount(grp.id)`：模板 `:122` 用于显示「N 条」
- `refreshCasePreview()`：`:1147-1179`（调后端 `expandCases(graph, mapping, cards)` 重新填充 `testCaseList`，**后端按分组解析库，所以新分组会一起被展开**）

### 2.3 已有的可复用工具（不要重复造）

| 需要的能力 | 已有实现 |
|---|---|
| 取配置名列表 | `getConfigs('function')` → `GET /api/function/configs`（`frontend/src/api/config.ts:4-5`）；**注意 `FunctionView.vue:322` 目前只 import 了 `getConfig, saveConfig, openFolder`，需补 `getConfigs`** |
| 取某配置完整数据 | `getConfig('function', name)`（已 import，`FunctionView.vue:708` 就在用） |
| 规范化整份 graph（含 groups 迁移、分组级库兜底） | `normalizeGraph(data, fallback)`：`FunctionView.vue:592-654` |
| 规范化卡片库 / 映射表 / 值资源库 | `normalizeCards()`：`:668`、`normalizeMapping()`：`:656`、`deepCopy()`：`:577` |
| 生成 id | `genId('group')`（`@/types/functionGraph`，已 import `:320`） |
| 当前配置名 | `currentConfig`：`:334`、`loadedConfig`：`:336` |

### 2.4 为什么不需要后端改动

- 源配置的读取：`getConfig('function', name)` 已经返回**整份配置**（含 `graph.groups[]` 与配置级 `mapping/cards/value_library`），前端拿到的就是完整数据。
- 目标配置的写入：沿用现有「改 `graph.value` → 用户点『保存』」的路径（`currentData`：`:489-508`，`persistConfig()`：`:681`），**不需要新接口**。
- 配置级镜像（`currentData` 的 `mapping/cards/value_library` 取 `groups[0]`，`:505-507`）**不受影响**：我们是往数组**追加**新分组，`groups[0]` 不变。

### 2.5 为什么不需要重映射组内 id

组内 id 只在组内被引用：

- `lane.nodeIds` / `f.nodeIds` → 组内 `nodes` 的 id
- `edge.from|to` → `node:<节点id>` 或 `seq:<主序列节点id>:<槽位>`
- `Card.refId` → **本分组的** `cards` 里的卡片 id（解析时用 `grp.cards`，见 `frontend/src/utils/functionGraph.ts:383-395` 的 `migrateRefCopyNodes`）

跨分组的 id 重复是既有常态（`genId` 只保证大概率不撞）。所以**只重新生成 `group.id`**；组内 id 原样保留，避免为了重生成而重写 `lane.nodeIds`/`edge` 键的高风险改动。

### 2.6 与「全局模板」的区别（保持两套并存，不要合并）

`FunctionGraphEditor.vue:1152-1201` 的「导入/导出全局模板」范围是**单个分组的三个库 ↔ 全局文件** `configs/function/Function_global_library.json`（覆盖式，不含工况框）。本方案是**跨配置整组复制**（含工况框），两者互补，互不替代。

---

## 3. 方案与改动

全部改动集中在 `frontend/src/views/FunctionView.vue`。

### 3.1 补 import（`:322`）

```ts
import { getConfig, getConfigs, saveConfig, openFolder } from '@/api/config'
```

### 3.2 模板：右键菜单加一项（`:150-157` 的 `el-dropdown-menu` 内，末尾追加）

```html
<el-dropdown-item command="copyFromConfig" :icon="CopyDocument" divided>
  从其它配置复制分组…
</el-dropdown-item>
```

- `CopyDocument` 需从 `@element-plus/icons-vue` 补进现有图标 import（该文件已在用 `Connection / Delete / Upload / Download / Plus / ArrowRight / ArrowDown / Setting / Search / Rank` 等）。
- 放在 `exportAll` 之后并带 `divided`，与现有两项用分隔线隔开。

### 3.3 模板：新增复制弹窗（放在页面根节点内、现有 `FunctionGraphEditor` 之后）

> 说明：本文件目前没有任何 `el-dialog`（只用 `ElMessageBox.prompt`）。多选分组需要自定义内容，这里引入一个 `el-dialog`；`el-dialog` 是项目内通用写法（CANView 等大量使用），不算新范式。

```html
<el-dialog v-model="copyGroupVisible" title="从其它配置复制分组" width="560px" append-to-body>
  <div class="copy-group-form">
    <div class="copy-group-row">
      <span class="copy-group-label">源配置</span>
      <el-select
        v-model="copyGroupSource"
        size="small"
        placeholder="选择要复制的配置"
        style="flex:1"
        @change="loadSourceGroups"
      >
        <el-option v-for="n in copyGroupConfigList" :key="n" :label="n" :value="n" />
      </el-select>
    </div>
    <div class="copy-group-row copy-group-row-top">
      <span class="copy-group-label">源分组</span>
      <div class="copy-group-list" v-loading="copyGroupLoading">
        <el-checkbox-group v-model="copyGroupSelected">
          <div v-for="g in copyGroupSourceGroups" :key="g.id" class="copy-group-item">
            <el-checkbox :value="g.id">
              {{ g.name }}
              <span class="copy-group-meta">
                {{ g.frames.length }} 个工况框
                <template v-if="(g.cards ? (g.cards.inject.length + g.cards.sequence.length + g.cards.result.length) : 0)">
                  · {{ g.cards!.inject.length + g.cards!.sequence.length + g.cards!.result.length }} 张库卡片
                </template>
              </span>
            </el-checkbox>
          </div>
        </el-checkbox-group>
        <div v-if="!copyGroupLoading && !copyGroupSourceGroups.length" class="copy-group-empty">
          该配置下没有分组
        </div>
      </div>
    </div>
    <div class="copy-group-hint">
      复制后会在当前配置里新增同名分组（重名自动加「_来自&lt;源配置&gt;」后缀），并带上该分组的卡片库 / 映射表 / 值资源库。
    </div>
  </div>
  <template #footer>
    <el-button size="small" @click="copyGroupVisible = false">取消</el-button>
    <el-button size="small" text :disabled="!copyGroupSourceGroups.length" @click="toggleCopyGroupAll">
      {{ copyGroupSelected.length === copyGroupSourceGroups.length ? '全不选' : '全选' }}
    </el-button>
    <el-button
      size="small"
      type="primary"
      :disabled="!copyGroupSelected.length || copyGroupLoading"
      @click="confirmCopyGroups"
    >
      复制 {{ copyGroupSelected.length || '' }}
    </el-button>
  </template>
</el-dialog>
```

### 3.4 脚本：状态与函数（放在 `// ==================== 用例分组 ====================` 段内、`onGroupMenu` 附近）

```ts
// ==================== 跨配置复制分组 ====================
const copyGroupVisible = ref(false)
/** 源配置名列表（来自 GET /api/function/configs） */
const copyGroupConfigList = ref<string[]>([])
/** 当前选中的源配置 */
const copyGroupSource = ref('')
/** 源配置里的分组（已 normalize，含分组级三个库） */
const copyGroupSourceGroups = ref<CaseGroup[]>([])
/** 勾选要复制的分组 id */
const copyGroupSelected = ref<string[]>([])
const copyGroupLoading = ref(false)

/** 打开弹窗：拉配置列表，默认选一个「非当前配置」的源，并加载其分组 */
async function openCopyGroupDialog() {
  copyGroupVisible.value = true
  copyGroupSelected.value = []
  copyGroupSourceGroups.value = []
  try {
    const res: any = await getConfigs('function')
    const list: string[] = Array.isArray(res?.data) ? res.data : []
    copyGroupConfigList.value = list
    if (!list.length) {
      ElMessage.warning('没有可选的配置文件')
      return
    }
    copyGroupSource.value =
      list.find((n) => n !== currentConfig.value) || list[0]
    await loadSourceGroups()
  } catch (e: any) {
    ElMessage.error('读取配置列表失败：' + (e?.message || String(e)))
  }
}

/** 加载选中源配置的分组（复用 normalizeGraph，旧结构配置会被迁移成一个默认分组） */
async function loadSourceGroups() {
  const name = copyGroupSource.value
  copyGroupSelected.value = []
  copyGroupSourceGroups.value = []
  if (!name) return
  copyGroupLoading.value = true
  try {
    const res: any = await getConfig('function', name)
    const data = res?.data
    const g = normalizeGraph(data?.graph, {
      mapping: data?.mapping,
      cards: data?.cards,
      valueLibrary: data?.value_library,
    })
    copyGroupSourceGroups.value = g.groups || []
  } catch (e: any) {
    ElMessage.error(`读取配置「${name}」失败：` + (e?.message || String(e)))
  } finally {
    copyGroupLoading.value = false
  }
}

function toggleCopyGroupAll() {
  copyGroupSelected.value =
    copyGroupSelected.value.length === copyGroupSourceGroups.value.length
      ? []
      : copyGroupSourceGroups.value.map((g) => g.id)
}

/** 生成不重复的分组名：重名 → `<原名>_来自<源配置>`，再冲突 → 追加 _2、_3… */
function uniqueGroupName(base: string, fromConfig: string, used: Set<string>): string {
  const b = (base || '').trim() || 'GraphCase'
  if (!used.has(b)) {
    used.add(b)
    return b
  }
  let name = `${b}_来自${fromConfig}`
  if (!used.has(name)) {
    used.add(name)
    return name
  }
  let n = 2
  while (used.has(`${name}_${n}`)) n++
  name = `${name}_${n}`
  used.add(name)
  return name
}

/** 克隆一个分组用于导入：只重生成分组 id，组内 id 原样保留（见计划 2.5） */
function makeGroupCopy(src: CaseGroup, name: string): CaseGroup {
  const g: CaseGroup = deepCopy(src)
  g.id = genId('group')
  g.name = name
  if (!Array.isArray(g.frames)) g.frames = []
  g.cards = normalizeCards(g.cards)
  g.mapping = normalizeMapping(g.mapping)
  g.valueLibrary = Array.isArray(g.valueLibrary) ? g.valueLibrary : []
  return g
}

/** 确认复制：追加到当前配置的 groups，并刷新用例预览 */
function confirmCopyGroups() {
  const srcName = copyGroupSource.value
  const picked = copyGroupSourceGroups.value.filter((g) => copyGroupSelected.value.includes(g.id))
  if (!picked.length) {
    ElMessage.warning('请先勾选要复制的分组')
    return
  }
  if (!Array.isArray(graph.value.groups)) graph.value.groups = []
  const used = new Set(graph.value.groups.map((g) => g.name))
  const added: string[] = []
  for (const src of picked) {
    const name = uniqueGroupName(src.name, srcName, used)
    graph.value.groups.push(makeGroupCopy(src, name))
    added.push(name)
  }
  copyGroupVisible.value = false
  refreshCasePreview()
  ElMessage.success(`已从「${srcName}」复制 ${added.length} 个分组：${added.join('、')}`)
}
```

`onGroupMenu` 加分支（`:996-1000`）：

```ts
function onGroupMenu(cmd: string, group: CaseGroup) {
  if (cmd === 'import') importCasesIntoGroup(group)
  else if (cmd === 'export') exportGroupCases(group)
  else if (cmd === 'exportAll') exportGroupCases(null)
  else if (cmd === 'copyFromConfig') openCopyGroupDialog()
}
```

### 3.5 样式

在 `<style scoped>` 里新增少量 class（沿用文件内既有的 `.group-*` 命名风格）：

```scss
.copy-group-form { display: flex; flex-direction: column; gap: 10px; }
.copy-group-row { display: flex; align-items: center; gap: 8px; }
.copy-group-row-top { align-items: flex-start; }
.copy-group-label { flex: 0 0 56px; font-size: 12px; color: var(--text-secondary, #909399); }
.copy-group-list { flex: 1; max-height: 240px; overflow-y: auto; border: 1px solid var(--border-color, #ebeef5); border-radius: 6px; padding: 6px 10px; }
.copy-group-item { padding: 2px 0; }
.copy-group-meta { margin-left: 6px; font-size: 11px; color: var(--text-secondary, #909399); }
.copy-group-empty { padding: 12px 0; text-align: center; font-size: 12px; color: var(--text-secondary, #909399); }
.copy-group-hint { font-size: 11px; line-height: 1.6; color: var(--text-secondary, #909399); }
```

---

## 4. 决策与假设

1. **只重生成 `group.id`**，组内 frame/lane/node/edge/card id 原样保留（依据见 2.5）。
2. **组名后缀规则**：`原名` → 冲突则 `原名_来自<源配置>` → 再冲突则 `…_2`、`…_3`。同一批多选也用同一个 `used` 集合，避免批内自撞。
3. **允许从当前配置复制**（源配置列表包含自己），等价于「复制分组」，无需额外实现。
4. **不做库合并**：三个库随整组整体搬，因此**不存在库条目重名冲突**（这是选「整组复制」的直接好处）。
5. **不自动保存**：与现有 `addCaseGroup()` 一致，由用户点工具条「保存」落盘；避免复制大组时触发一次隐式写盘。
6. **旧结构源配置兼容**：源配置若没有 `graph.groups`，`normalizeGraph()` 会把 `frames` 迁移成一个默认分组，弹窗里照样能列出并复制。
7. **`cases`（Excel 导入用例）与 `naming` 一并带过来**（它们本来就属于 `CaseGroup`）。
8. **弹窗里不计算源分组的用例条数**：`expandCases` 是后端调用、且要按组展开，对大配置有明显开销；只显示「工况框数 + 库卡片数」（都来自内存数据，零开销）。
9. **复制后不自动切到新分组**：预览页本来就平铺所有分组，切「活动分组」只对编辑器有意义。

---

## 5. 验证步骤

### 5.1 静态检查

```powershell
cd e:\Python\AutoTool_Web\frontend
node node_modules/vue-tsc/bin/vue-tsc.js --noEmit
node node_modules/vite/bin/vite.js build
```
两者都需 exit 0。

### 5.2 运行时验证（`python run.py` → `http://127.0.0.1:18735` → Function 模块）

准备：当前配置用 `A47D_copy`（已有 `FUNC_ADS_LDW` / `FUNC_ADS_TORQUE` / `ADS_Ang` 三个分组），源配置用 `D008` 或 `A47D`。

| # | 操作 | 期望 |
|---|---|---|
| 1 | 右键任意分组 → 菜单出现「从其它配置复制分组…」 | 弹窗打开，源配置默认为一个非当前配置，分组列表已加载 |
| 2 | 切源配置 | 分组列表跟着刷新，勾选清空 |
| 3 | 勾选 1 个分组 → 复制 | 当前配置新增 1 个分组；`ElMessage` 提示新组名 |
| 4 | 打开新分组的「图形配置」 | 工况框数量、卡片（含 ⛓ 引用标记）、泳道、连线与源分组一致；卡片库面板条目数一致；用例条数与源配置里该分组一致 |
| 5 | 对比三个库 | 卡片库 / 对象映射表 / 值资源库条目数与源分组逐项相同 |
| 6 | 复制一个**同名**分组（如 `ADS_Ang`） | 新组名为 `ADS_Ang_来自<源配置>`，不覆盖原组 |
| 7 | 多选 2~3 个分组 → 复制 | 全部新增；源配置里若有同名组，批内也按后缀规则各自区分 |
| 8 | 点「保存」→ 切走配置 → 切回来 | 新分组仍在，内容未丢 |
| 9 | 从**当前配置**复制自己 | 同样生成新分组（名带后缀），原组不受影响 |
| 10 | 选一个没有分组的/旧结构配置 | 旧结构配置能列出 1 个默认分组；空配置提示「该配置下没有分组」，复制按钮禁用 |

### 5.3 回归

- 右键菜单原有三项（导入用例 / 导出为 Excel / 全部导出）行为不变。
- 新建分组 / 删除分组 / 分组改名 / 图形配置编辑器打开与保存均不受影响（改动只是新增分支与新增弹窗）。

---

## 6. 不做（Out of scope）

- 「只合并三个库进当前分组」的变体（本轮已确认不要）。
- 分组导出/导入为 `.json` 文件（跨机器传递）。
- 库条目的跨配置去重/合并/覆盖策略（整组复制下不存在该问题）。
- 后端新接口（无必要，见 2.4）。
- 跨配置复制**工况框**到已有分组（会牵出 `refId` 重映射与卡片库合并，属于另一件事）。

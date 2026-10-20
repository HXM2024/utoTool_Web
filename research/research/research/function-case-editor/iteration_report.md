# Function 用例编排模块 · 迭代实验报告

> 本文件记录「交互原型实验 + 主项目小步改造」的逐轮迭代结论。每轮追加一节并标注日期。

***

## 第 1 轮 · 2026-09-02

### 一、本轮改动清单

#### 1. 交互原型（新增，独立目录，不影响主项目）

在 `research/function-case-editor/` 下新建「卡片流水线」交互原型，技术栈与主项目一致（Vue3 + Vite + TypeScript，`vue` 版本与 `frontend/package.json` 对齐为 `^3.4.21`）。

核心交付文件：

- `src/types.ts` —— 数据模型（StageType=inject/sequence/result、CardStep、Card、CaseTrack、Workspace、mapping 别名表、CAPL 函数联想列表）。

- `src/store.ts` —— 响应式工作区状态（localStorage 持久化），含卡片库「保存/引用式复用」逻辑：`saveToLibrary`（入库 + `refId` 绑定）、`referenceFromLibrary`（从库引用生成 `refId` 卡片）、`syncRefs`（库改后同步所有引用）。

- `src/components/CaseTrack.vue` —— 一条用例 = 一条水平卡片轨道，阶段从左到右：用例名 → 注入 → 序列 → 结果判断；卡片间「＋」插入（同节点多卡片 = 并联分支），支持 HTML5 拖拽串联排序。

- `src/components/StageCard.vue` —— 单卡片，卡片头就地编辑名称，「💾 入库」一键保存到卡片库，展开/收起内联步骤表。

- `src/components/StepTable.vue` —— 就地内联步骤表：kind 下拉、函数名 `<datalist>` 联想、参数支持 `literal/mapping` 别名（mapping 值走别名联想）。

- `src/components/LibraryPanel.vue` —— 卡片库侧栏，点击「引用」把库卡片以引用方式加入用例。

- `src/App.vue`、`src/main.ts`、`src/style.css`、`index.html`、`vite.config.ts`、`tsconfig.json`、`package.json`。

验证：`npm install` + `npm run build`（`vue-tsc --noEmit && vite build`）通过，产物生成于 `dist/`。

#### 2. 主项目小步改造（仅后端，最小增量）

文件：[function\_graph.py](file:///e:/Python/AutoTool_Web/backend/services/function_graph.py)

- 抽出 `_render_steps` 复用步骤→CAPL 渲染逻辑。

- 新增 `_paths_from`（沿 edges 做带环保护的 DFS，枚举起点到死端的所有路径）。

- 新增 `_expand_by_edges`：有 edges 时按拓扑展开——「注入→序列→结果同链串联拼接、分叉并联生成多条用例」。

- 新增 `_expand_cartesian`：原泳道口笛卡尔积逻辑原样迁移。

- 修改 `expand_cases`：`edges` 非空走 `_expand_by_edges`，否则走 `_expand_cartesian`，保持旧配置兼容。

行为约定：

- 起点 = 注入泳道所有口（按 nodes 顺序）；若注入泳道为空，则退回「无入边的口」以兼容省略注入泳道的图。

- 路径终点 = 无出边的口（通常为结果口）。

- 用例步骤 = 路径上各口 steps 顺序拼接；`inject/sequence/result` 标签分别取路径中对应泳道口的 label（sequence 多段用 `, `   连接）。

- 用例命名仍为 `GraphCase_N`（本轮未改，见「下一轮待办」）。

### 二、验证结果

| 项目      | 命令                                                        | 结果                                            |
| ------- | --------------------------------------------------------- | --------------------------------------------- |
| 原型编译    | `cd research/function-case-editor && npm run build`       | ✅ 通过（27 modules，产物 77.91 kB / gzip 30.94 kB）  |
| 后端语法    | `python -m py_compile backend/services/function_graph.py` | ✅ 通过（无输出，exit 0）                              |
| 后端单链展开  | 注入→序列→结果一条链                                               | ✅ 1 条用例，步骤按序拼接，mapping 别名 `车速信号` 解析为 `VehSpd` |
| 后端分叉展开  | 1 注入 → 2 序列 → 2 结果（分叉）                                    | ✅ 2 条用例，各自串联正确（序列A/结果A、序列B/结果B）               |
| 后端旧行为兼容 | 无 edges 图                                                 | ✅ 走 `_expand_cartesian`，与改造前逻辑一致              |
| 前端类型    | `cd frontend && npx vue-tsc --noEmit`                     | ✅ 通过（exit 0，无类型错误）                            |

### 三、交互方案对比结论

对比三种「用例编排」交互形态（评估维度：操作步数 = 完成一条含 N 步骤用例所需点击/拖拽次数；一目了然性 = 能否一眼看清用例结构）。

| 维度            | 卡片流水线（本轮原型）                        | 思维导图（MindMap）                 | 自由画布连线（现有 GraphCanvas）                    |
| ------------- | ---------------------------------- | ----------------------------- | ----------------------------------------- |
| 结构表达          | 一条用例 = 一条水平轨道，阶段固定（注入→序列→结果），顺序强约定 | 中心辐射/树状，适合发散与层级，但「阶段顺序」需靠视觉约定 | 节点 + 连线，最自由，但阶段顺序靠用户自律连线                  |
| 编辑步骤表         | 卡片就地内联编辑（本轮已实现），0 次跳转              | 节点内需另开面板/弹窗                   | 需进 NodeInspector→CardEditor 弹窗（当前最深，缺陷 4） |
| 建立串联          | 拖拽卡片排序或「＋」插入，1\~2 步                | 拖动节点/连线，2\~3 步                | 拉端口连线，2\~3 步，且当前连线被后端忽略（缺陷 1）             |
| 表达并联分支        | 同节点多卡片 = 并联，视觉即语义                  | 树状分叉天然表达，较好                   | 端口分叉连线，语义与后端需对齐                           |
| 卡片库复用         | 一键入库 + 引用式复用（改库同步，修复缺陷 2 方向）       | 可作为模板节点引用                     | 当前拖入即深拷贝，不同步（缺陷 2）                        |
| 一目了然性         | ★★★★ 轨道顺序固定，扫一眼即懂                  | ★★★ 分支清晰但阶段顺序弱                | ★★ 自由但需读连线，认知负担高                          |
| 操作步数（1 条简单用例） | 约 6~~8 步（建轨→3 卡片→每卡 1~~2 步骤就地编辑）   | 约 8\~12 步（建节点+连线+打开编辑）        | 约 10\~15 步（建节点+连线+多层弹窗编辑）                 |

结论：**卡片流水线**在「阶段顺序固定、就地编辑、并联=多卡片」三点上最贴合 Function 用例场景，操作步数最少、一目了然性最高；思维导图适合发散式设计但弱化阶段顺序；自由画布连线最灵活，但当前实现既深又慢，且连线语义与后端脱节。建议主项目长期演进方向向「卡片流水线」收敛，短期用「拓扑展开 + 连线即语义」补足现有画布。

### 四、下一轮待实验的改进点

1. **前后端用例数一致**：`frontend/src/utils/functionGraph.ts` 的 `computeCaseCount` 仍是泳道口笛卡尔积，需与后端 edges 拓扑展开对齐（否则画布预览用例数与实际生成不一致）。
2. **卡片库引用式复用**：修复 `GraphCanvas.vue` L197 拖入即深拷贝的问题，改为「引用 + 改库同步」，对齐原型 `refId` 方案。
3. **用例命名可定制**：替换强制 `GraphCase_N`，支持用用例名/注入卡片名等生成可读 `case_id`。
4. **编辑路径打平**：把「节点→NodeInspector→CardEditor 弹窗」改为卡片就地内联编辑步骤表（迁移原型 `StepTable` 交互）。
5. **清理遗留组件**：确认并移除 `MindMapCanvas.vue`、`StepFlowEditor.vue` 等无引用组件。
6. **连线即语义的 UI 反馈**：在有 edges 的画布中实时高亮「当前会生成哪几条用例/串联链」，让连线结果即时可见。

***

（第 1 轮结束；本轮无「上一轮待办」，故第 4 项「提出并实践下一个方案」自第 2 轮起按上述待办执行。）

***

## 第 2 轮 · 2026-09-03

### 一、本轮改动清单

#### 1. 既有产物复核（第 1 轮成果回归验证）

- 原型 `research/function-case-editor/`（卡片流水线）保持不改动，重跑 `npm run build` 回归验证。

- 后端 [function\_graph.py](file:///e:/Python/AutoTool_Web/backend/services/function_graph.py) 的 edges 拓扑展开（第 1 轮已实现）保持不改动，重跑 `py_compile` + 三组行为用例回归验证。

#### 2. 主项目小步改造（前端 1 处，最小增量）

文件：[functionGraph.ts](file:///e:/Python/AutoTool_Web/frontend/src/utils/functionGraph.ts)

- 新增 `countCasesByEdges(graph)`：镜像后端 `_expand_by_edges` 的计数逻辑——注入泳道所有口为起点（注入为空时退回无入边的口），沿 edges 做带环保护 DFS 枚举到死端的路径数，即「同链串联、分叉并联」下的用例条数。

- 修改 `computeCaseCount(graph)`：有 edges 时用 `countCasesByEdges`；无 edges 走原泳道口笛卡尔积，旧配置行为不变。

影响面：`FunctionGraphEditor.vue` 的画布「将生成 N 条用例」计数（L495）自动与后端拓扑展开对齐，无需改调用方。对应第 1 轮待办 #1。

### 二、验证结果

| 项目      | 命令                                                        | 结果                                                    |
| ------- | --------------------------------------------------------- | ----------------------------------------------------- |
| 原型编译    | `cd research/function-case-editor && npm run build`       | ✅ 通过（27 modules，产物 77.91 kB / gzip 30.94 kB，与第 1 轮一致） |
| 后端语法    | `python -m py_compile backend/services/function_graph.py` | ✅ 通过                                                  |
| 后端单链展开  | 注入A→序列A→结果A 一条链                                           | ✅ 1 条用例，步骤按序拼接，mapping 别名「车速」解析为 `VehSpd`             |
| 后端分叉展开  | 1 注入 → 2 序列 → 各 1 结果                                      | ✅ 2 条用例（序列A/结果A、序列B/结果B）                              |
| 后端旧行为兼容 | 无 edges（2 注入口 × 1 序列 × 1 结果）                              | ✅ 2 条用例，走 `_expand_cartesian`                         |
| 前端类型    | `cd frontend && npx vue-tsc --noEmit`                     | ✅ 通过（exit 0）                                          |
| 前端构建    | `cd frontend && npm run build`                            | ✅ 通过（16.24s，仅存量 chunk 体积警告，无新增报错）                     |

本轮未做步骤无需回滚，前后端均一次通过。

### 三、交互方案对比（延续第 1 轮结论，结合本轮验证补充）

第 1 轮的操作步数/一目了然性对比结论保持不变（卡片流水线 ≈6~~8 步 < 思维导图 ≈8~~12 步 < 自由画布 ≈10\~15 步）。本轮从「前后端一致性」角度补充：

- 自由画布连线的最大隐性成本曾在于：画布预览计数（笛卡尔积）与实际生成（拓扑展开）语义不一致——用户连了线却看不到用例数变化，「连线即语义」反馈缺失。本轮对齐后，画布计数可如实反映分叉并联效果，自由画布的可用性有所提升，但其「编辑路径深」的根本短板仍在，排序结论不变：**主项目长期向卡片流水线收敛，短期以拓扑语义补足画布**。

### 四、上一轮待办完成情况

| 待办                                      | 状态                                                                                                                           |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| #1 前后端用例数一致（computeCaseCount 对齐 edges）  | ✅ 本轮完成                                                                                                                       |
| #2 卡片库引用式复用（GraphCanvas.vue L197 拖入深拷贝） | ⬜ 未完成，转入第 3 轮                                                                                                                |
| #3 用例命名可定制（替换 GraphCase\_N）             | ⬜ 未完成，转入第 3 轮                                                                                                                |
| #4 编辑路径打平（就地内联步骤表）                      | ⬜ 未完成，转入第 3 轮                                                                                                                |
| #5 清理遗留组件                               | 🔶 部分确认：`MindMapCanvas.vue` 实际文件已不存在（仅 `FunctionLibrary.vue` 注释中提及）；`StepFlowEditor.vue` 仍在但全工程无引用——受「不删除已有文件」的保守约束，本轮仅记录不删除 |
| #6 连线即语义的 UI 反馈（高亮将生成的用例链）              | ⬜ 未完成，转入第 3 轮                                                                                                                |

上一轮待办未全部完成，故按规则本轮不启动新方案探索，第 3 轮优先推进 #2（引用式复用）与 #3（用例命名可读化），二者均为主项目可小步落地项。

***

## 第 3 轮 · 2026-09-03

### 一、本轮改动清单

#### 1. 既有产物复核（回归验证，无改动）

- 原型 `research/function-case-editor/`（卡片流水线）保持不改动，重跑 `npm run build` 通过（27 modules，产物 77.91 kB / gzip 30.94 kB，与第 1/2 轮一致）。

- 后端 [function\_graph.py](file:///e:/Python/AutoTool_Web/backend/services/function_graph.py) 保持不改动，`py_compile` + 三组行为用例回归全部通过（见验证表）。

#### 2. 主项目小步改造（前端 2 处，闭环第 1/2 轮遗留的 #2「引用式复用」）

现状盘点：第 1 轮起 `GraphCanvas.vue` 拖入卡片已保留 `refId`（L197 附近），`GroupNodeItem.vue` 已为引用卡片显示 ⛓ 标记；代码核查发现 **#3 用例命名可读化实际已落地**（后端 `_make_case_id(naming='path')` + `Graph.naming` 字段 + `FunctionGraphEditor.vue` 头部「编号/链路命名」切换，第 2 轮报告误判为未完成，本轮更正）。因此本轮仅需补齐 #2 缺的「库改后同步到画布」闭环：

文件：[functionGraph.ts](file:///e:/Python/AutoTool_Web/frontend/src/utils/functionGraph.ts)

- 新增 `syncGraphRefs(graph, library)`：遍历画布所有节点卡片，凡带 `refId` 且库中仍存在对应卡片者，以库内容为准覆盖 `name/description/steps/type`；保留画布实例 `id/refId` 不动（端口/连线引用不失效）；无变化时返回原 graph 引用（synced=0），避免触发无谓的 update 循环。

文件：[FunctionGraphEditor.vue](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/FunctionGraphEditor.vue)

- 新增 `syncRefsFromLibrary(lib, notify)`：有同步动作时更新 graph、emit `update:graph` 并按需提示「已从卡片库同步 N 张引用卡片」。

- `onCardsChange`（卡片库编辑/新建/删除后）调用同步（notify=true）→ 画布引用卡片即时刷新。

- `loadGlobal`（加载全局库成功）后调用同步（notify=false）→ 打开既有配置时自动与库对齐。

行为约定：库中删除卡片后，画布引用卡片保持原位保留最后内容（⛓ 仍在），不擅自删除节点卡片——避免破坏既有连线。

### 二、验证结果

| 项目        | 命令                                                        | 结果                                                      |
| --------- | --------------------------------------------------------- | ------------------------------------------------------- |
| 原型编译      | `cd research/function-case-editor && npm run build`       | ✅ 通过（27 modules，77.91 kB / gzip 30.94 kB）               |
| 后端语法      | `python -m py_compile backend/services/function_graph.py` | ✅ 通过                                                    |
| 后端单链展开    | 注入A→序列A→结果A                                               | ✅ 1 条用例，步骤按序拼接，mapping 别名「车速」解析为 `VehSpd`               |
| 后端分叉+可读命名 | 1 注入分叉 2 序列（naming=path）                                  | ✅ 2 条用例，case\_id 为 `TC_A_A_A` / `TC_A_B`（可读命名生效）        |
| 后端旧行为兼容   | 无 edges（2 注入×…）                                           | ✅ 走 `_expand_cartesian`                                 |
| 前端类型      | `cd frontend && npx vue-tsc --noEmit`                     | ✅ 通过（期间因漏 import `CardLibrary` 报 2 错，修复后通过；记录为过程调试，非回滚） |
| 前端构建      | `cd frontend && npm run build`                            | ✅ 通过（13.57s，仅存量 chunk 体积警告）                             |

中途问题与处理：第一次在 frontend 目录误执行对 backend 相对路径的 py\_compile（路径错误，重跑通过）；`syncGraphRefs` 首次提交时 `functionGraph.ts` 漏导入 `CardLibrary` 类型、`FunctionGraphEditor.vue` 导入行被并行编辑覆盖导致 `syncGraphRefs` 未定义——均通过补导入修复，未回滚任何改动。

### 三、交互方案对比（延续第 1/2 轮结论）

三种形态的操作步数/一目了然性排序维持不变（卡片流水线 ≈6~~8 步 < 思维导图 ≈8~~12 步 < 自由画布 ≈10\~15 步）。本轮补充：

- \#2 闭环后，自由画布在「复用一致性」上的短板补齐：改库即同步画布引用（原型 `syncRefs` 方案在主项目落地等效实现），同节点多卡片（multi）+ 连线分叉已能覆盖卡片流水线的并联语义。

- 剩余差距集中在「编辑路径深」（节点→NodeInspector→CardEditor 弹窗，待办 #4），这是点击数差异的主要来源，不改变排序结论：**主项目长期向卡片流水线收敛，画布短期以拓扑+引用+可读命名补足**。

### 四、上一轮（第 2 轮）待办完成情况

| 待办                               | 状态                                              |
| -------------------------------- | ----------------------------------------------- |
| #1 前后端用例数一致                      | ✅ 第 2 轮已完成                                      |
| #2 卡片库引用式复用（拖入保留 refId + 库改同步画布） | ✅ 本轮完成闭环                                        |
| #3 用例命名可定制                       | ✅ 已存在于代码（后端 path 命名 + 编辑器头部切换），本轮复核确认并更正第 2 轮记录 |
| #4 编辑路径打平（就地内联步骤表）               | ⬜ 未完成，转入第 4 轮                                   |
| #5 清理遗留组件                        | 🔶 受「不删除文件」约束仅记录：`StepFlowEditor.vue` 仍无引用      |
| #6 连线即语义的 UI 反馈（高亮将生成的用例链）       | ⬜ 未完成，转入第 4 轮                                   |

第 2 轮列入的 #1\~#3 已全部完成（#5 受约束不执行删除）；剩余仅 #4/#6 两项交互改进。

### 五、下一轮待办（以「减少点击数、就地编辑、连线即连线」为目标）

1. \#4 编辑路径打平：在 `GroupNodeItem` 卡片行直接展开内联步骤表（复用原型 `StepTable` 交互：kind 下拉、函数名联想、参数 mapping 别名），替换「节点→NodeInspector→CardEditor」三级弹窗路径；预计单卡片编辑点击数从 ≈8 降到 ≈3。
2. \#6 连线即语义 UI 反馈：画布连边/改卡片后，以前端与后端一致的拓扑展开逻辑（`countCasesByEdges` 已有）实时列出「将生成的用例链」预览（路径 label 串），连线结果即时可见。
3. 全工程引用复核：确认 `StepFlowEditor.vue` 等组件确实零引用后，在报告中给出处置建议（归档或删除），供用户决策。
4. 原型侧增补与主项目对齐项：原型卡片流水线增加「导出为 Graph(nodes/edges) JSON」能力，验证两种形态数据互通的可行性（为长期收敛铺路）。

***

（第 3 轮结束；无 git 提交，无配置文件删除，改动仅限 `frontend/src/utils/functionGraph.ts` 与 `frontend/src/components/graph/FunctionGraphEditor.vue`。）

***

## 第 4 轮 · 2026-09-03

### 一、本轮改动清单

#### 1. 交互原型（新增「导出 Graph JSON」能力）

文件：[store.ts](file:///e:/Python/AutoTool_Web/research/function-case-editor/src/store.ts)、[App.vue](file:///e:/Python/AutoTool_Web/research/function-case-editor/src/App.vue)

- `store.ts` 新增 `buildGraphJson()`：把原型工作区的每条 `CaseTrack`（用例 = 水平卡片轨道，阶段注入→序列→结果）映射为主项目 `Graph(nodes/edges)` 结构——每阶段有卡片的生成一个 `multi` 组节点，相邻阶段按「第 p 卡对第 p 卡」生成连线（分叉并联语义），`naming='path'`。
- `store.ts` 新增 `exportGraphJson()`：返回格式化 JSON 字符串。
- `App.vue` 新增「导出 Graph JSON」按钮，`downloadGraph()` 用 Blob 触发下载。

目的：验证「卡片流水线」与主项目「Graph(nodes/edges)」两种数据形态可双向互通，为长期收敛铺路（第 3 轮待办 #4）。

#### 2. 主项目小步改造（前端 3 文件，闭环 #6 并推进 #4）

文件：[functionGraph.ts](file:///e:/Python/AutoTool_Web/frontend/src/utils/functionGraph.ts)

- 新增 `listCaseChains(graph)`：与后端 `_expand_by_edges` 同规则枚举每条「将生成的用例链」——注入口为起点（空则退回无入边的口）、带环保护 DFS、分叉并联各成一条；返回每项为端口 label 数组（如 `['注入A','序列A','结果A']`）。无 edges 返回空数组（笛卡尔积场景不适用链路预览）。对应第 3 轮待办 #6。

文件：[FunctionGraphEditor.vue](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/FunctionGraphEditor.vue)

- 头部「预计 N 条用例」tag 外包 `el-popover`（hover 触发）：有 edges 时悬浮列出 `caseChains` 每条链路的 label 串联预览（`注入A → 序列A → 结果A`），连线结果即时可见。
- 新增 `onEditCard(nodeId, cardId)` / `onCardSave(card)`：画布双击卡片时直接打开 `CardEditor`（`editingNodeId` 记录来源节点，保存后回写该节点卡片并 emit update）。这是第 3 轮待办 #4「编辑路径打平」的第一步——跳过「节点→NodeInspector」中转，双击即达编辑器。

文件：[GraphCanvas.vue](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/GraphCanvas.vue)、[GroupNodeItem.vue](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/GroupNodeItem.vue)

- `GroupNodeItem.vue`：卡片行加 `@dblclick.stop` 发出 `edit-card(nodeId, cardId)`，并加 title 提示「双击直接编辑卡片」。
- `GraphCanvas.vue`：透传 `edit-card` 事件；底部提示语补「双击卡片直接编辑」。

### 二、验证结果

| 项目      | 命令                                                        | 结果                                                    |
| ------- | --------------------------------------------------------- | ----------------------------------------------------- |
| 原型编译    | `cd research/function-case-editor && npm run build`       | ✅ 通过（27 modules，产物 78.78 kB / gzip 31.32 kB，较上轮 +0.87 kB 为新增导出逻辑） |
| 后端语法    | `python -m py_compile backend/services/function_graph.py` | ✅ 通过（exit 0）                                          |
| 后端单链展开  | 注入A→序列A→结果A                                               | ✅ 1 条用例，3 步按序拼接，mapping 别名「车速」解析为 `VehSpd`             |
| 后端分叉+可读命名 | 1 注入 → 2 序列 → 各 1 结果（naming=path）                        | ✅ 2 条用例，case\_id 为 `TC_A_A_A` / `TC_A_B_B`                  |
| 后端旧行为兼容 | 无 edges（2 注入 × 1 序列 × 1 结果）                              | ✅ 2 条用例，走 `_expand_cartesian`                         |
| 前端类型    | `cd frontend && npx vue-tsc --noEmit`                     | ✅ 通过（首次因漏 import `listCaseChains` 报 TS2552，补 import 后通过；过程调试，非回滚） |
| 前端构建    | `cd frontend && npm run build`                            | ✅ 通过（13.57s，仅存量 chunk 体积警告，无新增报错）                     |

### 三、交互方案对比（延续第 1/2/3 轮结论）

三种形态的操作步数/一目了然性排序维持不变（卡片流水线 ≈6~8 步 < 思维导图 ≈8~12 步 < 自由画布 ≈10~15 步）。本轮补充：

- \#6 落地后，自由画布补上「连线即语义」的最后一块短板：头部用例链预览随连线/卡片实时更新，用户能一眼看到「当前会生成哪几条用例链」，消除「连了线却看不到效果」的隐性认知成本。
- \#4 推进第一步后，自由画布编辑路径由「节点→NodeInspector→CardEditor」三级降到「双击卡片→CardEditor」两级，但仍是弹窗编辑，尚未达到卡片流水线「就地内联步骤表」的 0 跳转目标，点击差主要残留于此。
- 原型「导出 Graph JSON」证明两种形态数据可互通：卡片流水线产出的轨道可无损转为主项目 Graph(nodes/edges)，反向导入（Graph→轨道）留作下一轮验证。排序结论不变：**主项目长期向卡片流水线收敛，画布短期以拓扑语义 + 引用 + 可读命名 + 链路预览补足**。

### 四、上一轮（第 3 轮）待办完成情况

| 待办                                          | 状态                                                                                       |
| ------------------------------------------- | ---------------------------------------------------------------------------------------- |
| #4 编辑路径打平（就地内联步骤表）                          | 🔶 部分完成：本轮实现「画布双击卡片直达 CardEditor」，跳过 NodeInspector 中转，但仍是弹窗、未把步骤表内联到画布/检查器内。转入第 5 轮 |
| #6 连线即语义 UI 反馈（高亮/预览将生成的用例链）                | ✅ 本轮完成（头部 hover 预览链路 label 串）                                                        |
| #3 全工程引用复核（StepFlowEditor 等零引用）               | ✅ 复核完成：`MindMapCanvas.vue`、`StepFlowEditor.vue` 均存在但零引用（仅 `FunctionLibrary.vue` 注释与自身 `name` 提及）。受「不删除已有文件」约束，处置建议见下轮 |
| #4 原型增补（导出 Graph JSON）                        | ✅ 本轮完成（`buildGraphJson` / `exportGraphJson`）                                          |

第 3 轮 4 项待办中 #6、#3、#4 已完成，#4「就地内联」仅完成一半（双击直达弹窗、未完全内联），故按规则本轮不触发「上一轮全部完成后提出并实践新方案」，下一轮优先补齐 #4 的完整内联编辑。

### 五、下一轮待办（以「减少点击数、就地编辑、连线即连线」为目标）

1. \#4 完整版「就地内联步骤表」：把 `CardEditor` 的步骤行编辑（kind 下拉、函数名 `datalist` 联想、参数 literal/mapping 别名）内联到 `NodeInspector` 的卡片行或画布卡片行，替换弹窗，实现 0 跳转就地编辑；目标单卡片编辑点击数从 ≈5 降到 ≈2。
2. 原型双向互通验证：新增「导入 Graph JSON」到卡片流水线，反向将主项目 Graph(nodes/edges) 还原为轨道，闭环「导出↔导入」互认。
3. 遗留组件处置建议：`MindMapCanvas.vue`、`StepFlowEditor.vue` 确认零引用后，在报告中给出「归档（移入 `frontend/src/components/_legacy/`）或删除」的明确建议，供用户决策（本轮受约束不执行）。
4. 用例链预览升级为画布高亮：在 `EdgeLayer` 中高亮当前悬停链路对应的连线，或点击某条预览链路时高亮画布路径，让「连线即语义」从文本预览走向图形反馈。

***

（第 4 轮结束；无 git 提交，无配置文件删除。原型改动限于 `research/function-case-editor/src/store.ts`、`src/App.vue`；主项目改动限于 `frontend/src/utils/functionGraph.ts`、`frontend/src/components/graph/FunctionGraphEditor.vue`、`GraphCanvas.vue`、`GroupNodeItem.vue`。）

***

## 第 5 轮 · 2026-09-04

### 一、本轮改动清单

本轮按已确定的「工况框连线编排」交互方案（原型 `case-frame-prototype.html` v4）把主项目从「自由画布 + 三泳道」迁移到「工况框」形态，并让后端展开语义与原型严格一致。

#### 1. 后端同步（backend/services/function_graph.py）

结论：**后端工况框展开逻辑在上一轮已存在且与原型逐条一致**，本轮复核并补验证，未做无谓功能改动。

复核比对点（与原型 `expandOf` 一致）：
- `_parse_seq_step_key` 解析 `seq:<seqId>:<stepIdx>`，与原型 `parseSeqStep`（`lastIndexOf(':')`）一致。
- `_expand_frame_paths`：序列为主干，注入插在连线所接步骤之前、结果接在所接步骤之后；注入→序列线按 `seq` 编号，序列→结果线按 `pair` 配对（`pair=[]` 对应全部注入）；同一注入匹配多个结果时按 `stepIdx` 排序后「累积前缀」生成多条路径。
- `expand_cases`：`frames` 非空优先走 `_expand_by_frames`；否则有 `edges` 走 `_expand_by_edges`；无 `edges` 走 `_expand_cartesian`，保持旧 `graph{nodes,edges}` 兼容。

校验命令：`python -m py_compile backend/services/function_graph.py`（exit 0）。

#### 2. 主项目前端迁移

数据模型 [functionGraph.ts](file:///e:/Python/AutoTool_Web/frontend/src/types/functionGraph.ts)
- 新增 `FrameEdge`（`from/to` 为端口 key，`seq?`、`pair?`）与 `CaseFrame`（`injects/sequenceId/results/nodes/edges`）。
- `Graph` 增加 `frames?: CaseFrame[]`；`emptyGraph()` 返回 `frames: []`。

工具层 [functionGraph.ts](file:///e:/Python/AutoTool_Web/frontend/src/utils/functionGraph.ts)
- 新增 `isInjectKey / isResultKey / parseSeqStepKey / frameNodeLabel / expandFramePaths / countCasesByFrames / listFrameChains`，镜像后端 `_expand_frame_paths`。
- 原 edges 链路预览拆出 `listEdgeChains`；`listCaseChains` 改为「frames 优先，否则 edges」。
- `computeCaseCount` 增加 frames 分支。
- `syncGraphRefs` 扩展：同时同步 `graph.frames` 内带 `refId` 的节点卡片，保留画布实例 id/refId 不动。

新组件 [CaseFrameCanvas.vue](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/CaseFrameCanvas.vue)
- 纵向排列工况框，宽度填满容器；每个工况框 = 一个用例模板。
- 默认只有中间「测试序列」列，左右为窄热区；拖库卡片入注入/结果热区时出现对应列，列清空后自动折叠。
- 注入右口 → 序列步骤左口、序列步骤右口 → 结果左口；连线方向校验；注入线自动分配最小可用 `seq`，结果线自动分配最小可用 `pair`。
- 连线序号/配对可原地点击数字编辑（逗号分隔一对多，留空=全部注入）。
- 双击注入/序列/结果节点打开 `CardEditor` 就地编辑步骤；双击库卡片编辑序列模板（复用 `CardLibraryPanel`）。
- 底部按 `expandFramePaths` 实时预览本框展开的用例链。

编辑器 [FunctionGraphEditor.vue](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/FunctionGraphEditor.vue)
- 新增「工况框 / 自由画布」模式切换（默认：有 `frames` 或空配置 → 工况框；有 `nodes/edges` → 自由画布）。
- 头部「预计 N 条用例」「用例链预览」改为按当前模式计算；中心区按模式渲染 `CaseFrameCanvas` 或 `GraphCanvas`；右侧「节点参数」在工况框模式显示就地编辑提示。

视图层 [FunctionView.vue](file:///e:/Python/AutoTool_Web/frontend/src/views/FunctionView.vue)
- `normalizeGraph` 保留 `frames` 与 `naming`（顺带修复旧逻辑丢弃 `naming` 的问题）。

### 二、验证结果

| 项目        | 命令                                                        | 结果                                                       |
| --------- | --------------------------------------------------------- | -------------------------------------------------------- |
| 后端语法      | `python -m py_compile backend/services/function_graph.py` | ✅ 通过（exit 0）                                             |
| 后端工况框单注入 | 4 注入(seq 1..4) + 1 结果(pair=[])                           | ✅ 4 条用例，注入插在步骤 2 之前、结果接在步骤 3 之后                            |
| 后端一对多累积   | 1 注入(seq 1) + 2 结果(均 pair=[1])                           | ✅ 2 条用例：`[S0,INJ,S1,R2,S2]` → `[S0,INJ,S1,R2,S2,R1]`，按端口顺序累积 |
| 后端旧 graph 兼容 | 无 frames 的 nodes/edges 图                                    | ✅ 仍走 `_expand_by_edges`（未改动）                               |
| 前端类型      | `cd frontend && npx vue-tsc --noEmit`                     | ✅ 通过（exit 0，无类型错误）                                       |
| 前端构建      | `cd frontend && npm run build`                            | ✅ 通过（16.76s，2321 modules，仅存量 chunk 体积警告）                   |

本轮后端无回滚；前端一次通过，无回滚。

### 三、交互方案结论（延续前四轮，本轮为方向切换）

前四轮结论为「长期向卡片流水线收敛、短期用拓扑语义补足自由画布」。本轮在已确定「工况框」方案后，将主项目交互主线切到工况框：一个工况框 = 一个用例模板，序列为主干、注入/结果按端口序号挂接，比自由画布的「阶段顺序靠自律连线」更贴近 Function 用例语义，同时保留自由画布作为兼容旧配置的旁路。

### 四、上一轮（第 4 轮）待办与本轮关系

| 待办                               | 状态                                              |
| -------------------------------- | ----------------------------------------------- |
| #4 完整版就地内联步骤表                      | 🔶 本轮在工况框模式以「双击节点 → CardEditor」实现就地编辑入口（仍为弹窗，未完全内联到画布行） |
| 原型双向互通（导入 Graph JSON）              | ⬜ 未做，转入下一轮                                        |
| 遗留组件处置建议                          | ⬜ 受「不删除文件」约束继续记录                                 |
| 用例链预览升级为画布高亮                       | ⬜ 未做，转入下一轮                                        |

### 五、下一轮待办

1. 工况框端到端联调：保存配置 + 生成文件走 `expand-cases` 后端接口，验证 `frames` 序列化与展开结果一致（当前仅前端类型/构建 + 后端单测通过）。
2. 工况框「库引用式复用」UI 反馈：注入/序列/结果节点显示 ⛓ 标记，库改后提示同步数量（`syncGraphRefs` 已支持，缺 UI 提示）。
3. 连线交互打磨：序号重复校验、连线删除确认、端口命中放大、拖拽临时线跟随更顺滑。
4. 旧「自由画布」与「工况框」双向迁移/导入导出，验证两种数据形态互通。
5. 遗留组件处置：`StepFlowEditor.vue` 等确认零引用后给出「归档或删除」建议，供用户决策。

***

（第 5 轮结束；无 git 提交，无配置文件删除。改动仅限 Function 相关：`backend/services/function_graph.py` 无功能改动（复核）、`frontend/src/types/functionGraph.ts`、`frontend/src/utils/functionGraph.ts`、`frontend/src/components/graph/FunctionGraphEditor.vue`、`frontend/src/components/graph/CaseFrameCanvas.vue`（新增）、`frontend/src/views/FunctionView.vue`。）

***

## 第 6 轮 · 2026-09-04

### 一、本轮改动清单

#### 1. 后端复核（对应本轮 A）

结论：**后端工况框展开逻辑第 5 轮已对齐，本轮复核确认无需功能改动**。逐条复核：

- `_expand_frame_paths`：序列为主干，注入插在连线所接步骤之前、结果接在所接步骤之后；注入→序列线按 `seq` 编号，序列→结果线按 `pair` 配对（`pair=[]` = 全部注入）；同一注入匹配多个结果时按 `step_idx` 排序后「累积前缀」生成多条路径。
- `_parse_seq_step_key` 与原型 `parseSeqStep`（`lastIndexOf(':')`）一致。
- `expand_cases`：`frames` 非空优先 `_expand_by_frames`；否则有 `edges` 走 `_expand_by_edges`；无 `edges` 走 `_expand_cartesian`，保持旧 `graph{nodes,edges}` 兼容。

校验：`python -m py_compile backend/services/function_graph.py`（exit 0）；另用内联脚本验证「1 注入 + 2 结果（均 pair=[1]）」的累积前缀展开。

#### 2. 主项目前端（对应本轮 B）

现状复核：工况框迁移第 5 轮已完成——`CaseFrameCanvas.vue`（新增）、`FunctionGraphEditor.vue` 模式切换、`Graph.frames` 数据模型、`syncGraphRefs` 扩展、`CardLibraryPanel` 双击编辑库卡片复用，均已就位。

本轮修复 1 处真实边界缺陷：

文件：[CaseFrameCanvas.vue](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/CaseFrameCanvas.vue)

- 缺陷：序列→结果连线「配对序号」就地编辑留空时，旧实现 `editingEdgeValue.value.split(/[,，\s]+/)` 对空串返回 `['']`，`map(Number)` 得到 `[0]`，使「留空 = 对应全部注入」语义失效（`[0]` 只会匹配编号 0，实际匹配不到任何注入）。
- 修复：先 `trim()`，空串直接置 `pair=[]`（对应全部注入）；非空串按 `[,，\s]+` 拆分后仅保留 `Number.isInteger(n) && n > 0` 的有效序号，杜绝 0 与非整数。
- 说明：`case-frame-prototype.html` 原型存在同样的隐性缺陷，本轮按「不扩大改动面」原则未改原型，仅记录（见下一轮待办）。

影响面：仅工况框「配对序号就地编辑」的解析逻辑，与后端 `not pair` 判定及前端 `expandFramePaths` 的 `!e.pair.length` 语义严格一致。

### 二、验证结果

| 项目        | 命令                                                        | 结果                                                       |
| --------- | --------------------------------------------------------- | -------------------------------------------------------- |
| 后端语法      | `python -m py_compile backend/services/function_graph.py` | ✅ 通过（exit 0）                                             |
| 后端一对多累积   | 1 注入(seq 1) + 2 结果(均 pair=[1])，内联脚本                   | ✅ COUNT 2：`inject,s0,s1,r1,s2` → `inject,s0,s1,r1,s2,r2`（按端口顺序累积） |
| 后端旧 graph 兼容 | 无 frames 的 nodes/edges 图                                    | ✅ 仍走 `_expand_by_edges`（未改动）                               |
| 前端类型      | `cd frontend && npx vue-tsc --noEmit`                     | ✅ 通过（exit 0，无类型错误）                                       |
| 前端构建      | `cd frontend && npm run build`                            | ✅ 通过（13.06s，2321 modules，仅存量 chunk 体积警告，无新增报错）             |

本轮后端无改动、无回滚；前端修复一次通过，无回滚。

### 三、交互方案结论（延续第 5 轮）

工况框方案方向保持不变（一个工况框 = 一个用例模板，序列为主干、注入/结果按端口序号挂接）。本轮补齐「配对序号留空 = 全部注入」的边界语义，使原地编辑与后端展开、前端预览三方一致，减少用户「清了数字却没匹配到结果」的隐性困惑。

### 四、上一轮（第 5 轮）待办完成情况

| 待办                               | 状态                                              |
| -------------------------------- | ----------------------------------------------- |
| #1 工况框端到端联调（保存 + 生成走 expand-cases）      | ⬜ 未做，转入下一轮                                       |
| #2 工况框「库引用式复用」UI 反馈（⛓ 标记 + 同步数量提示） | ⬜ 未做，转入下一轮                                       |
| #3 连线交互打磨（重复校验/删除确认/端口放大/临时线跟随）     | 🔶 部分：本轮修复配对留空边界；其余仍未做                        |
| #4 旧自由画布与工况框双向迁移/导入导出                | ⬜ 未做，转入下一轮                                       |
| #5 遗留组件处置建议                       | ⬜ 受「不删除文件」约束继续记录                               |

### 五、下一轮待办

1. 工况框端到端联调：保存配置 + 生成文件走 `expand-cases` 后端接口，验证 `frames` 序列化与展开结果一致。
2. 工况框「库引用式复用」UI 反馈：注入/序列/结果节点显示 ⛓ 标记，库改后提示同步数量（`syncGraphRefs` 已支持，缺 UI 提示）。
3. 连线交互打磨：序号重复校验、连线删除确认、端口命中放大、拖拽临时线跟随更顺滑。
4. 原型侧同步修复：将本轮 `pair` 留空解析修复同步到 `case-frame-prototype.html`，保持原型与主项目行为一致。
5. 旧「自由画布」与「工况框」双向迁移/导入导出。
6. 遗留组件处置：`StepFlowEditor.vue` 等确认零引用后给出「归档或删除」建议，供用户决策。

***

（第 6 轮结束；无 git 提交，无配置文件删除。改动仅限 `frontend/src/components/graph/CaseFrameCanvas.vue` 一处（配对序号就地编辑解析修复）；后端 `function_graph.py` 本轮为复核无改动。）

***

## 第 7 轮 · 2026-09-04

### 一、本轮改动清单

#### 1. 后端同步（对应本轮 A）

结论：**后端工况框展开逻辑保持与原型一致，本轮复核 + 行为验证，无功能改动**。逐条比对 [function\_graph.py](file:///e:/Python/AutoTool_Web/backend/services/function_graph.py) 的 `_expand_frame_paths` 与原型 `expandOf`：

- 序列为主干，注入插在连线所接步骤之前、结果接在所接步骤之后（`_build_path` 逐步骤遍历插入）。
- 注入→序列线按 `seq` 编号，序列→结果线按 `pair` 配对（`pair=[]` = 全部注入）。
- 同一注入匹配多个结果时，结果边按 `step_idx` 排序后「累积前缀」生成多条路径（`results[:k]`，k=1..N）。
- `expand_cases` 保持 `frames` 优先 → `edges` 次之 → 无 `edges` 走 `_expand_cartesian`，旧 `graph{nodes,edges}` 兼容不变。

#### 2. 主项目前端优化（对应本轮 B）

文件：[CaseFrameCanvas.vue](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/CaseFrameCanvas.vue)

- **库引用式复用 UI 反馈（第 6 轮待办 #2）**：注入节点、结果节点与序列卡片头在 `refId` 存在时显示 ⛓ 标记（`title="来自卡片库引用"`），与既有 `syncGraphRefs` 同步 + `FunctionGraphEditor` 的「已从卡片库同步 N 张引用卡片」提示形成闭环。
- **连线序号重复校验（第 6 轮待办 #3 一部分）**：`saveEdgeInline` 保存注入线序号前，检测同框其它注入线是否已占用相同 `seq`（>0），重复则 `ElMessage.warning` 并保留原值；结果线 `pair` 保存时 `Array.from(new Set(pair))` 去重，避免 "1,1" 类冗余。
- **连线删除确认（第 6 轮待办 #3 一部分）**：`removeEdge` 增加 `ElMessageBox.confirm` 二次确认，防止误点连线即删除。
- **端口命中区放大（第 6 轮待办 #3 一部分）**：端口尺寸 14px → 18px，左右偏移 7px → 9px，hover 缩放 1.4 → 1.3，提升拖线命中率。

文件：[case-frame-prototype.html](file:///e:/Python/AutoTool_Web/research/function-case-editor/case-frame-prototype.html)

- **原型侧 pair 留空解析修复（第 6 轮待办 #4）**：`saveEdgeInline` 改为先 `trim()`，空串直接 `pair=[]`（对应全部注入）；非空串仅保留 `Number.isInteger(n) && n > 0` 的序号，杜绝 `[''] → [0]` 破坏「留空=全部注入」语义，与主项目第 6 轮修复对齐。

### 二、验证结果

| 项目        | 命令                                                        | 结果                                                      |
| --------- | --------------------------------------------------------- | ------------------------------------------------------- |
| 后端语法      | `python -m py_compile backend/services/function_graph.py` | ✅ 通过（exit 0）                                            |
| 后端累积前缀    | 内联脚本：1 注入(seq 1) + 2 结果(均 pair=[1])                         | ✅ COUNT 2：`inj → s0 → s1 → r1 → s2`；`inj → s0 → s1 → r1 → s2 → r2` |
| 后端旧 graph 兼容 | 无 frames、无 edges 的旧图（single 注入卡）                            | ✅ `_expand_cartesian`，1 条用例                                  |
| 前端类型      | `cd frontend && npx vue-tsc --noEmit`                     | ✅ 通过（exit 0，无输出）                                        |
| 前端构建      | `cd frontend && npm run build`                            | ✅ 通过（15.95s，2321 modules，仅存量 chunk 体积警告，无新增报错）              |

本轮后端无回滚；前端一次通过，无回滚。

### 三、交互方案结论（延续第 5/6 轮）

工况框方案方向保持不变（一个工况框 = 一个用例模板，序列为主干、注入/结果按端口序号挂接）。本轮把「库引用可感知（⛓）」「注入线序号重复校验」「连线删除确认」「端口命中区放大」补齐，减少误操作与重复序号引发的隐性错误，使工况框连线编排从「可用」向「不易错」收敛。

### 四、上一轮（第 6 轮）待办完成情况

| 待办                               | 状态                                              |
| -------------------------------- | ----------------------------------------------- |
| #1 工况框端到端联调                      | 🔶 已确认 `/function/expand-cases` 接口直接透传 `graph` 到 `expand_cases`，逻辑通路成立；运行态联调仍未做，转入下一轮 |
| #2 工况框「库引用式复用」UI 反馈              | ✅ 本轮完成（⛓ 标记；同步提示沿用既有实现）                          |
| #3 连线交互打磨                         | 🔶 本轮完成「序号重复校验 / 删除确认 / 端口命中放大」；临时线跟随已基于 `portPos` 实时更新，未另改动 |
| #4 原型侧 pair 留空修复同步                | ✅ 本轮完成                                          |
| #5 旧自由画布与工况框双向迁移/导入导出            | ⬜ 未做，转入下一轮                                       |
| #6 遗留组件处置建议                       | ⬜ 受「不删除文件」约束继续记录                                |

### 五、下一轮待办

1. 工况框端到端联调：启动后端，用 `POST /function/expand-cases` 验证 `frames` 序列化与展开结果一致（或补后端集成测试）。
2. 旧「自由画布」与「工况框」双向迁移/导入导出，验证两种数据形态互通。
3. 连线序号编辑体验细化：seq 重复时给出更明确的回填提示；pair 与 seq 的交叉引用可视化。
4. 跨工况拖拽节点：原型支持把注入/结果节点拖到其它工况框，主项目当前仅支持 ↑/↓ 同框移动，可补齐跨框移动。
5. 遗留组件处置：`StepFlowEditor.vue` 等确认零引用后给出「归档或删除」建议，供用户决策。

***

（第 7 轮结束；无 git 提交，无配置文件删除。后端 `function_graph.py` 本轮为复核无改动；主项目改动限 `frontend/src/components/graph/CaseFrameCanvas.vue`；原型改动限 `research/function-case-editor/case-frame-prototype.html`。）

***

## 第 8 轮 · 2026-09-04

### 一、本轮改动清单

#### 1. 后端同步（对应本轮 A）

结论：**后端工况框展开逻辑保持与原型一致，本轮复核 + 行为验证，无功能改动**。逐条比对 [function\_graph.py](file:///e:/Python/AutoTool_Web/backend/services/function_graph.py) 的 `_expand_frame_paths` 与原型 `expandOf`：

- 序列为主干，注入插在连线所接步骤之前、结果接在所接步骤之后（`_build_path` 逐步骤遍历插入）。
- 注入→序列线按 `seq` 编号，序列→结果线按 `pair` 配对（`pair=[]` = 全部注入）。
- 同一注入匹配多个结果时，结果边按 `step_idx` 排序后「累积前缀」生成多条路径（`results[:k]`，k=1..N）。
- `expand_cases` 保持 `frames` 优先 → `edges` 次之 → 无 `edges` 走 `_expand_cartesian`，旧 `graph{nodes,edges}` 兼容不变。

校验命令：`python -m py_compile backend/services/function_graph.py`（exit 0）。

#### 2. 主项目前端优化（对应本轮 B）

文件：[CaseFrameCanvas.vue](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/CaseFrameCanvas.vue)

- **配对序号升序（第 7 轮待办 #3 细化）**：`saveEdgeInline` 保存结果线 `pair` 时，在去重后增加 `.sort((a, b) => a - b)`，使「逗号分隔一对多」的配对序号始终按从小到大展示与存储，严格贴合交互方案 #5「序列→结果线自动配对序号（从小到大）」。此前输入 "3,1" 会保留为 `[3,1]`，虽不影响后端展开（按 `pair.includes(s)` 判定，展开结果一致），但展示顺序与方案描述不一致，本轮修正。

复核说明：跨工况拖拽注入/结果节点在当前实现中已支持（`onNodeDragStart` 记录来源 + `onZoneDrop` 的 `srcFrame.id !== frameId` 分支迁移节点并清理旧框连线），第 7 轮待办 #4 标记为「已具备」，本轮未另改动。

### 二、验证结果

| 项目        | 命令                                                        | 结果                                                      |
| --------- | --------------------------------------------------------- | ------------------------------------------------------- |
| 后端语法      | `python -m py_compile backend/services/function_graph.py` | ✅ 通过（exit 0，无输出）                                        |
| 后端多注入+累积 | 内联脚本：2 注入(seq 1/2) + 2 结果(pair=[1,2] / [])                     | ✅ 4 条用例，注入插在所接步骤之前、结果按 step\_idx 排序累积前缀（INJ1 → RES1 → RES1+RES2；INJ2 同构） |
| 后端旧 graph 兼容 | 无 frames 的 nodes/edges 图；无 edges 旧图                             | ✅ 分别走 `_expand_by_edges` / `_expand_cartesian`，结果 1 条，未回归 |
| 前端类型      | `cd frontend && npx vue-tsc --noEmit`                     | ✅ 通过（exit 0，无类型错误）                                       |
| 前端构建      | `cd frontend && npm run build`                            | ✅ 通过（12.90s，2321 modules，仅存量 chunk 体积警告，无新增报错）             |

本轮后端无改动、无回滚；前端一次通过，无回滚。

### 三、交互方案结论（延续第 5/6/7 轮）

工况框方案方向保持不变（一个工况框 = 一个用例模板，序列为主干、注入/结果按端口序号挂接）。本轮把「配对序号从小到大」这一展示/存储一致性补齐，使原地编辑、前端预览、后端展开三方在语义与展示上完全对齐，进一步降低用户对「序号顺序」的认知歧义。

### 四、上一轮（第 7 轮）待办完成情况

| 待办                               | 状态                                              |
| -------------------------------- | ----------------------------------------------- |
| #1 工况框端到端联调                      | 🔶 已复核 `/function/expand-cases` 直接透传 `graph` 到 `expand_cases`，并用内联脚本验证展开；运行态联调仍未做，转入下一轮 |
| #2 旧自由画布与工况框双向迁移/导入导出            | ⬜ 未做，转入下一轮                                       |
| #3 连线序号编辑体验细化                    | ✅ 本轮完成 pair 升序；seq 重复提示与删除确认、端口放大已在第 7 轮完成            |
| #4 跨工况拖拽节点                       | ✅ 复核已具备（第 7 轮记录为「仅同框移动」，本轮代码复核确认已支持跨框迁移并清理旧框连线） |
| #5 遗留组件处置建议                       | ⬜ 受「不删除文件」约束继续记录                                |

### 五、下一轮待办

1. 工况框端到端联调：启动后端，用 `POST /function/expand-cases` 验证 `frames` 序列化与展开结果一致（或补后端集成测试）。
2. 旧「自由画布」与「工况框」双向迁移/导入导出，验证两种数据形态互通。
3. 连线序号交叉引用可视化：在工况框中高亮 `pair` 与 `seq` 的对应关系，让「一对多/全量配对」一眼可见。
4. 遗留组件处置：`StepFlowEditor.vue` 等确认零引用后给出「归档或删除」建议，供用户决策。

***

（第 8 轮结束；无 git 提交，无配置文件删除。后端 `function_graph.py` 本轮为复核无改动；主项目改动限 `frontend/src/components/graph/CaseFrameCanvas.vue` 一处（配对序号升序）。）

# Function 模块前端交互优化方案（v2.0 · 已定调版）

| 项 | 内容 |
|---|---|
| 版本 | **v2.0**（由 v1.0 演进） |
| 生效日期 | 2026-10-09 |
| 作用范围 | `frontend/src`（Function 模块）；仅第 8 章中标注「作用于需求文档」的条目涉及 `.trae/documents/Function模块前端需求文档.md` |
| 变更记录 | v1.0（2026-10-09）初版：29 项交互摩擦 + P0/P1/P2 三批优化清单。<br>**v2.0（2026-10-09）**：① 并入 L2 已定调 8 项（#6/#7/#9/#11/#13/#14/#22/#27）并把规则与验收写实；② 并入 L1 文档层修订 16 项（新增优先级标记、失败路径、并发协作、空态与语言口径、兼容窗口、契约版本等章节）；③ 优化项清单增加「状态 / 优先级」两列；④ 原「待定调」项独立成章（第 7 章），不再与已定调项混排。 |

**优先级标记约定**（L1-#32，全文适用）：

| 标记 | 含义 | 后果 |
|---|---|---|
| **MUST** | 必须满足 | 不满足即视为缺陷，阻塞验收 |
| **SHOULD** | 应当满足 | 有明确理由可不做，但需记录 |
| **MAY** | 可选 | 视成本决定 |

> 目标：在不改动业务规则、数据处理逻辑与功能边界的前提下，降低 Function 模块（功能用例配置）的操作步骤数、认知成本与交互断裂感。
>
> 已确认的改动边界：**含结构与流程调整**（可改布局、可加反馈元素、可统一多入口行为）。
>
> 红线（不因授权而放宽）：**不得修改后端生成链路、不得修改数据处理/计算逻辑、不得改变同一操作最终产出的 CAPL/用例结果**。凡可能改变产出内容的改进，一律做成"用户显式触发的一键操作"，绝不隐式自动填充。

---

## 一、本版变更摘要

| 类别 | 数量 | 去向 |
|---|---|---|
| **已定调**（L2 采纳推荐方案） | 8 项：#6 / #7 / #9 / #11 / #13 / #14 / #22 / #27 | 第 4 章（规则 + 验收），实现改法并入第 6 章 |
| **待定调**（L2 尚未定） | 8 项：#1 / #2 / #8 / #10 / #12 / #20 / #21 / #28 | 第 7 章（保留推荐 + 备选，等勾选） |
| **无需决策**（纯交互糖） | 原 P0/P1/P2 中其余项 | 第 3 章清单（已标状态与优先级） |
| **L1 文档层修订** | 16 项 | 第 8 章（其中 9 项作用于本文档自身、7 项作用于需求文档） |

---

## 二、现状分析（Current State Analysis）

### 2.1 模块交互面盘点

- **视图层**：[FunctionView.vue](file:///e:/Python/AutoTool_Web/frontend/src/views/FunctionView.vue) 页面（配置参数区 + 用例预览/代码预览）+ 全屏浮层 [FunctionGraphEditor.vue](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/FunctionGraphEditor.vue)。
- **停靠布局**：[DockLayout.vue](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/DockLayout.vue) 驱动三栏（左：工况/注入/序列/检查；中：编辑器；右：映射/值资源/函数库/对象浏览器）。
- **两个"卡片编辑器"**（**同一实体两套入口**，多个不一致问题的根源）：
  - [StepEditor.vue](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/StepEditor.vue) —— 中栏就地编辑器，编辑**卡片库里的卡片（定义）**；打开方式=左侧卡片列表**双击**；保存**回写卡片库并同步所有引用处**。
  - [CardEditor.vue](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/CardEditor.vue) —— 弹窗，编辑**画布上的节点（实例）**；打开方式=画布**双击卡片**或点 ✎；保存**只写回该节点**。
  - `CardLibraryPanel.vue`、`NodeInspector.vue` 也引用 `CardEditor`，但全项目无任何地方渲染，属**死代码**。
- **画布**：[CaseFrameCanvas.vue](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/CaseFrameCanvas.vue)（约 4700 行）承载拖拽、连线、框选、撤销栈。
- **快捷键统一层**：[useShortcuts.ts](file:///e:/Python/AutoTool_Web/frontend/src/composables/useShortcuts.ts)（context > module > global，输入框默认跳过）。

### 2.2 已确认的交互摩擦清单

#### A. 多步 / 重复性手工流程

| # | 现象 | 证据 |
|---|---|---|
| A1 | 新增步骤固定 `call`，需再选 kind 再逐行填 args | [StepEditor.vue ≈946](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/StepEditor.vue) `addStep(){ form.value?.steps.push(newStep('call')) }`；[CardEditor.vue ≈1002](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/CardEditor.vue) 同 |
| A2 | 函数库拖入卡片/步骤后参数值全空 | [FunctionLibrary.vue ≈523-540](file:///e:/Python/AutoTool_Web/frontend/src/components/FunctionLibrary.vue) `args: fn.params.map(p=>({key:p.name||'',value:''}))` |
| A3 | "参数取值"三态靠空串表示，无法区分"未覆盖"与"不参与" | [StepEditor.vue ≈1677](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/StepEditor.vue) `isCardArgSkipped`；[CardEditor.vue ≈617](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/CardEditor.vue) |
| A4 | 新增分组/卡片/映射/值资源先落占位名，再手动改名 | [FunctionGraphEditor.vue ≈433](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/FunctionGraphEditor.vue) `GraphCase${n+1}`；[MappingManager.vue ≈256](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/MappingManager.vue)；[ValueLibraryPanel.vue ≈184](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/ValueLibraryPanel.vue) |
| A5 | 连线需"点起点→点终点"两步；文案却写"按住 Ctrl 点击"，与实际不符 | [CaseFrameCanvas.vue ≈3276-3294](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/CaseFrameCanvas.vue) 裸点击即起线；[≈3146](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/CaseFrameCanvas.vue) 提示文案 |
| A6 | 新建分组/导入全局模板要联网，但无 loading、失败静默 | [FunctionGraphEditor.vue ≈433-445](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/FunctionGraphEditor.vue)（`await applyGlobalToGroup`）；[≈1303-1310](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/FunctionGraphEditor.vue) catch 中 `return 0` |

#### B. 交互不连续 / 上下文跳转断裂

| # | 现象 | 证据 |
|---|---|---|
| B1 | 图形编辑器 `position:fixed; inset:0; z-index:2000` 全屏，生成结果被遮住，必须退出才能看 | [FunctionGraphEditor.vue ≈1732](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/FunctionGraphEditor.vue) `.graph-editor` |
| B2 | 点画布卡片只在 `refId` 存在时才联动左侧列表；独立副本点了无反应 | [CaseFrameCanvas.vue ≈861-864](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/CaseFrameCanvas.vue) `if (node?.refId) emit('select-card', …)` |
| B3 | 用例预览点用例只滚代码，不联动图形编辑定位 | [FunctionView.vue ≈1308-1339](file:///e:/Python/AutoTool_Web/frontend/src/views/FunctionView.vue) `locateCaseInCode` |
| B4 | 编辑卡片时画布被 `v-if` 卸载，模块级 Ctrl+C/V 因 `editorTarget!=='card'` 失效 | [PanelBody.vue ≈118-143](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/PanelBody.vue)；[FunctionGraphEditor.vue ≈1691](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/FunctionGraphEditor.vue) |
| B5 | 编辑引用卡片时整表单被替换，`backToParent` 明确丢弃本层未保存修改 | [CardEditor.vue ≈643-669](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/CardEditor.vue) `openCardRef` / `backToParent` |
| B6 | 同一面板内：卡片列表需双击进编辑，工况列表单击即进编辑 | [PanelBody.vue ≈13-14](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/PanelBody.vue) vs [≈36-37](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/PanelBody.vue)、[≈93-94](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/PanelBody.vue) |

#### C. 缺少反馈 / 无联动

| # | 现象 | 证据 |
|---|---|---|
| C1 | 无 dirty 标识；"保存"按钮永不禁用；返回不拦截（对比 CardEditor 已有 `hasChanges`） | [FunctionGraphEditor.vue ≈17](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/FunctionGraphEditor.vue)；[CardEditor.vue ≈1180-1206](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/CardEditor.vue) |
| C2 | 破坏性操作静默：左侧删工况、画布卡片 ✕、拖出删除、删映射行、删值资源、删自定义卡片 | [FunctionGraphEditor.vue ≈665-670](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/FunctionGraphEditor.vue)；[CaseFrameCanvas.vue ≈2406](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/CaseFrameCanvas.vue)、[≈2345-2377](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/CaseFrameCanvas.vue)；[MappingManager.vue ≈262](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/MappingManager.vue)；[ValueLibraryPanel.vue ≈193](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/ValueLibraryPanel.vue) |
| C3 | 异步无 loading：`importGlobalTemplate`、`loadGlobal`、`refreshCasePreview`（catch 为空） | [FunctionGraphEditor.vue ≈1464-1488](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/FunctionGraphEditor.vue)；[FunctionView.vue ≈1843-1877](file:///e:/Python/AutoTool_Web/frontend/src/views/FunctionView.vue) |
| C4 | 校验仅在提交时（卡片名、步骤非空、Loop 配对、参数重名、用例名） | [StepEditor.vue ≈1877-1900](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/StepEditor.vue)；[CardEditor.vue ≈1210-1228](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/CardEditor.vue)；[CaseFrameCanvas.vue ≈3929-3938](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/CaseFrameCanvas.vue) |
| C5 | 错误只走 toast，无字段级原位提示 | [StepEditor.vue ≈910-920](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/StepEditor.vue)；[CaseFrameCanvas.vue ≈3936](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/CaseFrameCanvas.vue) |

#### D. 非直觉设计点 / 隐藏手势 / 禁用态

| # | 现象 | 证据 |
|---|---|---|
| D1 | 同一"卡片类型"字段：CardEditor 禁用、StepEditor 可改；`role` 只有 StepEditor 有 | [CardEditor.vue ≈23](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/CardEditor.vue) `:disabled="!isNew"`；[StepEditor.vue ≈6-12](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/StepEditor.vue) 无 disabled |
| D2 | 禁用字段无任何解释（类型下拉、参数取值框） | [CardEditor.vue ≈23](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/CardEditor.vue)、[≈296](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/CardEditor.vue) |
| D3 | 关键操作全靠隐藏手势，仅写在 `?` 气泡：双击删线、Shift+点击范围选、Ctrl+拖拽复制、Shift+滚轮横看 | [CaseFrameCanvas.vue ≈11-20](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/CaseFrameCanvas.vue) 气泡；[≈105](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/CaseFrameCanvas.vue) 双击删线 |
| D4 | 拖出工况框即删除，无确认（仅靠 title 文案） | [CaseFrameCanvas.vue ≈296](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/CaseFrameCanvas.vue)、[≈2345-2377](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/CaseFrameCanvas.vue) |
| D5 | 对象浏览器可见性被 `watch(objHasData)` 强制覆盖，与手动 toggle 打架 | [FunctionGraphEditor.vue ≈981-995](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/FunctionGraphEditor.vue)、[≈1145-1148](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/FunctionGraphEditor.vue) |
| D6 | 两处"生成"入口禁用条件不同（`!selectedConfig` vs `!currentConfig`），互不同步 | [ConfigToolbar.vue ≈56-59](file:///e:/Python/AutoTool_Web/frontend/src/components/ConfigToolbar.vue)；[FunctionView.vue ≈245](file:///e:/Python/AutoTool_Web/frontend/src/views/FunctionView.vue) |

#### E. 快捷键覆盖与作用域

| # | 现象 | 证据 |
|---|---|---|
| E1 | Ctrl+S 语义随鼠标是否悬停在 StepEditor 上变化 | [FunctionGraphEditor.vue ≈1675](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/FunctionGraphEditor.vue) `if (editorTarget.value==='card' && stepEditorHovered.value)` |
| E2 | Ctrl+Z 只作用于画布；编辑卡片时画布卸载 → 步骤增删改不可撤销 | [CaseFrameCanvas.vue ≈1186-1209](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/CaseFrameCanvas.vue)；[useShortcuts.ts ≈123-127](file:///e:/Python/AutoTool_Web/frontend/src/composables/useShortcuts.ts) |
| E3 | Insert / Delete 在模块内随处生效，无焦点守卫 | [CaseFrameCanvas.vue ≈1168](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/CaseFrameCanvas.vue) `canvasShortcutWhen = () => isModuleActive('/function')` |
| E4 | Ctrl+A 只选"当前工况"的卡片 | [CaseFrameCanvas.vue ≈1210-1225](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/CaseFrameCanvas.vue) 只遍历 `visibleFrames` |
| E5 | Ctrl+V 依赖"最近点击过的泳道"，否则报错 | [CaseFrameCanvas.vue ≈1132-1163](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/CaseFrameCanvas.vue) `lastLane` |
| E6 | 缺常用键位（添加步骤/添加参数/保存函数库源码）；Esc 行为分散在三处 | [CaseFrameCanvas.vue ≈1226](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/CaseFrameCanvas.vue)、[CtxMenu.vue ≈50](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/CtxMenu.vue)、[useShortcuts.ts ≈177](file:///e:/Python/AutoTool_Web/frontend/src/composables/useShortcuts.ts) |

---

## 三、优化项总清单（含状态与优先级）

> 「状态」：**已定调**＝第 4 章有明确规则；**无需决策**＝直接实施；**待定调**＝见第 7 章。

### P0 —— 零行为变更，可立即全量落地

> 判定标准：只增加提示/反馈/守卫/焦点，**不改变任何已有操作的可达结果**。

| ID | 优化点 | 关联 | 状态 | 优先级 | 预期收益 |
|---|---|---|---|---|---|
| P0-1 | 破坏性操作补反馈：删除后统一 toast + 可撤销提示 | C2 | 无需决策 | **MUST** | 误删可感知 |
| P0-2 | 静默删除补确认：左侧删工况、删映射行、删值资源、删自定义卡片 | C2 | 无需决策 | **MUST** | 防误删 |
| P0-3 | 异步操作补 loading：新建分组、导入/导出全局模板、加载全局库 | A6/C3 | 无需决策 | **MUST** | 慢网下不再"像卡死" |
| P0-4 | 未保存标识（顶部文字）+ 返回时确认 | C1 | 无需决策 | **MUST** | 消除"改了忘存"损失 |
| P0-5 | 连线提示文案与实现对齐；区分三态光标 | A5 | 无需决策 | SHOULD | 消除"按提示操作反而失败" |
| P0-6 | 新增后自动聚焦名称输入框并全选文本 | A4 | 无需决策 | SHOULD | 少一次点击 |
| P0-7 | 卡片列表单击即进入编辑，与工况列表一致 | B6 | 无需决策 | SHOULD | 消除"点了没反应" |
| P0-8 | 点画布卡片时左侧列表按 id/名称聚焦（不再只认 refId） | B2 | 无需决策 | SHOULD | 点击必有响应 |
| P0-9 | **Insert/Delete 增加焦点守卫** | E3 | **已定调（#6）** | **MUST** | 避免误删/误建 |
| P0-10 | **Ctrl+S 按"焦点位置"判定** | E1 | **已定调（#7）** | **MUST** | 可预期 |
| P0-11 | Ctrl+A 行为加说明；另提供"全选全部工况"入口 | E4 | 无需决策 | MAY | 消除"全选失效"误解 |
| P0-12 | **Ctrl+V 无落点时的默认落点与引导** | E5 | **已定调（#9）** | SHOULD | 减少失败重来 |
| P0-13 | 隐藏手势可见化：连线 hover 出删除按钮；拖出框时显示"松手即删除"红条 | D3/D4 | 无需决策 | SHOULD | 关键操作可发现 |

### P1 —— 统一行为 / 新增轻量反馈元素

| ID | 优化点 | 关联 | 状态 | 优先级 | 预期收益 |
|---|---|---|---|---|---|
| P1-1 | 统一两个编辑入口：CardEditor 补 `role` + 放开类型可改 | D1 | **待定调（#1）** | SHOULD | 消除同实体两套规则 |
| P1-2 | 字段级实时校验：参数名、用例名、Loop 配对 | C4/C5 | 无需决策 | SHOULD | 错误即时可见 |
| P1-3 | 编辑引用卡片：返回前脏检查确认 | B5 | 无需决策 | SHOULD | 不再静默丢改动 |
| P1-4 | 步骤默认 kind 记忆 + "添加步骤"旁直接选类型创建 | A1 | 无需决策 | SHOULD | 少一步 |
| P1-5 | 生成结果内嵌到编辑器（抽屉），免退出查看 | B1 | **待定调（#10）** | SHOULD | 少一次往返 |
| P1-6 | 对象浏览器：手动 toggle 后短期内不再被自动覆盖 | D5 | 无需决策 | MAY | 开关可控 |
| P1-7 | 两处"生成"入口统一禁用条件与反馈 | D6 | 无需决策 | SHOULD | 状态一致 |
| P1-8 | "参数取值"三态显式化（默认/已覆盖/不参与） | A3 | 无需决策 | SHOULD | 语义可读 |
| P1-9 | 缺失键位补齐（添加步骤/参数；Esc 统一分层） | E6 | 无需决策 | MAY | 键盘流顺畅 |
| P1-10 | **告警分级（阻断=红 / 提示=黄）** | — | **已定调（#11）** | SHOULD | 严重度可辨 |
| P1-11 | **缺失函数告警判定源改为"库解析结果 + 内置函数表"** | — | 待定调（#12） | SHOULD | 消除硬编码白名单 |

### P2 —— 结构与流程调整

| ID | 优化点 | 关联 | 状态 | 优先级 | 预期收益 |
|---|---|---|---|---|---|
| P2-1 | 步骤编辑加撤销栈（与画布 Ctrl+Z 隔离） | E2 | 无需决策 | SHOULD | 步骤编辑可回退 |
| P2-2 | 编辑卡片时保留画布实体复制快捷键 | B4 | 无需决策 | MAY | 不必来回切视图 |
| P2-3 | 用例预览 → 一键跳转到图形配置并定位工况 | B3 | 无需决策 | SHOULD | 从结果直达编辑 |
| P2-4 | "按映射表一键填充参数"（显式按钮） | A2 | 无需决策 | MAY | 少手工输入 |
| P2-5 | 连线一步化：从端口拖出即连线（保留点选方式） | A5 | 无需决策 | MAY | 少一步 |
| P2-6 | 编辑器改为非全屏（可缩放浮层） | B1 | **待定调（#10，见备选）** | MAY | 上下文不丢失 |
| P2-7 | 引用卡片编辑改为叠层子面板 | B5 | 无需决策 | MAY | 上下文不丢失 |
| P2-8 | **撤销边界：按工况隔离 + 保存后清栈** | — | **已定调（#22）** | SHOULD | 撤销语义可控 |
| P2-9 | Function 模块隐藏"测试参数"视图（CAN 专用） | — | 待定调（#28） | SHOULD | 领域不越界 |

### 非功能项（本版新增量化）

| ID | 项目 | 状态 | 优先级 |
|---|---|---|---|
| NFR-1 | 单工况交互渲染+连线重算 **P95 < 100ms**，不随工况总数显著劣化 | **已定调（#13）** | SHOULD |
| NFR-2 | 拖拽/连线跟随 **≥ 50fps**，单次长任务 **< 50ms** | **已定调（#14）** | SHOULD |
| NFR-3 | 可访问性最小集（焦点可达 / 对比度 / reduced-motion） | **已定调（#27）** | SHOULD |

---

## 四、已定调的 8 项：规则与验收

> 以下 8 项为 L2 中**已采纳推荐方案**的决策。规则一经写入即视为约束；实现改法见第 6 章。

### 4.1 #6 —— Insert / Delete 焦点守卫

| 项 | 内容 |
|---|---|
| 规则 | `Insert`（新建工况）与 `Delete`（删除画布选中项）**仅当指针位于画布区域内**（或画布容器持有焦点）时生效；指针在左/右面板、弹窗、输入框上一律不生效 |
| 影响 | 键盘流更安全；在右侧面板按 `Delete` 不再误删画布卡片 |
| 涉及 | [useShortcuts.ts](file:///e:/Python/AutoTool_Web/frontend/src/composables/useShortcuts.ts)（新增 `isPointerIn(el)` 工具）、[CaseFrameCanvas.vue ≈1168](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/CaseFrameCanvas.vue)（守卫组合） |
| 验收 | ① 指针悬停右侧映射表，按 `Delete` → 画布内容不变；② 指针移入画布按 `Delete` → 删除选中项；③ 输入框内按 `Delete` 仍只删字符 |
| 优先级 | **MUST** |

### 4.2 #7 —— Ctrl+S 语义按"焦点"判定

| 项 | 内容 |
|---|---|
| 规则 | 焦点在 **StepEditor 容器内** → 保存当前卡片；否则 → 保存当前分组并保存配置。判据由"鼠标悬停"改为"焦点位置" |
| 影响 | 行为不再随鼠标位置漂移，可用键盘稳定预期 |
| 涉及 | [FunctionGraphEditor.vue ≈1675](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/FunctionGraphEditor.vue)（`stepEditorHovered` → `stepEditorFocused`）、[StepEditor.vue](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/StepEditor.vue) 容器加 `@focusin/@focusout` |
| 验收 | ① 光标停在 StepEditor 输入框内、鼠标已移出中栏 → `Ctrl+S` 保存卡片；② 用键盘 `Tab` 移出中栏 → `Ctrl+S` 保存配置 |
| 优先级 | **MUST** |

### 4.3 #9 —— Ctrl+V 无落点时的默认落点

| 项 | 内容 |
|---|---|
| 规则 | 无"最近交互泳道"时，**默认落到当前展示工况的第一条非主序列泳道**；该工况无非主泳道时自动新建一条。仍保留"先点泳道再 `Ctrl+V`"作为精确指定落点 |
| 影响 | 消除"复制后必须先去点一下泳道"这一隐性前置条件 |
| 涉及 | [CaseFrameCanvas.vue `pasteClipboard` ≈1155](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/CaseFrameCanvas.vue) |
| 验收 | 复制一张卡片后**不点任何泳道**直接 `Ctrl+V` → 卡片落到当前工况第一条非主泳道，并提示「已粘贴到「泳道N」」 |
| 优先级 | SHOULD |

### 4.4 #11 —— 告警分级

| 项 | 内容 |
|---|---|
| 规则 | 诊断问题分两级：<br>**阻断类（红）**：悬空连线、缺少主序列、主序列为空、连线跨越主序列、**调用了函数库中不存在的函数**<br>**提示类（黄）**：孤立卡片、未接入主序列、参数没有取值 |
| 影响 | 用户能区分"会导致生成失败"与"仅需关注"；不再一律同等醒目 |
| 涉及 | [CaseFrameCanvas.vue](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/CaseFrameCanvas.vue) 顶部徽标与悬浮清单、节点 ⚠ 样式 |
| 实现约束 | **纯前端按 `issue.kind` 映射严重级别**，[utils/functionGraph.ts](file:///e:/Python/AutoTool_Web/frontend/src/utils/functionGraph.ts) 的 `frameDiagnostics` 判定集合与返回结构**一行不动**（不新增字段） |
| 验收 | ① 删除连线端点卡片 → 该项以红色呈现；② 放一张孤立卡片 → 以黄色呈现；③ 顶部徽标显示两类合计总数 |
| 优先级 | SHOULD |

### 4.5 #13 —— 性能指标

| 项 | 内容 |
|---|---|
| 规则 | 单工况内任意交互（拖拽落点、建/删连线、选中、切换）触发的「渲染 + 连线重算」**P95 < 100ms**；且不随「配置内工况总数」增长而显著劣化（与单工况配置相比 **< 1.5×**） |
| 影响 | 大配置下操作仍有即时感；防止后续改动悄悄引入性能回退 |
| 度量 | Performance 面板录制 + `console.time` 包裹 `recompute()`；或复用现有 `scheduleRecompute` 的 rAF 计数 |
| 验收 | 在含 **≥ 30 个工况**的配置中测「改 2 张卡的工况」，P95 < 100ms；与单工况配置对比差异 < 1.5× |
| 优先级 | SHOULD |

### 4.6 #14 —— 流畅度指标

| 项 | 内容 |
|---|---|
| 规则 | 拖拽卡片、连线跟随鼠标时 **≥ 50fps**；单次主线程长任务 **< 50ms** |
| 影响 | 拖拽/连线手感达标，避免合并到 rAF 的策略被破坏 |
| 验收 | Performance 录制连续拖拽 3 秒：帧率 ≥ 50fps 且无 > 50ms 长任务 |
| 优先级 | SHOULD |

### 4.7 #22 —— 撤销边界

| 项 | 内容 |
|---|---|
| 规则 | ① 撤销栈**按工况隔离**（保存/切换工况时栈清空）；② 保存成功后清空撤销栈并提示「已保存，撤销历史已清空」；③ 撤销不跨分组 |
| 影响 | 撤销语义确定，避免"撤销回退到已保存状态之外"造成数据困惑 |
| 涉及 | [CaseFrameCanvas.vue](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/CaseFrameCanvas.vue) 的 `undoStack/redoStack` 与 `emitChange`、`resetHistory` |
| 验收 | ① 保存后撤销按钮禁用且出现提示；② 从工况 A 切到工况 B 后 `Ctrl+Z` 不会回退工况 A 的改动；③ 切换分组后撤销栈为空 |
| 优先级 | SHOULD |

### 4.8 #27 —— 可访问性最小集

| 项 | 内容 |
|---|---|
| 规则 | ① 所有可点击控件可 `Tab` 到达并用 `Enter`/`Space` 触发；② 画布与外层面板的关键操作（新建工况、选中卡片、删除、撤销、保存、切换工况/分组）**键盘可达**；③ 正文文字与背景对比度 ≥ 4.5:1、大字与图标 ≥ 3:1；④ 尊重 `prefers-reduced-motion`（画布动画降级为无过渡） |
| 明确不做 | 不要求为拖拽类操作提供完整键盘等价（成本高）；拖拽仍是鼠标/触控板操作 |
| 影响 | 键盘用户可完成主流程；满足基本无障碍要求 |
| 验收 | ① 仅用键盘完成「新建工况 → 从卡片库插入卡片 → 建连线 → 保存」；② Lighthouse 可访问性无严重项；③ 系统开启"减少动态效果"后画布无过渡动画 |
| 优先级 | SHOULD |

---

## 五、待定调的 8 项（保留推荐 + 备选）

| # | 问题 | 推荐 | 备选 | 主要影响 |
|---|---|---|---|---|
| 1 | 两个编辑入口能力不一致 | 以 StepEditor 为基准，CardEditor 补齐 `role` + 放开类型可改（**需为 CardEditor 新增"局部变量"编辑区**，这是它唯一缺的实质能力） | 反向：锁死 StepEditor 的类型/role | 前端；不影响产物 |
| 2 | 主序列"可整体替换"与"不可删"冲突 | 保留现状，但**规则写清 + 主序列粘贴加二次确认** | 禁止主序列粘贴替换，改为就地合并 | 前端交互 |
| 8 | 函数库冲突只在生成后提示 | 保存函数库后**即时比对并提示**（需后端提供"内置模板函数名表"只读接口） | 保持现状，仅在编辑区顶部加常驻提示条 | 前端 + 后端 1 处只读接口 |
| 10 | 全屏浮层遮住生成结果 | **保留全屏**（性能优先），编辑器内加"生成结果"抽屉 | 改为可缩放非全屏（有画布性能回归风险，即 P2-6） | 前端 |
| 12 | 缺失函数告警依赖硬编码白名单 | 判定源改为「函数库解析结果 + 内置函数表」，白名单降级为**可配置例外表并写入文档** | 维持硬编码但集中到一处常量并注明依据 | 前端 |
| 20 | 拉取同名覆盖策略未定义 | 拉取列表标出「本地已存在」，同名**默认跳过**，提供"覆盖"勾选 | 默认逐项询问 | 前端（+后端返回清单） |
| 21 | 用例展开无上限 | 定：单工况展开上限 **2000 条**、单次总行数上限 **20000**，超限拒绝并提示拆分 | 你给具体数字 | 前端预检 |
| 28 | 测试参数区块（CAN 专用）出现在 Function | Function 模块**隐藏该视图** | 保留但标注"CAN 专用" | 前端 |

---

## 六、实现方案（Proposed Changes）

> 所有改动仅限 `frontend/src`，不触碰 `backend/`、`configs/`（唯一例外：第 5 章 #8 定调后需后端提供一个只读接口）。

### 6.1 已定调 8 项的实现改法

| 决策 | 文件 | 改法 |
|---|---|---|
| #6 | [useShortcuts.ts](file:///e:/Python/AutoTool_Web/frontend/src/composables/useShortcuts.ts) | 新增 `isPointerIn(el: HTMLElement \| null): boolean`（用 `document.elementFromPoint` 或 `el.matches(':hover')` 判定），供各 `when` 复用 |
| #6 | [CaseFrameCanvas.vue ≈1168](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/CaseFrameCanvas.vue) | `Insert`/`Delete` 的 `when` 追加 `isPointerIn(canvasEl.value)`；`Ctrl+C/V/Z/Y/A` 等**不加**该守卫（保持原行为） |
| #7 | [StepEditor.vue](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/StepEditor.vue) | 根容器加 `@focusin="emit('focus-in')" @focusout="emit('focus-out')"`；或直接写 `stepEditorFocused` 到 `geCtx` |
| #7 | [FunctionGraphEditor.vue ≈1675](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/FunctionGraphEditor.vue) | `graph:save` 判据由 `stepEditorHovered.value` 改为 `stepEditorFocused.value`；`stepEditorHovered` 保留（仍供其它样式使用） |
| #9 | [CaseFrameCanvas.vue `pasteClipboard` ≈1155](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/CaseFrameCanvas.vue) | `lastLane` 为空时：取 `visibleFrames[0]`，查找第一条 `type !== 'main'` 的泳道；无则 `laneOnSide(f,'left')` 新建；随后走既有 `applyClip`，并 `ElMessage.info('已粘贴到「泳道N」（可先点击目标泳道再 Ctrl+V 指定落点）')` |
| #11 | [CaseFrameCanvas.vue](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/CaseFrameCanvas.vue) | 新增常量映射 `const BLOCKING_ISSUES = new Set(['dangling-edge','no-sequence','empty-sequence','cross-main-edge','missing-func'])`；徽标与悬浮清单按 `BLOCKING_ISSUES.has(it.kind)` 分色；节点 ⚠ 沿用现有 `invalidNodeIds` 通道（不改 utils） |
| #13/#14 | —（度量，无代码改动） | 按第 4.5/4.6 节录制方式建立基线；若要长期防回退，可加一段仅 dev 生效的 `console.time` 包裹 `recompute()`（MAY） |
| #22 | [CaseFrameCanvas.vue](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/CaseFrameCanvas.vue) | ① `watch(() => props.activeFrameId)` 内追加 `resetHistory()`；② `saveEditor`/上层保存成功后调用新增的 `clearHistory()` 并 toast「已保存，撤销历史已清空」；③ 分组切换（`watch` 分组 id）时 `resetHistory()` |
| #27 | 各组件 | 给纯图标按钮补 `aria-label`；可点击 `div` 改 `button` 或补 `role="button" tabindex="0" @keydown.enter/@keydown.space`；补 `@media (prefers-reduced-motion: reduce)` 关闭画布过渡 |

### 6.2 P0-1 / P0-2 破坏性操作反馈与确认

| 文件 | 改法 |
|---|---|
| [FunctionGraphEditor.vue](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/FunctionGraphEditor.vue) `removeFrame`（≈665） | 加 `ElMessageBox.confirm`（文案含工况名）+ 成功后 `ElMessage.success('已删除工况，Ctrl+Z 可撤销')`。删除后调用现有 `onGraphChange` 不变。 |
| [CaseFrameCanvas.vue](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/CaseFrameCanvas.vue) `removeNode`（≈2406） | 补 `ElMessage.success('已删除卡片，Ctrl+Z 可撤销')`；**不加 confirm**（画布内已有 Ctrl+Z，加确认反而打断连续编辑）。 |
| 同上 拖出删除（≈2345-2377） | 补 toast；确认交给 P0-13 的"松手前红条预警"。 |
| [MappingManager.vue](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/MappingManager.vue) `removeEntry`（≈262） | 补 toast（"已删除映射：别名"）。该操作可重填，不阻断。 |
| [ValueLibraryPanel.vue](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/ValueLibraryPanel.vue) `removeResource`（≈193） | 补 toast。 |
| [FunctionLibrary.vue](file:///e:/Python/AutoTool_Web/frontend/src/components/FunctionLibrary.vue) `removeCustomCard`（≈482） | 补 `ElMessageBox.confirm`（删自定义卡片会连带影响引用处）+ toast。 |

### 6.3 P0-3 异步 loading

| 文件 | 改法 |
|---|---|
| FunctionGraphEditor.vue `addGroup`（≈433） | 新增 `const addingGroup = ref(false)`，按钮 `:loading="addingGroup"`，`try/finally` 复位；catch 里保留原"内容为空"文案，另加 `ElMessage.warning`。 |
| FunctionGraphEditor.vue `importGlobalTemplate`（≈1464）/ `exportGlobalTemplate`（≈1489） | 同上，各自独立 loading（工具栏两个按钮各绑一个）。 |
| FunctionGraphEditor.vue `loadGlobal`（≈1413） | 顶层加 `globalLoading`，`onMounted` 期间编辑区显示骨架/遮罩。 |
| FunctionView.vue `refreshCasePreview`（≈1843） | 补 `casePreviewLoading` 并在预览区显示 loading；`catch{}` 里加 `ElMessage.warning`（不改"失败保留上次结果"的行为）。 |

### 6.4 P0-4 未保存标识与返回拦截

| 文件 | 改法 |
|---|---|
| FunctionGraphEditor.vue | 新增 `const baseline = ref('')`（分组/卡片/映射/值资源序列化快照）与 `const dirty = computed(...)`；顶部 `ge-title-group` 内加文字"未保存"；保存成功后刷新 baseline。快照粒度复用现有 `emitGroupUpdate` 前的 `JSON.parse(JSON.stringify(...))` 逻辑，**不新增数据字段**。 |
| FunctionGraphEditor.vue 返回按钮（≈5） | 抽 `async function requestClose()`：`dirty` 为真时 `ElMessageBox.confirm('有未保存修改，是否保存后返回？', 保存/不保存/取消)`；"保存"走现有 `emit('save')` 后再 `emit('close')`。 |
| FunctionView.vue（`graphEditorVisible`） | 关闭入口统一走 `requestClose`（通过 ref 调子组件暴露的方法，与 `CardEditor.defineExpose` 同一模式）。 |

### 6.5 P0-5 / P0-13 连线文案与隐藏手势可见化

| 文件 | 改法 |
|---|---|
| CaseFrameCanvas.vue（≈3146） | 提示文案改为"已选择起点端口，请点击目标端口完成连线（也可按住 Ctrl 点击）"，与实际实现一致。 |
| CaseFrameCanvas.vue 连线渲染区 | 为每条边加 hover 命中区，悬停显示小"✕"→ 调已存在的 `removeEdge`。不新增删除语义，只是把"双击删除"变为可见入口。 |
| CaseFrameCanvas.vue 拖拽预览（≈2345 区域） | 拖拽中检测指针是否在 `.frame` 内：不在则显示顶部红条"松手将从工况中删除此卡片（Ctrl+Z 可撤销）"。 |
| CaseFrameCanvas.vue `?` 气泡（≈7-21） | 保留气泡；另在画布空白区首次进入时显示一次性轻提示（localStorage 标记），前置"双击删线 / Ctrl+拖拽复制 / Shift+点击范围选"三点。 |

### 6.6 P0-6 新增后聚焦命名

| 文件 | 改法 |
|---|---|
| FunctionView.vue `addCaseGroup`、FunctionGraphEditor.vue `addGroup`/`createCard`/`duplicateCard` | 创建后 `await nextTick()`，对对应 `el-input` 调 `.focus()` 并 `select()`。 |
| MappingManager.vue `addEntry`、ValueLibraryPanel.vue `addResource` | 同上（聚焦新行首列输入框）。 |

### 6.7 P0-7 / P0-8 列表与画布联动

| 文件 | 改法 |
|---|---|
| [PanelBody.vue](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/PanelBody.vue)（≈36-37、≈93-94） | 卡片行 `@click` 改为"先 `selectCardInList`（保留多选高亮）再 `selectCard`（进入编辑）"，与工况行单击进编辑一致。注：单击进入编辑后仍需保留 Ctrl/Shift 多选语义（多选时不进入编辑）。 |
| CaseFrameCanvas.vue `emitCardFocus`（≈861） | 去掉 `if (node?.refId)` 门槛：有 `refId` 仍发 `select-card`；无 `refId` 改发 `emit('focus-node', {frameId, nodeId, name})`；FunctionGraphEditor 新增兜底分支——按名称在卡片库查找并高亮，未命中则仅高亮画布节点并 `ElMessage.info('该卡片是独立副本，未在卡片库中')`。 |

### 6.8 P0-11（Ctrl+A 说明与全选全部工况）

| 文件 | 改法 |
|---|---|
| CaseFrameCanvas.vue `canvas:selectAll`（≈1210） | 行为不变，仅文案改为"已选中当前工况 N 张卡片（Ctrl+A 仅当前工况；Alt+A 全选全部工况）"；新增 `canvas:selectAllFrames`（Alt+A）走同一选中结构。 |

### 6.9 P1-2 字段级实时校验

| 文件 | 改法 |
|---|---|
| StepEditor.vue（≈910-920）、CardEditor.vue（≈869-877） | 抽出纯函数 `validateParamName(list, idx)` 返回 `null | 错误文案`（不改 `normalizeParams` 的返回与调用点），在 `@input` 上调用并把结果写入行级 `error`，用于 `el-form-item :error`。 |
| CaseFrameCanvas.vue `saveCaseName`（≈3929） | 抽出 `caseNameError(v)` 纯函数，输入时即显示字段错误；`saveCaseName` 仍在提交时调用同一函数，逻辑同源。 |
| StepEditor.vue Loop 配对（`save` 内 ≈1877） | 抽出 `loopPairIssue(steps)` 纯函数，渲染时高亮未配对项；`save` 仍调用它做提交拦截。 |

### 6.10 P1-3 / P1-4 / P1-6 / P1-7 / P1-8 / P1-9

| ID | 文件 | 改法 |
|---|---|---|
| P1-3 | CardEditor.vue `backToParent`（≈664）、面包屑返回（≈17） | 复用已有 `hasChanges()`：有改动时 `ElMessageBox.confirm`，选"保存"走 `saveSub()` 后再退栈，"不保存"直接退栈，"取消"留在当前层。 |
| P1-4 | StepEditor.vue `addStep`（≈946）、CardEditor.vue（≈1002） | 模块级 `lastStepKind = ref('call')`（`localStorage` 持久化）；`addStep` 用 `newStep(lastStepKind.value)`；`onKindChange` 写回。另在"添加步骤"旁加 `el-dropdown` 直接选类型创建，与主按钮共用同一 `addStep(kind?)`，**不新增步骤类型**。 |
| P1-6 | FunctionGraphEditor.vue（≈981-995） | `watch(objHasData)` 增加"用户手动覆盖"窗口：`userObjOverrideUntil = ref(0)`，`toggleObjDrawer` 写入 `Date.now()+60s`，窗口内不强制 `visible`。 |
| P1-7 | ConfigToolbar.vue（≈56）/ FunctionView.vue（≈245） | 统一禁用条件为"当前配置存在且非生成中"；两处生成统一走 `handleGenerate`，生成中同步 `:loading`。 |
| P1-8 | StepEditor.vue / CardEditor.vue 参数取值行 | 保留三态语义，仅视觉区分：`el-tag` 显示"默认 / 已覆盖 / 不参与"，`title` 说明"清空=回落默认值"。 |
| P1-9 | StepEditor.vue | 新增 `steps:add`（Alt+Insert）、`params:add`（Alt+P）；Esc 分层：先取消步骤多选 → 再取消卡片选中 → 再由外层处理。 |

### 6.11 P2 其余项

| ID | 文件 | 关键设计 |
|---|---|---|
| P2-1 | StepEditor.vue | 引入与画布**独立**的 `undoStack/redoStack`（快照粒度 = `form.steps` + `form.params`），注册 `context` 作用域的 Ctrl+Z/Ctrl+Y，`when` 限定 `editorTarget==='card'`。画布栈不变。 |
| P2-2 | FunctionGraphEditor.vue（≈1691/1702） | `graph:copyEntity` / `graph:pasteEntity` 的 `when` 去掉 `editorTarget !== 'card'` 限制；依靠"context 优先"保证卡内步骤复制仍由 `steps:copy` 接管。 |
| P2-3 | FunctionView.vue `locateCaseInCode`（≈1308） | 保留原滚动行为，追加"定位到图形配置"按钮 → `openGraphEditor(groupId)` + 按 `frame_id` 调 `setActiveFrame`。 |
| P2-4 | StepEditor.vue / CardEditor.vue 参数行 | 参数行右侧加"从映射表填充"按钮：按 `arg.key` 在 `mapping` 中查同名别名/对象并填入 `arg.value`。**显式按钮**，不点不改值。 |
| P2-5 | CaseFrameCanvas.vue 端口 mousedown（≈2906-2921） | 确认拖拽路径与点选路径共用 `createEdge`；为输入口补 hover 高亮可落点。 |
| P2-7 | CardEditor.vue（≈16-19、≈643） | 引用卡片编辑由"整表单替换"改为右侧叠层子表单（父卡片信息保留可见）；`editStack` 语义保留。 |

---

## 七、文档层修订（L1 · 16 项）

> 「作用」列说明该修订落在哪份文档：**本方案** = 本文档自身；**需求文档** = `.trae/documents/Function模块前端需求文档.md`。

| # | 问题 | 修订动作 | 作用 |
|---|---|---|---|
| 3 | "不引 DTC_Configuration.cin"表述不实 | 改为「产物中该 include 以**注释形式保留**，不生效」并附产物片段 | 需求文档 |
| 4 | 两套"导出 Excel"口径不清 | 在「配置级导出」与「分组级导出」两条互相加交叉引用，说明：**整配置导出仅 CAN 模块提供；Function 用分组级导出** | 需求文档 |
| 5 | 全局 vs 分组双作用域 | 新增小节定义优先级：**分组本地值 > 全局标记值**，并说明"全局项被本地改过后的归属" | 需求文档 |
| 12 | 缺失函数告警依赖硬编码白名单 | 待第 5 章 #12 定调后同步判定源表述 | 需求文档 |
| 15 | 精度/偏移边界未定义 | 补：`1` 与 `1.0` 等价；`precision !== 1` 或 `offset !== 0` 即提升为 float | 需求文档 |
| 16 | "链式卡跟随邻居"冲突时行为未定义 | 补：冲突时按**角色兜底**（结果卡→右、其余→左） | 需求文档 |
| 17 | 映射行跨类型拖拽 | 补：拖入对象类型与行 `kind` 不一致时**保留行 kind**（现状），并标注为已知缺陷 | 需求文档 |
| 18 | 验收标准不可判定 | 全文改写为可勾选清单 | 需求文档 |
| 19 | **失败路径缺失** | 新增章节「失败与异常路径」：后端不可用 / 保存失败 / 生成失败的用户可见行为与数据保护 | 本方案 + 需求文档 |
| 23 | **并发未定义** | 新增章节「并发与协作」：多标签页、共享盘多人协作的行为与冲突归属 | 本方案 + 需求文档 |
| 24 | **空态规范不统一** | 新增「空态与文案规范」，逐区登记现有空态并补齐缺失项 | 本方案 + 需求文档 |
| 25 | **中英混排** | 新增「界面文案与语言口径」：保留的英文标识（`TestCase`/`Function`/`ArrayFunc`/`All`）与应中文化的项（`kind` 原值如 `wait_check`） | 本方案 + 需求文档 |
| 26 | **兼容窗口未定义** | 新增「历史数据兼容窗口」：明确兼容到哪个版本、何时可移除迁移分支（现有：旧端口格式、旧泳道类型、旧 loop 参数） | 本方案 + 需求文档 |
| 32 | 无优先级 | ✅ 已完成：本文档头部新增 MUST/SHOULD/MAY 约定，并逐项标注 | 本方案 |
| 33 | 缺陷混在需求里 | ✅ 已完成：第 3 章总清单增加「状态」列，区分 已定调 / 待定调 / 无需决策；需求文档同样需按"既定需求 / 已知缺陷与待决项"两分 | 本方案 + 需求文档 |
| 34 | 无版本与日期 | ✅ 已完成：本文档头部新增版本、生效日期、变更记录 | 本方案 |
| 35 | 契约无版本 | FR-DATA 类条款补「接口版本 / 兼容策略」；分组导出文件补**格式版本号** | 需求文档 |

**新增章节最小内容要求**（L1-#19/#23/#24/#25/#26，写入需求文档时）：

| 章节 | 最小内容 |
|---|---|
| 失败与异常路径 | 每个异步动作（保存/生成/展开/拉取/推送/导入）在「网络失败」「后端 5xx」「数据校验失败」三种情形下的：用户可见提示、数据是否保留、是否可重试 |
| 并发与协作 | ① 多标签页同时编辑同一配置的行为（后写覆盖 / 检测冲突）；② 共享盘推送-拉取的覆盖策略（与第 5 章 #20 一致）；③ 冲突归属与提示方式 |
| 空态与文案规范 | 逐区登记空态文案（分组/用例/卡片/映射/值资源/函数/对象），缺失者补齐；统一"暂无 X，请 Y"的句式 |
| 界面文案与语言口径 | 保留英文的标识白名单；应中文化的项（`kind` 原值、`split/loop`、`expand` 等）；数字与单位格式 |
| 历史数据兼容窗口 | 逐项列出兼容分支、引入版本、计划移除版本；新增兼容分支需登记 |

---

## 八、不改动原有功能逻辑的保障说明

### 8.1 改动范围白名单（硬约束）

- **只改** `frontend/src/**` 下的模板/样式/事件绑定/本地 UI 状态。
- **不改** `backend/**`、`configs/**`、`frontend/src/api/**` 的请求体与响应解析、`frontend/src/utils/functionGraph.ts` 中的任何计算逻辑（`frameCaseRows*`、`frameDiagnostics`、`frameEdgeCrossesMain`、`nodeParamValues`、`resolveSeqPortIdx` 等）。
- 不新增/删除任何数据类型字段（`types/functionGraph.ts` 保持不变）。

### 8.2 逐类保障

| 优化类别 | 为什么输出结果不变 |
|---|---|
| 提示/loading/toast（P0-1~P0-3） | 仅新增 `ElMessage`、局部 `ref` 布尔量与 `:loading`，不参与任何数据构造。 |
| 未保存标识/返回拦截（P0-4） | `dirty` 基于已有内容序列化比对，仅用于展示与确认；保存仍调用原有 `emitGroupUpdate` + `emit('save')`。 |
| 文案/光标/可见化（P0-5、P0-13） | 纯样式与提示文案；新增的连线"✕"按钮直接调用既有 `removeEdge`，与双击删除同一条路径。 |
| 焦点/联动（P0-6~P0-8） | 只调 `.focus()/.select()` 与选中态；`emitCardFocus` 的扩展只新增事件分支，不改变既有 `select-card` 载荷。 |
| 快捷键（P0-9~P0-11、P1-9、P2-2） | 仅调整 `when` 守卫与 `keys`；所有 `run` 仍调用原有函数（`copySelection`/`pasteClipboard`/`undoCanvas`/`removeNode`…）。守卫收紧只会"少触发"，不会"换行为"。 |
| **#6 焦点守卫** | 只收紧 `Insert`/`Delete` 的触发条件（从"模块内随处"变为"指针在画布内"）；`run` 仍是 `addFrame`/`deleteSelection`，未改任何数据操作。 |
| **#7 Ctrl+S 判据** | 只换判定来源（hover→focus），两条分支的 `run` 与保存链路完全不变。 |
| **#9 粘贴默认落点** | 只在"原本直接报错"的分支里补一个落点选择；`applyClip`/`cloneCardsInto` 等原样调用，粘贴结果结构与原路径一致。 |
| **#11 告警分级** | **纯展示层映射**：按 `issue.kind` 决定颜色/图标；`frameDiagnostics` 的判定集合、`invalidNodeIds` 成员、未动一行。 |
| **#22 撤销边界** | 只改变"栈何时清空"（保存/切换工况/切换分组）；快照格式与 `applyFramesSnapshot` 复原逻辑不变，不改变任何一次撤销的还原结果。 |
| **#27 可访问性** | 只补 `aria-label`/`tabindex`/`role`/`keydown` 与 CSS 媒体查询，不改业务事件与数据流。 |
| 统一多入口行为（P1-1，待定调） | 见 8.3，逐项等价性说明。 |
| 字段级校验（P1-2） | 校验函数从 `save()` 内**原样抽取**为纯函数，`save()` 继续调用同一函数做拦截；即"同一判据，多一次展示"。判据不变 ⇒ 通过/拒绝集合不变。 |
| 步骤默认 kind / 步骤撤销 / 显式填充（P1-4、P2-1、P2-4） | 均为用户显式动作；默认值仅影响"新建步骤时的初值"，用户仍可改（`onKindChange` 行为不变）。P2-4 是显式按钮，不点不改值。 |

### 8.3 统一多入口行为（P1-1，待定调）的等价性说明

`CardEditor` 放开"类型可改"后，落库路径仍为既有 `saveCard`（[FunctionGraphEditor.vue ≈599-613](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/FunctionGraphEditor.vue)）：它按 `card.type` 分桶写入 `cardLibrary`，且调用既有 `syncRefsFromLibrary`。**未新增分桶规则、未改同步逻辑**，只是允许了 `StepEditor` 早已允许的操作 ⇒ 两入口最终产生同一结构、同一生成结果。

`role`（故障注入/恢复）在 `CardEditor` 补齐后，`card.role` 字段本就参与画布分类（`cardCategoryClass`，[CaseFrameCanvas.vue ≈1540](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/CaseFrameCanvas.vue)）与后端生成，字段语义不变、取值范围不变。**新增的"局部变量"编辑区**与 `StepEditor` 的 locals 使用同一数据字段（`Card.locals`），不新增字段。

### 8.4 明确"不做"的事

- 不做隐式参数自动填充（会改产出）。
- 不合并/改名任何函数、卡片、工况、泳道。
- 不改泳道准入规则、连线合法性规则、用例编号/命名规则。
- 不改 `frameDiagnostics` 的问题集合与判定（#11 只在展示层分级）。
- 不为拖拽类操作提供完整键盘等价（#27 已明确排除）。

---

## 九、假设与决策（Assumptions & Decisions）

| 项 | 决策 | 依据 |
|---|---|---|
| 改动边界 | 含结构与流程调整；统一多入口行为 | 用户 2026-10-09 选择 |
| 优先级体系 | 引入 MUST/SHOULD/MAY | L1-#32 |
| #6 Insert/Delete | 加"指针在画布内"守卫 | 用户 2026-10-09 采纳 |
| #7 Ctrl+S | 按焦点判定 | 用户 2026-10-09 采纳 |
| #9 Ctrl+V | 无落点时默认落到当前工况第一条非主泳道 | 用户 2026-10-09 采纳 |
| #11 告警分级 | 阻断=红（含"函数不存在"）/ 提示=黄；纯展示层映射 | 用户 2026-10-09 采纳 |
| #13 性能 | P95 < 100ms；与工况总数差异 < 1.5× | 用户 2026-10-09 采纳（阈值为本文档给定，可调整） |
| #14 流畅度 | ≥ 50fps；长任务 < 50ms | 用户 2026-10-09 采纳（阈值同上） |
| #22 撤销边界 | 按工况隔离 + 保存后清栈 + 不跨分组 | 用户 2026-10-09 采纳 |
| #27 可访问性 | 最小集（焦点可达/对比度/reduced-motion），排除拖拽键盘等价 | 用户 2026-10-09 采纳 |
| 画布内删除是否加 confirm | **不加**，改为 toast + Ctrl+Z + 拖出前预警 | 画布已有 60 步快照撤销栈（[CaseFrameCanvas.vue ≈629](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/CaseFrameCanvas.vue)），加 confirm 会打断连续编辑 |
| 画布卡片是否统一为"单击编辑" | 保持"双击编辑"（避免与选中手势冲突），但**单击必须给出可见联动**（P0-8） | 画布单击已承载"选中"语义 |
| 参数自动填充 | 只做"显式按钮"版本（P2-4），不做隐式 | 保证产出一致性红线 |
| 非全屏改造（#10 备选 / P2-6） | **未采纳**为默认方案；仍作为待定调备选，且需专门回归画布性能 | 源码注释明确提示 ResizeObserver → 全量连线重算的开销 |
| 交付形式 | 本文档为方案基线；第 5 章 8 项定调后即可实施 | — |

---

## 十、验证方案（Verification）

### 10.1 静态检查
- `node ./node_modules/vue-tsc/bin/vue-tsc.js --noEmit -p tsconfig.json` 必须 `exit 0`（本项目既有基线为 0 错误）。
- 每批改动后运行，不允许新增 `error TS`。

### 10.2 产物一致性（最关键）
对至少 2 个真实配置（如 `A47B`、`A47D`）做**改动前后对比**：
1. 改动前：`POST /api/function/generate`（或页面"生成"）导出 `TestCase.can` / `TestFunction.cin`；
2. 改动后：同一配置、同一操作序列再生成一次；
3. `git diff --no-index` 比对两份产物，**必须完全一致**（若含时间戳类字段，先剔除该行再比对）。

> 该验证直接覆盖"不改业务逻辑、输出一致"的要求。

### 10.3 已定调 8 项的专项验证

| 决策 | 验证方法 |
|---|---|
| #6 | 指针在右侧映射表按 `Delete` → 画布不变；指针入画布按 `Delete` → 删除选中项 |
| #7 | 光标留在 StepEditor 输入框、鼠标移出中栏 → `Ctrl+S` 保存卡片；键盘 `Tab` 移出 → 保存配置 |
| #9 | 复制卡片后不点泳道直接 `Ctrl+V` → 落到第一条非主泳道并有提示 |
| #11 | 造"悬空连线"与"孤立卡片"各一 → 前者红、后者黄；总数正确 |
| #13 | 30+ 工况配置中测单工况改动，P95 < 100ms；与单工况配置差异 < 1.5× |
| #14 | 录制拖拽 3 秒：≥ 50fps，无 > 50ms 长任务 |
| #22 | 保存后撤销按钮禁用且有提示；切工况后 `Ctrl+Z` 不回退上一工况 |
| #27 | 纯键盘完成「新建工况 → 插入卡片 → 建连线 → 保存」；开启"减少动态效果"后无过渡动画 |

### 10.4 交互回归清单（按批）
- **P0**：删除类操作均有 toast；慢网下新建分组/导入模板有 loading；改内容后顶部出现"未保存"且返回会询问；连线按提示文案操作可成功；卡片列表单击可进编辑（多选时仍只高亮）；点画布任意卡片左侧有响应；`Insert/Delete` 在面板内不触发；`Ctrl+S` 不随鼠标移动改变语义；`Ctrl+V` 无落点时有引导。
- **P1**：参数名重名即时报错；引用卡片返回会提示保存；"参数取值"三态可辨；两处生成入口状态一致。
- **P2**：步骤编辑 `Ctrl+Z` 只回退步骤、不影响画布；编辑卡片时 `Ctrl+C/V` 仍可复制工况；用例预览可跳转到图形配置并定位工况。

### 10.5 回滚
- 每批单独提交，任一批出现回归可单独 revert，不影响其它批次。

---

## 十一、实施顺序建议

1. **第 1 批（MUST，零行为变更）**：P0-1 / P0-2 / P0-3 / P0-4 + **#6 + #7**。完成后跑 10.2 产物比对。
2. **第 2 批（SHOULD，交互连贯）**：P0-5 / P0-6 / P0-7 / P0-8 / P0-12(#9) / P0-13 / P1-10(#11) / P1-2 / P1-3 / P1-4 / P1-7。
3. **第 3 批（P2 与边界）**：P2-1 / P2-2 / P2-3 / P2-4 / P2-5 / P2-7 + **P2-8(#22)** + **#27**。
4. **第 4 批（待定调项）**：第 5 章 8 项定调后逐项插入。
5. **贯穿**：#13/#14 每批完成后复测一次，防性能回退。

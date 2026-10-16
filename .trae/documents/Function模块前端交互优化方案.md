# Function 模块前端交互优化方案（v2.0 · 已定调版）

| 项 | 内容 |
|---|---|
| 版本 | **v2.14**（由 v2.0 演进；v2.1 记实施状态，v2.2/v2.3 并入两批新定调，v2.4/v2.5 记运行时验证与缺陷修正，v2.6 落地 #8，v2.7 补停靠栏窄宽缺陷与页签可访问性，v2.8 改全局项同步语义，v2.9~v2.12 面色缺陷修正，v2.13 改默认浅色主题，v2.14 用例ID 序号跟着上面走） |
| 生效日期 | 2026-10-09 |
| 作用范围 | `frontend/src`（Function 模块）；**#8 经定调后另含后端 1 个只读接口**（`backend/api/function_routes.py` + `backend/core/function_module.py`）；**v2.14 另含后端用例编号逻辑**（`backend/services/function_graph.py` 的 `_expand_frames`）；仅第 8 章中标注「作用于需求文档」的条目涉及 `.trae/documents/Function模块前端需求文档.md` |
| 变更记录 | v1.0（2026-10-09）初版：29 项交互摩擦 + P0/P1/P2 三批优化清单。<br>**v2.0（2026-10-09）**：① 并入 L2 已定调 8 项（#6/#7/#9/#11/#13/#14/#22/#27）并把规则与验收写实；② 并入 L1 文档层修订 16 项；③ 优化项清单增加「状态 / 优先级」两列；④ 原「待定调」项独立成章（第 7 章）。<br>**v2.1（2026-10-10）实施记录**：第 11 章「第 1/2/3 批」已落地的交互项——P2-1（步骤独立撤销栈）、P2-2（编辑卡片时保留工况/库卡片复制粘贴）、P2-3（用例预览直达图形配置并定位工况，见第 6 章校正）、P2-4（参数行「映射填充」显式按钮）、P2-5（**校正为只补帮助文案**）、P2-7（引用卡片编辑叠层上下文面板）、P2-8(#22)（撤销栈按工况隔离 + 保存后清栈并提示）、P1-6（对象浏览器手动开关 60s 内不被自动覆盖）、P0-11（Ctrl+A 文案 + Alt+A 全选全部工况）、P0-6（新建卡片后自动聚焦卡片名并全选，与其他新增入口一致）、P1-4（步骤类型记忆 + "添加步骤"旁按类型直接创建）、P1-9（Alt+Insert/Alt+P 与 Esc 分层）、#27（aria-label/键盘可达/reduced-motion）、#13/#14（新增仅 dev 生效的 `__CANVAS_PERF__` （`report()` 查看近 200 次重算的 P50/P95/max，便于按第 10 章复测）。<br>**v2.2（2026-10-10）新定调 + 落地**：① **#10** 保留全屏编辑器、改为编辑器内「生成结果」抽屉（=P1-5 已实现；P2-6 不做）；② **#1** 以 StepEditor 为基准补齐 CardEditor（类型可改 + 故障角色 + 局部变量区 =P1-1 已实现）；③ **#28** 保持现状（P2-9 不做）；④ 补做 P1-8（参数取值三态显式化）。第 5 章待定调项由 8 项收敛为 5 项（#2 / #8 / #12 / #20 / #21）。需求文档的 L1 修订按用户决定**暂不执行**。<br>**v2.3（2026-10-10）第二批定调 + 落地**：① **#2** 主序列被整体替换前二次确认（粘贴 / Ctrl+拖拽复制 / 卡片库拖入三条落点）；② **#12** 白名单收敛为全项目唯一维护点并写明依据（不改后端、不新增接口，行为零变更）；③ **#20** 拉取同名分组默认跳过 + 「覆盖」勾选后才原地替换；④ **#21** 展开上限 2000 / 20000（前端预检按条数上界，拿到产物后按真实行数复核）。第 5 章待定调项收敛为 1 项（#8）。<br>**v2.4（2026-10-10）运行时验证与缺陷修正**：在 dev 页面用浏览器自动化实测（见 10.6）——① 修正 P1-4 缺陷：`@click="addStep"` 会把 `MouseEvent` 当步骤类型传入并持久化，改为 `@click="addStep()"` + `safeStepKind()` 白名单校验；② P1-9 的 `Alt+Insert` / `Alt+P` 补 `allowInInput: true`（否则焦点在卡片名输入框时按不动）；③ 统一快捷键层新增自查入口 `__SHORTCUTS__.run(id)`，用于区分"键位未生效"与"处理体缺陷"。实测覆盖 P0-6 / P1-4 / P1-5 / P1-9(处理体) / P2-1 / P2-8 与"无 JS 报错"。<br>**v2.5（2026-10-10）续测：修正「保存按钮被遮挡」缺陷 + P1-8 实测**：① **关键缺陷**——[StepEditor.vue](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/StepEditor.vue) 工具栏 `.se-form` 带 `min-width: 0`，窄栏内被压到内容宽度以下，末尾「保存」按钮溢出并被右侧 `.se-actions` 的「添加步骤」盖住 → 点「保存」实际点到「添加步骤」，**卡片改动无法保存**（窄栏必现；P1-4 新增的「按类型新增步骤」下拉使其更宽、更易触发）。修法：`.se-form` 加 `flex-wrap: wrap`，窄栏内子项自身换行不再溢出；实测点「保存」弹出「卡片已保存」且参数成功回写。② **同源缺陷**——[FunctionGraphEditor.vue](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/FunctionGraphEditor.vue) 顶部 `.ge-header`（无 `flex-wrap`）在窄窗口下内容 994px > 907px 溢出，最右侧「生成结果」被挤出可视区点不到（P1-5 新增该按钮后触发）。修法：`.ge-header` 加 `flex-wrap: wrap; row-gap: 6px`。③ P1-8 参数三态标签端到端实测通过（见 10.6）。<br>**v2.6（2026-10-10）#8 落地（经用户定调：连后端一起做）**：① 后端新增只读接口 `GET /api/function/builtin-functions`，返回内置函数签名表（名称 + 参数类型序列，124 条；判据与生成路径同源，见 [function_module.py](file:///e:/Python/AutoTool_Web/backend/core/function_module.py) 的 `builtin_function_signatures`）；② 前端在**函数库面板保存后**即时比对并提示「与内置函数同名同参，生成时不会被采用」（原来要等到点「生成」才提示）；③ 规避误报：与后端 `_fn_key` 同规则（名称 + 去空白参数类型序列），并实测「命中会提示、不命中不提示」。至此第 5 章待定调项清零。<br>**v2.7（2026-10-10）续查同类缺陷 + 页签可访问性**：① [DockLayout.vue](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/DockLayout.vue) 的 `.dl-tabbar` 只 `overflow-x: auto` 不换行，停靠栏一窄（如右栏被压到 ~157px）末尾页签就被推到可视区外、只能靠隐藏的横向滚动才能点到 —— 修为 `flex-wrap: wrap`（改后该栏 `clientWidth == scrollWidth`，页签换到第二行且可见）；② 同文件 `.dl-tab-item` 是**无 `role`/`tabindex` 的可点击 div**（键盘用户无法切换面板，也不出现在无障碍树里）—— 按 #27 的写法补 `role="button"` / `tabindex="0"` / `aria-pressed` 与 Enter·Space 激活，实测无障碍树已把它们暴露为带 pressed 状态的 button。<br>**v2.8（2026-10-10）全局项同步语义变更（用户新需求）**：把「全局卡片/映射/值资源只在新建分组时带出」改为**设为全局即同步进所有分组**。① 设为全局 → 该项进入所有分组的卡片列表 / 对象映射表 / 值资源库（缺失的补一份带 `global` 标记的深拷贝）；② 取消全局 → **不回收**：其它分组里已同步的副本内容原样保留，只清掉副本上过期的 `global` 标记（保证「有全局徽标 ⟺ 该项确实在全局库里」）；③ 新建分组仍沿用原有带出逻辑，两条路径结果一致。实现见 [FunctionGraphEditor.vue](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/FunctionGraphEditor.vue) 的 `syncGlobalToAllGroups`，三处「设为全局」入口统一调用。<br>**v2.9（2026-10-10）文字按钮补底色（用户要求：背景色不要透明）**：全站 `el-button text` 的 `background-color` 被 EP 直接写死为 `transparent`（不走 CSS 变量），在深色面板上几乎看不出是按钮 —— 统一改为「主题色浅底」：默认 `--el-color-primary-light-8`、悬停/按下 `light-7`；并按按钮自身语义色取色（danger/success/warning/info 各用 `-light-8`），避免「蓝底红字」。**不加边框**（text 按钮原 `border-width: 0`，加框会改变控件尺寸进而影响既有布局）；禁用态不覆盖，保持原样。实现见 [main.scss](file:///e:/Python/AutoTool_Web/frontend/src/styles/main.scss) 的 Element Plus 覆盖段。<br>**v2.10（2026-10-10）按钮底色定稿 + 图形编辑器统一浅色（用户反馈「图形化配置里的按钮还是黑色」）**：定位到根因——**图形编辑器内部本就是浅色设计**（[CaseFrameCanvas.vue](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/CaseFrameCanvas.vue) / [StepEditor.vue](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/StepEditor.vue) / DockLayout 等共 **49 处硬编码浅色** `#fff / #f5f7fa / #f0f2f5`），但其中的 EP 控件默认吃 `html.dark` 的暗色变量（本机系统为深色偏好，App 自动进深色主题）→ 出现「白面板 + 黑按钮 / 黑输入框」；v2.9 的「主题色浅底」在暗色档下只有 `#182129`，与黑底仍难区分，所以没解决。定稿改法：① **非实心按钮**（`is-text` / `is-plain` / 未指定 type 的按钮）统一给 `--el-fill-color-light` 浅填充 + `--el-border-color` 浅边框（文字按钮用 inset 描边，不加真实边框以免改控件尺寸），实心按钮（保存/生成/新建工况…）保持原高亮色；② 在 `.graph-editor` 与 `.ce-modal-pass`（CardEditor 弹窗的 modal-class，因 `append-to-body` 挂在 body 上需单独列）作用域内把 EP 变量（含主色阶）改回**浅色档**，使编辑器内部控件与它的白面板一致，「App 外壳（深色）不受影响」。<br>**v2.11（2026-10-10）编辑器浅色作用域补全（用户反馈「工况框标签、滚动滑块仍是深色」）**：v2.10 只把**主色阶**拉回浅色，遗漏了两组：① **语义色阶** —— EP 暗色会把 success / warning / danger / error / info 各族的 `light-3/5/7/8/9` 整体映射成深色，于是画布工具条的 `<el-tag type="info">N 个工况框</el-tag>` 变成「深底浅字」；② **应用级变量** —— 全局 `::-webkit-scrollbar-thumb` 用的是 `var(--border-color)`（暗色档 `#3a3a55`），所以编辑器里的滚动滑块也是深色。已在这三个作用域内把两组变量一并回浅色（含 `--bg-* / --text-* / --border-* / --color-*` 应用变量）。<br>**v2.12（2026-10-10）滚动条滑道（用户反馈「这个滑块没改到」）**：v2.11 只换了 thumb 的取色（`--border-color`），但**滑道**写的是 `background: transparent`；根元素带 `color-scheme: dark` 时 Chromium 会用 **UA 默认的深色**绘制滑道 → 浅色面板里仍是一条深色滑道（实测 thumb 已是 `rgb(220,223,230)`，滑道仍深）。改法：① 滑道改为显式主题色 `var(--bg-page)`（编辑器内 = `#f0f2f5`，深色外壳 = `#1a1a2e`）；② 在编辑器作用域内声明 `color-scheme: light`，使**原生滚动条与原生表单控件（checkbox / radio 等）都按浅色渲染**（根元素仍为 dark，App 外壳不受影响）。<br>**v2.13（2026-10-10）改为默认浅色主题（用户澄清：本项目就是浅色主题）**：此前 [App.vue](file:///e:/Python/AutoTool_Web/frontend/src/App.vue) 的 `onMounted` 会按系统 `prefers-color-scheme` 自动加 `dark`（本机系统为深色）→ **外壳深色、而图形编辑器内部是浅色设计**，才导致 v2.9~v2.12 那一串「白面板 + 黑按钮 / 深黑标签 / 深色滚动条滑道」。现改为**默认浅色**：去掉系统偏好自动切深色的逻辑（`toggleTheme()` 保留，仍可手动切，只是当前未挂按钮、选择也不落盘）。实测：`html.class=''`、`color-scheme: light`、页面底色 `#f0f2f5`；图形化配置内按钮 `rgb(245,247,250)`、`info` 标签 `rgb(233,233,235)`；**全页扫描「背景亮度 < 80」的元素 = 0**。v2.10~v2.12 的编辑器浅色作用域保留（日后若切回深色，编辑器仍保持浅色、不会再出现那批不一致）。<br>**v2.14（2026-10-10）用例ID 序号「跟着上面走」（用户新需求，含后端改动）**：原来自动用例名 = `<前缀>_<全局计数器>`，而用户在画布上双击改过的用例名（`frame["caseNames"]`）**既不占用编号、也不影响计数器** —— 于是把上面的 ID 改成 `..._13_14` / `..._15_16` 后，后面的仍按原计数器排（不是 17）。改法（[function_graph.py](file:///e:/Python/AutoTool_Web/backend/services/function_graph.py) 的 `_expand_frames`）：新增 `_trailing_num()`（取名字末尾数字段的最大数，`_15_16` → 16），自定义名会把 `last_num` 顶高；自动编号改为 `idx = max(idx, last_num + 1)`，即**接着上面用过的最大尾号往下排**。只影响 `naming='default'`（`naming='path'` 的名字无尾号，天然不受影响）。验证：用真实配置（`A47D_copy`，17 工况 / 120 条用例）注入 `caseNames=['..._13_14','..._15_16']`，① 直接调用新代码、② POST 正在运行的后端 `/api/function/expand-cases`，两条路径都得到 `_13_14 / _15_16 / **17** / 18 / 19 …`（断言 PASS）。 |

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
| **已定调**（L2 采纳推荐方案） | 15 项：原 8 项 #6 / #7 / #9 / #11 / #13 / #14 / #22 / #27；2026-10-10 第一批定调 #1（以 StepEditor 为基准补齐 CardEditor）/ #10（保留全屏 + 编辑器内「生成结果」抽屉）/ #28（保持现状，不做）；2026-10-10 第二批定调 #2（主序列粘贴二次确认）/ #12（白名单集中为唯一维护点，不改后端）/ #20（拉取同名默认跳过 + 「覆盖」勾选）/ #21（展开上限 2000 / 20000） | 第 4 章（规则 + 验收），实现改法并入第 6 章 |
| **待定调**（L2 尚未定） | **0 项**（原 #8 已于 2026-10-10 定调「连后端一起做」并落地，见 v2.6） | 第 5 章（保留决策留痕） |
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
| P1-1 | 统一两个编辑入口：CardEditor 补 `role` + 放开类型可改 + 补「局部变量」区 | D1 | **已定调（#1，2026-10-10）** | SHOULD | 消除同实体两套规则 |
| P1-2 | 字段级实时校验：参数名、用例名、Loop 配对 | C4/C5 | 无需决策 | SHOULD | 错误即时可见 |
| P1-3 | 编辑引用卡片：返回前脏检查确认 | B5 | 无需决策 | SHOULD | 不再静默丢改动 |
| P1-4 | 步骤默认 kind 记忆 + "添加步骤"旁直接选类型创建 | A1 | 无需决策 | SHOULD | 少一步 |
| P1-5 | 生成结果内嵌到编辑器（抽屉），免退出查看 | B1 | **已定调（#10，2026-10-10：保留全屏 + 加抽屉）** | SHOULD | 少一次往返 |
| P1-6 | 对象浏览器：手动 toggle 后短期内不再被自动覆盖 | D5 | 无需决策 | MAY | 开关可控 |
| P1-7 | 两处"生成"入口统一禁用条件与反馈 | D6 | 无需决策 | SHOULD | 状态一致 |
| P1-8 | "参数取值"三态显式化（默认/已覆盖/不参与） | A3 | 无需决策 | SHOULD | 语义可读 |
| P1-9 | 缺失键位补齐（添加步骤/参数；Esc 统一分层） | E6 | 无需决策 | MAY | 键盘流顺畅 |
| P1-10 | **告警分级（阻断=红 / 提示=黄）** | — | **已定调（#11）** | SHOULD | 严重度可辨 |
| P1-11 | 缺失函数告警判定源改为"库解析结果 + 内置函数表"（**校正：白名单已集中为唯一维护点，不改后端**） | — | **已定调（#12，2026-10-10）** | SHOULD | 消除硬编码白名单 |

### P2 —— 结构与流程调整

| ID | 优化点 | 关联 | 状态 | 优先级 | 预期收益 |
|---|---|---|---|---|---|
| P2-1 | 步骤编辑加撤销栈（与画布 Ctrl+Z 隔离） | E2 | 无需决策 | SHOULD | 步骤编辑可回退 |
| P2-2 | 编辑卡片时保留画布实体复制快捷键 | B4 | 无需决策 | MAY | 不必来回切视图 |
| P2-3 | 用例预览 → 一键跳转到图形配置并定位工况 | B3 | 无需决策 | SHOULD | 从结果直达编辑 |
| P2-4 | "按映射表一键填充参数"（显式按钮） | A2 | 无需决策 | MAY | 少手工输入 |
| P2-5 | 连线一步化：从端口拖出即连线（**校正：现状已支持拖拽 + 点选 + Ctrl 两步；本轮只补帮助文案**） | A5 | 无需决策 | MAY | 少一步 |
| P2-6 | 编辑器改为非全屏（可缩放浮层） | B1 | **已定调（#10，2026-10-10：**不做**，保留全屏；改为编辑器内加「生成结果」抽屉，见 P1-5）** | MAY | 上下文不丢失 |
| P2-7 | 引用卡片编辑改为叠层子面板 | B5 | 无需决策 | MAY | 上下文不丢失 |
| P2-8 | **撤销边界：按工况隔离 + 保存后清栈** | — | **已定调（#22）** | SHOULD | 撤销语义可控 |
| P2-9 | Function 模块隐藏"测试参数"视图（CAN 专用） | — | **已定调（#28，2026-10-10：保持现状，不做）** | SHOULD | 领域不越界 |

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

### 4.9 #10 —— 生成结果可见性（2026-10-10 定调）

| 项 | 内容 |
|---|---|
| 决策 | **保留全屏编辑器**（画布性能优先，不做 P2-6 的非全屏化）；改为在**编辑器内**提供「生成结果」抽屉 |
| 规则 | ① 编辑器顶部提供「生成结果」入口；② 生成成功后抽屉**自动展开**，展示产物目录、TestCase / Function / ArrayFunc 三段代码（可复制）与「函数库 ↔ 内置模板冲突」提示；③ 抽屉**不遮挡画布交互**（`modal=false`），可随时关闭继续编辑；④ 打开产物目录仍由父级执行，编辑器不直接碰文件系统 |
| 影响 | 免去「退出编辑器 → 找产物 → 再进来继续改」的往返 |
| 涉及 | [FunctionGraphEditor.vue](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/FunctionGraphEditor.vue)（新增 `outputDrawerVisible`/`copyOutput` 与抽屉模板）、[FunctionView.vue](file:///e:/Python/AutoTool_Web/frontend/src/views/FunctionView.vue)（`generateResult` 快照 + `open-output-dir`） |
| 验收 | ① 编辑器内点「生成」后抽屉自动展开并显示目录与三段代码；② 关闭抽屉后画布仍可继续拖拽编辑；③ 未生成过时抽屉给出"还没有生成结果"空态 |
| 优先级 | SHOULD |

### 4.10 #1 —— 两个编辑入口能力统一（2026-10-10 定调）

| 项 | 内容 |
|---|---|
| 决策 | **以 StepEditor 为基准补齐 CardEditor**（不做"反向锁死 StepEditor"） |
| 规则 | ① CardEditor 放开「类型可改」（原来仅新建时可改）；② 补齐「故障角色」（`inject`/`recover`）；③ 新增「局部变量」编辑区（含类型下拉、变量名、初始值、增删、拖变量名到参数框）；④ 数据结构与落库路径不变（仍写 `Card.locals`/`Card.role`/`Card.type`，仍走既有 `saveCard`/`save-card`），**不新增字段、不改生成** |
| 影响 | 同一实体两套入口规则一致，减少"这个入口改不了类型 / 没有局部变量"的困惑 |
| 涉及 | [CardEditor.vue](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/CardEditor.vue) |
| 验收 | ① 在 CardEditor 里改类型/角色并保存，卡片库与所有引用处同步；② 在 CardEditor 里加/删局部变量并保存，产物中 `testcase` 顶部的声明与 StepEditor 编辑结果一致；③ 两入口对同一张卡片的编辑结果可互相覆盖而不产生结构差异 |
| 优先级 | SHOULD |

### 4.11 #2 / #12 / #20 / #21 —— 第二批定调（2026-10-10）

| 决策 | 规则 | 涉及 | 验收 |
|---|---|---|---|
| **#2 主序列替换前的确认** | 主序列「不可删、可被整体替换」的既有规则不变；**凡是会整体替换已有主序列的操作**（Ctrl+V 粘贴、Ctrl+拖拽复制到主序列、从卡片库拖入主序列）都先 `ElMessageBox.confirm`，取消则不落点且不触发任何改动 | [CaseFrameCanvas.vue](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/CaseFrameCanvas.vue)（`confirmMainReplace`） | ① 主序列已有卡片时粘贴/拖入 → 弹确认；② 点「取消」→ 主序列与整图内容不变；③ 主序列为空时不打扰（直接落点） |
| **#12 白名单唯一维护点** | 判定源仍为「函数库解析结果 + `EXTERNAL_CALL_WHITELIST`」；**不改后端、不新增只读接口**。白名单集中为**全项目唯一一处**并写明依据（CANoe TFS/系统变量 API + 项目 .cin 公共函数），只做展示层过滤，不参与生成 | [utils/functionGraph.ts](file:///e:/Python/AutoTool_Web/frontend/src/utils/functionGraph.ts) | 告警集合与改动前一致（白名单成员仍不告警）；全仓仅此一处定义 |
| **#20 拉取同名策略** | 拉取列表标出「本地已存在」；**同名默认跳过**（「全选」不包含同名项），需**逐个显式勾选「覆盖」**才用源分组**原地整体替换**本地同名分组（沿用本地分组 id）；结果 toast 分别给出「新增 / 覆盖 / 跳过」数量 | [FunctionView.vue](file:///e:/Python/AutoTool_Web/frontend/src/views/FunctionView.vue) 拉取弹窗 | ① 同名分组默认不勾选；② 勾选同名但未勾「覆盖」→ 提示已跳过且无改动；③ 勾「覆盖」→ 本地同名分组被替换、其余分组不受影响 |
| **#21 展开上限** | 单工况 **2000 条**、单次 **20000**（预检口径＝用例条数，与后端展开同源）；超限**拒绝发起展开**并提示拆分。用例预览 / 编辑器用例名刷新 / 用例代码预览三处共用同一预检；用例预览在拿到产物后再按**真实行数**复核一次并提示 | [utils/functionGraph.ts](file:///e:/Python/AutoTool_Web/frontend/src/utils/functionGraph.ts)（`checkExpandLimit` / `expandLimitMessage`）、[FunctionView.vue](file:///e:/Python/AutoTool_Web/frontend/src/views/FunctionView.vue)、[FunctionGraphEditor.vue](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/FunctionGraphEditor.vue) | ① 单工况超过 2000 条 → 拒绝展开并指名该工况；② 总量超过 20000 → 拒绝并提示拆分；③ 未超限时行为与改动前一致 |

### 4.12 #8 函数库冲突即时提示 —— 定调「连后端一起做」（2026-10-10）

| 决策 | 规则 | 涉及 | 验收 |
|---|---|---|---|
| **#8 即时冲突提示** | 新增只读接口 `GET /api/function/builtin-functions` 返回 Function 模块**内置函数签名表**（名称 + 参数类型序列，当前 124 条）。前端在**函数库面板保存成功后**，用「已解析的自定义函数」与该表比对：**同名同参**即用一个 `ElMessage.warning` 列出这些函数名，并说明「生成时不会被采用（以内置模板为准）」。**不阻断保存、不改生成链路**，只是把原本「生成后才给」的同一判断提前到保存时 | 后端 [function_routes.py](file:///e:/Python/AutoTool_Web/backend/api/function_routes.py)（`/builtin-functions`）、[function_module.py](file:///e:/Python/AutoTool_Web/backend/core/function_module.py)（`builtin_function_signatures`）；前端 [api/function.ts](file:///e:/Python/AutoTool_Web/frontend/src/api/function.ts)、[FunctionGraphEditor.vue](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/FunctionGraphEditor.vue)、[PanelBody.vue](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/PanelBody.vue) | ① 保存函数库后立即出现冲突提示（无需点「生成」）；② 无冲突时不打扰；③ 接口不可用（含后端未重启）时静默跳过、不报错、不改原有行为 |

**判据同源（防前后端漂移）**：内置表由 `builtin_function_signatures()` 生成，直接复用生成路径同款解析器与 `_fn_key` 规则（`名称|参数类型序列`，类型去空白）；前端 `funcKeyOf` 复刻同一规则，因此不会出现「前端说冲突、后端其实不冲突」。

### 4.13 全局项同步语义（v2.8 用户新需求）

| 决策 | 规则 | 涉及 | 验收 |
|---|---|---|---|
| **全局项 → 同步进所有分组** | 「全局」的语义由「**新建配置 / 新建分组时**自动带出」改为「**设为全局即同步进所有已存在的分组**」：卡片进卡片列表、映射对象进映射表、值资源进值资源库。① **设为全局** → 其它分组缺这条就补一份深拷贝（带 `global` 标记）；已有同一条（卡片按 `id`、映射按 `kind+alias+name`、值资源按 `name`）就只把它过期的 `global` 标记对齐。② **取消全局** → **不回收**：其它分组里那份副本内容原样保留，只清掉 `global` 标记（保证「有全局徽标 ⟺ 该项确实在全局库里」）。③ 当前分组不动（标记本来就是在它上面改的）。④ 新建分组仍走原 `injectGlobalIntoGroup`，与新路径结果一致 | [FunctionGraphEditor.vue](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/FunctionGraphEditor.vue)（新增 `syncGlobalToAllGroups`，由 `setCardsGlobal` / `setMappingsGlobal` / `setValuesGlobal` 统一调用）；三处徽标 tooltip 与成功提示文案同步改写 | ① A 组把卡片设为全局 → 切到 B 组，卡片列表里出现该卡且带「全局」徽标；② 在 A 取消全局 → B 组里卡片仍在但徽标消失；③ 新建分组仍能带出全局项 |

**落盘时机**：同步改的是各分组的本地内容，与既有规则一致 —— 会置「未保存」标记，需点「保存」（或退出时的「保存并返回」）才写进配置；成功提示里也写明了「保存后生效」。

---

## 五、待定调的项（保留推荐 + 备选）

> 2026-10-10 定调结果：**#1 / #2 / #10 / #12 / #20 / #21 / #28 已定调**（见 4.9 / 4.10 / 4.11 与第 3 章状态列）；**#8 于 2026-10-10 定调「采纳推荐：连后端一起做」并已落地（见 v2.6 与 4.12）——待定调项清零**。下表中保留其条目仅作决策留痕。

| # | 问题 | 推荐 | 备选 | 状态 / 主要影响 |
|---|---|---|---|---|
| 1 | 两个编辑入口能力不一致 | 以 StepEditor 为基准，CardEditor 补齐 `role` + 放开类型可改（**需为 CardEditor 新增"局部变量"编辑区**，这是它唯一缺的实质能力） | 反向：锁死 StepEditor 的类型/role | ✅ **已定调（2026-10-10）采纳推荐**，见 4.10 |
| 2 | 主序列"可整体替换"与"不可删"冲突 | 保留现状，但**规则写清 + 主序列粘贴加二次确认** | 禁止主序列粘贴替换，改为就地合并 | ✅ **已定调（2026-10-10）采纳推荐**，见 4.11 |
| 8 | 函数库冲突只在生成后提示 | 保存函数库后**即时比对并提示**（需后端提供"内置模板函数名表"只读接口） | 保持现状，仅在编辑区顶部加常驻提示条 | ✅ **已定调（2026-10-10）采纳推荐并落地**（见 4.12 / v2.6）；前端 + 后端 1 处只读接口 |
| 10 | 全屏浮层遮住生成结果 | **保留全屏**（性能优先），编辑器内加"生成结果"抽屉 | 改为可缩放非全屏（有画布性能回归风险，即 P2-6） | ✅ **已定调（2026-10-10）采纳推荐**，见 4.9（P1-5 已实现；P2-6 不做） |
| 12 | 缺失函数告警依赖硬编码白名单 | 判定源改为「函数库解析结果 + 内置函数表」，白名单降级为**可配置例外表并写入文档** | 维持硬编码但集中到一处常量并注明依据 | ✅ **已定调（2026-10-10）采纳备选（先集中常量、不新增接口）**，见 4.11 |
| 20 | 拉取同名覆盖策略未定义 | 拉取列表标出「本地已存在」，同名**默认跳过**，提供"覆盖"勾选 | 默认逐项询问 | ✅ **已定调（2026-10-10）采纳推荐**（同名判定在前端本地完成，无需后端改动），见 4.11 |
| 21 | 用例展开无上限 | 定：单工况展开上限 **2000 条**、单次总行数上限 **20000**，超限拒绝并提示拆分 | 你给具体数字 | ✅ **已定调（2026-10-10）采纳推荐**，见 4.11（预检按条数上界，拿到产物后按真实行数再复核） |
| 28 | 测试参数区块（CAN 专用）出现在 Function | Function 模块**隐藏该视图** | 保留但标注"CAN 专用" | ✅ **已定调（2026-10-10）保持现状（不隐藏、不标注）** |

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

### 6.10 P1-1 / P1-3 / P1-4 / P1-5 / P1-6 / P1-7 / P1-8 / P1-9

| ID | 文件 | 改法 |
|---|---|---|
| P1-1 | CardEditor.vue | ① 类型 `el-select` 去掉 `:disabled="!isNew"`（放开类型可改）；② 类型为 `inject` 时并排显示「故障角色」`el-select`（`inject`/`recover`）；③ 新增 `.ce-locals` 局部变量编辑区（`locals` computed + `CAPL_TYPES` + `editingLocalIdx` + `addLocal` + `onLocalDragStart`，拖变量名走既有 `text/plain` 通道即可填进参数框）；④ `sync()` 里补 `locals`/`role` 默认值。数据结构与落库路径不变。 |
| P1-3 | CardEditor.vue `backToParent`（≈664）、面包屑返回（≈17） | 复用已有 `hasChanges()`：有改动时 `ElMessageBox.confirm`，选"保存"走 `saveSub()` 后再退栈，"不保存"直接退栈，"取消"留在当前层。 |
| P1-4 | StepEditor.vue `addStep`、CardEditor.vue `addStep` | 模块级 `lastStepKind`（`localStorage` 键 `function.lastStepKind` 持久化，两个编辑器共用同一键、行为一致）；`addStep(kind?)` 用 `newStep('call')` 建好后交 `onKindChange(step, kind)` 做结构初始化（与手动改类型同源，不新增分支）；`onKindChange` 写回记忆。另在"添加步骤"旁加 `el-dropdown` 直接选类型创建，与主按钮共用同一 `addStep(kind?)`，**不新增步骤类型**。**运行时发现的缺陷与修正**：`@click="addStep"` 会把 `MouseEvent` 当 `kind` 传入（于是步骤类型被写成事件对象、`localStorage` 被写成 `[object MouseEvent]`）——模板改为 `@click="addStep()"`，并新增 `safeStepKind(k)` 白名单校验兜住"传入值/记忆值/localStorage 脏值"三条来源。 |
| P1-5 | FunctionGraphEditor.vue / FunctionView.vue | 编辑器头部加「生成结果」按钮 + `el-drawer`（`modal=false`，不挡画布）；父级 `doGenerate()` 成功后写 `generateResult` 快照（目录 / TestCase / Function / ArrayFunc / 冲突清单 / 时间戳），编辑器 `watch(generateResult.at)` 自动展开抽屉并渲染 `el-tabs` + 复制按钮；「打开目录」通过 `emit('open-output-dir')` 交父级执行。 |
| P1-6 | FunctionGraphEditor.vue（≈981-995） | `watch(objHasData)` 增加"用户手动覆盖"窗口：`userObjOverrideUntil = ref(0)`，`toggleObjDrawer` 写入 `Date.now()+60s`，窗口内不强制 `visible`。 |
| P1-7 | ConfigToolbar.vue（≈56）/ FunctionView.vue（≈245） | 统一禁用条件为"当前配置存在且非生成中"；两处生成统一走 `handleGenerate`，生成中同步 `:loading`。 |
| P1-8 | StepEditor.vue / CardEditor.vue 参数取值行 | 保留三态语义与判定，仅视觉区分：新增纯函数 `cardArgState(step, name)` → `el-tag` 显示"默认（info）/ 已覆盖（success）/ 不参与（warning）"，`:title` 说明"清空=回落默认值"；标签定宽 56px 保证行对齐。 |
| P1-9 | StepEditor.vue | 新增 `steps:add`（Alt+Insert）、`params:add`（Alt+P），两者都加 `allowInInput: true`（它们不是文本编辑键；新建卡片后焦点会自动落在卡片名输入框（P0-6），不加这条会「在最需要的时候按不动」）；Esc 分层：有步骤多选先取消（`soft`），否则返回 `false` 交外层（未采用"再取消卡片选中"，避免 Esc 静默退出卡片编辑丢改动）。 |

### 6.11 P2 其余项

| ID | 文件 | 关键设计 |
|---|---|---|
| P2-1 | StepEditor.vue | 引入与画布**独立**的 `undoStack/redoStack`（快照粒度 = `form.steps` + `form.params`），注册 `context` 作用域的 Ctrl+Z/Ctrl+Y，`when` 限定 `editorTarget==='card'`。画布栈不变。 |
| P2-2 | FunctionGraphEditor.vue（≈1691/1702） | `graph:copyEntity` / `graph:pasteEntity` 的 `when` 去掉 `editorTarget !== 'card'` 限制；依靠"context 优先"保证卡内步骤复制仍由 `steps:copy` 接管。 |
| P2-3 | FunctionView.vue `locateCaseInCode`（≈1308）/ FunctionGraphEditor.vue `refreshCaseIds` | 保留原滚动行为，用例行新增「定位到图形配置」按钮 → `openGraphEditor(group_id)` 并传 `focusCaseId`；编辑器等 `frameCaseIds`（case_id ↔ 工况）就绪后自动 `selectFrame(该工况)` 定位。**校正**：`PreviewCase` 没有 `frame_id`，改用「case_id 反查工况」的既有映射，避免新增后端字段。 |
| P2-4 | StepEditor.vue / CardEditor.vue 参数行 | 参数行右侧加"从映射表填充"按钮：按 `arg.key` 在 `mapping` 中查同名别名/对象并填入 `arg.value`。**显式按钮**，不点不改值。 |
| P2-5 | CaseFrameCanvas.vue 端口 mousedown（`onPortOutDown` → `onLinkUp`）/ 工具栏 `?` 帮助 | **校正：拖拽、点选、Ctrl 两步三种连线早已并存且都汇入 `createEdge`，无需新增交互**；本轮只把「从输出口按住拖到输入口松手」补进工具栏 `?` 操作说明的「连线」行（原本只写了后两种），降低发现成本。 |
| P2-7 | CardEditor.vue（引用卡片编辑态） | 引用卡片编辑保留「编辑栈 + 表单换入」的既有机制（`editStack` 语义不变），对话框体改为**双栏**：左侧仍是可编辑的表单，右侧新增 `.ce-parent` 叠层上下文面板，按 `L1…Ln` 列出父级各层（名称/类型/步骤数）并标注「编辑中」那层 —— 父级信息不再被整表单替换掉。 |

### 6.12 第二批定调项（#2 / #12 / #20 / #21）

| 决策 | 文件 | 改法 |
|---|---|---|
| #2 | CaseFrameCanvas.vue | 新增 `async confirmMainReplace(f, existing)`（`existing<=0` 直接放行）。三处替换主序列的落点各加一次守卫：`pasteClipboard`（异步确认后再 `pasteNow()`；**同步仍返回 true** 以保住"无画布剪贴板才放行上层"的语义）、`onZoneDrop`（拆出 `onZoneDropApply` 变 async）的 Ctrl+拖拽复制分支与「卡片库拖入主序列」分支（落点前按 `resolveDropLane` 预判是否会命中主序列）。 |
| #12 | utils/functionGraph.ts | 不新增接口；把 `EXTERNAL_CALL_WHITELIST` 的文档注释写实为「全项目唯一维护点 + 依据来源 + 只做展示层过滤」，避免后续在组件里另写一份。行为零变更。 |
| #20 | FunctionView.vue | 新增 `transferOverwrite`（显式勾选的源分组 id）与 `isLocalDupGroup()`（按**分组名**与本地比对，无需后端）；`transferSelectableIds` / `transferAllSelected` 让「全选」排除同名项；模板同名行加「本地已存在」标签 + 禁用态联动的「覆盖」复选；`confirmTransfer` 拉取分支拆成「新增 / 原地覆盖（`overwriteGroupsInCurrent`，沿用本地 id）/ 跳过」三条并分别计数提示。 |
| #21 | utils/functionGraph.ts + 三处调用 | 新增 `EXPAND_MAX_PER_FRAME=2000` / `EXPAND_MAX_TOTAL=20000` / `checkExpandLimit()`（逐工况用 `frameCaseRows` 估算条数，与后端展开口径同源）/ `expandLimitMessage()`；`FunctionView.refreshCasePreview` 预检不过直接返回（保留上次预览），并在拿到 `test_cases` 后按真实行数复核提示；`FunctionGraphEditor.refreshCaseIds` / `loadCaseCode` 预检不过则跳过（画布回落自定义名、「用例N」），避免为拿 case_id 触发超大展开。 |

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
| 统一多入口行为（P1-1） | 见 8.3，逐项等价性说明。 |
| 字段级校验（P1-2） | 校验函数从 `save()` 内**原样抽取**为纯函数，`save()` 继续调用同一函数做拦截；即"同一判据，多一次展示"。判据不变 ⇒ 通过/拒绝集合不变。 |
| 步骤默认 kind / 步骤撤销 / 显式填充（P1-4、P2-1、P2-4） | 均为用户显式动作；默认值仅影响"新建步骤时的初值"，用户仍可改（`onKindChange` 行为不变）。P2-4 是显式按钮，不点不改值。 |
| **生成结果抽屉（P1-5 / #10）** | 只读展示：目录/三段代码/冲突清单均来自父级已有的 `doGenerate()` 结果，**不额外请求、不改生成参数**；打开目录走原有 `handleOpenDir`。 |
| **三态标签（P1-8）** | 新增纯函数 `cardArgState()` 只做**读判定 + 颜色映射**；取值写入仍由既有 `setCardArg`/`setCardSkip`/`clearCardArg` 完成，`step.args` 结构不变。 |
| **主序列替换确认（#2）** | 只在落点前加一次确认；确认后仍走原有 `applyClip` / `moveNodesToLane`，替换结果与改动前完全一致（取消则完全不执行）。 |
| **拉取同名策略（#20）** | 同名判定按**分组名**在前端完成（不改后端返回结构）；「覆盖」走新增的 `overwriteGroupsInCurrent`，其内容构造仍复用 `makeGroupCopy` + `normalizeCards/normalizeMapping`，与「新增」路径同一套归一化逻辑。 |
| **展开上限（#21）** | 纯预检：`checkExpandLimit` 只调用既有 `frameCaseRows` 估算条数，**不新增/修改任何展开或生成逻辑**；超限时调用方直接返回，未超限时调用链与改动前一致。 |

### 8.3 统一多入口行为（P1-1，已定调）的等价性说明

`CardEditor` 放开"类型可改"后，落库路径仍为既有 `saveCard`（[FunctionGraphEditor.vue ≈599-613](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/FunctionGraphEditor.vue)）：它按 `card.type` 分桶写入 `cardLibrary`，且调用既有 `syncRefsFromLibrary`。**未新增分桶规则、未改同步逻辑**，只是允许了 `StepEditor` 早已允许的操作 ⇒ 两入口最终产生同一结构、同一生成结果。

`role`（故障注入/恢复）在 `CardEditor` 补齐后，`card.role` 字段本就参与画布分类（`cardCategoryClass`，[CaseFrameCanvas.vue ≈1540](file:///e:/Python/AutoTool_Web/frontend/src/components/graph/CaseFrameCanvas.vue)）与后端生成，字段语义不变、取值范围不变。**新增的"局部变量"编辑区**与 `StepEditor` 的 locals 使用同一数据字段（`Card.locals`），不新增字段。

### 8.4 明确"不做"的事

- 不做隐式参数自动填充（会改产出）。
- 不合并/改名任何函数、卡片、工况、泳道。
- 不改泳道准入规则、连线合法性规则、用例编号/命名规则。
- 不改 `frameDiagnostics` 的问题集合与判定（#11 只在展示层分级）。
- 不为拖拽类操作提供完整键盘等价（#27 已明确排除）。
- **编辑器非全屏化（P2-6 / #10）不做**：保留全屏以保画布性能，改以编辑器内「生成结果」抽屉解决"看不到产物"的问题。
- **Function 模块隐藏「测试参数」视图（P2-9 / #28）不做**：按 2026-10-10 决定保持现状。
- **需求文档的 L1 修订（第 7 章中「作用于需求文档」的 19 条）暂不执行**：按 2026-10-10 决定，本轮只落代码侧优化。
- **函数库冲突即时提示（#8）本轮不做**：仍只在生成时提示冲突（现状）；该方案需后端提供「内置模板函数名表」只读接口，超出"只改前端"的边界，保留为待定调。

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
| 交付形式 | 本文档为方案基线；第 3 章全部项与第 5 章已定调项均已落地（2026-10-10），仅 #8 待定调（需后端只读接口） | — |

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

### 10.6 实施后运行时验证记录（2026-10-10）

在运行中的 dev 页面（Vite 5173）用浏览器自动化逐项实测，作为"静态检查之外"的补充证据：

| 已实测通过 | 证据（页面实测） |
|---|---|
| P0-6 新建卡片后聚焦卡片名 | 新建注入卡片后 `document.activeElement` 即卡片名输入框，值为默认名（整段选中） |
| P1-5 / #10 生成结果抽屉 | 点「生成结果」→ 抽屉标题「生成结果」+ 空态文案「还没有生成结果…」；关闭后画布仍可交互 |
| P1-4 步骤类型记忆 | 下拉选「检查」→ `localStorage['function.lastStepKind'] === 'check'` 且新增步骤类型为「检查」；随后点「添加步骤」新增的步骤仍是「检查」，`localStorage` 保持 `check`（修正前该按钮会把 `MouseEvent` 写进类型与 `localStorage`） |
| P2-1 步骤编辑独立撤销栈 | 添加步骤 1→2；撤销后回到 1 并提示「已撤销步骤改动」；重做回到 2 并提示「已重做步骤改动」 |
| P1-9 键位处理体 | `steps:undo` / `steps:redo` / `steps:add` / `params:add` 处理体执行后状态与提示均符合预期（步骤 2→3、参数 0→1） |
| P2-8 / #22 撤销边界 | 进入编辑器时「撤销/重做」按钮为 disabled（历史为空） |
| P1-8 参数取值三态 | 卡片引用步骤绑定一张声明了参数 `spd` 的卡片后：初始 tag「默认」→ 在取值框填入 `123` 后 tag 变「已覆盖」→ 勾选「不参与」后 tag 变「不参与」（同时取值框被禁用、checkbox 呈选中）。拖拽来源为卡片库的 HTML5 DnD（自定义 MIME `application/x-graph-card`），自动化可正常派发 |
| StepEditor 工具栏不再重叠（v2.5 修正） | 修正前实测 `.se-form` 实际宽 286px、其内容约 458px：「保存」(x 590–654) 与「添加步骤」(x 600–688) 重叠，点「保存」实际点到「添加步骤」（无任何 toast、参数不回写）。修正后「保存」落到下一行 (x 418–482)、与操作区 (x 494–730) 无交叠，点击成功触发 `saveCard` → toast「卡片已保存」，切换卡片再回来参数仍在 |
| 顶部工具条不再溢出（v2.5 修正） | 修正前实测 `.ge-header` 内容 994px > 可视 907px（`overflow: visible`），最右「生成结果」被挤出可视区；修正后 `clientWidth == scrollWidth`（907==907），「生成结果」落在第二行 (x 780–868)、11 个控件全部可达 |
| P0-4 未保存返回拦截 | 编辑器有未保存改动时点「返回」→ 弹出「当前分组有未保存的修改，是否保存后返回？」，按钮为「不保存 / 保存并返回」；点「不保存」直接退出且不写回 |
| P2-7 引用卡片编辑叠层上下文面板 | 画布节点双击打开 CardEditor → 点步骤上的「编辑引用卡片」：`.ce-body-stacked` 生效、出现 `.ce-parent`，含「L1 父卡X 故障注入 · 1 步」与「编辑中 …」两行，标题变「编辑引用卡片：故障注入」、底部按钮变「返回组合卡片 / 保存引用卡片」；点「返回组合卡片」后父级表单原样恢复，且**父级未保存的改名「父卡X」仍在**（对比原 B5 会直接丢弃） |
| 遮挡审计（v2.5 收尾自查） | 对 `.graph-editor` 内与页面级所有 `button / input / textarea / checkbox / switch / radio` 逐个体检「中心点是否被无关元素盖住」，除 Element Plus 内部不可见的辅助 input 外结果为空 —— 同类"控件被遮住点不到"的缺陷已清除 |
| #8 函数库冲突即时提示（v2.6） | ① 后端接口 `GET /api/function/builtin-functions` 实测 `count=124`，键形如 `Msgtranjudge|word[],byte`（且含 `RelayON`）；② **判据一致性实测**：把 `byte Msgtranjudge(word ID[],byte tran)` 当自定义函数解析 → 前端键 `Msgtranjudge|word[],byte` **命中**内置表（会提示），自定义的 `MyOwnHelper|int` **不命中**（不误报）；③ 接口不可用（如后端未重启、旧进程返回 SPA 首页 HTML）时前端静默跳过、不报错、不改原有行为 |
| 停靠栏页签（v2.7 修正） | ① 修正前 `.dl-tabbar` 内容 212px > 可视 157px（只有 `overflow-x:auto`），第三个「函数库」页签滑到 x≈904（窗口宽 907）基本不可见；加 `flex-wrap: wrap` 后该栏 `clientWidth == scrollWidth`（122==122）、页签换行到第二行；② 同处 `.dl-tab-item` 由「无 role/tabindex 的可点击 div」补为 `role="button"` / `tabindex="0"` / `aria-pressed`，无障碍树实测从「纯文本」变为 `button "函数库" [e22] released`（可 Enter/Space 激活）|
| 全局项跨分组同步（v2.8） | 实测（两组：GraphCase / GraphCase2）：① 在 GraphCase 把卡片「故障注入」设为全局 → 提示「已设为全局卡片：「故障注入」（已同步 1 项到其它分组，保存后生效）」；切到 GraphCase2 → 该卡片**已在卡片列表中**且带「全局」徽标（`global=true`）；② 回到 GraphCase 取消全局 → 切到 GraphCase2 → 卡片**仍在列表里**但已无徽标（`global=false`）→ **内容不回收、过期标记已清除**。另：右键菜单项已可键盘操作（`role=menuitem` + 打开即聚焦，实测 Enter 直接触发「设为全局 / 取消全局」）|
| 按钮底色（v2.9 → v2.10 定稿） | ① 改前：9 个可见 `el-button text` 背景全是 `rgba(0,0,0,0)`；非实心的「生成结果 / 对象浏览器」是 `rgb(20,20,20)`（EP 暗色 `#141414` 纯黑）、plain 页签是 `rgb(24,33,41)`（`#182129`）。② 定稿后（编辑器浅色作用域生效）在图形化配置里实测：返回 / 工况…对象浏览器 7 个页签 / 生成结果 / 新建分组 / 导入·导出全局模板 / 新建工况·注入·恢复 / 新增变量 **全部为 `rgb(245,247,250)`**（`--el-fill-color-light`，边框 `#dcdfe6`）；实心的「保存」仍蓝 `rgb(60,154,232)`、「生成」仍绿 `rgb(103,194,58)`；输入框包装层白底 `rgb(255,255,255)` + 浅边框；「可见按钮中背景仍透明」数量为 **0**，控制台无应用报错。③ v2.11 补测（用户在截图里指出的两处）：画布工具条 `<el-tag type="info">{{ frames.length }} 个工况框</el-tag>` 由「深底浅字」变为 `bg=rgb(233,233,235)` + `fg=rgb(144,147,153)`；`.graph-editor` 内 `--border-color` = `#dcdfe6`（全局滚动条规则取的就是它 → 滚动滑块转为浅色）；全量扫描 `.graph-editor *` 中「背景亮度 < 70」的元素数量 = **0**（编辑器内已无深底残留）。④ v2.12 补测（用户第二张截图）：画布工况页签条 `.cfc-frame-tab-strip` 的滚动条 `::-webkit-scrollbar-track` 由「UA 深色」变为 `rgb(240,242,245)`、`thumb` 为 `rgb(220,223,230)`（滑道与滑块皆浅）；`.graph-editor` 的作用域内 `color-scheme` = `light`（根元素仍为 `dark`，外壳不受影响）|
| 无回归 | 上述操作后页面无 `Uncaught / TypeError / ReferenceError`；Vite 对各改动模块编译 200 |

**四点如实说明（不夸大验证范围）**：

1. **组合键投递限制**：本环境的自动化对 `Ctrl+C` 能正常投递 keydown（实测 `graph:copyEntity` 被派发器接管），但 `Ctrl+Z` / `Alt+Insert` / `Alt+P` 未能投递到页面（派发器日志无记录）。为把"键位没按到"与"处理逻辑有 bug"区分开，给统一快捷键层补了仅用于自查的 `__SHORTCUTS__.run(id)`（见 [useShortcuts.ts](file:///e:/Python/AutoTool_Web/frontend/src/composables/useShortcuts.ts)），上表 P2-1 / P1-9 的结论即由其执行处理体得出。**键位本身的端到端手感仍需人工在真实浏览器里按一遍**（尤其 `Ctrl+Z`、`Alt+Insert`、`Alt+P`、`Alt+A`、`Insert/Delete`）。
2. **未覆盖的实测项**：#2 主序列替换确认、#20 拉取同名策略、#21 上限拦截、P0-11 `Alt+A`、P2-3 用例定位 —— 这些要么需要构造多工况/多分组/超限数据，要么依赖上述未投递的键位；目前为**代码 + `vue-tsc` 层面验证**，建议在真实配置上按第 10.3/10.4 节清单人工复测。（P1-8 三态标签已于 v2.5 补测通过，见上表。）
3. **渲染节流会冻结关闭动画**：本环境浏览器标签页未激活时渲染被节流，Element Plus 模态的关闭过渡不会结束，会出现"遮罩仍在挡页面"的假象（实测把标签页 `activate` 后遮罩立即消失）。因此凡涉及"弹窗/遮罩是否已关闭""某控件是否被遮挡"的判断，都会先把标签页激活再下结论，避免把节流假象误判成缺陷。
4. **#8 的 UI 端到端没走到"弹窗出现"这一步**：验证环境窗口只有 907px，**三栏停靠区排不下**——右栏被挤到只剩约 122px 宽且整体被推到 x≈898（可视区 907），其 3 个页签（对象映射表 / 值资源库 / 函数库）即便在 v2.7 加了 `flex-wrap` 也仍落在屏幕外，自动化点不到 → 无法走完「面板保存函数库 → 弹出冲突提示」这条 UI 链路。已改用**同源判据实测**替代（见上表 ②：真实解析器 + 真实接口键比对，命中/不命中都符合预期），剩下的只有 `ElMessage.warning` 那一行的渲染。注意 v2.7 修的是「页签在栏内溢出」，**栏本身被挤出可视区属于三栏布局在窄窗口下的固有问题，未改动**（正常桌面宽度下不会发生）。另外：为使新接口生效，本次**重启了 Flask 后端**（原进程 `python run.py --mode dev` 以 `use_reloader=False` 启动，不会热加载新路由），现由临时启动脚本在同一端口运行；下次启动请照旧用 `python run.py --mode dev`。

---

## 十一、实施顺序建议

> **执行状态（2026-10-10）**：第 1～3 批全部落地；2026-10-10 两批新定调共 7 项（#1 / #2 / #10 / #12 / #20 / #21 / #28）已按决策落地或明确不做；#8 亦于 2026-10-10 定调「连后端一起做」并落地（第 4 批完成，**方案内全部条目已实现**）。每项均过 `vue-tsc --noEmit` 与 Vite 编译；关键交互（生成结果抽屉空态、新建卡片自动聚焦卡片名、局部变量区、按类型新增步骤入口、撤销按钮初始禁用、参数取值三态、引用卡片叠层上下文面板、未保存返回拦截）已在运行中的 dev 页面实测通过，改动后页面无 JS 报错。**v2.5/v2.7 另修正四处运行期发现的「窄宽下控件点不到」缺陷**：StepEditor 工具栏「保存」按钮被「添加步骤」遮挡、点击无效；图形编辑器顶部工具条窄窗下溢出、「生成结果」点不到；停靠栏 `.dl-tabbar` 不换行导致末尾页签滑出可视区；停靠栏 `.dl-tab-item` 无 `role`/`tabindex` 致键盘不可达（详见 10.6）。**v2.8 另按用户新需求改了「全局项」的同步语义**：设为全局即同步进所有分组的卡片列表 / 映射表 / 值资源库（取消全局不回收内容，只清过期标记），见 4.13；`vue-tsc` 仍 0 错误，两组实测通过。**v2.9~v2.11 另按用户要求修好了按钮/标签/滚动条底色**：非实心按钮统一给 EP 浅填充 + 浅边框，并把图形编辑器作用域内的 EP 变量（主色阶、语义色阶、应用级变量）与硬编码浅色面板对齐（编辑器本就是浅色设计，之前出现「白面板 + 黑按钮 / 深底标签 / 深色滑块」），见 10.6。

1. **第 1 批（MUST，零行为变更）✅ 已完成**：P0-1 / P0-2 / P0-3 / P0-4 + **#6 + #7**。完成后跑 10.2 产物比对。
2. **第 2 批（SHOULD，交互连贯）✅ 已完成**：P0-5 / P0-6 / P0-7 / P0-8 / P0-12(#9) / P0-13 / P1-10(#11) / P1-2 / P1-3 / P1-4 / P1-7；并补做第 3 章中未列入任何批次的 P1-8（参数取值三态显式化）。
3. **第 3 批（P2 与边界）✅ 已完成**：P2-1 / P2-2 / P2-3 / P2-4 / P2-5 / P2-7 + **P2-8(#22)** + **#27**。
4. **第 3+ 批（2026-10-10 定调后插入）✅ 已完成**：**P1-5(#10)** 生成结果抽屉；**P1-1(#1)** 以 StepEditor 为基准补齐 CardEditor（类型可改 + 故障角色 + 局部变量区）。P2-6(#10) 决定不做、P2-9(#28) 决定不做。
5. **第 3++ 批（2026-10-10 第二批定调）✅ 已完成**：**#2** 主序列替换前二次确认；**#12** 白名单收敛为唯一维护点（不改后端）；**#20** 拉取同名默认跳过 + 「覆盖」勾选；**#21** 展开上限 2000 / 20000 + 真实行数复核。
6. **第 4 批（定调后插入）✅ 已完成**：**#8** 函数库冲突即时提示——后端新增只读接口 `GET /api/function/builtin-functions`，前端在函数库保存后即时比对并提示（见 4.12）。方案内已无未落地条目。
7. **贯穿**：#13/#14 每批完成后复测一次，防性能回退；已提供仅 dev 生效的 `__CANVAS_PERF__`（`report()` 输出近 200 次重算的 P50/P95/max）作为复测抓手。

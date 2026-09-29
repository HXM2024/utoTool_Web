# CAN 报文信号表：树形图 + 分组表格 双视图

> 目标：在 CAN 模块「DBC / 报文信号表」页签里新增一个**按报文一级分组的可折叠表格**视图，与现有树形图**双视图切换**，让使用者能像对照 Excel 通信矩阵那样按列查看/编辑报文与信号，并就地配置测试参数。

---

## 1. 背景与现状分析

### 1.1 当前实现（全部在 `frontend/src/views/CANView.vue`）

DBC 页签的主体就是一棵 `el-tree`（[L60-L125](file:///e:/Python/AutoTool_Web/frontend/src/views/CANView.vue#L60-L125)）：

| 关注点 | 现状 |
| --- | --- |
| 节点类型 | `sender` / `message` / `signal` / `group` / `attr`（属性是**子节点**，不是列） |
| 测试参数 | 节点尾部渲染「标签」（[L101-L121](file:///e:/Python/AutoTool_Web/frontend/src/views/CANView.vue#L101-L121)），点击后在下方面板 `test-param-detail-panel` 填参数 |
| 拖拽 | 右侧 `ObjectPanel.vue` 拖 DTC / A2L 变量 / 属性 / 测试参数卡片 → 落到节点或标签（`onTreeNodeDrop`、`onTestParamTagDrop`、`_onTableDrop`） |
| 筛选 | 顶部 `dbcSearch` + `filterDbcTreeNode`（[L2376](file:///e:/Python/AutoTool_Web/frontend/src/views/CANView.vue#L2376)） |
| 展开/折叠 | `expandAllMainTree` / `collapseAllMainTree`、`treeExpandedKeys` |
| 高亮 | `dbChangeMarks` → `getDbChangeMark(data)` 标记「新增 / 差异」（[L3460](file:///e:/Python/AutoTool_Web/frontend/src/views/CANView.vue#L3460)） |
| 高度 | `useResizableSize('dbc-tree-main', 560, 200, 1200)`（[L5204](file:///e:/Python/AutoTool_Web/frontend/src/views/CANView.vue#L5204)）+ `ResizableSplitter` |

数据的**唯一真源**是 `treeData`（`watch(mainDbcTree)` 里 `JSON.parse(JSON.stringify(baseTree))`）：

- 保存：`collectConfigData()` → `buildDbcRawFromSignalRows()`（[L5028](file:///e:/Python/AutoTool_Web/frontend/src/views/CANView.vue#L5028)）读 `treeData` 节点的 `fields` / `msg` / `checked` / `testParams`；
- 加载：`buildTreeFromDict` / `buildDbcTreeFromRaw` → `mergeTestParamsIntoTree` / `autoMatchMissingParams`。

### 1.2 为什么「对照 Excel」不方便

1. 属性是子节点：要逐条展开才能看到「无效值 / Data_Type / Signal_Type / 精度 / 最小最大值…」，无法跨信号按列对齐比较；
2. 列不存在，无法排序/隐藏/批量；
3. 属性**双击编辑不落库**：`_startAttrEdit` 只改 attr 节点自身 `value`，`finishAttrEdit`（[L4525](file:///e:/Python/AutoTool_Web/frontend/src/views/CANView.vue#L4525-L4527)）只结束编辑态；全仓库没有任何 `attr.value → node.fields` 的同步，也没有 `treeData` 的 deep watch → 改了不生效；
4. 树上**没有「测试」勾选**：`el-tree` 未配置 `show-checkbox`，`onTreeCheckChange`（[L4101](file:///e:/Python/AutoTool_Web/frontend/src/views/CANView.vue#L4101)）已定义但未绑定 → 使用者无法切换 `lk`（是否生成用例）。

### 1.3 可复用的既有资产

- **扁平表格的家底还在**：`signalColumns`（19 列定义，[L3079](file:///e:/Python/AutoTool_Web/frontend/src/views/CANView.vue#L3079)）、`signalRows`、`emptySignalRow`、`buildSignalRowsFromRaw`、`applyPayloadToRow` / `applyPayloadToCell`（[L4920-L4975](file:///e:/Python/AutoTool_Web/frontend/src/views/CANView.vue#L4920-L4975)）——原表格模板已被删除，但数据模型与工具函数仍在。
- **Excel 式表格的成熟范式**：[DtcCardList.vue](file:///e:/Python/AutoTool_Web/frontend/src/components/DtcCardList.vue) 已实现列宽自适应/拖拽调节、鼠标拖拽框选（`setSelection`/`clampCell`/`onCellMouseDown`/`onCellMouseEnter`）、TSV 复制粘贴（`buildClipboardText`/`parseClipboard`/`pasteSelection`，含**循环平铺**填充）、单元格内联编辑与 `Delete` 清空。
- **交互函数都是「节点对象」入参**，表格里只要持有对应 `node` 引用即可直接复用：`selectTestParam(node, param)`、`removeTestParam(node, param)`、`isTestParamSelected(node, param)`、`isParamConfigured(param)`、`onTestParamTagDrop(event, node, param)`、`onTreeNodeDragOver/Leave/Drop(event, node)`、`getDbChangeMark(node)`。

---

## 2. 已确认的决策（与你逐条对齐）

| # | 决策 | 取值 |
| --- | --- | --- |
| 1 | 整体形态 | **树 + 表格双视图可切换**（树保持原样，不动其交互） |
| 2 | 分组方式 | **仅按报文一级分组**（报文行作父行，其信号作子行；发送节点退化为列） |
| 3 | 测试参数交互 | **标签 + 下方详情面板**（完全复用现有逻辑与面板） |
| 4 | 一并做进表格 | 列显隐/列顺序、新增/差异高亮、**属性编辑落库**、**「测试」勾选列** |
| 5 | 表格实现 | **基于 `el-table`**（tree-props 分组；列宽拖拽不做） |
| 6 | 数据规模 | 几百行以内，**不做虚拟滚动** |
| 7 | 默认视图 | **默认表格 + localStorage 记住选择** |
| 8 | 勾选批量 | 逐行独立，不级联；另提供**显式批量按钮** |
| 9 | 块粘贴 | **本次实现**（从 Excel 整块复制 → 粘贴） |
| 10 | 三个新增配置字段 | `Vehicle_Speed` / `Fault_Led` / `Fault_Warning` **需要移除**（见 Part B，独立任务） |

---

## 3. Part A：双视图 + 分组表格（本次主体）

### 3.1 新增组件 `frontend/src/components/DbcSignalTable.vue`

把表格渲染与 Excel 式交互下沉到独立组件（对齐 `DtcCardList.vue` 的既有风格），避免 `CANView.vue`（已 7200+ 行）继续膨胀。

**Props**

| 名称 | 类型 | 说明 |
| --- | --- | --- |
| `rows` | `DbcTableRow[]` | 由父组件 computed 产出，含 `children`（信号行）；行对象**引用** `treeData` 里的真实节点 |
| `columns` | `DbcTableColumn[]` | 列定义（见 3.3），组件内部自持「显隐 + 顺序」并持久化到 localStorage |
| `height` | `number` | 表格高度（复用父组件 `dbcTreeHeight`） |
| `isConfigured` | `(param) => boolean` | 直接传 `hasParamData` 的包装 |
| `isParamSelected` | `(node, param) => boolean` | 传 `isTestParamSelected` |
| `changeMarkOf` | `(node) => 'new' \| 'diff' \| null` | 传 `getDbChangeMark` |

**Emits**

| 名称 | 载荷 | 父组件处理 |
| --- | --- | --- |
| `select-param` | `(node, param)` | `selectTestParam(node, param)` |
| `remove-param` | `(node, param)` | `removeTestParam(node, param)` |
| `tag-drop` | `(event, node, param)` | `onTestParamTagDrop(event, node, param)` |
| `tag-drag-over` / `tag-drag-leave` | `(event)` | `onTestParamTagDragOver/Leave` |
| `row-drop` | `(event, node, path \| null)` | `applyPayloadToTreeNode(...)`（见 3.5） |
| `node-drag-over` / `node-drag-leave` | `(event, node)` | `onTreeNodeDragOver/Leave` |
| `check-change` | `(node, checked)` | 复用 `onTreeCheckChange(node, checked)` |
| `cell-commit` | `(node, path, value)` | `setNodeField(node, path, value)`（见 3.4） |
| `batch-test` | `(nodes, checked)` | `batchSetTest(nodes, checked)` |
| `row-select` | `(node)` | `selectedTreeNode = node`（让「删除选中」继续可用） |

**组件内职责**

- `el-table` 配置：`row-key="id"`、`:tree-props="{ children: 'children' }"`、`:data="rows"`、`:height="height"`、`highlight-current-row`、`:cell-class-name`（算框选/高亮/只读态）、`default-expand-all`（几百行可全展开）；
- 单元格内容按 `row.kind`（`message` / `signal`）与列 `scope` 条件渲染；
- 「测试参数」列：渲染 `row.node.testParams` 的标签（`active` / `configured` class + `×`），带 `@click/@dragover/@dragleave/@drop`；
- 「测试」列：自定义 checkbox（`:checked="row.node.checked"` + `@change` → `check-change`）；
- 内联编辑：双击单元格 → 输入框 → Enter/blur 提交 → `cell-commit`（列 `editable === false` 时不响应）；
- **框选 + TSV 复制粘贴**：移植 `DtcCardList.vue` 的算法
  - `selection`（anchor/focus 矩形）+ `cell-class-name` 高亮；
  - `mousedown` / `mouseenter`（用单元格包装 div 上的 `data-row-id` / `data-col-key`）；
  - `Ctrl+C` → `buildClipboardText()`（TSV）；`Ctrl+V` → `parseClipboard()` → 按**可见列顺序**填充选中矩形，**只写可编辑列**，只读列占位但不写值；支持循环平铺；
  - `Delete` / `Backspace` 清空选中区域的可编辑列；
- 「列设置」popover：勾选显隐 + 上移/下移调整顺序 + 恢复默认；状态存 `localStorage['canview_dbc_table_columns']`。

### 3.2 表格数据构建

父组件新增 computed `dbcTableRows`，把 `treeData` **规范化**为「报文父行 + 信号子行」（不复制字段，只做引用）：

```
for senderNode of treeData where type === 'sender':
  messages = senderNode.children.filter(type === 'message')
  // 两种布局都要兼容：
  //  - 配置加载(buildTreeFromDict)：信号在 message.children 里
  //  - DBC 导入(buildDbcTreeFromRaw)：报文与信号平级挂在 sender 下，信号用 msg.msgName 归属
  sigByMsg = group(senderNode.children.filter(type === 'signal')  +  各 message.children 里的 signal, by msg.msgName)
  for msgNode of messages:
    push { id: msgNode.id, kind:'message', node: msgNode, senderName, children: sigByMsg[msgNode.name] }
```

要点：
- **不要直接复用 `node.children`**（里面混着 `attr` 子节点，会被当成表格行渲染）；
- 报文无信号时仍生成父行（`children: []`）；
- 行对象只带 `{ id, kind, node, senderName, children }`，单元格取值在渲染时通过列定义的 `path` 读 `node`。

### 3.3 列定义（父组件常量 `dbcTableColumns`）

`DbcTableColumn = { key, label, en, scope: 'common'|'msg'|'sig', path, editable, defaultVisible, width? }`
`path` 是相对节点/行的取值路径（`name` / `senderName` / `msg.xxx` / `fields.xxx`）。

| 分组 | 列（key） | path | 可编辑 | 默认可见 |
| --- | --- | --- | --- | --- |
| 公共 | 发送节点 `senders` | `senderName` | 否 | ✅ |
| 报文 | 报文名称 `msgName` | `name` | 否（改名会破坏 key/参数映射） | ✅ |
| 报文 | 报文标识符 `msgId` | `msg.msgId` | ✅ | ✅ |
| 报文 | 报文类型 `msgType` | `msg.msgType` | ✅ | 隐藏 |
| 报文 | 报文发送类型 `msgSendType` | `msg.msgSendType` | ✅ | 隐藏 |
| 报文 | 报文周期时间 `msgCycleTime` | `msg.cycle` | ✅ | ✅ |
| 报文 | 报文发送的快速周期 `cycleFast` | `msg.cycleFast` | ✅ | 隐藏 |
| 报文 | 报文快速发送的次数 `nrOfReption` | `msg.nrOfReption` | ✅ | 隐藏 |
| 报文 | 报文长度 `msgLength` | `msg.length` | ✅ | ✅ |
| 报文 | lostDTC `lostDtc` | `msg.lostDtc` | ✅ | ✅ |
| 报文 | dlcDTC `dlcDtc` | `msg.dlcDtc` | ✅ | ✅ |
| 报文 | 报文测试参数 | `testParams` | — | ✅ |
| 信号 | 信号名称 `signalName` | `name` | 否 | ✅ |
| 信号 | 无效值 `invalidValue` | `fields.invalidValue` | ✅ | ✅ |
| 信号 | 数据类型 `dataType` | `fields.dataType` | ✅ | ✅ |
| 信号 | Signal_Type `signalType` | `fields.signalType` | ✅ | ✅ |
| 信号 | DTC `dtc` | 只读（值取自 `tp.*.dtc`） | 否 | ✅ |
| 信号 | 精度 `factor` | `fields.factor` | ✅ | ✅ |
| 信号 | 偏移量 `offset` | `fields.offset` | ✅ | ✅ |
| 信号 | 物理最小值 `minPhy` | `fields.minPhy` | ✅ | ✅ |
| 信号 | 物理最大值 `maxPhy` | `fields.maxPhy` | ✅ | ✅ |
| 信号 | 初始值 `initialValue` | `fields.initialValue` | ✅ | ✅ |
| 信号 | 单位 `unit` | `fields.unit` | ✅ | ✅ |
| 信号 | 值描述 `valueDesc` | `fields.valueDesc` | ✅ | 隐藏 |
| 信号 | 排列格式 `byteOrder` | `fields.byteOrder` | ✅ | ✅ |
| 信号 | 起始字节 `startByte` | `fields.startByte` | ✅ | 隐藏 |
| 信号 | 起始位 `startBit` | `fields.startBit` | ✅ | ✅ |
| 信号 | 位长度 `bitLength` | `fields.bitLength` | ✅ | ✅ |
| 信号 | XCP_CCP_varname `xcpVar` | `fields.xcpVar` | 否 | 隐藏 |
| 信号 | 信号测试参数 | `testParams` | — | ✅ |
| 公共 | 测试（勾选） | `checked` | — | ✅ |

说明与取舍：
- `msgName` / `signalName` 设为**只读**：改名会导致 `testParamMap` key（`msgName:::signalName`）失配、配置无法回读，风险远大于收益；
- 报文级列在**信号行上只读显示**（避免误改整条报文的属性），编辑统一在报文行；
- 「DTC」列**只读**：信号级 DTC 实际存放在 `tp.<type>.dtc`（`buildDbcRawFromSignalRows` 不写 `fields.dtc`），单元格直接改会造成「改了不生效」；编辑路径仍走测试参数详情面板里已有的 DTC 输入框。单元格 tooltip 提示「在测试参数中编辑」；
- 新增 `单位 / 起始字节` 两列并落库（`unit` 已保存；`sbyte` 需补进保存映射，见 3.4）。

### 3.4 属性编辑落库（修复既有缺陷）

现状：`node.fields` 只在树构建时生成，`attr` 子节点是快照，双向都不同步。

**新增父组件函数**

```ts
// 按列 path 写入节点；同时同步对应的 attr 子节点，保证切回树视图显示一致
function setNodeField(node: any, path: string, value: any): void
```

- `path` 形如 `msg.cycle` / `fields.minPhy` / `fields.startByte`：写入对应对象；
- 写入后调用 `syncAttrNodeValue(node, path, value)`：在该节点 `children` 里按 `tableKey` 找到 `attr` 子节点（`type === 'attr'`）并更新 `value`；
- 树视图里双击 `attr` 的既有入口也接到同一条链路：`finishAttrEdit(data)` 里用 `data.parentType` / `data.parentMsg` / `data.parentSignal` 定位父节点（复用 `findNodeInTree`），把 `data.value` 写回 `node.fields[...]` / `node.msg[...]`（**修复「双击属性改了不保存」**）。

**保存映射补齐**（`buildDbcRawFromSignalRows`，[L5084-L5148](file:///e:/Python/AutoTool_Web/frontend/src/views/CANView.vue#L5084-L5148) 两处信号分支）

- 增加 `if (sigNode.fields?.startByte) sigData.sbyte = sigNode.fields.startByte`；
- 读取侧 `buildTreeFromDict` 的 `fields` 补 `startByte: sigData.sbyte || ''`，属性行 `['起始字节','startByte', sigData.sbyte || '']`。
- 影响面：`sbyte` 此前恒为 `0`（无编辑入口、DBC 导入列为空），默认为空 → `sbyte` 仍为 0，生成结果不变；仅当用户在表格里显式填写后才生效（`excel_processor` 的 dict 路径已消费 `sig_data.get('sbyte')`）。

### 3.5 拖拽落点适配

现有 `applyPayloadToRow` / `applyPayloadToCell` 面向扁平的 `SignalRow`；表格用的是树节点。**新增**：

```ts
// payload 来自 ObjectPanel（dtc / a2l-measurement / a2l-characteristic / signal / attr / testParam）
function applyPayloadToTreeNode(payload: any, node: any, path?: string | null): void
```

- `payload.type === 'dtc'` → 若落点是测试参数标签则走既有 `onTestParamTagDrop`；落点为行/单元格时写入该信号 `tp` 中已存在测试参数的 `dtc`（都无则提示先在标签上拖）；
- `payload.type` 为 `a2l-measurement` / `a2l-characteristic` → 落到行/单元格时写入该信号 `FactorTest.params.variable`（等价于拖到标签）；
- `payload.type === 'attr'`（ObjectPanel 的属性对象，带 `tableKey`）→ 若 `path` 与 `tableKey` 一致则写入该单元格；否则按 `tableKey` 写入对应列；
- `payload.type === 'signal'` → 与树一致：作为信号名写入（沿用既有语义）；
- 落点高亮沿用现有 `drag-over` / `test-param-tag-drop-over` 样式。

### 3.6 顶部工具栏与视图切换（`CANView.vue` DBC 页签）

- 新增 `el-radio-group`（`树形图 / 表格`），`dbcViewMode` 初值读 `localStorage['canview_dbc_view_mode']`，**默认 `table`**，变更即写回；
- 「全部展开 / 全部折叠」仅在树视图显示；表格视图改用 `el-table` 自带的展开控制（保留同一对按钮、作用于表格行展开）；
- 「列设置」按钮仅表格视图显示；
- 「添加信号」按钮仅树视图显示（表格没有「新增信号行」的明确语义）；「删除选中」保留（表格行点击会把 `selectedTreeNode` 指向该节点，沿用现有删除逻辑）；
- 搜索框 `dbcSearch` 共用：
  - 树视图：现有 `filterDbcTreeNode`；
  - 表格视图：`filteredDbcTableRows` computed —— 报文命中（报文名或任一报文属性包含关键字）或**其下任一信号命中**则保留该报文行，并把命中的信号行过滤出来；
- 表格与树**共用**同一个 `dbcTreeHeight` + `ResizableSplitter` + `test-param-detail-panel`（后者已由 `selectedTestParam` 驱动，无需改动）。

### 3.7 高亮与勾选

- 新增/差异高亮：行 `row-change-mark` class（`is-new` / `is-diff`）由 `changeMarkOf(row.node)` 计算，颜色沿用现有 `.is-new` / `.is-diff` 变量；
- 「测试」勾选列：自定义 checkbox 直接绑定 `row.node.checked`，变更 emit `check-change` → 复用 `onTreeCheckChange`（**报文行与信号行相互独立，不级联**）；
- 批量：表头区加「批量」按钮组 —— 借助 `el-table` 的行多选（`type="selection"` 列，「测试」列仍是自定义 checkbox，两者职责分离）→ 工具栏「标记测试 / 取消测试」按钮作用于所选行（`batchSetTest(nodes, checked)`，只改 `node.checked`）。

### 3.8 涉及文件

| 文件 | 改动 |
| --- | --- |
| `frontend/src/components/DbcSignalTable.vue` | **新增**：表格渲染 + 列设置 + 内联编辑 + 框选/TSV + 标签交互（emit 给父组件） |
| `frontend/src/views/CANView.vue` | 新增 `dbcViewMode` / `dbcTableRows` / `dbcTableColumns` / `setNodeField` / `syncAttrNodeValue` / `applyPayloadToTreeNode` / `batchSetTest` / `filteredDbcTableRows`；`finishAttrEdit` 落库；保存映射补 `sbyte`；DBC 页签模板加视图切换与表格分支 |
| `frontend/src/utils/dbcTable.ts`（可选） | 若列的读/写路径工具（`getByPath` / `setByPath`）独立成模块更清晰，则抽出；否则内联在组件内 |

> 不改动：`logic of testParamMap` / 配置保存与加载链路 / `ObjectPanel.vue` / `DtcCardList.vue` / 后端生成逻辑。

---

## 4. Part B：移除 `Vehicle_Speed` / `Fault_Led` / `Fault_Warning`（独立小任务）

**背景**：这三个是后加入的「配置参数」字段，用于 DTC 表的特殊判定——DTC 表第 5 列起的「检测对象」列若等于这些信号名，则生成 `SignalWaitCheck(obj, …, 7000/10000)` 而不是 `SignalCheck(...)`。你确认需要移除。

**必须前后端一起改**（`excel_processor` 用 `self.config_data['vehicleSpeed']` 直接下标访问，只删前端会 `KeyError`）：

| 文件 | 改动 |
| --- | --- |
| `frontend/src/views/CANView.vue` | 删除 `configFieldDefs` 中 `vehicleSpeed` / `faultLed` / `faultWarning` 三条（[L2581-L2583](file:///e:/Python/AutoTool_Web/frontend/src/views/CANView.vue#L2581-L2583)） |
| `backend/core/can_module.py` | 删除 `get_default_config_page_data` 中三条默认值（[L805-L807](file:///e:/Python/AutoTool_Web/backend/core/can_module.py#L805-L807)）与 `get_config_key_map` 中三条映射（[L991-L993](file:///e:/Python/AutoTool_Web/backend/core/can_module.py#L991-L993)） |
| `backend/processors/excel_processor.py` | 删除 `_process_dtc_sheet` 里三条 `elif obj == self.config_data[...]` 分支（[L1684-L1692](file:///e:/Python/AutoTool_Web/backend/processors/excel_processor.py#L1684-L1692)），保留 `torqueLimit` 分支 |

**保留不动**：`torqueLimit`（Torque_limit）的既有特殊判定。

**兼容性**：已保存配置里残留的这三个 key 会被忽略（`self.config_data` 是多键字典，多余键无害）；不做事后清洗。

**影响**：DTC 表中名为 `Vehicle_speed` / `Fault_Led` / `Fault_Warning` 的检测对象列，生成结果由 `SignalWaitCheck(..., 10000)` 变为普通 `SignalCheck(...)`（与未配置这些字段时的行为一致）。

---

## 5. 假设与边界

1. 只改 CAN 模块的 **DBC / 报文信号表** 页签；不触碰 `DataLinkLayer`、`DTC`、`其他配置`、`电压`、`配置生成` 页签。
2. 树形图的**功能与交互完全保留**（含 attr 子行、拖拽、高亮、搜索、展开折叠），本次仅改为可切换的一个分支；`signalRows` / `checkMissingSignalAttributes` 的既有链路不动。
3. 表格不做列宽拖拽、不做虚拟滚动、不做固定列（几百行量级可接受；后续如需可再迭代）。
4. `msgName` / `signalName` / `DTC` / 报文级列在信号行上 = 只读。
5. 「测试」勾选 = `node.checked`（`lk`），与保存逻辑一致，不级联。
6. 列显隐/顺序仅本地 `localStorage` 记忆，不写入配置、不随配置分享。
7. Part B 与 Part A 无代码依赖，可单独执行、单独回滚。

---

## 6. 验证步骤

### 6.1 静态检查

```bash
cd e:/Python/AutoTool_Web/frontend && npx vue-tsc --noEmit && npm run build
cd e:/Python/AutoTool_Web && python -m py_compile backend/core/can_module.py backend/processors/excel_processor.py
```

### 6.2 Part A —— Playwright 真实浏览器（dev server `http://localhost:5173/can` + 后端 `127.0.0.1:18735`）

以 `E262S无刷`（无 DLL，103 行）与 `E22H-A2`（含 DLL，235 行）各跑一遍：

1. 进入 DBC 页签 → **默认显示表格**；报文行数 = 该配置的报文数（`E262S无刷` 期望 11），信号行数 = 信号数；
2. 刷新页面 → 仍停在表格视图（记忆生效）；切到树形图，树的内容与切换前一致（属性行、测试参数标签都在）；
3. 「列设置」：隐藏「报文长度」、把「信号名称」移到「无效值」前 → 立即生效；刷新后保持；
4. 点击信号行的 `FactorTest` 标签 → 下方面板展开；改「测试值」→ **保存配置** → 重新加载该配置 → 值仍在（属性/参数双落库）；
5. 双击「物理最大值」单元格改为新值 → 切到树形图看该属性行显示同步 → 保存 → 重新加载 → 值仍在（**修复前不会保存**）；
6. 「测试」列勾选一个信号 → 保存 → 重新加载 → 勾选态保持；多选若干行 → 点「取消测试」→ 批量置为未勾选；
7. 从 Excel 复制 3×2 区域 → 在表格里选中 2×3 区域 → `Ctrl+V` → 按可见列顺序填充（只读列不写值）；`Ctrl+C` 再复制出去与源一致；
8. 从右栏拖一个 DTC 到某信号行的标签上 → 该参数 DTC 被填充；拖一个 A2L 变量到 `FactorTest` 标签 → 变量名被填充；
9. 高亮：先加载配置再导入一个含差异的 DBC → 新增/差异行显示黄色标记（与树视图一致）；
10. 搜索 `x1E5` → 只保留命中信号所在的报文行与其命中信号行；清空后恢复全量；
11. `pageerror` 为空。

### 6.3 Part B —— 移除校验

1. 配置生成页签不再出现 `Vehicle_Speed` / `Fault_Led` / `Fault_Warning` 三个表单项；
2. 用一份 DTC 表中含名为 `Vehicle_speed` 列的配置执行生成 → 不报错，且该列生成结果为 `SignalCheck(...)`（不再是 `SignalWaitCheck(..., 10000)`）；
3. `torqueLimit` 的特殊判定（`SignalWaitCheck(..., 7000)`）行为不变。

---

## 7. 实施顺序建议

1. **Part B**（独立、影响面小、先清干净）；
2. `DbcSignalTable.vue` 骨架 + `dbcTableRows` / `dbcTableColumns` + 视图切换（可读不可编）；
3. 属性编辑落库（`setNodeField` / `syncAttrNodeValue` / `finishAttrEdit` / `sbyte` 保存）；
4. 「测试」勾选列 + 批量按钮；
5. 列设置（显隐/顺序/持久化）；
6. 框选 + TSV 复制粘贴；
7. 拖拽落点（`applyPayloadToTreeNode`）；
8. 搜索过滤、高亮、记忆；
9. 静态检查 + Playwright 验收（6.2）→ CHANGELOG 记录。

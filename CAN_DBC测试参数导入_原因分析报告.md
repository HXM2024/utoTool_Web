# CAN 模块 DBC 表格数据链路 与「Excel 填写测试参数后再导入不显示」原因分析报告

> 分析范围：`frontend/src/views/CANView.vue`、`frontend/src/components/DbcSignalTable.vue`、`frontend/src/utils/dbc.ts`、`frontend/src/api/can.ts`、`backend/api/can_routes.py`、`backend/core/can_module.py`、`backend/services/can_config_excel.py`、`backend/services/config_service.py`。
> 代码基线：CHANGELOG 当前版本 1.0.51（2026-10-31）。
> 本文为只读分析，不含代码修复方案，仅给出链路说明、根因与验证排查步骤。

---

## 0. 结论速览

「Excel 填好测试参数再导入后，DBC 表格没有显示测试参数」并不是单一原因，按发生位置可归为三类：

| 类别 | 机制 | 用户侧典型观感 |
| --- | --- | --- |
| 数据没解析出来 | 工作表名、表头、行结构不符合导入规则，或参数列不存在 | 信号能出来，但参数全空；或整个 DBC 表都空 |
| 数据解析了但没挂上 | `报文名:::信号名` 键不匹配、层级填错、被已有配置参数覆盖 | 只有部分信号有参数；或参数还是导入前的旧值 |
| 数据挂上了但看不见 | 「测试参数」列被隐藏、搜索过滤、页签/视图不对 | 树形图能看到标签，表格视图看不到（或相反） |

本次分析中，概率最高的 6 个非代码因素是：

1. **导出时只导出「表格当前可见列」**：若隐藏了 `发送节点` / `报文名称` / `信号名称`，Excel 缺少参数关联键，信号行甚至会被直接丢弃。
2. **工作表名或表头被改动**：后端只认精确的 `DBC Canmatrix`；平铺参数列按表头**精确、区分大小写**匹配（`LostTest`、`SigInvalidTest_DTC` 等），改名、加空格、合并表头、在上方插标题行都会导致参数列不被识别。
3. **导入时「已有配置参数优先」**：`testParamMap` 中已存在的同 `value` 参数不会被 Excel 中的值覆盖，只补充缺失的参数类型，表现为「填了新值但导入后没变化」。
4. **参数填写层级或行位置错误**：报文级参数（`LostTest` / `DlcTest`）只认该报文**首条记录**（报文行）；信号级参数必须落在对应信号行。
5. **参数完整性不足**：不满足 `hasParamData` 的参数在导出时就被过滤掉（如 `SigInvalidTest` 只填了「报DTC值」却没填 `DTC`、`FactorTest` 只填了测试值却没填变量名）。
6. **校验规则静默纠正/清空**：DTC 非十六进制被清空、`SigInvalidTest` 类型非法被改为 `SigInvalid`、`FactorTest_自动遍历` 非 Y/N 被当作 N、EPS 的 `CRC/Counter` 算法名大小写不匹配则整项移除。

---

## 1. DBC 表格数据来源链路

### 1.1 前端数据获取接口

| 业务动作 | 前端函数（[can.ts](file:///e:/Python/AutoTool_Web/frontend/src/api/can.ts)） | HTTP 接口 | 请求体 | 后端入口 |
| --- | --- | --- | --- | --- |
| Excel 导入（含 DBC/DTC/链路层/配置页） | `parseCAN(file)` | `POST /api/can/parse` | `multipart/form-data`，字段名 `file` | [parse_excel](file:///e:/Python/AutoTool_Web/backend/api/can_routes.py) → [import_excel](file:///e:/Python/AutoTool_Web/backend/core/can_module.py#L240-L333) |
| 导入 `.dbc` | `parseDbcFile(file)` | `POST /api/can/parse-dbc` | `multipart`，字段 `file`，后缀必须 `.dbc` | `_parse_dbc_file` |
| 从 CFG 目录解析 DBC | `parseDbcFromCfgDir(cfgDir, dbcPaths)` | `POST /api/can/parse-dbc-from-cfg-dir` | JSON `{cfg_dir, dbc_paths}` | 目录扫描 / CANoe 实例引用 |
| 解析 `.cfg` | `parseCfgFile` / `parseCfgCanoe` / `parseCfgFromPath` | `/api/can/parse-cfg`、`/parse-cfg-canoe`、`/parse-cfg-path` | multipart 或 JSON `{path}` | `parse_cfg_*` |
| 解析 A2L / MAPXML | `parseA2lFile` / `parseA2lFileFromPath` / `parseMapxmlFile` | `/api/can/parse-a2l*`、`/parse-mapxml` | multipart 或路径 | 对应 parser |
| 导出 Excel | `exportConfigExcel(data, name, savePath, columns)` | `POST /api/can/export-excel` | JSON `{data, name, save_path, columns}` | [export_config_xlsx](file:///e:/Python/AutoTool_Web/backend/services/can_config_excel.py#L446) |
| 生成脚本 | `generateCAN` / `generateCanoeConfigFromTree` | `POST /api/can/generate` | JSON | `can_routes` |
| 配置加载/保存 | [config.ts](file:///e:/Python/AutoTool_Web/frontend/src/api/config.ts) `getConfig` / `saveConfig` / `deleteConfig` / `copyConfig` / `pullConfig` / `pushConfig` | `/api/can/configs/...` | JSON | `config_routes` + `ConfigService` |

统一 Axios 实例：[client.ts](file:///e:/Python/AutoTool_Web/frontend/src/api/client.ts)，`baseURL: '/api'`，`timeout: 30000`（30 秒）。响应拦截器对任何 HTTP 错误统一弹 `ElMessage.error`。

### 1.2 数据存储位置

**前端内存（Vue ref / Pinia）**

| 数据 | 位置 | 说明 |
| --- | --- | --- |
| 上传文件原始表 | `dbcRaw`（[CANView.vue#L1793](file:///e:/Python/AutoTool_Web/frontend/src/views/CANView.vue#L1793-L1794)） | `{columns, rows}`，上传 Excel/DBC 的 DBC 工作表 |
| 配置 JSON 中的 DBC | `jsonDbcRaw`（[L1797](file:///e:/Python/AutoTool_Web/frontend/src/views/CANView.vue#L1797)） | 从配置 `DBC Canmatrix` 恢复 |
| CFG 目录解析的 DBC | `store.objCfgDbcRaw`（[modules.ts](file:///e:/Python/AutoTool_Web/frontend/src/stores/modules.ts)） | 全局共享，优先级最低 |
| 生效的数据源 | `mergedDbcRaw` 计算属性（[L1805-L1817](file:///e:/Python/AutoTool_Web/frontend/src/views/CANView.vue#L1805-L1817)） | **上传 > 配置 JSON > CFG** |
| 扁平信号行模型 | `signalRows`（[L4317](file:///e:/Python/AutoTool_Web/frontend/src/views/CANView.vue#L4317)） | 同步持久化到 `localStorage.canview_signal_rows` |
| 测试参数唯一索引 | `testParamMap: Map<string, any[]>`（[L1829](file:///e:/Python/AutoTool_Web/frontend/src/views/CANView.vue#L1829-L1833)） | key = `报文名` 或 `报文名:::信号名` |
| 树形图数据 | `mainDbcTree` → `treeData`（[L6014-L6076](file:///e:/Python/AutoTool_Web/frontend/src/views/CANView.vue#L6014-L6076)） | 节点上挂 `testParams` |
| 表格行 | `dbcTableRows` / `filteredDbcTableRows`（[L5571-L5613](file:///e:/Python/AutoTool_Web/frontend/src/views/CANView.vue#L5571-L5613)） | 报文父行 + 信号子行，引用 `treeData` 真实节点 |
| 列显隐/顺序/列宽 | `dbcColumnState` + `localStorage.canview_dbc_table_columns_v3`（[L5433](file:///e:/Python/AutoTool_Web/frontend/src/views/CANView.vue#L5433-L5476)） | 跨会话保留 |
| 视图模式 | `dbcViewMode` + `localStorage.canview_dbc_view_mode`（[L5390](file:///e:/Python/AutoTool_Web/frontend/src/views/CANView.vue#L5390)） | `tree` / `table` |

**后端 / 磁盘**

| 数据 | 位置 | 说明 |
| --- | --- | --- |
| 配置本体 | `configs/CAN/remote_configs/<配置名>/latest.json` | 由 [config_service.py](file:///e:/Python/AutoTool_Web/backend/services/config_service.py) 读写，`latest.json` 内含 `DBC Canmatrix` / `DTC` / `DataLinkLayer` / `Configuration` |
| CRC 算法候选 | `configs/global/crc_algorithms.json` | 导出时用于数据验证下拉，也决定 EPS `CRC/Counter` 的合法值 |
| 上传临时文件 | `file_service.save_upload` 产生的临时路径 | 解析完成后在 `finally` 中删除，不作为长期存储 |
| Excel 导出文件 | 用户在「另存为」中选择的路径（Electron）；Web 环境回退为浏览器下载 | 导出后即为用户本地文件，程序不再持有 |

### 1.3 数据映射关系

#### 1.3.1 表格列 → `DbcRecord` → 树节点

`parseDbcRecords`（[dbc.ts#L268-L434](file:///e:/Python/AutoTool_Web/frontend/src/utils/dbc.ts#L268-L434)）先把 `{columns, rows}` 按列名归一化匹配：

- 归一化规则：转小写、去除空白/换行/下划线/斜杠（[norm L62-L64](file:///e:/Python/AutoTool_Web/frontend/src/utils/dbc.ts#L62-L64)）。
- 普通字段用**包含匹配**（`findIdx`），`Test` 用**精确匹配**（`findExactIdx`），DTC 用排除法（排除 `lostDTC` / `dlcDTC` / `报DTC`），参数类列不参与普通字段匹配。
- 报文级字段做**前向填充**（模拟合并单元格），并只在检测到新报文时重置继承值（[L359-L431](file:///e:/Python/AutoTool_Web/frontend/src/utils/dbc.ts#L359-L431)）。
- 无「发送节点」列时，从报文名 `HCU_0x201` 推断发送节点（[L250-L266](file:///e:/Python/AutoTool_Web/frontend/src/utils/dbc.ts#L250-L266)）。

| Excel 列（表头可含中英文换行） | `DbcRecord` 字段 | 树节点 |
| --- | --- | --- |
| `发送节点 / Senders` | `senders` | sender 节点名 |
| `报文名称 / Msg_Name` | `msgName` | message 节点 `name` / `msg.msgName` |
| `报文标识符 / Msg_ID` | `msgId` | `msg.msgId` |
| `报文周期时间` / `报文长度` | `cycle` / `length` | `msg.cycle` / `msg.length` |
| `信号名称 / Signal_Name` | `signalName` | signal 节点 `name` |
| `精度` / `偏移量` / `物理最小/最大值` / `初始值` / `无效值` / `信号值描述` | `factor` / `offset` / `minPhy` / `maxPhy` / `initialValue` / `invalidValue` / `valueDesc` | `fields.*` |
| `测试参数`（表格可读列） | `paramCells[0]`（8 明细列之一） | `testParams` |
| `报文测试参数` / `信号测试参数`（旧 JSON 列） | `msgTestParams` / `sigTestParams` | `testParams` |
| 12 个平铺参数列（`LostTest` 等） | `flatParamCells` | `testParams` |

#### 1.3.2 测试参数的三种格式与解析优先级

| 格式 | 特征 | 解析函数 | 优先级 |
| --- | --- | --- | --- |
| 旧 JSON 列 | 表头含「报文测试参数 / 信号测试参数」，单元格是 JSON 数组 | `parseParamJson`（[L4484-L4502](file:///e:/Python/AutoTool_Web/frontend/src/views/CANView.vue#L4484-L4502)） | 最高 |
| 8 列明细 | `测试参数 / 报DTC值 / 不报DTC值 / DTC / 变量名 / 测试值 / 自动遍历 / 类型`，表头换行前必须**完全等于**标签；单元格内用换行按行对齐 | [parseParamColumns](file:///e:/Python/AutoTool_Web/frontend/src/utils/dbc.ts#L159-L180) | 次之 |
| 12 列平铺 | 每类参数每字段一列，表头精确等于列名 | [parseFlatParamCells](file:///e:/Python/AutoTool_Web/frontend/src/utils/dbc.ts#L222-L248) | 再次 |
| 旧列自动推断 | 无任何参数配置时，按 `Test=Y`、`lostDTC/dlcDTC/DTC/Signal_Type/Data_Type/XCP` 自动生成 | `buildAutoMsgTestParams` / `buildAutoSigTestParams` | 兜底 |

参数 key 规则（[L1831-L1833](file:///e:/Python/AutoTool_Web/frontend/src/views/CANView.vue#L1831-L1833)）：

- 报文级：`msgName`
- 信号级：`msgName:::signalName`

#### 1.3.3 导出时的反向映射

`onExportExcel`（[L7950-L7984](file:///e:/Python/AutoTool_Web/frontend/src/views/CANView.vue#L7950-L7984)）→ `collectConfigData`（[L7756](file:///e:/Python/AutoTool_Web/frontend/src/views/CANView.vue#L7756)）→ `buildDbcRawFromSignalRows`（[L7185-L7321](file:///e:/Python/AutoTool_Web/frontend/src/views/CANView.vue#L7185-L7321)）：

- 结构：`{ sender: { msgName: { id, cy, ln, ld, dd, mst, mt, lk, tp, signals: { sigName: { lk, dt, fc, ..., et, did, tp } } } } }`
- 报文级参数写入 `tp`，EPS 参数写入 `et` + `did`，信号级参数写入 `tp`。
- **只有 `hasParamData(p)` 为真的参数才会被写出**（[L7206-L7214](file:///e:/Python/AutoTool_Web/frontend/src/views/CANView.vue#L7206-L7214)、[L7246-L7255](file:///e:/Python/AutoTool_Web/frontend/src/views/CANView.vue#L7246-L7255)）。
- 同级信号分支要求 `child.msg?.msgName` 非空，否则 `continue` **整条信号被丢弃**（[L7264-L7267](file:///e:/Python/AutoTool_Web/frontend/src/views/CANView.vue#L7264-L7267)）。

后端 `build_matrix_rows`（[L358-L407](file:///e:/Python/AutoTool_Web/backend/services/can_config_excel.py#L358-L407)）：

- 嵌套字典 → 每报文一行「报文行」+ 每信号一行「信号行」。
- 报文级列只在报文行有值，信号行留空（导入端靠前向填充还原）。
- 若可见列里有 `测试参数`（key=`params`），该列被 **12 个平铺参数列原位替换**；若该列被隐藏，则平铺列**追加在末尾**。两种情况下平铺列都会存在。
- 若 `dbc_data` 已是 `{columns, rows}`，**原样透传**，不会追加平铺列（[L367-L370](file:///e:/Python/AutoTool_Web/backend/services/can_config_excel.py#L367-L370)）。

### 1.4 与后端服务的交互时序

**导入 Excel**

```
用户拖拽/选择文件
  → onUnifiedFileChange (CANView.vue L8346)
  → parseCAN → POST /api/can/parse
  → CANModule.import_excel
       校验文件存在/非空/魔数 PK
       pandas.read_excel(sheet_name=None, engine=openpyxl, dtype=str)
       取 "DBC Canmatrix" / "DTC" / "Configuration" / DataLinkLayer
       NaN → None，其余 → str
  ← { DBC:{columns,rows}, DTC:{...}, Configuration:{...} }
  → dbcRaw = parsed.DBC
  → signalRows = buildSignalRowsFromRaw(parsed.DBC)   ← 同时重建 testParamMap
  → 若 parsed.DBC 存在：activeTab='dbc'，100ms 后检查缺失属性
  → mergedDbcRaw 变化 → mainDbcTree 重建 → watch(mainDbcTree)
        treeData = 深拷贝
        autoMatchTestParams + mergeTestParamsIntoTree
  → buildDbcTableRows(treeData) → DbcSignalTable 渲染
```

**加载配置**

```
getConfig('can', name) → /api/can/configs/<name>
  → dbcRaw = null（清空上传数据，避免上传优先级压过配置）
  → applyConfigData → jsonDbcRaw = 配置里的 DBC Canmatrix
  → treeData 重建，节点 testParams 来自配置的 tp/et
  → nextTick 后 autoMatchMissingParams（只补缺失参数，不覆盖）
```

**导出 Excel**

```
onExportExcel
  → dbcTableVisibleColumns（当前可见列）
  → collectConfigData()：treeData 非空则 buildDbcRawFromSignalRows()，否则用 dbcRaw/jsonDbcRaw 原样数据
  → POST /api/can/export-excel {data, name, save_path, columns}
  → build_matrix_rows → export_config_xlsx 写 xlsx
     （DBC Canmatrix / DTC / DataLinkLayer；表头 中文\n英文；平铺列数据验证）
```

### 1.5 渲染链路与依赖

```
treeData (真实节点，含 node.testParams)
  ├─ 树形图：el-tree 直接读 data.testParams，标签始终渲染
  └─ 表格视图：buildDbcTableRows
        sender → message 行 + 信号子行
        DbcSignalTable 的 params 列渲染 row.node.testParams 标签
```

触发条件：

- `watch(mainDbcTree)`：`treeData` 整体重建，随后合并参数（[L6014-L6076](file:///e:/Python/AutoTool_Web/frontend/src/views/CANView.vue#L6014-L6076)）。
- `watch(testParamMap)`：仅把参数重新合并到**现有** `treeData`（[L6079-L6083](file:///e:/Python/AutoTool_Web/frontend/src/views/CANView.vue#L6079-L6083)）。
- 表格列过滤：`dbcOrderedColumns.filter(c => c.visible)`；`params` 列默认可见（[L5428](file:///e:/Python/AutoTool_Web/frontend/src/views/CANView.vue#L5428)），但显隐状态会被 localStorage 持久化。
- 行过滤：`filteredDbcTableRows` 受 `dbcSearch` 关键字影响。

---

## 2. 导出 → 填写 → 导入 全链路的成功条件

| 步骤 | 成功条件 | 失败时的表现 |
| --- | --- | --- |
| 1. 导出前选择配置 | `currentConfig` 非空 | 提示「请先选择配置」，不导出 |
| 2. 确定导出列 | `发送节点`、`报文名称`、`信号名称` 至少覆盖参数关联所需键；`Test` 列建议保留 | Excel 缺列，导入后信号/报文键为空，参数无法关联 |
| 3. 序列化数据 | `treeData` 非空，走嵌套字典分支 | 走 `{columns,rows}` 原样透传，**不会追加 12 个平铺参数列** |
| 4. 参数完整性 | 每个参数满足 `hasParamData` | 该参数被静默过滤，Excel 中对应列为空 |
| 5. 后端展开行 | 每报文先报文行、后信号行；报文级字段只在报文行 | 手工排序/删行后报文级字段错位 |
| 6. 填写参数 | 报文级 `LostTest/DlcTest` 填在报文行；其余填在信号行；表头保持原样 | 参数被记到错误 key，或不显示 |
| 7. 保存文件 | 仍是包含 `DBC Canmatrix` 的 `.xlsx`；未加密、未改表名 | 后端读不到 DBC，前端仍提示「Excel 解析成功」 |
| 8. 导入解析 | 平铺列名精确匹配；8 明细列表头精确匹配；报文级字段可前向填充 | 参数列为空或被当作别的字段 |
| 9. 参数校验 | 值符合 `sanitizeImportedParams` 规则 | 参数被清空/改值/整项移除，仅弹汇总提示 |
| 10. 与旧参数合并 | 目标 key 在 `testParamMap` 中不存在，或参数 `value` 不存在 | 同 `value` 保留旧值，新填内容不覆盖 |
| 11. 生成树与渲染 | key 与树节点一致；`测试参数` 列可见；无搜索过滤 | 参数存在但界面不显示 |

---

## 3. 四维度根因分析

### 3.1 维度一：Excel 导入的文件解析规则与字段映射逻辑

**规则 1：文件与工作表**

- 后端只接受 `.xlsx`（`pandas.read_excel(engine='openpyxl')`），且先校验文件头 Magic 必须为 `PK`；空文件直接抛错。
- 工作表名**精确匹配** `DBC Canmatrix`（[can_module.py#L240-L333](file:///e:/Python/AutoTool_Web/backend/core/can_module.py#L240-L333)）。
- `DTC`、`DBC Canmatrix` 缺失时只写 `warning` 日志，**仍返回成功**。因此「缺 DBC 表」在 UI 上表现为「Excel 解析成功」，但 `parsed.DBC` 为空、DBC 页签不刷新（[CANView.vue#L8372-L8393](file:///e:/Python/AutoTool_Web/frontend/src/views/CANView.vue#L8372-L8393)）。
- DataLinkLayer 表名兼容 `data link` / `datalink` / `dll`（含子串匹配）；其余表必须精确。

**规则 2：表头识别**

| 识别对象 | 规则 | 敏感点 |
| --- | --- | --- |
| 12 个平铺参数列 | `表头.split('\n')[0].trim() === 列名`（[dbc.ts#L286-L290](file:///e:/Python/AutoTool_Web/frontend/src/utils/dbc.ts#L286-L290)） | 区分大小写；`CRC/Counter` 含斜杠；`SigInvalidTest_报DTC值` 的中文后缀不能改；不能加前缀/后缀 |
| 8 个明细列 | 表头换行前那段 `===` 中文标签（[findParamDetailIdx L141-L144](file:///e:/Python/AutoTool_Web/frontend/src/utils/dbc.ts#L141-L144)） | `测试参数`、`报DTC值`、`不报DTC值` 等必须一字不差 |
| 普通字段 | 归一化后**子串包含**（[L62-L74](file:///e:/Python/AutoTool_Web/frontend/src/utils/dbc.ts#L62-L74)） | 合并表头会产生 `Unnamed: N`；列名前缀可能误命中其它字段 |
| `Test` | 归一化后完全等于 `test`（[L94-L101](file:///e:/Python/AutoTool_Web/frontend/src/utils/dbc.ts#L94-L101)） | 精确匹配，`Test(Y/N)` 这类改写会失效 |

**规则 3：行结构与报文归属**

- 报文级字段只写在报文行，信号行留空；导入端按 `msgId`（缺失时回退 `msgName`）检测报文边界并前向填充（[L406-L421](file:///e:/Python/AutoTool_Web/frontend/src/utils/dbc.ts#L406-L421)）。
- 报文级参数（`LostTest` / `DlcTest`）按 `seenMsgKeys` **每个报文只处理第一条记录**；旧 JSON 列按报文取第一个非空值（[CANView.vue#L4524-L4556](file:///e:/Python/AutoTool_Web/frontend/src/views/CANView.vue#L4524-L4556)）。
- 信号级参数用 `${msgName}:::${signalName}` 建键（[L4557-L4565](file:///e:/Python/AutoTool_Web/frontend/src/views/CANView.vue#L4557-L4565)）；`msgName` 为空时键退化为 `:::信号名`。

**规则 4：参数优先级**

JSON 列 > 8 明细列 > 12 平铺列 > 自动推断。只要高优先级格式里解析出参数，低优先级格式整体被忽略。

**会导致「解析不到参数」的典型输入**

1. 工作表被重命名（如 `DBC CANMatrix`、`DBC_Canmatrix`），或另存时只保留一个 Sheet。
2. 在表头上方插入标题行/说明行 → pandas 把标题行当表头，真实表头变成第一行数据。
3. 选中整块区域另存、表头单元格合并 → 其它列变 `Unnamed: N`。
4. 平铺列名被改（`LostTest ` 带尾随空格尚可被 `trim` 兼容；`losttest`、`Lost Test`、`参数_LostTest` 均失败）。
5. 把参数写进被隐藏/新增的列，而该列表头不是规范列名。
6. 导出时 `测试参数` 列被隐藏且数据走了 `{columns,rows}` 透传分支 → 没有平铺列，`测试参数` 单列的正文不会按 JSON/平铺语义解析。
7. 报文名称列缺失、仅保留报文标识符 → 前向填充得到空 `msgName`，关键键变成 `:::信号名`，且表格分组时信号可能整行不显示（见 3.3）。

### 3.2 维度二：前端导入数据的格式校验规则与过滤逻辑

**校验链**：`buildSignalRowsFromRaw` 末尾调用 `sanitizeImportedParamMap` → `sanitizeImportedParams`（[L4155-L4220](file:///e:/Python/AutoTool_Web/frontend/src/views/CANView.vue#L4155-L4220)）。

| 规则 | 处理 | 用户可见结果 |
| --- | --- | --- |
| EPS `target==='eps'` 的 `value` 必须是 `Counter` 或已注册 CRC 算法名（**大小写敏感的精确匹配**，`new Set(crcAlgorithms).has(value)`） | 不匹配则**整项移除** | 信号上完全没有 CRC/Counter 卡片 |
| `CRC` 算法列表尚未加载（集合为空） | 不判定，保留 | 不会误删 |
| `SigInvalidTest.invalidType` 不在 `SigInvalid / SigvalueInvalid`（忽略大小写） | 改为 `SigInvalid` | 卡片还在，类型被改 |
| `FactorTest.autoRange` 非布尔 | Y/是/true/1 → true；N/否/false/0 → false；其它 → N | 显示为 N |
| `DTC` 非 `0x`+十六进制 / 裸十六进制 | 清空 | 卡片还在，DTC 为空；`LostTest/DlcTest` 因此不再满足完整性 |
| 参数列表为空（被全部移除） | 该 key 不写入 `testParamMap` | 完全无该对象的参数 |

**完整性过滤 `hasParamData`**（[L6113-L6143](file:///e:/Python/AutoTool_Web/frontend/src/views/CANView.vue#L6113-L6143)）：

| 参数 | 判定为「有数据」的条件 |
| --- | --- |
| `LostTest` / `DlcTest` | `dtc` 非空 |
| `CRCTest` / `CounterTest` | `dtc` 非空 |
| `SigInvalidTest` | `(dtcValue \|\| noDtcValue)` 且 `(!dtcValue \|\| dtc)` |
| `FactorTest` | `variable` 非空 |

该函数在**导出**时决定参数是否写入 `tp`，也决定导入后卡片 `enabled` 状态。注意：`enabled=false` 只影响样式/生成逻辑，不影响在表格里显示标签；但**导出时会被直接过滤**，所以「填了但没填全」的参数根本不会出现在下一次导出的 Excel 里。

**合并逻辑（最容易被误判为「没导入」）**：

`buildSignalRowsFromRaw` 末尾会读取当前 `testParamMap` 作为 `prevParams`（[L4593-L4618](file:///e:/Python/AutoTool_Web/frontend/src/views/CANView.vue#L4593-L4618)）：

- 旧 map 有、新 map 无的 key → 旧参数整体保留。
- 两边都有的 key → 以旧参数为基底，只补充「旧参数中没有的 `value`」；`target==='eps'` 的新参数直接跳过。
- 也就是说：**同一个参数类型，Excel 里的新 DTC / 新变量名 / 新测试值不会覆盖已加载配置中的旧值**。

触发条件很宽：只要导入前 `testParamMap` 非空（例如先加载了配置、或之前导入过 DBC、或页面恢复过 `signalRows`），该逻辑就生效。再加上 `watch(mergedDbcRaw)` 会让 `buildSignalRowsFromRaw` **再次执行**（[L6674-L6676](file:///e:/Python/AutoTool_Web/frontend/src/views/CANView.vue#L6674-L6676)），第二次执行时第一次的结果又成了「旧参数」，进一步强化「旧值优先」。

**其它过滤**

- `filteredDbcTableRows` 应用 `dbcSearch` 关键字；搜索框残留会让目标行不渲染。
- `dtcRaw` 导入后走 `sanitizeImportedDtcTable`，与测试参数无直接关系，但可能弹提示造成「导入有问题」的误判。

### 3.3 维度三：导入数据与 DBC 表格现有数据的匹配关联机制

**匹配键**

- 报文：`msgName`（不是 `msgId`）。
- 信号：`msgName:::signalName`（区分大小写、区分空格）。

**树节点侧取值**

`mergeTestParamsIntoTree`（[L4809-L4834](file:///e:/Python/AutoTool_Web/frontend/src/views/CANView.vue#L4809-L4834)）：

```text
message 节点 key = getTestParamsKey(node.name)
signal  节点 key = getTestParamsKey(node.msg?.msgName || node.msg?.name, node.name)
```

因为 `buildDbcTreeFromRaw` 里 signal 节点的 `msg` 引用的是所属报文的 `msg` 对象（`msg.msgName` 取该报文首条记录），所以正常情况 key 与导入解析一致。

**断链场景**

| 场景 | 断链原因 | 结果 |
| --- | --- | --- |
| Excel 缺「报文名称」，只有「报文标识符」 | 树里 message 的 `name` 退化为 `msgId`，signal 的 `msg.msgName` 仍为空；表格 `buildDbcTableRows` 用 `s.msg?.msgName` 与 `m.name` 分组，两者不等 | **信号子行整行不出现在表格里**（参数自然也无处显示） |
| Excel 改写了信号名的大小写/空格/前后缀 | `msgName:::signalName` 与树节点 `name` 不完全一致 | 参数挂在 `testParamMap` 里，但合并时找不到节点，界面无标签 |
| 报文名被改（多/少空格、大小写） | 同上 | 整报文参数丢失 |
| 删除报文行、按某列排序、自动筛选后另存 | 报文级字段前向填充顺序被破坏，信号被归到错误报文或 `Unknown` | 参数挂错报文，原报文下无参数 |
| 合并单元格跨报文 | `msgId` 未变化，前向填充不重置 | 后续报文继承前一报文名/ID |
| 报文级参数填到信号行 | 只取每个报文首条记录，信号行上的 `LostTest/DlcTest` 被忽略（且 8 明细列对报文级只读首条） | 报文行无参数 |
| 信号级参数填到报文行 | 报文行解析为 message target，信号节点不会拿到 | 信号无参数 |
| 同名信号跨多个报文 | key 带报文名，理论无误；但报文名缺失时退化为 `:::信号名` | 多个信号互相覆盖 |
| 多套配置混用导出的表 | 报文/信号集合不同，key 不存在于当前树 | 参数全部无法关联 |

**EPS 参数的特殊匹配**

- 平铺列 `CRC/Counter` → 还原为 `target='eps'`，放在参数数组最前（[dbc.ts#L228-L247](file:///e:/Python/AutoTool_Web/frontend/src/utils/dbc.ts#L228-L247)）。
- 8 明细列/旧 JSON 中，信号级参数名不在 `CRCTest / CounterTest / SigInvalidTest / SigvalueInvalidTest / FactorTest` 时被当作 EPS（[CANView.vue#L4506-L4514](file:///e:/Python/AutoTool_Web/frontend/src/views/CANView.vue#L4506-L4514)）。
- 匹配算法名时走 `sanitizeImportedParams` 的大小写敏感集合判定，名字不一致会被移除。

### 3.4 维度四：前端数据渲染的触发条件与依赖关系

渲染需要同时满足以下 4 个条件，任一不满足都会表现为「没有测试参数」：

1. **数据进入 `testParamMap`**：解析优先级正确、未被校验移除。
2. **`treeData` 被重建**：`mainDbcTree` 变化触发 watcher（导入新 DBC 会触发）；只有 `testParamMap` 变化时走轻量合并 watcher，但要求 `treeData` 非空（[L6079-L6083](file:///e:/Python/AutoTool_Web/frontend/src/views/CANView.vue#L6079-L6083)）。
3. **参数 key 命中树节点**：见 3.3。
4. **UI 可见**：
   - `activeTab === 'dbc'`（仅当 `parsed.DBC` 存在时才自动切换，[L8386-L8392](file:///e:/Python/AutoTool_Web/frontend/src/views/CANView.vue#L8386-L8392)）。
   - `dbcViewMode` 为 `tree` 时看树节点标签；为 `table` 时看 `params` 列。
   - `params` 列 `visible=true`；该状态来自 localStorage `canview_dbc_table_columns_v3`，**可能在上次会话被隐藏**。
   - `dbcSearch` 为空或关键字命中目标行。
   - 表格行结构完整（sender 节点 → message 节点 → signal 子行）。

补充：`DbcSignalTable` 中 `isConfigured` 只控制标签颜色（灰色/绿色），**不控制是否渲染**；`testParams` 非空即渲染（[DbcSignalTable.vue](file:///e:/Python/AutoTool_Web/frontend/src/components/DbcSignalTable.vue)）。

---

## 4. 非代码层面因素清单与验证排查步骤

> 下列均为「数据/操作/环境」因素，不含代码修复建议。

### P0 — 高概率、可优先自查

#### A1. 导出时关键列被隐藏

- **机制**：导出列 = `dbcTableVisibleColumns`（[L7966-L7973](file:///e:/Python/AutoTool_Web/frontend/src/views/CANView.vue#L7966-L7973)）。隐藏 `发送节点` / `报文名称` / `信号名称` 后，Excel 缺关联键；缺报文名时同级信号可能被 `if (!msgName) continue` 丢弃。
- **表现**：Excel 里参数列有值，但导入后信号行缺失或参数全空。
- **验证步骤**：
  1. 打开导出文件，确认表头同时存在 `发送节点`、`报文名称`、`信号名称`（或对应英文列）。
  2. 对比导出前 APP 的「列设置」勾选状态，确认这三列当时可见。
  3. 确认报文行有 `报文名称`，信号行虽有合并但前向填充可覆盖。
  4. 若缺列，重新导出并保留这三列后再填写，作为对照实验。

#### A2. 工作表名被改动 / 另存丢失工作表

- **机制**：后端精确匹配 `DBC Canmatrix`；缺失仅 warning。
- **表现**：提示「Excel 解析成功」，但 DBC 页签内容不变；`DTC` 可能正常。
- **验证步骤**：
  1. 查看工作表标签拼写、大小写、是否多空格。
  2. 确认文件里确实有 `DBC Canmatrix`、`DTC` 两张表（不是复制到新工作簿时只带了一张）。
  3. 观察导入后是否弹「Excel 解析成功」但信号数量标签未变化。
  4. 用原始导出文件（未改动）直接导入做对照，判断是否为改表名导致。

#### A3. 表头被修改或结构被破坏

- **机制**：12 平铺列/8 明细列均为精确匹配（区分大小写、换行前文本全等）。
- **表现**：信号/其他字段正常，唯独参数为空；控制台出现 `[dbc] 以下列未找到` 警告。
- **验证步骤**：
  1. 逐字比对平铺列表头：`LostTest`、`DlcTest`、`CRC/Counter`、`CRCTest_DTC`、`CounterTest_DTC`、`SigInvalidTest`、`SigInvalidTest_报DTC值`、`SigInvalidTest_不报DTC值`、`SigInvalidTest_DTC`、`FactorTest_变量名`、`FactorTest_测试值`、`FactorTest_自动遍历`。
  2. 检查是否在上方插入过标题行、是否合并过表头、是否有 `Unnamed: N` 列。
  3. 检查是否给列名加了前缀/后缀、是否把 `_` 改成空格、是否把 `报DTC值` 写成 `报DTC 值`。
  4. 打开浏览器/Electron 开发者工具 Console，确认 `[dbc] parseDbcRecords` 打印的列名与预期一致（[dbc.ts#L274-L276](file:///e:/Python/AutoTool_Web/frontend/src/utils/dbc.ts#L274-L276)）。

#### A4. 参数填写层级 / 行位置错误

- **机制**：报文行与信号行的参数分别写入不同 key；报文级只取首条记录。
- **表现**：信号参数齐全，但报文级 `LostTest/DlcTest` 不显示；或反之。
- **验证步骤**：
  1. 确认 `LostTest` / `DlcTest` 填在**每个报文的第一行**（报文行，信号名称列为空的那行）。
  2. 确认其余参数填在**信号名称非空**的行。
  3. 对照导出文件的行结构：每报文先一行报文行，再若干信号行。
  4. 若曾排序/筛选/删行，重新导出原始文件对照行位置。

#### A5. 导入前的已有配置参数覆盖新值

- **机制**：`prevParams` 合并时「配置优先」，同 `value` 不覆盖（[L4593-L4616](file:///e:/Python/AutoTool_Web/frontend/src/views/CANView.vue#L4593-L4616)）。
- **表现**：导入成功，参数卡片仍在，但 DTC/变量名/测试值是旧的；新增参数类型能出现，修改的旧参数不生效。
- **验证步骤**：
  1. 导入前记录当前配置名与页面上的参数值。
  2. 确认导入时是否已加载过配置（顶部配置选择器有值）或之前导入过 DBC。
  3. 在 Excel 中把某参数改成**完全不同的值**（如 DTC 换一个），导入后对比：若仍是旧值，即命中该机制。
  4. 做对照：刷新/新建空白配置后再导入同一文件，观察新值是否出现（仅用于定位，不是修复）。

#### A6. 参数完整性不足（导出时就被过滤）

- **机制**：`hasParamData` 要求关键字段齐全（见 3.2）。
- **表现**：Excel 中对应列本来就是空；用户以为「填了」，实际只填了非必需字段。
- **验证步骤**：
  1. `LostTest` / `DlcTest` / `CRCTest` / `CounterTest`：确认 `DTC` 列有合法十六进制值。
  2. `SigInvalidTest`：确认「报DTC值」或「不报DTC值」至少填一个，且填了「报DTC值」时 `DTC` 必须同时填。
  3. `FactorTest`：确认「变量名」非空（只填测试值不算）。
  4. 在 APP 中查看该参数标签是否为灰色（灰色表示 `enabled=false`，下次导出会被过滤）。

#### A7. 关联键不一致（报文名/信号名被改或行结构错位）

- **机制**：key = `msgName` / `msgName:::signalName`，大小写与空格敏感。
- **表现**：部分信号有参数、部分没有；或整报文参数消失；或表格里信号行整行不见。
- **验证步骤**：
  1. 对比 Excel 与 APP 树中的报文名/信号名，逐字符核对（含大小写、空格、前后缀）。
  2. 检查是否只保留了 `报文标识符` 而删除了 `报文名称` 列。
  3. 检查是否删除过报文行/信号行、是否按列排序过。
  4. 在表格视图按报文展开，确认目标信号子行是否存在；不存在优先怀疑报文名缺失。

#### A8. 校验规则静默纠正/清空

- **机制**：`sanitizeImportedParams` 的四类规则。
- **表现**：导入时弹出问题汇总提示；参数存在但 DTC 为空/类型被改/整项消失。
- **验证步骤**：
  1. 留意导入后的汇总提示文案（包含「不在允许范围」「已清空」「已按 N 处理」「已移除」）。
  2. DTC 只使用 `0x` + 十六进制或裸十六进制；不要写 `12345h`、`$1234`、中文说明、带单位。
  3. `SigInvalidTest` 类型只写 `SigInvalid` / `SigvalueInvalid`。
  4. `FactorTest_自动遍历` 只写 `Y` / `N`（大小写不敏感，`是/否/true/false/1/0` 也接受）。
  5. EPS 的 `CRC/Counter` 值必须与「已注册 CRC 算法名」完全一致（区分大小写）；不确定时用导出文件下拉选择，不要手输。

### P1 — 中概率

#### B1. 「测试参数」列被隐藏

- **机制**：列显隐持久化在 `canview_dbc_table_columns_v3`。
- **表现**：树形图节点有参数标签，表格视图完全没有该列。
- **验证**：打开「列设置」，确认「测试参数」被勾选；切换树形图/表格对照。

#### B2. 搜索关键字残留

- **机制**：`filteredDbcTableRows` 过滤。
- **表现**：只有部分行显示，清空搜索后恢复。
- **验证**：清空搜索框，观察目标行是否出现。

#### B3. 页签 / 视图模式不对

- **机制**：自动切页签仅在 `parsed.DBC` 存在时发生。
- **表现**：参数已导入，但用户停留在 DTC/链路层页签；或当前是树形图但用户只看表格。
- **验证**：确认当前页签是 DBC；切换树形图与表格各看一次。

#### B4. 旧格式手填方式错误

- **机制**：8 明细列要求「一个参数一行、各列按行对齐」；旧 JSON 列要求合法 JSON 数组。
- **表现**：参数名出现但字段丢失，或整列被当作参数名。
- **验证**：
  1. 8 明细格式：在单元格内用 `Alt+Enter` 换行，确认同一参数的各字段在**同一行号**。
  2. JSON 格式：确认是数组且能被 `JSON.parse` 成功；不要写单引号、尾逗号、中文引号。
  3. 若导出走 `{columns,rows}` 透传（未生成平铺列），确认「测试参数」列不是用来填结构化参数的。

#### B5. 数据验证下拉被手输覆盖

- **机制**：`CRC/Counter`、`SigInvalidTest` 列有下拉，但 Excel 允许粘贴任意文本。
- **表现**：导入时提示非法/被移除。
- **验证**：重新用下拉选择，或与 `configs/global/crc_algorithms.json` 中的名称逐字比对。

#### B6. Excel 自动类型转换

- **机制**：`dtype=str` 读取，但 Excel 在保存时已把内容改型。
- **表现**：信号名变成日期/科学计数、报文 ID 前导零丢失、纯数字信号名被转数值。
- **验证**：检查相关单元格的实际值与显示值（公式栏）；确认列格式为「文本」。

#### B7. 公式未计算 / 外部链接

- **机制**：pandas 读到的是缓存值，未计算则为 `NaN` → `None`。
- **表现**：参数列看似有公式，导入后为空。
- **验证**：确认单元格是值而不是公式；复制后「选择性粘贴-值」再导入。

#### B8. 隐藏行/筛选/删除行破坏前向填充

- **机制**：报文级字段依赖行顺序与前向填充。
- **表现**：信号归错报文、参数挂到别的报文、部分行消失。
- **验证**：取消所有筛选、取消隐藏行、恢复被删行后重新导出对照。

#### B9. 多配置/多工程混淆

- **机制**：参数 key 依赖当前树；不同配置的报文集合不同。
- **表现**：参数全部无法关联，或只关联到同名信号。
- **验证**：确认 Excel 来自当前选中的配置；核对导出时的配置名与导入时的配置名。

#### B10. 上传/保存环境问题

- **机制**：Axios `timeout=30000`；Electron 另存路径可能位于网络盘/只读目录。
- **表现**：导入报「网络异常」/超时；导出提示成功但文件未落盘或为 0 字节。
- **验证**：确认文件大小非 0、路径可写；大文件先在本地磁盘测试。

### P2 — 低概率但需排除

| 编号 | 因素 | 验证步骤 |
| --- | --- | --- |
| C1 | `.xls` / `.xlsm` / 改扩展名伪装 xlsx | 确认扩展名与实际格式一致；用 Excel「另存为 .xlsx」 |
| C2 | 文件加密 / 受保护视图 / 只读 | 确认无密码、已「启用编辑」；文件属性非只读 |
| C3 | WPS / 在线 Excel 另存的结构差异 | 用 Microsoft Excel 重新另存为 .xlsx 后再导入 |
| C4 | 共享盘/网络路径权限或同步延迟 | 复制到本地磁盘再导入；确认文件时间戳已更新 |
| C5 | 客户端仍是旧版本前端（缓存） | 核对关于/版本号与 `version.json`；重启客户端 |
| C6 | 后端多实例或未重启导致配置/算法列表不一致 | 确认只有一个后端进程；重启后复测 |
| C7 | Electron 与 Web 环境差异（写盘/下载分支） | 记录导入方式；用另一环境复现 |
| C8 | 全角字符 / BOM / 编码 | 检查表头是否含全角括号、不可见字符；复制到记事本再粘回 |

---

## 5. 五分钟快速定位流程

按顺序执行，每步都能把范围缩小一半：

1. **看现象属于哪一类**
   - 树形图和表格视图都完全没有参数 → 走 2。
   - 只有表格视图没有 → 直接查「列设置」中 `测试参数` 是否可见、搜索框是否为空（B1/B2）。
   - 有参数但值是旧的 → 直接命中「已有配置优先」（A5）。
   - 只有部分信号缺 → 直接查 key 一致性/报文名（A7）。

2. **确认 Excel 是否被正确识别**
   - 工作表名是否 `DBC Canmatrix`。
   - 表头是否有 `发送节点` / `报文名称` / `信号名称`。
   - 12 个平铺列表头是否逐字一致。
   - Console 是否有 `[dbc] 以下列未找到`。

3. **确认参数是否被过滤**
   - 导入后是否弹出校验汇总提示。
   - 目标参数是否满足 `hasParamData`（DTC/变量名/报DTC值）。
   - DTC 是否合法十六进制。

4. **确认是否被旧数据覆盖**
   - 导入前是否已有配置/已导入过 DBC。
   - 换一个完全不同的参数值做对照实验。

5. **确认渲染条件**
   - 当前页签、视图模式、列显隐、搜索框。

---

## 6. 症状 → 最可能原因 对照表

| 症状 | 最可能原因 | 优先验证 |
| --- | --- | --- |
| 提示「Excel 解析成功」但 DBC 页签完全不变 | 工作表名错误 / 缺 DBC 表 / 文件格式不对 | A2、C1、C2 |
| 信号能显示，参数列全空 | 导出缺关键列 / 表头被改 / 参数列不存在 | A1、A3、B4 |
| 表格里连信号行都没有 | 报文名缺失导致 `if (!msgName) continue` 或分组失败 | A1、A7 |
| 只有部分信号有参数 | 信号名/报文名不一致、行结构错位 | A7、A8 |
| 报文级 `LostTest/DlcTest` 不显示 | 填在信号行 / 报文首条记录无值 | A4 |
| 参数在，但 DTC 为空 | DTC 格式非法被清空 | A8 |
| 参数在，但类型/自动遍历被改 | 校验规则纠正 | A8 |
| 参数值与 Excel 不一致（旧值） | 已有配置参数优先 | A5 |
| 树形图有标签、表格没列 | 测试参数列被隐藏 | B1 |
| 只有少数行显示 | 搜索过滤 / 隐藏行 | B2、B8 |
| 导入报网络异常/超时 | 文件过大、30 秒超时、路径不可写 | B10 |
| 导入成功但 Excel 里某些参数列本来为空 | 参数完整性不足，导出时被过滤 | A6 |

---

## 7. 关键代码位置索引

| 主题 | 文件与行 |
| --- | --- |
| DBC 数据源优先级 | [CANView.vue#L1793-L1817](file:///e:/Python/AutoTool_Web/frontend/src/views/CANView.vue#L1793-L1817) |
| 测试参数 key 规则 | [CANView.vue#L1828-L1833](file:///e:/Python/AutoTool_Web/frontend/src/views/CANView.vue#L1828-L1833) |
| Excel 导入入口 | [CANView.vue#L8346-L8429](file:///e:/Python/AutoTool_Web/frontend/src/views/CANView.vue#L8346-L8429) |
| 原始表 → 信号行/参数 | [CANView.vue#L4334-L4648](file:///e:/Python/AutoTool_Web/frontend/src/views/CANView.vue#L4334-L4648) |
| 与旧参数合并（配置优先） | [CANView.vue#L4593-L4618](file:///e:/Python/AutoTool_Web/frontend/src/views/CANView.vue#L4593-L4618) |
| 参数校验/规范化 | [CANView.vue#L4155-L4220](file:///e:/Python/AutoTool_Web/frontend/src/views/CANView.vue#L4155-L4220) |
| 参数完整性判定 | [CANView.vue#L6113-L6143](file:///e:/Python/AutoTool_Web/frontend/src/views/CANView.vue#L6113-L6143) |
| 参数合并进树 | [CANView.vue#L4809-L4834](file:///e:/Python/AutoTool_Web/frontend/src/views/CANView.vue#L4809-L4834) |
| 记录 → 树 | [CANView.vue#L4921-L5089](file:///e:/Python/AutoTool_Web/frontend/src/views/CANView.vue#L4921-L5089) |
| 树 → 表格行 | [CANView.vue#L5571-L5613](file:///e:/Python/AutoTool_Web/frontend/src/views/CANView.vue#L5571-L5613) |
| 树重建 watcher | [CANView.vue#L6014-L6083](file:///e:/Python/AutoTool_Web/frontend/src/views/CANView.vue#L6014-L6083) |
| 树 → 导出字典 | [CANView.vue#L7185-L7321](file:///e:/Python/AutoTool_Web/frontend/src/views/CANView.vue#L7185-L7321) |
| 加载配置 | [CANView.vue#L7516-L7537](file:///e:/Python/AutoTool_Web/frontend/src/views/CANView.vue#L7516-L7537) |
| 导出 Excel | [CANView.vue#L7950-L7984](file:///e:/Python/AutoTool_Web/frontend/src/views/CANView.vue#L7950-L7984) |
| 列定义与可见列持久化 | [CANView.vue#L5413-L5476](file:///e:/Python/AutoTool_Web/frontend/src/views/CANView.vue#L5413-L5476) |
| Excel 列名匹配 | [dbc.ts#L62-L144](file:///e:/Python/AutoTool_Web/frontend/src/utils/dbc.ts#L62-L144) |
| 8 明细列解析 | [dbc.ts#L159-L180](file:///e:/Python/AutoTool_Web/frontend/src/utils/dbc.ts#L159-L180) |
| 12 平铺列解析 | [dbc.ts#L222-L248](file:///e:/Python/AutoTool_Web/frontend/src/utils/dbc.ts#L222-L248) |
| 前向填充/发送节点推断 | [dbc.ts#L339-L431](file:///e:/Python/AutoTool_Web/frontend/src/utils/dbc.ts#L339-L431) |
| 后端 Excel 解析 | [can_module.py#L240-L349](file:///e:/Python/AutoTool_Web/backend/core/can_module.py#L240-L349) |
| 后端导出矩阵 | [can_config_excel.py#L358-L407](file:///e:/Python/AutoTool_Web/backend/services/can_config_excel.py#L358-L407) |
| 平铺列定义 | [can_config_excel.py#L56-L101](file:///e:/Python/AutoTool_Web/backend/services/can_config_excel.py#L56-L101) |
| 表格渲染 | [DbcSignalTable.vue](file:///e:/Python/AutoTool_Web/frontend/src/components/DbcSignalTable.vue) |

# 更新日志（CHANGELOG）

本文件用于汇总 Excel2Case（AutoTool）的版本更新信息。各会话的更新记录统一追加到此文件，后续打包时汇总此处的更新信息。

## 更新信息记录规则

- 每条更新记录包含：日期、会话主题、变更内容、相关文件。
- 排列一律**倒序**：版本段（`## [版本号]`）从新到旧；同一版本段内的会话记录（`### [版本号] - 日期`）也按日期从新到旧。
- 新会话的更新记录追加到「当前最新版本段」下的**最前面**（即表头规则段之下、该版本自带版本信息之后）。
- 打包时，将「未发布」的最新更新汇总到 `version.json` 的 `release_notes` 字段。
- 版本号按 `major.minor.patch` 递增。

---

## [1.0.22] - 2026-10-06

**版本号**：`1.0.22`（`frontend/package.json` 的 `version`）
**安装包**：`#Excel2Case#V1.0.00 Setup 1.0.22.exe`（161,844,471 字节，SHA256 `8F2F2E6D813A2E848CD167BDD6BAB6FADA2C1C7E9A23086A651DF4AE7F7E83D1`）

**更新配置**（`version.json`）：
```json
{
  "version": "1.0.22",
  "release_notes": "本版本更新：\n- 多个功能增强与缺陷修复（Excel 导出平铺格式、导入校验、卡顿修复）\n- 函数库里自定义的函数没有生成到 TestFunction.cin —— 定位根因并修复（模板为基 + 追加库独有函数）",
  "setup_name": "#Excel2Case#V1.0.00 Setup 1.0.22.exe"
}
```
**共享盘路径**：`\\172.28.4.125\装机工作软件\工具软件\Excel2Case`

**说明**：本版本汇总 1.0.21 之后的 2 条会话更新记录（见下）。

**发布状态**：已发布到共享盘（version 1.0.22）

---

### [1.0.22] - 2026-10-09

**会话主题**：Excel 测试参数列精简与分组调整 + 信号无效值测试支持留空

**变更内容**：

1. **修复「不报DTC的值」输入框无法输入逗号**（`frontend/src/views/CANView.vue`）
   - 根因：`SigInvalidTest` 参数上挂了一个 deep watcher（监听整个 `params` 对象），用户每敲一个字符就触发一次「去重改写」——把 `noDtcValue` 经 `parseValues` 拆分再 `join(', ')` 写回，末尾/连续逗号被当作空段丢弃，导致逗号刚输入就被吃掉
   - 改为只监听 `params.dtcValue`，仅在「报DTC的值」变化时才从「不报DTC的值」中剔除重复项；用户输入 `noDtcValue` 时不再回写，中间态得以保留

2. **SigInvalidTest 的「报DTC的值 / 不报DTC的值」支持留空（填哪项生成哪项）**
   - `frontend/src/views/CANView.vue` `hasParamData`：由「三项（报DTC值/不报DTC值/DTC）全非空」放宽为「两值至少填一项」；填了「报DTC的值」时仍要求填 DTC（否则后端按 NullDTC 生成，语义错误）
   - `backend/processors/excel_processor.py` `_resolve_sig_test_values`：测试值键存在即以键值为准（空 = 用户明确不测「报DTC」），仅 `dtcValue/testValues/invalidValue` 三键都不存在时才回退 DBC 无效值列 —— 避免「没填报DTC的值却仍生成报DTC用例」
   - `frontend/src/components/ObjectPanel.vue`：帮助文案同步为「按需填写，可留空其一」

3. **Excel 导出测试参数列精简与分组调整**（`backend/services/can_config_excel.py`、`frontend/src/utils/dbc.ts`）
   - 平铺列 16 → 12：删除 `CRCTest_报DTC值 / CRCTest_不报DTC值 / CounterTest_报DTC值 / CounterTest_不报DTC值`（CRC/Counter 的报/不报值由后端写死）
   - 不分组：`LostTest`、`DlcTest`、`CRC/Counter`、`CRCTest_DTC`、`CounterTest_DTC`
   - 折叠组 1（精度测试参数）：`FactorTest_测试值`、`FactorTest_自动遍历`（组首 `FactorTest_变量名` 不折叠）
   - 折叠组 2（信号无效值测试参数）：`SigInvalidTest_报DTC值`、`SigInvalidTest_不报DTC值`、`SigInvalidTest_DTC`（组首 `SigInvalidTest` 类型列不折叠）
   - 去掉组间分隔空列 —— 两组之间由不折叠的 `SigInvalidTest` 类型列天然隔开

**影响**：CAN 配置导出 xlsx 的 `DBC Canmatrix` 工作表平铺测试参数列由 16 列改为 12 列（无分隔空列）；`SigInvalidTest` 的「报DTC的值 / 不报DTC的值」均可留空。

**验证**：`vue-tsc --noEmit` exit=0；后端 `py_compile` exit=0；导出冒烟测试（12 列无空列、outlineLevel 仅字段列=1 且两组独立成型、报文行 LostTest / 信号行 CRCTest_DTC 与 SigInvalidTest 三字段落位正确、数据验证下拉 2 个）均通过。

**相关文件**：
- `backend/services/can_config_excel.py`（平铺列定义、折叠层级、去除分隔列）
- `backend/processors/excel_processor.py`（`_resolve_sig_test_values` 不再无条件回退 DBC）
- `frontend/src/views/CANView.vue`（逗号修复、`hasParamData` 放宽）
- `frontend/src/utils/dbc.ts`（平铺列定义同步）
- `frontend/src/components/ObjectPanel.vue`（帮助文案）

---

### [1.0.22] - 2026-10-08

**会话主题**：多个功能增强与缺陷修复（Excel 导出平铺格式、导入校验、卡顿修复）

**变更内容**：

1. **CAN 配置导出测试参数区改为平铺宽表格式**（`backend/services/can_config_excel.py`、`frontend/src/utils/dbc.ts`、`frontend/src/views/CANView.vue`）
   - 旧格式：8 个竖排明细列（一个参数占一行、单元格内 `\n` 对齐）
   - 新格式：16 列平铺宽表（每个参数的每个字段独立为列，列名=「参数_字段」），含组间分隔空列
   - 按参数类别做 Excel 列分组折叠（4 个独立组：报文测试参数 / EPS 类型 / 信号无效值测试参数 / 精度测试参数）
   - `CRC/Counter` 列下拉数据验证（序列：Counter + 全部已注册 CRC 算法名）
   - `SigInvalidTest` 列下拉数据验证（序列：SigInvalid / SigvalueInvalid）
   - 导入识别：前端 `parseDbcRecords` 新增平铺列检测（需加入 `paramIdxList` 防误判 DTC/Factor 列），`parseFlatParamCells` 按列名还原测试参数

2. **Excel 导入数据校验与自动纠正**（`frontend/src/views/CANView.vue`）
   - `SigInvalidTest` 子类型：仅允许 SigInvalid / SigvalueInvalid，非法 → 按 SigInvalid 处理
   - `CRC/Counter`：仅允许 Counter + 已注册 CRC 算法，非法 → 移除
   - `FactorTest.autoRange`：仅允许 Y/N/是/否/true/false/1/0，非法 → 按 N 处理
   - DTC 字段：仅允许 `0x`+十六进制 / 裸十六进制，统一 `0X` 前缀为 `0x`，非法清空
   - DTC 表 `DTC_Type` 列：仅允许 Fun/Bus/Volt/BusOff（大小写不敏感），非法清空
   - 问题汇总后 `ElMessage.warning` 提示前 3 条，完整明细输出到控制台；不阻断导入

3. **修复生成报错 `ccp_node_result is not defined`**（`backend/api/can_routes.py`）
   - `generate()` 响应字典引用了从未赋值的变量 `ccp_node_result`（CCP 挂节点功能已重构为 Test Module 方式）→ 补 `ccp_node_result = None`
   - 同时修复误删的 `if generated_files["busoff_xml_path"]:` 条件判断
   - AST 全后端扫描确认：**仅此 1 处**未定义名隐患

4. **修复配置时卡顿严重**（`frontend/src/views/CANView.vue`）
   - 根因：限定符输入框每敲一个字符，`flush: 'sync'` 的 watcher 立即触发 `applyQualifierReplace` 全量深度遍历 12 个数据结构（treeData / signalRows / dtcRaw / testParamMap 等），大配置每次数千节点
   - 防抖调度：连续输入累积 300ms 停止后执行一次；记录「本轮输入起始的旧限定符」保持替换语义正确（不把中间状态当旧值）
   - 快速跳过：`replaceQualifierInString` 加 `!text.includes('::') && !text.includes('.')` 提前返回，大多数无关字符串（信号名、DTC 码、数值）不再跑正则
   - 去掉 `flush: 'sync'`，避免同步阻塞输入事件

5. **前端其他配置页新增 IGON_OFF 卡片**（`frontend/src/views/CANView.vue`）—— 对应后端 `_add_IGON_OFF_testcase` 的无条件调用点，cardDefs 选用纯参数卡片

6. **吉利3.0（GEEA_3.0）Counter 步长跳变用例**（`backend/processors/excel_processor.py`、`backend/templates/can_test_function.py`）
   - 每步长一条用例（+2/+3/+4/+5/+7/+8/+9/+10/+11/+12/+13），用 `putValue(EVCounter, step)` 注入跳变，期望不报 DTC

7. **诊断电压 × BusOff 组合用例**（`backend/processors/excel_processor.py`、`backend/templates/capl.py`）
   - 4 条 testcase：低/高压下制造并恢复 busoff → 读故障（mask=8），或 busoff 状态下切到低/高压再恢复
   - mask=8（19 02 08 confirmedDTC），只断言 busoff 的 DTC 不关注电压 DTC

8. **DTC 表 DTC_Type 列填写规范**（`frontend/src/views/CANView.vue`）—— 只允许 Fun / Bus / Volt / BusOff，前端组件 `onDtcCardUpdate` 收口校验（覆盖手输 / 粘贴 / 清空全部路径）

**影响**：CAN 配置导出 xlsx 的 `DBC Canmatrix` 工作表结构发生变化（旧竖排 8 列 → 新平铺 16 列 + 分隔列）；前端导入同时兼容新旧格式。

**验证**：`vue-tsc --noEmit` exit=0；后端 `py_compile` exit=0；导出冒烟测试（3 信号含 CRCTest/CounterTest/SigInvalidTest/FactorTest + EPS et）表头/行值/分组折叠/数据验证均正确。

**相关文件**：
- `backend/api/can_routes.py`（修复 NameError）
- `backend/services/can_config_excel.py`（导出平铺格式）
- `backend/processors/excel_processor.py`（Counter 步长 + BusOff 用例）
- `backend/templates/capl.py`（BusOff 用例模板）
- `backend/templates/can_test_function.py`（步长跳变测试函数）
- `frontend/src/utils/dbc.ts`（平铺列定义与导入解析）
- `frontend/src/views/CANView.vue`（导入校验、卡顿修复、IGON_OFF 卡片、DTC_Type 校验）

**会话主题**：`canoe_capl.ARRAY_FUNC_TEST` 改为以 `capl.ArrayFunc` 为唯一源头（删掉内联的整段副本）

**问题**：`backend/templates/canoe_capl.py` 里内联了一份 `ArrayFuncTest.cin` 的整段副本（1187 行），与 `capl.py` 的 `ArrayFunc` 已漂移成两份。前者用于生成 `Testmodule\power_Test\ArrayFuncTest.cin`（`Power_up.can` 会调用其中的 `TestStep_Read_Multi_WhiteDTC`），后者用于生成 CAN / Function 模块的 `ArrayFuncTest.cin`。

**实测差异（替换前）**：内联副本 44363 字符 / 1187 行，`capl.ArrayFunc` 45853 字符 / 1209 行，共 22 处差异。`capl.ArrayFunc` 侧是修好的版本：

- `TestStep_Read_Multi_WhiteDTC` 由 `byte` 改为 `int` 返回，并补 `DTC_Num = 0;` 与早退 `return gcNok;`（消除「Not all control paths return a value」）
- `snprintf` 的 `"%s\\n"` 修正为 `"%s\n"`；多处注释里的函数名改正；补 `SeachValueDTCArrary` / `SeachSubArraryInArrary` / `SeachMultiValueNotInArrary` / `TestNoDTC` 的标准注释块；另有函数 `TestStep_Read_WhiteDTC`
- 内联副本**独有**的只有 `setDiagTx`（UDS 发诊断指令的辅助函数），全工具链**无任何调用者**（现场出现的那些在 `Testmodule_UDS\...\TESTDLL.cin`，属诊断工具那套）

**变更内容**（`backend/templates/canoe_capl.py`）：

- `CaplGenerator.ARRAY_FUNC_TEST = capl.ArrayFunc`，删除 1187 行内联副本
- 顶部导入补上 `capl`：`from backend.templates import relay,capl`

**影响**：`power_Test\ArrayFuncTest.cin` 的产出内容随 `capl.ArrayFunc` 走，同步获得上述修复；`sanbao` 的「内置共用函数」来源（`getattr(CaplGenerator, "ARRAY_FUNC_TEST", "")`）同步更新。

**验证**：模块导入正常；`ARRAY_FUNC_TEST == capl.ArrayFunc`（48328 字符）；`CaplGenerator().generate_array_func_test()` 返回同一内容；`sanbao_module` 内置共用函数解析正常（22 个，含 `TestStep_Read_WhiteDTC`、不再含 `setDiagTx`）。

**附注**：原内联副本已备份为 `backend/templates/canoe_capl.py.bak-20261006-145451`；若仍需 `setDiagTx`，可从该备份取回并补进 `capl.ArrayFunc`。另：`#Excel转测试用例工具#\源码\backend\templates\canoe_capl.py` 是一份 09-24 的旧副本（未同步），本次未改动。

---

### [1.0.22] - 2026-10-06

**会话主题**：函数库里自定义的函数没有生成到 TestFunction.cin —— 定位根因并修复（模板为基 + 追加库独有函数）

**问题**：在「函数库 → 源码视图」里新增/修改的自定义函数，生成后不在 `TestFunction.cin` 里；用例调用它们时 CAPL 报 unknown function。

**根因（排查结论）**：Function 模块生成 `TestFunction.cin` 的内容**固定取自编译进代码的模板** `StringTxt.FuncTestFunction`，整条生成链路从未把「函数库」里用户自定义的函数带进来。

- `function_processor.generate_output_files()`：`func_content = self.generated_content['Function']`，只做占位符替换（`ABS_ESP` / `XCPDemo` / `/*Ready_On|Off*/` / `Unlock` 存根 等）后写盘；而 `generated_content['Function']` 的初值就是模板。
- `/api/function/generate` → `function_module.save_Function()`：只从同一个全局库 JSON 读了 `cards`（`_load_global_cards`）与 `value_library`（`_load_global_value_library`），**漏了 `function_library`**。
- 契约对照：`GET/POST /api/function/global-library` 文档写明 `function_library: str  TestFunction.cin 内容`，默认值即该模板；同类模块 `sanbao_module.generate_capl(config, cfg_dir, function_library)` 也显式把函数库写进 TestFunction.cin —— 属 Function 模块漏实现。

**模块边界（本次确认）**：CAN 与 Function 的 `TestFunction.cin` **相互独立**，共同函数已抽到 `ArrayFuncTest.cin`。`FIU*` / `ReadOCC` / `CommunicationVoltage_*` / `DiagVoltage_*` 属 **CAN 专属**（`test_function.py` 的 `TestFunctionBase` + `can_test_function.py` 的 `CanTestFunction`），Function 侧不涉及，也**不引 `DTC_Configuration.cin`** —— 代码里既有的 `_strip_can_functions` / `_CAN_FUNC_DEF_RE` 就是同一套判据。

**变更内容**（`backend/core/function_module.py`、`backend/api/function_routes.py`、`frontend/src/views/FunctionView.vue`）：

Function 的 `TestFunction.cin` = **内置模板 + 函数库里用户自定义的函数**。

- 新增 `_load_global_function_library()`：读全局库的 `function_library`（即函数库源码视图内容）。
- 新增 `_append_library_functions(base_src, library_src)`，返回 `(内容, 冲突函数名列表)`：
  - **去重键 = `(函数名, 参数类型序列)`**（空白归一化）。不能用单一函数名 —— 同名不同参是**重载**，必须保留（`SignalCheck` / `SignalWaitCheck` / `ResetSignal` / `_readXCP` 都有多组）；也不能用解析出的 `signature` 文本 —— 返回类型写不写 `void`、参数名/空格差异会把同一个函数判成两个（实测 `SignalWaitCheckRate` / `SetSignalRamp` / `SetSignalRate` 正是如此），追加后反而重复定义。
  - **内置不算自定义**：本模块模板 + `ArrayFuncTest.cin` 内置共用函数；CAN 专属函数（`_CAN_ONLY_NAME_RE`，与既有 `_CAN_FUNC_DEF_RE` 同一套判据）**直接跳过** —— 既不追加、也不提示，Function 侧因此不需要 `DTC_Configuration.cin`。
  - **冲突提示**：库里若改了与本模块模板「同名同参」函数的实现，以模板为准，函数名收进 `function_conflicts` 返回。
  - **幂等**：追加块用成对标记 `/* ===== 函数库自定义函数 begin/end (auto-generated) ===== */` 包裹，每次生成先删旧块再追加，避免同一份配置连点两次「生成」越积越多。
- 接入点：`save_Function()` 中 relay 注入之后、`generate_output_files()` 之前（与 msg-id 注入 / relay 注入同一层次）。
- `function_conflicts` 经 `/api/function/generate` 透传；前端 `doGenerate()` 拿到非空列表时用 `ElMessageBox.alert` **弹窗提示**。

**相关文件**：`backend/core/function_module.py`、`backend/api/function_routes.py`、`frontend/src/views/FunctionView.vue`。

**验证**：

| 检验项 | 结果 |
|---|---|
| 当前真实函数库 | 相对模板**追加 0 个**（产物长度仍 51999）；`FIUClass` / `ReadOCC` / `CommunicationVoltage_Rise` 均**未进入** Function 产物；`/*#include "DTC_Configuration.cin"*/` 保持注释态 |
| 冲突列表（当前数据） | 空 —— 库与 Function 模板的 106 个同名函数实现完全一致 |
| 幂等 | 连续跑两次结果逐字节相同 |
| 真·新函数 | 构造 `void MyOwnFunc(int a)` → 被追加 ✅ |
| CAN 专属函数 | 构造 `void FIUNewThing(int a)` → 被跳过 ✅（不追加、不提示） |
| 重载保留 | 构造 `void Wait(long,long)`（同名不同参）→ 被追加 ✅；库里 `SignalCheck`×4 / `SignalWaitCheck`×6 / `ResetSignal`×5 全部识别为内置、不重复追加 |
| 冲突提示 | 构造"库里的 `Wait(long time)` 改了实现" → `function_conflicts = ['Wait']`，产物仍用模板实现 ✅ |
| 前端类型检查 | `vue-tsc --noEmit` 通过 |

**附注**：函数库「卡片视图」新建的自定义卡片存在 `step_library`（字段 `code` 即函数体）。把卡片拖到工况/步骤后，生成的 `TestCase.can` 是 `Custom_N(...)` **调用**（`function_graph._render` 的 `kind=='call'`），但函数体同样不会被写进 `TestFunction.cin`。本次按讨论**只处理源码视图的自定义函数**，`step_library` 未动（当前该段为空，暂未暴露）。

---

## [1.0.21] - 2026-09-30

**版本号**：`1.0.21`（`frontend/package.json` 的 `version`）
**安装包**：`#Excel2Case#V1.0.00 Setup 1.0.21.exe`（161,755,514 字节，SHA256 `1452D0401565864AF56D96226346396250FA98AB1B5D46BCA9E637D282E0ED32`）

**更新配置**（`version.json`）：
```json
{
  "version": "1.0.21",
  "release_notes": "本版本更新：\n- mapxml 解析出的对象增加「精度 / 偏移」（默认 1 / 0），生成脚本按「物理值 = 原始值 × 精度 + 偏移」发布 CCP 系统变量\n- CANoe CCP 采集重构为 Test Module「按需读取」方案 —— 修掉 13 条 CAPL 编译错误与 ccpLe 取数累加 bug，并把现场验证过的 CAPL 同步回生成器\n- Function 图形配置 —— 连线不跨主序列校验、拖放自动归位合法泳道、卡片/映射/值资源库全局化与多选拖拽四项优化、右栏四列表同格布局",
  "setup_name": "#Excel2Case#V1.0.00 Setup 1.0.21.exe"
}
```
**共享盘路径**：`\\172.28.4.125\装机工作软件\工具软件\Excel2Case`

**说明**：本版本汇总 1.0.20 之后的 3 条会话更新记录（见下）。

**发布状态**：已发布到共享盘（version 1.0.21）

---

### [1.0.21] - 2026-09-30

**会话主题**：mapxml 解析出的对象增加「精度 / 偏移」（默认 1 / 0），生成脚本按「物理值 = 原始值 × 精度 + 偏移」发布 CCP 系统变量

**问题**：mapxml 解析出的符号只有 `名称 / 地址 / 字节长度`，CCP 采集把 ECU 内部原始值原样发布到 `sysvar::NsCcp::*`。CANoe 里的监控变量若需要带换算（如 1201 → 12.01V），只能在下游再乘一次，或干脆读不到工程量。

**变更内容**：

**一、对象浏览器（双击符号）设置精度 / 偏移**（`frontend/src/components/ObjectPanel.vue`、`stores/modules.ts`）
- 「CCP 系统变量类型」弹窗扩为「**CCP 系统变量**」：类型单选 + **精度** / **偏移** 输入框（默认 1 / 0），标题与文案同步调整。
- store 新增 `ccpVarScales`（`{符号名: {precision, offset}}`）、`setCcpVarScale()`（单个，两项都回默认值时删除条目）与 `setCcpVarScales()`（整表，加载配置回填时用）。
- 取值优先级统一为 **对象浏览器设置 > mapxml 对象自带值 > 默认 1 / 0**（`resolveCcpScale()` / `collectCcpSymbols()` 同一套规则）。
- 对象树节点说明追加换算系数（非默认时显示，如 `MEASUREMENT · 0x7000af38 · 2B · ×0.01+0`）。
- 常量 `DEFAULT_CCP_PRECISION = 1` / `DEFAULT_CCP_OFFSET = 0` 与后端保持一致。

**二、请求下发**（`views/CANView.vue` 的 `collectCcpSymbols()`、`api/can.ts`）
- `ccp_symbols` 条目由 `{addr, size, type?}` 扩为 `{addr, size, type?, precision?, offset?}`，未设置时不带该字段（后端按默认值处理）。

**三、后端生成**（`backend/templates/ns_ccp_capl.py`、`processors/excel_processor.py`）
- 新增 `ccp_precision()` / `ccp_offset()`（容错解析，缺失/非法/空串回退 1 / 0）、`ccp_scale_is_default()`、`ccp_float_literal()`（CAPL 字面量，始终带小数点且不用科学计数法 —— CAPL 不认 `1e-05`）、`ccp_effective_type()`。
- **类型自动提升**：精度或偏移带小数时，该符号的系统变量类型强制 `float`（否则写入整型 sysvar 会被截断）；整数系数（如 ×1000-5）保持原类型。
- `build_ccp_module()`：新增全局数组 `float gCcpPrec[]` / `float gCcpOffs[]`，`ccpPublish(idx, rawVal)` 内先换算再发布。
- `build_vsysvar()`：类型改用 `ccp_effective_type()`；非默认系数写进变量注释（如 `0x700006f6 (2 byte) ×0.01+0.0`），便于在 CANoe 里核对。
- `_ccp_usable_symbols()` / `can_module.py` / `can_routes.py` 的 `ccp_symbols` 说明同步为 `{addr, size, type?, precision?, offset?}`。

**四、解析对象自带精度 / 偏移**（`backend/utils/mapxml_parser.py`、`api/can_routes.py`）
- mapxml 本身不提供换算信息，解析结果里每个符号统一带上 `precision: 1` / `offset: 0`（默认值与 `ns_ccp_capl.CCP_DEFAULT_*` 一致），使「精度 / 偏移」成为对象模型的一部分，而不只是生成时的后处理。
- 前端 `A2lVar` 类型同步增加 `precision?` / `offset?`；对象树数据、双击弹窗默认值都取自该对象。
- `/api/can/parse-mapxml` 返回说明同步。

**五、精度 / 偏移随配置持久化**（`views/CANView.vue`）
- 保存：`Configuration.ccp_var_scales` 按 store 当前值整体写入（无覆盖时为空 `{}`）；沿用 `serviceObject` / `securityAlgo` 已有的存放位置，随配置 JSON 一并落盘。
- 加载：`applyConfigurationData()` 回填到 store，并把该字段从配置表里摘掉 —— 由 store 作为唯一来源，避免整表替换后又回写旧值。加载配置（`merge=false`）以配置为准、缺失即清空；上传 Excel（`merge=true`）只在表里带该字段时才覆盖，不冲掉用户已设的系数。
- 后端无需改动：`ccp_var_scales` 落在 `Configuration`，`ExcelProcessor` 把该表拍平成 `config_data` 后只按显式 key 取值，嵌套对象不影响生成。

**相关文件**：`frontend/src/components/ObjectPanel.vue`、`frontend/src/stores/modules.ts`、`frontend/src/views/CANView.vue`、`frontend/src/api/can.ts`、`backend/templates/ns_ccp_capl.py`、`backend/processors/excel_processor.py`、`backend/utils/mapxml_parser.py`、`backend/core/can_module.py`、`backend/api/can_routes.py`。

**验证**：

| 检验项 | 结果 |
|---|---|
| 容错解析 | `precision`/`offset` 为 `None`、`""`、`"abc"` 时均回退 1 / 0（6 组输入逐条核对） |
| 类型提升 | 精度 `0.01` / `0.5` → 有效类型 `float`；精度 `1000` + 偏移 `-5` → 保持 `int` |
| 字面量格式 | `1`→`1.0`、`0.01`→`0.01`、`-5`→`-5.0`、`1e-08`→`0.00000001`（无科学计数法） |
| vsysvar | 小数系数 → `type="float"` 且注释带 `×0.01+0.0`；整数系数注释 `×1000.0-5.0`（负偏移不再出现 `+-`） |
| 生成脚本语法 | 离线 32 位 CAPLcompExec 编译 1002/1155/1156/2102 = 0（仅剩靶机噪声 1249/1159/1174） |
| 前端类型检查 | `vue-tsc --noEmit` 通过 |
| 真实 mapxml 端到端 | `ECUAPP_927_3133.mapxml`（1469 个符号）解析出 `precision=1 / offset=0`；模拟对象浏览器给某符号设 0.01 后生成，`gCcpPrec = {0.01, 1.0, 1.0}`、vsysvar 注释带 `×0.01+0.0`，离线编译语法错误 0 |
| 配置持久化 | 保存路径 `Configuration.ccp_var_scales` → store 整表写入；加载回填并摘除该字段（`merge` 区分加载 / 上传 Excel）；字段随配置 JSON 落盘，后端按显式 key 取值不受影响 |

**附注（CAPL 保留字坑）**：新写的 `ccpPublish(long idx, long raw)` 报 Error 1002 parse error（列号正落在参数名 `raw` 上）—— **`raw` 与 `hex` 一样是 CAPL 保留字**，声明处即报错。参数改名 `rawVal` 后正常。

---

### [1.0.21] - 2026-09-30

**会话主题**：CANoe CCP 采集重构为 Test Module「按需读取」方案 —— 修掉 13 条 CAPL 编译错误与 ccpLe 取数累加 bug，并把现场验证过的 CAPL 同步回生成器

**问题**：
1. 有刷模式的 CCP 采集此前做成独立仿真节点（`Nodes\CCP_Read.can`，`on start` + 常驻 DAQ），既不按测试用例的读值时机采集，也长期占总线负载。
2. 现场调试版 `CCP_Read.cin` 报 13 条编译错误（1002 parse error / 1155 number of parameters do not match）。
3. 现场读出的 CCP 值不对：应约 1201（≈12.0V）/ 16384，实际读到 18786 / 35170 且随时间漂移。

**变更内容**：

**一、现场调试定位**（`D:\Desktop\验收电压工具`）
- 13 条错误的两个根因：① `char hex[16] = "0123456789ABCDEF";` —— `hex` 是 CAPL 保留字，声明处即 parse error，并连带其使用处（91/92 行）报错；改名 `hx` + 用算术函数 `ccpHexDigit()` 生成十六进制字符。② `fileWriteString(handle, text)` 这个 API 不存在，正确写法是 `filePutString(buffer, strlen(buffer), handle)`（与工程内 `Testmodule\power_Test\Power_up.can` 一致）。
- **取数错误的根因（产品级 bug）**：`ccpLe()` 里 `long v = 0;` 的「声明式初始化」在 CAPL 中只在加载时执行一次，函数内变量实际是静态的，会跨调用累加 —— 实测返回值 1200 → 17584 → 18785 → 35169（每次 = 本次真值 + 上次返回值，故每轮 sysvar 又被写回旧值）。改为 `long v; long i; v = 0;` 显式清零后全部正确。
- 帧解析本身一直是对的：SHORT_UP 应答 `rx[3]` 起为数据、小端拼接（`0x04B1` → 1201、`0x4000` → 16384）。

**二、重构为 Test Module「按需读取」方案**（`backend/templates/ns_ccp_capl.py`：`build_ccp_node` → `build_ccp_module`）
- 产物 `CCP_Read.cin`（与 `TestCase.can` 同目录），由 `TestCase.can` 的 `#include "CCP_Read.cin"` 随测试模块一起编译。
- 去掉 `on start` 与常驻 DAQ：初始化放进读值函数（`ccpReadValue()` 内先 `ccpEnsureConnected()`，用 `ccpConnected` 记录连接状态、**未连接才发 CONNECT**）；**读完一个变量立刻 `ccpRelease()`（DISCONNECT）释放**，省负载与算力。
- 对外接口 `long ccpReadValue(long idx)` / `long ccpReadAll()`；值仍发布到 `sysvar::NsCcp::<符号名>`。

**三、生成器同步**（`excel_processor.py`、`core/can_module.py`、`api/can_routes.py`）
- 输出 `CCP_Read.cin` 到 Test Module 目录，并在 `TestCase.can` 的 includes 块注入 `#include "CCP_Read.cin"`；`CANCase.xml` 注入「CCP采集」组 + `CCP_Read_Test` 用例。
- ns_ccp.dll 部署目标由 `Nodes\` 改为 `.cin` 所在目录（x86，与 CAPL 目标架构一致），保留架构校验与失败弹窗提示。
- 移除「通过 CANoe COM 把 `CCP_Read` 节点挂到 Simulation Setup」整段逻辑；返回参数 `ccp_node_path` → `ccp_module_path`（仅用于日志）。`CCP.vsysvar` 自动导入保持不变。

**相关文件**：`backend/templates/ns_ccp_capl.py`、`backend/processors/excel_processor.py`、`backend/core/can_module.py`、`backend/api/can_routes.py`；现场工程 `D:\Desktop\验收电压工具\Testmodule\CAN\CCP_Read.cin`、`CANCase.xml`、`TestCase.can`。

**验证**：

| 检验项 | 结果 |
|---|---|
| 现场 `CCP_Read.cin` 语法 | 离线 32 位 CAPLcompExec 仅报靶机噪声（1249/1159/1174），1002/1155/1156/2102 = 0 |
| CANoe COM `CompileAndVerify` | 通过，`TestCase.cbf` 重新生成，符号表含 `ccpReadValue`/`ccpReadAll`/`ccpEnsureConnected`/`ccpRelease`/`CCP_Read_Test` |
| 端到端跑用例（COM 启动测量 + `ExecuteAll`） | `sysBatVolG = 1201/1202`、`Torque_Limit = 16384`，与报文真值一致，10 秒稳定无漂移 |
| 静态写入实验（写哨兵 500/600 静置 3 秒） | 未被改动 → 排除其它写入源 |
| 生成器产物 | `build_ccp_module()` 输出与现场验证版逐行 diff 仅多注释；离线编译 1002/1155/1156/2102 = 0；GBK 编码校验通过 |
| 生成器注入 | `TestCase.can` includes 注入 + `CANCase.xml`「CCP采集 / CCP_Read_Test」注入均验证通过 |

**附注（工具教训）**：CAPL 源文件是 GBK（`/*@!Encoding:936*/`），用通用文本编辑工具改写会把非 ASCII 注释写成 U+FFFD 替换符（本次已从备份重建并校验 0 个替换符）；后续对此类文件一律按 GBK 读写。

---

### [1.0.21] - 2026-09-30

**会话主题**：Function 图形配置 —— 连线不跨主序列校验、拖放自动归位合法泳道、卡片/映射/值资源库全局化与多选拖拽四项优化、右栏四列表同格布局

**问题**：图形配置里连线可以横穿主序列（左右两侧泳道的卡片/接线口互连），生成的用例顺序与编排意图不符；卡片库/映射表/值资源库只在分组内可用，换配置或新建分组要手工重建；卡片编辑页无法直接引用映射表/对象浏览器里的对象；右侧面板为上下堆叠、列表过窄。

**变更内容**：

**一、连线不跨越主序列**（`frontend/src/utils/functionGraph.ts`、`CaseFrameCanvas.vue`）
- 规则：主序列左侧泳道不能连到右侧泳道。按「端口在卡片的哪一侧」判定，因此**含入口/出口方向**——主序列卡片输入口在左缘（只能接左侧）、输出口在右缘（只能接右侧）。
- 新增共享判定 `framePortSide(frame, key)` / `frameEdgeCrossesMain(frame, from, to)`；诊断项 `cross-main-edge` 改用该函数，文案「连线压过了主序列：入口要接主序列左侧的卡片、出口要接主序列右侧的卡片，两侧卡片不能互连」。
- 接入 4 条连线创建路径（新建连线、拖拽接线、键位连线等）＋ 结构守卫 `rejectIfAddsCrossing`（拖动卡片/泳道 `moveNodesToLane` / `applyLaneDrop` / `moveLane` 时同样拦截）。
- **存量数据修正**：全量扫描 1968 条边，发现 2 条「主序列输出口 → 左侧卡片」的反向违规（A47B `FUNC_ADS_TQ` 工况 2 号线、`BYD_Fun_ADS_Ang` 一条），经拖拽自动归位后保存，落盘违规 2→0，边总数仍为 1968。

**二、拖放自动落入合法泳道**（`CaseFrameCanvas.vue`）
- 新增 `laneSideOf` / `currentSideOf` / `legalSideOfCard` / `laneOnSide` / `resolveDropLane`，接入 `onZoneDrop` / `onCardDrop` / `onGapDrop` / `onCanvasDrop`：落到非法侧时按规则改投合法泳道。
- `legalSideOfCard` 收敛为「**只按已有连线判定**，无连线返回 `null`（不猜）」；跨工况拖动按来源工况的角色判定，避免误判。新建卡片落主序列泳道时按角色改投，其它泳道尊重落点。

**三、四项前端优化**
1. **Shift 范围多选**：左侧卡片列表与画布泳道卡片均支持 Shift+点击整段选中（Ctrl/Cmd 加减选），并更新操作提示。
2. **卡片全局化**：`Card.global` 标记 + 列表右键「设为全局 / 取消全局」+ 行内「全局」胶囊；新建配置、新建分组时自动带出全局库里的卡片（`injectGlobalIntoGroup`）。
3. **映射表 / 值资源库全局化**：与卡片同构的右键批量「设为全局 / 取消全局」+ 视觉标记，分别落到全局库 `mapping` / `value_library` 段。
4. **卡片编辑页支持拖入**：`StepEditor` / `CardEditor` 的参数行可接收来自映射表、对象浏览器的拖拽（`application/x-mapping`、对象浏览器 `application/json`，A2L 取 `text/plain` 并标 `argType:'sysvar'`）。
- 全局库读写按段合并（`loadGlobalSections` / `saveGlobalCards` / `saveGlobalMapping` / `saveGlobalValueLibrary`），同步失败回滚本地标记——只发 `{cards}` 不会动其它段。

**四、两处修正**
- 多选对象「设为全局 / 取消全局」原来只作用于右键那一项 → 改为按多选集合批量；并为映射表 / 值资源库补齐多选机制（Shift 范围选、Ctrl 加减选）。
- 右侧面板由「函数库 / 映射表 / 值资源库」三块上下堆叠 → 收敛为同一容器（先左右并排，最终改为同格页签，见第六节）。

**五、回归影响分析（自查并修复 4 处潜在回归）**
| # | 问题 | 修复 |
|---|---|---|
| 1 | Ctrl+拖拽复制卡片会继承 `global` 标记（副本不在全局库里，显示成全局却带不进新配置） | `cloneCard` / `duplicateCardTo` 置 `global = undefined` |
| 2 | 卡片库同步会把 `global` 带到工况节点副本上，并触发一次多余的「已同步 N 张引用卡片」 | `syncGraphRefs.syncCard` 置 `global: undefined` |
| 3 | 映射表 / 值资源库删除按钮点击冒泡到行 `@click`，删行后选中态跳到错误行 | 删除按钮改 `@click.stop` |
| 4 | 右键菜单全屏遮罩若不能关闭会卡住界面 | `CtxMenu` 补 Esc 关闭 + `onBeforeUnmount` 清理监听 |

**六、右栏布局调整**（`FunctionGraphEditor.vue` 的 `initTree()`）
- 右栏改为「**对象映射表 / 值资源库 / 函数库**」三个列表同格页签切换（初始状态三个列表在一起），去掉原有的上下堆叠。
- **对象浏览器并入同一格**：加载了对象（DBC/DTC/A2L）时才出现该页签，出现即自动高亮；未加载则不出现。改为按 store 数据判定（`objHasData` → `panelStates.obj.visible`），并把「可见即高亮」交给对 `panelStates.obj.visible` 的 `watch`（带 `immediate`）。
- **容器宽度减半**：根 `ratios` 由 `[1.9, 4.4, 3.4]` 改为 `[1.9, 6.1, 1.7]`（右栏 3.4 → 1.7，让出的宽度给中栏编辑区）。

**验证**：

| 检验项 | 结果 |
|---|---|
| 连线跨主序列（端口方向判定） | 全量 1968 条边，规则命中违规 2 条（均为出口反向），修正后 0 条 |
| 拖放自动归位 | 落非法侧自动改投合法泳道；跨工况按来源工况角色判定 |
| Shift 范围多选 | 列表与画布均按锚点→目标整段选中 |
| 卡片全局化 → 编辑保存后保留 | 保存后「全局」胶囊仍在，且无多余同步提示 |
| 映射表多选删除 | 选中 0/1/2 行 → 删第 1 行 → 行数 61→60，选中态正确停在 [0,1] |
| 右键菜单 Esc | `.ctx-menu` / `.ctx-mask` 归零，界面不卡 |
| 非模态卡片编辑弹窗 | 弹窗左对齐打开；`el-dialog` pointer-events=auto、遮罩 none（拖拽可穿透）；保存后遮罩 `display:none` |
| 右栏布局 | 页签 `对象映射表* / 值资源库 / 函数库`；右栏宽 **526 → 263px**（减半），中栏 528 → 943px；未加载对象时对象浏览器页签不出现 |
| 数据无污染 | 测试用的全局标记已撤销，`Function_global_library.json` 与 HEAD 逐字节一致（hash 相同） |
| 前端 vue-tsc + vite build | 通过，`frontend/dist` 已重建 |

**相关文件**：
- `frontend/src/utils/functionGraph.ts`
- `frontend/src/components/graph/CaseFrameCanvas.vue`
- `frontend/src/components/graph/FunctionGraphEditor.vue`
- `frontend/src/components/graph/PanelBody.vue`
- `frontend/src/components/graph/MappingManager.vue`
- `frontend/src/components/graph/ValueLibraryPanel.vue`
- `frontend/src/components/graph/CardEditor.vue`
- `frontend/src/components/graph/CtxMenu.vue`（新增）
- `frontend/src/api/function.ts`
- `frontend/src/types/functionGraph.ts`
- `frontend/src/views/FunctionView.vue`
- `configs/function/Function_configs.json`（A47B 存量跨主序列连线修正）

**发布状态**：已发布到共享盘（version 1.0.21）

---

## [1.0.20] - 2026-09-28

**版本号**：`1.0.20`（`frontend/package.json` 的 `version`）
**安装包**：`#Excel2Case#V1.0.00 Setup 1.0.20.exe`（160,789,418 字节，SHA256 `687A373BDC4056255FC0CD96C2CA6677576970CDE16891BA8055161DF3262CDF`）

**更新配置**（`version.json`）：
```json
{
  "version": "1.0.20",
  "release_notes": "本版本更新：\n- 序列接线口自愈 —— 载入时自动清理过时残留连线、接回真断线",
  "setup_name": "#Excel2Case#V1.0.00 Setup 1.0.20.exe"
}
```
**共享盘路径**：`\\172.28.4.125\装机工作软件\工具软件\Excel2Case`

**说明**：本版本汇总 1.0.19 之后的 1 条会话更新记录（见下）。

**发布状态**：已发布到共享盘（version 1.0.20）

---

### [1.0.20] - 2026-09-29

**会话主题**：set/reset 对象名前缀分流 + CCP 类型同步到 Function 模块

**问题**：图形模式的「设置」步骤中，系统变量（`sysvar::...`）生成的是 `setSignal(sysvar::...)` 而非 `sysSetVariable*`（CANoe CAPL 无 `setSignal(sysvar*)` 重载），环境变量（`EV_...`）生成的是 `setSignal` 而非 `putValue`；恢复/全部恢复也未区分三类变量。此外，CCP 类型（int/float/int64）仅前端 CAN 模块使用，Function 模块无感知导致系统变量类型选错。

**变更内容**：

- **后端分流逻辑**（`backend/services/function_graph.py`）：
  - **set**：按对象名前缀分流——`EV_`→ `putValue`，`sysvar::`→ `sysSetVariableInt/Float`（按 CCP 类型优先，缺类型时按值字面量判定），普通信号仍 `setSignal`；`@` 直取前缀去掉后按同一规则分流。
  - **值字面量判定**：修复 `-5`、`0x1F` 等负数/十六进制被误判为 Float 的问题。
  - **恢复**：`TestResetEnvVarValue` / `TestResetSysVarValue` / `TestResetSignalValue` 三路匹配（含「全部恢复」按对象前缀去重汇总）。
  - **Check / WaitCheck 不动**：`func_test_function.py` 中 `SignalCheck`/`SignalWaitCheck` 已有 sysvarInt/sysvarFloat/signal 重载，交给 CAPL 自动匹配。
- **CCP 类型同步**：`frontend/src/stores/modules.ts` 的 `ccpVarTypes` 以配置顶层字段 `ccp_var_types` 落盘（与 oem/securityAlgo 同范式），经可选参数 `ccp_types` 传入 `expand_cases / build_test_case_list / build_testcase_can / export_groups_xlsx`；在 `build_mapping_lookup` 里标到 lookup 条目上（不改动原 mapping）。
- **前后端传输**：`frontend/src/api/function.ts` 的 `expandCases`/`exportFunctionCases` 增加 `ccp_var_types` 字段；`FunctionView.vue`/`FunctionGraphEditor.vue` 透传 `store.ccpVarTypes`。

**验证**：

| 检验项 | 结果 |
|---|---|
| set 分流（EV_/sysvar/信号/argType 兜底） | 7/7 通过 |
| CCP 类型优先（int64→Int、float→Float、无类型回落、mapping 不被污染） | 4/4 通过 |
| 恢复/全部恢复三路匹配 | 4/4 通过 |
| Check/WaitCheck 不动 | 2/2 通过 |
| A47B 设置/恢复行回归（811→811） | 差异 0 |
| A47D 设置/恢复行回归（988→988） | 差异 0 |
| ccp_types 端到端贯通 | A47B 0/0、A47D 0/0 |
| 前端 vue-tsc --noEmit | 通过 |

**相关文件**：
- `backend/services/function_graph.py`
- `backend/core/function_module.py`
- `backend/api/config_routes.py`
- `backend/api/function_routes.py`
- `backend/services/function_case_excel.py`
- `frontend/src/api/function.ts`
- `frontend/src/views/FunctionView.vue`
- `frontend/src/components/graph/FunctionGraphEditor.vue`

**发布状态**：未发布（仍归属 1.0.20）

---

### [1.0.20] - 2026-09-28

**会话主题**：序列接线口自愈 —— 载入时自动清理过时残留连线、接回真断线

**问题**：离线脚本改配置 / 从共享盘导入 / 整张主序列卡片被删掉重拖后，序列接线口的锚点可能步已不存在（锚定到旧的 `s-217` / `s-211` / `s-212`），这类连线在当前版本里「三重静默失效」：画不出、不排号、不参与生成（对应用例的 inject/result 为空）。实测 A47B 配置 9 个工况中有 7 个存在此问题，共 260 条失效序列端口。

**变更内容**：

- **前端自愈函数**（`frontend/src/utils/functionGraph.ts`）：新增 `normalizeStaleSeqAnchors(frame)`，按「另一端卡片 + 端侧」分组判别：
  - **同组还有活边** → 判定为过时残留的死副本（236/260 = 91%），直接删除（用户意图已由活边承载，删之零信息损失）；
  - **同组无活边** → 判定为真断线（24/260 = 9%），吸附到最后一个存活步骤，把断掉的注入/检查接回来。
  - 键格式不变（仍是 `seq:<seqId>@<stepId>`），前后版本兼容。
- **载入时调用**（`frontend/src/views/FunctionView.vue` 的 `normalizeGraph`）：遍历各分组 frame 自愈，仅当有「真断线被接回」时弹一次轻提示（仅清理不弹）。
- **闭环验证**（`_a47b_heal_check.py` + `_a47b_heal_loop.mjs`）：用 esbuild 打包前端真实实现 → Node 里断言分类/清零/幂等/活锚点不动/键形态；再把 before/after 喂进后端真实 `_expand_frame_paths` 比对用例展开。一条命令跑完完整闭环。

**验证（6 项全绿）**：

| 检验项 | 结果 |
|---|---|
| 自愈结果与分类一致 | 清理 236 + 接回 24 = 悬空 260 |
| 悬空清零 | 自愈后 0 个（前端与后端口径一致） |
| 活锚点改动 | 250 个，被改动 0 个 |
| 幂等 | 重复载入不再触发 |
| 键形态 | 异常 0 个（未引入 `#` 等新语法） |
| 后端用例展开 | 总数 136→136 不变；去重不再坍缩 128→136；注入/检查 124→136（12 条空壳已补全） |

`vue-tsc --noEmit` 通过。

**安全保证**：
- 只改已失效的锚点（当前既画不出也不参与生成），活锚点一个字符都不动。
- 键格式不变，旧版本读到的新数据形态与现网完全一致。
- 删除的是「同一卡片同方向已有活边」的绝对冗余，该边在 UI 与生成中均不可见。
- 幂等，重复载入安全。

**相关文件**：
- `frontend/src/utils/functionGraph.ts`
- `frontend/src/views/FunctionView.vue`
- `_a47b_heal_check.py`
- `_a47b_heal_loop.mjs`

---

## [1.0.19] - 2026-09-28

**版本号**：`1.0.19`（`frontend/package.json` 的 `version`）

**安装包**：`#Excel2Case#V1.0.00 Setup 1.0.19.exe`（160,789,164 字节，SHA256 `059869B1E3CD6037E6D7E38A4878AD286148EF823517C20E5159331578D99C4E`）

**共享盘路径**：`\\172.28.4.125\装机工作软件\工具软件\Excel2Case`

**更新配置**（`version.json`）：
```json
{
  "version": "1.0.19",
  "release_notes": "优化：\n- 连线编号选择器：双击序号徽标改为弹出面板（候选 chips 点选 / Ctrl/Shift 多选 / 拖拽框选 / 范围简写输入），不再需要手敲一长串数字；覆盖全部用例编号时徽标收敛为 All\n- 编辑 v2：回填生效编号而非显式编号（自动排号的线双击进去不再一片黑）；清空 = 选中全部编号",
  "setup_name": "#Excel2Case#V1.0.00 Setup 1.0.19.exe"
}
```

**说明**：本版本汇总 1.0.18 之后的 2 条会话更新记录（见下）。纯前端改动（连线编号选择器面板 + 徽标 All 收敛 + 清空语义修正）。

**发布状态**：已发布到共享盘（version 1.0.19）



### [1.0.19] - 2026-09-28

**会话主题**：连线编号选择器 —— 从裸输入框升级为弹出面板，支持点选 / 范围简写 / 快捷键多选与拖拽框选

**问题**：编号多了填写繁琐：只能双击徽标 → 逐条手敲一长串数字（不能点选已有编号），无范围简写（`1-30` 得打 `1,2,3…30`），看不见候选集。

**变更内容**（`frontend/src/components/graph/CaseFrameCanvas.vue`，纯前端，未动数据模型 / 后端）：

- `parseEdgeNums` 支持范围与步进简写：`1-5`、`8-3`（自动翻转）、`2-20/2`（步进），单项展开上限 500 项；空串仍 = `[]`（全部）。
- 双击序号徽标 → 弹出 `el-popover` 编号选择器面板（徽标常驻作 reference，`:persistent="false"` 避免大图上每个徽标都预渲染面板撑爆性能）：标题 + 连线类型、`当前/选择` 两段只读展示、候选 chips、手填行（`placeholder="如 1,2,5-8"`）、`确定/清空/取消`。
- 候选编号数据源 = 本工况实际在用的编号（`resolveFrameNumbers` 的 `caseNums`）∪ 该线已填的号，升序去重；新增 `frameCaseNums` 缓存。
- 候选 chips 支持：普通单击（单选/再点取消）、Ctrl/Cmd 切换、Shift 区间连选、候选区拖拽框选（替换式，Ctrl+拖拽 = 并入）；命中判定用视口坐标，显示坐标换算到容器内，滚动时按差值反向平移起点。
- 选中态唯一真源 = `editingEdgeValue` 字符串；写回唯一路径 = `saveEdgeInline`。
- 移除输入框 `@blur` 提交（否则点 chip / 拖框过程中失焦 → 立刻提交面板关闭，多选手势做不完）；`onWindowMouseDown` 加 `.cfc-num-pop` 守卫。
- `editEdge` 回填「生效编号」（而非仅显式编号），双击进来 chips 默认选中当前值；`edgeSeedNums` 保护：没改动就不写回，避免把继承/自动排号结果写死。
- 「清空」= 选中该工况现有全部编号（写显式 `caseNums`，徽标显示 `All`），结果线/链式线不会因空 = 自动而回退到单个编号。
- 徽标覆盖全部用例编号时收敛为 `All`（新增 `numsDisplayText`），不再列出 `1,2,3…30`。
- 面板提示随状态变化：有选中 → 操作提示；无选中 → `未选编号 = 自动排号 / 继承（要全部请点「清空」）`。
- 帮助浮层文案同步。
- 样式新增 `.badge-editing`（编辑态徽标描边高亮）、`.num-grid`（`position:relative`+flex wrap+可滚动，框选矩形挂靠）、`.num-chip`（`min-width:24px`、圆角 6px、`.active` 实底白字）、`.num-marquee`（与画布 `.cfc-marquee` 同一套选择框语言）、`.num-pop-*` 布局；`.edge-input` 加 `max-width:100%` 防撑破面板；`.cfc-num-pop`（teleport 到 body 的根节点）样式放末尾非 scoped `<style>` 块。

**parsingEdgeNums 验证**：`"1,2,3"→[1,2,3]`、`"1-5"→[1,2,3,4,5]`、`"8-3"→[3..8]`、`"2-20/2"→[2,4,…,20]`、`"1,3,5-9"→[1,3,5,6,7,8,9]`、`""→[]`、`"abc,0,-2"→[]`、`"1-999999"→截断 500`。

**验证**：`vue-tsc --noEmit` 通过；Vite 能正常编译该 SFC（HTTP 200）；应用无新增控制台错误。

**相关文件**：
- `frontend/src/components/graph/CaseFrameCanvas.vue`

**发布状态**：已发布到共享盘（version 1.0.19）

---

### [1.0.19] - 2026-09-28

**会话主题**：连线编号 —— 覆盖全部用例时徽标收敛为 All，清空 = 选中全部编号

**问题**：编号多的线（覆盖 1..30）徽标显示 `1,2,3…30` 太长；清空只在面板里把输入框置空，结果线/链式线会被自动配对规则再算回单个编号，看不到「全部」效果；双击编辑时回填的是显式编号而非生效编号，自动排号得到的 `2` 双击进去一个 chip 都不亮。

**变更内容**（`frontend/src/components/graph/CaseFrameCanvas.vue`）：

- `numsDisplayText`：覆盖该工况全部用例编号（或空编号）时显示 `All` 而不是整串数值。
- `editEdge` 回填 `edgePathCache` 里的生效编号（`nums`），并记录 `edgeSeedNums`；`saveEdgeInline` 只在草稿与种子不同时才写回，防止「双击看一眼」把继承号误锁为显式号。
- `clearEdgeNums` 改为 `writeNumSelection(new Set(frameCaseNums[...]))`（选全），确定后写显式全部，徽标 `All`。
- 「清空」按钮 title：`选中该工况全部编号（徽标显示 All）`；面板未选中提示：`未选编号 = 自动排号 / 继承（要全部请点「清空」）`。
- 面板头部新增「当前 / 选择」两行，让用户能对比徽标上的生效值与草稿差异。
- `.edge-input` 加 `max-width: 100%` 防止编号多时撑破面板。

**验证**：`vue-tsc --noEmit` 通过。

**相关文件**：
- `frontend/src/components/graph/CaseFrameCanvas.vue`

**发布状态**：已发布到共享盘（version 1.0.19）

---

## [1.0.18] - 2026-09-28

**版本号**：`1.0.18`（`frontend/package.json` 的 `version`，已随本次打包改为 `1.0.18`）

**安装包**：`#Excel2Case#V1.0.00 Setup 1.0.18.exe`（159,770,305 字节，SHA256 `B6B48A72341D949B391696D5728BB580E5AE239F205FF19EF533A6A1CD3FB6CA`）

**共享盘路径**：`\\172.28.4.125\装机工作软件\工具软件\Excel2Case`

**更新配置**（`version.json`）：
```json
{
  "version": "1.0.18",
  "release_notes": "新增：\n- EPS.can 的安全算法还原为不依赖任何 DLL 的纯 CAPL 算法库（AES-128 CBC / CMAC、10 个 32 位 Seed→Key、17 个 *_Unlock 全流程），解锁流程按「主机厂 + 算法」选择\n- 找不到 CDD 的主机厂改用默认 CDD（以 BYD 为模板改写诊断寻址 CAN-ID 后另存），不再告警跳过\n- 新增后端单元测试（CDD 寻址改写 + 解锁模板裁剪，36 项，标准库 unittest，不引入新依赖）\n- 工况画布支持「批量改接」连线：批量选中连线后直接点击接线口，按口方向一次性把选中连线的对应端改过去（目标集合与高亮完全一致：单击某条线时改该编号的整组，框选 / Ctrl 多选时只改选中的那些；逐条校验方向，可一次 Ctrl+Z 撤销）\n\n优化：\n- 解锁模板按算法裁剪：只生成选中算法的调用闭包，TestFunction.cin 不再每次膨胀 36.5 KB（平均 272 行 / 全量的 19%）\n- 对象映射表：A2L 对象名按 CAN 模块同一套规则补全（sysvar::XCP::<限定符>::<路径>）\n- 连线高亮区分手势：单击一条连线（或编号徽标）高亮该编号的整条链路，便于读用例链路；Ctrl 多选 / 框选时只高亮选中的那些\n\n修复：\n- 拖到对象映射表已有行时只替换对象名：不再改变量名，也不再改变行在列表中的位置\n- 修复画布快捷键（Delete / Ctrl+Z / Ctrl+A / Insert / Esc 等）在开发态 HMR 后失效：快捷键注册表改为全局单例（挂在 globalThis），不再因模块被重复求值而分裂（表现为改一次代码就失灵、刷新页面又恢复）\n- 修复框选：滚动时起点没固定在画布内容上（矩形粘在视口上、随内容滑走）；选择框不再冲画到画布外（盖住页签 / 底部提示）\n- 修复复制工况后在副本里按 Delete 删卡片，原工况的同名卡片也被一并删掉（Delete 与卡片 ✕ 的删除范围对齐为「当前展示的工况」；复制工况时卡片 / 泳道 / 连线 / 步骤 id 全部重新生成，不再与原件重名）\n- 修复 excel_processor 主机厂分支串接写错（else 只配最后一个 if，BYD 配置会被覆盖成 ChangAnUnlock）\n- 修复 CAPL 保留字 key 被用作参数名 / 局部变量名导致的编译报错\n- 修复点工况框 / 泳道内空白处不能取消选中（原来会改成「选中整条泳道」）：现在点画布任意空白都清空选中，选整条泳道改为点泳道头\n- 修复批量改接「同一编号的连线只改了一根」：目标集合改为与高亮完全一致（选中的 + 同工况共享序号的），并去掉「改完与别的线重复就跳过」的静默跳过\n- 修复批量改接会把同序号里混着的注入线 / 链式线一起改，导致连线接到不相干的卡片上（单击展开同编号时只改「与点中的口同类、且另一端接在主序列上」的线；自己框选 / Ctrl 多选出来的线一律照改）",
  "setup_name": "#Excel2Case#V1.0.00 Setup 1.0.18.exe"
}
```

**说明**：本版本汇总 10 条会话更新记录（见下）。含后端与前端改动 —— 其中 4 条来自其它会话（EPS.can 还原为纯 CAPL 算法库、解锁模板按算法裁剪、找不到 CDD 改用默认 CDD + 改写诊断寻址、后端单元测试），其余 6 条为工况画布（批量改接 / 连线高亮手势 / 点空白取消选中 / 画布快捷键 HMR 修复）、框选、Delete 与 ✕ 对齐、对象映射表拖拽相关改动。

**发布状态**：已发布到共享盘（version 1.0.18）

---

### [1.0.18] - 2026-09-28

**会话主题**：EPS.can 安全算法还原为纯 CAPL 算法库 + 解锁流程按「主机厂 + 算法」选择

**背景**：`Unlock/Unlock/EPS.can` 的 CBC / CMAC 依赖 `AES_CBC.dll` / `capldll.dll`，算法又按主机厂散落在各 `*Unlock` 分支里，无 DLL 环境无法复用。

**变更内容（算法库）**：

- **新增独立算法库** `Unlock/Unlock/SecurityAlgo.cin`（1390 行，936/GBK）：不依赖任何 DLL 的纯 CAPL 实现，覆盖 EPS.can 里的全部安全算法。
  - AES-128 内核：`_aes_gmul` / `_aes_xtime` / `_aes128_keyExpansion` / `_aes128_encryptBlock` / `_aes128_decryptBlock` / `_aes128_shift1`（FIPS-197）。
  - `AES_CBC_Encrypt` / `AES_CBC_Decrypt`（NIST SP 800-38A）、`AES_CMAC`（RFC 4493）。
  - 10 个 32 位 Seed→Key（BYD / ChangAn / SGMW / Geely1.0 / BaoTeng / DongFeng / Seres / SRM / Chery / GAC）+ 5 个 CMAC 封装（Geely3.0 / RC / Chery / DongFeng / CCAG）。
  - 17 个 `*_Unlock(char target[])` 全流程函数（扩展会话 `10 03` → `27` 取种 → 算钥 → `27` 送钥 → 判定），入参即全部依赖，可直接被任意工程包含调用；花括号 133/133 平衡。
- **生成用模板**（`backend/templates/capl.py` 新增 `SecurityAlgoUnlock`，1448 行）：与上面的 .cin 同源，但 **S 盒 / 逆 S 盒 / Rcon 全部改为函数内实时计算**（`_sa_rotl1` / `_sa_inv` / `_sa_sbox` / `_sa_invSbox` / `_sa_rcon`），**不含任何 `variables{}` 全局块**，满足「不依赖全局变量、可自由调用」的要求。
- 正确性用 Python 镜像验证：S 盒 / 逆 S 盒 / Rcon 与标准表 256/256 全等；AES-128（FIPS-197 C.1）、AES-128-CBC（NIST SP 800-38A）、AES-CMAC（RFC 4493）标准向量全部一致。

**变更内容（F18C 多帧读取修复）**：

- 现象：`BYD_CBC_Unlock` 读 `22 F1 8C`（序列号）报「读取序列号失败」。
- 根因：序列号是 22 字节多帧响应（FF + FC + CF×3），诊断层重组耗时超过 50 ms，原流程只等 50 ms 就取响应。
- 修法：所有发送点统一补齐时序 —— `testWaitForDiagRequestSent(req, 500)` + `diagSetP2Extended(-1)` + `testWaitForDiagResponse(req, 50)`，收到 `0x78`（挂起）再等 5000 ms；5 处多帧响应额外补 200 ms（与 `EPS.can` 的 `_Send_Diag_And_Get_CF` 一致）。

**变更内容（生成与选择链路）**：

- **生成时整块替换**：`SecurityAlgoUnlock` 替换 `TestFunction` 里的 `void Unlock()` 存根，并把 `/*Unlock_Algo*/` 标记替换为具体算法调用（如 `ChangAn_SeedKey_Unlock("ABS_ESP");`，target 取 CDD 限定符）。
- **新增 `securityAlgo` 字段贯通前后端**：`FunctionView` / `CANView` 保存与回填 → `stores/modules.ts` 的 `selectedAlgo` → `GlobalSidebar` 的 `OemSelector` → `function_module.py` 桥接到 processor → `function_processor.py` / `excel_processor.py` 据此选择 `*_Unlock`；缺省时按 `serviceObject`（主机厂）取默认算法。
- **主机厂卡片改为「主机厂 + 算法」**（`frontend/src/components/OemSelector.vue`）：17 张卡片，每张两行显示（第一行主机厂名，第二行算法说明，如「吉利3.0 / Geely3.0 CMAC（AES-128-CMAC）」）；`oem` 字段全部落到具体主机厂，取消原先的 `other` 归属。
- **修复既有缺陷**：`excel_processor.py` 原先用连续的 `if BYD / if ChangAn / if GEEA_3.0 / else` 串接赋值，`else` 只配最后一个 `if`，BYD 配置会被覆盖成 `ChangAnUnlock`。
- **编译报错修复**：`key` 是 CAPL 保留字，原被用作 AES 密钥参数名和 6 个 SeedKey 局部变量名，导致从 `_aes128_keyExpansion` 起整片 `parse error` / `Unknown symbol`；统一改名 `keyVal`。

**相关文件**：
- `Unlock/Unlock/SecurityAlgo.cin`（新增）
- `backend/templates/capl.py`
- `backend/processors/function_processor.py`
- `backend/processors/excel_processor.py`
- `backend/core/function_module.py`
- `frontend/src/components/OemSelector.vue`、`frontend/src/components/GlobalSidebar.vue`
- `frontend/src/stores/modules.ts`
- `frontend/src/views/FunctionView.vue`、`frontend/src/views/CANView.vue`

**发布状态**：已发布到共享盘（version 1.0.18）

---

### [1.0.18] - 2026-09-28

**会话主题**：解锁模板按算法裁剪（只生成选中算法的调用闭包）

**问题**：`SecurityAlgoUnlock` 是 17 个算法合一的整块模板（1448 行 / 36,487 字符），生成时只改入口调用。实测一次生成只用到其中一个 —— 其余 16 个 `*_Unlock` 入口完全用不到；SeedKey 类还用不到 430 行的 AES 内核；`TestAES_SelfTest`（67 行）纯自检。`TestFunction.cin` 因此每次额外膨胀 36.5 KB。

**变更内容**：

- `backend/templates/capl.py` 新增 `build_security_algo_unlock(entry_name)` 与结构分析工具 `_sec_split` / `_sec_sanitize`：
  - 按行切出 `[(函数名, 起始行, 结束行)]`（自动吸收函数上方紧贴的注释块）；
  - 去掉注释 / 字符串后解析调用关系，从目标 `*_Unlock` 与 `Unlock()` 出发求闭包，只输出闭包内的函数；
  - **不维护手工依赖表**，后续往模板里加算法无需同步改依赖清单。
- 对 SeedKey / CMAC 两类的分发 switch 做**特化**：`_seedKeyByAlgo(algoId, seed)` → 直接 `ChangAn_SeedKey(seed)`、`_cmacByAlgo(algoId, seed, mac)` → 直接 `Chery_CMAC(seed, mac)`；分发器失去引用后自动脱落，其余主机厂实现不再被连带保留。
- 未知算法名时原样返回整块模板，避免生成残缺代码。
- 生成链路改为调用该函数：`function_processor.py` / `excel_processor.py`。

**效果（17 个算法实测）**：

| 类别 | 裁剪后 | 全量 | 生成文件增量 |
|---|---|---|---|
| SeedKey（10 家） | 124–185 行 | 1448 行 | +3.8 KB |
| CMAC（5 家） | 423–424 行 | 1448 行 | +9.2 KB |
| CBC（2 家） | 542–549 行 | 1448 行 | +12.8 KB |

平均 272 行（全量的 19%）；CMAC / CBC 剩下的主要就是算法本身必需的 AES 内核。

**验证**：17 个算法逐个检查无悬空内部调用、花括号闭合、`/*Unlock_Algo*/` 标记在位、其它算法零残留；模拟完整替换链后 `void Unlock()` 代码定义唯一、花括号净增量为 0。

**遗留**：裁剪后模板顶部的「目录：一~六」说明与「一、AES-128 内核」分节横幅仍会保留，即使对应内容已被裁掉（纯注释，不影响编译）。

**相关文件**：
- `backend/templates/capl.py`
- `backend/processors/function_processor.py`
- `backend/processors/excel_processor.py`

**发布状态**：已发布到共享盘（version 1.0.18）

---

### [1.0.18] - 2026-09-28

**会话主题**：找不到 CDD 的主机厂改用默认 CDD 并改写诊断寻址 CAN-ID

**问题**：`cdd/` 下只有 BYD / SGWM / GEEA_3.0 / GEEA_1.0 / CheRy / ChangAn 六份 CDD，其余主机厂（宝腾 / 东风 / 赛力斯 / 广汽 / 瑞驰 / 鑫源 / CCAG 等）生成时只会告警并跳过，CANoe 工程缺诊断描述。

**变更内容**（`backend/core/great_canoe_module.py`）：

- 新增 `_OEM_DIAG_ADDRESSING`：13 家主机厂的（物理请求 / 物理响应 / 功能请求）CAN-ID，来源 `ZLG_GUI_32/address_configs.json`；缺条目按同集团复用 —— CCAG 复用长安 `0x785/0x78D`，赛力斯、东风 `0x723/0x7A3`，宝腾 `0x7D2/0x7DA`，功能寻址统一 `0x7DF`。
- 新增 `_rewrite_cdd_addressing(text, phys_tx, phys_rx, func_tx)`：CANdela CDD 的寻址取值形如 `<UNSDEF id='X'>…<QUAL>层名.ReqCanId</QUAL></UNSDEF>` 配 `<UNS attrref='X' v='十进制ID'/>`，按 `QUAL` 反查属性 id 再替换对应实例值（覆盖 CDD 内全部诊断层）。
- `_copy_oem_cdd_dll_to_output` 增加回退：找不到 `<oem>.cdd` 时以 `BYD.cdd` 为模板改写寻址后另存为 `<oem>.cdd`；表里没有的主机厂沿用 BYD 的 CAN-ID 并打 warning；自带 CDD 的六家仍走原样复制分支。
- 读写均用 `newline=''` 保持原文件 LF 行尾不变；模块新增 `import re`。

**验证**：GAC / 宝腾 / 东风 / 赛力斯 / CCAG 分别生成对应 CDD，物理请求 / 响应依次为 `0x714/0x794`、`0x7D2/0x7DA`、`0x723/0x7A3`、`0x723/0x7A3`、`0x785/0x78D`；改写后文件与 `BYD.cdd` 等长（仅等长替换 ID 值），`UNSDEF` 自带默认值（1792 / 1536）不被误改。

**相关文件**：
- `backend/core/great_canoe_module.py`

**发布状态**：已发布到共享盘（version 1.0.18）

---

### [1.0.18] - 2026-09-28

**会话主题**：新增后端单元测试（CDD 寻址改写 + 解锁模板裁剪）

**变更内容**：

- 新增 `tests/` 目录，用标准库 `unittest`（项目未装 pytest，不引入新依赖），共 36 项：
  - `tests/test_cdd_addressing.py`（22 项）：寻址表完整性与取值合法性（11 位、功能寻址恒 0x7DF）、`_rewrite_cdd_addressing` 三类寻址 × 多层改写、`UNSDEF` 默认值不被误改、无关属性不动、等位宽时长度不变、幂等、无匹配定义 / 空文本原样返回；`_copy_oem_cdd_dll_to_output` 回退链路（13 家逐个生成、表外主机厂告警并沿用 BYD ID、自带 CDD 优先复制、空串 / other 直接返回、无资源告警）；真实 `cdd/BYD.cdd` 回归（文件缺失自动 skip）。
  - `tests/test_security_algo_unlock.py`（14 项）：17 个算法裁剪结果闭包自洽（无悬空内部调用、花括号闭合、入口与 `Unlock()` 保留、其它算法零残留、体积小于全量一半、自检函数被剔除）、SeedKey / CMAC 分发特化、CBC 不受影响、未知算法名回退整块模板、模拟替换链后 `void Unlock()` 代码定义唯一。

**运行方式**：`python -B -m unittest discover -s tests -v`

**相关文件**：
- `tests/test_cdd_addressing.py`（新增）
- `tests/test_security_algo_unlock.py`（新增）

**发布状态**：已发布到共享盘（version 1.0.18）

---

### [1.0.18] - 2026-09-24

**会话主题**：对象映射表拖拽规则（A2L 对象名按 CAN 模块补全规则；拖到已有行只换对象名，不改变量名、不挪位置）

**变更内容**（`frontend/src/components/graph/MappingManager.vue`）：

- **A2L 对象名按 CAN 模块的补全规则**：改为取拖拽载荷的 `text/plain` —— 对象浏览器拖拽时已按同一套规则拼好（有 `A2L_Qualifier` 时 `sysvar::XCP::<限定符>::<路径>`，mapxml 无限定符模式下退化为路径本身），不再直接用对象浏览器里的原始路径。取同一个来源，避免两处各写一份规则、日后漂移。
- **拖到「变量名」输入框不再改变量名**：行的 drop 由 `@drop.stop` 改为 `@drop.prevent.stop`。原来直接拖到变量名输入框上时，浏览器默认会把拖拽文本插进输入框（等于改了变量名）；现在统一由行的 drop 处理，只替换对象。
- **拖到已有行不再挪动位置**：`onRowDrop` 不再改 `kind`。分类（signals / dtcs / messages / envvars / a2l）决定行在列表里的分桶位置，改分类会把整行挪到别的桶；而分类不参与生成（后端 `resolve_text` 只按 `alias → name` 解析），保留它没有副作用。

**现状确认**：拖到已有行只改 `name`（对象名），`alias`（变量名）与 `kind`（所在分类 / 列表位置）都不动；新增变量（拖到列表空白 / 「新增变量」按钮）仍按原规则「变量名默认 = 对象名」，并按拖入对象的分类分桶。

**验证**：`vue-tsc --noEmit` 通过。未做实机拖拽（需进入图形配置并载入 A2L 文件），两端为静态核对（`ObjectPanel.onDragStart` 写 `text/plain` → `MappingManager.parseDrop` 读）。

**相关文件**：
- `frontend/src/components/graph/MappingManager.vue`

**发布状态**：已发布到共享盘（version 1.0.18）

---

### [1.0.18] - 2026-09-24

**会话主题**：框选：起点锚到画布内容（滚动不再漂移）+ 选择框不再冲出画布

**问题**：
1) 框选时滚动滚轮，选择框的起点没有固定在画布上 —— 矩形是 `position: fixed` 的视口坐标，起点在 mousedown 时按 `clientX / clientY` 记下，滚动画布后内容移走了、起点却还粘在视口的同一处。
2) 选择框会画到画布外，盖住顶部工况页签 / 底部提示 —— 矩形只按视口坐标画，没有任何裁剪。

**变更内容**（`frontend/src/components/graph/CaseFrameCanvas.vue`）：

- 按下时额外记录画布当时的 `scrollLeft / scrollTop`；框选期间监听 `.cfc-canvas` 的 `scroll`，按滚动增量把起点**反向平移**，让它始终钉在同一块画布内容上（矩形仍按视口坐标绘制，命中检测逻辑不变）。
- 抽出 `applyMarquee()` 供 mousemove 与 scroll 共用；滚动时用「补偿后的起点 + 最近一次指针位置」重算矩形。
- 只滚不拖（还没过 4px 阈值、尚未出框）时不凭空生成选择框。
- `mouseup` 时移除 scroll 监听并清掉起点 / 指针缓存。
- 新增 `clampToCanvas()`：**只裁画面上那个矩形**，让它不再画到画布外。选中范围不裁 —— 框内但已滚出可视区的对象同样会被选中（裁了会漏选）。

**验证**：`vue-tsc --noEmit` 通过。未做实机验证 —— 需要「按下 → 移动 → 滚轮 → 松手」的连续指针序列，当前浏览器工具无法脚本化注入中途的滚轮事件。

**相关文件**：
- `frontend/src/components/graph/CaseFrameCanvas.vue`

**发布状态**：已发布到共享盘（version 1.0.18）

---

### [1.0.18] - 2026-09-24

**会话主题**：Delete 删除卡片与卡片 ✕ 按钮的逻辑对齐（不再连带删掉原工况的同名卡片）

**问题**：复制一个工况后，在副本里按 Delete 删卡片，原工况里的同一张卡片也被删掉；点卡片的 ✕ 则正常。

**根因**：`copyFrame` 用 `JSON.parse(JSON.stringify(f))` 整框复制，只换了工况 id，**卡片 / 泳道 / 连线 id 与原件完全相同**；而 `deleteSelection`（Delete 键）是遍历**全部工况**按 id 找卡片的，于是原件里的同名卡片一并被删。`removeNode`（✕ 按钮）先按 `frameId` 定位工况再删，所以只删副本里的那张。

**变更内容**（`frontend/src/components/graph/CaseFrameCanvas.vue`）：

- `deleteSelection` 的遍历由 `frames` 收窄到 `visibleFrames`（当前展示的工况），与 ✕ 按钮的删除范围一致。
- `Ctrl+A` 全选同样只选当前展示的工况（画布一次只挂一个工况，选中画面外的卡片既看不见也删不到）。
- 新增 `watch(() => props.activeFrameId)`：切换工况时清空画布选中，避免旧选中在新工况里命中同名卡片。
- **根因一并修掉**：`copyFrame` 改为调用新增的 `cloneFrameWithNewIds()` —— 整框深拷贝后把**卡片 / 泳道 / 连线 / 步骤 id 全部换新**，并按映射重写端口键里的 `node:<nid>` 与 `seq:<seqId>@<stepId>` 引用（锚点步骤已不存在的悬空键保留原 stepId，仍由「悬空连线」兜着）；旧字段 `sequenceId` / `injects` / `recovers` / `results` 一并重映射。

**实机验证**（A47B，复制工况「ADS_Tq_配置字」）：副本的卡片 / 连线 / 用例数与原件一致（8 张卡片、8 条连线、2 条用例），而节点 id 全部换成新值（原件 `a47b-tq-node-cfg-*` → 副本 `node-mukxpzad-*`），并且画布上**没有出现任何悬空连线提示** —— 说明端口键重映射后拓扑与序列锚点仍然完整；测试用的副本已删除、画布恢复 9 个工况。

**验证**：`vue-tsc --noEmit` 通过。

**相关文件**：
- `frontend/src/components/graph/CaseFrameCanvas.vue`

**发布状态**：已发布到共享盘（version 1.0.18）

---

### [1.0.18] - 2026-09-24

**会话主题**：工况画布「批量改接」连线（选中多条连线后点接线口一次性改接）

**需求**：批量修改接错位置的连线（典型场景：一整排结果线都挂在主序列的错误步骤上）—— 先批量选中连线，再点目标接线口一次性改接。

**变更内容**（`frontend/src/components/graph/CaseFrameCanvas.vue`）：

- 新增 `repointSelectedEdges(frameId, key, side)`：把**当前展示工况**里选中的连线改到点中的接线口 —— **点输入口改入端 `to`，点输出口改出端 `from`**（与既有 `batchConnect` 的约定同源）。逐条走 `edgeDirOk` 方向校验；两类跳过原因（方向不合法 / 无需改动）分别计数后一次性汇总提示。
- `onPortClick` 接入**裸点击**分支：未按任何修饰键时先尝试批量改接（选中 ≥2 条连线才接管），否则维持现状；Ctrl/Meta 点击仍是原来的「批量连线 / 两步连线」，两条批量路径靠修饰键天然隔离。
- 只改 `from` / `to`，`seq` / `pair` 原样保留（用例号仍由 `resolveFrameNumbers` 解析）；批量成功后**只 `emitChange()` 一次 + `scheduleRecompute()` 一次**，所以一次 Ctrl+Z 能把整批改接撤销回去；选中态保留，便于连续改接到下一个口。
- 框选后的选中提示补一句操作说明：「（Delete 删除；选中多条后点接线口可批量改接）」，避免这个隐藏手势没人知道。
- **修掉两个「同一编号的连线只改了一根」的坑（实机反馈）**：① 目标集合原来取 `selectedEdgeIds`，而选一根线时画面会把**同工况内共享序号的线一起高亮**（`isEdgeHighlighted`），看起来整组选中、实际只改了一根 —— 改成新增的 `highlightedEdgeIds()`，**目标集合与高亮完全一致**（选中的 + 同工况共享序号的，含并行边）；② 去掉了「改完与别的线重复就跳过」的判定，同号并行线不再被静默跳过，选中/高亮的一律改。
- **再修「改到不相干的卡片上」（实机反馈）**：同一序号里混着三类线 —— 注入线（卡片→主序列）、结果线（主序列→卡片）、链式线（卡片→卡片）。原来只按「点击的口在哪一侧」决定改 `from` 还是 `to`，点一个卡片的口就会把同组注入线的 `to`（本该是序列口）也改成那张卡片，链式线也会被改到别的卡片上。现在加两道闸：① 要改的那一端必须与点中的口**同类**（都为卡片口 / 都为序列口）；② 这根线**另一端必须接在主序列上**（纯卡片↔卡片的链不参与）。两类跳过分别计数（接线口类型不同 / 不接主序列）。
  ⚠️ 这两道闸一开始是**无条件**生效的，结果「自己框选出来的链式线」也被判成「不接主序列」而全部拒绝（实机提示 `未改接任何连线（…不接主序列 3）`）—— 已改成**只在「单击展开同编号」时生效**：显式框选 / Ctrl 多选出来的线是用户明确要改的，一律照改（仍过 `edgeDirOk` 挡掉结构上不成立的方向）。
  提示文案也随之改成只列非 0 的跳过原因。
  改接语义速查：点**卡片的口** → 只改「另一端接主序列、且该端是卡片口」的线（结果线的 `to`）；点**主序列步骤的口** → 只改接在序列口上的线（结果线的 `from` / 注入线的 `to`），**出线口改 `from`、入线口改 `to`**。
- **高亮规则按手势细分（按需求定义）**：新增 `highlightSameNum` ——
  - **单击**一条连线 / 编号徽标 → 高亮「选中的 + 同工况同编号」的整条链路（目的是提高用例链路可读性）；
  - **Ctrl/Shift 追加多选** 或 **框选** → 只高亮选中的那些，不再展开同编号。
  批量改接的目标集合改为**直接复用 `isEdgeHighlighted`**，所以「亮的」和「会被改的」永远是同一批：单击时改整个同编号组，多选/框选时只改你选的那些。

**验证**：`vue-tsc --noEmit` 通过；HMR 后画布正常渲染、控制台无报错/告警。

**未验证（受限）**：改接链路未做实机点验 —— 浏览器工具无法脚本化「框选（mousedown → move → mouseup）」与「Ctrl + 组合点击」，且接线口是**无文本的空 div**、拿不到可点击的 ref（`browser_drag` 直接抛错且无任何状态变化）。需人工按验证清单点验一次。

**相关文件**：
- `frontend/src/components/graph/CaseFrameCanvas.vue`

**发布状态**：已发布到共享盘（version 1.0.18）

---

### [1.0.18] - 2026-09-24

**会话主题**：修复画布快捷键（Delete / Ctrl+Z）在开发态 HMR 后失效

**问题**：画布快捷键（Delete 删除选中、Ctrl+Z 撤销、Ctrl+A 全选、Insert 新建工况、Esc 清选中）时好时坏 —— 改一次代码就全部失灵，刷新页面又恢复。

**根因**：dev 下 HMR 会把 `useShortcuts.ts` 实例化成两份（模块环上的 `?t=` 失效传播导致同一文件被求值两次），各持一份注册表；组件注册进「新表」，而派发器还在监听「旧表」。取证：应用自带入口 `window.__SHORTCUTS__.list()` —— 刚刷新页面、画布首次挂载时 9 条画布快捷键（`canvas:deleteSelection@Delete`、`canvas:undo@Ctrl+Z` …）都在；HMR 若干次后画布 DOM 仍在、也能框选，但这 9 条全部从注册表消失（只剩 `graph:save`、`config:save` 等旧表里的项）。

**变更内容**（`frontend/src/composables/useShortcuts.ts`）：

- 把注册表 / 安装标记（派发器与弹窗回车）/ 触发器日志 / 序号固化到 `globalThis.__TRAE_SHORTCUT_STATE__`，任何一次模块求值都用同一份；生产环境本来就是单实例，行为不变。
- 取值处同步改为 `sharedShortcuts.*`（`registerShortcut` 的 `seq`、`installShortcutDispatcher` 的 `installed`、`installDialogEnterConfirm` 的标记、`shortcutLog` 数组）。

**验证**：`vue-tsc --noEmit` 通过；用 `?probe=a1` / `?probe=b1` 强制把该模块求值两次 —— A 实例注册的项在 B 实例的 `listShortcuts()` 里可见、`shortcutLog` 是同一个数组、`off()` 跨实例生效（修复前这三项均为 false）。

**相关文件**：
- `frontend/src/composables/useShortcuts.ts`

**发布状态**：已发布到共享盘（version 1.0.18）

### [1.0.18] - 2026-09-24

**会话主题**：点画布空白处取消选中（原来点泳道内空白会改成选中整条泳道）

**问题**：只有点在 `.cfc-canvas` 自身（工况框以外的空白）才取消选中（`@click.self`）；点**工况框 / 泳道体内的空白**被 `onLaneBlankClick` 吃掉了 —— 它做的是「选中这条泳道」。所以多选之后想点空白取消，卡片/连线的选中确实清了，但泳道又被选上，看起来像没取消。

**变更内容**（`frontend/src/components/graph/CaseFrameCanvas.vue`）：

- 新增 `onCanvasBlankClick(e)`，挂在 `.cfc-canvas` 的 **`@click`（冒泡阶段）**：目标不在 `.node / .port / .edge-label / .edge-input / .lane-head / .lane-resizer / .gap-zone / button / input / textarea` 之内就 `clearSelection()`。
- 删掉泳道体上的 `@click="onLaneBlankClick(...)"` 及该函数 —— 泳道体空白现在冒泡到画布统一处理（取消选中）；**选整条泳道改由点泳道头完成**（`onLaneHeadClick` 带 `.stop`，不受新处理器影响）。
- 顺带不再在泳道体空白点击里 `markLastLane`，避免「随手点空白取消选中」顺手改掉 Ctrl+V 的粘贴目标。

**实机验证**：点卡片 → `.node-selected = 1`；再点工况框内空白 → `= 0`（取消选中 ✓）；点泳道头 → `.lane-selected = 1`（泳道选择仍可用 ✓）；`vue-tsc --noEmit` 通过。

**相关文件**：
- `frontend/src/components/graph/CaseFrameCanvas.vue`

**发布状态**：已发布到共享盘（version 1.0.18）

---

## [1.0.17] - 2026-09-24

**版本号**：`1.0.17`（`frontend/package.json` 的 `version`）

**安装包**：`#Excel2Case#V1.0.00 Setup 1.0.17.exe`（159,343,481 字节，SHA256 `663F6E57788F92FD885F45AEEE2A2F14F0C71A548F23053134B1CAED53967A00`）

**共享盘路径**：`\\172.28.4.125\装机工作软件\工具软件\Excel2Case`

**更新配置**（`version.json`）：
```json
{
  "version": "1.0.17",
  "release_notes": "新增：\n- 侧边栏新增「CAN 通道」「继电器模块」两项配置（仅 Function / CAN 模块显示），生成时随请求下发；继电器 CAPL 模板与配置抽成后端共用模块，Create CANoe / Function / CAN 三处统一（生成前按配置注入，先删后加、幂等），不配置时生成结果与改动前一致\n- CAN「其他配置」新增「11ResetTime」参数卡片，补齐 11 重启用例的等待时间\n\n优化：\n- Function 图形配置性能：序列化 / 深拷贝改用 toRaw，一次拖拽落卡的同步耗时 151ms → 31ms（约 5×）；用例展开查找表只建一次；步骤拖拽排序、函数名与参数名补全、对象浏览器搜索、值资源库监听同步减负\n- Function 图形配置「工况单独显示」：画布一次只挂载一个工况 + 顶部工况标签页 / 上下切换，单次渲染 DOM 节点由 9232 降到最大 3962（最重的工况占 43%）；顶部用例数改为只算当前工况；expand-cases 新增 ids_only，响应体积 116KB → 10KB\n- 主序列右侧出线改为与左侧入线按顺序一一配对（原来每根出线都继承左侧编号全集，等于每根结果线都出现在所有用例里）\n\n修复：\n- 修复 Shift 多选卡片后拖拽只移动被拖的那一张（改为整批移动 / 整批删除，Ctrl+Z 可撤销）\n- 修复 CAN 11 重启用例里 {waittime} 未被替换、生成结果残留占位符\n- 修复工况框自动排号把「锚点已失效」的死线也算进去，导致新画的 泳道→主序列 连线编号从 30 开始\n- 工况框校验不再提示「锚定步骤悬空」（锚定的主序列步骤被删），只保留「悬空连线（端点卡片已删除）」与卡片类提示",
  "setup_name": "#Excel2Case#V1.0.00 Setup 1.0.17.exe"
}
```

**说明**：本版本汇总 1.0.16 之后的 7 条会话更新记录（见下）。含后端与前端改动。
其中前 3 条随 1.0.17 首次推送发布；后 4 条（工况单独显示、校验提示精简 + 清理死线、排号跳过死线、右侧出线一一配对）是首次推送后的改动，已**按同一版本号 1.0.17 重新构建并覆盖**共享盘安装包（上面的体积 / SHA256 即新版；首次推送那版为 158,922,359 字节 / `7F8D3578…7693C`）。注意：已装过首次推送那版 1.0.17 的机器因版本号相同不会再收到更新提示，需手动安装新包。

**发布状态**：已发布到共享盘（version 1.0.17）

---

### [1.0.17] - 2026-09-24

**会话主题**：Function 图形化配置页面卡顿根因分析 + 优化验证 + 多选卡片移动缺陷修复

**卡顿根因（实机测量）**：

以真实配置 A47B 打开图形配置（浏览器实测：9 个工况框、642 张卡片、442 条可见连线），测一次画布改动（拖拽落卡）的耗时构成：

| 环节 | 优化前 | 根因 |
|---|---|---|
| `drop` 同步处理 | **151 ms** | 对**深层响应式代理**做 `JSON.stringify` 深拷贝：每个属性访问都要过 Proxy 取值 + `reactive()` 缓存查找 |
| Vue 重渲染 | ~141 ms | 642 张卡片 + 442 条 SVG 连线的全量重渲染 |
| 连线重算 / 收尾 | ~324 ms | rAF 重算 + `ResizeObserver` 抖动 |

用 Node 对同一份数据复现纯算法开销：整图 JSON 深拷贝 12 ms、用例展开 7.4 ms、连线校验 5.5 ms（合计 ≈ 32 ms）—— **纯算法只占约 1/5，其余 120 ms 全是响应式代理的序列化开销**，这是最大的一块纯浪费。

**变更内容（性能）**：

- **序列化 / 深拷贝改用 `toRaw`**：`CaseFrameCanvas.emitChange` / `resetHistory` / `applyFramesSnapshot`、`FunctionGraphEditor.emitGraph` 与 props 同步，全部改成对原始对象序列化。
- **用例展开查找表只建一次**（`frontend/src/utils/functionGraph.ts`）：新增 `frameCaseRowsWithLookups(frame, cardLookup, valueLookup)`，`frameCaseRows` 复用它；`FunctionGraphEditor.frameCaseRowsMap` 与画布兜底 `localCaseRowsMap` 改为「卡片库 / 值资源库索引各建一次」，计算走 `toRaw`，依赖只保留到「数组 / 对象引用」这一层（画布每次改动都整体替换 `frames`，卡片库 / 值资源库也是整体替换）。
- **步骤拖拽排序**（`frontend/src/components/graph/StepEditor.vue`）：`calcInsertIdx` 原来每次 `dragover` 都 `querySelectorAll('.step-row')` + 逐行 `getBoundingClientRect()`（强制同步布局、O(步骤数)，每秒触发几十~上百次）；改为 dragstart 缓存一次行中线，`dragover` 只做数值比较并用 rAF 合并到一帧一次，`drop` 时按最新鼠标位置同步补算。
- **函数名 / 参数名补全**（同文件）：`allFunctions()` 每次按键都重建「预设 + 函数库」合并数组，改为 `computed`，并新增 `allFunctionNames` / `allArgNames` 两个候选列表缓存。
- **对象浏览器搜索防抖**（`frontend/src/components/ObjectPanel.vue`）：DBC / DTC / A2L 三个过滤 computed 要递归整棵树，原来每敲一个字符全量重算；改为关键字延后 200 ms 生效（输入框本身仍即时回显），并移除 `a2lTree` computed 里的 `console.log`。
- **值资源库**（`frontend/src/components/graph/ValueLibraryPanel.vue`）：去掉对 `props.values` 的 `deep: true`（草稿只需在数组增删 / 整体替换时补齐缺失项）。

**变更内容（多选卡片移动缺陷）**：

- 现象：Shift 多选卡片后拖拽，只移动被拖的那一张。
- 根因：拖拽载荷只记录单个 `nodeId`（Ctrl 复制路径反而支持整批）。
- 修法：dragstart 记录整批 `nodeIds`；新增 `moveNodesToLane()` 统一处理「落泳道 / 落卡片 / 落泳道间隙 / 拖出工况框」四个落点；`dropIndexInLane()` 支持排除整批以算准插入下标；拖出工况框改为整批删除（Ctrl+Z 可撤销）；拖拽态高亮改为整批高亮。

**验证**：

- `vue-tsc --noEmit`、`vite build`（临时 outDir，未动 `dist/`）通过。
- **实机前后对比**（vite dev + 浏览器）：`drop` 同步耗时 **151.2 ms → 30.7 ms**（约 5×）；页头用例数、136 条用例行、642 张卡片均正确刷新，控制台无新增报错。
- **算法等价性**：`frameCaseRows` 新旧两条路径输出**完全一致**，20 工况 / 200 卡片下快 **26.3%**（收益随工况数 × 卡片数放大）。
- **多选移动**：Shift 多选 2 张卡片拖到另一泳道 → 目标泳道新增 2 张、源泳道清空（`movedCount: 2 / remainedInA: 0`）。
- 步骤拖拽排序实机复测仍正确换位（首行移到第 3 位）。

**未做（原因）**：

- 642 张卡片的**全量重渲染（~141 ms）**：需要把工况 / 泳道 / 卡片拆成子组件并做稳定 key + 局部更新，属较大重构。
- `emitGraph` 的**整图深拷贝**改为浅拷贝共享分组内容：风险集中在保存链路上，未动。
- 对象浏览器大树 / 大列表的**虚拟滚动**。

**顺带发现**：18735 端口上曾挂着一个更早启动的旧 Flask 进程（Windows `SO_REUSEADDR` 允许多进程绑同端口，旧进程抢到了请求），导致一次 HTTP 验证拿到旧内容；已清理，与代码无关。

**相关文件**：
- `frontend/src/components/graph/CaseFrameCanvas.vue`
- `frontend/src/components/graph/FunctionGraphEditor.vue`
- `frontend/src/components/graph/StepEditor.vue`
- `frontend/src/components/graph/ValueLibraryPanel.vue`
- `frontend/src/components/ObjectPanel.vue`
- `frontend/src/utils/functionGraph.ts`

**发布状态**：已发布到共享盘（version 1.0.17）

---

### [1.0.17] - 2026-09-24

**会话主题**：继电器 CAPL 模板与配置抽成多模块共用 + Function / CAN 侧边栏新增「CAN 通道 / 继电器模块」

**变更内容（后端）**：

- **新增共用模块** `backend/templates/relay.py`：唯一一份继电器模板 + 配置（`0=老 / 1=单刀（单掷） / 2=双刀（双掷）`，对应 CAPL 的 `Relay` 变量 `1/2/3`），对外提供 `build_relay_cin`（Create CANoe 的 Relay.cin 整文件）、`build_relay_variables` / `build_relay_section`（嵌入 TestFunction.cin 的变量 + `RelayON`/`RelayOFF`）、`strip_relay` / `inject_relay`（生成前注入，先删后加、幂等）。
- **Create CANoe 改为共用实现**（`backend/templates/canoe_capl.py`）：删掉 `CaplGenerator.RELAY` 里 150 行的模板字面量，`generate_relay()` 委托 `relay.build_relay_cin()`。
- **Function / CAN 去掉内联实现**（`backend/templates/func_test_function.py`、`backend/templates/test_function.py`）：删除各自的 `RelayON`/`RelayOFF` 与 `RelayState` / `RelayCAN` / `on preStart` 初始化，改为拼接共用模板；生成时统一由 `inject_relay` 按配置注入（历史配置里固化的旧实现同样会被替换掉）。
- **生成链路**：`backend/api/function_routes.py` → `FunctionModule.save_Function(..., relay_module, can_channel)`；`backend/api/can_routes.py` → `CANModule.generate_output(..., relay_module, can_channel)` → `ExcelProcessor`，在写 `TestFunction.cin` 前注入。
- **默认值**：Function / CAN 取「双刀 + 通道 2」—— 与这两个模块改造前的内联实现完全一致，不配置时生成结果不变。

**变更内容（前端）**：

- **侧边栏新增两项配置**（`frontend/src/components/GlobalSidebar.vue`）：在「CFG 配置文件」区块**上方**插入「CAN 通道」「继电器模块」两段式滑块，仅 Function / CAN 模块显示；卡片做了紧凑样式（无说明文字，高 64 px）。
- **状态与下发**（`frontend/src/stores/modules.ts`、`frontend/src/api/function.ts`、`frontend/src/api/can.ts`、`frontend/src/views/FunctionView.vue`、`frontend/src/views/CANView.vue`）：`relayConfigs` 按模块各存一份（会话级），生成时随请求下发 `relay_module` / `can_channel`。

**变更内容（数据）**：

- **Function 全局函数库同步**：`configs/function/Function_global_library.json` 的 `function_library` 字段替换为共用实现（函数库面板读的是这个文件，不是模板）；只改这一个字段，`cards` / `mapping` / `value_library` / `step_library` 逐字节不变。原文件备份为 `Function_global_library.json.bak_before_shared_relay`。

**验证**：

- **等价性**：`relay.build_relay_cin()` 与 Create CANoe 原模板**逐字符等价**（忽略空白，三种继电器模块全通过）—— Create CANoe 行为不变。
- **Function 生成**：三种配置 + 不传参默认值分别生成 `TestFunction.cin`，`RelayCAN` / `RelayMode` / `RelayState` 声明唯一、旧内联 `message 0x101 Relaymsg` 与 `on preStart` 初始化清零、花括号平衡。
- **幂等性**：`inject_relay` 在**真实历史配置**（13 万字符）上二次生成结果完全一致。
- **接口下发**：Flask 测试客户端确认 `/api/function/generate`、`/api/can/generate` 都把 `relay_module` / `can_channel` 传到了模块层。
- `vue-tsc`、`py_compile`、模块导入均通过；浏览器实测侧边栏顺序为「主机厂选择 →（电机类型）→ CAN 通道 → 继电器模块 → CFG 配置文件 → 模块文件上传」，Boot 模块不显示这两项。

**相关文件**：
- `backend/templates/relay.py`（新增）
- `backend/templates/__init__.py`
- `backend/templates/canoe_capl.py`
- `backend/templates/func_test_function.py`
- `backend/templates/test_function.py`
- `backend/core/function_module.py`
- `backend/core/can_module.py`
- `backend/processors/excel_processor.py`
- `backend/api/function_routes.py`
- `backend/api/can_routes.py`
- `frontend/src/components/GlobalSidebar.vue`
- `frontend/src/stores/modules.ts`
- `frontend/src/api/function.ts`、`frontend/src/api/can.ts`
- `frontend/src/views/FunctionView.vue`、`frontend/src/views/CANView.vue`
- `configs/function/Function_global_library.json`

**发布状态**：已发布到共享盘（version 1.0.17）

---

### [1.0.17] - 2026-09-24

**会话主题**：CAN 模块「11ResetTime」参数（补齐 11 重启用例缺失的等待时间）

**问题**：`testcase_11ResetTxMsgAttribute` 模板里本来就有 `testWaitForMessage({waittime});`，但生成时只传了 `MsgName` / `MsgId`，`{waittime}` 从未被替换 —— 生成的 `xxx_11Reset_Attribute` 用例里会残留未替换的占位符。

**变更内容**：

- **后端补参数**（`backend/processors/excel_processor.py`，`_gen_tx_msg_testcases`）：`testcase_11ResetTxMsgAttribute.format(MsgName, MsgId, waittime=self.config_data.get('waittime') or 3000)`，未填时按 3000 处理（与同文件 11 复位后 `TestWaitForTimeout(3000)` 的既有等待一致）。
- **CAN「其他配置」新增参数卡片**（`frontend/src/views/CANView.vue`）：新增「纯参数卡片」机制（`ParamCardDef` + `paramCardDefs`）—— 只有一个输入框、没有开关，值直接进 `Other` 表，后端按 key 取用；新增 `11ResetTime` 卡片，排在 `Ready_OffDiagStop` **正下方**（`grid-column: 4` 固定与它同列，自动落位到下一行同列），带整数校验与「使用说明」气泡。

**验证**：

- 模板替换：`waittime=2500 / 3000` 均正确产出 `testWaitForMessage(2500);`，无残留占位符。
- 取值链路：`Other: { waittime: '2500' }` 经 `_convert_ui_to_dataframe` 后 `config_data['waittime'] == '2500'`；不填时兜底 3000。
- 页面实测：输入 `12a3b5` 回显 `1235`（v-model + 整数校验生效）；卡片位置实测 `x=963, y=492`（`Ready_OffDiagStop` 为 `x=963, y=390`），同列同宽 213×92。
- `vue-tsc` 通过。

**遗留 / 待确认**：

- `testWaitForMessage({waittime})` 只有一个参数，而同文件其他用例都是 `testWaitForMessage({MsgName},3000)`（报文 + 超时两个参数）。本次只按需求填了 `waittime`，未改模板；若这里也应带报文名，需再确认。
- 顺带发现（既有问题，非本次引入）：`tBusOff` 卡片宽仅 24 px —— 它 `span 2` 正好落在两条被内容压到 7 px 的窄列上；已用对照测试（临时隐藏 11ResetTime）确认与本次改动无关。

**相关文件**：
- `backend/processors/excel_processor.py`
- `frontend/src/views/CANView.vue`

**发布状态**：已发布到共享盘（version 1.0.17）

---

### [1.0.17] - 2026-09-24

**会话主题**：Function 图形配置「工况单独显示」——画布一次只挂载一个工况 + 顶部工况标签页

**问题**：上一轮把 `drop` 的同步耗时从 151 ms 降到 31 ms 后，页面整体仍卡。实测证明**成本与「改了哪个工况」无关**（第 1 个工况 8 张卡 → flush 192.6 ms；第 6 个工况 2 张卡 → flush 254 ms），说明瓶颈不在单次算法，而在「一个巨型组件对全部 9 个工况做全量 diff」。

**变更内容**：

- **后端 `expand-cases` 新增 `ids_only`**（`backend/api/function_routes.py`、`frontend/src/api/function.ts`）：只回 `{case_id, frame_id, frame_row}` 并跳过 `build_testcase_can`，响应 116 KB → 10 KB（8.7%）。
  注意**不能**改成「只展开当前工况」：`naming=default` 时 case_id 用跨工况全局递增的 `idx`，单工况展开会重新编号，与「用例预览」和生成的 CAPL 用例名对不上 —— 所以仍按整图展开，只裁剪返回字段。
- **编辑器收敛到当前工况**（`FunctionGraphEditor.vue`）：新增 `activeFrameId` / `activeFrame` / `setActiveFrame`；`frameCaseRowsMap` 只算当前工况（`caseCount` 随之只算当前工况），顶部标签由合计改为「当前工况 N 条用例」；`refreshCaseIds` 走 `ids_only`。
- **画布一次只挂载一个工况**（`CaseFrameCanvas.vue`）：新增 `visibleFrames`（只含当前工况）；`summarizeMap` / `sequenceRowsMap` / `frameDiags` / `recompute` 四处循环全部收敛到 `visibleFrames`。
- **顶部工况标签栏**：`◀ / ▶` 上下切换 + 可点标签（`1. 名称`…`9. 名称`）+ 位置 `n / N`；新建 / 复制工况、拖入卡片新建工况后自动切到新工况。
- **打通链路**（`PanelBody.vue`）：向画布传 `active-frame-id`，并回传 `update:active-frame-id`。

**实机验证（A47B，9 个工况）**：

| 工况 | 卡片 | 画布 DOM 节点 |
|---|---|---|
| 1 ADS_Tq_配置字 | 8 | 185 |
| 2 Eps Off->No Active | 11 | 307 |
| 3 No Active->No Active | 83 | 1221 |
| 4 Ready->No Active/Ready/Active | 187 | 2506 |
| 5 Active->No Active/Active | 302 | 3962 |
| 6 ADS扭矩-性能 | 2 | 100 |
| 7 优先级 | 16 | 300 |
| 8 跑偏补偿 | 5 | 166 |
| 9 极限续航 | 28 | 492 |
| **改造前（9 个工况一次全挂）** | **642** | **9232** |

- 单次渲染最大为工况 5 的 3962 个节点（占改造前的 43%），其余 8 个工况均在 2506 以下、多数低于 500。
- 9 个标签、`◀ / ▶` 切换、位置 `n / 9`、按当前工况计数均实测正常；`vue-tsc --noEmit` 通过。
- `ids_only` 与全量展开的 case_id **完全一致**（136 条，逐条比对）。
- 如实记录：`ids_only` 只解决**响应体积**，**服务端耗时基本没省**（`expand_cases` 本身 24 ms 是大头，`build_testcase_can` 只有 22.5 ms）—— 本次性能收益来自前端「一次只挂载一个工况」。

**遗留 / 待确认（既有问题，非本次引入）**：

- 画布本地的「用例展开」与后端展开在**工况 3（No Active->No Active）**上差 1 条：画布 30 行，后端只生成 29 条用例 —— 第 30 行拿不到后端 case_id，回落成自动名。9 个工况的画布计数之和为 137，而「用例预览」为 136。
- 根因未完全定位：已排除「出口连线编号并入 `case_nums`」（TS 侧同样有该并集）与接线口锚点解析（`resolveSeqPortIdx` / `_resolve_seq_step_idx`）两处；两套实现的其余差异未逐一比对。
- `frameCaseRowsWithLookups` / `expandFramePaths`（TS）本次未改动、各工况行数不变，故为既有问题；本次只是把「当前工况 N 条用例」按单工况展示后更容易看到这 1 条差异。

**相关文件**：
- `backend/api/function_routes.py`
- `frontend/src/api/function.ts`
- `frontend/src/components/graph/FunctionGraphEditor.vue`
- `frontend/src/components/graph/CaseFrameCanvas.vue`
- `frontend/src/components/graph/PanelBody.vue`

**发布状态**：已发布到共享盘（version 1.0.17）

---

### [1.0.17] - 2026-09-24

**会话主题**：工况框校验提示精简 —— 不再提示「锚定步骤悬空」，只保留「悬空连线（端点卡片已删除）」与卡片类提示

**变更内容**：

- `frontend/src/utils/functionGraph.ts` 的 `frameDiagnostics` 新增 `isStaleSeqAnchor`：接线口的锚定步骤被删除 / 旧序号越界时，该线不再计入「悬空连线」提示（仅当**两端都是锚点漂移**才跳过；只要有一端是「端点卡片已删除 / 不在任何泳道中 / 无法识别」仍然提示）。
- 画布底部提示文案由「端点卡片已删除或接线口失效」改为「端点卡片已删除」。
- 卡片类提示（孤立 / 未接入主序列 / 缺少主序列 / 参数没值）与「悬空连线」的删除按钮均保持不变。

**验证**：A47B 工况 3「No Active->No Active」由「140 处待修正」降为「82 处待修正」，底部「悬空连线 58 条」列表消失（那 58 条全是锚定 `a47b-sm-s-211` / `a47b-sm-s-212` 的死线）；`vue-tsc --noEmit` 通过。

**顺带查明（既有问题，未改动）**：

- 工况 3 的 29 条 inject→主序列 连线**没有显式编号**（`pair` 为空），起点卡片左侧无入线 → 由「起始卡片自动排号」占掉 1–29；这就是新画一条 泳道→主序列 连线会拿到 30 的原因。
- 这 29 条 + 主序列→结果 的 29 条线，锚点全部失效（锚定到已删除的 `a47b-sm-s-211` / `a47b-sm-s-212`）→ 画布不绘制、也不参与生成，所以工况 3 的 29 条用例 `inject` / `result` 都是空的。
- 实测并已按确认执行删除：删除后工况 3 由 **29 条用例掉到 1 条**（用例号 1–29 正是这些线排出来的）、全配置 136 → 108 条；`configs/function/Function_configs.json` 两处 frames（`graph.frames[2]` 与 `graph.groups[0].frames[2]`）各删 58 条，备份为 `Function_configs.json.bak_before_drop_stale_edges`（回写用 `json.dumps(indent=2)` + CRLF，已验证与原文逐字节一致，只有删除处有差异）。
- 配置里 frames 存了两份（`graph.frames` 与 `graph.groups[].frames`），生成走 `graph.groups[].frames`（`expand_cases`），只改 `graph.frames` 不影响生成。

**相关文件**：
- `frontend/src/utils/functionGraph.ts`
- `frontend/src/components/graph/CaseFrameCanvas.vue`

**发布状态**：已发布到共享盘（version 1.0.17）

---

### [1.0.17] - 2026-09-24

**会话主题**：工况框自动排号跳过「锚点已失效」的死线（新画的连线不再从 30 开始）

**问题**：工况 3 的 29 条 inject→主序列 连线锚点已失效（锚定到已删除的 `a47b-sm-s-211` / `a47b-sm-s-212`），画布不绘制、也不参与用例生成，但 `assignStartOutgoing` / `_assign_start_outgoing` 仍给它们自动排号 1–29 → 之后新画的 泳道→主序列 连线只能从 **30** 开始。

**变更内容**：

- 前端 `frontend/src/utils/functionGraph.ts` 的 `resolveFrameNumbers`：新增 `staleEdgeIds`（两端任一是「锚点已失效」的接线口），`assignStartOutgoing` 排号时跳过这些连线。
- 后端 `backend/services/function_graph.py` 的 `_resolve_frame_numbers`：同样的 `stale_keys` + `_assign_start_outgoing` 跳过。
- 两侧必须同步改，否则画布编号与生成 CAPL 的用例号会不一致。

**验证**：

- 后端（用删除前的备份配置，58 条死线在场）：工况 3 的 `case_nums` 仍为 1–29、`paths=29`，死线不再占号；再模拟加入 6 条 inj→主序列 新线 → 新线编号 **1–6**，`case_nums` 仍 1–29。
- 前端实机（HMR）：工况 3 由「35 条用例」回到「29 条用例」，新画的 6 条线编号显示 1–6。
- `vue-tsc --noEmit` 通过。

**注意**：后端进程需要重启才会生效（当前是 IDE 里 debugpy 起的 `run.py`，未由我重启）。

**相关文件**：
- `frontend/src/utils/functionGraph.ts`
- `backend/services/function_graph.py`

**发布状态**：已发布到共享盘（version 1.0.17）

---

### [1.0.17] - 2026-09-24

**会话主题**：主序列右侧出线与左侧入线按顺序一一配对（不再继承左侧编号全集）

**问题**：主序列右侧（主序列 → 卡片）新画的连线，未显式填编号时会继承左侧入线编号的**全集** —— 左边是 1、2、3 三根线时，右边每根新线都变成 1、2、3（每根线都出现在全部 3 条用例里），而不是一一配对。

**变更内容**：

- 前端 `frontend/src/utils/functionGraph.ts` 的 `resolveFrameNumbers`：在 `allLinks` 循环**之前**，把未显式填编号的出口连线按「泳道从左到右、同泳道从上到下」排序，依次配左侧编号 `leftNums[k % n]`；必须在此之前落号，否则会被 `nodeNums(seqId)` 的全集覆盖。
- 后端 `backend/services/function_graph.py` 的 `_resolve_frame_numbers`：同样的处理。
- 已显式填编号的出口连线不受影响（不会被覆盖）；出线多于入线时循环取号。

**验证**：

- 合成工况：左 3 根（1、2、3）+ 右 3 根未填 → 右 = 1、2、3（各一个）；右 4 根 → 第 4 根循环回 1。
- 混合场景：out1 显式 `[2]` 保持不变，out2 / out3 配到 1、2。
- 回归：A47B 工况 3（删除前的备份）`case_nums` 仍 1–29、`paths=29`；实机画布工况 3 仍「29 条用例」。
- `vue-tsc --noEmit` 通过。

**注意**：后端进程同样需要重启才生效。

**相关文件**：
- `frontend/src/utils/functionGraph.ts`
- `backend/services/function_graph.py`

**发布状态**：已发布到共享盘（version 1.0.17）

---

## [1.0.16] - 2026-09-23

**版本号**：`1.0.16`（`frontend/package.json` 的 `version`）

**安装包**：`#Excel2Case#V1.0.00 Setup 1.0.16.exe`（157,679,681 字节，SHA256 `6BF3BCBC922920AF2A1BE57E5725DE59C3BB97E9AE86B02C7F9987565FE6FF27`）

**共享盘路径**：`\\172.28.4.125\装机工作软件\工具软件\Excel2Case`

**更新配置**（`version.json`，打包时使用）：
```json
{
  "version": "1.0.16",
  "release_notes": "优化：\n- Function 画布卡顿治理：拖泳道宽度不再触发全工况的用例展开与连线校验重算；工况名连续输入改为防抖回写；拖连线 / 拖泳道宽度 / 拖分栏改为一帧最多更新一次；顶部「N 条用例」与画布共用同一份用例展开结果；连线重算的编号避让由 O(边数²) 改为分桶比对，并缓存端口位置；卡片摘要与主序列行改为按依赖缓存\n- 画布连线改为显示在卡片上层，跨过卡片时不再被挡住\n- 连线支持多选（Ctrl/Shift+单击追加）与框选（与框接触即选中，卡片可一起框选）\n- 已多选卡片时，Ctrl 点击接线口可一次批量连线\n- Delete 一次删除选中的卡片 / 泳道 / 连线；并修复「选中后按 Delete 无反应」（焦点停留在面板输入框上时快捷键被跳过）",
  "setup_name": "#Excel2Case#V1.0.00 Setup 1.0.16.exe"
}
```

**说明**：本版本汇总 1.0.15 之后的 2 条会话更新记录（见下）。纯前端改动。

---

### [1.0.16] - 2026-09-24

**会话主题**：画布连线图层置顶 + 连线多选 + 框选（卡片 + 连线）+ Ctrl 批量连线 + Delete 删除选中对象（含 Delete 失效的定位与修复）

**变更内容**：

- **连线图层抬到卡片上面**（`frontend/src/components/graph/CaseFrameCanvas.vue`）：原来只有一层 `.edge-svg`（`z-index` 低于 `.node`），连线跨过卡片时被卡片挡住。**直接把这层抬上去不行** —— 连线是 SVG 描边、`pointer-events: stroke` 就是可点区域，抬到卡片上面会把卡片的按下与拖拽全吃掉。改为拆两层：命中层 `.edge-hit`（`z-index: 5`，在卡片下面，`stroke: transparent` 不画可见线，只负责点击 / 双击与框选命中）+ 可见层 `.edge-top`（`z-index: 7`，压在卡片上面，`pointer-events: none`，只画线不接事件）。
- **连线选中态由单选改多选**：`selectedEdgeId: ref('')` → `selectedEdgeIds: ref<string[]>([])`。单击高亮（再点一次取消）、Ctrl/Shift+单击追加或取消、双击删除，三条路径统一；「相同序号一起高亮」的比对依据抽成 `selectedEdgeNums` computed，高亮判定改用 `isEdgeHighlighted(p, frameId)`。
- **框选（条件 1）**：从画布空白处按下拖拽即拉出选框，**卡片与连线一起选中** —— 连线按 16 段折线近似逐段判交（Liang–Barsky），只要曲线与框接触就选中，不要求整条落在框里；卡片与框矩形求交即选中。选框为视口坐标固定定位，不随画布滚动偏移。位移 < 4px 视为普通点击（单击选泳道 / 卡片的行为不受影响），框选结束的那次 `click` 在捕获阶段吞掉，避免顺手改掉泳道的选中态。
  - 卡片命中前先把框裁到工况**可视区**再求交，否则会把已经横向滚出可视区的卡片一并选中。
  - 已排除 `.node / .port / .lane-head / .lane-resizer / .edge-label / .edge-input / .gap-zone / button / input / textarea` 作为框选起点；起点处用 `document.body.style.userSelect = 'none'` 拦掉原生文本选择 —— **不能用 `e.preventDefault()`**，原因见下「Delete 失效的定位与修复」。
- **Ctrl 批量连线（条件 2）**：已多选卡片（≥2）时，`Ctrl` 点接线口 = **一次把选中的卡片都连到这个口上**。点的是输入口 → 各选中卡片「输出 → 该输入口」；点的是输出口 → 「该输出口 → 各选中卡片输入」。每个口仍逐条按方向规则校验（卡片→卡片、卡片→主序列、主序列→卡片），全部不合法时给一次提示；成功时**只 `emitChange` 一次**（N 条边逐个 `createEdge` 会触发 N 次整图深拷贝回写）。选中卡片数 < 2 时仍走原来的「记住起点 → 再点终点」两步流程。
- **Delete 删除所有选中对象（条件 3）**：`deleteSelection()` 原来只处理选中的卡片与泳道，现纳入 `selectedEdgeIds`，一次删除卡片 + 泳道 + 连线（被卡片 / 泳道连带删掉的连线不重复计数），并给出「已删除 N 张卡片、M 条泳道、K 条连线」的提示。

**Delete 失效的定位与修复（条件 3 的实机跟进）**：

用户反馈「delete 没有生效」。用 vite dev（`5173`）+ Chrome DevTools 实机复现，以 `window.__SHORTCUTS__.log`（派发层记录最近 50 次命中的快捷键 id）判定按键究竟有没有被派发，定位到**三个各自独立**的成因：

| # | 成因 | 现象 / 证据 | 修法 |
|---|---|---|---|
| 1 | 框选起点的 `e.preventDefault()` | 它会阻止浏览器把焦点从当前输入框移走；焦点留在输入框上时，派发层按 `isEditableEl` 跳过 Delete | 改用 `document.body.style.userSelect`（`onMarqueeUp` / 下次 `mousedown` 恢复为 `''`） |
| 2 | 连线编号徽标 / 泳道拖宽条上的 `@mousedown.stop.prevent` | 实机证据：焦点在 `.frame-name` 上时点徽标，`document.activeElement` 仍是 `frame-name`，按 Delete 后 `__SHORTCUTS__.log` 不增长（`canvas:deleteSelection` 从未命中）—— 选中态已经有了、按键却被跳过 | 新增捕获阶段的 `onCanvasMouseDownCapture`：画布内任意按下，若当前焦点是 `INPUT / TEXTAREA / SELECT / contentEditable` 就先 `blur()`。捕获阶段执行，保证早于子元素的 `.stop` / `.prevent` |
| 3 | 框选结束时用 `stopPropagation()` 拦不住同元素上的监听 | 框的起终点都落在画布留白时，`click` 的目标就是 `.cfc-canvas` 本身，而 `@click.self="clearSelection()"` 挂在**同一个元素**上 → 刚框出来的选中态被立刻清空 | `onCanvasClickCapture` 改用 `stopImmediatePropagation()` |

成因 2 是「按键彻底没反应」的主因：画布上唯一能改焦点的地方只有 `.frame-name`，而它一旦拿到焦点就不会因为点画布而失去（点卡片走的是 `click`，不搬焦点；点徽标 / 拖宽条又被 `preventDefault` 挡住），于是此后所有 Delete 都被静默跳过。

顺带修掉一处「静默无反应」：只选中**主序列泳道**时（规则上不可删）原来什么都不做、也不提示，现补一条 `ElMessage.warning('主序列泳道不可删除，可删除其上的卡片或连线')`。

**验证**：
- `vue-tsc --noEmit` + `vite build` 通过（exit 0）。
- **已实机复现并定位**（vite dev `5173` + Chrome DevTools MCP）：画布挂载后 `.cfc-canvas` 存在、`__SHORTCUTS__.list()` 中 `canvas:deleteSelection`（keys `Delete`，scope `context`）已注册；焦点在 `.frame-name` 上点连线徽标后 `activeElement` 未变、按 Delete 后 `__SHORTCUTS__.log` 不增长 —— 与上表成因 2 一致。
- **用户复测确认**：修复后 Delete 已生效。
- 注：`18750` 是 Flask 托管的**已构建** `frontend/dist`，dev（`5173`）下改动即时生效；打包版（Electron exe）内嵌的是构建产物，需重新打包才会带上本次修复。
- 框选 / 批量连线的交互仍只经静态确认（类型检查 + 构建），未逐条实机走查。

**相关文件**：
- `frontend/src/components/graph/CaseFrameCanvas.vue`

**发布状态**：已发布到共享盘（version 1.0.16）

---

### [1.0.16] - 2026-09-23

**会话主题**：Function 画布卡顿治理（第一批 4 项修复 + 剩余问题描述）

**问题描述（1.0.15 实测反馈的操作卡顿场景）**：

| 场景 | 触发链 | 根因 | 本批 |
|---|---|---|---|
| 拖泳道右边缘 | `mousemove` 写 `lane.width` | `frameLanes` 用 `{ ...l }` 展开泳道对象，把**纯展示用**的 `width` 也读成了响应式依赖 → 「用例展开」与「连线校验」两个 computed 对**所有工况**整体失效，每帧重算一遍 | ✅ 已修 |
| 工况名连续输入 | 每个字符一次 `emitChange` | 每次回写 = 整图深拷贝 **2 次**（画布 `emitChange` 1 次 + 编辑器 `emitGraph` 1 次）+ 全量用例展开 1 次 | ✅ 已修 |
| 拖连线 | `mousemove` 写 `tempLine` | 每个 `mousemove` 都读 body / 端口 `rect` 并触发**整个画布重渲染**，无节流；且渲染函数里的 `sequenceRows` / `summarize` 无缓存 | ✅ 已修（rAF 节流 + 渲染缓存） |
| 调整页面大小 | `window.resize` + 每个 `.frame-body` 的 `ResizeObserver` → `scheduleRecompute` | `recompute` 全量：约 **4×边数** 次 `getBoundingClientRect`（强制布局）+ 编号避让 **O(9×边数²)**；窗口拖拽时约每帧一次 | ✅ 已修 |
| 拖分栏 / 面板边框（“缩放”） | `DockLayout.onResizeStart` 改 `ratios`、`ResizableSplitter`（侧栏 / 用例分组 / 代码预览分栏） | 容器尺寸变化 → `ResizeObserver` → 同上一行的 recompute；额外一层：分栏 `mousemove` 也没有 rAF 节流 | ✅ 已修 |
| 打开图形配置 | `openGraphEditor` → 编辑器挂载 | 整图深拷贝 **×2**（编辑器 `JSON.parse(JSON.stringify(props.graph))` + 画布 `resetHistory` 的 `JSON.stringify(frames)`）+ 迁移遍历 + 首屏全量展开 + `recompute` **最多重试 8 次**，全挤在挂载那几帧 | ⚠️ 部分（详见「未做」与「遗留」） |

关于「缩放」：Function 工况画布**本身没有缩放功能** —— `zoomBy` 只存在于 `MindMapCanvas` / `GraphCanvas`，这两个组件全项目无引用。所以「缩放」应是浏览器缩放（Ctrl+滚轮 / Ctrl +/-）或拖拽分栏，两者都走同一条 resize → `recompute` 链。

**变更内容（第一批 4 项）**：

- **断开 `lane.width` 依赖**（`frontend/src/utils/functionGraph.ts`）：`frameLanes` 原来无条件 `{ ...l }` 展开，现改为**类型已规范时直接返回原数组**（调用方只读 `id`/`type`/`nodeIds`）；只有旧的四类泳道类型（inject/recover/sequence/result）才走复制分支。
- **工况名输入防抖**（`frontend/src/components/graph/CaseFrameCanvas.vue`）：`@input` 改为防抖 300ms 才回写（`v-model` 已改本地 `f.name`，显示不受影响）；`@change` / `@blur` 立即补一次，避免「改完名字直接点保存」丢名字；`emitChange` 开头会清掉挂起的防抖计时器（其它回写已经带上新名字）。
- **高频 mousemove 加 rAF 节流**（同文件）：拖泳道宽度的 `onMove` 只记录坐标、在 `requestAnimationFrame` 里才写 `lane.width`，松手时 `cancelAnimationFrame` + 立即 apply 收尾；连线拖拽 `onLinkMove` 同样合并到下一帧，`onLinkUp` 取消挂起帧。
- **`caseCount` 复用画布结果**（`frontend/src/components/graph/FunctionGraphEditor.vue` + `PanelBody.vue` + `CaseFrameCanvas.vue`）：把 `frameCaseRowsMap` 从画布**上提到编辑器**（原来两边各算一份同样的展开），`caseCount` 由它求和得出，经 `geCtx` / `case-rows-map` prop 下发；画布本地那份保留为兜底（computed 惰性，传了 prop 就不会求值）。

**变更内容（第二批）**：

- **`recompute` 减负**（`frontend/src/components/graph/CaseFrameCanvas.vue`）：
  - 编号避让原来每条边都要跟「已放置的全部编号」比一遍（**O(9×边数²)**，200 条边约 36 万次比较）。改为把已放置编号按 `34×20` 分桶，只比对 ±1 格（冲突阈值就是格宽/格高，更远的格子不可能命中）；兜底的「取最远候选」也只查 ±2 格。
  - 同一次重算里端口位置是固定的，加了一层 `portPos` 结果缓存：`getBoundingClientRect` 调用次数从「约 4×边数」降到「约 4×端口数」（大量边共用同一个接线口）。
- **`recompute` 限频**（同文件）：`scheduleRecompute` 的合并从 `nextTick`（按**微任务**合并，同一帧里仍可能连跑好几次）改成 `requestAnimationFrame`（一帧最多一次，且在 DOM 更新之后、绘制之前）。同时删掉 `refreshLayout` 的「跑两遍」—— 它原来是 `scheduleRecompute()` + `nextTick(rAF(recompute))`，两次落在同一帧；rAF 闸门本身已经是「DOM 更新后算一次」，3 个调用点（泳道左右移、泳道复制、泳道拖拽排序）直接改调 `scheduleRecompute()`。
- **渲染期缓存**（同文件）：`sequenceRows(f)` 与 `summarize(node)` 原来直接写在渲染函数里，画布每次重渲染（拖拽、连线、选中…）都对每张卡片重算 `nodeParamValues` + `paramDisplayText`。改为 `sequenceRowsMap` / `summarizeMap` 两个 computed（按 `帧id` / `帧id:节点id` 缓存），模板改调 `sequenceRowsOf(f)` / `summarizeOf(f, nid)`。
- **分栏 / 面板拖拽加 rAF 节流**：`DockLayout.onResizeStart`（停靠分栏）与 `ResizableSplitter.onMouseMove`（侧栏 / 用例分组 / 代码预览分栏）都改成「mousemove 只累计位移，rAF 里才写结果」，松手时 `cancelAnimationFrame` + 立即 apply 收尾。
- **打开配置**（`frontend/src/utils/functionGraph.ts`）：`isLosslessCopy` 的库卡片步骤签名（`stepSignature` 是逐步骤 `JSON.stringify`）加缓存 —— 同一个库卡片常被多个节点引用，原来每个节点都要把它的签名重算一遍。

**未做（原因）**：
- 编辑器开场的整图深拷贝（`JSON.parse(JSON.stringify(props.graph))`）**没改**：编辑器会在 `migrateLegacyGroups` / `migrateCopyNodes` 里就地改**所有分组**的 `frames` / `cards` / `mapping` / `valueLibrary`，若改成「只克隆活动分组」，这些改动会直接落到父组件的对象上、绕过 `update:graph` 回写流程，风险大于收益。
- `resetHistory` 的 `JSON.stringify(frames)` **没改成惰性**：它是「第一次改动之前的基线快照」，必须在任何改动发生前拿到；改成惰性会让「改一次再撤销」失效。
- `recompute` 的 8 次重试**没改成「只补算缺失边」**：盲重试是为了容忍「DOM 还没渲染完」，按「缺失数是否下降」提前停止会漏画连线；减负后每次重试已经很便宜。

**验证**：
- `vue-tsc --noEmit` + `vite build` 通过（exit 0）。
- **未做运行时实测**：本机 18750 未启动，且仓库内没有配置数据（配置存在 `DATA_DIR/configs`，不在代码树里），所以没有前后耗时对比数字。

**遗留（打开配置仍卡，建议先测量再动）**：
「打开图形配置」与另外三个场景不是同一类问题 —— 它是**挂载瞬间的一次性开销叠加**：整图深拷贝 + 两次迁移遍历 + 首屏把整个画布 UI（工况 / 泳道 / 卡片 / 端口 / 连线 / **每个工况的「展开为 N 条用例」列表**）一次性建出来。其中用例展开列表是**每个工况全量渲染、既无折叠也无虚拟化**，是大配置下 DOM 量最大的一块。
要继续压这块，建议先加临时耗时打点实测一次（深拷贝 / 迁移 / 首屏渲染 / `recompute` 各占多少），再决定是给用例列表加折叠、还是做虚拟滚动 —— 这两者都会改变现有交互，需要先确认。

**相关文件**：
- `frontend/src/utils/functionGraph.ts`
- `frontend/src/components/graph/CaseFrameCanvas.vue`
- `frontend/src/components/graph/FunctionGraphEditor.vue`
- `frontend/src/components/graph/PanelBody.vue`
- `frontend/src/components/graph/DockLayout.vue`
- `frontend/src/components/ResizableSplitter.vue`

**发布状态**：已发布到共享盘（version 1.0.16）

---

## [1.0.15] - 2026-09-23

**版本号**：`1.0.15`（`frontend/package.json` 的 `version`）

**安装包**：`#Excel2Case#V1.0.00 Setup 1.0.15.exe`（157,672,373 字节，SHA256 `ADC4CBE57CA3B949C5F60703A4881AB56CC84A61C0F50C47FDAB35634F1AAB16`）

**共享盘路径**：`\\172.28.4.125\装机工作软件\工具软件\Excel2Case`

**更新配置**（`version.json`，打包时使用）：
```json
{
  "version": "1.0.15",
  "release_notes": "新增：\n- Function 步骤卡片新增「弹窗提示」类型：生成人工确认弹窗（testWaitForTesterConfirmation），可填提示内容与超时（默认 60000ms），测试人员确认后继续\n\n优化：\n- Function 画布与左侧列表联动：点工况框 / 泳道，左侧「工况」列表聚焦到该工况；点工况里的卡片（含主序列），对应的卡片列表聚焦到它引用的库卡片并滚进可视区",
  "setup_name": "#Excel2Case#V1.0.00 Setup 1.0.15.exe"
}
```

**说明**：本版本汇总 1.0.14 之后的 2 条会话更新记录（见下）：画布 → 左侧列表聚焦（纯前端）、步骤卡片「弹窗提示」（前端 + 后端）。

---

### [1.0.15] - 2026-09-23

**会话主题**：Function 画布 → 左侧列表聚焦（点工况 / 序列 / 卡片，列表定位到对应条目）

**背景**：
A47B 这类配置一个分组里有几十张库卡片，画布上的卡片只显示名字。改完卡片库再回到画布，想找「刚才那张卡」只能在一长串列表里手动翻。需求反过来：从画布点一下，列表就定位过去。

**变更内容**（纯前端）：

- **画布发事件**（`frontend/src/components/graph/CaseFrameCanvas.vue`）：
  - 新增 `select-card` / `select-frame` 两个事件。
  - 抽出 `emitCardFocus(frameId, nodeId)`：取节点的 `refId`（指向卡片库的那张）发出去；**独立副本（拖函数库进来、`refId` 为空）在库里没有条目，不发事件**。
  - 触发点：普通卡片 `onCardClick`、主序列卡片 `onSeqCardClick`（新增）、工况框头 `onFrameHeadClick`（新增，原来是裸 `clearSelection()`）、泳道头 / 泳道空白 `onLaneHeadClick` / `onLaneBlankClick`。
  - 主序列卡片**刻意不加 `.stop`**：点击仍冒泡给泳道做原有的「选中泳道」，只是额外多发一个聚焦事件，不改动画布选中行为。

- **编辑器处理**（`frontend/src/components/graph/FunctionGraphEditor.vue`）：
  - 新增 `focusLibraryCard({ cardId, type })`：按卡片类型把对应面板置为可见、切到 tab 前台，再把 `selectionCardIds` / `selectionCardId` 收敛到这一张（复用列表原有的高亮状态，不另造一套）。
  - 新增 `focusFrameItem(frameId)`：**刻意不复用 `selectFrame()`** —— `selectFrame` 会清空 `selectionCardId`，那样点工况里的卡片时会把刚聚焦的卡片高亮清掉。它只设 `selectedFrameId`，并带「id 还在 frames 里」的守卫：工况框头里的「复制 / 删除工况」按钮会冒泡到这里，已删掉的 id 不该再选中。
  - 两个函数都挂到 `geCtx` 供面板调用。

- **列表滚动**（`frontend/src/components/graph/PanelBody.vue`）：卡片条目补 `data-card-id`、工况条目补 `data-frame-id`；`watch` `selectionCardId` / `selectedFrameId` → `nextTick` 后找到对应条目 `scrollIntoView({ block: 'nearest' })`。用 `nearest` 而不是 `start`：条目本来就在视口内时是空操作，直接点列表不会跳。

**验证**：
- `vue-tsc --noEmit` + `vite build` 通过（exit 0）。
- **未做运行时点测**：本机 18750 未启动，且仓库内没有配置数据（配置存在 `DATA_DIR/configs`，不在代码树里）。

**已知副作用（沿用既有行为，未改）**：
- 选中工况会让画布把该工况 `scrollIntoView({ behavior: 'smooth', block: 'start' })` 滚到顶部（画布本来就有这个 watch）。所以点工况框头 / 泳道时，画布会顺带把该工况对齐到顶部。
- 点画布卡片会把 `selectionKind` 变成 `card`（列表选中状态自带的 `watch`）。画布 Ctrl+C 是 `context` 作用域、优先级更高，选中节点时仍复制节点；只有画布选中被清空后才按「复制库卡片」走。

**相关文件**：
- `frontend/src/components/graph/CaseFrameCanvas.vue`
- `frontend/src/components/graph/FunctionGraphEditor.vue`
- `frontend/src/components/graph/PanelBody.vue`

**发布状态**：已发布到共享盘（version 1.0.15）

---

### [1.0.15] - 2026-09-23

**会话主题**：Function 步骤卡片新增「弹窗提示」类型（人工确认弹窗）

**需求**：Function 的步骤卡片要一种「弹窗提示」——生成人工确认弹窗，等测试人员确认后继续。现场 CAPL 写法：

```
{
char Str_Temp[100]="提示内容";
testWaitForTesterConfirmation(Str_Temp,60000);
}
```

**变更内容**：

- 后端 `backend/services/function_graph.py`：新增 `_render_tester_prompt()`，`render_step_to_capl` 分发 `tester_prompt`。
  - 提示内容取步骤级 `prompt`，超时取 `time`（留空按 60000ms）。
  - **数组长度必须显式给**（CAPL 不支持不定长数组，`char Str_Temp[]="…"` 编译不过）：取 `max(100, 提示内容 UTF-8 字节数 + 1)`，`+1` 是串尾 `\0`；下限 100 沿用模板里 `char Signame[100]` 的惯例。用 UTF-8 字节数是因为它 ≥ GBK 字节数，无论生成文件最终是什么编码都不会算小。
  - 提示内容里的 `"` 与 `\` 做转义（`\"` / `\\`），避免破坏字符串字面量。
  - `_substitute_card_params` 也替换 `prompt` 里的 `{{参数}}`；与 raw / fun / 步骤级数值字段不同，**提示内容为空不丢弃整步**（空提示允许生成）。
- 后端 `backend/services/function_case_excel.py`：用例导出时该步骤 Fun 列给 `testWaitForTesterConfirmation`、parameter 列给提示内容（仅供阅读，导入仍以 CAPL 列为准）。
- 前端 `frontend/src/types/functionGraph.ts`：`CardStep.kind` 新增 `tester_prompt`，新增 `prompt?: string`。
- 前端 `frontend/src/utils/functionGraph.ts`：`STEP_KIND_LABEL` 加「弹窗提示」；`STEP_NUM_FIELDS` 加「超时」（占位 60000）；`newStep` 给默认值。
- 前端 `frontend/src/components/graph/StepEditor.vue`：类型下拉新增该项；专属编辑块（超时输入 + 提示内容多行框 + 参数助手）；`onKindChange` 初始化字段；拖拽悬浮标签、`isBlankStep`、`collectCardTexts`、`paramifyField` / `inlineField` 的字段联合类型同步。
- 前端 `frontend/src/components/graph/CardEditor.vue`：组合卡片编辑器同步支持（提示内容 + 超时、提示文案、`onKindChange`、参数收集）。
- 前端 `frontend/src/components/graph/CaseFrameCanvas.vue`：画布步骤标签显示「弹窗提示 <内容>」。

**验证**：
- 后端 `py_compile` 通过；渲染实跑（临时脚本，跑完已删）覆盖：正常 / 超时留空回落 60000 / 超时为空白串 / 提示含 `"` 与 `\` / 空提示 / 卡片参数替换（有值与缺值）/ 循环体内缩进多行装配。
- 数组长度实测：`hello`(5B)→`[100]`、中文 16 字(51B)→`[100]`、ASCII 150 字→`[151]`、中文 100 字(300B)→`[301]`、空→`[100]`。
- 前端 `vue-tsc --noEmit` + `vite build` 通过（exit 0）。

**说明**：按需求给的写法生成 `testWaitForTesterConfirmation(Str_Temp, 超时)`；模板里另有既有用法 `TestWaitForTesterConfirmation("…")`（大写 T、无超时、带返回值），两者不是同一个，未改动。

**相关文件**：
- `backend/services/function_graph.py`
- `backend/services/function_case_excel.py`
- `frontend/src/types/functionGraph.ts`
- `frontend/src/utils/functionGraph.ts`
- `frontend/src/components/graph/StepEditor.vue`
- `frontend/src/components/graph/CardEditor.vue`
- `frontend/src/components/graph/CaseFrameCanvas.vue`

**发布状态**：已发布到共享盘（version 1.0.15）

---

## [1.0.14] - 2026-09-22

**版本号**：`1.0.14`（`frontend/package.json` 的 `version`）

**安装包**：`#Excel2Case#V1.0.00 Setup 1.0.14.exe`（156,898,805 字节，SHA256 `92EF2165F96A239BFE624734AB0C4D7800138BBB8A65074CCEC5AB087CB17534`）

**共享盘路径**：`\\172.28.4.125\装机工作软件\工具软件\Excel2Case`

**更新配置**（`version.json`，打包时使用）：
```json
{
  "version": "1.0.14",
  "release_notes": "优化：\n- 检查更新提示：「帮助」菜单也显示蓝点（原来只有「帮助 → 检查更新」有）；启动时如检测到新版本会直接弹出更新提示（含更新说明，可「立即更新」或「稍后再说」）\n\n修复：\n- 解析 CANoe 配置时，使用 CCP 标定协议的工程取不到 A2L 路径（此前只读 XCPSetup，现补充 CCPSetup）。症状是解析不报错，但对象浏览器里没有 A2L 对象\n- CAN「无效值」单元格里写错的内容（如把 0xF 敲成 0xZZ、区间忘写方括号）此前会被静默解析成错误检查值或不生成检查；现在会中止生成并逐条弹窗列出问题，改完再生成\n- DTC 配置里 RxMessageDATA_array 的 DATA 多算字节：Motorola 格式信号会凭空多占一个末尾字节，并让 Lack 误判",
  "setup_name": "#Excel2Case#V1.0.00 Setup 1.0.14.exe"
}
```

**说明**：本版本汇总 1.0.13 之后的 4 条会话更新记录（见下）：CFG 解析（纯后端）、更新提示（Electron 主进程）、无效值非法输入阻断（前端 + 后端）、信号占用字节修正（纯后端）。

---

### [1.0.14] - 2026-09-22

**会话主题**：CFG 解析补上 CCPSetup，修复 CCP 工程取不到 A2L 路径

**问题**：
`LRA62(SA7E).cfg` 解析不出 A2L 对象，而 `LRA47D(SC3E VAVE).cfg` 正常。

排查方式：走 CANoe COM 逐层探测两个 cfg 的真实对象（不是文本解析），结果完全对称：

| 探测项 | A47D | LRA62 |
|---|---|---|
| `GeneralSetup.XCPSetup.ECUs.Count` | **1** → `ECUAPP_A47D_3758.a2l`（`Protocol=1`） | 0 |
| `GeneralSetup.CCPSetup.ECUs.Count` | 0 | **1** → `ECUAPP_A47B_3672.a2l`（`Protocol=0`） |
| `SimulationSetup.Nodes` 里挂 .a2l 的节点 | 0 / 40 | 0 / 43 |
| `Configuration.ECUs` | `AttributeError: <unknown>.ECUs` | 同左 |

**根因**：A2L 在 CANoe 里挂在「标定协议的 ECU」上，而 CANoe 按协议分了两套 setup —— XCP 工程挂在 `GeneralSetup.XCPSetup`、CCP 工程挂在 `GeneralSetup.CCPSetup`。`_try_get_from_xcp` 只读 `XCPSetup`，所以 CCP 工程（LRA62）永远取不到 A2L。

三条兜底路径也全部失效：
- `_try_get_from_ecus` → 依赖的 `config.ECUs` 在当前 CANoe 版本下**不存在**（`AttributeError: <unknown>.ECUs`），该兜底实际是死代码；
- `_try_get_from_simulation_setup` → 40 / 43 个仿真节点逐个查过 `Databases`，**没有一个挂 A2L**（A2L 挂在 XCP/CCP Setup 上，不在节点上）；
- `_fallback_parse_from_cfg_content`（正则抓文本）→ 这两个 cfg 都是 **CANoe 二进制格式**（文件头 `%TSD-Header-###%`，不是 XML）。按字节扫描：LRA62 里 `a2l` 出现 **0 次**；A47D 里唯一 1 次还是乱码串，不是路径。

**变更内容**（`backend/utils/canoe_cfg_parser.py`）：
- 新增 `_CALIBRATION_SETUPS = ("XCPSetup", "CCPSetup")`；`_try_get_from_xcp` 改为按此顺序依次尝试，**XCP 优先**。
- 之所以能直接套用同一套读取逻辑：实测两个 setup 的 `ECUs(n)` 对象模型**完全一致**（都有 `Name` 作 qualifier、`Database` 为 A2L 绝对路径），所以是「同一个东西查两遍」，不是两套适配代码。
- XCP 工程行为一字未变（XCP 在前，命中即 return）。

**验证**（真实 cfg，走 COM 实跑）：
| cfg | `a2l_qualifier` | `a2l_path` | 文件 |
|---|---|---|---|
| A47D（XCP） | `ECUAPP_A47D_3758` | `...\ECUAPP_A47D_3758.a2l` | 441,048 字节 |
| LRA62（CCP） | `ECUAPP_A47B_3672` | `...\ECUAPP_A47B_3672.a2l` | 437,250 字节 |

- LRA62 此前 `a2l_qualifier` / `a2l_path` 均为空串，现取到真实存在的 .a2l 文件；
- A47D 返回与改动前**逐字段一致**（`error` 仍为空、`databases` 仍是 `['LRA47D']`、`cdd_qualifier` 仍是 `ABS_ESP`）；
- `py_compile` 通过。

**遗留（本次未处理）**：
- `_try_get_from_ecus` 依赖的 `config.ECUs` 在当前 CANoe 版本下不存在，该兜底是死代码；
- 两种 setup 都是 0 个 ECU 的工程，仍会**静默**返回空 `a2l_path` —— 解析结果 `error` 为空（因为找到了 CDD qualifier 与 DBC，`has_any_db` 判定为真），前端 `if (data.a2l_path && canMotorMode === 'brushless') loadA2lFromPath(...)` 判断为假后什么都不做，用户全程看不到任何提示。建议后续在无刷模式下补一条明确提示（必要时可加「扫描 cfg 同目录 .a2l」的兜底，但同目录有多个 .a2l 时不应乱猜）。

**相关文件**：
- `backend/utils/canoe_cfg_parser.py`

**发布状态**：已发布到共享盘（version 1.0.14）

---

### [1.0.14] - 2026-09-22

**会话主题**：更新提示 —— 「帮助」菜单同步显示蓝点 + 启动时弹出更新提示

**问题**：
1. 有可用更新时只有「帮助 → 检查更新」子项带蓝色圆点，「帮助」顶级菜单没有任何提示 —— 不展开菜单就看不出有新版本。
2. 更新检测只在后台静默跑（启动后 3 秒 + 每半小时一次），结果只反映到菜单圆点上：不主动点「检查更新」就永远看不到更新说明，也不会被提示升级。

**变更内容**（`frontend/electron/main.js`）：
- 「帮助」顶级菜单新增 `icon: blueDot`，与「检查更新」子项**共用同一个** `blueDot`（`updateAvailable` 为真时才创建），两处同时提示。
- 抽出公共弹窗 `promptUpdateAvailable(newest, currentStr)` —— 即原「发现新版本 / 立即更新 / 稍后再说」对话框（含 release_notes）；手动「检查更新」改调它，行为不变。
- `checkForUpdatesSilently(prompt = false)` 新增参数：`prompt` 为真且检测到新版本时弹该提示框；默认 false 仍只刷菜单圆点。
- 启动首次检测从「窗口创建后固定延迟 3 秒」改为「主窗口 `did-finish-load`（启动页关闭）后再延迟 1 秒」，并用 `startupUpdateChecked` 保证只提示一次。**挪到启动页关闭之后的原因**：启动页是 `alwaysOnTop: true`，先弹会被它挡住。
- 每半小时的轮询仍是静默检测（只更新菜单圆点），不重复打扰。

**验证**：
- `node --check frontend/electron/main.js` 通过（exit 0）。
- 逻辑走查：启动 → 启动页关闭 → 1 秒后检测 → 有新版本弹窗（当前版本 / 最新版本 / 更新说明 + 「立即更新」「稍后再说」）；「立即更新」走原有 `startSelfUpdate`（下载进度窗 → 备份用户数据 → 启动安装包）；「稍后再说」本次不再提示、菜单蓝点保留。
- 共享目录不可访问时仍保持静默（不弹错误框），与改动前一致。

**说明**：
- 原生 Windows 菜单的图标只能画在文字左侧的固定图标槽，位置不可调，也不支持改字体颜色或动画 —— 「蓝 → 荧光蓝呼吸灯」在原生菜单下无法实现，本次只做到「两处都显示蓝点」。要精确控制位置 / 颜色 / 动画，只能把顶部菜单改成 HTML 自绘。
- Electron 主进程代码，需重启 Electron 或重新打包才生效。

**相关文件**：
- `frontend/electron/main.js`

**发布状态**：已发布到共享盘（version 1.0.14）

---

### [1.0.14] - 2026-09-22

**会话主题**：CAN「无效值」单元格非法输入改为阻断生成 + 弹窗提示

**问题**：
`_parse_invalid_ranges` 原来用 `re.findall` 从片段里「捞」数字，捞不出就静默丢弃 —— 但**只捞出一部分更危险**：

| 单元格原文 | 旧行为 | 后果 |
|---|---|---|
| `0xZZ`（`0xF` 敲成 `0xG`） | 正则退回十进制分支只吃到 `0` → `(0,0)` | 静默生成 `ChkStart_MsgSignalValueInvalid(sig,0,0)`，CAPL 看起来完全合法 |
| `3-5`（区间忘写方括号） | 捞出 `['3','-5']` → `(3,-5)` | 生成**倒置区间**（下界 > 上界） |
| `abc` / `N/A` | 无数字 → 整段丢弃 | 该信号**根本不生成检查**，用户以为测过了 |

三种情况都不报错，用户全程看不到任何提示。

**变更内容**：
- **解析层**（`backend/processors/excel_processor.py`）：
  - 新增整段匹配正则 `_INVALID_TOKEN_RE` —— 合法片段只有两种形态：裸值 `<num>`，或 `[<num>,<num>]`（`_INVALID_NUM_PAT` 从 `_INVALID_NUM_RE` 里提出来复用）。
  - `_parse_invalid_ranges` 返回值由 `list` 改为 **`(ranges, invalid)` 二元组**：整段不匹配的片段不再「捞一半」，原样进 `invalid`，并按「**拼错**」（含数字或 `0x` 前缀）与「**纯文本**」（连数字都没有）分类。
  - 空片段（空单元格、末尾多余逗号）仍不算错，直接跳过。
  - `__init__` 新增 `self.invalid_value_entries`，由 `process_Other` 填充（信号名为空的行不参与生成，其无效值也不报错 —— 多半是没填完的占位行）。
- **生成层**（`backend/core/can_module.py`）：`process_Other()` 之后检查 `processor.invalid_value_entries`，非空则**直接中止**，不再执行 `process_Data_link_layer` / `process_testcase`，把清单随返回值带回。
- **路由层**（`backend/api/can_routes.py`）：`generate()` 收到 `invalid_values` 时用 **HTTP 200 + `data.blocked = true`** 返回（而非错误响应）—— HTTP 层没有出错，这是用户输入问题；用 200 绕开全局 axios 拦截器的通用 toast，让前端渲染带清单的弹窗。
- **前端**（`frontend/src/views/CANView.vue`）：新增 `escapeHtml` + `showInvalidValueDialog`，用 `ElMessageBox.alert` 逐条列出「`信号` 的无效值里 `原文` 无法解析（拼错 / 纯文本）」，并附写法提示（单点直接写数值、区间写 `[下限,上限]`、十六进制写 `0x1F`）；`onGenerate` 命中 `blocked` 时弹窗并 `return`，不再走结果面板。

**验证**：
- 直接调用**真实模块**（非脚本副本）跑 17 项解析用例，全过：
  - 正常：`1,[0x3,0xF]` → `[(1,1),(3,15)]`；`0x10` → `(16,16)`；`[0x0,0xFFFF]` → `(0,65535)`；`-3` / `1.5` / `1,2,3` / `1,` / 空 / `None` 均符合预期；
  - 非法：`0xZZ` / `0x` / `3-5` / `1.2.3` / `[3,5` → 拼错；`abc` / `N/A` → 纯文本；
  - 混合：`1,[0x3,0xF],abc` → 合法项保留 `[(1,1),(3,15)]` + `abc` 报纯文本。
- 旧 bug 回归断言：`0xZZ` 的 `ranges` 必须为空（不能再静默变成 `(0,0)`）。
- `py_compile`（3 个后端文件）、`vue-tsc --noEmit`、`vite build` 均通过（exit 0）。

**说明**：
- 校验**以「整段不合法」为唯一触发条件**，只要有一个片段解析不出就**整单阻断**，不做部分生成 —— 避免用户以为全测了。
- 前端 `parseInvalidValueList`（DBC 自动填充用）只认 JSON 数组，与后端的「`(下界, 上界)` 区间」语义**不是一套**，因此校验权放在后端，前端只负责展示。

**遗留（本次未改）**：
- `0xFFFFFFFFFFFFFFFF` 这类超过 2^53 的整数会被 float 尾数舍入（实测 `18446744073709551615` → `18446744073709551616`）。大位宽十六进制无效值仍有精度风险，需要时可改为整数通道处理。
- 触发条件是「解析不出来」，**语义错误仍拦不住**：`1,5` 现在被当成两个单点（这是 1.0.13 起的新语义），如果用户本意是区间，只能靠弹窗里的写法提示自行纠正。

**相关文件**：
- `backend/processors/excel_processor.py`
- `backend/core/can_module.py`
- `backend/api/can_routes.py`
- `frontend/src/views/CANView.vue`

**发布状态**：已发布到共享盘（version 1.0.14）

---

### [1.0.14] - 2026-09-22

**会话主题**：修正信号占用字节（occupybyte），RxMessageDATA_array 的 DATA 不再多算一位

**问题**：
生成的 `DTC_Configuration.cin` 里，报文 0x288 的 `DATA` 多出一个末尾字节：

```
{Id=0x288,FDF=CANFDframe,num=8,DATA={0, 1, 2, 3, 4, 5, 6, 7,8},Lack=true}
                                                    ↑ 多出第 8 字节
```

**根因**：`occupybyte` 用 `set(range(start_byte, (start_bit + length - 1) // 8 + 1))` 估算占用字节，但 `起始位 Start_Bit` 是 **DBC 绝对起始位** —— Intel 是信号的 LSB、**Motorola 是信号的 MSB**。Motorola 的起始位在信号最高位，`start_bit + length - 1` 会往后多算一截：

| 排列格式 | 起字节 / 起位 / 位长 | 旧公式 | 真实占用 | 差异 |
|---|---|---|---|---|
| Intel Lsb | 7 / 56 / 8 | `[7]` | `[7]` | 一致 |
| Intel Lsb | 1 / 8 / 16 | `[1, 2]` | `[1, 2]` | 一致 |
| **Motorola Msb** | **7 / 63 / 8** | **`[7, 8]`** | **`[7]`** | **多出 8** |
| Motorola Msb | 6 / 55 / 16 | `[6, 7, 8]` | `[6, 7]` | 多出 8 |
| Motorola Msb | 1 / 15 / 16 | `[1, 2, 3]` | `[1, 2]` | 多出 3 |
| Motorola Msb | 0 / 7 / 8 | `[0, 1]` | `[0]` | 多出 1 |

0x288 的 `DATA` 就是 Intel 信号铺满 0-7 之后，被一个落在末字节的 Motorola 信号多带出来的第 8 字节；同时 `Lack` 判定 `byte >= _get_msg_Length(msg_dlc - 1)` 被这个多余字节命中，一起变成 `true`。

**变更内容**（`backend/processors/excel_processor.py`）：
- 新增 `_occupied_bytes(signal_info)`：把占用字节交给文件里**已有的** `calculate_byte_order(start_bit, length, byte_order)['byte_range']` 计算 —— 该函数本来就按四种排列格式（Motorola Msb / Motorola Lsb / Intel Msb / Intel Lsb）推导信号占用的全部物理位再折算字节，CRC 用例的 `byte_range` 一直在用它，这里是复用同一套规则，不是新写一套。
- 两处 `occupybyte` 计算改为调用它：`process_dbc_canmatrix` 的前端字典路径（原 L2349-2352）与 `_process_signal` 的 Excel 路径（原 L3408），原来那行 `end_byte` 局部变量一并去掉。
- 排列格式缺失或无法识别（`calculate_byte_order` 抛 `ValueError`）时，退回原来的 Intel（起始位 = LSB）估算，至少不丢字节。

**验证**：
- 10 项用例全过（直接调用真实方法）：3 项 Intel Lsb 与改动前**逐字节一致**（无行为变化）；4 项 Motorola Msb 回归（63/8 → `[7]`、55/16 → `[6,7]`、15/16 → `[1,2]`、7/8 → `[0]`、7/16 → `[0,1]`）；2 项排列格式缺失（`''` / `'Intel'`）走兜底正确。
- 8 字节报文场景（Intel 信号铺满 + 1 个 Motorola 末字节信号）：`occupybyte = [0..7]`、`num = 8`，第 8 字节不再出现。
- `py_compile` 通过。

**遗留（本次未改）**：
- 同一段里的 `Lack` 判定用的是 `_get_msg_Length(msg_dlc - 1)`。`msg_dlc` 是 **DLC 编码**而非字节数，字节数 ≤ 8 时 `msg_dlc - 1` 恰好等于 `字节数 - 1`，所以经典 CAN 正确；但 CANFD 报文会算小 —— 12 字节报文（code 9）算成 8 而不是 11，64 字节（code 15）算成 48 而不是 63，`Lack` 因此偏真，非预期 DLC 用例会被跳过。正确写法应为 `_get_msg_Length(msg_dlc) - 1`。
- `calculate_byte_order` 是**大小写敏感的精确匹配**（只认 `'Motorola Msb'` / `'Intel Lsb'` 这类完整写法）。当前 Excel 由本工具生成，排列格式固定为 `'Intel Lsb'` / `'Motorola Msb'`，与 CRC 路径的用法一致，所以没问题；若手工改成 `'Motorola'`、小写等写法会落到兜底分支。

**相关文件**：
- `backend/processors/excel_processor.py`

**发布状态**：已发布到共享盘（version 1.0.14）

---

## [1.0.13] - 2026-09-22

**版本号**：`1.0.13`（`frontend/package.json` 的 `version`）

**安装包**：`#Excel2Case#V1.0.00 Setup 1.0.13.exe`（156,890,851 字节，SHA256 `ACC89912442BE6C6E7B2CA164E8A570479C94B8735B973FB3CE163CCF71FB80F`）

**共享盘路径**：`\\172.28.4.125\装机工作软件\工具软件\Excel2Case`

**更新配置**（`version.json`，打包时使用）：
```json
{
  "version": "1.0.13",
  "release_notes": "优化：\n- Function 画布：同工况同序号的连线与序号徽标一起高亮；序号徽标改为「单击选中 / 双击编辑」；新增撤销/重做按钮；删除工况、泳道、分组加二次确认并可撤销\n- 画布性能：大工况下操作明显变流畅（序列化次数 202 → 3 次）\n- 页面密度收紧：内容区高度 342 → 524px，工具条不再折行\n- 配色收敛：全站统一为单一主色（工业蓝），工具栏去掉彩虹按钮，只保留一个主操作\n- 对象浏览器：空数据时默认收起，同一个按钮可展开也可收起；Function / UDS / Boot 的对象面板宽度可拖拽\n- 用例分组 / 代码预览的分栏宽度可拖拽；Function 上传入口支持 .a2l\n- 所有确认弹窗支持回车确认\n- CAN：无效值支持「逗号分隔每项各生成一个测试对象」（如 1,[3,5],6 生成 3 条检查），新增「通信电压低压/高压恢复后的信号检查」用例，有刷模式新增不带 XCP 的诊断电压用例",
  "setup_name": "#Excel2Case#V1.0.00 Setup 1.0.13.exe"
}
```

**说明**：本版本汇总 1.0.12 之后的 2 条会话更新记录（见下）。前端 + 后端均有改动。

---

### [1.0.13] - 2026-09-22

**会话主题**：Function 画布交互修复 / 全站视觉与密度优化 / 后端 CAN 模板

**问题**：
- 画布在 8 工况（67 条连线 / 61 张卡片 / scrollHeight 5904px）时操作卡顿；删除工况、泳道、分组都没有二次确认，画布的撤销能力也没有可见入口。
- 视觉上两套蓝并存（主题声明 `#1890ff` 只用 2 次，Element Plus 默认 `#409eff` 用了 107 次），工具栏 7 个按钮 4 种饱和填充色；圆角 19 档、字号 20 档、字面色值 610 处。
- 页面留白过多：`--header-height: 56px` 是历史遗留（本应用只有 40px 的 tab 栏，没有顶栏），6 个模块的 `calc(100vh - ...)` 全部多减 56px。

**变更内容**：

**1. Function 画布交互**
- **同工况同序号的连线高亮时，序号徽标一起高亮**：徽标与连线复用同一个判定函数 `isEdgeHighlighted(p, frameId)`（先按工况比对、再按序号交集命中），未编号连线只高亮自身。
- **性能**：`emitChange` 只序列化一次（原来 stringify 跑两遍）；`scheduleRecompute` 同 tick 合并；frames watcher 加 `toRaw` 引用快路径（`props.graph` 是响应式代理，原来的 `v === lastEmittedGraph` 永不成立，守卫实际失效）；`caseRows` → `frameCaseRowsMap` computed 记忆化。实测 `JSON.stringify` **202 次 / 79.8ms → 3 次 / 25.6ms**，microtask **104.7ms → 31.6–47.2ms**。
- **安全网**：画布工具栏新增「↶ 撤销 / ↷ 重做」按钮（disabled 直接反映栈深，复用已有 60 层快照栈）；删除工况/泳道前弹确认框，写明将连带删除的泳道、卡片、连线数量；连线删除后提示「Ctrl+Z 可撤销」。弹窗期间画布可能被改动，确认后按 id 重新定位再删。
- **序号徽标手势**：`@mousedown` 改为 `@click` 选中 + `@dblclick` 编辑。原来单击即进编辑框，想「只选中这条线」会误触。
- **画布提示收纳**：工具栏上 200+ 字的操作说明收进 `?` 弹层，按「结构 / 选中 / 排列 / 复制 / 连线 / 编辑 / 撤销 / 横看」分 8 行。

**2. Function 分组**
- 删除分组加确认（列出分组名、工况数、用例数，以及连带删除的卡片库/映射表/值资源库）；删除后提示里带「撤销」按钮，恢复原位置与原来的活动分组。分组删除不经过画布的撤销栈（那个栈只管组内 frames），所以单独做了一次性回退。

**3. 全局交互**
- **回车 = 确认**：Element Plus 的 MessageBox 默认不响应回车，新增全局处理器覆盖全部 19 处 `confirm/alert/prompt`；焦点在 `TEXTAREA` 或已落在弹窗按钮上时不抢。不走快捷键注册表——派发器会跳过输入框内的按键，而 `prompt` 的焦点恰好就在输入框里。
- **对象浏览器空数据时默认折叠**：`ObjectPanel` 新增 `expand` 事件，无对象可展示 → `collapse`，从无到有 → `expand`。Function / UDS / Boot 的对象浏览器原来只有一个单向的「展开」竖条（展开后竖条消失，只剩标题栏里一个不起眼的小图标），改为**同一条竖条双向切换**，并补 `aria-label` / `aria-expanded`，从 `<div>` 换成真 `<button>` 使其进入无障碍树。
- **拖拽条锚点修正**：`ResizableSplitter` 的横向拖拽条写死 `right: -3px`，靠宿主容器 `position: relative` 定位；原来的用法都是当兄弟节点放在没有定位的 flex 容器里，实测全局侧栏的拖拽条被锚到**视口右缘 x=1328** 而不是侧栏右缘 280。新增 `side="start" | "end"` 参数，并把面板包进 `position: relative` 的 wrapper。
- **侧栏拉宽后拉不回来**：`useResizableSize` 的参数顺序是 `(key, 默认值, 最小值, 最大值)`，全局侧栏写成 `('global-sidebar', 280, 400, 600)` —— **最小值 400 比默认值 280 还大**，`setSize` 把宽度夹在 `[400, 600]`，一旦拖动就回不去。改为 `(280, 240, 600)`。其余 7 处调用核对无误。
- **对象面板可拖宽**：Function / UDS / Boot 的 `.xxx-side` 原来是写死的 `width: 340px`（CAN / 三包 / 全局侧栏却都能拖），统一接上 `useResizableSize('xxx-side', 340, 240, 720)`。
- **用例分组 / 代码预览分栏可拖**：原来是写死的 `grid-template-columns: 380px 1fr`，改为 flex + `ResizableSplitter`，范围 240–720，默认 380，记忆到 localStorage。
- **CAN 页面提示收纳**：表头下那整行 `.signal-drag-hint` 收进 `?` 弹层，按当前视图（表格 6 条 / 树形图 2 条）分组；顺带修 `.other-card-help:hover` 的变量名笔误（`var(--primary-color)` → `var(--color-primary)`，该变量不存在，4 个字段说明图标的 hover 变色一直是失效的）。
- **Function 内嵌上传支持 .a2l**：`accept` 补 `.a2l`，`onDbcFileChange` 补 a2l 分支（与侧栏上传入口行为一致）。

**4. 配色与密度**
- **主色单一来源**：`main.scss` 把 `--color-primary` 变成 `--el-color-primary` 的别名，并整套覆盖 Element Plus 主色阶为工业蓝 `#1890ff`（含暗色 6 档）。**104 处 `#409eff` + 7 处 `#5b8def` → `var(--el-color-primary)`**（22 个文件，精确字面量替换，跳过带引号的 JS 字符串）；8 处 SVG 呈现属性 / JS 常量（`var()` 在那里不生效）统一为 `#1890ff`。
- **工具栏去彩虹**：原来 7 个按钮 4 种饱和填充（白 / `#1890ff` / `#f56c6c` / `#67c23a` / `#e6a23c`），而 `#e6a23c` 同时又是「⚠ N 处待修正」警告色和选中连线高亮色、`#67c23a` 同时是「展开 N 条用例」徽标色 —— 颜色语义三重叠。改为按「刷新 / 配置增删 / 产出」拆三段加分隔线，**只有主动作「生成」是实心**，删除改 `plain`，保存/新建去掉彩色填充；每行的「图形配置」也从实心改描边。
- **密度收紧**：`--header-height` 由 `56px` 归零（本应用没有独立顶栏，只有 40px tab 栏，6 处 `calc(100vh - var(--header-height) - var(--tab-height) - N)` 全都凭空少掉 56px 内容高度）；`--tab-height` 44→40；建立密度变量 `--gap-block / --gap-inline / --pad-card / --pad-bar`；`.el-form-item` 行距 18→12；配置下拉 240→190、工具条按钮左右内边距 15→10（让 7 个按钮挤进一行，原来折行多占 52px）。
  - 实测（Function 页，视口 883px）：tab 栏 44→40，配置工具条 **100→48**（不再折行），配置参数卡片 182→152，**内容区（用例预览）342→524（+53%）**，底部动作条 56→48，页面底部原来空着的 66px 已铺满。
  - 逐个复查 5 个模块：UDS / CreateCANoe / 三包正好铺满无滚动；CAN 与 Boot 仍有少量溢出（改前更严重，`--header-height` 归零后可用高度 +56px，溢出只会减少）。

**5. CAN 后端模板与无效值解析**
- **`testcase_AllTxAig_BusOff` 对齐 `AllTxAig_IGON`**：补 `sigValue[{len}][32]`（`{valuelist}`）与通过/失败消息里的区间；补 `ChkQuery_EventSignalValue(checkId[i], badValue)`（原来失败消息打印的 `badValue[0]` 是**未初始化内存**，因为从没调用过取值函数）；`ChkQuery_EventMessageId` → `ChkQuery_NumEvents`（与 IGON 及文件里其它信号值检查一致）。BusOff 自己的初始化序列（`Init(); BusOff_ON(); wait(1000); BusOff_OFF();`）原样保留。
- **顺带修了一个真 bug**：`testcase_AllTxAig_IGON` 模板里有 `{valuelist}` 占位符，但 `_add_testcase_AllTxAig_IGON` 只传了 `len/siglist/sig` —— `.format()` 会直接 `KeyError: 'valuelist'`，这个用例原本根本生成不出来。现补上 `valuelist` 参数。
- **无效值单元格解析**：逗号分隔的每一项各生成一个测试对象，方括号表示区间、裸值表示单点：
  - `1,[3,5],6` → `(1,1)` / `(3,5)` / `(6,6)`，`sigName` 与 `sigValue` 各 3 个元素，索引与 `checkId` 对齐
  - 新增 `_parse_invalid_ranges` / `_range_label` / `_fmt_num` / `_invalid_num_or_none`：顶层按逗号切分且方括号内逗号不当分隔符，支持负数、小数、`0x` 十六进制，解析不出数字的片段跳过
  - ⚠️ **语义变化**：裸的 `1,5` 不再当区间（原来 `ChkStart_MsgSignalValueInvalid(sig,1.0,5.0)`），现在拆成两个单点检查 `(1,1)` 和 `(5,5)`；区间必须写 `[1,5]`。**既有 Excel 配置里用裸 `a,b` 写区间的需要改成 `[a,b]`**。
- **新增 `AllTxAig_CommVoltRecovery` 用例**：通信电压低压恢复后、高压恢复后各跑一遍信号范围检查（与 `AllTxAig_IGON` 共用同一份信号清单与 `checkId[]` 结构，两段之间 `TestRemoveCondition` 清理后复用数组，结尾 `VoltSet(12)` 归位）。电压序列照 `testcase_CommunicationVoltage_Time`（`Init()` + `xcpSetPollingCycle` + `xcpActivate` + `SignalWaitCheck`），没有用自带 `CheckTx` 判定的 `CommunicationVoltage_Fall/Rise` helper。生成门槛为「通信电压」勾选 + `underVolt / overVolt / Lhysteresis_v / Hhysteresis_v` 齐全，归到 `Volt / Communication Voltage` 分组。
- **有刷模式诊断电压模板**：新增 `DiagVoltage_Rise_NoXcp` / `DiagVoltage_Fall_NoXcp`（`test_function.py`）。有刷模式没有 A2L/XCP，而原版形参 `sysvarFloat *Var` 与内部调用的 `Battery_Voltage_GreaterSet/lessSet`（用 `getxcp(Var)` 做电压闭环逼近）都依赖 XCP，因此：去掉 `Var` 形参；`Battery_Voltage_*Set` 与 `testWaitForSysVar` 全部注释屏蔽（电压保持 `VoltSet(12)` 不动）；其余 FIU / testStep / 时序逻辑逐行保留。`DiagVoltage_Fall` 里 `testWaitForSysVar` 被 `if(Time)` 单独包着，只注释调用会留下没有函数体的 `if`，所以那行也一并注释。`excel_processor` 在 `motor_mode == 'brushed'` 时改用这两个函数，**testcase 名保持 `DiagVoltage_Fall` / `DiagVoltage_Rise` 不变**，两种模式在 TestModule XML / 报告里对得上号。

**验证**：
- 前端 `vue-tsc --noEmit` + `vite build` 每轮改动后均通过（exit 0）。
- 后端 `py_compile` 通过；无效值解析、模板渲染、有刷/无刷两条生成路径均写了临时脚本实跑（`1,[3,5],6` → 3 个 `checkId`；有刷版与原版逐行比对，差异 100% 是 XCP 相关行）。
- 交互改动在本地 18750 用真实配置（A47D，2 分组 20+120 条用例）实跑：对象浏览器双向收放、回车确认、分组删除+撤销、侧栏拖拽条位置、密度前后尺寸对比、CAN `?` 弹层内容。

**相关文件**：
- 前端：`frontend/src/components/graph/CaseFrameCanvas.vue`、`frontend/src/components/graph/FunctionGraphEditor.vue`、`frontend/src/components/ResizableSplitter.vue`、`frontend/src/components/ConfigToolbar.vue`、`frontend/src/components/GlobalSidebar.vue`、`frontend/src/components/ObjectPanel.vue`、`frontend/src/composables/useShortcuts.ts`、`frontend/src/main.ts`、`frontend/src/App.vue`、`frontend/src/styles/main.scss`、`frontend/src/views/FunctionView.vue`、`frontend/src/views/UDSView.vue`、`frontend/src/views/BootView.vue`、`frontend/src/views/CANView.vue`、`frontend/src/components/graph/StepEditor.vue` 等 22 个文件（字面色值收敛）
- 后端：`backend/templates/capl.py`、`backend/templates/test_function.py`、`backend/processors/excel_processor.py`

**发布状态**：已发布到共享盘（version 1.0.13）

---

## [1.0.12] - 2026-09-21

**版本号**：`1.0.12`（`frontend/package.json` 的 `version`）

**安装包**：`#Excel2Case#V1.0.00 Setup 1.0.12.exe`（156,816,430 字节，SHA256 `0A3F20E120DEA4E38C22ED2653ABD448142D1732C1AEB471A9DC585D9B76AD56`）

**共享盘路径**：`\\172.28.4.125\装机工作软件\工具软件\Excel2Case`

**更新配置**（`version.json`）：
```json
{
  "version": "1.0.12",
  "release_notes": "新增：\n- Function 分组支持跨配置 / 跨文件复制：分组右键菜单新增「复制 / 推送到其它配置…」「导出 / 导入分组文件…」，把工况框、卡片库、映射表、值资源库、用例、命名整组一起搬（组内引用天然自洽，只重生成分组 id）\n- 支持拉取（其它配置 → 当前配置，改完点「保存」落盘）与推送（当前配置 → 其它配置，立即整份写回目标配置）\n- 支持把分组导出为 .json 文件、从文件导入（校验文件格式；组名重名自动加「_来自<来源>」后缀去重，不弹窗阻断）",
  "setup_name": "#Excel2Case#V1.0.00 Setup 1.0.12.exe"
}
```

**说明**：本版本汇总 1.0.11 之后的 1 条会话更新记录（见下）；纯前端实现，后端零改动。本轮打包 `release_v2\win-unpacked\resources\app.asar` 未被占用，`python build.py` 一次跑通（exit 0）。

---

### [1.0.12] - 2026-09-21

**会话主题**：Function 跨配置 / 跨文件复制分组（工况框 + 卡片库 + 映射表 + 值资源库 整组搬）

**问题**：
分组（`CaseGroup`）自 1.0.6 起就是「一份独立图形配置」的自洽单元，但没有任何跨配置搬动的入口 —— 想把 A47D 的 `ADS_Ang` 复用到 `A47D_copy`、或把调好的分组发给同事，只能手工重建卡片库 / 映射表 / 值资源库。

**方案**：**整组复制**（不是只搬工况框）。`CaseGroup` 自带 `frames / cards / mapping / valueLibrary / cases / naming`，组内引用天然自洽 —— `lane.nodeIds` / `edge.from|to` 指向组内节点，`Card.refId` 按本分组的 `cards` 解析 —— 因此**只重生成 `group.id`**，组内 frame / lane / node / edge / card 的 id 原样保留（重生成反而要连带重写这些引用，风险高、收益零）。纯前端实现，**后端零改动**。

**变更内容**（`frontend/src/views/FunctionView.vue`）：
- 预览页分组右键菜单新增两项：**「复制 / 推送到其它配置…」**、**「导出 / 导入分组文件…」**；右击哪个分组就预勾选哪个。
- 新增「分组复制 / 推送 / 导出导入」段：`cardCountOf` / `uniqueGroupName` / `makeGroupCopy` / `appendGroupsToCurrent` + 拉取 / 推送 / 导出 / 导入四个处理器。
  - **组名去重**：重名 → `<原名>_来自<来源>`，再冲突 → 追加 `_2`、`_3`…（不弹窗阻断）。
  - **拉取**（其它配置 → 当前配置）：只改内存，需点「保存」落盘；源配置的分组经 `normalizeGraph` 归一化（兼容无 `groups` 的旧结构）。
  - **推送**（当前配置 → 其它配置）：读目标配置 → 追加分组 → **整份写回**；只替换 `graph`，其余字段原样带回。两处关键细节：① 目标配置的分组数组**直接用 `[...srcGraph.groups]` 追加、不经 `normalizeGraph`**，否则配置级兜底内容会被写进分组、既有分组字段顺序也会被改动；② **`delete data.name`** —— `GET /api/<module>/configs/<name>` 会补一个 `name` 字段（`config_routes.get_config` 注释明确警告不能写回），不删就会被写进本地文件。
  - **导出 / 导入文件**：纯前端 `Blob` + `<a download>`（Electron `preload.cjs` 只暴露 `selectFile / selectFolder / saveDialog / openPath`，**没有写文件能力**）。文件结构 `{ type: 'autotool-function-groups', version: 1, exported_at, source_config, groups }`；导入校验 `type` 与 `groups`，`version` 高于当前支持版本给 warning 但仍尝试导入；来源标签取 `source_config`，缺省回落文件名。
- 新增弹窗样式段 `.grp-form / .grp-row / .grp-label / .grp-list / .grp-item / .grp-item-readonly / .grp-name / .grp-meta / .grp-empty / .grp-hint / .grp-file-name`。

**验证**（本地后端 18750 + 真实配置 A47B / A47D / A47D_copy，四条路径全部实跑）：

| 路径 | 结果 |
|---|---|
| 拉取 A47D → A47D_copy | 生成 `ADS_Ang_来自A47D`：6 工况框 / 77 张库卡片 / 33 条用例，与源一致 |
| 推送 A47D_copy → A47B | A47B 分组变为 `['ADS_Tq', 'FUNC_ADS_LDW']`；**未写入 `name` key**；`ADS_Tq` 分组、`graph.frames/nodes/edges`、其余全部字段与其它 6 个配置**逐字节未变**；新分组 id 已重生成、其余内容与源完全相同（`payload identical (except id/name): True`） |
| 导出为文件 | `type=autotool-function-groups`、`version=1`、`exported_at` ISO、`source_config=A47D_copy`、`groups.length=1`；组内 `frames=1`、`cards(inject/sequence/result)=1/1/1`、`mapping(signals:11, messages:2, envvars:1)`、`valueLibrary=0` |
| 从文件导入 | 组名落为 `FUNC_ADS_TORQUE_来自A47D_copy`、用例数与源一致；非法文件 → 「文件格式不正确：不是本工具导出的「分组文件」」；`version=2` → 「文件版本（2）高于当前支持的版本（1），将尝试导入」 |

- `vue-tsc --noEmit` + `vite build` 通过（exit 0）。

**说明**：
- **推送是本地操作**：走 `POST /api/function/configs/<name>` → `BaseModule.save_config` → `ConfigService.save_configs()`，`auto_upload` 默认 `False`，**只写本地 JSON，不上传共享盘**。要进远程共享盘仍需走工具栏既有的「拉取/推送 → 推送（本地 → 共享盘）」（那是**配置项级**的另一套入口，粒度是整个配置）。
- 排查中发现 `ConfigService` 把整份配置**常驻内存**（`__init__` 时 `load_configs()` 一次，之后 `save_configs()` 把内存写回磁盘）：用脚本直接改磁盘上的 JSON 对运行中的服务不生效，且任何保存都会把旧内存覆盖回去。改配置后需重启后端。
- 推送会立即写入目标配置（不可撤销），确认框里已写明「以该配置当前的磁盘内容为基础追加分组后整体写回」。

**相关文件**：
- `frontend/src/views/FunctionView.vue`

**发布状态**：已发布到共享盘（version 1.0.12）

---

### [1.0.12 补录] - 2026-09-21

**会话主题**：Function 图形配置三项功能（随 1.0.12 一起发布，打包时遗漏记录，此处补录）

**1. 用例名 = case_id 与 TestModule XML title**
- 画布工况头每行用例的序号双击可改用例名，覆盖值按「工况内行序」存进 `CaseFrame.caseNames[]`。
- 生成时 `caseNames[行序]` 非空 → 清洗为合法 CAPL 标识符并去重后作为 `case_id`；为空才回退自动命名（`_make_case_id`）。**有覆盖时不再生成自动 case_id**，否则会把名字「占用」掉，导致后续同名覆盖多出 `_2` 后缀。
- TestModule XML 的 `title = 「用例名(工况名)」`（`build_case_titles`）；Excel 导入的用例没有所属工况，title 只用用例名。
- 一个分组一个 `<testgroup>`，分组下的用例作为其 `<capltestcase>` 子节点。

**2. 斜率请求 / 斜率请求(同步) 按真实 CAPL 形参给参数框**
- 形参以 `func_test_function.py` 的声明为准：
  - `SetSignalRate(signal* Sig, float step, long num)` → 信号 + 步长 + 目标值
  - `SetSignalRamp(signal* Sig, dword CycleTime, float step, float max)` → 信号 + 周期时间 + 步长 + 最大值
- 两种斜率请求的参数框数量/含义据此区分，不再共用一套。

**3. 限时检查（SignalWaitCheck 系列，含 Not 与区间）**
- 新增 `wait_check` 步骤类型，四种判定方式：
  - 等于期望值 → `SignalWaitCheck(sig, 期望值, time)`
  - 不等于期望值 → `SignalWaitCheckNot(sig, 期望值, time)`
  - 在区间内 → `SignalWaitCheck(sig, 下限, 上限, time)`
  - 不在区间内 → `SignalWaitCheckNot(sig, 下限, 上限, time)`
- 区间形式取 `arg.value` 为下限、`arg.value2` 为上限；每个对象参数各生成一行。

**相关文件**：
- `frontend/src/components/graph/CaseFrameCanvas.vue`、`frontend/src/components/graph/StepEditor.vue`
- `backend/services/function_graph.py`、`backend/processors/function_processor.py`、`backend/core/function_module.py`、`backend/templates/func_test_function.py`

**发布状态**：已随 1.0.12 发布到共享盘（记录补于 2026-09-22）

---

## [1.0.11] - 2026-09-21

**版本号**：`1.0.11`（`frontend/package.json` 的 `version`）

**安装包**：`#Excel2Case#V1.0.00 Setup 1.0.11.exe`（156,235,219 字节，SHA256 `59D98B9DD9DBCE2F214F5393DF7DBC45E67E3D1C45C36F0B95B18EABECEFFD9A`）

**共享盘路径**：`\\172.28.4.125\装机工作软件\工具软件\Excel2Case`

**更新配置**（`version.json`）：
```json
{
  "version": "1.0.11",
  "release_notes": "优化：\n- CAN 报文信号表：列宽改为按内容自适应（只看单元格内容，表头过长由 CSS 截断并加悬停提示；下限 56px、上限 480px），手动拖拽的列宽优先并持久化，其余列每次按内容重算\n- CAN 配置导出/导入 Excel：测试参数拆成 8 列明细（测试参数 / 报DTC值 / 不报DTC值 / DTC / 变量名 / 测试值 / 自动遍历 / 类型），一个测试参数一行、各列按行对齐，多参数不再挤在一个单元格里\n\n修复：\n- 修复 CAN 报文信号表修改「发送节点」后，该报文跑到别的位置、它的信号全部消失（信号挂在发送节点下、与报文平级，原来只搬了报文）",
  "setup_name": "#Excel2Case#V1.0.00 Setup 1.0.11.exe"
}
```

**说明**：本版本汇总 1.0.10 之后的 3 条会话更新记录（见下）；打包时 `release_v2\win-unpacked\resources\app.asar` 被占用，第五步 electron-builder 改用 `--config.directories.output=release_out` 输出后再 robocopy 回 `release_v2`（既有变通流程）。

---

### [1.0.11] - 2026-09-21

**会话主题**：CAN 报文信号表 —— 列宽按内容自适应（并定位「拖拽列宽卡顿」根因）

**问题**：
1. 列宽只按列定义里的固定 `minWidth`（110~200）分配，不看内容：`信号名称` 被截断、`报文长度` 这类只有一两个字符的列却占一大片。
2. 拖拽表头右缘调列宽极卡：实测每动一下鼠标 **中位 552ms**（最大 635ms），30 次移动合计 13.7 秒。

**变更内容**：
- `frontend/src/components/DbcSignalTable.vue`：
  - 新增「列宽按内容自适应」段：`contentWidthOf()` / `computeAutoWidths()` / `emitAutoWidths()` + `auto-widths` 事件。规则：**只看单元格内容、表头不参与**，表头比内容长时以内容为准（表头由 CSS 截断，加 `title` 悬停提示）。
  - 文本宽度用 `Range.getBoundingClientRect().width` 量（是**文字本身**的宽度，与单元格当前宽度无关）。关键：若改用 `scrollWidth`，列一旦被撑宽，量出来的就是「当前列宽」而不是内容宽度，列只会越来越宽、收不回去。实测与 canvas `measureText` 完全一致（含报文行的 600 粗体）。
  - 测试参数列按「最宽的一个标签」算（标签本来就会换行），不按整行标签总和；复选框列按 checkbox 宽度。
  - 下限 56px / 上限 480px / 单元格内边距 18px。整列都没有内容时不参与自适应、回落列自带 `minWidth`（否则表头会被压得完全看不见）。
  - `repaint()`（数据/列变化）与 `expandedKeys` 变化后各重算一次。
- `frontend/src/views/CANView.vue`：
  - 新增 `dbcAutoWidth`（**不持久化**，每次重算）与 `userWidthOf()`；`dbcOrderedColumns` 取「手动宽度 ?? 自适应宽度」。
  - 新增 `onDbcAutoWidths()`：值没变就不动 state —— 防止与 `props.columns` 互相触发成死循环。
  - **修掉一个会毁掉自适应的隐患**：`snapshotDbcColumnState()` 与 `moveDbcColumn()` 原来把 `c.width` 写回 state 并持久化；现在 `c.width` 可能是自适应算出来的，一写进去就被当成手动宽度存下来、自适应从此失效。两处都改成只带 `userWidthOf(c.key)`。

**验证**（T1V 配置 254 行 × 15 列，重建后的 dist）：
| 项 | 结果 |
|---|---|
| 打开配置后列宽 | `Test 56 / 发送节点 85 / 报文名称 125 / 报文标识符 59 / 报文周期时间 56 / 报文长度 56 / 信号名称 259 / 精度 59 / 偏移量 61 / 物理最小值 61 / 物理最大值 74 / 初始值 56 / 无效值 60 / 信号值描述 150 / 测试参数 118` |
| 表头截断 | 窄列 `clipped: true`、`text-overflow: ellipsis` 生效、15 个表头都带 `title` |
| 无重算循环 | 空闲 2 秒表头 DOM 变动 **0 次** |
| 数据变化重算 | 搜索筛选到 2 行后信号名称 `259 → 182`（= 最长文本 164.3 + 18），其余按新内容重算 |
| 手动拖拽优先 | 精度 59 → 拖到 159；切走配置再切回仍是 **159**，其它列按内容重算 |
| 持久化干净 | localStorage 里只有 `factor:159`（自适应宽度**没有**被写进去） |
| 列排序后 | 顺序变化、宽度跟着列走；localStorage 仍只有 `factor:159` |
| 拖拽卡顿（本次未修，仅定位） | 每动一下中位 **552ms**（对照：同样拖拽但宽度值不变仅 16.7ms）；LoAF 归因 `styleAndLayoutDuration = 0`，耗时全在 JS —— Element Plus 的列 `width`/`minWidth` 变化会写进响应式 `columnConfig` 并触发整表重渲染（254×15 = 3810 个单元格的 vnode 重建），而实际 DOM 只变了 ~31 处（colgroup + 表头宽度） |
| `vue-tsc --noEmit` + `vite build` | 通过（exit 0） |

**说明**：卡顿的正确修法是「拖拽期间直接改 `<colgroup><col>` 宽度（零重渲染），松手才提交一次」——与文件里既有的「选区/拖拽落点改为非响应式 + 直接操作 DOM」性能约定一致；本次按需求未实施。

**相关文件**：
- `frontend/src/components/DbcSignalTable.vue`
- `frontend/src/views/CANView.vue`

**发布状态**：已发布到共享盘（version 1.0.11）

---

### [1.0.11] - 2026-09-21

**会话主题**：CAN 配置导出/导入 Excel —— 测试参数拆成 8 列明细、多参数换行对齐

**变更内容**：
- `backend/services/can_config_excel.py`：`DBC Canmatrix` 表里原来那列可读的「测试参数」被 **8 列**替换
  （测试参数 / 报DTC值 / 不报DTC值 / DTC / 变量名 / 测试值 / 自动遍历 / 类型），
  字段映射 `dtcValue` / `noDtcValue` / `dtc` / `variable` / `testValues` / `autoRange`（写 `Y`/`N`）/ `invalidType`。
  **一个测试参数一行**：各列按参数逐行对齐（第 1 行 = 第 1 个参数），参数没有该字段时该行留空，每列末尾空行去掉。
  这 8 列整列设自动换行 + 列宽（否则 Excel 里看不出换行）；末尾两列 JSON（报文/信号测试参数）保留，回环不丢数据；
  原「测试参数」列被隐藏时 8 列追加在可见列之后，保证 Excel 里始终有。
- `frontend/src/utils/dbc.ts`：新增 `PARAM_DETAIL_LABELS` / `parseParamColumns()`，按表头中文名精确匹配定位 8 列并按行还原测试参数（JSON 列存在时仍优先用 JSON）；`DbcRecord` 增加 `paramCells`。
  这 8 列从其它字段的关键字匹配里排除（`测试值` 含 "test"、`DTC` 含 "dtc"，不排除会串列）；`findDtcIdx` 回退分支跳过「报DTC值 / 不报DTC值」——它们不是信号级 DTC 列。
- `frontend/src/views/CANView.vue`：报文级/信号级参数在 JSON 列为空时改用这 8 列还原。

**顺带修掉一个坑**：`parseDbcRecords` 里的 `get()` 会 `trim()` 整个单元格，`'\n0, 1'` 被压成 `'0, 1'` —— **行内空行没了、整列错行**（第 2 个参数的报DTC值会跑到第 1 个参数身上）。明细列改用不整串 trim 的 `getRaw()`，只按行 trim。

**验证**（D008 真实配置，用真实上传走 `/api/can/parse`）：
| 项 | 结果 |
|---|---|
| 导出列结构 | 24 列 = 14 个可见列 + 8 个明细列（替换原「测试参数」列位置）+ 末尾 2 列 JSON |
| 导出多参数对齐 | `测试参数 = FactorTest / SigInvalidTest`；`变量名` 只占第 1 行、`自动遍历 = Y` 只占第 1 行；`报DTC值 / 不报DTC值 / DTC / 类型` 只占第 2 行 |
| 导入（把导出文件两列 JSON 清空 → 模拟只填 8 列的手工 Excel） | `VehSpdAvgDrvnV_ABS` → FactorTest(已配) + SigInvalidTest(已配)，两个参数都还原 |
| 导入后取值 | FactorTest：变量名 = `sysvar::XCP::LRD008::…Vil`、自动遍历 = 开（取自**第 1 行**）；SigInvalidTest：报DTC的值 = `1`、DTC = `D40281`、类型 = SigInvalid（取自**第 2 行**）→ 行对齐正确（自动匹配算法产生不出 `variable`/`autoRange`，可确认来自 8 列） |
| 回归：带 JSON 列的回环文件 | 参数与配置完全一致 |
| `vue-tsc --noEmit` + `vite build` | 通过（exit 0） |

**说明**：界面上 SigInvalidTest 的「不报DTC的值」会从 `0, 1` 变成 `0` —— 这是**已有**的去重逻辑（同一个值不能既「报DTC」又「不报DTC」），不是导入丢数据。

**相关文件**：
- `backend/services/can_config_excel.py`
- `frontend/src/utils/dbc.ts`
- `frontend/src/views/CANView.vue`

**发布状态**：已发布到共享盘（version 1.0.11）

---

### [1.0.11] - 2026-09-21

**会话主题**：CAN 报文信号表 —— 修复「修改发送节点后报文位置变化、所属信号丢失」

**问题**：
在报文信号表里改某条报文的「发送节点」后，该报文跑到别的位置、**它的信号全部消失**。

**根因**：DBC 导入的树里信号是挂在**发送节点**下、与报文**平级**的（`buildDbcTreeFromRaw` 里 `senderNode.children.push(signalNode)`），不是报文的孩子。而 `moveMessageToSender()` 只把**报文节点**搬到新发送节点：

```ts
target.children.push(msgNode)   // 只搬了报文
```

信号被留在原发送节点下。表格是按「发送节点 → 报文行 → 该报文的信号行」渲染的（`buildDbcTableRows` 只遍历报文行，信号靠 `msg.msgName` 归属），留在旧发送节点下的信号**没有报文行可挂**，就整个从表格里消失了。

**变更内容**（`frontend/src/views/CANView.vue`）：
- 新增 `isSignalOfMessage()`：按**共享的 msg 对象引用**（或 `msgName` / `msgId`）判断某信号是否属于该报文，两种树布局都覆盖。
- `moveMessageToSender()` 改为把**「报文 + 与它平级的同报文信号」整组搬走**，顺序仍是「报文在前、信号在后」，与导入时的树布局一致；`senders` 同步也覆盖到搬过来的信号。
- 撤销走的是同一个函数（`undoStack` 的 `kind: 'sender'` → `moveMessageToSender(node, before, false)`），自动一起修好。

**验证**（D008 真实配置，把 `ABS_0x17D` 的发送节点从 `ABS_x17D` 改成 `ABS_x17D_NEW`）：
| 项 | 改之前 | 改之后 |
|---|---|---|
| 总行数 | 80 | **80**（没丢行） |
| 报文数 / 信号数 | 13 / 67 | **13 / 67** |
| 发送节点列表 | ABS_x17D, ADAS_x225, ADAS_x375, EPS, EPS_x421, FWGV_x348, HCU_x201, PPEI_x1E9, VOT_x120, VT_x53D | **ABS_x17D_NEW**, 其余不变（旧节点因空了被清掉） |
| `ABS_0x17D` 归属 | ABS_x17D | **ABS_x17D_NEW** |
| `ABS_0x17D` 的信号 | Checksum / Counter / VehSpdAvgDrvnV_ABS / VehSpdAvgDrvn_ABS | **完全一样，4 个都在、顺序不变** |
| Ctrl+Z 撤销 | — | ✓ 发送节点回到 `ABS_x17D`、4 个信号仍在，提示「已撤销：修改发送节点」 |

**说明**：改发送节点本质上是换分组，报文一定会在表格里换位置：目前追加到目标发送节点那组消息的末尾；目标发送节点不存在时新节点追加在表末（报文排到最后）。若需要按报文 ID 排序或插到目标组首位，改一行插入位置即可。

**相关文件**：
- `frontend/src/views/CANView.vue`

**发布状态**：已发布到共享盘（version 1.0.11）

---

## [1.0.10] - 2026-09-21

**版本号**：`1.0.10`（`frontend/package.json` 的 `version`）

**安装包**：`#Excel2Case#V1.0.00 Setup 1.0.10.exe`（156,004,494 字节，SHA256 `70B98B522DB83BE266B1E364BF842BAFE0326B8A88CB0880CA849176926F716E`）

**共享盘路径**：`\\172.28.4.125\装机工作软件\工具软件\Excel2Case`

**更新配置**（`version.json`）：
```json
{
  "version": "1.0.10",
  "release_notes": "优化：\n- Function 用例预览：左栏新增「全部折叠 / 全部展开」（默认全部折叠）；点击用例条目可把右侧代码预览定位到该用例的 testcase 定义行\n- Function 工况画布：宽工况下用 Shift+滚轮横向查看（普通滚轮只上下滚动，横滚到尽头即停），工具栏提示同步更新\n- Function 工况画布：泳道标题改为序号（主序列保留名称，其余按实际位置编号），便于口头定位\n- Function 工况画布：拖拽落点提示改为虚线占位框，不再遮住卡片；点击连线序号徽标会同步高亮对应连线\n- Function 工况画布：序号编辑框改用连线高亮色（橙）+ 光圈，宽度按内容自适应\n- CAN 模块 Excel 导入兼容旧表：新增 Configuration 工作表（Name / Description 两列）解析，自动回填 CDD_Qualifier、A2L_Qualifier、Battery_Voltage、Torque_limit、Ready_On / Ready_Off、Car Mode 等 11 项配置，不必手输\n\n修复：\n- 修复功能模块左侧栏上传 .dbc 报「解析失败」（接口 500）：.dbc 改走 /api/can/parse-dbc 并载入对象浏览器\n- 修复工况画布拖拽时整排泳道整体右移（最多 +180px）导致右侧泳道卡片「按不起来 / 拖不动 / 松手没反应」\n- 修复宽工况下右侧泳道滚不出视野、无法拖动与 Ctrl 拖拽复制\n\n变更：\n- 工况卡片改回按泳道顺序等距排列（取消 1.0.7 引入的卡片自由留白摆放），落点仍按鼠标位置决定插到哪张卡片前 / 后",
  "setup_name": "#Excel2Case#V1.0.00 Setup 1.0.10.exe"
}
```

**说明**：本版本汇总 1.0.9 之后的 6 条会话更新记录（见下）；其中工况画布的滚轮手势与卡片排列以**最后一条记录为准**（宽工况用 Shift+滚轮横滚、卡片按序等距排列）。

### [1.0.10] - 2026-09-21

**会话主题**：修复「功能模块左侧栏上传 .dbc 报解析失败（接口 500）」

**问题**：
左侧栏全局上传入口对「功能模块」的文件类型不做区分：`acceptMap.function` 与提示语都写着支持 `.dbc`，但处理分支只要当前模块是 `function` 就把文件无条件交给 `parseFunction()` → `POST /api/function/parse`。该接口是**功能用例 Excel 解析器**（`FunctionProcessor` 用 openpyxl 打开），拿到 .dbc 直接抛 `File is not a zip file` → 500 → 前端按 `typeLabel` 弹出「DBC 解析失败」。所以「提示 DBC 解析失败」与「/api/function/parse 500」是同一个 bug 的两端。上一版只在 FunctionView 右侧对象浏览器加了上传按钮（走 `/api/can/parse-dbc`，正常），左侧栏入口未同步修复。

**变更内容**：
- `frontend/src/components/GlobalSidebar.vue`：功能模块下按文件类型分流——`.dbc` 走 `parseDbcFile()` → `/api/can/parse-dbc`，解析结果写入 `store.setUploadDbc()` 载入对象浏览器（与 FunctionView 的上传按钮行为一致）；Excel 仍走 `parseFunction()`。

**验证**（本地后端实测同一份 .dbc）：
- 修复前路径 `POST /api/function/parse` → **500** `{"code":500,"message":"解析失败: File is not a zip file"}`
- 修复后路径 `POST /api/can/parse-dbc` → **200**，`1 条报文 / 2 个信号`，返回 `columns` / `rows`
- `vue-tsc --noEmit` 通过（exit 0）

**相关文件**：
- `frontend/src/components/GlobalSidebar.vue`

**发布状态**：已发布到共享盘（version 1.0.10）

---

### [1.0.10] - 2026-09-21

**会话主题**：Function 用例预览 —— 点击用例定位代码、分组全部折叠/展开

**变更内容**：
- `frontend/src/views/FunctionView.vue`：
  - 用例预览左栏「用例分组」标题后新增「全部折叠」「全部展开」按钮；分组展开态由「已收起集合」改为「已展开集合」（`collapsedGroups` → `expandedGroups`），默认集合为空即**默认全部折叠**，新分组同样默认收起。
  - 左栏用例条目（含「未分组」）可点击：`locateCaseInCode()` 把右栏代码预览滚动到该用例所在行。定位方式为在 `TestCase.can` 文本中查 `testcase <case_id>()` 的字符偏移，再按字符偏移在 highlight.js 渲染后的 DOM 文本节点上建 `Range` 取 `getBoundingClientRect()`，只滚动最近的可滚动祖先（代码区），不带动整页；当前子选项卡不是 TestCase 时自动切回。

**验证**：`vue-tsc --noEmit` 通过（exit 0）。用例 id 与代码锚点同源（`/api/function/expand-cases` 的 `cases` 与 `test_cases` 由同一份 graph 生成，后端 `build_testcase_can` 输出 `testcase <case_id>()`），Excel 导入用例同样以 `testcase <case_id>()` 包裹。

**相关文件**：
- `frontend/src/views/FunctionView.vue`

**发布状态**：已发布到共享盘（version 1.0.10）

---

### [1.0.10] - 2026-09-21

**会话主题**：Function 工况画布 —— 恢复「宽工况滚轮横向滚动」，让右侧泳道卡片可拖动 / Ctrl 拖拽复制

**问题**：
`CaseFrameCanvas.vue` 里的拖拽与 Ctrl 拖拽复制逻辑（`onNodeDragStart` / `onZoneDrop` / `resolveClip` / `applyClip`）本身完好，但**宽工况的横向导航被改成了「只有指针压在画布底部横向滚动条上时滚轮才横向」**。而 `.cfc-canvas` 是包含全部工况的滚动容器，那条横向滚动条位于所有工况的最底部，多个工况叠加后鼠标实际够不到。于是宽度超出画布的工况（如 ADS_Ang「Eps Off->No Active」6 条泳道约 2561px、可视区仅 745px）右侧泳道完全滚不出视野，表现就是**那里的卡片「按不起来 / 拖不动 / 也没法 Ctrl 拖拽复制」**——即之前那次修复（边缘自动滚动 + 滚轮横向）丢失后的回归。

**变更内容**（`frontend/src/components/graph/CaseFrameCanvas.vue`，仅动滚轮相关函数与工具栏提示）：
- 新增 `pointerOnWideFrame()`：判断指针是否停在「宽度超出画布」的工况框上；
- `onCanvasWheel()`：指针在宽工况上**或**在横向滚动条上 → 滚轮转横向；横向到该方向尽头不拦截，继续滚自动转纵向（不会卡住）；**Shift+滚轮显式纠正为纵向**（Chrome 原生 Shift+滚轮是横向）；
- 工具栏提示改回「泳道超出宽度后用滚轮左右查看（Shift+滚轮上下）」。

**验证**（Vite dev + 真实 A47D 配置的图形配置画布，实测数据）：
| 项 | 结果 |
|---|---|
| 滚轮停在宽工况上 | `scrollLeft 12 → 132`（横向生效） |
| Shift+滚轮 | `scrollTop 12 → 112`（强制纵向） |
| 右侧泳道卡片可达性 | 滚到最右后 `elementFromPoint` 命中 `DIV.node-name`（`hitIsNode: true`），`draggable="true"` |
| 普通拖拽（移动） | 总节点数不变 `61`，源泳道 `2 → 1`、目标泳道 `5 → 6`，节点确实换栏 |
| Ctrl+拖拽（复制） | 总节点数 `60 → 61`，目标泳道 `4 → 5`，**源泳道保留 `2` 张**（复制非移动） |
| `vue-tsc --noEmit` | 通过（exit 0） |

**相关文件**：
- `frontend/src/components/graph/CaseFrameCanvas.vue`

**发布状态**：已发布到共享盘（version 1.0.10）

---

### [1.0.10] - 2026-09-21

**会话主题**：工况卡片改按序排列 + 滚轮横滚改为 Shift+滚轮；CAN 模块 Excel 导入兼容旧表

**变更内容**：
1. **同泳道卡片按序排列（`CaseFrameCanvas.vue`）**：删除自由摆放能力——去掉节点的 `marginTop: topGap` 渲染与 `alignNodeToPointer()`，落点只用鼠标 Y 决定「插到哪张卡片前/后」，卡片始终按 `lane.nodeIds` 顺序等距排列，不再有留白与重叠。旧配置里残留的 `topGap` 字段不再参与渲染（数据未删，保持向后兼容）。
2. **滚轮横向滚动改手势（`CaseFrameCanvas.vue`）**：普通滚轮一律不接管（工况只做上下滚动）；**只有指针停在「宽度超出画布」的工况上 + Shift+滚轮**才横向滚动，**横向滚到尽头即停住（不再转为纵向）**。移除原先「指针压在画布底部横向滚动条上滚轮即横滚」的判定（含 `pointerOnHScrollBar` / `onCanvasMouseMove` 及其模板绑定）。
3. **CAN 模块 Excel 导入兼容旧表（`backend/core/can_module.py` + `frontend/src/views/CANView.vue`）**：旧表（如 `C135_Configuration.xlsx`）用 `Configuration` 工作表以「Name / Description」两列描述配置项，此前导入被整体忽略，限定符 / Ready 等要全部手输。现新增 `_parse_configuration_sheet()` + `_CONFIG_SHEET_KEY_MAP`，把旧名称映射为配置页 key（`Service object→serviceObject`、`CDD_Qualifier→cddQualifier`、`A2L_Qualifier→a2lQualifier`、`Battery_Voltage→batteryVoltage`、`Torque_limit→torqueLimit`、`Ready_On/Ready_Off→readyOn/readyOff`、`Car Mode/Usage Mode/ElPowerLevel/Ubat`），随 `/api/can/parse` 返回 `Configuration`；`Vehicle_speed / Fault_led / Fault_warning` 属此前已下线的字段，不映射、仅记日志。前端把 `applyConfigData` 里的配置页回填逻辑抽成 `applyConfigurationData(raw, merge)`，Excel 上传路径以 merge 方式回填（保留 CFG 解析出的 cfgDir 等），已保存配置的加载路径行为不变。
4. **`TestNoDTC()` 两份模板对齐（`backend/templates/capl.py` + `backend/templates/canoe_capl.py`）**：同一函数在两份模板里参数不一致——`capl.py` 是 `TestReadDTC(0x0, 0, gcFalse, gcNot_Unique)`（生成源码用的就是这份，被 `excel_processor` / `function_processor` 共同引用），`canoe_capl.py` 是 `TestReadDTC(0x0, 0xFF, gcFalse, gcUnique)`。按「以 0 为准」统一为 `TestReadDTC(0x0, 0, gcFalse, gcUnique)`（mask 走 `19 02 00`；该分支不使用 isExpected/unique，故 unique 对齐无行为差异）。注：`canoe_capl.py` 全仓库无 import 引用；4 个已存配置的 `array_func_test` 与 `Sanbao_global_library.json` 里仍是旧的 `gcNot_Unique`（mask 已是 0），下次生成/保存时随模板刷新。

**验证**（真实文件 `D:\My RTX Files\胡张\C135_Configuration.xlsx` + Vite dev 实测）：
| 项 | 结果 |
|---|---|
| `POST /api/can/parse`（旧表） | 200，返回 `DBC`(312 行) / `DTC`(22 行) / `DataLinkLayer`(23 行) / **`Configuration`(11 项)**，含 `cddQualifier=ABS_ESP`、`a2lQualifier=J3_F_XCPDemo`、`readyOn=$VehModMngtGlbSafe1UsgModSts=0;` |
| 普通滚轮停在宽工况上 | `scrollLeft 0 → 0`（不横滚） |
| Shift+滚轮停在宽工况上 | `scrollLeft 0 → 150` |
| 已滚到最右时 Shift+滚轮向下 | `scrollLeft` 保持 971、`scrollTop` 保持 100（不再转纵向）；反向滚回 `971 → 821` |
| Shift+滚轮停在画布空白处 | `scrollLeft 0 → 0` |
| 卡片留白 | 全部节点 `marginTop` 均为 `0px`（无自由摆放残留） |
| 同泳道拖拽排序 | `[A,B,C,D] → [B,C,A,D]`：A 拖到 C 下方后落在 C 之后，节点集合不变 |
| `vue-tsc --noEmit` | 通过（exit 0） |

**相关文件**：
- `frontend/src/components/graph/CaseFrameCanvas.vue`
- `frontend/src/views/CANView.vue`
- `backend/core/can_module.py`

**发布状态**：已发布到共享盘（version 1.0.10）

---

### [1.0.10] - 2026-09-21

**会话主题**：Function 工况画布 —— 停靠指示改占位框、点击序号徽标同步高亮连线

**变更内容**（`frontend/src/components/graph/CaseFrameCanvas.vue`）：
- **停靠区显示**：拖拽排序的落点提示由「4px 蓝色指示线」改为**虚线占位框**（40px 高、2px 虚线边框、半透明蓝底、圆角 6px），整个框落在目标卡片上/下方的间隙里（`bottom/top: calc(100% + 3px)`），不遮住卡片本身；原来「目标卡片边框变蓝」的提示保留。
- **连线高亮**：`editEdge()` 在进入序号就地编辑时一并设置 `selectedEdgeId`，使点击序号徽标（`.label-badge`，title「点击编辑序号」）时对应连线同步高亮（橙色加粗 + 发光），与点击连线本体的效果一致——编号相同的分叉线较多时能看清正在改哪一条。

**验证**（Vite dev + 真实 A47D 配置画布，实测计算样式）：
| 项 | 结果 |
|---|---|
| 停靠占位框 | 目标卡片带 `node-drop-before`；`::before` 计算样式 `height: 40px`、`border: dashed 2px`、`bottom: 57.39px`、`background: rgba(64,158,255,0.1)`；`::after` 为 `none`（只显示落点一侧） |
| 点击序号高亮 | 点前 `.edge-selected` = 0 → 点后 = 1，`stroke: rgb(230,162,60)`、`stroke-width: 5px`；同时弹出 `.edge-input`（值 `1`） |
| `vue-tsc --noEmit` | 通过（exit 0） |

**相关文件**：
- `frontend/src/components/graph/CaseFrameCanvas.vue`

**发布状态**：已发布到共享盘（version 1.0.10）

---

### [1.0.10] - 2026-09-21

**会话主题**：Function 工况画布 —— 修复「右侧泳道卡片拖不动」（拖拽时整排泳道位移）、泳道标题改序号、序号编辑框改高亮色并自适应宽度

**问题**：
1. **拖拽一开始整排泳道就整体右移**，靠右泳道里的卡片「按不起来 / 拖不动 / 松手没反应」。`.gap-anchor`（拖拽时才插入的「新建泳道」停靠区锚点）是 flex 项，插入后自己会多占一个 `.frame-body` 的 `gap: 80px`，而它的负边距只抵消了 50px（`margin: 0 -25px`）→ **每个空隙净增 30px**。以 ADS_Ang「Eps Off->No Active」实测：lane 0~5 分别右移 +30/+60/+90/+120/+150/**+180px**，工况框宽 1813 → 2023。抓起最右泳道（泳道6）的卡片时，它自己往右跳出可视区、鼠标下面只剩 `.lane-resizer`；松手时瞄准的位置已变成泳道之间的空隙，`drop` 落在 `.frame-body` 上——那里没有任何处理，静默无反应。真实鼠标拖拽现场：`dragstart → node n-result(681,440)`、`drop → frame-body(370,440)`、卡片仍在原泳道。
2. 非主序列泳道一律显示「其它」，口头描述位置困难。
3. 连线序号编辑框用普通连线蓝（`#409eff`）、固定 96px 宽，与「正在编辑哪条连线」的高亮色不一致，且长数字/短数字都占同样宽度。

**变更内容**（`frontend/src/components/graph/CaseFrameCanvas.vue`）：
- **`.gap-anchor` 改为完全不影响布局**：`margin: 0 -25px` → `margin: 0 -40px`（负边距 40×2 = 80px = `.frame-body` 的 gap，全额抵消），并补注释说明「改 gap 时要同步改这里」。
- **泳道标题改序号**：新增 `laneLabel(lane, index)` —— 主序列保留「主序列」，其余按在工况内的**实际位置**编号（从左到右从 1 起，如 `泳道1/泳道2/泳道3/主序列/泳道5/泳道6`，主序列占号不显示故中间跳号）。编号即视觉顺序，便于口头定位。
- **序号编辑框**（`.edge-input`）：
  - 边框由 `#409eff` 改为连线高亮色 `#e6a23c`，并加同色光圈 `box-shadow: 0 0 0 2px rgba(230,162,60,0.35)`，与 `.edge-svg path.hit.edge-selected`（描边）、`.label-badge.badge-selected`（底色）一致；
  - 宽度按内容自适应：新增 `edgeInputWidth = calc(max(1, 值长度)ch + 14px)`（初始 1 个字符；14px = 左右内边距 6+6 + 左右边框 1+1，因全局 `* { box-sizing: border-box }`），去掉原固定 `width: 96px`。

**验证**（真实 A47D_copy 配置 + ADS_Ang 分组画布，重建后的 dist）：
| 项 | 结果 |
|---|---|
| 拖拽中泳道位移 | 两个工况框（3 条 / 6 条泳道）**全部为 0**；工况框宽 1813 → 1813（不再变 2023） |
| 拖拽中鼠标下的元素 | `node-name`（卡片仍在鼠标下，不再跑掉） |
| 真实鼠标拖拽：泳道6 `ADS_Ang_Fault(1,0,0,0)` → 泳道5 | ✓ `[1,3,5,0,4,2]` → `[1,3,5,0,5,1]`，落到泳道5 第 2 位 |
| 真实鼠标拖拽：拖到泳道之间 | ✓ 仍正确新建泳道（6 → 7 条） |
| 泳道标题 | 未配置流程：`泳道1 / 主序列 / 泳道3`；Eps Off->No Active：`泳道1 / 泳道2 / 泳道3 / 主序列 / 泳道5 / 泳道6` |
| 序号编辑框规则 | 构建产物中 `.edge-input` 已无固定宽度；`border: 1px solid rgb(230,162,60)`、`box-shadow: rgba(230,162,60,0.35) 0 0 0 2px` |
| 序号编辑框宽度 | `1ch` @12px（Segoe UI）实测 6.47px → 初始 20.5px；值 `1,2,3` → 46.3px |
| `vue-tsc --noEmit` + `vite build` | 通过（exit 0） |

**说明**：本次一并重新构建了 `frontend/dist` —— 此前源码里的「宽工况 Shift+滚轮横滚」「拖拽时画布边缘自动滚动」并未进入构建产物（dist 内提示文案仍是旧的「把鼠标移到画布底部横向滚动条上再滚轮左右查看」），运行 `run.py` 时拿不到这些修复。注意打包 exe（`frontend/release_v2/`、`dist/#Excel2Case#V1.0.00.exe`）内嵌的是旧前端，需重新打包才会带上以上全部改动。

**相关文件**：
- `frontend/src/components/graph/CaseFrameCanvas.vue`

**发布状态**：已发布到共享盘（version 1.0.10）

---

## [1.0.9] - 2026-09-21

**版本号**：`1.0.9`（`frontend/package.json` 的 `version`）

**安装包**：`#Excel2Case#V1.0.00 Setup 1.0.9.exe`（156,001,639 字节，SHA256 `558FE81AD3B19F5E0EE3AD137423048CB47C56FD91780077DA2B34F0FA0263D7`）

**共享盘路径**：`\\172.28.4.125\装机工作软件\工具软件\Excel2Case`

**更新配置**（`version.json`）：
```json
{
  "version": "1.0.9",
  "release_notes": "优化：\n- Function 工况画布：工况节点支持「参数取值」——从卡片库拖入的整份副本会自动无损迁移成「卡片引用」（节点上填过、且与库卡片默认值不同的参数值搬进该步），节点编辑框随即出现「参数取值」，可按实例分别填值\n- Function：保存库卡片时不再覆盖工况节点自己的参数（声明以库卡片为准、节点同名参数原样保留、节点多出来的参数追加在后面），避免节点上填好的参数值被回滚\n\n修复：\n- 修复工况节点副本的 {{参数}} 无值导致生成时整步被丢弃（界面上只剩 Wait(1000)，看着像参数没生效）\n\n注意：迁移只在打开配置时进行，仅调整节点步骤形态（steps），不改动节点自身的 params / refId / id，也不影响泳道与连线；主序列与「按步骤接线」的节点会自动跳过。",
  "setup_name": "#Excel2Case#V1.0.00 Setup 1.0.9.exe"
}
```

**说明**：本版本汇总 1.0.8 之后的 1 条会话更新记录（见下）。

### [1.0.9] - 2026-09-21

**会话主题**：功能用例配置 —— 工况节点「参数取值」可填（副本节点无损迁移 + 同步不再回滚节点参数）

**问题**：
1. 工况里从卡片库拖入的是「库卡片整份副本」（`refId` 指向库卡片、`steps` 已展开），副本里的 `{{参数}}` 没有任何可按实例填值的地方。`ADS_Ang → Ready->No Active → 设置ADS_SteerAgEna` 的 3 个副本节点 `{{value}}` 无值 → 生成时整步被丢弃（渲染只剩 `Wait(1000)`），界面上只能看到参数名，看着像「参数没生效」。
2. `syncGraphRefs` 同步副本时用 `{...src, id, refId}` 整块覆盖，把节点自己的 `params` 一起盖掉 → 在节点上填好的参数默认值在保存库卡片后被回滚成空。

**变更内容**：
- `frontend/src/utils/functionGraph.ts`：
  - `syncCard` 非引用节点分支不再覆盖节点参数（新增 `mergeCardParams`：声明以库卡片为准、节点同名参数原样保留、节点多出来的参数追加在后面）；
  - 新增 `migrateRefCopyNodes()`：把「库卡片整份副本」形态的工况节点无损转成「卡片引用」（单步 `kind:'card'`，节点填过且与库卡片默认值不同的参数值搬进该步 `args`），节点编辑框里随即出现「参数取值」。三重安全闸：`refId` 必须在**该分组自己的卡片库**中解析、节点步骤必须与库卡片逐字段一致（仅步骤 id 不同）、主序列与按步骤接线的节点不动（接线口按步骤编号，压缩成一步会让注入落到整张卡片之后）。
- `frontend/src/components/graph/FunctionGraphEditor.vue`：打开配置时、保存库卡片后各跑一次迁移（`migrateCopyNodes`），有迁移则提示条数并回写父级。

**验证**（真实配置 + 后端真实生成函数 `_node_steps_with_params` / `_render_steps` 对比迁移前后渲染结果）：
- 全量 7 份配置 253 个带 `refId` 的工况节点：**169 个迁移后渲染结果逐一相同（0 差异）**；17 个（主序列 / 按步骤接线）跳过；1 个有本地改动（`A47D_copy / ADS_Ang / Eps Off->No Active`）跳过；66 个 `refId` 悬空（`A47D / FUNC_ADS_LDW/*`）跳过。
- 目标节点 `node-mu6d7aol-5vqjf` / `node-mu6dulmz-l1wbd`：迁移前渲染 `Wait(1000)`（setSignal 步被丢），在「参数取值」填 `1` 后渲染 `setSignal(x57_ADS_SteerAgEna, 1); Wait(1000);`。
- `vue-tsc --noEmit` 通过（exit 0）。

**说明**：迁移只在打开配置时改节点形态（`steps`），不动节点自身的 `params` / `refId` / `id`，不影响泳道与连线；保存配置后持久化。

**相关文件**：
- `frontend/src/utils/functionGraph.ts`
- `frontend/src/components/graph/FunctionGraphEditor.vue`

**发布状态**：已发布到共享盘（version 1.0.9）

---

## [1.0.8] - 2026-09-21

**版本号**：`1.0.8`（`frontend/package.json` 的 `version`）

**安装包**：`#Excel2Case#V1.0.00 Setup 1.0.8.exe`（156,013,516 字节，SHA256 `3A5468CE6FD1A002FC7DC4968F7D96B21DBC3166EC82E2A52B238689586D45DB`）

**共享盘路径**：`\\172.28.4.125\装机工作软件\工具软件\Excel2Case`

**更新配置**（`version.json`）：
```json
{
  "version": "1.0.8",
  "release_notes": "优化：\n- CAN 新增「电机类型」切换（无刷 / 有刷）：无刷上传 .a2l、有刷上传 .mapxml，两者互斥校验；有刷模式隐藏并清空 A2L_Qualifier，对象浏览器拖拽只输出裸符号名\n- CAN 新增 .mapxml（有刷标定文件）解析：提取符号与字节长度，自动过滤链接器内部符号\n- CAN 有刷模式新增 CCP 采集封装：生成 CCP_Read.cin + CCP.vsysvar，采集值经系统变量 sysvar::NsCcp::<符号名> 中转（CAPL 模板零改动），自动部署 ns_ccp.dll 并在生成后导入系统变量；系统变量类型可按长度推断，也可双击手动指定 int / float / int64\n- CAN DBC 加载改用 CANoe 实例引用的数据库路径，并按「报文名 + 信号名」去重（重复目录示例：106 行 → 54 个唯一信号）\n- CAN 对象浏览器 / 报文信号表：两路 DBC 合并时去重（上传优先）；信号行不再重复显示报文名称 / 标识符 / 周期 / 长度与发送节点\n- CAN 树形图与表格：报文 / 信号节点标签支持内联重命名（同步信号子节点与测试参数映射）；表格「发送节点」列可直接编辑（移动报文），改名与移动均支持 Ctrl+Z 撤销\n\n修复：\n- 修复树形图属性节点双击编辑从未生效（事件误绑在 <template> 上，被 Vue 编译器丢弃）\n\n注意：有刷模式生成的 CCP 脚本建议在 CANoe 内 F9 编译确认；4 字节整数符号默认按 float 声明，可在对象浏览器双击手动改为 int。",
  "setup_name": "#Excel2Case#V1.0.00 Setup 1.0.8.exe"
}
```

**说明**：本版本汇总 1.0.7 之后的 5 条会话更新记录（见下）。

### [1.0.8] - 2026-09-21

**会话主题**：CAN 模块新增 `.mapxml` 文件解析器（有刷标定文件）

**变更内容**：
- 新增 `backend/utils/mapxml_parser.py`：用 `ElementTree` 解析 `<mapfile>`，定位 `Locate Result / Symbols` 表，按 `地址;符号名;地址空间` 提取符号，输出结构与 A2L 解析器一致（`measurements[{name, type:地址}]`）。内部符号过滤规则：`_lc_*`、`__*`、`.cocofun_*`、`_SMALL_DATA_` / `_LITERAL_DATA_` / `_A8_DATA_` 等全大写下划线包裹的链接器数据区符号。
- `backend/api/can_routes.py`：新增 `POST /api/can/parse-mapxml`（扩展名校验与异常处理对齐 A2L 路由）。
- 前端：`api/can.ts` 新增 `parseMapxmlFile`；`GlobalSidebar.vue` 的 can 模块 accept / tip / `getFileType` / `handleCanUpload` 增加 mapxml 分支；`CANView.vue` 监听 `type === 'mapxml'` 写入 `a2lVars`（store 的 `objA2lVars`），复用 A2L 视图渲染；`ObjectPanel.vue` 空状态提示改为「请上传 .a2l / .mapxml 文件」。

**验证**（示例文件 `ECUAPP_927_3133.mapxml`）：
- 接口 200，符号总数 1503，过滤后保留 1469（剔除 34 个内部符号），返回样例 `{"name":"Uds_SessionRuntime","type":"0x70000460"}`；错误扩展名返回 400。
- `vue-tsc --noEmit` 通过。

**相关文件**：
- `backend/utils/mapxml_parser.py`（新增）
- `backend/api/can_routes.py`
- `frontend/src/api/can.ts`
- `frontend/src/components/GlobalSidebar.vue`
- `frontend/src/views/CANView.vue`
- `frontend/src/components/ObjectPanel.vue`

**发布状态**：已发布到共享盘（version 1.0.8）

---

### [1.0.8] - 2026-09-21

**会话主题**：CAN 电机类型（无刷 / 有刷）切换——两种标定文件互斥解析

**变更内容**：
- `stores/modules.ts`：新增 `CanMotorMode`（`'brushless' | 'brushed'`）、`canMotorMode`（默认 `brushless`）、`setCanMotorMode`（切换时清空对象浏览器变量与 `objA2lQualifier`）；CFG 解析结果的 `a2l_path` / `a2l_qualifier` 仅在无刷模式同步到 store。
- `GlobalSidebar.vue`：CFG 配置区块上方新增「电机类型」切换按钮（仅 CAN 模块显示，默认无刷）；上传框 `accept` 与提示随模式变化（无刷 `.xlsx,.xls,.dbc,.a2l` / 有刷 `.xlsx,.xls,.dbc,.mapxml`）；`onFileChange` 增加互斥拦截（有刷上传 .a2l、无刷上传 .mapxml 会被拦下并提示）。
- `CANView.vue`：`visibleConfigFieldDefs` 在有刷模式过滤掉 `a2lQualifier`；CFG 数据 watch 在有刷模式强制置空 `a2lQualifier`；新增 `canMotorMode` watch 清理 `configPageData.a2lQualifier` 与 `lastA2lQualifier`；`addA2lNames` 与 `ObjectPanel` 拖拽在限定符为空时直接输出符号名，不再生成 `sysvar::XCP::::name` 这类无效匹配串。

**行为**：

| | 无刷（默认） | 有刷 |
|---|---|---|
| 可上传标定文件 | `.a2l` | `.mapxml` |
| A2L_Qualifier 字段 | 显示、CFG 自动回填 | 隐藏、强制清空 |
| 对象浏览器拖拽输出 | `sysvar::XCP::<限定符>::<变量名>` | 仅 `<符号名>` |

**验证**：`vue-tsc --noEmit` 通过（exit 0）。

**相关文件**：
- `frontend/src/stores/modules.ts`
- `frontend/src/components/GlobalSidebar.vue`
- `frontend/src/views/CANView.vue`
- `frontend/src/components/ObjectPanel.vue`

**发布状态**：已发布到共享盘（version 1.0.8）

---

### [1.0.8] - 2026-09-21

**会话主题**：有刷模式 CCP 采集封装（非标准 CCP，系统变量中转方案）

**方案**：CAPL 模板零改动——采集到的值发布到 `sysvar::NsCcp::<符号名>`，生成侧只把裸符号名替换为该系统变量引用。（命名空间原为 `CCP`，因 CANoe 保留该命名空间而改用 `NsCcp`。）

**变更内容**：
- `backend/templates/ns_ccp_capl.py`（新增）：生成 `CCP_Read.cin` + `CCP.vsysvar`。
  - `CCP_Read.cin`：`#pragma library("ns_ccp.dll")` + 符号地址/长度常量表 + SHORT_UP 单读状态机 + DAQ 周期采集状态机（复刻 NsCCP_DLL 的 test.can）+ 把读回值发布到 `sysvar::NsCcp::<符号名>`，`on start` 自动启动采集。
  - `CCP.vsysvar`：按长度推断类型（≤2→int、4→float、8→int64）。
- `backend/utils/mapxml_parser.py`：新增 `_parse_section_sizes`，从 `Locate Result/Sections` 表按 `Space addr` 关联 `Size (MAU)`，为每个符号输出字节长度。
- `backend/processors/excel_processor.py`：新增 `_ccp_ref` / `_apply_ccp_var_refs` / `_ccp_usable_symbols`；有刷模式下把 `batteryVoltage`、`torqueLimit` 及 DBC 的 `XCP_CCP_varname` 裸符号名替换为 `sysvar::NsCcp::<符号名>`；落盘时输出 CCP 两个文件并在 `TestCase.can` 的 includes 里加 `#include "CCP_Read.cin"`。
- `backend/utils/ns_ccp_dll.py`（新增）：跨「开发 / PyInstaller onefile / onedir」环境定位 DLL；`deploy_ns_ccp_dll(project_dir)` 复制到工程根目录 + `x64/` + `x86/`；DLL 收进 `backend/resources/ns_ccp/{x64,x86}/ns_ccp.dll`（`backend/` 整目录已打包，未重复加 `datas` 条目）。
- `backend/api/can_routes.py`：生成完成后有刷且存在 `CCP.vsysvar` 时，自动调用 `add_vsysvar_to_config()` 导入（与 `great_canoe_module.py` 同一套接口）；CANoe 实例不可用时记警告跳过，不阻断生成。
- 前端：`A2lVar` 增加 `size`；`CANView.collectCcpSymbols()` 收集配置区字段与 DBC `XCP_CCP_varname` 列命中的符号（地址/长度随请求下发）；`modules.ts` 新增 `ccpVarTypes` / `setCcpVarType`；`ObjectPanel.vue` 有刷模式双击变量弹出类型选择（int / float / int64），另有「按长度推断」按钮清除手动指定；节点信息行显示 `地址 · 长度B`；`api/can.ts` 的 `generateCAN` 增加 `ccpSymbols`。

**验证**：
- 长度提取 1464/1469（地址-长度 0 冲突，`AbsHwPos_HwDeg_F32`=4、`Torque_T1`=4、`Uds_SessionRuntime`=44）。
- CCP 模块 251 行，`#pragma library`、`gCcpAddr[2]={0x700006b4,0x7000071a}`、`gCcpSize[2]={4,2}`、`on message 0x7F1`、publish switch 均正确。
- DLL 定位（x64/x86）均命中仓库路径，部署 3 个目标全部落地。
- 手动类型覆盖生效（`Torque_T1` → int64），未指定项仍按长度推断。
- `import backend.app` 通过；`vue-tsc --noEmit` 通过（exit 0）。

**待实机确认**：
- 生成脚本的 CAPL 需在 CANoe 内 F9 编译确认；SHORT_UP 应答数据偏移沿用 NsCCP_DLL 的 `rx[3]` 约定，如与实际 ECU 不同，改 `ns_ccp_capl.py` 里 `ccpLe(ccpRx, 3, ...)` 的偏移即可。
- 系统变量类型启发式（≤2→int、4→float、8→int64）可通过双击对象浏览器变量手动覆盖（4 字节整数符号默认会声明为 float）。
- 仅 1~4 字节的符号参与 CCP 采集，结构体/数组会被跳过并计入日志。

**相关文件**：
- `backend/templates/ns_ccp_capl.py`（新增）
- `backend/utils/ns_ccp_dll.py`（新增）
- `backend/resources/ns_ccp/x64/ns_ccp.dll`、`backend/resources/ns_ccp/x86/ns_ccp.dll`（新增）
- `backend/utils/mapxml_parser.py`
- `backend/processors/excel_processor.py`
- `backend/core/can_module.py`
- `backend/api/can_routes.py`
- `build.py`
- `frontend/src/stores/modules.ts`
- `frontend/src/views/CANView.vue`
- `frontend/src/components/ObjectPanel.vue`
- `frontend/src/api/can.ts`

**发布状态**：已发布到共享盘（version 1.0.8）

---

### [1.0.8] - 2026-09-21

**会话主题**：DBC 加载改用 CANoe 实例引用的数据库；对象浏览器与信号行去重

**问题**：`CANDBC` 目录下有 2 个互相重叠的 DBC（`LR927_Converted.dbc` 10 报文/52 信号、`LR927_Converted_1.dbc` 10 报文/54 信号），后端把目录下所有 `.dbc` 的 rows 直接拼接、不去重 → 106 行里只有 54 个唯一信号、52 个 (报文,信号) 重复对，树形图与表格同时重复。而 CANoe 实例的 `Bus.Databases` 本就提供了唯一且权威的数据库路径，此前只用于成功提示、未参与 DBC 加载。

**变更内容**：
- `backend/api/can_routes.py`：
  - 新增 `_resolve_dbc_path()`（兼容 `CANDBC\x.dbc` 相对写法，按 `cfg_dir` 拼接校验）与 `_scan_dbc_dir()`；
  - `POST /parse-dbc-from-cfg-dir` 新增可选 `dbc_paths`：传入时**只解析这些 DBC**，仅在引用路径全部不可用时才回退扫描目录；
  - 新增 `_dedupe_dbc_rows()`：按「报文名 + 信号名」去重（保留排序在前者的定义），报文/信号数改为去重后的真实值。
- `frontend/src/stores/modules.ts`：`CfgData` 补 `databases` 字段；`loadDbcFromCfgDir()` 自动从 `cfgData.databases` 筛出 `.dbc` 路径传给后端（调用方无需改动）；`objMergedDbcRaw` 新增 `mergeDbcRows()`——上传 DBC 与 CFG DBC 两路合并时按「报文名 + 信号名」去重（上传优先），列名模糊匹配（`msg_name` / `报文名称`、`signal_name` / `信号名称`），识别不到列时不合并（退化为原行为，不误删）。
- `frontend/src/components/DbcSignalTable.vue`：`getCellText` 新增反向规则——报文级列（报文名称 / 报文标识符 / 报文周期时间 / 报文长度）与发送节点列在**信号行留空**，不再重复显示报文属性与节点属性。

**验证**：
- 后端：传 `dbc_paths`（相对 / 绝对路径）→ 1 个文件、10 报文、54 信号；不传或引用不存在 → 回退扫描 2 个文件、去重后 54 信号。
- 前端表格实测（加载 `E262S无刷`）：114 行 = 11 报文行 + 103 信号行；信号行里「报文名称 / 发送节点 / 报文周期时间 / 报文长度」非空的行数均为 **0**；报文行仍正常显示（`["", "EPS", "Msg_1E5", "0x1E5", "10", "8", ...]`）。
- 对象浏览器合并算法在真实数据上验证：列定位正确（`msgIdx=1`、`sigIdx=11`），第二路重叠行全部被识别并丢弃。
- `vue-tsc --noEmit` 通过（exit 0）。

**相关文件**：
- `backend/api/can_routes.py`
- `frontend/src/stores/modules.ts`
- `frontend/src/api/can.ts`
- `frontend/src/components/DbcSignalTable.vue`

**发布状态**：已发布到共享盘（version 1.0.8）

---

### [1.0.8] - 2026-09-21

**会话主题**：树形图与表格编辑修复与增强（属性双击失效 / 发送节点可编辑 / 节点标签重命名）

**问题**：
1. **树形图属性节点双击从未生效**——`@dblclick.stop="_startAttrEdit(data)"` 挂在 `<template v-else>` 上，Vue 3 不会给 `<template>`（片段占位）绑定 DOM 事件，handler 被编译器直接丢弃（同项目 `CreateCanoeView.vue` 的同类实现是挂在真实 `<span>` 上）；
2. 表格「发送节点」列不可编辑；
3. 树形图报文 / 信号节点标签不可重命名。

**变更内容**：
- `frontend/src/views/CANView.vue`：
  - attr 值的事件从 `<template>` 移到真实 `<span>`；
  - `dbcTableColumns` 的 senders 列加 `editable: true`；
  - 新增树节点标签内联重命名（`.node-label` + `.label-edit-input` + `_startLabelEdit` / `finishLabelEdit` / `cancelLabelEdit`）；
  - 新增 `renameTreeNode()`：同步 `name` / `label`、报文的 `msg.msgName` 与**所有信号子节点**的 `msg.msgName`（保持归属关系）、以及 testParamMap 的 key（`msgName` 与 `msgName:::signalName`），仅对报文 / 信号节点生效；
  - 新增 `moveMessageToSender()`：把报文从原发送节点移到目标发送节点（不存在则新建），同步报文与所有信号子节点的 `senders`，清理空发送节点，整体替换 `treeData` 触发树 / 表重算；
  - `UndoEntry` 扩展 `rename` / `sender` 两种类型（`flushUndoStep` 过滤 + `undo()` 回放），Ctrl+Z 可撤销改名与移动。
- `frontend/src/components/DbcSignalTable.vue`：`isEditable` 允许发送节点列（仅报文行，信号行该列本就留空）；`commitEdit` 对发送节点走新增的 `sender-rename` 事件（该列不是节点上的字段，需移动报文而非写字段）。

**验证**：
- 表格双击「发送节点」→ 输入框弹出（值 `EPS`）；改为 `EPS_X` 回车 → `Msg_1E5` 从 `EPS` 移到 `EPS_X`，`EPS` 仍保留 Msg_1E6 / Msg_2D8 / Msg_605。
- 编译产物确认 handler 已绑到真实 `<span>`（修复前 attr 的 handler 被丢弃）：
  `onDblclick: _withModifiers(($event) => $setup._startAttrEdit(data), ["stop"])`、`onDblclick: _withModifiers(($event) => $setup._startLabelEdit(data), ["stop"])`。
- `vue-tsc --noEmit` 通过（exit 0）。
- **未能在自动化中验证**：带偏移量的合成双击（工具限制，需在 CANoe 内双击确认）、Ctrl+Z 触发（快捷键未被自动化唤起）。撤销分支代码已实现，请手动验证。

**相关文件**：
- `frontend/src/views/CANView.vue`
- `frontend/src/components/DbcSignalTable.vue`

**发布状态**：已发布到共享盘（version 1.0.8）

---

## [1.0.7] - 2026-09-18

**版本号**：`1.0.7`（`frontend/package.json` 的 `version`）

**安装包**：`#Excel2Case#V1.0.00 Setup 1.0.7.exe`（155,840,080 字节，SHA256 `AE3A45C67CD20F9FABA5485D014C36DDEF7C81F6E9D193588294F0F2B4C366A6`）

**共享盘路径**：`\\172.28.4.125\装机工作软件\工具软件\Excel2Case`

**更新配置**（`version.json`）：
```json
{
  "version": "1.0.7",
  "release_notes": "优化：\n- CAN「其他配置」的 Signal_InvalidValue 卡片移除，信号无效值直接取 DBC 报文信号表的 Invalid_Value 列（空值不测试，自动剔除 CRC/Counter）\n- CAN 配置生成页修改 A2L/CDD 限定符后，已拖入的引用实时替换，不再需要重拖\n- CAN「其他配置」各测试项卡片新增「?」使用说明（21 项）\n- CAN DTC 页面检测对象支持「等待时间」：为空/0 生成 SignalCheck，有值生成 SignalWaitCheck\n- Function 工况画布：连线单击高亮、双击删除，高亮时所属编号一并高亮；同一接线口出线自动扇形分散 + 中段错开\n- Function 工况画布：卡片可在泳道内自由上下摆放（不会重叠）；泳道宽度拆分为自适应上限与手动上限（手动可拖到 2000px）\n- Function 工况画布横向平移改为「仅指针位于横向滚动条上时生效」，滚轮默认纵向滚动工况\n- Function 用例展开：并列结果全部串联，修复工况4 用例 10/11 等丢失结果卡\n\n修复：\n- 修复卡片参数 {{占位符}} 泄漏到界面与生成结果（副本节点回落库卡片参数默认值；确实无值的参数按「不参与」处理，并在工况框给出 ⚠ 提示）\n- 修复 DTC 结构体 DTC_Data_array 数值出现双逗号（{0xC1,1,,2,,3} → {0xC1,1,2,3}）\n- 修复 testfunction Msg_Signal* 用例 XML 变量名与类型和 CAPL 声明不匹配（Signal → Sig，Value 统一按 int 输出）\n- 修复保存库卡片时「卡片引用节点」被整块覆盖，导致实例填写的参数取值丢失\n\n注意：DTC 检测对象新增「等待时间」后，旧配置表头不含时间，升级后所有检测对象（含 Torque_limit，原语义为 7000）都会走 SignalCheck，需在 DTC 页补填时间。",
  "setup_name": "#Excel2Case#V1.0.00 Setup 1.0.7.exe"
}
```

**说明**：本版本汇总 1.0.6 之后的 2 条会话更新记录（见下）。

### [1.0.7] - 2026-09-18

**会话主题**：CAN 信号无效值改由 DBC 驱动；限定符实时替换；其他配置卡片帮助；DTC 结构体与 XML 参数修正；DTC 检测对象等待时间

**一、Signal_InvalidValue 控件移除，改由 DBC 报文信号表生成（`frontend/src/views/CANView.vue` + `backend/processors/excel_processor.py`）**

**背景**：原「其他配置」的 `Signal_InvalidValue` 卡片需要人工逐条填写信号名 + 无效值，与 DBC 报文信号表里已维护的 `Invalid_Value` 列重复。

**变更**：
- 前端移除 `Signal_InvalidValue` 卡片（模板、`signalInvalidValues` ref、`epsSignals` computed、`fillSignalInvalidValuesFromDbc()` 及其 watcher、`applyConfigData` 回填、`resetData` 重置、相关 CSS 一并删除）。
- 新增 `signalInvalidValueLookup` / `signalTypeLookup`（遍历 `treeData`，取报文信号表当前的 `fields.invalidValue`，用 `parseInvalidValueList` 归一化为逗号分隔）。
- `collectConfigData` 直接由 lookup 收集：只保留**有无效值**的信号（空值默认不测试，信号名不传给后端），并剔除 CRC / Counter 信号；仍有有效项时才写 `Other.signalInvalidValue`。
- 后端 `excel_processor.py`：`siglen += 1` 移到空值校验**之后**，并在末尾加 `if siglen > 0` 守卫；无效值全空时既不计入数量也不生成用例，避免生成 `checkId[0]` 之类的非法空用例。

**二、A2L_Qualifier / CDD_Qualifier 实时替换（`frontend/src/views/CANView.vue`）**

**问题**：配置生成页修改限定符后，已从 A2L/对象面板拖入的引用仍保留旧限定符，需要手工重拖。

**变更**：新增限定符替换工具链 `escapeRegExp` / `replaceQualifierInString` / `replaceQualifierDeep` / `applyQualifierReplace`，并对 `a2lQualifier`、`cddQualifier` 各加一个同步 watcher：
- A2L 按 `xcp::<限定符>::`、`<限定符>::` 前缀形式替换；CDD 按 `<限定符>::`、`<限定符>.` 及 `ABS_ESP` 前缀形式替换。
- 替换范围覆盖所有已拖入的引用：`configPageData`、`otherData`、分组卡片 `groupCardDefs`、通信/诊断/助力参数、测试参数、`treeData`、`dtcRaw`（跳过 `a2lQualifier` / `cddQualifier` 自身元字段）。
- 用 `lastA2lQualifier` / `lastCddQualifier` 记住旧值，解决「清空输入框再输入」拿不到旧值；用 `suppressQualifierReplace` 守卫避免加载配置时把新数据当成旧值替换。

**三、其他配置测试项卡片新增「?」使用说明（`frontend/src/views/CANView.vue`）**

- 新增 `OTHER_CARD_DOCS`（21 个测试项文案：`ack`、`init`、`allMsgTx`、`dataframeId`、`busoffDiagStartTime`、`igonDiagStartTime`、`igoffDiagStopTime`、`powerDownDiagStop`、`highBusLoadTxatt`、`highBusLoadCommunication`、`minDelayTime`、`shutdown`、`busOffQuick`、`busOffSlow`、`disableXcp`、`sliderGroup`、`readyOffDiagStop`、`signalValue`、`otaDiagStop`、`sigDiagStop`、`pwrStsFbDiagStop`）。
- 简单卡片 / 复合滑块卡片 / 十六进制卡片 / 分组卡片的右上角新增 `?` 图标，点击弹出使用说明；`@click.stop` 避免误切换卡片启用状态，分组卡片把「+ 添加」与 `?` 收进 `.other-card-header-actions`。
- 因 `el-popover` 内容 teleport 到 body，文件末尾追加非 scoped 样式块定义 `.other-card-help-text`（`white-space: pre-line`）。

**四、DTC 结构体 `DTC_Data_array` 数值出现双逗号修复（`backend/processors/excel_processor.py`）**

**问题**：`process_dtc_sheet()` 用 `str(row_values).replace(" ", ",")` 拼接行数据，而 `str(list)` 的元素分隔符本身就是 `", "`，导致 `1,,2`。

**变更**：改为按元素 `",".join(...)` 拼接（元素内部原有的空格→逗号处理保留），`{0xC1,1,,2,,3}` → `{0xC1,1,2,3}`。

**五、testfunction Msg_Signal* 用例 XML 变量类型核对（`backend/processors/excel_processor.py`）**

**问题**：CAPL 模板中信号参数一律声明为 `signal* Sig`、值为 `int`/`dword`，但生成的 XML 写成 `name="Signal"`，`Value` 又靠自动推断（字符串/空值会推成 `type="string"`），与 CAPL 声明不匹配。

**变更**：
- 新增 `_as_int_param()`：把 `Value` 统一按 int 输出，兼容 `0x..`、数字字符串、浮点与空值（空值按 0）。
- 14 处 `"Signal": ("signal", ...)` → `"Sig": ("signal", ...)`：`Msg_SignalInvalid` / `Msg_SignalValueInvalid` / `Msg_CounterInvalid` / `Msg_BoolInvalid` 各自的连续 + 不连续用例。
- 10 处 `Value` 改为 `_as_int_param(...)`（`type` 由 `string` → `int`）。

**六、DTC 检测对象支持等待时间参数（`frontend/src/components/DtcCardList.vue` + `backend/processors/excel_processor.py`）**

**功能**：DTC 页面表格表头的每个检测对象列可配置「等待时间」，时间为空 / 0 生成 `SignalCheck`，有值生成 `SignalWaitCheck`。

**变更**：
- 表头格式统一为 `对象名 / 时间`（时间可省略，复用既有 `' / '` 约定，随表头一起存配置并导出 Excel）。
- 前端：`allColumns` 拆出 `name` / `time`（时间**仅识别数值**，避免把双语表头第二行误当时间），对象匹配改用 `name` 段；检测对象列表头改为两行（对象名 + 时间），点击时间区域内联输入（Enter 提交 / Esc 取消 / 空值或 0 清除），`commitTimeEdit` 写回 `名称 / 时间`；拖拽换绑对象时保留该列已配的时间。
- 后端：新增 `_split_dtc_object()` 解析表头；`process_dtc_sheet()` 按时间分流 —— 空 / 0 → `SignalCheck(obj, Var)`，有值 → `SignalWaitCheck(obj, Var, 时间)`；同时移除 `Torque_limit` 硬编码 `7000` 的特例（统一按新规则）。
- **注意**：旧配置表头无时间，升级后所有检测对象（含 `Torque_limit`）都会走 `SignalCheck`，需在 DTC 页补填时间（`Torque_limit` 原语义为 `7000`）。

**验证**：
- `python -m py_compile backend/processors/excel_processor.py` 通过；前端 `vue-tsc --noEmit` 无 `CANView` / `DtcCardList` 报错，`vite build` 通过。

**相关文件**：
- `frontend/src/views/CANView.vue`
- `frontend/src/components/DtcCardList.vue`
- `backend/processors/excel_processor.py`

**发布状态**：已发布到共享盘（version 1.0.7）

---

### [1.0.7] - 2026-09-18

**会话主题**：卡片参数化 `{{占位符}}` 泄漏修复；工况画布连线交互与自动分散；卡片泳道内自由摆放；用例展开补齐并列结果

**一、参数化卡片被引用时 `{{参数}}` 泄漏到界面与生成结果（本次核心）**

**问题**：卡片声明参数（`params` + 步骤里 `{{name}}` 占位）后在工况里引用它，页面/生成结果里仍出现 `{{var}}`。逐条链路实跑定位到两个原因：
1. `_substitute_card_params()` 对**找不到值的占位符刻意保留原样**（原注释「便于发现漏填」），于是 `Sensor{{ch}}_oN` 直接进了 CAPL 与用例预览；
2. 副本节点（从卡片库拖出的拷贝）通常**不带 `params`**（声明留在库卡片上），解析时不回落到库卡片的参数默认值 —— 于是「有值也解析不出来」。

**变更**：
- 后端 `_substitute_card_params(steps, values, strict=True)`：未提供值的占位符按既有「空值跳过」语义处理（check/set/reset 丢该参数行；call/wait 与 raw/fun 整步丢弃），**不再把 `{{参数}}` 写进结果**；`strict=False` 可回到旧行为。
- 新增 `_node_param_values(node, card_lookup)`：节点参数默认值先取「它引用（`refId`）的库卡片 params」，再被节点自身 params 覆盖 —— 副本也能解析出实际值。
- `_node_steps_with_params()` / `_frame_node_steps()` / `_frame_node_label()` 支持传 `card_lookup`；`_frame_node_label` 连步骤名（如 `fun="Sensor{{ch}}_oN"`）里的占位符一并解析，标签不再出现花括号。
- 前端（与后端语义一致）`utils/functionGraph.ts`：`resolveCardParams` 默认 strict；新增 `nodeParamDefaults()`（库卡片回落）与 `resolveParamsText()`；`frameNodeLabel()` / `frameDiagnostics()` / `listFrameChains()` 支持 `cardLookup`，画布调用处传入卡片库。
- 新增工况框诊断 `param-unresolved`：参数既无默认值、引用处也没填时，工况框显示 ⚠「参数 ch 没有值：请在引用处的「参数取值」里填值，或给卡片参数设默认值（生成时这些项不会参与）」—— 用提示替代「把占位符写进代码」，避免静默丢失步骤。
- `FunctionGraphEditor.collectCardVariables()`：跳过仍是占位符的 arg，避免 `{{参数}}` 被当成对象名写进映射表。
- `syncGraphRefs()`（保存库卡片时触发的引用同步）：**不再整块覆盖「卡片引用节点」**（原来会把实例填的「参数取值」冲掉、内容退化成库卡片原件，参数没默认值时就显示 `{{var}}`），现在只同步卡片名 / 类型。

**验证**（配置 `A47D_copy` / `FUNC_ADS_TORQUE` + 合成最小用例逐条实跑）：
- 卡片引用（引用处填值）`SensorAs_oN()`、未填走默认 `SensorRs_oN()`、副本自带 params `SensorRs_oN()` —— 三种正常路径不变；
- 修复前「副本 + 占位符无人给值」→ `Sensor{{ch}}_oN();`（残留）；修复后该项按「不参与」丢弃，用例内 **0 处 `{{`**；
- 「副本无 params 但 `refId` 指向库卡片（ch 默认 Rs）」修复前残留、修复后 → `SensorRs_oN()`；
- 标签文案：`_frame_node_label('seq:…:1')` 由 `Sensor{{ch}}_oN` → `SensorRs_oN`（无值时为 `Sensorch_oN`，即显示参数名，不带花括号）；
- 真实配置回归：29 条用例内容逐行与修复前一致，全库 0 处残留占位符（卡片定义里 4 处 `{{ch}}/{{dtc}}/{{steerMod}}/{{tqCtrlSts}}` 按设计保留）；
- 画布：注入 `Init{{foo}}` → 工况框出现 ⚠ 1 处待修正（文案如上），改回后消失；全页 `{{` 文本 / 输入框扫描为 0；`vue-tsc --noEmit` EXIT=0。

**二、工况画布连线：单击高亮 / 双击删除 + 编号同步高亮 + 同编号只显示一次**

- 连线规则由「单击即删除」改为**单击高亮（再点一次取消）、双击删除**（`CaseFrameCanvas.vue`）；`EdgeLayer.vue` / `GraphCanvas.vue`（主序列图组件，当前未被页面引用）同步该规则。
- 高亮时**所属序号徽标一并高亮**（加粗 + 琥珀色 + 外发光）；被合并隐藏的徽标在选中该连线时显示，保证「就地改号」仍可用。
- 同一源接线口的出线若携带相同编号，**只保留一个徽标**（原先同编号在分叉/交叉处显示两次）；编号避让兜底由「一律退回中点」改为「取离已有编号最远的候选点」，消除两个编号 3px 重叠。

**三、连线自动分散（接线口扇形 + 中段错开）**

- 新增 `computeEdgeLayout()`：同一接线口上的 N 条线，落点沿该口上下均匀分开（`PORT_FAN_HALF=10` / `PORT_FAN_STEP=4`），并按「另一端高度」排序，避免在接线口处自交叉。
- 再加一层**中段控制点偏移 `bow`**（`EDGE_BOW_HALF=60` / `EDGE_BOW_STEP=12`）：两端仍吸附接线口，中段被推到各自通道；`bezier()` / `bezierPoint()` 同步带 `bow`，序号徽标仍按曲线定位。
- 实测（工况4，36 条线）：11 条汇进口 5 的中段间距 2~3px → **18~28px**；中段平行重叠线对（<4px）4 → 1（P10 19.5 → 24.1px）；交叉点数量 42 → **42（未新增）**；徽标离曲线偏差 0px，端点仍在接线口 ±10px 内。剩余 42 处交叉逐对核对全部发生在「无共用接线口」的线之间（如检查卡→结果卡的二分图交叉、注入卡→不同接线口），属拓扑交叉，无法靠走线消除。

**四、卡片在泳道内自由上下摆放（不会重叠）**

- 泳道内卡片原为紧凑堆叠，拖放后的位置会被重排吃掉。新增 `Card.topGap`（卡片上方留白 px，写在工况节点上、随配置保存）：落点换算成留白且**只取正值** → 卡片永远不会互相压住，同时可在泳道内任意留出空档对齐。
- 落点后等 DOM 重排再按实际渲染位置校准一次（顺序变化会让上方卡片整体位移）；跨泳道移动、库卡片拖入同样按鼠标位置插入；复制 / 粘贴不携带原留白。
- 实测：拖到末尾下方 120px → 落点与渲染位置偏差 0px；拖到某卡中间 → 间距 6px、重叠 0；跨泳道移动同样 0 偏差；连线端点与接线口偏差 0px；泳道 / 工况框高度随之增长、无裁切。

**五、用例展开：并列结果全部串联（修复工况4 用例10/11 丢失结果卡）**

- **问题**：`_expand_frame_paths` / `expandFramePaths` 沿结果链前进时**只跟第一条出线**。工况4 的检查卡都是「一卡两结果」（`ADS_Ang_Fault(...)` + `AbortFb = 4, AdsReqErrorFb = 0`），于是用例 10/11（力矩传感器 Sent1/Sent2 断开）只带走了排在前面的 AbortFb 卡，`ADS_Ang_Fault(0,5,0,0)` 被丢掉（用例 1~8 也丢了 AbortFb 卡）。
- **变更**：改为**并列出线全部串联**（深度优先、按泳道从左到右排序，`seen` 防环），后端 `_walk_right` 与前端 `walkRight` 同步。
- 实测：`ADS_Ang_22/23` 结尾补齐 `SignalWaitCheck(lkaAgMgrMode,5,1000)` 等 ADS_Ang_Fault(0,5,0,0) 的步骤；用例总数不变（43 条）。

**六、泳道宽度上限拆分（自适应有上限、手动可突破）**

- 原来自适应与手动拖拽共用 `LANE_MAX_W=560`，手动也被卡住。现拆为 `LANE_MIN_W=160` / `LANE_AUTO_MAX_W=260`（自适应上限）/ `LANE_HARD_MAX_W=2000`（手动硬上限）；`.lane` 的 CSS 值仅首帧兜底。
- 实测：拖 +700px → 1167px（突破自适应上限）、拖 +1900px → 钳到 2000、反向猛拖 → 钳到 160、双击边缘恢复自适应。

**七、工况画布横向平移改为「仅在指针位于横向滚动条上时生效」**

- 撤销「滚轮在宽工况上直接左右平移」的接管行为：滚轮默认只纵向滚动工况；仅当指针停在画布底部横向滚动条（含 10px 余量）时才转为横向平移，横向滚动条保留。
- 判定合并两路信号（`mousemove` 最后位置 + `wheel` 自带坐标），应对「指针压到原生滚动条上收不到 mousemove」。
- 实测：内容区滚轮不拦截（纵向）、滑块判定区滚轮横向平移（scrollLeft 0→120）、距滑块 66px 处不拦截、鼠标移出后不拦截、触控板横滑（deltaX 主导）不拦截、已到最右端不拦截。

**相关文件**：
- `frontend/src/components/graph/CaseFrameCanvas.vue`
- `frontend/src/components/graph/FunctionGraphEditor.vue`
- `frontend/src/components/graph/EdgeLayer.vue`
- `frontend/src/components/graph/GraphCanvas.vue`
- `frontend/src/utils/functionGraph.ts`
- `frontend/src/types/functionGraph.ts`
- `backend/services/function_graph.py`

**发布状态**：已发布到共享盘（version 1.0.7）

---

## [1.0.6] - 2026-09-17

**版本号**：`1.0.6`（`frontend/package.json` 的 `version`）

**安装包**：`#Excel2Case#V1.0.00 Setup 1.0.6.exe`（155,757,210 字节，SHA256 `FDD6CD941870FB046374AD0366BC96DF7762B174F8696ECD47454571EB62DCD0`）

**共享盘路径**：`\\172.28.4.125\装机工作软件\工具软件\Excel2Case`

**更新配置**（`version.json`）：
```json
{
  "version": "1.0.6",
  "release_notes": "优化：\n- 配置保存改为只写本地，新增「拉取/推送」：可勾选（多选/全选）具体配置项，从共享盘拉取或推送到共享盘\n- 新增统一快捷键层并收敛按键冲突：Ctrl+S 保存、Ctrl+Enter 生成、Ctrl+1~6 切换模块、Ctrl+F 聚焦搜索，并补齐新增/删除/上下移/重命名等条目快捷键\n- 工况画布：卡片新增拖拽手柄，支持 Ctrl+C/V 与 Ctrl+拖拽（可多选）复制卡片与泳道，新增撤销/重做（Ctrl+Z）\n- 卡片参数化：就地「提为参数」（自动命名、空值也可提）、卡片声明区支持参数（接口）、函数库可直接拖到工况生成卡片\n- CAN 报文信号表：新增「树形图 + 分组表格」双视图，Excel 式框选/复制粘贴/拖拽填充，列宽拖拽与列设置，单元格操作提速，新增 Ctrl+Z 撤销\n- CAN 新增「其他配置」Signal_InvalidValue 卡片，以及「导出为 Excel」（三张矩阵表，可再导入还原）\n- Function：图形化配置按分组隔离、分组用例支持导入用例/导出 Excel、用例号由主序列两侧接线口共同定义、工况框连线校验提示\n- CANCase.xml 改为「一个用例分组一个 testgroup」\n\n修复：\n- 修复保存配置时把多余的 name 字段写入本地文件与共享盘\n- 修复部分测试参数（FactorTest 等）配置后保存不上、DBC 导入/重载后丢失\n- 修复远程并集合并导致同一分组重复（LDW 用例数 20 → 40）\n- 修复「先加载配置再导入 DBC」后测试参数丢失\n- 修复泳道过多时溢出工况框；修复工况比可视区宽时右侧泳道里的卡片拖不动（滚轮改为横向滚动）\n- 修复报文信号表「选择单元格很慢」（单击一次约 250ms）\n- 补齐缺失的用例生成路径（BusOff / ExtendFrame / RemoteFrame / DLC less / greater 等必需用例）\n- 修复卡片参数 {{占位符}} 泄漏到生成的 CAPL",
  "setup_name": "#Excel2Case#V1.0.00 Setup 1.0.6.exe"
}
```

**说明**：本版本汇总了上一正式版（1.0.5）之后累积的全部 32 条会话更新记录，以下条目均随本版本一并发布。

### [1.0.6] - 2026-09-17

**会话主题**：修复「先加载配置再导入 DBC」后测试参数丢失

**问题**：在 CAN 模块中，先选择配置（如 `E262S无刷`，其 DBC 内 EPS 信号保存了 `et` 如 `E2E_CRC` / `CRC_CheckSum`、FactorTest 变量、DTC 等），随后导入新的 `.dbc` 时，树形图里的这些测试参数会丢失。

**原因**：导入 DBC 的上传处理调用 `buildSignalRowsFromRaw`，该函数无条件用 `testParamMap.value = newMap` 以新 DBC 自动识别结果为整表覆盖，导致已加载配置保存的参数（EPS `et`、FactorTest 变量、DTC 等）被清空。

**变更**（`frontend/src/views/CANView.vue`）：
- 导入 DBC 时改为**合并**而非覆盖：已有配置参数全量保留；仅对无配置记录的键采用新 DBC 自动匹配结果。
- 重叠键按「配置优先」合并，并跳过 EPS 类型重复卡片（配置 `et` 与自动识别算法二选一），避免同信号出现两张 EPS 卡。
- 验证数据：配置 `E262S无刷` 的 `Msg_1E5:::x1E5_Checksum_1E5` 保存 `et=CRC_CheckSum`，导入的 `E262S.dbc` 含同名 EPS 信号，合并后该 `eps` 参数保留。

**相关文件**：
- `frontend/src/views/CANView.vue`

**发布状态**：已发布到共享盘（version 1.0.6）

---

### [1.0.6] - 2026-09-17

**会话主题**：CAN 配置新增「导出为 Excel」功能（三张矩阵表，可再导入还原）

**功能**：CAN 模块配置工具栏新增「导出Excel」按钮，把当前配置导出为与导入格式一致的 `.xlsx`，导出文件可再通过「导入」还原配置。

**变更内容**：
- **导出内容**（三张矩阵表）：
  - `DBC Canmatrix`：报文/信号矩阵表，列格式与后端 `_parse_dbc_file` 输出一致（30 列），并追加 `Test` / `MsgTest` 两列以保留报文/信号的勾选（测试）状态；
  - `DTC`：DTC 表，原样输出配置中的 `{columns, rows}`；
  - `DataLinkLayer`：链路层表，原样输出配置中的 `{columns, rows}`（配置无该节时不生成）。
- **新增后端服务** `backend/services/can_config_excel.py`：`export_config_xlsx()` 把配置的嵌套字典 `{sender: {msg: {..., signals: {...}}}}` 按信号展开为矩阵行（报文级字段随行重复；无信号的报文保留一行空信号行）；信号级 `DTC` 从 `tp` 取（`SigInvalidTest` / `SigvalueInvalidTest` / `FactorTest`），`XCP_CCP_varname` 取 `tp.FactorTest.variable`，`GenSigFuncType` 取 `et`。
- **新增接口** `POST /api/can/export-excel`：`save_path` 非空时后端直接写盘（Electron 另存为），为空时返回 base64 由前端触发浏览器下载（Web 兜底）。
- **前端**：`ConfigToolbar` 仅当 `module-name === 'can'` 时显示「导出Excel」按钮并 `emit('export-excel')`；`CANView` 新增 `onExportExcel()`（导出当前编辑态数据 `collectConfigData()`）。
- **修复** `backend/core/can_module.import_excel` 的链路层工作表识别：原判断仅认 `data link` / `dll`，导致工作表名 `DataLinkLayer` 不被识别、DLL 数据导入丢失；现补充 `datalink` 匹配，保证导出文件可再导入。

**验证**（脚本直连服务做往返校验）：
- `E262S无刷`（无 DLL）：导出工作表 `['DBC Canmatrix', 'DTC']`，再导入得 DBC `235 行`、DTC `27 行`；`x1E5_Checksum_1E5` 的 `GenSigFuncType=CRC_CheckSum`、`Test=Y`、`MsgTest=Y` 及各属性完整保留。
- `E22H-A2`（含 DLL）：导出 `['DBC Canmatrix', 'DTC', 'DataLinkLayer']`，再导入三张表全部回落（DBC 235 行 / DTC 27 行 / DLL 23 行，列名一致）。
- HTTP 接口：base64 分支返回 `filename/sheets/content_base64`；`save_path` 分支成功写盘；空 `data` 返回 400。
- `npx vue-tsc --noEmit` 通过（0 错误）。

**相关文件**：
- `backend/services/can_config_excel.py`（新增）
- `backend/api/can_routes.py`
- `backend/core/can_module.py`
- `frontend/src/api/can.ts`
- `frontend/src/components/ConfigToolbar.vue`
- `frontend/src/views/CANView.vue`

**发布状态**：已发布到共享盘（version 1.0.6）

---

### [1.0.6] - 2026-09-17

**会话主题**：修复部分测试参数（FactorTest 等）配置后保存不上、DBC 导入/重载后丢失

**问题**：用户反馈「有些配置参数没有保存上，比如 FactorTest」——在树上给信号配好 `FactorTest`（拖入 A2L 变量）后保存配置，重载或导入 DBC 后该参数消失。

**原因**：`hasParamData()`（判定测试参数「是否已配置」）被复用为**保存门槛**（[buildDbcRawFromSignalRows](frontend/src/views/CANView.vue) 中 `if (p.params && hasParamData(p)) tpObj[p.value] = {...}`）。而 `FactorTest` 的判定除「变量名非空」外，还额外要求 `autoRange === true` 或 `testValues` 非空。因此「只拖入 A2L 变量、尚未填测试值、也没开自动遍历」的 FactorTest 判为未配置 → 既不高亮，写入配置时也被丢弃；同时 [addTestParamToNode](frontend/src/views/CANView.vue) 的「已存在则覆盖」分支也用同一判定，导致这种配置无法覆盖到已存在的自动生成卡片上。

**变更**（`frontend/src/views/CANView.vue`）：
- `hasParamData()` 的 `FactorTest` 分支：**仅要求变量名非空**即视为已配置（回到 CHANGELOG 1.0.2 记录的「变量名非空前置校验」语义），去掉 `autoRange` / `testValues` 的额外要求。
- 新增 `normalizeTestParamPayload()`：测试参数写入配置前归一化——`FactorTest` 有变量名但既未开自动遍历、也无测试值时，按 `autoRange: true` 保存，避免「保存成功但因 `testValues` 为空而不生成任何用例」；`buildDbcRawFromSignalRows()` 的消息/信号三处 `tp` 写入统一走该函数。
- 效果：变量-only 的 FactorTest 现在会高亮（已配置）、保存进配置 `tp`、并可被「已有卡片覆盖更新」流程写入。

**验证**（Playwright 真实浏览器 + 真实 dev server，加载配置 `E262S无刷`）：
- `hasParamData({FactorTest, variable:'X'})` → `true`（修复前为 `false`）；`variable: ''` 仍为 `false`（保持灰色语义不变）。
- `normalizeTestParamPayload({variable:'X', testValues:''})` → `autoRange: true`；有测试值或已开自动遍历时保持原值。
- 在 `Node_120/Msg_120/x120_VehOdo` 上注入「仅变量」的 FactorTest 后调用 `collectConfigData()`：配置 `DBC Canmatrix[Node_120][Msg_120].signals.x120_VehOdo.tp.FactorTest` = `{variable, testValues:'', autoRange:true}` —— **参数已能保存**。
- 随后上传 `E262S.dbc`：该参数在 `testParamMap`（key `Msg_120:::x120_VehOdo`）与树节点中**均保留**，DBC 导入后不丢失。
- `npx vue-tsc --noEmit` 与 `npm run build` 均通过（0 类型错误）。

**相关文件**：
- `frontend/src/views/CANView.vue`

**发布状态**：已发布到共享盘（version 1.0.6）

---

### [1.0.6] - 2026-09-17

**会话主题**：修复远程并集合并导致「同一分组重复」（FUNC_ADS_LDW 出现两次、LDW 用例数 20 → 40）

**问题**：配置 `A47D` 预览里出现两个 `FUNC_ADS_LDW` 分组（id 相同），LDW 显示 **40 条**用例（应为 20 条），合计 48 条。

**原因**（两个独立问题叠加）：
1. **合并语义**：`_deep_merge` 的列表合并是「按 JSON 全等去重后拼接」。本地 `groups=[LDW(电压故障 15 条线), TORQUE]` 与远程 `[LDW(电压故障 13 条线), ADS_Ang]` 合并时，两份 LDW 因内容有差异被判为**不同条目**，于是都被保留 → 同一分组（同 id）出现两次 → 用例数翻倍（20×2=40）。
2. **快照陈旧**：预览在加载配置时直接使用配置内 `test_case_list`（上次生成时写入的快照），不按当前图形配置重算，因此即使图形已变、显示的数字仍是旧值。

**变更**：
- `backend/utils/network_storage.py`：`_deep_merge` 的列表合并改为「按稳定标识（`id`，其次 `name`）合并」——
  - 标识已存在：只补该条目**缺失**的键（`_fill_missing` 递归下探），已存在的键（含工况连线、卡片步骤）一律**保留本地版本**；
  - 标识不存在：追加（远程独有分组/卡片仍能拉进来）；
  - 无标识列表：本地为空才取远程（避免把两个版本的步骤混在一起）。
  新增 `_merge_lists()` / `_fill_missing()` / `_list_id_key()`。
- `frontend/src/views/FunctionView.vue`：加载配置后按当前图形配置**实时展开刷新**预览（新增 `graphHasContent`；图形无内容时保留快照，避免把预览清空），纠正「界面数字与图形不一致」。

**数据修复**（`A47D`，按确认执行）：
- 删除重复的 `FUNC_ADS_LDW`，保留本地那份（卡片库 故障注入 26 / 结果 15 / 序列 10 + 值资源 2）；被删那份的卡片库实为 `ADS_Ang` 的内容（3/4/1，旧配置迁移时被配置级库污染），删除不丢 LDW 数据。
- 重算配置内 `test_case_list` 快照：48 → 28 条（LDW 20 / TORQUE 3 / ADS_Ang 5）。
- 远程共享盘 `Function_configs.json` 中的 `A47D` **本来就没有重复**（仅 2 个分组），未改动。

**验证**：
- `_deep_merge` 单测：同 id 分组只保留一份；本地工况连线不被远程并集（15 条仍为 15 条）；本地缺 `cards` / `valueLibrary` 字段仍由远程补入（原「没拉取到故障注入/工况/检查/序列」场景）；远程独有分组/卡片追加；无名列表本地为空才取远程；合并幂等。
- 配置：3 个分组、合计 28 条（LDW 20、TORQUE 3、ADS_Ang 5）；重算后 `test_case_list` 的字段集与单条 `lines` 与旧快照一致。
- 界面（Playwright 真实加载 `A47D`）：分组 3 个、`FUNC_ADS_LDW` 显示 **20 条**、`pageerror` 为空；前端 `npm run build`、后端 `py_compile` 通过。

**相关文件**：
- `backend/utils/network_storage.py`
- `frontend/src/views/FunctionView.vue`

**发布状态**：已发布到共享盘（version 1.0.6）

---

### [1.0.6] - 2026-09-17

**会话主题**：用例号改为由「主序列两侧接线口」共同定义（只画结果线的编号也成用例）

**问题**：`A47D` / `ADS_Ang` 的「Eps Off->No Active」工况画了 4 号线，却只生成 3 条用例。

**原因**：`_resolve_frame_numbers` 的用例号 `case_nums` **只由入口连线（卡片 → 主序列，即注入）推导**；4 号线只有出口连线（主序列 → 结果卡片），没有对应的注入线，编号 4 不成用例，该连线被静默忽略。同时前端镜像 [resolveFrameNumbers](frontend/src/utils/functionGraph.ts) 也有同样逻辑，会导致画布标签与生成结果不一致。

**变更**（前后端镜像同步）：
- `backend/services/function_graph.py`：`_resolve_frame_numbers` 在入口线编号之后并入**出口连线的编号**（`case_nums = 入口编号 ∪ 出口编号`，升序去重）。某编号只画了「结果」时，生成「无注入：整条主序列 + 该结果卡片」的用例。
- `frontend/src/utils/functionGraph.ts`：`resolveFrameNumbers` 加同一逻辑（保证画布编号标签与生成一致）。

**已确认的排序规则**（原有 `_lane_node_order` = (泳道序号, 泳道内序号) 已按此语义实现，本次用合成工况框回归验证）：
- 左侧不同泳道插入主序列时，**靠左的泳道优先**（与节点在泳道内的上下位置无关）；
- 同一泳道的多个卡片连到右侧同一连线口时，**靠上的卡片优先**。

**数据更新**（`A47D`）：`test_case_list` 快照重算 28 → 29 条（ADS_Ang 5 → 6）。

**验证**：
- `ADS_Ang`「Eps Off->No Active」`case_nums = [1, 2, 3, 4]`、路径 4 条；第 4 条 = 整条主序列 + 右侧 `ADS_Ang_NotActive` 检查卡片（19 行 CAPL）。
- 回归：LDW 8 个工况用例数（2/1/1/2/2/4/4/4）与 TORQUE 均与修复前完全一致；合计 29 条（LDW 20 / TORQUE 3 / ADS_Ang 6）。
- 排序规则合成用例：左侧泳道互换后顺序仍按靠左优先；同泳道上下互换后顺序仍按靠上优先；左右混合时为 `[inL0, inL1, outR0, outR1_top, outR1_bottom]`。
- 界面（Playwright 真实加载 `A47D`）：预览 ADS_Ang 显示 **6 条**（含 `ADS_Ang_6` 19 行）；图形配置画布连线标签集合含 `4`；`pageerror` 为空；`npm run build`、`py_compile` 通过。

**相关文件**：
- `backend/services/function_graph.py`
- `frontend/src/utils/functionGraph.ts`

**发布状态**：已发布到共享盘（version 1.0.6）

---

### [1.0.6] - 2026-09-17

**会话主题**：工况框连线校验提示（悬空连线 / 孤立卡片）

**问题**：端点卡片被删除、或序列接线口越界的连线，在画布上**画不出来**（端口定位失败直接跳过绘制），也不参与用例展开，属于静默失效；孤立卡片（无连线或整条链没接主序列）同样不会出现在任何用例里。此前只能靠「用例数对不上」反推。

**变更**：
- `frontend/src/utils/functionGraph.ts`：新增 `frameDiagnostics(frame)`（含 `FrameIssue` / `FrameDiagnostics` 类型），返回该工况的问题清单与两类 id 集合：
  - `dangling-edge` 悬空连线：端口 key 指向已删除的卡片/序列，或 `seq:<id>:<idx>` 接线口越界（idx 超出步骤数）；
  - `orphan-node` 孤立卡片：一条连线都没有；
  - `floating-node` 悬浮卡片：有连线但所在连通分量未接入主序列；
  - `no-sequence` / `empty-sequence`：缺主序列或主序列无步骤（完全空白的工况不提示）。
- `frontend/src/components/graph/CaseFrameCanvas.vue`：
  - 工况头在有问题时显示琥珀色徽标「⚠ N 处待修正」，悬停用 tooltip 列出每条明细（端口/卡片名 + 原因）；
  - 异常卡片加 `node-invalid` 样式 + 名称前 `⚠`（title 显示原因）；
  - 工况底部新增悬空连线清单（显示「端点 → 端点」与原因），每条带 `✕` 可一键删除，便于清理历史残留。

**验证**：
- 真实配置 `A47D`：校验 19 个工况（分组内 11 个 + 根级兼容副本 8 个），**只有** `LDW_电压故障` 命中 1 条悬空连线（`已删除卡片(node-mtwr3xg5-d0fih) → LDWlevel_high`），其余工况零误报；`LDW_非工作车速`（1 节点 0 连线，主序列本身）未被误判为孤立卡片。
- 合成用例 6/6 通过：无连线→孤立卡片、正常接入→无问题、端点卡片已删除→悬空+孤立、接线口越界→悬空+孤立、A→B 互连但未接主序列→2 个悬浮卡片、主序列为空→空序列+悬空+孤立。
- 界面（Playwright 真实加载 `A47D` 并打开图形配置）：8 个 LDW 工况中仅 `LDW_电压故障` 出现「⚠ 1 处待修正」，tooltip 显示 `已删除卡片(node-mtwr3xg5-d0fih) → LDWlevel_high：卡片已删除`，工况底部列出该连线与删除按钮；其余 7 个工况仅显示绿色「展开 N 条用例」；`node-invalid` 卡片数 0；浏览器 console 无报错；`npm run build`（vue-tsc 类型检查）通过。

**相关文件**：
- `frontend/src/utils/functionGraph.ts`
- `frontend/src/components/graph/CaseFrameCanvas.vue`

**发布状态**：已发布到共享盘（version 1.0.6）

---

### [1.0.6] - 2026-09-17

**会话主题**：函数库支持直接拖拽到工况生成卡片

**问题**：函数库面板的拖拽载荷是 `application/x-mm-func`，其消费者 `MindMapCanvas.vue` 早已废弃（全项目无引用），所以拖了没有任何反应；工况画布只认 `application/x-graph-card`（卡片库格式）。

**变更**：
- `frontend/src/components/FunctionLibrary.vue`：拖拽时**增写** `application/x-func-card`（卡片 JSON），与 `application/x-mm-func` 并存；新增 `funcToCard(fn)`——卡片名取函数名，内容为单步「函数调用该函数」，函数参数作为待填的步骤参数（`args[].key` 为参数名、`value` 留空）。按需求**不隐式追加 Wait 步骤**，**统一归类为「故障注入」**（类型/恢复标记可在卡片编辑器里改）。
- `frontend/src/types/functionGraph.ts`：新增 `FUNC_CARD_MIME = 'application/x-func-card'`。
- `frontend/src/components/graph/CaseFrameCanvas.vue`：`parseCard` / `onWindowDragStart` / `onZoneOver` 一并识别 `x-func-card`（`parseCard` 优先读 `FUNC_CARD_MIME`，再回退 `x-graph-card`），拖入时正常显示泳道停靠区；另外，拖到**主序列泳道**被拒时改为明确提示（原来是静默什么都不发生）。
- `frontend/src/components/graph/FunctionGraphEditor.vue`：函数库面板帮助文案改为「拖拽函数卡片到工况直接生成卡片，拖到步骤列表则生成函数调用步骤」。

**为什么用独立类型而不是复用 `x-graph-card`**：`StepEditor.onListDrop` 会**优先**把 `x-graph-card` 当作「卡片引用」处理，若复用会把函数拖拽误判成引用一张不存在的卡片、生成坏步骤。用独立类型后步骤编辑器行为完全不变（仍走 `x-mm-func` 生成函数调用步骤）。

**验证**（Playwright 真实拖拽 `A47D`）：
- 载荷自检：拖拽函数卡片时 types 为 `application/x-mm-func` + `application/x-func-card` + `text/plain`，**不含** `x-graph-card`；卡片 JSON 为 `type: inject`、`refId: ""`、单步 `kind: call / fun: VoltSet / args: [{key:'index',value:''}]`。
- 拖入已有「其它」泳道：节点新增成功，名称 `VoltSet`，class 含 `n-inject`（按需求归为故障注入）；节点上**没有** `⛓` 引用标记（`refId: ""` 生效）；双击打开卡片编辑器确认「类型=故障注入、1 个函数调用步骤、无 Wait」。
- 拖到泳道之间的停靠区：该工况泳道数 3 → 4（新建泳道成功），总工况数不变（未误触发「画布空白处新建工况」）。
- 拖到主序列泳道：弹出提示「主序列泳道只放「序列」卡片；函数/注入/检查类卡片请拖到其它泳道，或拖到泳道之间新建泳道」，泳道数不变（不再静默失败）。
- 浏览器 console 无报错；`npm run build`（vue-tsc 类型检查）通过。
- 已知限制（非本次引入）：泳道停靠区宽 26px，若正好被连线序号徽标压住，落点会落到 `.edge-label` 并冒泡到画布 → 变成新建工况；停在停靠区上/下半段即可避开。

**相关文件**：
- `frontend/src/components/FunctionLibrary.vue`
- `frontend/src/components/graph/CaseFrameCanvas.vue`
- `frontend/src/components/graph/FunctionGraphEditor.vue`
- `frontend/src/types/functionGraph.ts`

**发布状态**：已发布到共享盘（version 1.0.6）

---

### [1.0.6] - 2026-09-17

**会话主题**：CAN 报文信号表新增「树形图 + 分组表格」双视图（对照 Excel 矩阵配置），并移除新增的 Vehicle_Speed / Fault_Led / Fault_Warning 配置字段

#### Part A：双视图 + 按报文分组表格

**问题**：DBC 页签主体是树形图，属性以**子节点**呈现，必须逐条展开才能看到「无效值 / Data_Type / Signal_Type / 精度 / 最小最大值…」，无法按列对齐比较，也不好对照 Excel 通信矩阵；同时发现两个既有缺陷：① 树上**双击属性编辑不落库**（只改属性子节点自身 `value`，没有任何地方同步回 `sigNode.fields`）；② 树上**没有「测试」勾选**（`el-tree` 未配 `show-checkbox`，`onTreeCheckChange` 已定义但未绑定），无法切换 `lk`。

**变更**：
- 新增组件 `frontend/src/components/DbcSignalTable.vue`（+ 类型 `frontend/src/types/dbcTable.ts`）：
  - `el-table` + `tree-props` 按**报文一级分组**（报文行作父行、信号作子行），发送节点退化为列；默认全部展开，支持全部展开/折叠；
  - 列对照 Excel 通信矩阵：发送节点 / 报文（名称·标识符·类型·发送类型·周期·快速周期·快速发送次数·长度·lostDTC·dlcDTC）/ 信号（名称·无效值·Data_Type·Signal_Type·DTC·精度·偏移量·物理最小最大值·初始值·单位·值描述·排列格式·起始字节·起始位·位长度·XCP 变量）/ 测试参数 / 测试，共 30 列；
  - **列设置**：显隐 + 上下移调整顺序 + 恢复默认，持久化到 `localStorage`；
  - **内联编辑**：双击单元格编辑，Enter/blur 提交（`msgName`/`signalName`/`DTC` 及信号行上的报文级列设为只读，避免破坏参数映射或误改整条报文）；
  - **Excel 式框选与复制粘贴**：鼠标拖拽矩形选区、`Ctrl+C` 输出 TSV、`Ctrl+V` 按可见列顺序循环平铺填充（只写可编辑列）、`Delete` 清空；
  - **「测试」列**：自定义 checkbox 直接绑定 `node.checked`（报文/信号独立，不级联）；配合 `el-table` 多选列 + 工具栏「标记测试 / 取消测试」实现显式批量；
  - 测试参数沿用现有「标签 + 下方详情面板」交互（点击选中、拖拽填充、× 删除），拖拽落点支持从对象浏览器拖入 测试参数卡片 / DTC / A2L 变量 / 信号 / 属性；
  - 保留「新增 / 差异」黄色高亮（`getDbChangeMark`）。
- `frontend/src/views/CANView.vue`：
  - 新增 `dbcViewMode`（**默认表格**，`localStorage` 记忆）、`dbcTableColumns`、`dbcTableRows`（兼容「配置加载：信号在 message.children」与「DBC 导入：信号与报文平级」两种树布局）、`filteredDbcTableRows`（报文命中保留其全部信号，否则只保留命中信号行）；
  - 新增 `setNodeField` / `syncAttrNodeValue`：按列路径写入 `fields.*` / `msg.*` 并同步属性子节点显示值；
  - **修复树属性编辑落库**：`finishAttrEdit` 用 `parentType/parentMsg/parentSignal` 定位父节点后写回 `node.fields` / `node.msg`；
  - `startByte` 补入保存映射（`sigData.sbyte`）与读取映射（`buildTreeFromDict` 的 `fields.startByte` 与「起始字节」属性行）；
  - 新增 `applyPayloadToTreeNode`（DTC → 已有测试参数的 `dtc`；A2L → `FactorTest.params.variable`；属性/信号 → 对应字段）、`batchSetTest`、`onDbcTableDrop`、`onDbcTableRowSelect`；
  - DBC 页签头部新增「树形图 / 表格」切换；「添加信号」「全部展开 / 全部折叠」仅在树视图显示，表格视图用组件自带工具条。
- `DbcSignalTable.vue` 中单元格 `mousedown` 聚焦容器改用 `focus({ preventScroll: true })`，避免点击单元格时视图滚动导致点击落到别的行。

**验证**（Playwright 真实浏览器加载配置 `E262S无刷`，dev server + 后端）：
- 默认进入**表格**视图（切换入口存在、树未渲染）；分组行数 = 报文 **11** + 信号 **103**（DOM 行 114），列 30；
- 双击「物理最大值」改为 `4321` → `collectConfigData()` 中 `signals[x1E5_Checksum_1E5].mx = "4321"`，用该 payload 走 `buildTreeFromDict` 回读仍为 `4321`（**落库 + 可回读**）；
- 「测试」列勾选 → `node.checked` 与保存 payload 的 `lk` 同步翻转（`true → false`）；多选 2 行 + 「取消测试」→ 两行均置为未勾选；
- 点击非 EPS 信号的 `SigvalueInvalidTest` 标签 → 下方详情面板打开且 `selectedTestParamKey` 正确；EPS 信号仅 EPS 类型参数时不打开面板（符合设计）；
- 列设置隐藏「报文长度」→ 表头 30 → 29 列且不再包含该项；
- 搜索 `x1E5` → 保留 1 个报文行 + 14 个命中信号行；
- 框选 2 列后 `Ctrl+C` 得到 TSV（`"\tunsigned"`）；向另一行写入带标记的剪贴板 `P1\tP2` 后 `Ctrl+V` → 该行 `invalidValue=P1`、`dataType=P2`（**块粘贴生效**）；
- 拖拽：测试参数卡片拖到行 → 参数新增/覆盖；DTC 拖到标签 → `dtc=0x123`；A2L 变量拖到 `FactorTest` 标签 → `variable=sysvar::XCP::T::Grp::Var_A`；
- 切到树形图 → 树正常渲染（122 个节点）；刷新后仍停在树形图（记忆生效）；树视图下编辑「排列格式」属性行 → 父节点 `fields.byteOrder` 与保存 payload 同步为 `Intel Lsb`（**修复属性编辑不落库**）；
- `pageerror` 为空（仅存在既有的 ECharts `title` 未注册警告）；`npx vue-tsc --noEmit` 与 `npm run build` 通过。

#### Part B：移除 Vehicle_Speed / Fault_Led / Fault_Warning

**背景**：这三个是后加入的「配置参数」字段，用于 DTC 表特殊判定（DTC 表第 5 列起的检测对象列若等于这些信号名，生成 `SignalWaitCheck(obj, …, 10000)` 而非 `SignalCheck`）。经确认需要移除。

**变更**（前后端必须同步，`excel_processor` 原先用 `self.config_data['vehicleSpeed']` 直接下标访问）：
- `frontend/src/views/CANView.vue`：删除 `configFieldDefs` 中三条字段定义；
- `backend/core/can_module.py`：删除 `get_default_config_page_data` 三条默认值与 `get_config_key_map` 三条映射；
- `backend/processors/excel_processor.py`：删除 `process_dtc_sheet` 中三条 `elif obj == self.config_data[...]` 分支，保留 `torqueLimit`（7000）分支。

**验证**：
- 全仓库已无 `vehicleSpeed / faultLed / faultWarning / Vehicle_Speed / Fault_Led / Fault_Warning` 引用；`torqueLimit` 保留；
- 抽取文件中真实的 DTC 分支代码段执行：DTC 列 `[Torque_limit, Vehicle_speed, Fault_warning, Fault_led]`，配置中残留这三个 key 时，仅 `Torque_limit` 走 `SignalWaitCheck(...,7000)`，其余三个一律 `SignalCheck(...)`，**不再出现 `10000` 等待时间**；配置中无这些 key 时也不报 `KeyError`（原先直接下标访问存在 KeyError 风险）；
- `py_compile` 通过。

#### 遗留问题（本次发现，未修改，建议另开任务）

1. 配置 `E262S无刷` 的 `DTC` 表**数据不一致**（`columns` 10 列，但 36 行每行只有 7 个值），导致后端 `pd.DataFrame(rows, columns=cols)` 抛 `10 columns passed, passed data had 7 columns`，该配置**无法生成**。属配置历史数据问题（其余 17 个配置均一致）。
2. 生成 `T1V` 时报 `module 'backend.templates.capl' has no attribute 'testcase_11ResetTxMsgAttribute'`（模板缺少该属性，与本次改动无关）。

**相关文件**：
- `frontend/src/components/DbcSignalTable.vue`（新增）
- `frontend/src/types/dbcTable.ts`（新增）
- `frontend/src/views/CANView.vue`
- `backend/core/can_module.py`
- `backend/processors/excel_processor.py`

**发布状态**：已发布到共享盘（version 1.0.6）

---

### [1.0.6] - 2026-09-17

**会话主题**：CAN 报文信号表（表格视图）铺满 DBC 页面

**问题**：表格视图此前沿用树形图的固定高度（`dbcHeight` 默认 560px），下方留大片空白，没有铺满 DBC 页签。

**变更**：
- 表格高度改为**随容器自适应**：`DbcSignalTable` 去掉外部传入的 `height` prop，改用 `ResizeObserver` 监视自身容器，`el-table` 高度 = 容器高度 − 工具条高度；组件根节点改为 `height: 100%` 的 flex 列（工具条固定、表格占满剩余）。
- `CANView` 高度链路贯通：新增 `.can-content.fill-height`（仅 `activeTab === 'dbc' && dbcViewMode === 'table'` 时生效），并逐级下发 `height: 100%`：
  `can-content`（flex 列）→ `can-sub-tabs`（flex:1）→ `el-tab-pane` → `sub-page` → `dbc-table-main`（flex:1）。
  该规则必须给 `can-content`**确定高度**（`calc(100vh - header - tab - 100px)`，与原有 `min-height` 同值）而非仅 `min-height`，否则 `height:100%` 会退化成内容高度——打开测试参数详情面板时会撑高整页，而不是让表格让出空间。
- 表格视图下分隔条（`ResizableSplitter`）改为只调整详情面板高度（复用原未使用的 `onTestParamPanelDrag`），表格自动让位/回收；树形图视图不受影响（仍用原 `dbcTreeHeight` 固定高度 + 滚动）。

**验证**（Playwright 真实浏览器，配置 `E262S无刷`）：
- 视口 1600×900：卡片 700 / 表格容器 573 / `el-table` 487，卡片底部仅剩 20px 内边距（即铺满）；
- 视口 1600×1200：卡片 1000 / 表格容器 873 / `el-table` 787 —— **高度随视口自适应增长**（不再固定 560）；
- 打开测试参数详情面板：卡片高度保持 1000（**不再撑高页面**），表格 873 → 632 让位给面板，表格内部滚动正常（`el-scrollbar__wrap` client 473 / scroll 5705）；
- 切回树形图：`fill-height` 移除，树恢复固定高度 560，布局不受影响；
- 新高度下回归：双击「物理最大值」命中正确行（`s11`）并保存为 `4321`；框选 2 列 + `Ctrl+C` 得到 TSV（`"\tunsigned"`）；`pageerror` 为空；
- `npx vue-tsc --noEmit` 与 `npm run build` 通过。

**相关文件**：
- `frontend/src/components/DbcSignalTable.vue`
- `frontend/src/views/CANView.vue`

**发布状态**：已发布到共享盘（version 1.0.6）

---

### [1.0.6] - 2026-09-17

**会话主题**：表格视图列收敛为通信矩阵原样列（Test + 14 列 + 测试参数）

**需求**：表格仅显示通信矩阵的 `Test` 与 `发送节点 / 报文名称 / 报文类型 / 报文标识符 / 报文周期时间 / 报文长度 / 信号名称 / 精度 / 偏移量 / 物理最小值 / 物理最大值 / 初始值 / 无效值 / 信号值描述`，外加「测试参数」。

**变更**：
- `frontend/src/views/CANView.vue`：`dbcTableColumns` 收敛为上述 **16 列**（顺序按通信矩阵：`Test` 在最左，`测试参数` 在最右），删除 `报文发送类型 / 快速周期 / 快速发送次数 / lostDTC / dlcDTC / 数据类型 / Signal_Type / DTC / 单位 / 排列格式 / 起始字节 / 起始位 / 位长度 / XCP_CCP_varname` 共 14 列；`报文类型` 与 `信号值描述` 改为默认可见（原先默认隐藏）；`测试` 列标题改为与矩阵一致的 `Test`。
- 这两列以外的字段仍可在**树形图**里双击属性编辑，表格只做矩阵所需的聚焦展示。
- **修复两个取值错位**（此前 `path: 'name'` 在两类行上取的是自身 `name`）：
  - `报文名称` 列改为取 `msg.msgName`，信号行不再错显信号名；
  - 信号级列在报文行上留空（`getCellText` 增加 `scope === 'sig' && row.kind === 'message'` 判空），报文行不再错显报文名。
- `frontend/src/components/DbcSignalTable.vue`：列显隐/顺序的 localStorage key 升为 `canview_dbc_table_columns_v2`，避免旧缓存里已被删除的列把新列序打乱。

**验证**（Playwright 真实浏览器，配置 `E262S无刷`）：
- 表头与期望**完全一致**（`["Test","发送节点","报文名称","报文类型","报文标识符","报文周期时间","报文长度","信号名称","精度","偏移量","物理最小值","物理最大值","初始值","无效值","信号值描述","测试参数"]`），无缺列/多列；
- 报文行 `Msg_1E5`：`发送节点=EPS`、`报文名称=Msg_1E5`、`报文标识符=0x1E5`、`周期=10`、`长度=8`，信号级列全部为空（修复后）；
- 信号行 `x1E5_Checksum_1E5`：`报文名称=Msg_1E5`（修复前错显信号名）、`信号名称=x1E5_Checksum_1E5`、`精度=1`、`偏移量=0`、`最小=0.0`、`最大=255.0`、`初始值=0.0`、`测试参数=CRC_CheckSum`；
- 所有行单元格数均为 **16**（列数一致）；`pageerror` 为空；
- `npx vue-tsc --noEmit` 与 `npm run build` 通过。

> 说明：`报文类型 / 无效值 / 信号值描述` 在该配置里显示为空，属**数据本身为空**（配置未保存 `mt`、DBC 的 `无效值` 列为空），非列或取值问题。

**相关文件**：
- `frontend/src/views/CANView.vue`
- `frontend/src/components/DbcSignalTable.vue`

**发布状态**：已发布到共享盘（version 1.0.6）

---

### [1.0.6] - 2026-09-17

**会话主题**：测试参数重新分配（CRC/Counter 独立成卡、SigvalueInvalid 并入 SigInvalid 滑块）+ 测试参数随单元格复制粘贴

#### 一、参数模型重构

**需求**：把 `SigInvalidTest` 拆成 `CRCTest` / `CounterTest` / `SigInvalidTest`；把 `SigvalueInvalidTest` 并入 `SigInvalidTest`，做成类似原来的滑块（`SigInvalid` / `SigvalueInvalid`）。

**新模型**（信号级）：
| 参数 | 参数体 | 已配置判定 |
| --- | --- | --- |
| `CRCTest` | `{ dtcValue:'2', noDtcValue:'1', dtc }`（报/不报值后台写死） | 仅 `dtc` 非空 |
| `CounterTest` | `{ dtcValue:'1', noDtcValue:'0', dtc }` | 仅 `dtc` 非空 |
| `SigInvalidTest` | `{ invalidType:'SigInvalid'\|'SigvalueInvalid', dtcValue, noDtcValue, dtc }` | 三者均非空 |
| `FactorTest` | 不变 | 变量名非空 |

**变更**：
- 前端 `frontend/src/views/CANView.vue`：
  - `sigTestParamList` 改为 `CRCTest / CounterTest / SigInvalidTest / FactorTest`；`getDefaultParams`、`buildAutoSigTestParams`（CRC→CRCTest、Counter→CounterTest、布尔型与无效值→SigInvalidTest，0x 非法值自动选 `SigvalueInvalid`）、`hasParamData`（CRC/Counter 只看 DTC；SigInvalidTest 三种值都要）、`DTC_PARAM_VALUES`、`autoMatchMissingParams`（按「是否已有 CRCTest/CounterTest/SigInvalidTest 之一」补全）、`onTestParamsChange`、详情面板与「卡片配置」弹窗（滑块选项改为 `SigInvalid` / `SigvalueInvalid`）。
  - 新增 `migrateParamList()`：读取旧配置 / 粘贴旧数据时把旧模型迁移到新模型（`SigInvalidTest(invalidType=CRC|Counter|Signal)`、`SigvalueInvalidTest`），接入 `buildTreeFromDict`、`buildSignalRowsFromRaw` 的 dict 分支与粘贴入参。
- 前端 `frontend/src/components/ObjectPanel.vue`：新增 `CRCTest` / `CounterTest` 卡片说明，更新 `SigInvalidTest` 说明。
- 后端 `backend/processors/excel_processor.py`：
  - 新增 `_normalize_sig_tp()` 静态方法（旧模型 → 新模型，幂等，同类型保留先出现的）；
  - dict 路径 `_gen_rx_sig_testcases` 与 DataFrame 路径 `_generate_Rxsignal_testcases` 均先归一化再分派（CRCTest→CRC 三连、CounterTest→计数器、SigInvalidTest 按 `invalidType` 走信号无效 / 信号值无效）；DataFrame 路径同时兼容 `test_params_map` 的 dict / list 两种存放形态；
  - 信号 DTC 提取（`_process_dbc_from_dict`、`_build_signal_row`）与 EPS 的 CRC/Counter 回退（Tx 路径）补上 `CRCTest` / `CounterTest`。

**兼容性**：实测 18 个配置共 384 个 `SigInvalidTest`（invalidType: CRC 90 / Counter 89 / Signal 205）+ 27 个 `SigvalueInvalidTest`，**不存在同一信号两种无效值参数并存**，因此迁移无歧义；旧配置的 `tp` 在读取（前端）与生成（后端）两侧都会被归一化，`et`（EPS 类型）不受影响。

#### 二、测试参数随单元格复制/粘贴

- `DbcSignalTable.vue`：新增 `serializeParams` prop 与 `apply-params` 事件；「测试参数」列的 `getCellText` 返回序列化 JSON → 复制（`Ctrl+C` / 框选区域）会带上参数；粘贴（`Ctrl+V`）落到该列时整格替换（支持循环平铺）；同时允许「测试参数」列参与框选（「测试」勾选列仍不参与）。
- `CANView.vue`：新增 `serializeParamsForCell()`（无参数返回空串）与 `applyParamsFromCell()`（解析 JSON → 迁移 → 整体替换该节点测试参数；空文本=清空；参数被替换时关闭对应详情面板）。

**验证**（Playwright 真实浏览器 + 后端真实代码）：
- 迁移：加载 `E262S无刷` 后树中参数分布 `SigInvalidTest 21 / CRCTest 5 / CounterTest 5`（EPS `eps:CRC_CheckSum 3`、`eps:Counter 3` 不变），**残留旧模型 0 条**；具体样本：`x13D_Checksum_13D` → `CRCTest{dct:D43783}`、`x13D_Counter_13D` → `CounterTest`、`x201_VehSpdAvgDrvnVHCU` → `SigInvalidTest(invalidType=SigInvalid)`、`x120_VehOdoV` → `SigInvalidTest(invalidType=SigvalueInvalid)`（原 `SigvalueInvalidTest`）。
- 详情面板：`CRCTest` 仅 1 个「DTC」输入、无滑块；`SigInvalidTest` 为「报DTC的值 / 不报DTC的值 / DTC」+ 滑块 `SigInvalid` / `SigvalueInvalid`。
- 保存 payload：`tp` 使用新 key（`CRCTest` / `CounterTest` / `SigInvalidTest` 带 `invalidType`），无 `SigvalueInvalidTest`、无 `invalidType: CRC/Counter/Signal`。
- 复制粘贴：复制 `x13D_Checksum_13D` 的测试参数单元格得到 `[{"value":"CRCTest",...,"dtc":"D43783"}]`；粘贴到 `x120_VehOdoV` 后其参数由 `SigInvalidTest(SigvalueInvalid)` 变为 `CRCTest(dtc=D43783)`。
- 后端 `_normalize_sig_tp`（真实静态方法）：旧 CRC→CRCTest、旧 Counter→CounterTest、旧 Signal→SigInvalid、旧 SigvalueInvalidTest→SigInvalid(SigvalueInvalid)、新值幂等、混合场景各自保留。
- 前端自动匹配：CRC 信号→`CRCTest`、Counter→`CounterTest`、0/1 布尔→`SigInvalidTest(SigInvalid)`、`0xFF`→`SigInvalidTest(SigvalueInvalid)`、十进制无效值→`SigInvalidTest(SigInvalid)`、EPS CRC→`CRC(eps)` 不变。
- `pageerror` 为空；`npx vue-tsc --noEmit`、`npm run build`、`py_compile` 通过。

> 已知观察（本次未改动，行为与改造前一致）：生成侧取「报/不报 DTC 的值」时读的是 `testValues` / `invalidValue`，再回退到信号自身的 `invalid_value`，并不直接使用前端参数体里的 `dtcValue` / `noDtcValue`。即这两个输入框目前只影响界面判定（是否算已配置），不影响生成出来的取值来源；如需让其真正驱动生成，建议另开任务评估（会改变现有配置的生成结果）。

**相关文件**：
- `frontend/src/views/CANView.vue`
- `frontend/src/components/DbcSignalTable.vue`
- `frontend/src/components/ObjectPanel.vue`
- `backend/processors/excel_processor.py`

**发布状态**：已发布到共享盘（version 1.0.6）

---

### [1.0.6] - 2026-09-17

**会话主题**：报文信号表（DBC 分组表格）交互增强：行色区分、删列与列宽拖拽、块复制粘贴与自动填充、展开折叠按钮共用

#### 一、报文行 / 信号行颜色区分

- `DbcSignalTable.vue`：`cellClassName` 按 `row.kind` 追加 `dst-row-msg` / `dst-row-sig`；样式上报文行用淡蓝底（`rgba(64,158,255,0.07)`）+ 字重 600，信号行透明底 + 字重 400，便于在通信矩阵式表格中区分层级。

#### 二、删除「报文类型」列 + 列宽可自由调整

- `CANView.vue`：`dbcTableColumns` 移除 `msgType`（报文类型），表格列收敛为 `Test` + 通信矩阵 13 列 + `测试参数`，共 15 列。
- `DbcSignalTable.vue`：表头每列右缘新增拖拽手柄 `.dst-col-resizer`（`cursor: col-resize`，60px 下限），`startColResize / onColResizeMove / endColResize` 计算宽度后 `emit('column-resize')`。
- `CANView.vue`：新增列状态管理（`DBC_TABLE_COLUMNS_KEY = canview_dbc_table_columns_v3`），持久化每列 `visible` 与 `width`；`dbcOrderedColumns`（顺序+显隐+宽度，自动忽略已删列、新列追加末尾）、`dbcTableVisibleColumns`、`onDbcColumnResize`、`moveDbcColumn`、`resetDbcColumns`、`onDbcColumnVisibleChange`。
- 「列设置」弹窗上移到页签头部，复用同一份列状态。

#### 三、单元格自由区块化复制粘贴 + 粘贴自动填充

- `DbcSignalTable.vue`：
  - 去掉数据单元格内 `.cell` 的内边距（改为内边距落在 `.dst-cell-inner`），使**整格（含左右留白）都可点击/框选**，此前点到单元格左缘不会起选。
  - 框选支持鼠标拖拽与 `Shift+点击` 扩展；`Ctrl+C` / `Ctrl+V` 走 TSV，粘贴时源数据作为瓦片在目标区域**循环平铺**（与 Excel 一致）；`Delete` 清空选区。
  - 新增自动填充柄 `.dst-fill-handle`（选区右下角 7×7 方块）：`startFill` 固定锚点、拖拽只扩展焦点，`endDrag` 时按源区域循环写入目标区（跳过源区），`测试参数` 列走 `apply-params` 事件。

#### 四、展开/折叠等按钮与树形图共用

- `CANView.vue`：移除 `DbcSignalTable` 内部的工具条，改为在页签头部 `.header-right` 统一放置：
  - **两视图共用**：`全部展开` / `全部折叠`（`onDbcExpandAll` / `onDbcCollapseAll`：表格视图调表格实例，树视图调 `expandAllMainTree` / `collapseAllMainTree`）。
  - **表格视图专有**：`已选 N 行` 提示 + `标记测试` / `取消测试`（`onDbcBatchTest`，未勾选时按钮置灰）+ `列设置`。
- `DbcSignalTable.vue`：`expandAll / collapseAll` 重写为 `setAllExpanded()`，直接调用 Element Plus 的 `table.store.toggleTreeExpansion(row, expanded)`（`expand-row-keys` 在数组内容不变时不会重新应用，改 keys 无效）；`rows` watcher 用 `knownMsgIds` 区分「换数据」与「同批重算」，避免编辑单元格后自动重新展开；`defineExpose` 补 `applyBatch` / `clearSelection`。
- `onDbcViewChange`：切回树视图后 `nextTick(() => expandAllMainTree())`——树是懒挂载的，否则切回时会全部收起。

**验证**（Playwright 真实浏览器 + 后端真实代码，`E262S无刷`，1600×900）：
- 列头与期望 15 列完全一致，`报文类型` 已不存在（`th` 共 16 个 = 勾选列 + 15 列）。
- 行色：报文行 `rgba(64,158,255,0.07) / font-weight 600`，信号行 `rgba(0,0,0,0) / font-weight 400`。
- 展开/折叠（按可见行统计，非 DOM 行数）：表格 114 → 折叠 11 → 展开 114；树视图 122 → 折叠 8 → 展开 122，头部按钮与组件方法两条路径一致。
- 列宽：拖拽「信号值描述」150 → 240，`localStorage` 持久化宽度 240。
- 块粘贴：框选 3 个信号行的「精度」列后粘贴单值，三行均为 `999.5`（自动填充生效）。
- 自动填充柄：单击单元格后拖拽右下角手柄覆盖下方两行，三行「物理最大值」均为 `255.0`。
- 批量按钮：勾选 3 行 → `已选 3 行`；`取消测试` 勾选数 114 → 111；再次勾选后 `标记测试` → 114；执行后自动清空行选择并置灰按钮。列设置弹窗 15 项、支持上下移动与「恢复默认」。
- `pageerror` 为空；`npx vue-tsc --noEmit`、`npm run build` 通过。

> 观察（本次未改动）：表格所在页签可用宽度约 674px（1600 视口 − 左侧导航 − 右侧对象面板），15 列合计约 1822px，需**横向滚动**才能看到「信号名称」以后的列；横向滚动本身正常（`el-scrollbar__wrap`，最大滚动约 1166px）。

**相关文件**：
- `frontend/src/components/DbcSignalTable.vue`
- `frontend/src/views/CANView.vue`
- `frontend/src/types/dbcTable.ts`

**发布状态**：已发布到共享盘（version 1.0.6）

---

### [1.0.6] - 2026-09-17

**会话主题**：修复报文信号表「选择单元格很慢」（单击一次约 250ms）

#### 问题定位

用 Event Timing API（`PerformanceObserver({type:'event'})` 读 `processingEnd - processingStart`）+ 真实浏览器实测 `E262S无刷`（114 行 × 16 列 = 1824 个单元格）：

| 操作 | 修复前 mousedown 处理耗时 |
| --- | --- |
| 点「Test」列（`onCellMouseDown` 直接 return，不改选区） | 0ms |
| 点数据列（改选区 + 发 row-select） | **249 / 237 / 258ms** |
| 拖拽框选经过一行（mouseenter） | 中位 **241ms**，40 步合计约 10s |

对照组说明耗时**几乎全部来自「改选区」**：选区是 `ref`，而模板里每格都在调 `v-if="isSelectionCorner(row, col)"`（`cell-class-name` 里的 `inSelection` 同理），于是 Element Plus 的表体渲染函数依赖了选区；选区一变就整表重渲染 1824 个单元格，每个还要做一次 `flatRows.findIndex`（O(n)，合计约 20 万次比较）+ 一次 `changeMarkOf`。

#### 修复内容（`DbcSignalTable.vue`）

- **选区改为非响应式 + 直接操作 DOM**：`selection` 由 `ref` 改为普通变量；新增 `paintSelection/setSelection/clearSelection`，用 `dst-selected` 类直接打在 `td` 上；填充柄改为 `document.createElement` 出来的独立元素，随选区 `appendChild` 到角落单元格。单元格渲染不再依赖选区，拖拽时不再整表重渲染。
  - 注意：手工创建的元素必须补上 scoped 样式作用域属性（`data-v-xxx`），否则 `.dst-fill-handle` 的样式匹配不到（实测 0×0，鼠标点不中，拖拽填充会失效）。
  - 单元格索引（`rowId+colKey → 元素`）带 `isConnected` 快速失效判断，避免拖拽时反复重建 1800+ 节点的索引。
- **拖拽落点高亮同样改为非响应式**：`dragOverRowId` 由 `ref` 改为普通变量 + `markDropOver()` 直接切 `dst-drop-over` 类。
- **索引 O(1) 化**：新增 `rowIndexMap / columnMap / colIndexMap` 三个 computed（Map 查找），替换 `flatRows.findIndex` / `columns.findIndex`。
- **减少冗余副作用**：移除 `highlight-current-row`（EP 的 currentRow 会再触发一次表体重渲染）；`onCellMouseDown` 不再 `emit('row-select')`（`row-click` 已发一次，避免拖拽起点重复触发「选中树节点」）。
- **数据/列变化后补绘制**：新增 `repaint()`，在 `rows`、`columns`、`tableHeight` 变化后 `nextTick` 重贴高亮与填充柄（EP 重渲染会换掉单元格节点）。

#### 验证

- **性能**（同上口径，真实浏览器）：单击数据列 mousedown 处理耗时 **249ms → 0~1ms**；拖拽 40 行 mouseenter 处理耗时 **每格 0ms（合计 0ms）**，此前约 10s。
- **功能回归**（`E262S无刷`，1600×900，`pageerror` 为空）：
  - 单击 → 1 格高亮，填充柄落在该格内（第 1 行第 8 列）；
  - `Shift+点击` 扩选 3 行 → 3 格高亮，填充柄在末格；
  - 鼠标拖拽 3 行 × 3 列 → 9 格高亮；
  - 框选 3 行「精度」粘贴单值 → 三行同为 `888.5`，粘贴后高亮保持 3 格；
  - `Ctrl+C` 复制选区 → `888.5\r\n888.5\r\n888.5`；
  - 拖填充柄 → 源值复制到目标行（`777` 传播到连续 3 行；`888.5` 组高亮扩到 6 行 × 3 列 = 18 格）；
  - 全部折叠 / 全部展开（114 → 11 → 114）后高亮与填充柄自动恢复；
  - 列宽拖拽 150 → 210 正常；
  - 勾选 3 行 → `已选 3 行`，批量按钮可用；
  - 拖拽落点：`dragover` 整行 15 格高亮、换行时旧行清除、`dragleave` 清空；
  - 树形图 ↔ 表格 来回切换后单击选区与填充柄仍正常。
- `npx vue-tsc --noEmit`、`npm run build` 通过。

**相关文件**：
- `frontend/src/components/DbcSignalTable.vue`

**发布状态**：已发布到共享盘（version 1.0.6）

---

### [1.0.6] - 2026-09-17

**会话主题**：报文信号表复选框列合并为一列 + Ctrl/Shift 加选行批量勾选

#### 需求

- 表格里有两列复选框（el-table 自带勾选列 + 「Test」列），只保留一列。
- 按住 Ctrl 多选行、再点复选框可以同时勾选多行。

#### 变更

**一、合并为一列（保留「Test」列）**

- `DbcSignalTable.vue`：移除 `<el-table-column type="selection" width="42" />` 与 `@selection-change`；「Test」列成为表格唯一的复选框列（表头即 `Test`，位于最左）。
- `CANView.vue`：列定义 `dbcTableColumns` 未改（`test` 列原本就在第一位），仅页签头部提示补上 Ctrl/Shift 加选说明。

**二、Ctrl/Shift 加选行 + 复选框批量勾选**

- 复选框改为**完全受控**：`:model-value="!!row.node.checked"` + `@click.stop.prevent="onCheckClick($event, row)"`，勾选状态一律由 `check-change` 回写，避免 el-checkbox 自身切换状态后与数据不同步。
- 交互：
  - **普通点击**：若已有多个加选行且当前行在加选集合内 → 对集合内所有行一起勾选/取消勾选；否则只切换本行。
  - **Ctrl/Cmd+点击**：把该行加入/移出加选集合，**不改动勾选状态**。
  - **Shift+点击**：从上次加选锚点到该行整段加入加选集合。
  - 加选行以 `dst-picked` 类直接打在行上（浅蓝底），头部「已选 N 行」随之更新；「标记测试 / 取消测试」作用于加选集合，执行后自动清空加选。
- 沿用上一轮的「非响应式 + 直接改 DOM」性能约定：加选集合 `pickedIds` 是普通 Set，不参与渲染；`repaint()` 在表格重渲染后补回 `dst-picked`。

#### 验证

（Playwright 真实浏览器，`E262S无刷`，1600×900，`pageerror` 为空）

- 只有一列复选框：表头为 `Test / 发送节点 / 报文名称 / …` 共 15 列；每行 `input[type=checkbox]` 数 = 1；`.el-table-column--selection` 遗留 = 0。
- 普通点击第 1 行 → 仅该行由勾选变未勾选，其余不动。
- Ctrl 连续点击 3 行 → 勾选状态**未变**，加选集合 3 行（45 个 td 带 `dst-picked`），提示「已选 3 行」。
- 再普通点击其中一行的复选框 → 3 行一起取消勾选；再点一次 → 3 行一起勾选回来（`[F,T,T,T]` → `[F,F,F,F]` → `[F,T,T,T]`）。
- 「取消测试」→ 勾选数 113 → 110（正好 -3），加选清空、提示归 0；重新加选 3 行后「标记测试」→ 回到 113。
- Shift+点击可整段加选。
- 单元格框选 3 格、粘贴单值自动填充、拖动填充柄（7×7）传播值均正常；高亮在数据重渲染后仍保留。
- 拖拽落点整行 15 格高亮；树形图 ↔ 表格 切换后表头首列仍为 `Test`、复选框仍为 1 列。
- `npx vue-tsc --noEmit`、`npm run build` 通过。

> 说明：移除 el-table 自带勾选列后，原有的「表头全选」复选框一并消失（改为 Ctrl/Shift 逐个/整段加选）。如需「全选/取消全选」按钮或表头全选框，可另开任务补充。

**相关文件**：
- `frontend/src/components/DbcSignalTable.vue`
- `frontend/src/views/CANView.vue`

**发布状态**：已发布到共享盘（version 1.0.6）

---

### [1.0.6] - 2026-09-17

**会话主题**：新增 Ctrl+Z 撤销

#### 变更（`CANView.vue`）

- **撤销栈**：新增 `undoStack` / `recordUndo()` / `undo()`，上限 200 步。
  - 记录「值级别」修改：单元格编辑（`fields.*` / `msg.*`）、`Test` 勾选、批量标记/取消测试、测试参数变更（单元格粘贴 / 标签 × 删除 / 拖拽添加 / 详情面板编辑）。
  - **按操作合并**：一次用户操作（如一次粘贴写多格、一次拖拽填充、一次批量勾选）会在同一同步任务里发出多条记录，用微任务（`Promise.resolve().then`）合并成 **一步**，所以 Ctrl+Z 一次撤销整个操作；同一目标只保留最早的旧值。
  - **空操作过滤**：入栈前比对当前值与旧值，丢弃「实际没改动」的记录（例如操作被校验拦下），避免 Ctrl+Z「按了没反应」。
  - 撤销时倒序回放；恢复测试参数走 `testParamMap` + `mergeTestParamsIntoTree`；恢复勾选后重新同步树勾选键；换配置/重置数据时清空撤销栈（历史节点已不是当前树）。
- **快捷键**：`onCanGlobalKeydown` 增加 `Ctrl/⌘+Z → undo()`。焦点在输入框内时保留浏览器原生撤销（沿用原有的 INPUT/TEXTAREA 早退分支），因此双击编辑过程中按 Ctrl+Z 仍是「撤销输入框里的输入」。
- 页签提示补充「Ctrl+Z 撤销上一步修改」。

#### 验证

（Playwright 真实浏览器，`E262S无刷`，1600×900，`pageerror` 为空）

| 场景 | 结果 |
| --- | --- |
| 双击编辑单元格（1 → 555）→ Ctrl+Z | 回到 `1`，提示「已撤销：编辑单元格」 |
| 框选 4 格粘贴 `777.7` → **一次** Ctrl+Z | 4 格全部回到 `1`（合并为一步） |
| 粘贴 `42` 到一格 + 拖填充柄覆盖 3 格 → Ctrl+Z | 恢复到填充前（源格仍为 `42`）；再 Ctrl+Z 源格回到 `1` |
| 测试参数单元格粘贴 `FactorTest` → Ctrl+Z | 恢复原参数（`CRC_CheckSum`） |
| 单行 Test 勾选取消 → Ctrl+Z | 勾选恢复 `[T,T,T]` |
| Ctrl 加选 3 行「取消测试」（勾选数 114 → 111）→ Ctrl+Z | 回到 114 |
| 连续 Ctrl+Z 到栈空 | 提示「没有可撤销的操作」 |
| 切换配置后 Ctrl+Z | 提示「没有可撤销的操作」（历史已清空），无报错 |

- `npx vue-tsc --noEmit`、`npm run build` 通过。

> 未纳入撤销范围（如需可另开任务）：删除选中行（`删除选中`）、列显隐/列宽/顺序调整、`signalRows` 记录表的测试参数批量套用（`onTestParamsChange`）。

**相关文件**：
- `frontend/src/views/CANView.vue`

**发布状态**：已发布到共享盘（version 1.0.6）

---

### [1.0.6] - 2026-09-17

**会话主题**：CAN 配置导出 Excel 适配表格视图（含测试参数数据）

**问题**：原导出的 `DBC Canmatrix` 固定输出 33 列旧矩阵格式（报文类型/排列格式/起始位/位长度/XCP_CCP_varname/GenSigFuncType…），与表格视图所见不一致；测试参数又分散在 `lostDTC` / `dlcDTC` / `DTC` / `XCP_CCP_varname` 等派生列里，导出结果看不出实际的测试参数配置。

**变更**：

- **导出列 = 表格当前显示的列**（`frontend/src/views/CANView.vue` → `onExportExcel`）：把 `dbcTableVisibleColumns`（跟随列显隐、顺序、自定义列宽）映射为 `{key,label,en}` 传给后端，Excel 表头按「中文 + 换行 + 英文」生成，与表格表头一致。隐藏的列不再导出。
- **追加测试参数数据列**（`backend/services/can_config_excel.py`）：在可见列之后固定追加两列，保证测试参数不因列显隐而丢失，格式与表格「测试参数」单元格复制一致（可再导入还原）：
  - `报文测试参数\nMsg_Test_Params`：报文级参数（`tp`）JSON，在各信号行重复出现；
  - `信号测试参数\nSig_Test_Params`：信号级参数（`tp`）JSON + EPS 算法（`et`，`target='eps'`）。
- **行结构对齐表格**：改为「每个报文一行报文行 + 每个信号一行信号行」，与表格视图行结构一致；报文行的 `Test` 取报文勾选、可读「测试参数」列取报文级参数，信号行的 `Test` 取信号勾选。这样报文级 `Test` 状态不再因「首个信号行」而丢失（原格式靠独立的 `MsgTest` 列承载）。
- **报文/节点信息只在报文行出现，信号行不重复**（按需求）：信号行的 发送节点 / 报文名称 / 报文标识符 / 报文周期时间 / 报文长度 及 `报文测试参数` 列一律留空，采用通信矩阵常见的「合并单元格」写法（列定义里的 `scope === 'msg'` 也一并留空）。再导入时前端 `parseDbcRecords` 对这些报文级字段做**前向填充**（`MSG_KEYS`），所以留空不影响还原。
- 表格可见的「测试参数」列输出**可读明细**（如 `SigInvalidTest(dtcValue=0xFF, dtc=0x222, invalidType=SigInvalid)`），便于直接在 Excel 中查看。
- `POST /api/can/export-excel` 新增可选 `columns` 参数（前端未传时后端回退默认 15 列，保持向后兼容）。
- **再导入兼容**（`frontend/src/utils/dbc.ts` + `CANView.vue` → `buildSignalRowsFromRaw`）：`parseDbcRecords` 识别「报文/信号测试参数」JSON 列并原样透出；导入时**优先**采用这两列还原测试参数（为空才回退旧的按列自动推断逻辑），保证「导出 → 再导入」参数不丢失。因报文级字段与「报文测试参数」现仅写在报文行，导入侧改为**按报文取首个非空值**（不要求一定在首行），兼容手工把内容填在信号行的情况。同时修正 `Test` 列按精确匹配定位、`MsgTest` 匹配排除测试参数类列，避免列名里含 `test` 造成误判。

#### 验证

（后端 `openpyxl` 读回导出文件断言 + 前端 `vue-tsc` / `vite build`）

| 场景 | 结果 |
| --- | --- |
| 可见列 `Test/发送节点/报文名称/报文标识符/信号名称/精度/测试参数` 导出 | 表头 9 列 = 7 可见列 + 2 测试参数列，顺序一致 |
| 报文行 / 信号行 `Test` | 分别为报文勾选与信号勾选（`Y/Y/N`） |
| 报文级信息 | 只在报文行：发送节点/报文名称/报文标识符/周期/长度 + `报文测试参数` JSON |
| 信号行不重复报文信息 | 以上列在信号行全部为空（含 `报文测试参数`），仅保留信号级列与 `信号测试参数` |
| 信号级参数 | `SigInvalidTest` JSON 仅在对应信号行；无参数的信号行为空 |
| EPS 信号 | `信号测试参数` 首项为 `CRC_EPS`（`target='eps'`），次项 `CounterTest` |
| 无信号报文行 | 报文行保留，`测试参数` 两列均为空 |
| 再导入 `msgChecked` | 报文 Test 状态与导出前一致（`HCU_0x201=True` / `HCU_0x202=False`） |
| 再导入前向填充 | 按 `MSG_KEYS` 模拟：信号行还原出发送节点/报文名称/报文标识符/周期/长度 |
| 真实配置全量回归 | 11 个配置共 **1975 条信号行**：报文级信息泄漏 0、报文行字段缺失 0、前向填充失败 0 |
| 未传 `columns`（兼容旧调用） | 回退默认 15 列 + 2 测试参数列 = 17 列 |

- `npx vue-tsc --noEmit`、`npm run build` 通过。

> 说明（导出 → 再导入的已知取舍）：因导出仅含表格**显示**的列，未显示的信号定位字段（起始位/位长度/排列格式/起始字节/数据类型/单位/Signal_Type/DTC/XCP 变量）不会出现在 Excel 中，再导入后这些字段为空；配置的完整保存/加载仍以 JSON 配置为准。

**相关文件**：
- `backend/services/can_config_excel.py`
- `backend/api/can_routes.py`
- `frontend/src/api/can.ts`
- `frontend/src/utils/dbc.ts`
- `frontend/src/views/CANView.vue`

**发布状态**：已发布到共享盘（version 1.0.6）

---

### [1.0.6] - 2026-09-17

**会话主题**：修复「工况比可视区宽时，右侧泳道里的卡片拖不动」

**问题反馈**：`ADS_Ang` 分组「Eps Off->No Active」主序列**右侧**泳道的卡片「鼠标根本按不起来」。

**排查结论**（不是卡片不可拖，也不是数据坏了）：
- 用组件内部状态逐个复现 `onNodeDragStart` 的查找：23 个 (frameId, laneId, nodeId) 全部命中；无重复 frame.id / lane.id，无 lane 引用但 nodes 缺失的 id，无孤立节点。
- `draggable="true"`、`pointer-events: auto` 均正常；无元素遮挡落点、无 0 尺寸卡片。
- 实测鼠标按下的命中元素：左侧泳道 → `DIV.node-name`（卡片内）→ `dragstart` 正常；主序列右侧泳道 → 命中的是**右侧停靠面板**的 `DIV.vl-list`（值资源库列表），**没有 dragstart**。
- **真正原因**：该工况有 **6 条泳道**，工况框实测宽 **2561px**，而画布可视宽度只有 **835px**（右侧停靠了函数库/对象浏览器面板），需横向滚动 **1726px**。主序列在第 4 条（index 3），它右边的两条泳道位于 x≈**2147 / 2544**，而画布可见范围是 x≈**341~1176** → 这两条泳道**完全滚出视野**（`visibleW: 0`）。画布的水平滚动条位于**所有工况内容的最底部**（要先滚到页面底部才看得到），而鼠标滚轮在普通 div 上只能上下滚 → 鼠标用户实际上够不到右侧泳道，所以「根本按不起来」。

**变更**（`frontend/src/components/graph/CaseFrameCanvas.vue`）：
- 新增**滚轮横向滚动**（`onCanvasWheel`）：指针位于「宽度超过画布」的工况上时，滚轮改为横向滚动；该方向横向到头后不再拦截、自动转为纵向滚动（避免「滚不动」）；Shift+滚轮强制纵向（Chrome 原生 Shift+滚轮是横向，这里显式纠正）。工具栏提示同步补充「泳道超出宽度后用滚轮左右查看（Shift+滚轮上下）」。
- 新增**拖拽时画布边缘自动滚动**：`dragover` 里按指针到四边的距离计算速度（70px 边缘区，最快速 26px/帧），用 `requestAnimationFrame` 滚动容器；指针离开画布或拖拽结束即停（`dragend` / `drop` 立即停，另有 500ms 无 `dragover` 的宽限，避免浏览器静止时约 350ms 才补发一次 `dragover` 造成卡顿）。`portPos` 用「端口 − frame-body」的相对坐标，与滚动位置无关，所以滚动不影响连线渲染。
- 顺带修掉同类静默失败：把**已有卡片拖到主序列泳道**时（主序列只收「序列」卡片）现在给出提示，之前只在「从卡片库拖入」时提示。

**验证**（Playwright 真实滚轮 + 真实鼠标按下，`ADS_Ang`「Eps Off->No Active」）：
- **修复前**：主序列右侧泳道 4 / 5 的卡片 `centerInBand: false`、`reachable: false`（复现「按不起来」）。
- **滚轮横向滚动**：在宽工况上滚动，画布 `scrollLeft 12 → 1726`（滚到最右）。
- **修复后**：泳道 4 卡片移到 x=433、泳道 5 移到 x=830，两者 `centerInBand: true`、命中 `DIV.node-name`、**`reachable: true`**（卡片终于可点、可拖）。
- **Shift+滚轮**：`scrollLeft` 保持 1726 不变、`scrollTop 578 → 878`（强制纵向生效）。
- **横向到头后继续滚**：`scrollTop 878 → 952`（自动转为纵向，不卡住）；反向滚动 `scrollLeft 1726 → 1526`（横向回滚）。
- 滑过「不超宽工况」时仍为纵向滚动；浏览器 console 无报错；`npm run build`（vue-tsc 类型检查）通过。
- 未能验证：**带边缘自动滚动的「拖拽中」自动滚动**无法用 Playwright 覆盖——Chromium 在原生拖拽期间进入嵌套消息循环，CDP 的 `Input.dispatchMouseEvent` / `Runtime.evaluate` 会被阻塞（复现为脚本挂起）。该场景请在实机上手验证。

**相关文件**：
- `frontend/src/components/graph/CaseFrameCanvas.vue`

**发布状态**：已发布到共享盘（version 1.0.6）

---

### [1.0.6] - 2026-09-17

**会话主题**：卡片参数（接口）配置流程优化——就地提参数 / 声明区瘦身 / 参数补全

**问题**（一次参数化要 4 个动作，其中一步还是盲打）：
1. 「添加参数」要填 **3 个输入框**（参数名 / 显示名 / 默认值），而显示名基本用不到、默认值往往要再手打一遍；
2. 声明完还得**回到步骤里手打 `{{参数名}}`**——两对大括号、名字要打对；而**拼错不报错**（未声明的占位符会原样保留，直接出现在生成的 CAPL 里）；
3. 工况里双击卡片节点打开的编辑器（CardEditor）**根本没有「参数（接口）」声明区**，导致从函数库直接拖进工况生成的独立卡片无法参数化。

**变更**：
- 新增 `frontend/src/components/graph/ParamFieldAssist.vue`（字段助手，两个编辑器复用）。**助手绝对定位覆盖在输入框右内侧（`position: absolute`），不额外占一行、也不挤占输入框宽度**，并向右让开 22px 以避开 `el-autocomplete` 的展开箭头；按钮默认 `opacity:0` + `pointer-events:none`，悬停所在行/字段才显形并可点，因此不遮挡输入框内的文字与点击：
  - **「提为参数」**（悬停显形的行内图标）：以当前框里的值自动建参数（**默认值就是原值**）并把框内就地替换成 `{{参数名}}`，只弹一个「参数名」输入框，名字带建议（优先取该行的 key）；
  - **「取消参数」**：把 `{{参数}}` 回填为默认值；若某参数**已不再被任何字段引用，自动删除其声明**；
  - **`{{` 参数补全**：在参数框里打出 `{{` 就弹出已声明参数列表（带默认值）+「＋ 新建参数…」，选中即插入；从「新建参数」进来时占位符接在 `{{` 之前的前缀之后。
- `StepEditor.vue` / `CardEditor.vue`：
  - **声明区瘦身**：默认只留「参数名」一个输入框，**默认值 / 显示名收进行尾 ▾ 展开**；已设默认值时在折叠态直接显示「默认 xxx」摘要；
  - **参数行可拖拽**（⠿ 手柄）：拖到任意参数框即插入 `{{参数名}}`（新增载荷类型 `application/x-card-param`，与局部变量的 `text/plain` 区分）；
  - 参数框接入上述字段助手（`args.key` / `args.value` / `fun` / `raw`；`raw` 不做整体「提为参数」，只能插占位符与取消参数）；
  - 字段容器（`StepEditor` 的 `.fill-drop` / `.step-fun`，`CardEditor` 的 `.arg-field` / `.ce-fun-field`）补 `position: relative` 作为助手的定位基准；`.arg-field-key` 宽度恢复为原始的 110px（助手不再占位）；
  - **CardEditor 补上缺失的「参数（接口）」声明区**，并在保存前校验参数名（非空、`\w+`、不重名）。
- `frontend/src/types/functionGraph.ts`：新增 `CARD_PARAM_MIME`。
- 顺带清理：`StepEditor.vue` 中 `el-autocomplete v-if="isCallLike(step)"` 内联在其自身的 `v-if` 块里（恒真），连带后面那个恒不渲染的 `v-else` 禁用输入框一并删除。

**验证**（Playwright 真实 UI，`A47D`）：
- **B（CardEditor，`未配置`卡片）**：声明区存在；新增参数后默认 **1 个输入框**；点 ▾ 展开 → 3 个；再收起 → 1 个；⠿ 手柄 `draggable=true`。
- **A + 取消参数（CardEditor）**：value 框原值 `[0x2E,0xF1,0xA1,0,0,0,0,0,0,0,0x55]` → 点「提为参数」→ 建议名 `code` → 命名 `payload` → 值变为 `{{payload}}`、key 未受影响、参数行 1 条；再点「取消参数」→ 值回填为原字面量、**参数行归 0**（声明被自动清理）。
- **B 拖拽（CardEditor）**：拖 ⠿ 到 value 框 → 值变为 `{{dndParam}}`。
- **C（CardEditor）**：value 框输入 `{{` → 弹层 2 项 `["{{myParam}} 默认 code", "＋ 新建参数…"]`；选第一项 → 值变为 `{{myParam}}`。
- **B/A/C（StepEditor，`FUNC_ADS_TORQUE` 的 `断开sent线` 卡片）**：声明区可见；已有参数 `ch` 折叠态 **1 个输入框** + 摘要「默认 Rs」；展开 → 3 个；⠿ `draggable=true`；字段助手按钮共 5 处；函数框输入 `{{` → 弹层 `["{{ch}} 默认 Rs", "＋ 新建参数…"]`，选中后值变为 `{{ch}}`。
- 两个编辑器的浏览器 console 均无报错；`npm run build`（vue-tsc 类型检查）通过。
- **助手不占布局（Playwright 几何断言）**：CardEditor 两个 `.arg-field` 的 `wrapper 高度 == 输入框高度 == 24px`、`输入框底边相对 wrapper 偏移 0`；StepEditor 的 `.arg-key`（wrapper 25 / 输入框 24）与两个 `.step-fun` 同样如此 → **图标不再换行占行**。全部字段的助手矩形 `insideInput = true` 且垂直居中对齐 → **图标确实覆盖在输入框内部**。输入框宽度为 `110 / 482 / 100 / 460`（未被图标挤小）。悬停时按钮 opacity 为 `1`。截图肉眼确认：`code` 与 `[...0x55]` 两个输入框右内侧各有一个 `⟨⟩`。

**相关文件**：
- `frontend/src/components/graph/ParamFieldAssist.vue`（新增）
- `frontend/src/components/graph/StepEditor.vue`
- `frontend/src/components/graph/CardEditor.vue`
- `frontend/src/types/functionGraph.ts`

**发布状态**：已发布到共享盘（version 1.0.6）

---

### [1.0.6] - 2026-09-17

**会话主题**：参数化三处改进——一键提参数（自动命名）/ 空值可提 / 修正 `{{占位符}}` 泄漏与渲染

**问题**：
1. 点「提为参数」还要弹框填参数名并确认，太啰嗦；
2. 值为空时按钮不出现（不给提）；
3. **`{{变量名}}` 会原样泄漏**：直接放在工况里的卡片（卡片副本）其步骤从不参与参数替换——替换只发生在「卡片引用被内联展开」时（`_flatten_card_steps` → `_substitute_card_params`），所以生成出的 CAPL 里会留 `Foo({{x}});`，界面上也一直显示 `{{变量名}}`。`Check_Tq_EpsOff` 之所以正常，是因为它在工况里是**卡片引用**（`card->Check_Tq_EpsOff` + args），而不是副本。

**变更**：
- **一键提参数**：`ParamFieldAssist` 的「提为参数」点一下即完成，**不再弹框问名字/确认**；参数名自动生成（`autoParamName`）——优先取**信号名**（该行 arg 的 `key`，非法字符转下划线、数字开头补下划线），其次按值特征（DTC 形态→`dtc`），最后 `p1/p2…`，重名自动加 `_2/_3` 序号。两个编辑器同步。
- **空值也可提**：`canParamify` 只排除「整体已经是单个占位符」的情况，空值同样出按钮；此时参数无默认值（等价于「待填」，引用处再填）。
- **后端修正 `{{}}` 泄漏**（`function_graph.py`）：新增 `_node_steps_with_params(node)`，在 `_frame_node_steps` 里对**直接使用的卡片**按「节点自己声明的 params 默认值」替换占位符（深拷贝，不污染原数据；无占位符时零开销跳过）。卡片引用节点仍走 `_flatten_card_steps`（引用处 args 覆盖），行为不变。
- **拖入带参数的卡片 → 创建卡片引用节点**（`CaseFrameCanvas.cardToNode`）：若库卡片声明了参数，拖进工况时不再复制步骤，而是生成单个 `card` 步骤（`cardId` 指向库卡片、args 为空）——与 `Check_Tq_EpsOff` 写法一致，参数会在节点里渲染成**「参数取值」列表**、可按实例分别填值；也避免了副本参数无法覆盖的问题。
- **界面不再出现 `{{占位符}}`**：新增 `paramDisplayText(text, params)`（`functionGraph.ts`，与后端语义一致：有默认值→显示默认值；未声明/无默认值→显示参数名本身），用于工况画布上的节点摘要 `summarize` 与主序列步骤名 `sequenceRows`。

**验证**：
- **一键提参数（StepEditor，库卡片 `Check_Tq_EpsOff`）**：点 value 框的「提为参数」→ `el-message-box` 数量 **0**（无弹框）、参数行 3 → 4、新参数名 **`x6D_lkaTqMgrMode`**（自动取信号名）、字段变为 `{{x6D_lkaTqMgrMode}}`、折叠态摘要为「默认 0」。
- **空值可提**：清空另一行 value 后点「提为参数」→ 无弹框、参数行 4 → 5、名字 **`x6D_EPS_AgCtrlAvl`**、字段变 `{{x6D_EPS_AgCtrlAvl}}`、摘要为「未设默认值（引用处不填则该项不参与）」。
- **`{{}}` 泄漏修正（后端单元测试 build_test_case_list）**：工况里放**卡片副本**（节点自带 `params: [{name:x, default:DEF}]`）→ 修复前 `Foo({{x}});` / `containsBrace=True`，修复后 **`Foo(DEF);` / `containsBrace=False`**；卡片引用节点仍为 `Foo(OVR);`（引用处覆盖生效）。
- **界面渲染**：把主序列 `Wait` 的 `time=1000` 提为参数后，卡片里存的是 `{{time}}`，但**画布上仍显示 `Wait(1000)`**（`C_after: ["Init","Wait(1000)","恢复全部"]`），整块画布 `{{` 检测为 **false**。
- **拖入带参数卡片**：把 `断开sent线`（声明了参数 `ch`）拖进工况 → 新增节点摘要为 **`断开sent线`**（不再是 `SensorRs_oN · Wait(1000)` 那种副本形态）；双击打开 → **步骤数 1**、内容「卡片引用 故障注入 断开sent线」+ **「参数取值（未填=用卡片默认值）ch 不参与」**（`card-ref-params` 1 处）——与 `Check_Tq_EpsOff` 完全一致。
- 浏览器 console 无报错；`npm run build`（vue-tsc 类型检查）、`python -m py_compile` 均通过。

**相关文件**：
- `backend/services/function_graph.py`
- `frontend/src/components/graph/ParamFieldAssist.vue`
- `frontend/src/components/graph/StepEditor.vue`
- `frontend/src/components/graph/CardEditor.vue`
- `frontend/src/components/graph/CaseFrameCanvas.vue`
- `frontend/src/utils/functionGraph.ts`

**发布状态**：已发布到共享盘（version 1.0.6）

---

### [1.0.6] - 2026-09-17

**会话主题**：配置「保存只存本地 + 按项拉取/推送」；统一快捷键层；工况画布拖拽与复制粘贴完善

**一、配置保存不再自动上传，改为显式的「拉取/推送」（本次核心）**

**问题**：
1. `ConfigService.save_configs()` 默认 `auto_upload=True`，因此**保存 / 新建 / 复制配置都会顺带把整份配置推送到共享盘**，用户无法控制；
2. 原「拉取配置」下拉只有「并集合并 / 完全覆盖」，**不能选择具体拉取哪些配置项**，也无法主动推送。

**变更**：
- `backend/services/config_service.py`：`save_configs()` 的 `auto_upload` 默认值改为 **False**（保存只写本地）；显式传 `True` 仍保留旧行为。新增 `push_configs(names, merge_mode)`、`pull_configs(names, merge_mode)`、`get_remote_config_names()`。
- `backend/utils/network_storage.py`：新增按配置项操作的
  - `upload_selected(remote_file, local_file, names, merge_mode)`：只推送选中项，未选中的远程项保留；
  - `download_selected(remote_file, local_file, names, merge_mode)`：只拉取选中项，未选中的本地项保留；
  - `list_remote_config_names(remote_file)`：读取共享盘上的配置项列表。
  推 / 拉使用**同一套远程相对路径**（`configs/<模块>/<模块>_configs.json`），保证对称。
- `backend/api/config_routes.py`：
  - 新增 `POST /api/<module>/configs/push`（body `names` 必填）；
  - 新增 `GET /api/<module>/configs/remote`（返回 `available` / `remote_configs` / `local_configs` / `share_path`）；
  - `POST /api/<module>/configs/pull` 支持 `names`（不传则沿用整文件拉取）；
  - 修掉一处数据污染：`GET /configs/<name>` 原先把 `name` 直接写进内存中的配置对象，导致后续任何保存/推送都会把多余的 `name` 字段落盘并上传共享盘，改为返回副本。
- 前端 `frontend/src/api/config.ts` 新增 `pushConfig` / `getRemoteConfigs`，`pullConfig` 支持 `names`。
- 前端 `frontend/src/components/ConfigToolbar.vue`：原「拉取配置」按钮改为**「拉取/推送」下拉**，两项均弹出**可勾选的配置项列表**（支持多选、全选、反选、刷新，并标注「本地已有（合并）/ 本地新增 / 覆盖远程 / 远程新增」）；拉取默认全选，推送默认只勾选当前配置，避免误推全部。

**验证**（真实共享盘 + 模拟共享盘双跑，全部通过）：
- 存储层 19 项断言：推送只新增/覆盖选中项、`merge_mode=False` 只留选中项、拉取不覆盖未选中的本地项、空选择拒绝执行；
- `save_configs()` 不再触发上传（伪造网络存储断言零调用）；
- 真实 HTTP 端到端 13 项：推送 200 且远程文件内容幂等不变、拉取 200 且本地内容不变、远程列表接口可用、空 `names` 返回 400、推送不存在的项返回 500 且不破坏远程文件、本地文件测试后已复原；
- 「保存不再上传」用**远程文件 mtime 探针**验证：保存前后远程文件 mtime 完全不变；
- 浏览器实测：拉取弹窗 6 项全选（含计数/标签/共享盘路径），全选→0、反选→6、取消勾选 1 项后计数 5/6 且半选态正确；推送弹窗默认只勾选当前配置 A47D（1/6），标签为「覆盖远程」。

**二、统一快捷键层（收敛按键冲突）**

**问题**：12 处按键处理分散在 window/document 上且互不 `stopPropagation`，同一个 `Ctrl+C` 可能同时复制「DTC 单元格 + 测试参数 + 链路层 DTC」，`Ctrl+S` 还会穿透输入框。

**变更**：
- 新增 `frontend/src/composables/useShortcuts.ts`（在 `main.ts` 最早安装，window **捕获阶段**唯一派发）：按 `context > module > global` 作用域裁决，同层后注册者优先；`run()` 返回 `true` 接管（自动 `preventDefault` + `stopPropagation`）、`'soft'` 处理但不拦截（Esc）、`false` 不接管；焦点在输入框/文本域/下拉内默认跳过（`allowInInput` 可例外）；控制台可用 `__SHORTCUTS__.list()` / `.log` 自查。
- 把 `CaseFrameCanvas` / `StepEditor` / `FunctionGraphEditor` / `CANView` / `DtcCardList` / `DbcSignalTable` / `ObjectPanel` 的旧监听**全部迁入**该层，并删除旧 `addEventListener`；`frontend/src` 内已无组件级 keydown 监听。
- 各视图被 keep-alive 缓存不会卸载，故所有画布/表格类注册均加 `isModuleActive(...)` 守卫，避免在其它模块抢键。
- 新增全局键：`Ctrl+S` 保存、`Ctrl+Enter` 生成、`Ctrl+1..6` 切换模块、`Ctrl+F` 聚焦当前模块搜索框（各模块搜索框加 `data-shortcut-search` 标记）。
- 新增条目键：画布 `Insert` 新建工况 / `Delete` 删除选中卡片或泳道；CAN「Shift+Delete」删除条目、`Insert` 新增条目；UDS 树 `Delete` 删除 / `Insert` 添加子节点 / `Alt+↑↓` 上下移 / `F2` 重命名。

**三、工况画布拖拽与复制粘贴**

- 卡片新增**拖拽手柄**（`⣿`），卡片主体不再整体可拖，抓取点唯一；拖拽影像改为整张卡片（拖动时有「卡片浮起」效果）。
- 修复拖拽期间「＋新建泳道」停靠区占位导致泳道整体位移 76px、卡片从鼠标下跑掉的问题（改为零宽锚点 + 绝对定位）。
- 修复连线 SVG 吃掉按下/松手事件（卡片层级提到 SVG 之上，拖拽期间连线 `pointer-events: none`）。
- 修复落在泳道空白/最后一张卡片下方时**不显示停靠线**、以及误删连线的问题；落点按鼠标 Y 计算插入位置，与提示线使用同一算法。
- 新增 `Ctrl+C` / `Ctrl+V`、**Ctrl+拖拽（可多选）**复制卡片与泳道：可落到卡片前后、泳道空白、泳道间隙（新建泳道），跨工况亦可，原件保留；修复复制拖拽落空（`dragover` 未声明 `dropEffect='copy'` 导致浏览器不发 drop）。
- 新增画布快照式**撤销 / 重做**（`Ctrl+Z` / `Ctrl+Y` / `Ctrl+Shift+Z`，最多 60 步），并修正画布与上层「复制整个工况」的快捷键抢占（画布有选中时优先，无选中时保留原行为）。

**相关文件**：
- `backend/services/config_service.py`
- `backend/utils/network_storage.py`
- `backend/api/config_routes.py`
- `frontend/src/api/config.ts`
- `frontend/src/components/ConfigToolbar.vue`
- `frontend/src/composables/useShortcuts.ts`（新增）
- `frontend/src/main.ts`、`frontend/src/App.vue`
- `frontend/src/components/graph/CaseFrameCanvas.vue`、`StepEditor.vue`、`FunctionGraphEditor.vue`
- `frontend/src/views/CANView.vue`、`UDSView.vue`
- `frontend/src/components/DtcCardList.vue`、`DbcSignalTable.vue`、`ObjectPanel.vue`

**发布状态**：已发布到共享盘（version 1.0.6）

---

### [1.0.6] - 2026-09-16

**会话主题**：CAN「其他配置」新增 Signal_InvalidValue 控件（自动填充非 EPS 信号 + 无效值/区间）

**功能**：在 CAN 模块「其他配置参数」新增 `Signal_InvalidValue` 卡片，类似 `SignalValue`，但**自动列出当前 DBC 树中的全部非 EPS 信号**（**排除 CRC / Counter 信号**），每个信号名后跟一个输入框，提示填写「无效值或无效值区间」（单值如 `0`、`0xFF`，或区间如 `0-100` 均可）。

**变更内容**：

- **前端**（`frontend/src/views/CANView.vue`）：
  - 新增 `signalInvalidValues`（`{ 信号名: 值 }`）与计算属性 `nonEpsSignals`：递归遍历 `mainDbcTree`，取 `type === 'signal'` 且 `msg.senders !== 'EPS'` 的信号名（按树顺序去重），并用 `isCrcOrCounterSignal()` 排除 CRC / Counter。
  - 新增 `isCrcOrCounterSignal(signalName, signalType)`：复用既有识别规则（信号名或 `Signal_Type` 命中 `crc`/`checksum`/`csum` → CRC；`counter`/`rollcnt`/`rolling`/`seq`/`_cnt`/`cnt_` → Counter，与 `buildAutoSigTestParams` 一致）。
  - 新增 `signalTypeLookup`（信号名 → `Signal_Type`）：保存时据以剔除 CRC / Counter，避免留下不可见的脏数据（与卡片展示范围严格一致）。
  - 卡片 UI：全宽（`grid-column: 1/-1`）卡片，标题右侧显示非 EPS 信号数量；列表内部滚动；已填写的信号名高亮；无信号时给出「请先导入或加载 DBC」提示。
  - 持久化：`collectConfigData` 收集为 `Other.signalInvalidValue = [{signalName, invalidValue}, ...]`（只保存已填写值的信号，且保留树中已移除信号的历史值）；`applyConfigData` 回填；`resetData` 清空。
- **后端**（`backend/processors/excel_processor.py`）：
  - 在 `process_Other` 的「内部创建必测试用例」注释下方提供数据接口，供后续补写用例：
    - `self.signal_invalid_value_list`：`[{'signalName': ..., 'invalidValue': ...}, ...]`（保序，已过滤信号名/值为空的行）
    - `self.signal_invalid_value_map`：`{信号名: 值}`，便于按信号名取用
  - `__init__` 中初始化上述两个属性。

**验证**（Playwright 实测 `E262S无刷`）：
- 卡片渲染 **33** 行，与配置中「非 EPS 且非 CRC / Counter」信号完全一致（无缺失、无多余）；排除 **10** 个 CRC / Counter 信号（`*_Checksum_*` / `*_Counter_*`）与 **60** 个 EPS 信号，均未混入；占位符为「无效值或无效值区间（如 0 或 0-100）」。
- 保存路径：向配置注入 CRC 键 `x13D_Counter_13D` 后加载，卡片无该行；点击保存后落盘仅剩 `[{'signalName': 'x120_VehOdo', 'invalidValue': '0'}]`，CRC 键被剔除；刷新并重新加载配置后输入框正确回填；`pageerror` 为空。
- 后端单测：空信号名/空值/非字典项被正确过滤，首尾空格被 trim，列表与映射结果符合预期。
- 前端 `npm run build`（`vue-tsc` + `vite build`）与后端 `py_compile` 通过。

**说明**：CRC / Counter 判定沿用项目既有规则，关键词较宽（含 `seq` / `_cnt` / `rolling` 等），若某些正常信号名恰好包含这些关键词也会被排除，可按需调整 `isCrcOrCounterSignal`。

**相关文件**：
- `frontend/src/views/CANView.vue`
- `backend/processors/excel_processor.py`

**发布状态**：已发布到共享盘（version 1.0.6）

---

### [1.0.6] - 2026-09-16

**会话主题**：卡片参数化（卡片接口）——同一张卡片在用例中写不同值

**功能**：组合卡片可以声明**参数（接口）**，卡片内部用 `{{参数名}}` 占位；用例引用该卡片时通过引用步骤的 `args` 填值，从而**一张卡片替代多张**（例：`Check_Tq_EpsOff` 的 DTC / SteerMod / TqCtrlSts 参数化后，`0x5BB629`、`0x5BB829` 两条用例共用同一张卡片）。

**变更内容**：

- **数据结构**（`frontend/src/types/functionGraph.ts`）：新增 `CardParam {name, label?, default?}`，`Card` 增加 `params?: CardParam[]`。
  - 参数占位符写法 `{{name}}`；引用步骤沿用已有但原先未被消费的 `args: [{key, value}]`（`key` = 参数名）。
  - 取值优先级：引用步骤 `args` > 卡片 `params.default`；两者都没有时占位符**保留原样**（便于发现漏填）。
- **后端展开**（`backend/services/function_graph.py`）：
  - 新增 `_card_param_values(ref, ref_step)`（合并默认值与引用值）与 `_substitute_card_params(steps, values)`（把 `{{参数}}` 替换进 `args.value` / `args.key` / `raw` / `fun`）。
  - `_flatten_card_steps` 在递归内联被引用卡片前先做替换；**每次引用都深拷贝**，保证同一卡片在多条用例、多个引用间互不污染。
- **前端预览**（`frontend/src/utils/functionGraph.ts`）：`flattenCardSteps` 做同样的替换（`cardParamValues` / `substituteCardParams`），保证预览与生成一致。

**验证**（样张 `A47D` / `FUNC_ADS_TORQUE`，2 张检查卡片合并为 1 张参数化卡片）：

- `sent1/sent2` 用例（不传 `args`）→ `ReadDTC(0x5BB629)` + `SignalCheck(x6D_EPS_SteerMod, 5)`；`sent3` 用例（传 `args`）→ `ReadDTC(0x5BB829)` + `SignalCheck(x6D_EPS_SteerMod, 1)`，与合并前完全等价。
- 占位符全部被替换（`{{dtc}}`/`{{steerMod}}` 无残留）；**连续展开两次结果一致**，且卡片定义中仍保留占位符（证明未污染共享定义）。
- 前端 `npm run build`（`vue-tsc` + `vite build`）与后端 `py_compile` 通过。

**相关文件**：
- `backend/services/function_graph.py`
- `frontend/src/utils/functionGraph.ts`
- `frontend/src/types/functionGraph.ts`

**发布状态**：已发布到共享盘（version 1.0.6）

---

### [1.0.6] - 2026-09-16

**会话主题**：卡片参数化后续项（空值跳过 / 对象参数 / 编辑器 UI / 命名清理）

**1. 空值跳过（`backend/services/function_graph.py` + `frontend/src/utils/functionGraph.ts`）**

- 新增规则：参数解析为**空串**时视为「该项不参与」，与「未填=用默认值」区分开。
  - `check` / `set` / `reset`：只丢掉该参数行；全部被丢则整步丢弃（各参数独立成行，丢一行不影响其它行）；
  - `card` 引用：只丢掉该参数 → 回落被引用卡片的默认值；
  - `call` / `wait` 等**位置参数**：不可留空位，整步丢弃；
  - `raw` / `fun`：解析出空串会生成残缺 CAPL 行，整步丢弃。
- 前后端实现同名同规则（`_ARGS_SKIP_KINDS` / `ARGS_SKIP_KINDS`），保证预览与生成一致。

**2. 对象参数（同上）**

- 占位符替换范围由 `args.value` / `args.key` / `raw` / `fun` **扩展到 `args.argType`**，因此参数除「值」以外还可承载**对象别名**与**类型**：
  - 信号别名参数化：`{"argType":"signal","key":"{{sig}}","value":"1"}`；
  - 类型参数化：`{"argType":"{{kind}}", ...}` → `signal` / `message` / `envvar` …；
  - CAPL 函数名参数化：`{"kind":"call","fun":"Sensor{{ch}}_oN"}`。

**3. 编辑器 UI**

- **卡片编辑器 `StepEditor.vue`（库卡片）**：新增「参数（接口）」区，可增删参数（参数名 / 显示名 / 默认值），保存时校验（必填、仅 `\w+`、不可重名）。
- **节点编辑器 `CardEditor.vue`（画布节点）**：新增「参数取值」区——节点内的卡片引用会按被引用卡片声明的 `params` 列出输入框。
  - **三态语义（修正了初版「留空=不参与」与占位符提示「默认 X」自相矛盾的问题）**：
    - **未填**（输入框空）= 用卡片默认值，占位符显示「默认 X」；
    - **填值** = 覆盖默认值；
    - **勾选「不参与」** = 生成时跳过该参数（写入空值 → 触发空值跳过），输入框同步置灰；
    - 清空输入框 = 回到「未填」；× 按钮 = 清除自定义取值（回落默认值）。
- `PanelBody.vue` 向 `StepEditor` 传 `:cards`、`CaseFrameCanvas.vue` 向 `CardEditor` 传 `:cards`，供查被引用卡片的参数声明。
- 卡片引用的双击跳转由「整个卡片」收窄为「标题行」，避免与参数输入框操作冲突。

**4. 命名清理（样张）**

- 样张中 3 张 `Sent1_断开` / `Sent2_断开` / `Sent3_断开` 合并为 1 张通用名卡片 `断开sent线`，通道由参数 `ch`（`Rs`/`As`/`Nm`）承载，`fun: "Sensor{{ch}}_oN"`；卡片名不再内嵌值/ID。

**5. 补齐主序列卡片（样张）**

- **问题**：样张主序列节点 `EpsOff_初始化` 原先只是画布上的「内联节点」（无 `refId`），因此**没有出现在「序列」面板**中，也不是库引用（卡片库 `cards.sequence` 为空）。
- **修复**：补建同名 `sequence` 卡片 `EpsOff_初始化`（步骤与主序列一致），并把主序列节点改为**库引用**（`refId = card-tq-EpsOffInit`）——与「从卡片库拖入画布」产生的节点结构一致（画布显示 ⛓ 标记、库里修改可同步），用例展开结果不变。

**验证**：

- 后端单元：`argType`/`key`/`fun` 参数替换；空值跳过 4 种情形（check 单行丢弃 / check 整步丢弃 / raw 整步丢弃 / call 整步丢弃）；未声明参数保留占位符；连续展开一致、卡片定义未被污染。
- 样张（`A47D` / `FUNC_ADS_TORQUE`）生成与合并前**完全等价**：`FUNC_ADS_TORQUE_1→SensorRs_oN();`、`_2→SensorAs_oN();`、`_3→SensorNm_oN();`。
- 浏览器（Playwright，真实加载 `A47D`）：卡片编辑器显示 `断开sent线` 参数 `ch/通道/Rs`、`Check_Tq_EpsOff` 参数 `dtc/DTC/0x5BB629`、`steerMod/EPS_SteerMod/5`、`tqCtrlSts/EPS_TqCtrlSts/0`；节点编辑器内引用显示参数 `ch`（当前值 `Rs`、占位符「默认 Rs」），改为 `As` 保存后重新打开读到 `As`（回写往返正常）；`pageerror` 为空。
- 前端 `npm run build`（`vue-tsc` + `vite build`）与后端 `py_compile` 通过。

**相关文件**：
- `backend/services/function_graph.py`
- `frontend/src/utils/functionGraph.ts`
- `frontend/src/types/functionGraph.ts`
- `frontend/src/components/graph/StepEditor.vue`
- `frontend/src/components/graph/CardEditor.vue`
- `frontend/src/components/graph/PanelBody.vue`
- `frontend/src/components/graph/CaseFrameCanvas.vue`

**发布状态**：已发布到共享盘（version 1.0.6）

---

### [1.0.6] - 2026-09-16

**会话主题**：修复泳道过多时溢出工况框（改为工况框随内容变宽 + 画布横向滚动）

**问题**：工况框内有较多泳道时，泳道会**溢出到工况框边框之外**，且没有横向滚动条。

**原因**：`.cfc-canvas` 早已有 `overflow-x: auto`，但 `.frame` 是普通块级元素（宽度=容器宽度，仅有 `min-width: 640px`），宽度不会随泳道增多而增长，因此泳道直接溢出框外，画布也没有可滚动的宽度。

**变更**（`frontend/src/components/graph/CaseFrameCanvas.vue`，纯样式）：

- `.frame` 增加 `width: max-content; max-width: none;` —— 工况框随泳道内容变宽，由 `.cfc-canvas` 的横向滚动条查看；框内的连线层（`.edge-svg`，`width:100%`）随之覆盖全部内容，连线/端口坐标仍然正确。
- `.frame-name` 增加 `max-width: 480px` —— 工况框变宽后名称输入框不再无限拉伸。

**验证**（Playwright 实测 `A47D` / `FUNC_ADS_TORQUE`，向 `.frame-body` 克隆 6 条泳道模拟「泳道很多」，仅改 DOM 不落盘）：

- 工况框宽度 **754 → 2014px**（随内容变宽）；泳道右缘相对工况框右缘 **-1px**（不再溢出）。
- `.cfc-canvas` 出现横向滚动条（`scrollWidth 2038 > clientWidth 666`）；滚到最右后最后一条泳道完全可见（`last.right 926 ≤ canvas.right 940`）。
- 连线层宽度随内容同步增长；`pageerror` 为空；前端 `npm run build` 通过。

**相关文件**：
- `frontend/src/components/graph/CaseFrameCanvas.vue`

**发布状态**：已发布到共享盘（version 1.0.6）

---

### [1.0.6] - 2026-09-15

**会话主题**：Function 分组用例支持「导入用例 / 导出为 Excel」

**功能**：为 Function 模块的「用例分组」增加右击菜单，支持导入用例、导出为 Excel、全部导出（每个分组一个 Sheet）。

**变更内容**：
- 分组右击菜单（`el-dropdown` + `trigger="contextmenu"`）：
  - **导入用例**：选择 .xlsx；按工作表名匹配同名分组写入，匹配不到的工作表归入右击的分组。导入的用例参与用例预览与代码生成，且在已选配置时自动保存（生成文件从磁盘读配置，不保存会丢失）。
  - **导出为 Excel**：导出该分组的用例（图形展开 + 已导入）为一个工作表。
  - **全部导出**：导出全部分组，**每个分组一个工作表**。
- 新增后端服务 `function_case_excel.py`：
  - `export_groups_xlsx()`：按分组导出工作表；表头 `ID | Fun | parameter | 代码(CAPL)`，`ID` 仅该用例首行填写（与既有 TestCase 表按 ID 切分用例的约定一致），`代码(CAPL)` 为导入时的权威内容。
  - `parse_cases_xlsx()`：解析上传的 .xlsx，按工作表返回 `{case_id, code}`；无「代码」列时回退按 `Fun(parameter);` 合成。
  - 工作表名合法性清洗（去 `[]:*?/\`、截断 31 字符、重名加序号）。
- 新增接口：`POST /api/function/export-cases`（单组 / 全部；传 `save_path` 直接写盘，否则返回 base64）、`POST /api/function/import-cases`（解析 xlsx 返回各工作表用例）。
- 数据模型：`CaseGroup` 新增 `cases: ImportedCase[]`（`{case_id, code}`）；`expand_cases` 将分组导入用例并入展开结果（带 `code` 字段），`build_testcase_can` / `build_test_case_list` 以 `code` 生成 `testcase` 块与用例列表。
- 前端导出：Electron 走系统「另存为」对话框后由后端写盘；无 Electron 时回退 base64 触发浏览器下载。

**相关文件**：
- `backend/services/function_case_excel.py`（新增）
- `backend/services/function_graph.py`
- `backend/api/function_routes.py`
- `frontend/src/views/FunctionView.vue`
- `frontend/src/api/function.ts`
- `frontend/src/types/functionGraph.ts`

**发布状态**：已发布到共享盘（version 1.0.6）

---

### [1.0.6] - 2026-09-15

**会话主题**：图形化配置按分组隔离 + 新建分组默认空 + 预览页分组可收起

**功能**：Function 模块「图形化配置」的**卡片库（故障注入/序列/检查）、对象映射表、值资源库**下沉到分组级；新建分组内容**默认空**；全局库保留为**模板**（手动导入/导出）；预览页每个分组卡片可**收起**。

**变更内容**：

- **数据模型**（`frontend/src/types/functionGraph.ts`）：
  - `CaseGroup` 新增 `cards?` / `mapping?` / `valueLibrary?` 三个分组级字段。
  - 新增 `emptyCaseGroup(name)` 工厂（三者为空）、`EMPTY_CARDS` / `EMPTY_MAPPING` / `EMPTY_VALUES` 常量、`emptyValueLibrary()`。
  - `emptyGraph()` 的默认分组改为 `emptyCaseGroup` 语义，并保留 `graph.frames` 与 `groups[0].frames` 的共享镜像引用。

- **编辑器**（`frontend/src/components/graph/FunctionGraphEditor.vue`）：
  - `cardLibrary` / `mapping` / `valueLibrary` 由独立 ref 改为**读写活动分组的计算属性**，切换分组即整体切换内容。
  - `ensureGroups()` 兼容旧配置：分组缺这些字段时用**配置级**内容迁移兜底（不丢数据），配置级为空则保持空。
  - `addGroup()` 用 `emptyCaseGroup`（内容全空）。
  - **移除全局库自动注入与自动写回**（原 `loadGlobal` 覆盖卡片库/映射表、`doGlobalSave` 自动写回）；改为只回写当前分组。
  - 新增「**导入全局模板**」/「**导出为全局模板**」两个显式操作（分组栏右侧，二次确认），复用既有 `getGlobalLibrary` / `saveGlobalLibrary`。

- **视图**（`frontend/src/views/FunctionView.vue`）：
  - `normalizeGraph` 补齐分组级 `cards`/`mapping`/`valueLibrary`（旧配置用配置级兜底迁移，深拷贝避免多分组共享引用）。
  - `addCaseGroup` 改用 `emptyCaseGroup`（内容为空）。
  - 移除无效的 `v-model:cards`（改为只读 `:cards` / `:value-library`）。
  - **预览页分组卡片支持收起/展开**（标题栏箭头切换，收起态为纯 UI 态不持久化）。
  - `currentData` 增加 `value_library`；配置级 `mapping`/`cards` 取第一个分组内容作为兜底。

- **后端**（`backend/services/function_graph.py`）：
  - `expand_cases` 分组分支改为**逐分组构建 lookup**（`mapping` / `cards` / `valueLibrary` 均分组级优先），缺失时回落配置级（旧配置兼容）。
  - 分组 `valueLibrary` 同时兼容 `value_library` 命名。

**验证**：
- 两个分组用同一 alias 指向不同对象名 → 各自用例解析到各自对象（`泊车 → setSignal(ParkingSig,1)`、`行车 → setSignal(DriveSig,1)`）。
- 旧配置（分组无 mapping）回落配置级解析正确；分组显式空 mapping 不回落（保留字面量）。
- 分组级值资源库隔离：仅定义该资源的分组做 `@list` 拆分，未定义的分组保留字面量。
- 前端 `npm run build`（`vue-tsc` + `vite build`）通过；后端 `py_compile` 通过。

**相关文件**：
- `frontend/src/types/functionGraph.ts`
- `frontend/src/components/graph/FunctionGraphEditor.vue`
- `frontend/src/views/FunctionView.vue`
- `backend/services/function_graph.py`

**发布状态**：已发布到共享盘（version 1.0.6）

---

### [1.0.6] - 2026-09-15

**会话主题**：修复分组隔离引入的「已有分组内容为空」「换分组后连线不加载」

**问题**：
1. 已有配置的用例分组（如 A47D 的 `FUNC_ADS_LDW`）打开后**故障注入 / 序列 / 检查 / 值资源库全为空**。原因：旧配置的分组没有分组级 `cards`/`valueLibrary` 字段，且配置级也为空，分组隔离后不再自动载入全局库（历史行为是打开编辑器即用全局库填充）。
2. **切换分组 / 数据回填后工况中的连线不加载**。原因：`CaseFrameCanvas` 的 `props.graph.frames` 被外部整体替换时只更新内部 `frames`、未重算连线（端口 DOM 就绪但 SVG 路径未重绘）。

**变更**：
- `FunctionGraphEditor.ensureGroups()` 记录「旧分组」（缺少分组级内容字段的分组 id）到 `pendingLegacyGroups`；新增 `migrateLegacyGroups()`：全局库加载完成后，把仍为空的旧分组 `cards` / `valueLibrary` / `mapping` 用全局库模板补全（深拷贝）。`onMounted` 改为 `await loadGlobal()` 后再迁移。
- 「新建分组」使用 `emptyCaseGroup` 带**显式空字段**，不会被判定为旧分组，保持「新建分组默认空」。
- `CaseFrameCanvas` 的 `frames` watch 增加 `scheduleRecompute()`，外部整体替换 frames 后重算连线。

**二次修复**（首次修复未生效的真实原因）：
1. **TDZ 错误**：`pendingLegacyGroups` 声明在 `ensureGroups()` 首次调用之后，一旦判定为旧分组即抛 `ReferenceError`（被 try 吞掉/表现为迁移不生效）。已把声明移到调用之前。
2. **旧分组判定恒为 false**：`FunctionView.normalizeGraph` 原先会给**每个**分组预先填入空的 `cards`/`mapping`/`valueLibrary`，导致编辑器无法区分「显式空」与「无该字段」，旧分组迁移从未触发。改为三条规则：
   - 分组**显式带**该字段 → 原样使用（含显式空，不迁移）；
   - 分组**无**该字段 + 配置级有内容 → 用配置级内容迁移；
   - 分组**无**该字段 + 配置级也为空 → **不写入**，交由编辑器在全局库加载后补全。

**验证**（Playwright 实测）：
- `A47D`：8 个工况框、**68 条连线**，故障注入/序列/检查卡片（`LDWlevel_high`、`SensorRs_oN`、`Check_EPS_LDWLevel_Low`）与值资源库（2 项）均正常载入，`pageerror` 为空。
- `A47B`（旧配置、无分组）：同样自动补全全局库卡片与值资源库。
- 新建分组：0 工况、0 连线、无卡片（默认空）。
- 前端 `npm run build`（`vue-tsc` + `vite build`）通过。

**相关文件**：
- `frontend/src/components/graph/FunctionGraphEditor.vue`
- `frontend/src/components/graph/CaseFrameCanvas.vue`
- `frontend/src/views/FunctionView.vue`

**发布状态**：已发布到共享盘（version 1.0.6）

---

### [1.0.6] - 2026-09-15

**会话主题**：CAN 模块测试参数自动匹配增强 + DTC_Data_array 数值修正 + 拖拽填充

**1. DTC_Data_array 数值修正（`backend/processors/excel_processor.py`）**

- `process_dtc_sheet()` 生成 `DTC_Data_array` 时，`NaN` 一律替换为 `0`（原样输出 `nan` 会导致 CAE 编译失败）。
- 整数值浮点（如 `100.0`）转为整型（`100`）；字符串类型（`Fun` / `Bus` / `Volt`）原样保留。
- DTC 码值 `strip()` 并去除换行，修复 `{0xD40283\n,Bus,...}` 这类换行污染。
- 前端双重保证（`frontend/src/views/CANView.vue`）：`collectConfigData()` 保存时把 DTC 数据列的空单元格（`''`/`null`/`undefined`）写为 `0`（DTC 码列除外）；`addDtcRow()` 新增行的数据列默认 `0`。

**2. 测试参数自动匹配增强（`frontend/src/views/CANView.vue`）**

- **非 EPS 信号 CRC / Counter**：`buildAutoSigTestParams` 把 CRC / Counter 关键词识别提取为公共判定（`Signal_Type` 列优先、信号名兜底），非 EPS 信号不再要求 `Data_Type = ENM/BLN`，同样生成 `SigInvalidTest`（`invalidType = CRC / Counter`）。
- **空 DTC 显示为灰色**：`hasParamData` 中 CRC / Counter 的判定改为**只认 DTC**（报值写死，不计入配置态）；未填 DTC 时卡片为灰色且不写入 `tp`，不生成对应用例。
- **非 EPS 报文默认自带 LostTest / DlcTest**：`buildAutoMsgTestParams` 由「有 `lostDtc`/`dlcDtc` 才生成」改为**默认始终生成两个**（EPS 报文除外）；未填 DTC 时为灰色。
- **修复 DBC 导入路径漏生成报文参数**：`buildSignalRowsFromRaw` 原报文分支是 `else if (rec.signalName)`，而 DBC/Excel 记录每行都带信号名，导致报文级参数永远不生成；改为按报文去重、与信号行是否带信号名无关。配置（dict）分支同样在无 `tp` 时补默认 LostTest / DlcTest。
- **新增布尔型自动匹配**：物理最小值 `0` 且最大值 `1` 时自动匹配 `SigInvalidTest`（`invalidType = Signal`，有效值 `0, 1`）。
- 加载配置兜底函数由 `autoMatchEpsCrcCounter` 泛化为 `autoMatchMissingParams`：非 EPS 报文补 LostTest / DlcTest，EPS 信号补 `et`，非 EPS 信号补 `SigInvalidTest`；均用 `hasParamData` 重算 `enabled`（只补空，不覆盖已保存参数）。

**3. 拖拽填充（`frontend/src/views/CANView.vue`）**

- **DTC 拖到测试参数标签** → 自动填充该参数「配置参数」里的 DTC 输入框（仅 `LostTest` / `DlcTest` / `SigInvalidTest` / `SigvalueInvalidTest`），并展开配置面板。
- **A2L 变量（测量/标定）拖到 FactorTest 标签** → 自动填充变量名输入框（取 `sysvar::XCP::<qualifier>::<name>` 形式，与其它 A2L 落点一致）。
- 标签新增拖拽悬停高亮样式；`addTestParamToNode` 在参数已存在但拖拽携带有效配置时改为覆盖更新，兼容「先配置再拖拽」流程。

**验证**：
- 合成 DBC 记录（非 EPS，无 DTC）：报文 → `LostTest` / `DlcTest` 灰色；CRC / Counter / 布尔型信号 → `SigInvalidTest` 灰色。
- 合成 DBC 记录（含 DTC）：报文 → `LostTest*` / `DlcTest*` 高亮；CRC / Counter 信号 → `SigInvalidTest*` 高亮。
- 真实配置 `E262S无刷`：7 个非 EPS 报文均带 LostTest / DlcTest；CRC / Counter / 布尔型信号自动匹配生效。
- 前端 `npm run build`（`vue-tsc` + `vite build`）通过。

**相关文件**：
- `backend/processors/excel_processor.py`
- `frontend/src/views/CANView.vue`

**发布状态**：已发布到共享盘（version 1.0.6）

---

### [1.0.6] - 2026-09-15

**会话主题**：CANCase.xml 改为「一个用例分组一个 testgroup」

**问题**：Function 模块生成的 `CANCase.xml` 中，**每个用例各自成为一个 `<testgroup>`**（`<testgroup title="FUNC_ADS_LDW_1"><capltestcase .../></testgroup>` …），分组层级丢失，与预期的「一个分组一个 testgroup」不符。

**变更**：
- `backend/services/function_graph.py`：`build_test_case_list` 为每个用例项补充 `group_id` / `group_name`，供 XML 生成按分组归集（分组名来自分组配置，兼容旧配置）。
- `backend/processors/function_processor.py`：新增模块级 `collect_cases_by_group(test_case_list, can_text)`，按 `group_name` 归集用例（保序、去重）；无 `group_name` 者归入 `TestCase`，未被列表覆盖的用例（从 `TestCase.can` 文本解析）补入 `TestCase`。
- `generate_output_files` 与 `backend/core/function_module.py` 的 `_xml_to_str` 均改为：遍历分组，把该分组下的用例作为其 `<capltestcase>` 子节点写入同一个 `<testgroup>`。

**验证**：
- 合成两分组配置 → `<testgroup title="GroupA">` 含 `GroupA_1`、`<testgroup title="GroupB">` 含 `GroupB_1`。
- 真实配置 A47D → 单个 `<testgroup title="FUNC_ADS_LDW">`，含 `FUNC_ADS_LDW_1` … `FUNC_ADS_LDW_20` 共 20 个 `<capltestcase>`；逐用例 `testgroup` 数为 0。

**相关文件**：
- `backend/services/function_graph.py`
- `backend/processors/function_processor.py`
- `backend/core/function_module.py`

**发布状态**：已发布到共享盘（version 1.0.6）

---

### [1.0.6] - 2026-09-15

**会话主题**：Signal_InvalidValue 卡片自动填充（信号名 + DBC 无效值）

**功能**：CAN 模块「其他配置参数」的 `Signal_InvalidValue` 卡片，自动填充树形图中非 EPS 节点的信号名；DBC 已填写「无效值」`Invalid_Value` 时自动填入对应输入框。

**变更内容**（`frontend/src/views/CANView.vue`）：

- 新增 `signalInvalidValueLookup`（信号名 → 无效值）：递归遍历 `mainDbcTree`，取 `type === 'signal'` 且 `msg.senders !== 'EPS'` 的 `fields.invalidValue`；用 `parseInvalidValueList` 归一化为后端期望的「逗号分隔数值」形式（如 `"0"` / `"0, 100"`），兼容 DBC / Excel 的列表字符串写法（如 `"[0,1]"`）。
- 新增 `fillSignalInvalidValuesFromDbc()`：以 `nonEpsSignals` 为范围、`signalInvalidValueLookup` 为数据源，**仅在当前为空时**补值，不覆盖已保存 / 人工填写的值（人工清空后不会被强制回填）。
- 新增 `watch([nonEpsSignals, signalInvalidValueLookup], fillSignalInvalidValuesFromDbc, { immediate: true })`：DBC 上传或配置切换导致树变化时自动补全。
- `loadConfig()` 在 `nextTick` 后追加一次 `fillSignalInvalidValuesFromDbc()` 兜底：覆盖「重复加载同一配置、lookup 未变化、watcher 不触发」的场景（`applyConfigData` 会先用配置值整体覆盖 `signalInvalidValues`，需再补空）。

**验证**（Playwright + 真实 dev server）：

- 上传含无效值的 DBC：非 EPS 信号全部列出（CRC 信号 `xChk_A` 正确排除）；`xSig1_A`（`iv=255`）→ 自动填 `"255"`；`xSig2_A`（`iv="[3,4]"`）→ 归一化为 `"3, 4"`；`xSig3_A`（无 `iv`）→ 保持空。
- 人工把 `xSig1_A` 清空后不会被回填（空值不覆盖语义正确）。
- 配置加载（dict 格式）：`xSigD1`（`iv=7`）→ 自动填 `"7"`；`xSigD2`（DBC 无 `iv`，配置已存 `42`）→ 保留 `"42"` 不被清空；CRC 信号 `xChkD` 正确排除。
- 前端 `npm run build`（`vue-tsc` + `vite build`）通过（0 类型错误）。

**相关文件**：
- `frontend/src/views/CANView.vue`

**发布状态**：已发布到共享盘（version 1.0.6）

---

### [1.0.6] - 2026-09-15

**会话主题**：修复单独加载 DBC 时无法提取信号无效值

**问题**：`Signal_InvalidValue` 卡片依赖 DBC 信号自带的无效值（`GenSigInactiveValue` 属性）自动填充；但 `/can/parse-dbc`（单独上传 .dbc）与 `/can/parse-dbc-from-cfg-dir` 共用 [\_parse_dbc_file](backend/api/can_routes.py) 解析 DBC 时，`无效值\nInvalid_Value` 列始终为空，导致单独加载 DBC 后卡片无法取到无效值。

**变更内容**（`backend/api/can_routes.py`）：

- `_parse_dbc_file` 在信号循环中新增「无效值」提取：读取 `sig.dbc.attributes.get("GenSigInactiveValue")`（与 `dbc_excel_converter.py` 中 DBC→Excel 的提取逻辑一致），无该属性时留空。
- 将提取到的 `invalid_value` 填入 `{columns, rows}` 中「无效值\nInvalid_Value」列（原为固定空字符串）。

**验证**：

- 构造带 `BA_ "GenSigInactiveValue" SG_ ... 255` 的最小 DBC，`_parse_dbc_file` 返回该信号无效值列为 `"255"`（此前为空）。
- 前端 `parseDbcRecords` 已按 `无效值\nInvalid_Value` 列映射到 `fields.invalidValue`，无需改动，端到端链路打通。
- `py_compile` 通过。

**相关文件**：
- `backend/api/can_routes.py`

**发布状态**：已发布到共享盘（version 1.0.6）

---

### [1.0.6] - 2026-09-14

**会话主题**：CAN 用例生成路径补齐 + 后端去 Qt5 控件名重命名

**一、补齐缺失的用例生成路径**

**问题**：后端 `excel_processor.py` 残留 Qt5 面板变量名（`busOffTxattCheckBox` / `busOffTxattComboBox` / `extendFrameCheckBox` 等），但 Web 界面无对应控件，导致部分用例没有生成路径：
- `busOffTxattComboBox` 前端从不写入 → TX 报文/信号级 BusOff 用例（`testcase_BusOffTxMsgAttribute/CRC/Counter`）被 `busOffTxattComboBox == 'TRUE'` 卡死，永远不生成。
- `extendFrameCheckBox` / `remoteFrameCheckBox` Web 里是开关滑块而非复选框 → ExtendFrame / RemoteFrame 用例不生成。
- `unexpectDlcLess/greater` 原本被注释 → DLC less/greater 用例不生成。

**变更**：
- 必需用例无条件生成（落在 `process_Other` 内部必测区）：
  - `Diag_14FFFFFF`
  - `ExtendFrame`（`testcase_TxExtendFrame`）
  - `RemotrFrame`（`testcase_TxRemotrFrame`）
  - `UnexpectDlc_less` / `UnexpectDlc_greater`
- `testcase_BusOffTxMsgAttribute/CRC/Counter` 改为**默认生成**，不再依赖 `busOffTxattComboBox`。
- 从 `config_group` / `config_handlers` 清理已无条件化或失效的条目，避免误报「无对应处理函数」。

**二、后端命名去 Qt5 后缀（以 case 缩写命名，一目了然）**

- 将 `excel_processor.py` 内部 `config_data` / `checkbox_states` 的 key 由 Qt5 控件名（`xxxLineEdit` / `xxxEdit` / `xxxComboBox` / `xxxCheckBox`）统一改为前端一致的 clean 名（如 `cddQualifier`、`busLoadRate`、`busOffTxatt`、`pwrStsFbDiagStop`）。
- 同步 `can_module.py` 的 `get_checkbox_key_map` / `get_other_key_map` / `get_config_key_map` 为同名映射（`key == value`），并修正前端真实 key 的大小写（`pwrStsFbDiagStop` / `readyOffDiagStop`）。
- 清理 `_map_config_keys` 中冗余的 `UsageModeLineEdit` 处理；`get_checkbox_controls_map` 的关联字段同步为 clean 名（保留 `*Label` 仅作说明）。

**相关文件**：
- `backend/processors/excel_processor.py`
- `backend/core/can_module.py`

**发布状态**：已发布到共享盘（version 1.0.6）

---

## [1.0.5] - 2026-09-14

**会话主题**：测试参数自动匹配与 Function 模块生成修复、EPS CRC/Counter 卡片修复

### 一、自动为报文和信号匹配测试参数

**变更内容**：
- 新增 `autoMatchTestParams` 函数：在 DBC 树加载时，自动为**全部报文和信号**匹配测试参数。
- 报文节点：根据 `lostDtc` 自动生成 `LostTest`、根据 `dlcDtc` 自动生成 `DlcTest`。
- 信号节点：根据 `signalType` / `invalidValue` / `minPhy` / `maxPhy` / `xcpVar` / `dtc` 自动生成 `SigInvalidTest` / `SigvalueInvalidTest` / `FactorTest`；EPS 信号自动生成 CRC / Counter 类型。
- 幂等处理：仅对尚无测试参数的节点补充，不覆盖用户已配置或已从配置加载恢复的测试参数。
- 挂接在 `watch(mainDbcTree)` 中：`treeData` 构建后、`mergeTestParamsIntoTree` 之前执行自动匹配。

**6. Function 模块生成逻辑修复**
- **报文 ID 声明去重**：修复 `RxMessageId` / `TxMessageId` 重复生成问题。`_inject_message_id_decls` 在注入前先删除文本中已存在的全部报文 ID 声明（含历史重复），再注入一份，保证幂等且收敛历史重复声明；`decls` 为空时也先清理历史声明。
- **CAN 模块函数隔离**：从 Function 模块模板 `func_test_function.py` 删除 CAN 专用电压函数（`CommunicationVoltage_Rise/Fall`、`DiagVoltage_Rise/Fall`），新增 `_strip_can_functions` 清理生成内容中混入的 CAN 函数（FIU* / ReadOCC / CommunicationVoltage_* / DiagVoltage_*），确保这些函数仅在 CAN 模块定义，Function 模块不再包含。
- **公共函数正确归属**：确认 FIU*、ReadOCC、VoltSet、Battery_Voltage_* 等公共支持函数保留在 Function 函数库，不被误删。
- **常量兜底**：生成前对 Function 内容做 `gcNonUnique → gcNot_Unique` 替换，避免 CAPL 拼写错误残留。
- **diagSendReq 渲染**：图形化用例的 diagSendReq/DiagSendRequest 步骤，先定义字节数组 `byte req[N]` 再调用，与 Excel 导入逻辑保持一致。
- **文件兜底**：`ArrayFuncTest.cin` 在配置未保存时回填默认模板，避免生成空文件；TestCase.can 补回标准 `#include "TestFunction.cin"` 头文件。

**相关文件**：
- `frontent/src/views/CANView.vue`
- `backend/core/function_module.py`
- `backend/templates/func_test_function.py`
- `backend/services/function_graph.py`
- `backend/processors/function_processor.py`
- `backend/api/function_routes.py`

---

### 二、修复加载配置后 EPS 的 CRC/Counter 卡片不显示

**问题现象**：
- DBC 导入时已能自动识别 EPS 信号的 CRC / Counter，但**加载已保存的配置**时，树形图里 EPS 信号的 CRC / Counter 卡片不显示（如 `E262S无刷` 配置）。
- 配置中仅少数信号保存了 `et`（如 `x1E5_Checksum_1E5` = `E2E_CRC`），其余 EPS 信号 `et` 为空；且配置加载路径为「配置优先」，不会走上传 DBC 的自动识别分支。

**变更内容**：
- 新增 `autoMatchEpsCrcCounter` 函数：配置加载完成后，**仅针对 EPS 信号、且该信号尚无 `target === 'eps'` 参数时**补全 CRC / Counter 卡片。
  - 取值优先级：先取配置里已保存的 `et` 值（如 `E2E_CRC`），无则按信号名 / `signalType` 自动识别（与导入时的规则一致）。
  - 幂等且只补空，不覆盖配置中已保存的其他测试参数。
- 挂接点：在 `watch(mainDbcTree)` 的「配置加载」分支（`dbcRaw` 为空）追加调用；并在 `loadConfig` 内 `applyConfigData` 后于 `nextTick` 兜底调用一次，保证树构建完成后稳定生效。

**验证结果**（TRAE 自带浏览器，加载 `E262S无刷`）：
- `x1E5_Checksum_1E5` → `E2E_CRC`（保留配置值）
- `x1E6_Checksum_1E6`、`x2D8_Checksum_2D8` → `CRC_CheckSum`（按名识别）
- 各 `*_Counter_*` → `Counter`
- 说明：`x13D` / `x17D` / `x1E9` / `x2D0` 的 Checksum / Counter 位于 `Node_*`（非 EPS）发送方下，不属于 EPS 自动补全范围，按设计不处理。

**相关文件**：
- `frontend/src/views/CANView.vue`

**发布状态**：已发布到共享盘（version 1.0.5）

---

## [1.0.4] - 2026-09-11

**会话主题**：修复自更新覆盖安装导致用户配置丢失的问题

**变更内容**：
- 可写数据目录（`configs/`、`uploads/`、`outputs/`）在打包运行环境从「exe 同目录」改为 `%APPDATA%\Excel2Case`，彻底脱离安装目录，避免 NSIS 覆盖安装的 `RMDir /r $INSTDIR` 清空安装目录时连带删除数据。
- 新增旧数据迁移逻辑：升级后首次启动时，自动把旧版「exe 同目录」下的 `configs/`、`uploads/`、`outputs/` 迁移到新数据目录（仅目标为空时迁移，不覆盖新数据）。
- 自更新启动安装器前，新增用户数据备份（双保险）：若检测到数据仍在安装目录内，会先复制一份到 `%APPDATA%\Excel2CaseBackup\`。

**相关文件**：
- `backend/config.py`
- `frontend/electron/main.js`

**发布状态**：已发布到共享盘（version 1.0.4）

---

## [1.0.3] - 2026-09-11

**会话主题**：修复打包后配置无法持久化的问题

**变更内容**：
- 修复打包后「拉取配置 / 保存配置」重启丢失的问题：打包（PyInstaller frozen）环境下，可写数据目录（`configs/`、`uploads/`、`outputs/`）此前指向 `sys._MEIPASS` 临时解压目录，导致配置在程序退出后丢失；现已改为指向 exe 所在目录（持久化）。
- 在 `config.py` 中新增 `get_data_dir()` 与 `DATA_DIR`，区分「只读资源目录」（`BASE_DIR`，仍为 `_MEIPASS`）与「可写数据目录」（`DATA_DIR`，frozen 下为 exe 同目录），并据此调整 `CONFIGS_DIR` / `UPLOAD_FOLDER` / `OUTPUT_FOLDER`。
- 开发环境（非 frozen）`DATA_DIR == BASE_DIR`，路径不变，无副作用。

**相关文件**：
- `backend/config.py`

**发布状态**：已发布到共享盘（version 1.0.3）

---

## [1.0.2] - 2026-09-11

**会话主题**：CAN 模块测试参数与 DTC 表格交互优化

**变更内容**：

**1. FactorTest 测试参数修复**
- 修复 FactorTest 默认填充但变量为空时仍显示高亮（configured）的问题：`hasParamData` 增加「变量名非空」前置校验，树合并时 `enabled` 统一按 `hasParamData` 计算，参数为空时不再高亮。
- EPS 类型（`target === 'eps'`）补充 `hasParamData` 判定，避免 EPS 类型选择项丢失高亮。
- 修复手动输入 / 自动遍历切换按钮无响应问题：将原深层 watch 拆分为独立的 `autoRange` 与 `testValues` 监听，切换自动遍历时清空测试值，手动输入时切回手动模式。

**2. 测试参数面板条件显隐**
- SigInvalidTest 选择 CRC / Counter 时隐藏「报 DTC 值」「不报 DTC 值」输入框（后台值写死，仅 Signal 类型需要填写）。
- FactorTest 自动遍历模式下隐藏「测试值」输入框。

**3. DTC 故障码列表滚动与表头修复**
- 修复纵向滚动条失效问题：移除覆盖 `overflow-y: auto` 的多余 `overflow: hidden`。
- 修复滚动时表头与内容重叠：表头背景由透明的 `var(--bg-sidebar)` 改为不透明的 `var(--bg-card)`。
- 修复表头文字溢出换行成两排：`.col-name` 增加 `min-width: 0`，使 flex 项可正确收缩显示省略号。
- 表头基础列（前 4 列）补全 `title` 悬停提示。
- 增加横向滚动条（列多时）。

**4. DTC 表格 Excel 式交互**
- 支持鼠标拖拽框选单元格区域（anchor/focus 矩形选区）。
- 支持 Ctrl+C / Ctrl+V 自由复制粘贴（TSV 格式，兼容 Excel）。
- 粘贴支持「循环平铺」填充（复制一行多列可铺满多行多列目标区域）。
- 支持方向键移动选区、Shift+方向键扩展、Enter/F2 进入编辑、Tab 提交并右移。
- 支持 Delete / Backspace 清除选中区域内容。
- 整行选中与自由单元格选区互斥（同一时刻仅一种聚焦状态）。

**5. DTC 表格列宽自适应与自由调节**
- 列宽根据列名与内容自适应估算（60px~360px）。
- 表头单元格右边缘新增拖动条，支持鼠标拖拽自由调节列宽。

**6. 对象浏览器 DTC 卡片优化**
- DTC 卡片内容（故障码、描述、详情）合并为单行展示，卡片高度调小。
- 双击 DTC 卡片弹出详情对话框，展示该 DTC 的全部字段。

**相关文件**：
- `frontend/src/views/CANView.vue`
- `frontend/src/components/DtcCardList.vue`
- `frontend/src/components/ObjectPanel.vue`

**发布状态**：已发布到共享盘（version 1.0.2）

---

## [1.0.1] - 2026-09-10

**会话主题**：Electron 自动更新功能

**变更内容**：
- 新增 Electron 菜单栏「帮助 → 检查更新」菜单项。
- 新增基于 JSON 的自更新检测逻辑：扫描共享盘更新目录内的 `.json` 文件，解析 `version` / `release_notes` / `setup_name`。
- 新增后台自更新功能：
  - 下载进度弹窗（进度条 + 百分比）。
  - 从网络共享目录流式下载安装包到本地临时目录。
  - 下载完成后启动安装程序。
- 「关于」弹窗版本号改为动态读取 `app.getVersion()`，随升级更新。
- exe 命名保持 `#Excel2Case#V1.0.00` 不变。

**更新配置**（`version.json`）：
```json
{
  "version": "1.0.1",
  "release_notes": "优化：\n- 新增菜单栏“检查更新”\n- 支持后台自更新",
  "setup_name": "#Excel2Case#V1.0.00 Setup 1.0.1.exe"
}
```

**共享盘路径**：`\\172.28.4.125\装机工作软件\工具软件\Excel2Case`

**相关文件**：
- `frontend/electron/main.js`（检查更新 + 自更新逻辑）
- `frontend/package.json`（版本号 source of truth）
- `build.py`（打包入口）

**发布状态**：已发布到共享盘

---

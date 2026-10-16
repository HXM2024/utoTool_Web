---
name: testcase-to-function-group
description: 把 Excel 用例库、CAN DBC 与需求文档转换成 AutoTool Function 分组 JSON，卡片的 CAPL 实现联合 capl-testcase-authoring 技能完成。当用户要求依据用例库生成 分组/Function JSON 时使用。不适用于一般性的 JSON 编辑。
---

# 用例库 → Function 分组 JSON

产出一份 Function 模块可导入的 `autotool-function-groups` v1 文件（工况框 / 卡片库 / 映射表），输入是 用例库 Excel + 对应 DBC + 需求文档。

权威数据模型（改动前先读）：`frontend/src/types/functionGraph.ts`。
格式说明：`Function分组文件_JSON解析经验.md`。生成器：`backend/services/function_graph.py`。
可复用卡片词汇：`configs/function/Function_global_library.json`。

配套技能：编写/补全卡片的 CAPL 动作时，**联合加载 `capl-testcase-authoring` 技能**，用其中的故障类型→CAPL 机制映射来决定卡片步骤（见第 3 节）。

## 1. 读取输入

- **Excel 用例库** —— `openpyxl`，`data_only=True`。表头通常是合并单元格，先逐格 dump 成 `ROW r COL c: 值` 并记录 `ws.merged_cells.ranges` 再解析；不同 sheet 通常对应不同测试项。
- **DBC** —— 按 **GBK** 解码：`open(path, encoding='gbk', errors='replace')`。解析 `BO_ <id> <name>: <dlc> <node>` 与 `SG_ <name> : <start>|<len>@<endian><sign> ...`。
- **需求文档 (.docx)** —— 若文件头不是 `PK`，说明是透明加密（如 `%TSD-Header-###%`），此时 `python-docx` 与 `zipfile` 都会失败。改用 Word COM 读取（`win32com.client.Dispatch("Word.Application")`，再取 `Document.Paragraphs` / `Document.Tables`），或请用户提供解密副本。
- **通信矩阵 Excel** —— 若存在平台协议矩阵（如 `4_Matrix`），其中的 SignalName / 新ID / Description(hex) 列可用于确定报文 ID 与信号取值枚举。
- **参考分组文件** —— 超过约 128 KB 时用脚本读取，不要用文件读取工具。

信号名一律取自 DBC，取值语义取自需求文档或通信矩阵，不得臆造。

## 2. 规划工况框

流程能在一框内连完就一个工况一个 frame；连不完才拆成多个 frame。每个 frame 以其场景（测试子项）命名。frame 数量取满足流程的最小值。

## 3. 建卡片库

`cards` 是三桶结构：`{ "inject": [], "sequence": [], "result": [] }`。

- 复用一张 `设置信号` 基础卡，为重复动作（车速 / 请求 / 强度 / 电压 …）做包装卡。
- 包装卡声明 `params`，以 `{{参数名}}` 占位调用基础卡。
- **先联合 `capl-testcase-authoring` 技能判定故障机制，再落成卡片步骤**。其映射要点：报文超时/丢失→`testDisableMsg(报文)`；CRC/Checksum 故障→`EV_{信号}` 置 2、恢复置 1；Counter 故障→`EV_{信号}` 置 1、恢复置 0；传感器扭矩故障当前点火周期不可恢复（需走一次上下电，本项目实际函数名 `Ready_Off → IGoFF → IGoN → Ready_On`），传感器角度故障同周期可恢复；每个设置动作后必须跟等待时间。
- 该技能「待确认」清单里没定论的项（报文恢复接口、等待函数与时长约定），本技能一律按第 7 节留占位卡片，不要自行补。
- **传感器等继电器类动作**：本项目已废弃 `Sensor*` 系列函数，直接用 `RelayON(Ctr_state)` / `RelayOFF(Ctr_state)`。`Ctr_state` 是**继电器口位掩码，bit0 对应 1 号口**；默认口定义 `1=K15、2=传感器角度1、3=传感器角度2、4=传感器扭矩信号`。断开传感器 = `RelayOFF(14)`（14=0b1110，即断开 2/3/4 三路）。
- 步骤 `kind` 取最小可用：`set` / `reset`（带对象类型）、`call`、`check`、`wait_check`、`card`（卡片引用）、`loop_start` / `loop_end`；人工操作类（如加大负载触发热保护）用 `tester_prompt`。
- **判定方式按「被判定量的形态」选**：静态/稳态等值判定用 `check`（`SignalCheck(信号, 值)`）；**斜率、跟随性、峰值/幅度类判定一律考虑用 `限时检查`（`wait_check`）**，靠时间窗兜住过程量 ——
  - 等值取「等于/不等于期望值」→ `SignalWaitCheck[Not](sig, 值, time)`
  - 区间取「在/不在区间内」→ `SignalWaitCheck[Not](sig, 下限, 上限, time)`
  - 峰值/幅度取「大于期望值」→ `SignalWaitCheck(sig, X, 2X, time)`，上限由后端 `_fill_cmp_bound` 在**生成期**按两倍期望值补出（占位符、映射别名也能参与计算）；步骤上记 `waitCmp: "gt"`、`waitRange: true`、`waitNot: false`
  - 「一段时间内保持某值」用信号保持 `SignalWaitCheckKeep(sig, 值, time)`；需要「请求」斜率才用 `rate` / `ramp`
- 删除所有未被 frame 或其它卡片引用的卡片。

## 4. 连线

- `lanes`：恰好一个 `main` 泳道承载序列节点，其余 `other` 泳道放注入与结果节点。每个节点 id 只能出现在一个泳道里。
- 泳道从左到右的顺序为 **注入泳道 → `main` → 结果泳道**。连线不能跨越主序列，因此 `main` 泳道保持居中。
- `nodes` 与 `edges` 是**对象**（`Record<string, …>`），不是数组。
- 用 `seq:<seqId>@<stepId>` 把注入/结果节点锚定到真实序列步骤上。
- 每个注入节点给 `seq`（次序）与 `pair`（配对的结果），并在对应结果节点上镜像同一个 `pair`。
- 每个节点的 `refId` 与每处 `steps[].cardId` 都必须存在于本组卡片库。

## 5. 用脚本生成

不要手写 JSON。写生成器（放在交付目录之外），产出文件后立刻校验。手改节点或步骤 id 会让 `seq:…@<stepId>` 锚点悬空，而悬空连线是静默丢弃、不报错的。

## 6. 校验

运行 `scripts/validate_group_json.py <文件>`：

- `type == "autotool-function-groups"`，`groups` 是数组，`version <= 1`
- 所有 `cardId` / `refId` 在本组内可解析；所有 `seq:` 步骤锚点存在；无悬空连线端点
- 每个节点都归属某个泳道；每个 frame 恰好一个 `main` 泳道
- 每条来源用例 id 在 `caseNames` 中恰好出现一次

有错就改，改到零错误为止。

## 7. 汇报缺口

遇到无法确定的操作，留一张占位卡片 —— 一个 `fun` 以 `TODO_` 开头的 `call` 步骤，把缺失信息写进卡片 `description` —— 并把占位卡片清单和仍需补充的信息交给用户。不要臆造地址、阈值、超时时间或 DTC 编码。

## 常见坑

- 处理 `steps` 时不要重造步骤 id，锚点绑定在它们上面。
- `nodes` / `edges` 是对象，要遍历其值而不是对象本身。
- 分组缺 `cards` 是合法的，后端会回落到配置级卡片库。
- 同一分组映射表里 `alias` 重复时后者覆盖前者，结果取决于数组顺序。
- 交付物放工作目录，一次性脚本放临时目录。

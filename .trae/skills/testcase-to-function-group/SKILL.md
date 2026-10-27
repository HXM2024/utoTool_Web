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
- **判定方式按「被判定量的形态」选**：
  - 静态/稳态等值判定 → `check`：`SignalCheck(信号, 值)` / `SignalCheck(信号, 下限, 上限)`
  - 斜率、跟随性、峰值/幅度等**过程量** → `限时检查`（`wait_check`），靠时间窗兜住：
    - 等值 → `SignalWaitCheck[Not](sig, 值, time)`
    - 区间 → `SignalWaitCheck[Not](sig, 下限, 上限, time)`
    - 峰值/幅度「大于期望值」→ `SignalWaitCheck(sig, X, 2X, time)`，上限由后端 `_fill_cmp_bound` 生成期按两倍期望值补出；步骤记 `waitCmp:"gt"` / `waitRange:true` / `waitNot:false`
  - 「一段时间内保持某值」→ 信号保持 `SignalWaitCheckKeep(sig, 值, time)`（**单值版优先**，判定"保持等于某值"足够；确需区间才用 4 参版）
  - 需要**请求**斜率（下发而非验证）才用 `rate` / `ramp`
- **`kind:"call"` 传多参数时，必须用「形参行」写法**：`args[].key` 填**形参名**（或位置序号 `"1"`）、`args[].value` 填**实参**。若把信号名填进 `key`（"对象行"写法），后端按位置只取 `value`，会生成 `SignalWaitCheckKeep(1);` 这种**丢信号、参数不足**的残缺语句。可对照 `configs/function/Function_global_library.json` 里的既有卡片确认写法。
- 形参行**不要留空值**：空串参数会被 strict 规则当成"不参与"而整行丢弃，导致判定参数缺失（如 `SignalWaitCheckKeep(sig, 1, 2940)` 中间少一个参数）。用哪个重载就把那个重载的参数填满。
- **`kind:"check"` 一个参数行生成一条 `SignalCheck`**，不是一条多参调用。要生成**区间重载** `SignalCheck(sig, 下限, 上限)`（单条语句）必须用 `kind:"call"` + 形参行；用 `kind:"check"` 写两行会变成两条独立语句。
- **一条用例含多个注入步骤时，这些注入必须同 `seq` 同 `pair`**（如「先请求=1 再请求=0」是同一用例的两步）。给成不同 `pair` 会被展开成多条用例，导致用例数虚增、`caseNames` 与展开行数不匹配。
- 删除所有未被 frame 或其它卡片引用的卡片。
- 基线卡片（初始化 / 上电基线）会被全部用例引用，不要重复 `Init()` 已做的上下电与清故障；整体冗余与卡片耦合排查见第 4 节「逻辑冗余与卡片耦合：按整条用例排查」。

### 函数库用法速查（取自 `Function_global_library.json` 的 `function_library`）

判定类（均支持 `signal*` / `sysvarFloat*` / `sysvarInt*` 三种首参，均**重载**）：

| 函数 | 重载 |
|---|---|
| `SignalCheck` | `(sig, 值)`、`(sig, 下限, 上限)` |
| `SignalCheckNot` | `(sig, 值)`、`(sig, 下限, 上限)` |
| `SignalWaitCheck` | `(sig, 值)`、`(sig, 值, time)`、`(sig, 下限, 上限, time)` |
| `SignalWaitCheckNot` | `(sig, 值, time)`、`(sig, 下限, 上限, time)` |
| `SignalWaitCheckKeep` | `(sig, 值, time)`、`(sig, 下限, 上限, time)` |
| `testWaitForSignalKeepMatch` | `(sig, 值, time)` |
| `testWaitForSignalKeepInRange` | `(sig, 下限, 上限, time)` |
| `SignalWaitCheckRate` | `(Sig, timeout, CycleTime, limit)` |

激励 / 故障注入类：

| 函数 | 签名 | 说明 |
|---|---|---|
| `RelayON` / `RelayOFF` | `(byte Ctr_state)` | 继电器口**位掩码**，bit0↔1号口；口定义 `1=K15、2=传感器角度1、3=传感器角度2、4=传感器扭矩信号` |
| `VoltSet` | `(float Value)` | 设电压，如 `VoltSet(12)` |
| `BusOff_ON` / `BusOff_OFF` | `()` | 制造 / 恢复 BUSOFF |
| `Ready_On` / `Ready_Off` | `()` | 发动机（就绪信号）开 / 关 |
| `IGoN` / `IGoFF` | `()` | 上 / 下点火 |
| `OperationCycle` | `()` | 重新上下电 |
| `Unlock` + `diagSendReq(byte code[])` | | 诊断例程，如对中 `[0x31,0x01,0xAC,0x00]` |
| `SetSignalRate` | `(signal* Sig, float step, float num)` | 请求斜率 |
| `SetSignalRamp` | `(signal* Sig, dword CycleTime, float step, float max)` | 请求斜率(同步) |
| `Wait` | `(long time)` | 等待 |
| `Init` | `()` | 初始化 |

> 用到函数库里没有的函数名属于臆造，必须按第 7 节留占位卡片。

## 4. 连线

- `lanes`：恰好一个 `main` 泳道承载序列节点，其余 `other` 泳道放注入与结果节点。每个节点 id 只能出现在一个泳道里。
- 泳道从左到右的顺序为 **注入泳道 → `main` → 结果泳道**。连线不能跨越主序列，因此 `main` 泳道保持居中。
- `nodes` 与 `edges` 是**对象**（`Record<string, …>`），不是数组。
- 用 `seq:<seqId>@<stepId>` 把注入/结果节点锚定到真实序列步骤上。
- 每个注入节点给 `seq`（次序）与 `pair`（配对的结果），并在对应结果节点上镜像同一个 `pair`。
- 每个节点的 `refId` 与每处 `steps[].cardId` 都必须存在于本组卡片库。

### 主序列的等待与接线口：够用即可，测试逻辑优先

`_build_path` 的展开顺序是「主序列步骤 → 该锚点上的卡片」，**锚点只能表达"在某步前后插卡片"，无法让主序列步骤按用例号可选** —— 主序列里除首尾外的每一步都会无条件出现在每条用例中。

主序列**可以放 Wait**，而且需要时应该放：想在某个时间点上挂注入或结果，就得有对应的锚点步骤。干净形态不是"主序列零 Wait"，而是**不出现无意义的连续等待**。

- 主序列放 Wait 的正当理由：提供**接线口**来细化测试步骤（前置条件锚、激励锚、判定锚各挂一处），或某段流程确实需要延时。
- 要避免的只是**冗余叠加**：主序列的等待、注入卡结尾的等待、结果卡自带的等待三者撞在同一个时间点上。同一处位置保留一个等待即可。
- 前置设值（车速、请求、强度）优先**下沉到注入节点**，让主序列的锚点保持稳定；但这属于组织偏好，不是硬约束。
- **测试逻辑优先**：如果为了消除连续 Wait 会牺牲必要的接线口或时序语义，就保留 Wait，允许连续。判定正确性 > 代码整洁。

冗余反例（三处等待撞在一起，应当合并）：

```capl
Init(); Wait(1000);
setSignal(...); Wait(1000);
setSignal(...); Wait(500);
Wait(1000);            // ← 主序列锚点 Wait
Wait(1000);            // ← 结果卡自带 Wait
SignalCheck(...);
```

### 合并「真正冗余」的两类做法

不要靠删主序列接线口来消除连续 Wait，接线口要留着给后续细化步骤用。按来源合并：

1. **主序列内部相邻的多个 `Wait`**（in 锚点 + out 锚点挨在一起）→ 合并为 1 个，并把删掉那个的连线 retarget 到存活的 Wait。in/out 仍锚在同一 Wait 前后两侧，接线口语义不变。
2. **注入卡结尾 Wait + 紧随的主序列锚点 Wait** → 只剥离**注入卡结尾**那个，保留主序列的。两者语义都是"等激励稳定"，撞在同一时间点属重复。
   - 卡内部**中间**步骤的 Wait 不动（如 `重新上下电` 的 `Wait(2000) → IGoN → Wait(100) → Ready_On → Wait(3000)`，那是时序必需）。

判定标准：**同一时间点、同一目的的两个 Wait = 冗余**；目的不同的（上电就绪 vs 激励稳定 vs 判定超时）不算。实测 18 个工况框可把连续 Wait 从 119 对降到 2 对，余下 2 对分别是"上下电后等就绪 `Wait(3000)`"与"主序列接线口 `Wait(1000)`"，属正常保留。

自查方式：统计连续 `Wait(` 对数，逐条判断它们是「各有接线口/时序用途」还是「纯冗余」。前者保留，后者合并。

### 逻辑冗余与卡片耦合：按整条用例排查，不只看 `Init()`

冗余不只出现在初始化 / 上电基线。把每条用例当成**一条完整执行序列**（主序列基线 → 该用例的注入节点 → 结果节点）来审，分四层看：

| 层 | 典型冗余 / 耦合 |
|---|---|
| 框架层 `Init()` | `Init()` 已做的上下电、就绪、清故障被卡片又写一遍 |
| 基线卡片 | `card-init` / `card-power-on` 被全部用例引用，一步冗余 ×用例总数 |
| 用例步骤 | 同一信号在同一用例里被重复设成同值；同一事务（上下电 / 清故障 / 对中）做两遍 |
| 卡片之间 | 卡 A 建立的前置被卡 B 无条件覆盖；两张卡各带等待撞在同一时间点；同一阈值散落在多张卡 |

判定口径是**"是否改变最终状态 / 时序"**，不是"语句长得像不像"：

1. **同值覆盖** —— 同一信号连续两次写同一个值、中间无其它写入 ⇒ 后者冗余。
2. **前置重建** —— 前一张卡已把工况置成 X，后一张卡无条件又置成 X（如 `车速=0`、`Sts=2`）⇒ 后者冗余；但两者之间若执行过 `reset_all` 或上下电，则不算。
3. **事务重复** —— 一条用例里两轮上下电、两次清故障、对中后立刻取消 ⇒ 通常冗余，除非被测的就是该切换。
4. **等待叠加** —— 目的相同（等激励稳定）且撞在同一时间点 ⇒ 合并；目的不同（上电就绪 / 激励稳定 / 判定超时）保留。
5. **耦合冲突（比冗余更危险）** —— 卡 B 写入的量正是卡 A 判定所依赖的，或卡 B 的注入让卡 A 的前置失效（如判定可用性前把 `*Valid` 置 0）。这类必须回到需求逐条确认，**不能当"多余步骤"删掉**。

必须保留、不得为"精简"而动的：

- 测试点本身（车速扫描里的 `0km/h`、强度档位逐一验证、故意重复的请求序列）
- 形似而语义不同：`Req14`（清故障）≠ `0x19 02 01`（清完再读、确认无故障）
- 主序列锚点 `Wait`（连线落点，见上一节）；卡内部时序必需的 `Wait`（如 `重新上下电` 中间那段）

`Init()` 这一层的具体约定（LRA91 工程实测）：

```c
void Init() {
  K30=1; VoltSet(12);
  Ready_Off();            // PwrTrainSts=0
  Wait(500);
  IGoFF(); Wait(1000); IGoN();
  Ready_On();             // PwrTrainSts=2
  Wait(5000);
  Req14();                // 清故障
  Wait(1000);
}
```

即 `Init()` 已覆盖「下电 → 上电 → 发动机就绪 → 清故障 → 等待」。因此：

- **`card-init` 只写 `Init()` + `reset_all`**；`Init()` 末尾已有 `Wait(1000)`，不要再补 `Wait`。
- **`card-power-on` 只写「工况初始值 + 稳定等待」**（如 `PwrTrainSts=2`、`车速=0`、`Wait(2000)`），不再放 `IGoN` / `IGoFF` / `Ready_On` / `Req14`，更不要内嵌整轮「上电 → 下电 → 再上电」。
- `IGoN()` 紧跟 `Init()` 属纯冗余：两者之间只有 `reset_all`（只恢复信号、不动继电器）。
- 量化参考：646 条用例里多一轮上下电 ≈ 多 18 分钟空等，单条用例多 9 行 CAPL。

自查要**脚本化、覆盖全部用例**，不要抽样。用 `_flatten_card_steps` + `render_step_to_capl` 把每条用例展开成 CAPL 行后：

1. 按信号聚合 `set` 序列，找「连续同值写入」与「基线值被用例重复写」；
2. 统计基线 / 用例各自的 `diagSendReq`、上下电、对中次数；
3. 统计相邻 `Wait(` 对；
4. 列出「先置某值、随后又依赖该值做判定」的耦合点，人工过一遍。

先出清单再改，改完重跑，直到清单只剩「已确认为测试点 / 时序必需」的条目。

> 前提：涉及 `Init()` 的精简依赖目标工程保持「冷启动 + 清故障」约定。若某工程 `Init()` 是空实现，必须把 `IGoN` / 就绪 / 清故障 加回 `card-power-on`。

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
- 冗余排查要按整条用例链（`Init` → 基线卡 → 用例注入 → 结果卡）扫，只盯 `Init()` 会漏掉卡与卡之间的同值覆盖、事务重复和前置失效；耦合冲突优先于冗余，先确认再删。
- `nodes` / `edges` 是对象，要遍历其值而不是对象本身。
- 分组缺 `cards` 是合法的，后端会回落到配置级卡片库。
- 同一分组映射表里 `alias` 重复时后者覆盖前者，结果取决于数组顺序。
- 交付物放工作目录，一次性脚本放临时目录。

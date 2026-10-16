# Function 分组文件（.json）解析经验

> 面向「读懂 / 校验 / 二次开发」本工具导出的**分组文件**。
> 数据模型权威来源：`frontend/src/types/functionGraph.ts`；导出/导入实现：`frontend/src/views/FunctionView.vue`；后端消费：`backend/services/function_graph.py`。

---

## 1. 这是什么文件

`Function` 模块「导出 / 导入分组」产出的 `.json`。一个文件 = **若干分组（`CaseGroup`）**，每个分组是一份独立的图形化配置（工况框 + 卡片库 + 映射表 + 值资源库 + Excel 导入的用例）。

- **自给自足范围**：某个分组要展开成用例、生成 `TestCase.can` 所需的图形内容全在文件里（见第 5 节校验）。
- **不闭合范围**：函数库（函数体）、配置级参数（A2L/CDD 限定符、Ready 信号等）、CFG/DBC/A2L/CDD 数据库 —— 默认不带，需勾「含依赖导出」或另取（见第 6 节）。

命名约定（导出侧常量）：
- `type = "autotool-function-groups"`（`GROUP_FILE_TYPE`）
- `version = 1`（`GROUP_FILE_VERSION`）

---

## 2. 顶层结构

```jsonc
{
  "type": "autotool-function-groups",   // 固定；导入时强校验，不对直接拒收
  "version": 1,                          // 文件格式版本；> 当前支持版本时告警但仍尝试导入
  "exported_at": "2026-10-14T03:49:30.421Z",
  "source_config": "BYD_Function",       // 来源配置名；用于导入后「_来自<来源>」后缀
  "groups": [ /* CaseGroup[]，至少 1 个 */ ],
  "dependencies": { /* 可选，仅勾「含依赖导出」时出现 */ }
}
```

**解析要点**
- `type` 必须严格等于 `autotool-function-groups`，`groups` 必须是数组，否则不算本工具的分组文件。
- `source_config` 可能为空 → 导入侧回退用文件名（去 `.json`）。
- `dependencies` 是**可选新增字段**：老文件没有 → 不显示「同时应用依赖」；不认识的字段一律忽略，向后兼容。

---

## 3. 组内结构（`groups[i]`）

```jsonc
{
  "id": "group-mv0jh131-1me75",
  "name": "ADS_LDW",              // 用例名前缀 + 分组唯一标识（判重用 name，不是 id）
  "frames": [ /* CaseFrame[]：工况框 */ ],
  "cards":  { "inject": [], "sequence": [], "result": [] },  // 分组级卡片库（三桶）
  "mapping":{ "signals": [], "dtcs": [], "messages": [], "envvars": [], "a2l": [] },
  "valueLibrary": [ /* ValueResource[]：常量/列表/区间 */ ],
  "cases": [ /* ImportedCase[]：从 Excel 导入的用例，可选 */ ],
  "naming": "default" | "path"       // 命名策略，可选
}
```

**实测样例（BYD_Function / ADS_LDW）**：6 个工况框、`cards` 为 inject 29 + sequence 3 + result 10、`mapping` 为 signals 36 + envvars 1 + a2l 4、`valueLibrary` 0、无 `cases`、无 `naming`。

**解析要点**
- `cards` / `mapping` / `valueLibrary` / `cases` / `naming` **都是可选的**；缺失时后端回落到「配置级」内容（`function_graph.py` L2000 附近：`g.cards` 优先，无则用配置级）。二次开发读取时不要把缺失当异常。
- `cards` 是**三桶结构**（`inject` / `sequence` / `result`），不是扁平数组。桶名对应卡片类型 `CardType`。
- 分组判重、跨分组标识一律看 `name`；`id` 只在组内/前端引用有效，导入时会重生成。

### 3.1 工况框 `frames[]`（`CaseFrame`）

```jsonc
{
  "id": "frame-mv0n6efv-hkb1",
  "name": "震动强度",
  "lanes": [ { "id": "...", "type": "main|other", "nodeIds": ["node-..."], "width": 259.8 } ],
  "nodes": { "node-mv0n6pu3-cquuu": { /* Card，带 steps */ } },   // 对象（按 id 索引），不是数组
  "edges": { "edge-...": { "id": "...", "from": "...", "to": "...", "seq": 1, "pair": [1,2] } },
  "caseNames": [ /* 可选：按行序覆盖用例名，空串=用默认 */ ]
}
```

**解析要点**
- `nodes` / `edges` 都是 **`Record<string, ...>`（对象）**，不是数组 —— 遍历用 `Object.values()`。
- `lanes[].nodeIds` 决定节点的列位置与上下顺序；`type:"main"` 至多一个（主序列主干）。
- 旧数据可能仍带 `injects` / `recovers` / `sequenceId` / `results` 顶层字段（已迁移到 `lanes`），读取时应以 `lanes` 为准，旧字段仅作兜底。

### 3.2 卡片的步骤 `steps[]`（`CardStep`）

```jsonc
{
  "id": "step-mv0n4x0d-w26tw",
  "kind": "call",                  // 见下表
  "fun": "Wait",
  "args": [ { "key": "time", "value": "1000", "argType": "signal|sysvar|envvar|a2l|message|dtc" } ],
  "indent": 0
}
```

`kind` 全集：`call / set / reset / reset_all / wait / check / wait_check / rate / ramp / tester_prompt / loop_start / loop_end / raw / card`。

| kind | 生成语义（CAPL） |
|---|---|
| `call` | 原样函数调用，**不做对象类型判定** |
| `set` / `reset` | 按 `_obj_class` 分流：`EV_`→`putValue`、`sysvar::`→`sysSetVariable*`、其余→`setSignal` |
| `check` | `SignalCheck(信号, 值)`（无条件，不区分对象） |
| `wait_check` | `SignalWaitCheck(...)`，可带 `waitNot`（取反）/ `waitRange`（区间） |
| `rate` / `ramp` | 斜率请求；**分流只看 `argType`，不看 `EV_`/`sysvar::` 前缀**（与 `set/reset` 规则不一致，易踩） |
| `tester_prompt` | 人工确认弹窗；`prompt` 为提示文案，`time` 为超时（缺省 60000） |
| `loop_start` / `loop_end` | 循环；`loopMode` 为 `for`（次数）/`while`（条件） |
| `raw` | 直接输出 `raw` 行（最高自由度、无校验） |
| `card` | **卡片引用**：`cardId` 指向卡片库里的卡片，生成时递归展开其 `steps` |

**解析要点**
- 参数 `value` 可能是**映射表别名**（生成时解析成真实对象名）、**占位符 `{{参数名}}`**（引用卡片时用 `args` 覆盖）、或**值资源引用 `@const:/@list:/@range:名`**（展开时替换）。
- `argType` 是拖拽对象时写入的**类型标记**，后端据此决定生成哪个函数；手输的参数可能没有它（→ 走默认分支）。
- `kind:"card"` 的 `cardId` 必须在**同分组的 `cards` 三桶里存在**，否则该步会被跳过（悬空引用，不报错）。

---

## 4. 关键：id 与引用关系（最容易出错的地方）

```
分组 group.id
 ├─ frames[].id
 │   ├─ lanes[].nodeIds ─────► frames[].nodes 的键
 │   ├─ nodes[<id>].refId ───► cards 三桶里的 card.id   （节点=某张卡片的副本/引用）
 │   │                         nodes[<id>].steps[].cardId ─► cards 里的 card.id（步骤级引用）
 │   └─ edges{}.from / .to ──► 端口 key：
 │                             · node:<nodeId>                普通卡片口
 │                             · seq:<seqId>@<stepId>         序列步骤锚点（新格式）
 │                             · seq:<seqId>:<stepIdx>        序列步骤序号（旧格式，兼容）
 └─ cards / mapping / valueLibrary
```

**解析要点**
1. **序列连线锚在 `stepId`**：`seq:<seqId>@<stepId>`。步骤增删/重排后连线靠 `stepId` 跟随；**只要节点 `steps` 被整块替换成另一套 step id，锚点立刻全部悬空**（画不出线、也不参与展开）。这是本项目历史上出过的 bug，二次处理 steps 时必须保留 step id。
2. **旧格式 `seq:<seqId>:<stepIdx>`** 仍要兼容：按序号解析。判断时用 `body.rfind("@")` 区分（`function_graph.py` L1248-L1254）。
3. `node:` 前缀同时兼容更旧的 `inj:` / `rec:` / `res:` 键。
4. 卡片引用（`refId` / `cardId`）是**同分组内闭合**：跨分组不认。悬空引用静默跳过，不抛错。

---

## 5. 导入 / 校验清单（可直接照抄）

导入前对 `groups` 做一遍完整性检查（下面这几条都能在真实文件上跑通）：

| 检查项 | 判据 | BYD_Function/ADS_LDW 实测 |
|---|---|---|
| 结构判别 | `type === "autotool-function-groups"` 且 `groups` 是数组 | ✅ |
| 版本 | `version <= 1`（高了只告警） | ✅ 1 |
| 卡片引用闭合 | 所有 `steps[].cardId` ∈ 本组 `cards` 三桶的 id 集合 | ✅ 无缺失 |
| 节点引用闭合 | 所有 `nodes[].refId` ∈ 本组 `cards` 的 id 集合 | ✅ |
| 连线不悬空 | `node:` 端点 ∈ `frame.nodes` 键；`seq:...@<stepId>` 的 stepId ∈ 该序列节点某步的 id | ✅ 6 个框全部 dangling=0 |
| 全局标记 | `cards[].global` / `mapping[].global` 只是「随全局库同步」的标记，不影响本文件自洽 | 36 张卡片 + 40 条映射带 `global` |

**导入落点**（`appendGroupsToCurrent` / `makeGroupCopy`）：
- 只**重生成分组 `id`**，组内 frame/lane/node/edge/card 的 id **原样保留**（所以跨机器导入后，组内引用关系不变）；
- 分组**追加**到当前配置；重名加 `_来自<来源>` 后缀，仍撞则再 `_2`、`_3`…；
- 导入**不写盘**，需再点「保存」才落 `Function_configs.json`。
- 另有「覆盖同名分组」路径（`overwriteGroupsInCurrent`）：**沿用本地分组 id** 原地替换（换 id 会让 `activeGroupId` 等外部引用失配）。

---

## 6. `dependencies` 段（可选，勾「含依赖导出」才有）

```jsonc
"dependencies": {
  "function_library": "...",          // 全局库的 TestFunction.cin 正文（卡片里 kind='call' 的函数体来源）
  "step_library": [ /* 自定义函数 */ ],
  "config": {
    "a2lQualifierLineEdit": "ECUAPP_A47D_3758",
    "cddQualifierLineEdit": "ABS_ESP",
    "readySignal": "x341_The_back_indicator_amp",
    "readyOnValue": "1", "readyOffValue": "0",
    "oem": "BYD", "securityAlgo": "BYD_CBC",
    "ccp_var_types": { /* 符号名 → int|float|int64 */ }
  }
}
```

实测：`function_library` 72848 字符、`step_library` 0 条、config 如上。

**解析要点**
- 这是**补依赖**用的：分组自给自足，但 `kind:'call'` 的函数**函数体在全局库**（文件里只有名字）→ 跨机器导入若无函数库，生成的 `TestFunction.cin` 会缺函数体、CAPL 报未知函数。
- 导入侧默认**不应用**（不勾「同时应用依赖」）；勾选后：函数库走全局库接口（**只发 `function_library`/`step_library` 两段，按段合并**，不动库里的卡片/映射/值资源），配置参数写入当前配置内存（随「保存」落盘）。
- `step_library` 为空会**清空本机自定义函数**（导出即源机器的实际内容，是"忠实覆盖"）。
- `ccp_var_types` 回填时过滤非法值（只认 `int/float/int64`）。
- **不含**继电器配置、不含 CFG/DBC/A2L/CDD 数据库。

---

## 7. 常见坑速查

| 现象 | 根因 |
|---|---|
| 导入后连线全丢 | 处理 steps 时重造了 step id，`seq:...@<stepId>` 锚点悬空 |
| 旧文件线用 `seq:...:2` 读不出 | 只认新格式 `@stepId`，未兼容 `:<stepIdx>` |
| 某步生成时静默消失 | `kind:'card'` 的 `cardId` 在本组卡片库里不存在（跨分组引用） |
| 遍历节点/连线报"不是数组" | `nodes` / `edges` 是**对象**（`Record`），要用 `Object.values()` |
| 分组读出来是空的卡片库 | 该组没写 `cards`，属正常，后端会回落到配置级 |
| `setSignal(EV_xxx)` 看着不对 | 卡片用了 `kind:'call'` 直调 `setSignal` —— 该路径不做对象类型判定，应改用 `kind:'set'` |
| 同一映射别名两条、结果不稳定 | 同组内重复 `alias`，生成时"后者覆盖前者"，取决于数组顺序 |

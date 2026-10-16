# BYD\_Function 全局项漂移对账清单

- 数据来源：`configs/function/Function_configs.json`（配置 `BYD_Function`，4 个分组）＋ `configs/function/Function_global_library.json`
- 扫描方式：**只读**，未修改任何文件
- 分组长相：ADS\_LDW、ADS\_Ang、ADS\_Trq、APA
- **条目判定口径**：卡片按 `type + id`、映射按 `kind + 别名`、值资源按 `id || name`（与工具内部一致）；「内容一致」按 步骤(kind/fun/args) + 参数默认值 判等。

**使用方式**：在每条下面的 `圈定：` 里填 `分组名`（以该分组那份为准）、`保持现状`、或 `我来改`。

| 类别                | 条数            | 处理方式      |
| ----------------- | ------------- | --------- |
| ① 卡片内容漂移          | 13            | 逐条圈定基准版本  |
| ② 映射指向漂移          | 21            | 逐条圈定基准版本  |
| ③ 孤儿徽标（有标记、全局库没有） | 52 卡片 + 47 映射 | 整体决策（见 ③） |
| ④ 全局库里有、分组未引用     | 55            | 仅提示       |

***

## ① 卡片内容漂移（13 条）

### C1 · 设置信号

- key：`card|inject|card-mv0n6uoz-3cexl`
- 工况节点引用：直接 **47** 个，间接（经其它卡片）**113** 个
- 参数接口：SigName=''、Value=''、Time='1000'

| 分组           | 当前内容                                                                              |
| ------------ | --------------------------------------------------------------------------------- |
| ADS\_LDW     | **写法1**：调用 setSignal(signal={{SigName}} value={{Value}}) → 调用 Wait(time={{Time}}) |
| ADS\_Ang     | **写法2**：设置({{SigName}}={{Value}}) → 调用 Wait(time={{Time}})                        |
| ADS\_Trq、APA | **写法3**：调用 setSignal(signal={{SigName}} value={{Value}}) → 调用 Wait(time={{Time}}) |

`圈定：ADS_Ang`

### C2 · 信号检测\_无误差

- key：`card|result|card-mv0qusl4-znk1m`
- 工况节点引用：直接 **30** 个，间接（经其它卡片）**63** 个
- 参数接口：Sig1=''、Sig1\_Value=''、Sig2=''、Sig2\_Value=''、Sig3=''、Sig3\_Value=''、Sig4=''、Sig4\_Value=''、Sig5=''、Sig5\_Value=''

| 分组                | 当前内容                                                                                                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ADS\_LDW、APA      | **写法1**：检查({{Sig1}}={{Sig1\_Value}} {{Sig2}}={{Sig2\_Value}} {{Sig3}}={{Sig3\_Value}} {{Sig4}}={{Sig4\_Value}} {{Sig5}}={{Sig5\_Value}})                                                   |
| ADS\_Ang、ADS\_Trq | **写法2**：检查({{Sig1}}={{Sig1\_Value}} {{Sig2}}={{Sig2\_Value}} {{Sig3}}={{Sig3\_Value}} {{Sig4}}={{Sig4\_Value}} {{Sig5}}={{Sig5\_Value}} {{Sig6}}={{Sig6\_Value}} {{Sig7}}={{Sig7\_Value}}) |

`圈定：`

### C3 · 高压受限

- key：`card|inject|card-mv1pabkp-coz8l`
- 工况节点引用：直接 **5** 个
- 参数接口：

| 分组                         | 当前内容                                              |
| -------------------------- | ------------------------------------------------- |
| ADS\_Ang、ADS\_LDW、ADS\_Trq | **写法1**：调用 VoltSet(Value=18) → 调用 Wait(time=2000) |
| APA                        | **写法2**：调用 VoltSet(Value=18) → 调用 2000()          |

`圈定：`

### C4 · 高压

- key：`card|inject|card-mv1pbcem-9gbo4`
- 工况节点引用：直接 **5** 个
- 参数接口：

| 分组                         | 当前内容                                              |
| -------------------------- | ------------------------------------------------- |
| ADS\_Ang、ADS\_LDW、ADS\_Trq | **写法1**：调用 VoltSet(Value=25) → 调用 Wait(time=2000) |
| APA                        | **写法2**：调用 VoltSet(Value=25) → 调用 2000()          |

`圈定：`

### C5 · 低压受限

- key：`card|inject|card-mv1pbl3i-u918d`
- 工况节点引用：直接 **5** 个
- 参数接口：

| 分组                         | 当前内容                                             |
| -------------------------- | ------------------------------------------------ |
| ADS\_Ang、ADS\_LDW、ADS\_Trq | **写法1**：调用 VoltSet(Value=8) → 调用 Wait(time=2000) |
| APA                        | **写法2**：调用 VoltSet(Value=8) → 调用 2000()          |

`圈定：`

### C6 · 低压

- key：`card|inject|card-mv1pbvxy-m1oyf`
- 工况节点引用：直接 **5** 个
- 参数接口：

| 分组                         | 当前内容                                             |
| -------------------------- | ------------------------------------------------ |
| ADS\_Ang、ADS\_LDW、ADS\_Trq | **写法1**：调用 VoltSet(Value=7) → 调用 Wait(time=2000) |
| APA                        | **写法2**：调用 VoltSet(Value=7) → 调用 2000()          |

`圈定：`

### C7 · 电压恢复

- key：`card|inject|card-mv1pcdk7-jx3j5`
- 工况节点引用：直接 **5** 个
- 参数接口：

| 分组                         | 当前内容                                              |
| -------------------------- | ------------------------------------------------- |
| ADS\_Ang、ADS\_LDW、ADS\_Trq | **写法1**：调用 VoltSet(Value=12) → 调用 Wait(time=2000) |
| APA                        | **写法2**：调用 VoltSet(Value=12) → 调用 2000()          |

`圈定：`

### C8 · 检测低压故障

- key：`card|result|card-mv1pf7ou-s6cfy`
- 工况节点引用：直接 **5** 个
- 参数接口：

| 分组                | 当前内容                                                                                      |
| ----------------- | ----------------------------------------------------------------------------------------- |
| ADS\_Ang、ADS\_LDW | **写法1**：调用 TestReadDTC(expDTC=DTC\_L\_Battery mask=0 isExpected=1 unique=0)               |
| ADS\_Trq、APA      | **写法2**：调用 <空函数名>() → 调用 TestReadDTC(expDTC=DTC\_L\_Battery mask=0 isExpected=1 unique=0) |

`圈定：`

### C9 · 0x57\_Counter无效

- key：`card|inject|card-mv1q3953-gc3mv`
- 工况节点引用：直接 **3** 个
- 参数接口：

| 分组                | 当前内容                            |
| ----------------- | ------------------------------- |
| ADS\_LDW、APA      | **写法1**：调用 <空函数名>() → 引用卡片 设置信号 |
| ADS\_Ang、ADS\_Trq | **写法2**：引用卡片 设置信号               |

`圈定：`

### C10 · 0x57节点恢复

- key：`card|inject|card-mv1q3qoo-s9w3o`
- 工况节点引用：直接 **8** 个
- 参数接口：

| 分组           | 当前内容                                                                 |
| ------------ | -------------------------------------------------------------------- |
| ADS\_LDW、APA | **写法1**：引用卡片 设置信号 → 引用卡片 设置信号 → 引用卡片 节点丢失恢复                          |
| ADS\_Ang     | **写法2**：引用卡片 设置信号 → 引用卡片 设置信号 → 引用卡片 设置信号 → 引用卡片 设置信号 → 引用卡片 节点丢失恢复  |
| ADS\_Trq     | **写法3**：引用卡片 设置信号 → 引用卡片 设置信号 → 引用卡片 设置ADS\_SteerTqVld → 引用卡片 节点丢失恢复 |

`圈定：`

### C11 · 检测车速丢失故障

- key：`card|result|card-mv1q7fm7-4jfpk`
- 工况节点引用：直接 **2** 个
- 参数接口：Check=''

| 分组                    | 当前内容                                                                                                |
| --------------------- | --------------------------------------------------------------------------------------------------- |
| ADS\_LDW              | **写法1**：调用 TestReadDTC(expDTC=DTC\_L\_Battery mask=0 isExpected=1 unique=0)                         |
| ADS\_Ang、ADS\_Trq、APA | **写法2**：调用 TestReadDTC(expDTC=DTC\_L\_Battery mask=0 isExpected=1 unique=0) → Loop Start → Loop End |

`圈定：`

### C12 · 清除配置字

- key：`card|inject|card-mv1spp5r-dk92k`
- 工况节点引用：直接 **2** 个
- 参数接口：

| 分组           | 当前内容                                                                                                 |
| ------------ | ---------------------------------------------------------------------------------------------------- |
| ADS\_Ang     | **写法1**：调用 Unlock() → 调用 diagSendReq(code=\[0x2E,0xF1,0xA1,0,0,0,0,0,0,0,0x55]) → 调用 Wait(time=1000) |
| ADS\_Trq、APA | **写法2**：调用 Unlock() → 调用 diagSendReq(code=\[0x2E,0xF1,0xA1,0,0,0,0,0,0,0,0x55])                      |

`圈定：`

### C13 · 配置ADS

- key：`card|inject|card-mv1sv4qo-oguai`
- 工况节点引用：直接 **2** 个
- 参数接口：

| 分组                    | 当前内容                                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| ADS\_LDW、ADS\_Trq、APA | **写法1**：调用 Unlock() → 调用 diagSendReq(code=\[0x2e,0x21,0x00,0x0,0x0,0x0,0x0,0x81,0x39,0x10,0x9F]) → 调用 Wait(time=500)                       |
| ADS\_Ang              | **写法2**：调用 Unlock() → 调用 diagSendReq(code=\[0x2e,0x21,0x00,0x0,0x0,0x0,0x0,0x81,0x39,0x10,0x9F]) → 调用 Wait(time=500) → 调用 OperationCycle() |

`圈定：`

***

## ② 映射指向漂移（21 条）

> 同一条映射（同 kind + 同别名）在不同分组指向**不同对象名**，会直接改变生成代码（如信号 `setSignal` ↔ 环境变量 `putValue`）。

| 编号  | kind   | 别名                             | ADS\_LDW                                          | ADS\_Ang                            | ADS\_Trq                        | APA                                                   | 被引用                    | 圈定     |
| --- | ------ | ------------------------------ | ------------------------------------------------- | ----------------------------------- | ------------------------------- | ----------------------------------------------------- | ---------------------- | ------ |
| M1  | signal | `ADS_Ang_Active`               | 3                                                 | 2                                   | 3                               | 3                                                     | 1 卡片 / 1 步 / 13 个工况节点  | <br /> |
| M2  | signal | `ADS_Ang_NotActive`            | —                                                 | 0                                   | 1                               | 1                                                     | 0 卡片 / 0 步 / 15 个工况节点  | <br /> |
| M3  | signal | `ADS_Ang_Ready`                | —                                                 | 1                                   | 2                               | 2                                                     | 1 卡片 / 1 步 / 6 个工况节点   | <br /> |
| M4  | signal | `DTC_ADS_AngOver`              | 0x5A3C91 / 0x5B9600                               | 0x5A3C91                            | 0x5A3C91 / 0x5B9600             | 0x5A3C91 / 0x5B9600                                   | 0 卡片 / 0 步 / 1 个工况节点   | <br /> |
| M5  | signal | `x10C_Alive_counter_S`         | EV\_x10C\_Alive\_counter\_S                       | EV\_x10C\_Alive\_counter\_S         | EV\_x10C\_Alive\_counter\_S     | x10C\_Alive\_counter\_S / EV\_x10C\_Alive\_counter\_S | 2 卡片 / 6 步 / 7 个工况节点   | <br /> |
| M6  | signal | `x10C_Checksum_S`              | EV\_x10C\_Checksum\_S                             | EV\_x10C\_Checksum\_S               | EV\_x10C\_Checksum\_S           | x10C\_Checksum\_S / EV\_x10C\_Checksum\_S             | 2 卡片 / 6 步 / 10 个工况节点  | <br /> |
| M7  | signal | `x10C_VehicleSpeed_Status`     | —                                                 | EV\_x10C\_VehicleSpeed\_Status      | x10C\_VehicleSpeed\_Status      | x10C\_VehicleSpeed\_Status                            | 2 卡片 / 6 步 / 10 个工况节点  | <br /> |
| M8  | signal | `x10C_Vehicle_speed`           | x10C\_Vehicle\_speed                              | EV\_x10C\_Vehicle\_speed            | x10C\_Vehicle\_speed            | x10C\_Vehicle\_speed                                  | 1 卡片 / 4 步 / 0 个工况节点   | <br /> |
| M9  | signal | `x24C_Steering_mode_state`     | x24C\_Steering\_mode\_state                       | x24C\_Steering\_mode\_state         | EV\_x24C\_Steering\_mode\_state | x24C\_Steering\_mode\_state                           | 0 卡片 / 0 步 / 4 个工况节点   | <br /> |
| M10 | signal | `x4BF_Limit_mode_instruction`  | x4BF\_Limit\_mode\_instruction                    | EV\_x4BF\_Limit\_mode\_instruction  | x4BF\_Limit\_mode\_instruction  | x4BF\_Limit\_mode\_instruction                        | 1 卡片 / 4 步 / 0 个工况节点   | <br /> |
| M11 | signal | `x4E3_Steering_mode_Settings2` | x4E3\_Steering\_mode\_Settings2                   | EV\_x4E3\_Steering\_mode\_Settings2 | x4E3\_Steering\_mode\_Settings2 | x4E3\_Steering\_mode\_Settings2                       | 1 卡片 / 4 步 / 0 个工况节点   | <br /> |
| M12 | signal | `x57_ADS_LdwWarningCmd`        | x57\_ADS\_LdwWarningCmd                           | EV\_x57\_ADS\_LdwWarningCmd         | x57\_ADS\_LdwWarningCmd         | x57\_ADS\_LdwWarningCmd                               | 0 卡片 / 0 步 / 12 个工况节点  | <br /> |
| M13 | signal | `x57_ADS_LdwWarningCmdVld`     | x57\_ADS\_LdwWarningCmdVld                        | EV\_x57\_ADS\_LdwWarningCmdVld      | x57\_ADS\_LdwWarningCmdVld      | x57\_ADS\_LdwWarningCmdVld                            | 1 卡片 / 1 步 / 6 个工况节点   | <br /> |
| M14 | signal | `x57_ADS_SteerAgEna`           | x57\_ADS\_SteerAgEna                              | EV\_x57\_ADS\_SteerAgEna            | x57\_ADS\_SteerAgEna            | x57\_ADS\_SteerAgEna                                  | 7 卡片 / 12 步 / 27 个工况节点 | <br /> |
| M15 | signal | `x57_ADS_SteerAgVld`           | x57\_ADS\_SteerAgVld                              | EV\_x57\_ADS\_SteerAgVld            | x57\_ADS\_SteerAgVld            | x57\_ADS\_SteerAgVld                                  | 8 卡片 / 8 步 / 25 个工况节点  | <br /> |
| M16 | signal | `x57_ADS_SteerGainLevel`       | x57\_ADS\_SteerGainLevel                          | EV\_x57\_ADS\_SteerGainLevel        | x57\_ADS\_SteerGainLevel        | x57\_ADS\_SteerGainLevel                              | 0 卡片 / 0 步 / 3 个工况节点   | <br /> |
| M17 | signal | `x57_ADS_SteerTqEna`           | x57\_ADS\_SteerTqEna                              | x57\_ADS\_SteerTqEna                | EV\_x57\_ADS\_SteerTqEna        | x57\_ADS\_SteerTqEna                                  | 1 卡片 / 2 步 / 10 个工况节点  | <br /> |
| M18 | signal | `x57_ADS_SteerTqMod`           | x57\_ADS\_SteerTqMod                              | EV\_x57\_ADS\_SteerTqMod            | x57\_ADS\_SteerTqMod            | x57\_ADS\_SteerTqMod                                  | 1 卡片 / 1 步 / 1 个工况节点   | <br /> |
| M19 | signal | `x57_ADS_SteerTqVld`           | —                                                 | EV\_x57\_ADS\_SteerTqVld            | x57\_ADS\_SteerTqVld            | x57\_ADS\_SteerTqVld                                  | 2 卡片 / 2 步 / 5 个工况节点   | <br /> |
| M20 | signal | `x57_Checksum_057_S`           | x57\_Checksum\_057\_S / EV\_x57\_Checksum\_057\_S | EV\_x57\_Checksum\_057\_S           | EV\_x57\_Checksum\_057\_S       | x57\_Checksum\_057\_S / EV\_x57\_Checksum\_057\_S     | 2 卡片 / 8 步 / 16 个工况节点  | <br /> |
| M21 | signal | `x57_Counter_057_S`            | x57\_Counter\_057\_S / EV\_x57\_Counter\_057\_S   | EV\_x57\_Counter\_057\_S            | EV\_x57\_Counter\_057\_S        | x57\_Counter\_057\_S / EV\_x57\_Counter\_057\_S       | 2 卡片 / 8 步 / 11 个工况节点  | <br /> |

***

## ③ 孤儿徽标：带「全局」标记但全局库里没有（整体决策）

- 卡片 **52 条**、映射 **47 条**（基本是 BYD\_Function 的整套公共卡片库）
- 影响：徽标语义失效；「取消全局」会以错误前提动作；新建分组时不会带出这些项

整体选项（选一个）：

- **③-1 补进全局库**（推荐）：把分组里这些带徽标的条目按①统一后的版本 upsert 进 `Function_global_library.json`
- **③-2 清掉徽标**：当作各组本地条目，去掉 `global` 标记（全局库保持不变）
- **③-3 先不动**：仅记录

清单（卡片，前 20 条）：

| 卡片        | id                    |
| --------- | --------------------- |
| 设置信号      | `card-mv0n6uoz-3cexl` |
| 设置车速      | `card-mv0n87fg-mqi2b` |
| 开启发动机     | `card-mv0po06o-25p9n` |
| 关闭发动机     | `card-mv0pon29-qt2n9` |
| 开启点火      | `card-mv0q143c-49kmk` |
| 关闭点火      | `card-mv0q2cr3-qekw0` |
| 丢失节点      | `card-mv0qb4xk-ce46i` |
| 节点丢失恢复    | `card-mv0qcg8o-nukrf` |
| 信号检测\_无误差 | `card-mv0qusl4-znk1m` |
| 无故障       | `card-mv0rx3gw-flrba` |
| 设置0x4E3   | `card-mv1n72t0-b2zn4` |
| 断开Sent1   | `card-mv1ojj51-43sjb` |
| 断开Sent2   | `card-mv1omqdx-71a9h` |
| 断开Sent3   | `card-mv1onclx-upqp9` |
| 传感器恢复     | `card-mv1onmxp-9d6qh` |
| 检测扭矩故障    | `card-mv1oop0u-pb3lx` |
| 检测角度故障    | `card-mv1ouk12-7legv` |
| 断开所有传感器   | `card-mv1p73vq-llf4b` |
| 高压受限      | `card-mv1pabkp-coz8l` |
| 高压        | `card-mv1pbcem-9gbo4` |
| …         | 其余 32 条               |

`圈定：`

***

## ④ 全局库里有、分组未引用（55 条，仅提示）

全局库是跨配置共用的模板，当前配置没用到属正常，一般无需处理。

| 类别 | 名称                | key                   | 桶      |
| -- | ----------------- | --------------------- | ------ |
| 卡片 | LDWlevel\_high    | `card-mtth3hif-147no` | inject |
| 卡片 | LDWlevel\_low     | `card-mttoljcy-81o82` | inject |
| 卡片 | SensorRs\_oN      | `card-mttvbd6m-zvk10` | inject |
| 卡片 | SensorAs\_oN      | `card-mttvbe25-wqkz0` | inject |
| 卡片 | SensorNm\_oN      | `card-mttvbep4-zyggx` | inject |
| 卡片 | Sensor\_NoAll     | `card-mttvbfh7-3vmvw` | inject |
| 卡片 | VoltSet\_7V       | `card-mttvmcxj-nuujj` | inject |
| 卡片 | VoltSet\_8V       | `card-mttvmf4f-96cbc` | inject |
| 卡片 | VoltSet\_18V      | `card-mttvmfy3-xsfwt` | inject |
| 卡片 | VoltSet\_25V      | `card-mttvo9va-hmc9k` | inject |
| 卡片 | Lost\_0x57        | `card-mttvtjoh-36cne` | inject |
| 卡片 | Lost\_0x10C       | `card-mttvwa31-ijbhg` | inject |
| 卡片 | CRC\_0x57         | `card-mttvwrrq-zmi8w` | inject |
| 卡片 | VoltSet\_12V      | `card-mtuuamhp-r9xfv` | inject |
| 卡片 | CancelCalibration | `card-mtuxqa2c-kwonl` | inject |
| …  | 共 55 条            | <br />                | <br /> |


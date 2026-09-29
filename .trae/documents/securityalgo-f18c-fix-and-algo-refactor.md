# SecurityAlgo.cin：F18C 读取失败最小修复 + 其它算法优化方案

> 本方案分两段，互不耦合：
> - **Part 1（修复）**：最小改动，只动 `BYD_CBC_Unlock` 一个函数，解决"读取序列号失败"。
> - **Part 2（优化）**：对库内"其它算法代码"做优化，覆盖**诊断交互层**与**算法本体**两层。保持既有接口（不改返回类型、不抽公共封装）。

## 一、Summary

- 现象：BYD 解锁时总线上完成了 `22 F1 8C → 62 F1 8C …`（22 字节），报告却是 `读取序列号失败 / fail`。
- 根因：`BYD_CBC_Unlock` 读 F18C 只等 `testWaitForDiagResponse(req, 50)`；**22 字节多帧响应（FF+FC+CF×3）在 CANoe 诊断层完成重组超过 50 ms**，到点时 `diagGetLastResponseCode(req)` 还不是 `-1` → 判失败。参考实现 [EPS.can](file:///E:/Python/AutoTool_Web/Unlock/Unlock/EPS.can#L743-L751) 对同一请求额外补了 200 ms。
- 另有两处不符合实车流程：读 F18C **之前没有先切 `10 03` 会话**。

## 二、Current State Analysis

### 2.1 证据
- 抓包：`22 F1 8C` → `[10 16] 62 F1 8C 31 32 34` + `[30 …]`(FC) + `[21] 32 30 38 53 43 33 45` + `[22] 00 00 FF FF FF FF FF` + `[23] FF FF`；CANoe 组装为 22 字节：`62 F1 8C 31 32 34 32 30 38 53 43 33 45 00 00 FF FF FF FF FF FF FF`。
- 报告：`Elapsed time=50ms (max=50ms)` → `读取序列号失败`。→ 帧成功、CAPL 侧"等响应"耗尽 50 ms。

### 2.2 代码现状
[SecurityAlgo.cin](file:///E:/Python/AutoTool_Web/Unlock/Unlock/SecurityAlgo.cin#L1186-L1268) `BYD_CBC_Unlock`：
- [L1197](file:///E:/Python/AutoTool_Web/Unlock/Unlock/SecurityAlgo.cin#L1197)：`diagSetTarget(target)` 后**直接读 F18C**，没有 `10 03`。
- [L1206](file:///E:/Python/AutoTool_Web/Unlock/Unlock/SecurityAlgo.cin#L1206)：`testWaitForDiagResponse(req, 50)` —— 只有 50 ms，无多帧补偿、无 requestSent 等待、无 `diagSetP2Extended(-1)`、无 NRC78 处理。

其余流程（`_unlockSeedKeyFlow` [L882](file:///E:/Python/AutoTool_Web/Unlock/Unlock/SecurityAlgo.cin#L882)、`_unlockCmacFlow` [L1013](file:///E:/Python/AutoTool_Web/Unlock/Unlock/SecurityAlgo.cin#L1013)、`Geely30_CBC_Unlock` [L1097](file:///E:/Python/AutoTool_Web/Unlock/Unlock/SecurityAlgo.cin#L1097)）同样只写 50 ms，是同类隐患（放在 Part 2 处理）。

### 2.3 参考实现（EPS.can，工作正常）
- [_SendAndWriteReport](file:///E:/Python/AutoTool_Web/Unlock/Unlock/EPS.can#L776-L811)：`diagSendRequest` → `testWaitForDiagRequestSent(obj,500)` → `diagSetP2Extended(-1)` → `testWaitForDiagResponse(obj,50)` → 若 `diagGetLastResponseCode==0x78` → `testWaitForDiagResponse(obj,50*100=5000)`。
- 多帧补偿：[_Send_Diag_And_Get_CF](file:///E:/Python/AutoTool_Web/Unlock/Unlock/EPS.can#L743-L751) → 若 `diagGetLastResponseCode(SendData)==0` → 再 `testWaitForDiagResponse(SendData,200)`。
- 常量：`p2cmax=50`（[L59](file:///E:/Python/AutoTool_Web/Unlock/Unlock/EPS.can#L59)）、`N_Cr_Time=70`（[L55](file:///E:/Python/AutoTool_Web/Unlock/Unlock/EPS.can#L55)）。

### 2.4 数据库侧事实
`e:\Python\AutoTool_Web\cdd\` 下 6 个 CDD 均定义服务 `0x22`；`ABS_ESP` 存在于 BYD/SGWM/GEEA_3.0/GEEA_1.0/CheRy（ChangAn.cdd 无）。**只有 `cdd\SGWM.cdd` 定义了 DID 字面量 `F18C`（SGWM.cdd:5478-5497），`cdd\BYD.cdd` 没有**。→ `22 F1 8C` 必须继续手填原始字节，响应能否关联只能靠 ISO-TP + 足够长的等待。

### 2.5 引用现状
仓库内无任何 `#include "SecurityAlgo.cin"`；用户在自己的 CANoe 工程里手工调用。故只改 `SecurityAlgo.cin`，不动 `EPS.can` 与 `backend/`。

## 三、Part 1：最小修复（只改 `BYD_CBC_Unlock`）

范围为**该函数一个函数体**（[L1186-L1268](file:///E:/Python/AutoTool_Web/Unlock/Unlock/SecurityAlgo.cin#L1186-L1268)），不新增/改动任何其它函数，不抽公共封装，不改返回类型（保持 `void`）。

改动内容：
1. **顺序**：`diagSetTarget(target)` → `10 03` → `testWaitForTimeout(150)` → `22 F1 8C` → `27 03` → `27 04`。
2. **时序**：把 4 处 `diagSendRequest(x); testWaitForDiagResponse(x, 50);` 就地展开为 EPS.can 的时序（内联，不抽函数）：
   - `testWaitForDiagRequestSent(x, 500);`
   - `diagSetP2Extended(-1);`
   - `testWaitForDiagResponse(x, 50);`
   - 若 `diagGetLastResponseCode(x) == 0x78` → `testWaitForDiagResponse(x, 5000);`
   - 若 `diagGetLastResponseCode(x) == 0` 且该响应为多帧 → `testWaitForDiagResponse(x, 200);`
3. **多帧标记**：`22 F1 8C`(22B) 与 `27 03`(16 字节种子 → 18B 响应) 需要 200 ms 补偿；`10 03`、`27 04` 响应短，不需要。

改后骨架（其余算法/判定逻辑不变）：

```capl
void BYD_CBC_Unlock(char target[])
{
  diagRequest * req;
  byte serial[16], secretKey[16], ra[16], r[16];
  byte ecuKey[16] = {0x7d,0x0b,…};   /* 暂沿用 EPS.can，待实车确认 */
  byte iv[16]     = {0x11,0x22,…};
  int m;

  diagSetTarget(target);

  /* 1) 先切扩展会话 10 03 */
  diagResize(req, 2);
  DiagSetPrimitiveByte(req, 0, 0x10);
  DiagSetPrimitiveByte(req, 1, 0x03);
  diagSendRequest(req);
  testWaitForDiagRequestSent(req, 500);
  diagSetP2Extended(-1);
  testWaitForDiagResponse(req, 50);
  if(diagGetLastResponseCode(req) == 0x78)
    testWaitForDiagResponse(req, 5000);
  testWaitForTimeout(150);

  /* 2) 读 F18C —— 多帧，50ms 不够，补 200ms */
  testCaseComment("读取序列号");
  diagResize(req, 3);
  DiagSetPrimitiveByte(req, 0, 0x22);
  DiagSetPrimitiveByte(req, 1, 0xF1);
  DiagSetPrimitiveByte(req, 2, 0x8C);
  diagSendRequest(req);
  testWaitForDiagRequestSent(req, 500);
  diagSetP2Extended(-1);
  testWaitForDiagResponse(req, 50);
  if(diagGetLastResponseCode(req) == 0x78)
    testWaitForDiagResponse(req, 5000);
  if(diagGetLastResponseCode(req) == 0)
    testWaitForDiagResponse(req, 200);          /* ← 本次失败的直接修复点 */
  if(diagGetLastResponseCode(req) != -1) { testStepFail("读取序列号失败"); return; }
  if(DiagGetRespPrimitiveSize(req) != 22) { testStepFail("序列号长度错误"); return; }
  for(m = 0; m < 16; m++) serial[m] = DiagGetRespPrimitiveByte(req, m + 6);

  /* 3) 左移 3 位 + CBC 加密得密钥（不变） */
  _algo_leftMove(serial, 3);
  AES_CBC_Encrypt(secretKey, serial, 16, ecuKey, iv);

  /* 4) 取种 27 03 —— 多帧，同上补 200ms */
  diagResize(req, 2); DiagSetPrimitiveByte(req, 0, 0x27); DiagSetPrimitiveByte(req, 1, 0x03);
  diagSendRequest(req);
  testWaitForDiagRequestSent(req, 500);
  diagSetP2Extended(-1);
  testWaitForDiagResponse(req, 50);
  if(diagGetLastResponseCode(req) == 0x78) testWaitForDiagResponse(req, 5000);
  if(diagGetLastResponseCode(req) == 0)  testWaitForDiagResponse(req, 200);
  if(diagGetLastResponseCode(req) != -1) { testStepFail("请求种子失败"); return; }
  for(m = 0; m < 16; m++) ra[m] = DiagGetRespPrimitiveByte(req, m + 2);

  /* 5) 解密 → 反转 → 加密（不变） */
  AES_CBC_Decrypt(ra, ra, 16, secretKey, iv);
  _algo_reverse(ra, 16);
  AES_CBC_Encrypt(r, ra, 16, secretKey, iv);

  /* 6) 送钥 27 04（响应短，无需 200ms 补偿） */
  diagResize(req, 18); DiagSetPrimitiveByte(req, 0, 0x27); DiagSetPrimitiveByte(req, 1, 0x04);
  for(m = 0; m < 16; m++) DiagSetPrimitiveByte(req, m + 2, r[m]);
  diagSendRequest(req);
  testWaitForDiagRequestSent(req, 500);
  diagSetP2Extended(-1);
  testWaitForDiagResponse(req, 50);
  if(diagGetLastResponseCode(req) == 0x78) testWaitForDiagResponse(req, 5000);

  /* 7) 判定（不变） */
  if(diagGetLastResponseCode(req) == -1) testStepPass("ECU解锁成功");
  else testStepFail("ECU解锁失败");
}
```

## 四、Part 2：优化"其它算法代码"（两层）

### 2a. 诊断交互层优化（补齐时序，不改接口）
给下列三个既有流程补上与 Part 1 相同的时序（`testWaitForDiagRequestSent(500)` + `diagSetP2Extended(-1)` + NRC78→5000 + 多帧→200），**返回类型与调用方式保持不变**（`_unlockSeedKeyFlow`/`_unlockCmacFlow` 仍返回 `int`，`Geely30_CBC_Unlock` 仍为 `void`）：

| 流程 | 位置 | 需要补 200ms 多帧补偿的请求 |
|---|---|---|
| `_unlockSeedKeyFlow` | [L882](file:///E:/Python/AutoTool_Web/Unlock/Unlock/SecurityAlgo.cin#L882) | 无（`10 03`/4 字节种子/送钥响应都很短） |
| `_unlockCmacFlow` | [L1013](file:///E:/Python/AutoTool_Web/Unlock/Unlock/SecurityAlgo.cin#L1013) | `27 05` 取种（16 字节种子 → 18B 响应） |
| `Geely30_CBC_Unlock` | [L1097](file:///E:/Python/AutoTool_Web/Unlock/Unlock/SecurityAlgo.cin#L1097) | `22 F1 8C`（22B）、`27 05`（18B）；顺序保持 EPS.can 原样（先读 F18C 再开会话） |

说明：按你的要求**不抽公共函数、不改返回类型**，因此这三处是"同一段时序就地复制"——以少量重复换最小侵入。

### 2b. 算法本体优化（AES/CMAC/CBC 实现）
1. **MixColumns 提速**：新增 `_aes_xtime()`，把 `_aes128_encryptBlock` 里 MixColumns 的 `_aes_gmul(a,0x02/0x03)`（每列要跑 8 次循环的通用乘法）替换为 xtime 组合，去掉循环；`_aes_gmul` 保留给 InvMixColumns 使用。行为等价，可用自检向量验证。

```capl
/* GF(2^8) 乘以 0x02 */
byte _aes_xtime(byte a)
{
  if((a & 0x80) != 0)
    return ((a << 1) & 0xFF) ^ 0x1B;
  return (a << 1) & 0xFF;
}
/* MixColumns 每列改为：
   out0 = xt(a0) ^ (xt(a1)^a1) ^ a2 ^ a3
   out1 = a0 ^ xt(a1) ^ (xt(a2)^a2) ^ a3
   out2 = a0 ^ a1 ^ xt(a2) ^ (xt(a3)^a3)
   out3 = (xt(a0)^a0) ^ a1 ^ a2 ^ xt(a3) */
```

2. **自检补全**：把现有 `TestAES_SelfTest()` 扩展为覆盖 CBC 与 CMAC（用标准向量，返回 1=全部通过），便于任何改动后一键回归：
   - AES-128 单块：FIPS-197 C.1（已在用）。
   - AES-128-CBC：NIST SP 800-38A F.2.1（key `2b7e1516…`、IV `000102…0f`，4 块加解密）。
   - AES-CMAC：RFC 4493 的 16 字节用例（key `2b7e1516…`、msg `6bc1bee2…`，期望 `070a16b46b4d4144f79bdd9dd04a287c`）。

3. **一致性**：`AES_CMAC` 的 key/msg 参数顺序按 RFC 4493 语义，用上面的 CMAC 向量锁定，避免与 DLL 语义混淆（保留现有注释）。

## 五、Assumptions & Decisions

1. **根因判定为"多帧重组 > 50ms"**，依据是 EPS.can 对同一 F18C 读显式加了 200 ms。若 Part 1 改完仍失败，兜底方案是"不用 diag API 关联响应、改用 `testWaitForMessage(0x670)` 抓原始帧 + 自行拼 ISO-TP"（EPS.can 的 `_getMsg`/`_CheckCode`，[L568-616](file:///E:/Python/AutoTool_Web/Unlock/Unlock/EPS.can#L568-L616)、[L649-714](file:///E:/Python/AutoTool_Web/Unlock/Unlock/EPS.can#L649-L714)）——本次不实施，待你确认后再做。
2. **BYD 继续手填 `22 F1 8C`**：`cdd\BYD.cdd` 无 `F18C` DID。
3. **取序列号偏移仍为响应第 6..21 字节**（沿用 EPS.can 约定）。抓包数据段像 `"124208SC3E" + 00 00 + FF…`，若实车应取第 3..18 字节，只需把 `m + 6` 改成 `m + 3`；此点未定，本次不动。
4. **BYD 的 `ECU_Key` / `IV` 仍沿用 EPS.can 的取值**，未定；提供实车十六进制后替换那两个常量数组即可（与本次时序问题无关）。
5. **不抽公共响应函数、不改 `*_Unlock` 返回类型**（按你选择的"最小版"），Part 2 的 2a 以就地复制方式实现。
6. **不加额外诊断日志**，仅保留原有 `testCaseComment` / `testStepPass|Fail`。
7. 不改 `EPS.can`、不改 `backend/` 任何文件；库仍为纯 CAPL、无 DLL、无新增全局变量（`_aes_xtime` 是函数，不是全局量）。

## 六、Verification

1. **编译**：CANoe 编译含 `SecurityAlgo.cin` 的节点（`test.can`），0 error / 0 warning。
2. **Part 1 功能**：跑 BYD 解锁用例，报告应不再出现 `读取序列号失败`，最终 `ECU解锁成功`；并用 Trace 核对代码取到的 16 字节与 `62 F1 8C` 响应的第 6..21 字节一致。
3. **Part 2 回归**：
   - 调用一次扩展后的 `TestAES_SelfTest()`，确认 AES / CBC / CMAC 三组向量全部返回通过（1）。
   - 分别跑 `BYD_SeedKey_Unlock` / `Geely_CMAC_Unlock` / `Geely30_CBC_Unlock`，确认补齐时序后行为不变、调用方可编译（接口未变）。
4. **负向**：对错误 DID 触发一次，确认 200 ms 补偿不会掩盖真实失败（仍能正确 `testStepFail`）。
5. **编码**：`SecurityAlgo.cin` 改动后仍为 936/GBK、首行 `/*@!Encoding:936*/`、花括号配平。

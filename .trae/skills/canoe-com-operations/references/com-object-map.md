# Verified COM object map

Everything here was confirmed by live probing against CANoe 12.0 (x64) with a real 2-bus config. "Absent" entries matter as much as present ones — they are the paths that look plausible but do not exist.

## Application

| Member | Notes |
|---|---|
| `Networks` | Collection. `Count`, `Item(i)`. CAN1 and CAN2 are two separate entries. |
| `Networks(i).Name` | `'CAN1'`, `'CAN2'` |
| `Networks(i).BusType` | `1` for CAN |
| `Configuration` | Main config object |
| `Confirm` | Bool. Set `False` to suppress modal dialogs, restore afterwards. |

`Application` has no bus or node access of its own; everything goes through `Configuration`.

## Configuration

| Member | Notes |
|---|---|
| `FullName` | Absolute cfg path |
| `Save()` | Must be called explicitly after mutations |
| `Close(False)` | Closes without saving |
| `SimulationSetup` | Bus / node / database graph |
| `TestSetup` | Test environments |
| `GeneralSetup.DatabaseSetup.Databases(1).Name` | Database name, used to build `<db>::<var>` qualified names |
| `ECUs` | **Absent** — raises `<unknown>.ECUs` |

## SimulationSetup

| Member | Notes |
|---|---|
| `Buses` | Collection, 1-based |
| `Buses.Count` | 2 in a 2-bus config |
| `Buses(i).Name` | `'CAN1'` / `'CAN2'` |
| `Buses(i).Nodes` | Node collection — **visibility view only** |
| `Buses(i).Databases` | Collection. `Databases.Add(abs_path)` attaches a DBC |
| `Buses(i).Channels` | Collection, one channel per network |
| `Buses(i).BusType` | **Absent** — use `Application.Networks(i).BusType` instead |
| `Nodes` | Flat node list (also available at this level) |

## Node object (`SimulationSetup.Buses(i).Nodes(j)`)

Present:

| Member | Notes |
|---|---|
| `Name`, `FullName`, `Path`, `Active` | `FullName` is the `.can` / `.xml` file |
| `AttachedBuses` | Read-only set of buses this node owns. `Count`, `Item(i).Name` |
| `AttachBus(busObj)` | Add ownership. Argument is a **bus object** |
| `DetachBus(busObj)` | Remove ownership ("Assigned → Available") |
| `IsBusAttached(busObj)` | Bool |
| `IsGateway` | Bool **property**, not a method — calling it raises `'bool' object is not callable` |
| `Modules`, `TestModule`, `Inputs`, `Outputs`, `Compile` | |
| `StartNM`, `StopNM`, `RequestNM`, `ReleaseNM`, `StatusNM` | NM control |
| `StartDelay`, `StartDelayActive`, `StartDelayFromDb` | |
| `DriftJitter*` | Drift/jitter family |

Absent (all raise AttributeError):

`NodeLayerModules`, `Simulated`, `Channel`, `Bus`, `Network`, `CAPL`

So a node does **not** expose its bus through a property — ownership lives only in `AttachedBuses`.

## TestSetup

| Member | Notes |
|---|---|
| `TestEnvironments` | Collection |
| `TestEnvironments(i).Name` | e.g. `'FrameTest'`, `'power_Test'` |
| `.Items` | 40-member item collection. Wrap with dynamic dispatch (see pitfalls) |
| `.TestModules` | Same shape and same objects as `.Items` |
| `.Folders` | Usually `Count=0` |
| `.Save(path, False)` | Explicit path avoids a prompt |
| `.SaveAs`, `.ExecuteAll`, `.StopSequence`, `.Report`, `.Modified`, `.Enabled` | |
| `.Buses` | **Absent** |

## Test environment item (`Items(j)` / `TestModules(j)`)

40 members, identical shape for both collections:

`DebugMode`, `Enabled`, `ExecuteRepeatedly`, `ExecutionMode`, `FullName`, `Libraries`,
`Modules`, `Name`, `NumberOfExecutions`, `Path`, `Pause`, `PausingMode`,
`RandomizeEachCycle`, `Reload`, `Report`, `Resume`, `Sequence`, `SetExecutionTime`,
`SpecificationStyleSheet`, `Start`, `StartOnEnvVar`, `StartOnKey`, `StartOnMeasurement`,
`StartOnSysVar`, `Stop`, `TcpIpStackSetting`, `TestCasesExecutedInRandomOrder`,
`TestStateSysVar`, `TestVariant`, `Verdict`, `VerdictImpact`, plus COM plumbing.

Absent:

`Buses`, `References`, `XmlTestModuleFile`, `CaplTestModuleFile`

Consequences worth remembering:

- A CAPL test module (`FrameTest.can`) has `Modules.Count = 0`. Its bus configuration is **not** here — it is the node's `AttachedBuses` in `SimulationSetup`.
- An XML test module (`Power_Test.xml`) has `Modules.Count = 1` with the `.can` library underneath.

## Module object (`Items(j).Modules(k)`) — XML test modules only

| Member | Notes |
|---|---|
| `Name`, `FullName`, `Path`, `Enabled` | |
| `References` | Object exists but `Count` raises `com_error: 'References object not found.'` while nothing is assigned |

`References` surface (signatures read from the type library):

```text
Add(VT_BSTR Name)
Remove(VT_VARIANT index)
Item(VT_VARIANT index)
Count
_NewEnum
```

This is the XML test module's internal PDU/bus reference list. It is **not** the same thing as the CAPL Test Module "Buses" dialog, and writing here does not change node bus ownership.

## Bus-level element collections

| Member | Notes |
|---|---|
| `Buses(i).Databases.Add(path)` | Attaches a DBC |
| `Buses(i).Diagnostics.Add(...)` | Diagnostic descriptions |
| `DiagDescriptions.Add(Network, FilePath, EcuIdentifier)` | Correct arg order; first arg is the **network name** such as `'CAN1'`, not a path |
| `DiagDescriptions(<name>).SeedNKeyDLL` | Seed/key DLL binding |

## Bus type constants

`BUS_CAN = 1` in `canoe_cfg_parser.py`.

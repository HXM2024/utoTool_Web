---
name: canoe-com-operations
description: Operate CANoe via the repo backend COM wrapper. Use when modifying config generation (DBC, nodes, panels, sysvars, CDD, test modules, bus attachment) or debugging COM. Do not use for CAPL authoring.
---

# CANoe COM Operations

All CANoe COM access in this repo goes through `backend/utils/canoe_cfg_parser.py`. Never call `win32com` from a Flask request thread — CANoe must be driven from its dedicated COM thread.

## Entry points

| Need | Call |
|---|---|
| Open a cfg and keep the instance alive | `parse_cfg_via_canoe(cfg_path)` |
| New config from template | `new_canoe_config(save_path, can_fd=...)` |
| Add DBC | `add_database_to_config(dbc_path, channel=1)` |
| Add CAPL node | `add_node_simulation_to_config(capl_path, node_name, channel=1)` |
| Restrict node bus ownership | `restrict_node_buses(keep_bus="CAN1", node_names=None)` |
| Add panel | `add_panel_to_config(xvp_path)` |
| Add sysvars | `add_vsysvar_to_config(vsysvar_path)` |
| Add CDD + seed/key DLL | `add_cdd_dll_to_config(cdd_path, dll_path, oem, channel=1)` |
| XML test module | `create_test_environment(...)` |
| CAPL test module | `create_test_environment_capl(...)` |
| Save | `save_canoe_config()` |
| Read current cfg path | `get_canoe_cfg_path()` |

Each public function is a thin wrapper: `_execute_in_com_thread(_task_xxx, *args, timeout=N)`. To add an operation, write a `_task_xxx(ctx, ...)` that takes `ctx` first and `result_obj` last, then a wrapper.

Inside a task, get the app with `app = _open_cfg_if_needed(ctx, ctx.cfg_path)`. This reuses the already-loaded cfg when the path matches, so repeated tasks in one generation run are cheap. Always end a mutating task with `app.Configuration.Save()` — nothing is persisted otherwise.

## Verified object map

Only use attributes confirmed by live probing. Full table with the attributes that do **not** exist is in `references/com-object-map.md`.

```text
Application
├─ Networks(i)                       .Name .BusType     (CAN1, CAN2 = 2 separate networks)
└─ Configuration
   ├─ .FullName  .Save()
   ├─ SimulationSetup
   │  ├─ .Nodes                      flat node list
   │  └─ .Buses(i)                   .Name .Nodes .Databases .Channels
   │     └─ .Nodes(j)                node object:
   │            .Name .FullName .Path .Active
   │            .AttachedBuses       read-only set  (Item/Count)
   │            .AttachBus(busObj)   .DetachBus(busObj)   .IsBusAttached(busObj)
   │            .Modules .TestModule .Inputs .Outputs .Compile
   ├─ TestSetup
   │  └─ .TestEnvironments(i)        .Name .Enabled .Items .TestModules .Folders .Save(path,False)
   │     └─ .Items(j) / .TestModules(j)   same 40-member shape:
   │            .Name .FullName .Path .Libraries .Modules .Sequence
   │            .StartOnEnvVar .StartOnSysVar .StartOnKey .Verdict .Enabled
   │        └─ .Modules(k)           .Name .FullName .Path .References
   └─ GeneralSetup.DatabaseSetup.Databases(1).Name
```

## Bus ownership

CAN1 and CAN2 are two independent networks. A node belonging to both is a **gateway**. This is the mechanism behind a node "also being on CAN2".

- Read ownership with `node.AttachedBuses` (iterate `Item(i).Name`; `Count` works here).
- Remove with `node.DetachBus(bus_object)` — this is the "Assigned → Available" action.
- **The argument must be the bus COM object**, e.g. `cfg.SimulationSetup.Buses(2)`. A string raises `The Python instance can not be converted to a COM object`.
- **`Buses(n).Nodes` is a visibility view, not ownership.** After `DetachBus(CAN2)` the node still appears in `Buses(2).Nodes`. Never infer ownership from that collection.

There is no separate "test module bus" to fix. A test module's Buses dialog edits the **node's** `AttachedBuses`, so restricting `FrameTest` / `Power_Test` means detaching CAN2 from those nodes like any other.

### Where this lives in the repo

| Layer | Location |
|---|---|
| Implementation | `backend/utils/canoe_cfg_parser.py` → `_task_restrict_node_buses` (COM-thread body; the `DetachBus` loop is the removal step) |
| Public wrapper | `backend/utils/canoe_cfg_parser.py` → `restrict_node_buses(keep_bus, node_names)` |
| Call sites | `backend/core/great_canoe_module.py`, both `generate_full_config` and `generate_full_config_from_tree`, as `restrict_node_buses(keep_bus="CAN1")` after the test modules are added and before `save_canoe_config()` |

It iterates every node seen across all buses (deduplicated by name), detaches every bus other than `keep_bus`, re-attaches `keep_bus` if missing, then saves. Passing `node_names=None` covers all nodes, including ones added later such as `CAN` / `BusOff`.

## Pitfalls

Read `references/pitfalls.md` before touching an unfamiliar COM path. The expensive ones:

1. `hasattr(obj, "SomeProp")` returns False for genuinely absent COM properties, so `hasattr`-gated logic silently does nothing. Confirm the property exists by probing, not by `hasattr`.
2. `TE.Items` needs `win32com.client.dynamic.Dispatch(te.Items._oleobj_)` to bypass the gen_py cache.
3. Removing a Test Environment item raises a modal confirm dialog. Set `app.Confirm = False` around it, or update the item in place instead of removing.
4. `References.Count` raises `com_error (... 'References object not found.')` when nothing is assigned. Do not swallow it into `0` — that hides "no assignment" vs "read failed".
5. `te.Save(path, False)` needs an explicit path, otherwise CANoe prompts.
6. `_task_new_config` calls `Configuration.Close(False)` and only logs failures at debug level. If closing fails, the flow can fall through to `app.New()` and produce a blank config that silently lacks everything.

## Probing an unknown path

Do not guess attribute names. Copy `scripts/probe_template.py`, point it at the cfg, and run it. It reflects real member names and their VARTYPE signatures without writing anything. See `references/probing-recipes.md` for the read-only rules and the signature-reflection details.

Probe script convention: `python -m backend.probe_xxx "<cfg path>"`, `python` must run from the repo root, and read-only probes must print an explicit "未做任何修改" line so the reader can trust the result.

## Verify a mutation

Never report success from a bare COM return value. Re-read the state after writing, and compare before/after. A correct idempotent call reports `processed=[]` when nothing needed changing; treat a populated list as the actual change set.

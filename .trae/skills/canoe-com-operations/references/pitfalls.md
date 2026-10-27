# Pitfalls

Each item below cost real debugging time. Read before writing a new COM task.

## 1. `hasattr` hides missing properties

`hasattr(obj, "Prop")` returns `False` for a COM property that genuinely does not exist, because the underlying `AttributeError` is swallowed. Code shaped like this silently does nothing:

```python
if hasattr(item, "XmlTestModuleFile"):
    item.XmlTestModuleFile = path      # never runs
```

Real case: `XmlTestModuleFile` does not exist on `TestEnvironment.Items(j)`, so a "reuse module and update its path" branch never executed and the module was re-added every run.

Rule: probe for the property once, then write unconditional code. Do not gate behavior on `hasattr` for COM objects.

## 2. Dynamic dispatch for Test Environment collections

`te.Items` from the cached gen_py typelib can misbehave. Wrap it:

```python
import win32com.client.dynamic
items = win32com.client.dynamic.Dispatch(te.Items._oleobj_)
```

The same pattern is used for `libs` and for any collection returning stale wrappers.

## 3. Removing a test environment item prompts

`items.Remove(i)` or deleting a test module raises a modal CANoe dialog that blocks an unattended run.

Options, in order of preference:
1. Update the existing item in place (e.g. repoint its path) instead of removing it.
2. Wrap the call with `app.Confirm = False` and restore the previous value in `finally`.

Never leave a task able to block on a dialog.

## 4. `References.Count` raises instead of returning 0

```text
com_error: (-2147352567, '发生意外。',
  (0, 'References::Count', 'References object not found.', ...))
```

This means "nothing assigned" but arrives as an exception. `try: n = int(refs.Count) except: n = 0` hides the difference between empty and unreadable. Log the distinction.

## 5. `te.Save` needs a path

`te.Save(path, False)` with an explicit path writes silently. `te.Save()` or `te.Save(False)` can prompt. Always pass a path.

## 6. Signature reflection: `PyFUNCDESC` has no `elemdescFunc`

On this environment the descriptor exposes:

```text
args, cParamsOpt, callconv, desckind, funckind, invkind, memid,
oVft, rettype, scodeArray, wFuncFlags
```

There is **no** `elemdescFunc` and **no** `cParams`. Iterate `fd.args` for parameters and read `fd.rettype.vt` for the return type.

## 7. `_NewEnum` can loop forever

Manual `Next()` handling against `_NewEnum` is easy to get wrong and will spin indefinitely, printing empty tuples. Prefer indexed access (`Item(i)` / `collection(i)` up to `Count`) and treat enumeration as a fallback only.

## 8. Bus ownership is not in `Buses(n).Nodes`

`Buses(n).Nodes` is a visibility view. After `node.DetachBus(CAN2)` the node still shows up in `Buses(2).Nodes`. Reading ownership from that collection produces a wrong answer and looks convincing.

Read `node.AttachedBuses` instead.

## 9. Attach/Detach need the bus object

```python
bus = cfg.SimulationSetup.Buses(2)
node.DetachBus(bus)                 # correct
node.IsBusAttached("CAN2")          # raises: The Python instance can not be converted to a COM object
```

Signatures are `AttachBus(VT_DISPATCH aBus)`, `DetachBus(VT_DISPATCH aBus)`, `IsBusAttached(VT_DISPATCH aBus)`.

## 10. CAN1 and CAN2 are separate networks

`Application.Networks` has two entries, each with one channel. A node attached to both is a **gateway**, not an error. This is why the same `.can` file legitimately appears under both buses, and it is the mechanism to look for when a node "unexpectedly" talks on the other bus.

## 11. `Save()` is mandatory

No task persists automatically. A task that mutates without calling `app.Configuration.Save()` appears to work inside the process and loses everything on close.

## 12. `_task_new_config` can produce a blank config

It closes the current config with `Close(False)` and logs failures only at `debug`, then falls back to `app.New()`. If the close fails, the template open can fail too, and the run continues against a blank config that silently lacks DBC, nodes and panels. When a generated config looks empty, check the log order:

```text
关闭当前配置...
尝试使用模板创建配置: <template>
另存新配置到: <path>
```

If `使用模板 ... 失败` appears and `app.New()` follows, the output came from the fallback path, not from the template.

## 13. Never edit `.cfg` by hand

`canoe-config-agent` rule: go through COM metatools. Source artifacts (`.can`, `.cin`, `.cdd` are the exception) may be edited directly when a task requires it. A `.cfg` edited as text is not validated and drifts from CANoe's model.

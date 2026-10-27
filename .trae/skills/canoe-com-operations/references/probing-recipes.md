# Probing recipes

Find out what a COM path really is before writing code against it. Guessing attribute names produced several wrong fixes; probing produced the right one in one pass.

## Rules

1. **Read-only until the shape is known.** A probe may call `Count`, `Item(i)` and read properties. It must not call `Add`, `Remove`, `Save`, `Attach`, `Detach`, or `Assign`.
2. **Print an explicit no-write line** at the end (`未做任何修改`) so the reader can trust the output.
3. **Reflect, do not assume.** Get the real member list from `ITypeInfo` instead of trying plausible names.
4. **Never swallow exceptions silently** in a probe. A `com_error` is a finding — `References.Count` raising `'References object not found.'` is how we learned that object was unassigned.
5. **Diff before/after** for any write. Compare a specific read-back value, not the COM return code.

## Member reflection

```python
import pythoncom
disp = obj._oleobj_.QueryInterface(pythoncom.IID_IDispatch)
ti = disp.GetTypeInfo()
ta = ti.GetTypeAttr()

for i in range(ta.cFuncs):                 # methods
    fd = ti.GetFuncDesc(i)
    print(ti.GetNames(fd.memid)[0])
for i in range(ta.cVars):                  # properties
    vd = ti.GetVarDesc(i)
    print(ti.GetNames(vd.memid)[0])
```

Filter out the COM plumbing that appears on every object:

```text
Application Parent AddRef Release QueryInterface
GetIDsOfNames GetTypeInfo GetTypeInfoCount Invoke
```

## Signature reflection

`PyFUNCDESC` here exposes `args`, `rettype`, `memid`, `invkind`, `funckind`, `callconv`, `desckind`, `cParamsOpt`, `oVft`, `scodeArray`, `wFuncFlags`.

Use `fd.args` and `fd.rettype` — **not** `elemdescFunc` / `cParams`, which do not exist on this build.

```python
for pi, pa in enumerate(fd.args):
    vt = pa[0] if isinstance(pa, (tuple, list)) and pa else pa
    name = names[pi + 1] if len(names) > pi + 1 else "arg%d" % pi
    print(vt_name(vt), name)
```

`VT_DISPATCH` in a parameter position means the call expects a **COM object**, not a string. That single bit of information is what distinguishes `AttachBus(busObj)` from `AttachBus("CAN2")`.

Common `VARTYPE` values: `VT_BSTR` string, `VT_VARIANT` untyped, `VT_DISPATCH` COM object, `VT_BOOL`, `VT_I4`, `VT_UI4`.

## Reading a collection safely

```python
try:
    n = int(coll.Count)
except Exception as e:
    print("Count 读取失败: %s" % e)     # a finding, not zero
    n = 0
for i in range(1, n + 1):
    el = coll(i)
```

Prefer indexed `Item` access. `_NewEnum` + manual `Next()` is easy to leave looping forever printing empty tuples.

## Two probing patterns that paid off

**Compare two objects that differ in a known way.** `FrameTest` (manual state: CAN1 only) versus `Power_Test` (CAN1+CAN2) narrowed the owning object fast: `FrameTest` had `Modules.Count = 0` while `Power_Test` had 1, which proved the Buses dialog could not be the `Modules(k).References` path.

**Ask the user to change one setting by hand, then diff.** The hand edit proved the change is real and gave a known-good target state. Then a run of the automated path could be compared against it. Do not skip this when a dialog's backing property is unknown — it is usually faster than more reflection.

## Repo probes already written

These live in `backend/` and are read-only unless stated:

| Script | Purpose |
|---|---|
| `probe_testmodule_buses.py` | Test module bus/References surface |
| `probe_node_bus_dup.py` | Node/bus membership, per-bus sets, intersections |
| `probe_refs_v3.py` | `Items` vs `TestModules` vs `Modules(k).References` |
| `probe_bus_attr_v4.py` | Dump every readable property of TE items and modules |
| `probe_node_network.py` | `Application.Networks` vs `SimulationSetup.Buses`, node properties |
| `probe_attach_bus.py` | `AttachBus`/`DetachBus`/`IsBusAttached` signatures |
| `probe_frame_config.py` | Deep walk of TestSetup |
| `verify_restrict_node_buses.py` | Before/after idempotency check (writes via the task fn) |
| `detach_can2.py` | **Writes** — detaches CAN2 from given nodes and saves |

Run any of them with `python -m backend.<name> "<cfg path>"` from the repo root.

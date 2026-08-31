# `@pkgs/dst` — deterministic simulation testing

Fresh-agent context for the DST framework. Product apps/libs must not import this
package (depcruise: `product-no-sim-deps`). Harness-only: `@sim/*`, package
`sim/` / `tests/dst/`, and DST scenario tests.

## Purpose

Same seed → same timeline. The framework owns the **World** (deps, virtual clock,
scheduler, network mesh, node instances). Packages declare **node kinds** and a
**system topology** — they do **not** write package-local `openWorld` / World
DSLs / `runCommands` / `worldPropertyInputs` for DST.

## One authoring path

```text
defineNodeKind  →  defineDst(system)  →  assertDst / replayDst / assertDstFaultPins
```

| API | Role |
| --- | --- |
| `defineNodeKind` | How to boot/dispose a role (`sync.client`, `room.server`, …) |
| `defineDst` | Topology + knobs + library/domain actions + settle |
| `openDstWorld` | Framework constructs `DstWorld` (tests rarely call directly) |
| `assertDst` | PBT: sample seed×knobs×commands → model-run → play → settle |
| `replayDst` | Replay a fixed action list (scripted pins) |
| `assertDstFaultPins` | Named pin matrices over `replayDst` |

Low-level `assertDstProperty` remains for custom properties (e.g. dual-open
fingerprint equality). Prefer `assertDst` for command-world PBTs.

Kit / playground helpers (`openWorld({ domain })`, `openWorld({ module })`,
`createSim`) are **not** DST authoring — keep them for imperative scenarios.

## First-class nodes

```ts
defineNodeKind({
  id: 'sync.client',
  boot: async (ctx) => { /* use ctx.deps, ctx.network, ctx.system, ctx.nodesByRole */ },
  dispose: async (handle) => { … },
  endpoints: (handle) => [{ id: `http:${handle.nodeId}`, deliver }],
  view: (handle) => ({ /* typed surface for dispatch/settle */ }),
})
```

`NodeBootContext` supplies: `nodeId`, `role`, `index`, `deps`, `scheduler`,
`network`, `knobs`, `faults`, mutable `system` bag, already-booted `nodesByRole`
/ `nodesById`.

Topology in `defineDst`:

```ts
nodes: [
  { kind: 'sync.broker', role: 'broker', count: 1 },
  { kind: 'sync.server', role: 'server', count: 1 },
  { kind: 'sync.client', role: 'client', countFromKnob: 'clientCount', idFor: (i) => `c${i}` },
]
```

Boot order = declaration order. Framework registers endpoints and owns dispose.

## Framework `DstWorld`

Control ports: `runFor` / `runUntilIdle` / `until` / `never` / `partition` /
`heal` / `healAll` / `hold` / `release` / `node(role, id?)` / `roleIds` /
`assertConverged` (calls system `settle`) / `dispose`.

`world.system` is the package bag from `defineDst.system()`. Library/domain
`dispatch` receives `DstWorld`, not a package World class.

## Package factories (examples)

| Package | Factory / system | Node kinds |
| --- | --- | --- |
| sync-engine | `defineSyncDst(app)` → `acmeDst` | `sync.broker`, `sync.server`, `sync.client`, `sync.warmup` |
| room | `defineRoomDst(app)` → `counterDst`, … | `room.server`, `room.client` |
| auth | `AUTH_DST` | `auth.store`, `auth.actor` |
| db-schema | `SCHEMA_DST` | `schema.server`, `schema.client` |

## Kernel contracts (load-bearing)

- **Scheduler:** heap `(at, seq)`; nested drain throws `SimScheduler: nested drain`.
- **Network:** opaque `SimNetKey`; heal-before-drop; `inFlightCount()` accounts for
  scheduled deliveries including drop paths (partition / unregistered).
- **Fork tree:** `createSimDeps` → root → `io` / `ids`; callers `fork('net')`.
- **Scenario v1:** seed, startMs, knobs, actions, networkDefaults — canonical JSON.

Hard-determinism gotchas: [`DETERMINISM.md`](../../DETERMINISM.md).

## Adding a DST system

1. Register node kinds (side-effect module imported by the system def).
2. `defineDst({ id, knobs: defineDstKnob[], nodes, system?, library?, domain?, settle })`.
3. Tests: `await assertDst(myDst)` or `replayDst(myDst, { seed, knobs, actions })`.
4. Do **not** add package `openWorld` for DST, `worldPropertyInputs`, or parallel
   play/run-commands runners.

## Verify

```bash
bun run --filter @pkgs/dst tc
bun test pkgs/dst
PBT_DST_RUNS=1 bun test pkgs/sync-engine/src/tests/scenarios/acme-world.pbt.test.ts
PBT_DST_RUNS=1 bun test pkgs/room/src/tests/scenarios/room-world.pbt.test.ts
bun test pkgs/auth/src/tests/dst pkgs/db-schema/src/tests/dst
```

## File map

| Path | Contents |
| --- | --- |
| `src/define-dst.ts` | `defineDst` / `defineDstKnob` |
| `src/node-kind.ts` | `defineNodeKind` registry |
| `src/library.ts` | `defineLibrary` |
| `src/world.ts` | `openDstWorld` |
| `src/world-types.ts` | `DstWorld` API |
| `src/pbt/assert-dst.ts` | `assertDst` / `replayDst` / pins |
| `src/pbt/assert-property.ts` | `assertDstProperty` |
| `src/{clock,scheduler*,network*,faults,knobs,scenario,play,until,trace}.ts` | Kernel |
| `src/define-dst.contract.test.ts` | Fake multi-node contract |

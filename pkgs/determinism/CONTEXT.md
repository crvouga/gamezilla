# `@pkgs/determinism` — deterministic simulation testing

Fresh-agent context for the determinism framework. Product apps/libs must not
import this package (depcruise: `product-no-sim-deps`). Harness-only: `@sim/*`,
package `sim/system/` / `tests/system/`, and scenario tests.

## Purpose

Same seed → same timeline. The framework owns the **World** (deps, virtual clock,
scheduler, network mesh, node instances). Packages declare **node kinds** and a
**system topology** — they do **not** write package-local World openers /
`runCommands` / `worldPropertyInputs`.

## One authoring path

```text
defineNodeKind  →  defineSystem  →  assertSample / replay / assertFaultPins
```

| API | Role |
| --- | --- |
| `defineNodeKind` | How to boot/dispose a role (`sync.client`, `room.server`, …) |
| `defineSystem` | Topology + knobs + library/domain actions + settle |
| `openWorld` | Framework constructs `World` (tests rarely call directly) |
| `assertSample` | PBT: sample seed×knobs×commands → model-run → play → settle |
| `replay` | Replay a fixed action list (scripted pins) |
| `assertFaultPins` | Named pin matrices over `replay` |

Low-level `assertSampleProperty` remains for custom properties (e.g. dual-open
fingerprint equality). Prefer `assertSample` for command-world PBTs.

## Discovery convention

| Layer | Convention |
| --- | --- |
| System authoring | `**/sim/system/` (package factories) or `**/tests/system/` (standalone) |
| Shrinking entry | `*.system.pbt.test.ts` |
| Scripted multi-node pins | `*.sim.test.ts` importing framework `openWorld` / `replay*` / package `sim/system` |

Find suites: `rg --glob '*.system.pbt.test.ts'` and `rg "from '@pkgs/determinism"`.

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

Topology in `defineSystem`:

```ts
nodes: [
  { kind: 'sync.broker', role: 'broker', count: 1 },
  { kind: 'sync.server', role: 'server', count: 1 },
  { kind: 'sync.client', role: 'client', countFromKnob: 'clientCount', idFor: (i) => `c${i}` },
]
```

Boot order = declaration order. Framework registers endpoints and owns dispose.

## Framework `World`

Control ports: `runFor` / `runUntilIdle` / `until` / `never` / `partition` /
`heal` / `healAll` / `hold` / `release` / `node(role, id?)` / `roleIds` /
`assertConverged` (calls system `settle`) / `dispose`.

`world.system` is the package bag from `defineSystem.system()`. Library/domain
`dispatch` receives `World`, not a package World class.

## Systems registry

| SystemDef.id | Defining file | Primary test |
| --- | --- | --- |
| `sync.acme` | `pkgs/sync-engine/src/tests/apps/acme/system.ts` | `acme-world.system.pbt.test.ts` |
| `sync.acme.large-catalog` | same | mobile-web / large-catalog pins |
| `room.counter` | `pkgs/room/src/tests/apps/counter/system.ts` | `room-world.system.pbt.test.ts` |
| `room.authz` | `pkgs/room/src/tests/apps/authz/system.ts` | authz-graph PBT |
| `room.match-clock` | `pkgs/room/src/tests/apps/match-clock/system.ts` | schedule-anticheat PBT |
| `auth.idp` | `pkgs/auth/src/tests/system/system.ts` | `auth-world.system.pbt.test.ts` |
| `db-schema.reconcile` | `pkgs/db-schema/src/tests/system/system.ts` | `schema-world.system.pbt.test.ts` |
| `matchmaking.replicas` | `pkgs/matchmaking/src/sim/system/define-matchmaking-system.ts` | `matchmaking-world.system.pbt.test.ts` |
| `sim.product` | `sim/test/src/system/define-product-system.ts` | `sim/test` `*.sim.test.tsx` |

## Package factories

| Package | Factory | Node kinds |
| --- | --- | --- |
| sync-engine | `defineSyncSystem(app)` | `sync.broker`, `sync.server`, `sync.client`, `sync.warmup` |
| room | `defineRoomSystem(app)` | `room.server`, `room.client` |
| auth | `AUTH_SYSTEM` | `auth.store`, `auth.actor` |
| db-schema | `SCHEMA_SYSTEM` | `schema.server`, `schema.client` |
| matchmaking | `MATCHMAKING_SYSTEM` | `mm.store`, `mm.replica` |
| sim/test | `PRODUCT_SYSTEM` / `defineProductSystem` | `product.sim`, `product.warmup` |

## Kernel contracts (load-bearing)

- **Scheduler:** heap `(at, seq)`; nested drain throws `SimScheduler: nested drain`.
- **Network:** opaque `SimNetKey`; heal-before-drop; `inFlightCount()` accounts for
  scheduled deliveries including drop paths (partition / unregistered).
- **Fork tree:** `createSimDeps` → root → `io` / `ids`; callers `fork('net')`.
- **Scenario v1:** seed, startMs, knobs, actions, networkDefaults — canonical JSON.

Hard-determinism gotchas: [`DETERMINISM.md`](../../DETERMINISM.md).

## Adding a system

1. Register node kinds (side-effect module imported by the system def).
2. `defineSystem({ id, knobs: defineSystemKnob[], nodes, system?, library?, domain?, settle })`.
3. Tests: `await assertSample(mySystem)` or `replay(mySystem, { seed, knobs, actions })`.
4. Do **not** add package-local World openers, `worldPropertyInputs`, or parallel
   play/run-commands runners.

## Verify

```bash
bun run --filter @pkgs/determinism tc
bun test pkgs/determinism
PBT_SAMPLE_RUNS=1 bun test pkgs/sync-engine/src/tests/scenarios/acme-world.system.pbt.test.ts
PBT_SAMPLE_RUNS=1 bun test pkgs/room/src/tests/scenarios/room-world.system.pbt.test.ts
bun test pkgs/auth/src/tests/system pkgs/db-schema/src/tests/system
bun test pkgs/matchmaking/src/tests/scenarios
```

## File map

| Path | Contents |
| --- | --- |
| `src/define-system.ts` | `defineSystem` / `defineSystemKnob` |
| `src/node-kind.ts` | `defineNodeKind` registry |
| `src/library.ts` | `defineLibrary` |
| `src/world.ts` | `openWorld` |
| `src/world-types.ts` | `World` API |
| `src/pbt/assert-sample.ts` | `assertSample` / `replay` / pins |
| `src/pbt/assert-property.ts` | `assertSampleProperty` |
| `src/{clock,scheduler*,network*,faults,knobs,scenario,play,until,trace}.ts` | Kernel |
| `src/define-system.contract.test.ts` | Fake multi-node contract |

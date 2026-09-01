# `@pkgs/determinism` — CONTEXT for design review

Fresh-agent brief. Read this before proposing API or architecture changes.
Product apps/libs must not import this package (depcruise: `product-no-sim-deps`).
Allowed consumers: `@sim/*`, package `sim/` / `tests/system/` / scenario tests.

Hard-determinism for *product* code (floats, key order, locale sorts, room
`hash(state)`, LWW sync columns) lives in [`DETERMINISM.md`](../../DETERMINISM.md).
This doc is about the **World framework** itself.

---

## What this package is

A **harness-only deterministic simulation + PBT framework** for multi-node systems.

**Same seed → same timeline.** Virtual clock, discrete-event scheduler, seeded
RNG/IDs, and an in-process network mesh replace wall time, `setTimeout`,
`Math.random`, and real sockets.

**The framework owns the World.** Packages declare:

1. **Node kinds** — values from `defineNodeKind` (boot/dispose/endpoints/view)
2. **Actions** — one `defineAction` per chaos or domain op (`class: 'library' | 'domain'`)
3. **System** — topology, knobs, actions, settle, invariants

They do **not** invent package-local World DSLs, dual `SimDeps` mints inside
node boot, or mega-libraries with `match` catch-alls.

```text
defineNodeKind + defineAction + defineKnob
  → defineSystem
  → openWorld / assertSample / replay / assertFaultPins
```

`acme-kv` under `src/test/acme-kv/` is the **canonical toy** (LWW client/server
over real `network.send`). It is a **test fixture**, not a reusable KV library.

---

## Goals

| Goal | Meaning |
| --- | --- |
| Deterministic replay | One seed + knobs + action list → identical outcomes |
| Framework-owned World | One composition path; packages plug kinds + actions |
| Shrinkable PBT | `fc.commands` over actions; model filters; real replay + settle |
| Failure artifacts | Scenario v1 JSON + optional trace for pins / shrinks |
| Harness isolation | `SimDeps` never leaks into product `ClientEnv` / `ServerEnv` |
| Opinionated protocol | High buy-in; one authorship school; no optional soup |

## Non-goals

- Not a product runtime, DI container, or CRDT library
- Not a substitute for product hard-determinism rules in `DETERMINISM.md`
- Settle does **not** magically guarantee convergence — packages define it
  (often heal + catch-up / reconnect)
- Model hooks are a **command filter / shrink aid**, not a bit-exact oracle of
  live state under packet loss
- Sync/room/SQL vocabulary does **not** belong here (no `clientIds`,
  `clientAllows`, `__simPoll`, `clearBoundaryFaults`)

---

## Architecture (layers)

```text
┌──────────────────────────────────────────────────────────┐
│ PBT  @pkgs/determinism/pbt                               │
│   assertSample / replay / assertFaultPins                │
│   assertSampleProperty / arbWorldSeed / fc               │
├──────────────────────────────────────────────────────────┤
│ World / System                                           │
│   defineSystem + openWorld → World                       │
│   kinds-as-values + actions + settle / invariants        │
├──────────────────────────────────────────────────────────┤
│ Catalogs                                                 │
│   defineKnob (+ arb) / defineFault / defineAction        │
│   std.partition / std.heal / std.healAll / std.advance   │
├──────────────────────────────────────────────────────────┤
│ Kernel (in-package; not a second public API)             │
│   createSimDeps → SimClock, SimScheduler, Timers,        │
│     SeededRng forks, createId, HttpClient stub           │
│   createSimNetwork (partition / hold / faults / inFlight)│
│   scenario v1, trace                                     │
└──────────────────────────────────────────────────────────┘
```

Boot order = `SystemDef.nodes` declaration order. Later nodes see earlier ones via
`NodeBootContext.nodesByRole` / `nodesById`.

---

## Authoring path (API)

### 1. `defineNodeKind` (value)

```ts
const clientKind = defineNodeKind({
  id: 'acme-kv.client',
  boot: async (ctx) => { /* ctx.deps, ctx.network, ctx.state, … */ },
  dispose: async (handle) => { … },
  endpoints: (handle) => [{ id: `…`, deliver }],
  view: (handle) => handle,
});
```

Kinds are **values** passed into `SystemDef.nodes` — there is no process-global
registry. `NodeBootContext.state` is the package board from `defineSystem.state()`.

### 2. `defineAction` + `defineKnob`

```ts
defineAction({
  kind: 'put',                    // unique within the system
  class: 'domain',                // or 'library'
  arb: (ctx) => fc.record({ … }),
  dispatch: async (world, action) => { … },
  allows?: (model, action) => boolean,
  apply?: (model, action) => void,
});

defineKnob({ id: 'clientCount', default: 2, arb: fc.integer({ min: 2, max: 3 }) });
```

Standard chaos helpers (role-parameterized, not client/server-specific):

```ts
stdNetChaos({ fromRole: 'client', toRole: 'server' })
// → std.partition / std.heal / std.healAll
stdAdvance({ minMs, maxMs })
```

### 3. `defineSystem`

```ts
defineSystem({
  id: 'acme-kv',
  state: () => ({ /* mutable board */ }),
  knobs: […],
  nodes: [
    { kind: serverKind, role: 'server', count: 1 },
    { kind: clientKind, role: 'client', countFromKnob: 'clientCount', idFor: (i) => `c${i}` },
  ],
  network: { defaults: RELIABLE_NET_FAULTS, edges: [{ fromRole: 'client', toRole: 'server' }] },
  actions: […stdNetChaos(…), putAction],
  model: { initial: () => ({ map: {} }) },  // required by assertSample
  prepare?: async (world) => { … },         // after boot; replaces warmup nodes
  settle: async (world) => { /* heal / catch-up */ },
  invariants: async (world) => null | { invariant, detail },
});
```

- **Actions** = library + domain in one list. No `match` escape hatch. No mega-library.
- **`settle`** (required): product converge policy (heal, rebroadcast, reconnect, tick).
- **`invariants`** (required): checked after `world.settle()` (not mid-play — partitions
  may intentionally diverge during the action sequence).
- **`prepare`**: post-boot hook (hydration, facade assembly). Prefer this over dummy nodes.

### 4. World (`openWorld`)

Control ports:

`advance` / `idle` / `until(pred)` / `never(pred)` /
`partition` / `heal` / `healAll` / `hold` / `release` / `releaseAll` /
`node(role, id?)` / `roleIds` / `settle` / `dispose` / `Symbol.asyncDispose`

Also exposes: `deps`, `clock`, `network`, `nodes`, `state`, `knobs`, `faults`,
`networkDefaults`, `startMs`, `seed`.

- **`partition` / `heal` take node ids** — the framework expands to all endpoint pairs.
- **`until` / `never` take predicates only** (`() => boolean | Promise<boolean>`).
  Sync pollable promises live in the sync package, not here.
- **`idle()`** is the only public drain story (not scheduler `runUntilIdle`).

### 5. PBT (`@pkgs/determinism/pbt`)

| API | Role |
| --- | --- |
| `assertSample(system, { maxCommands, numRuns? })` | Requires `model` + non-empty `actions` |
| `replay(system, { seed, knobs?, actions, settle? })` | Fixed action list (scripted pins) |
| `assertFaultPins(system, pins)` | Named pin matrices over `replay` |
| `assertSampleProperty(name, property, params?)` | Low-level `fc.assert` (non-command props) |

Flow inside `assertSample` / `replay`:

1. Model (sample only): `fc.asyncModelRun` — per-action `allows` / `apply`
2. Play: dispatch each action → `advance(PLAY_STEP_MS)` (fixed 10 ms)
3. `world.settle()` → system.settle → system.invariants (throws on violation)

Env: `PBT_SAMPLE_RUNS`, `PBT_SAMPLE_INTERRUPT_MS`.

---

## Kernel contracts (load-bearing)

### Scheduler

- Heap ordered by `(at, seq)` — same-time events fire in **insertion order**
- Nested drain → throws `SimScheduler: nested drain`
- `SimClock` does not go backwards; advance only via scheduler drains

### Network

- Opaque `SimNetKey` for per-edge fault overlays and hold queues
- **Heal-before-drop:** if partitioned, sample `unpartitionProbability` before drop
- **`inFlightCount()`:** scheduled deliveries. **Held** packets are *not* in-flight

### Seed fork tree (`createSimDeps` — called only by `openWorld`)

```text
root(seed) → fork('io') → random
           → fork('ids') → createId
openWorld  → deps.rng.fork('net') → mesh
```

Node boots receive `ctx.deps`. Do **not** mint a second `createSimDeps` inside boot.

### Scenario v1

```ts
{ version: 1, inputs: { seed, startMs, knobs, actions, networkDefaults }, meta }
```

Canonical JSON via `canonicalJsonStringify`. Unknown top-level keys rejected.

---

## Public API

**Root `@pkgs/determinism`** — authoring + World + types:

| Concern | Exports |
| --- | --- |
| Authoring | `defineNodeKind`, `defineSystem`, `defineKnob`, `defineAction`, `defineFault` |
| Std actions | `stdPartition`, `stdHeal`, `stdHealAll`, `stdAdvance`, `stdNetChaos` |
| World | `openWorld`, `World`, `OpenWorldOpts` |
| Network types | `SimNetwork`, `SimNetKey`, `RELIABLE_NET_FAULTS`, … |
| Scenario / JSON | `captureScenario`, `parseScenario`, `JsonValue`, `canonicalJsonStringify` |
| Deps types | `SimDeps`, `SimClock`, `SimScheduler` (types) |

Harness utilities still exported for kit network wraps / playground composition
roots (prefer `openWorld` + `ctx.deps` for new code): `createSimDeps`,
`createSimNetwork`, `createNetEffect`.

**Not public:** scheduler/clock/timers factories, `playActions`, global kind
registry, `defineLibrary`, free `until`/`never`, `__simPoll`, wildcard `./*`.

**`@pkgs/determinism/pbt`:** `assertSample`, `replay`, `assertFaultPins`,
`assertSampleProperty`, `arbWorldSeed`, `arbFromKnobDefs`, `fc`.

---

## Consumers

| SystemDef.id | Where | Notes |
| --- | --- | --- |
| `acme-kv` | `src/test/acme-kv/` | Canonical; `stdNetChaos` + put; settle = heal + rebroadcast |
| `sync.world` | sync-engine `defineSyncSystem` | Kit facade = handle via `ctx.deps`; per-kind actions |
| `room.world` | room `defineRoomSystem` | Same pattern; hash settle |
| `auth.idp` | auth `tests/system` | Framework-native |
| `db-schema.reconcile` | db-schema `tests/system` | Framework-native |
| `matchmaking.replicas` | matchmaking `sim/system` | `prepare` builds facade; `stdAdvance` |
| `sim.product` | `@sim/test` | openWorld host for playground actors |

Convention: factories in `**/sim/system/`; standalone systems in `**/tests/system/`;
shrinking suites `*.system.pbt.test.ts`; pins `*.sim.test.ts`.

Scripted sync/room tests often unwrap the kit handle:

```ts
await using host = await openWorld(system, { seed, knobs });
const world = syncFacade(host.state); // or roomWorld(host.state)
await world.runFor(50);              // kit handle API — not framework World.advance
```

Framework World time ports are `advance` / `idle`. Kit facades may keep their own
`runFor` as handle methods.

---

## Representative toy: `acme-kv`

Path: [`src/test/acme-kv/`](src/test/acme-kv/). **Fixture only.**

```text
clients --put--> server --replicate--> clients
```

| Piece | Detail |
| --- | --- |
| Nodes | server kind value + client kind (`clientCount`, `c0…`) |
| Domain | `{ kind: 'put', clientId, key, value }` via `network.send` |
| Library | `std.partition` / `std.heal` / `std.healAll` on client↔server **node** ids |
| Settle | `healAll` → rebroadcast store → `idle` |
| Invariants | caches == server (checked after settle) |

Study this before copying a product factory. Tests:
`acme-kv.system.pbt.test.ts`, `acme-kv.sim.test.ts` (includes `assertFaultPins`).

---

## Sharp edges (design-review checklist)

1. **Kinds are values** — import the kind object into `nodes`; no ambient registry.
2. **One action list** — unique `kind` strings; no `match` routing.
3. **Model ≠ live under loss** — settle must heal/catch up; mid-play may diverge.
4. **Settle is product policy** — acme-kv rebroadcasts; sync reconnects; not CRDT magic.
5. **Nested drain** — do not re-enter scheduler drain from inside a scheduled task.
6. **`World.idle` vs scheduler `runUntilIdle`** — only `idle()` is the public World API.
7. **Held vs inFlight** — waiting on `inFlightCount()===0` while keys are held can hang.
8. **Harness-only** — never put `SimDeps` on product env; depcruise enforces no product→determinism.
9. **One SimDeps per World** — node boots use `ctx.deps`; kit facades are handles, not second clocks.
10. **Roles, not clients** — topology is roles; never hardcode `'client'` in the framework.

When proposing changes, say which layer you touch (kernel / catalogs / world /
PBT), what contracts you preserve or break, and how `acme-kv` + one product
system would migrate. **No shims / `@deprecated` aliases.**

---

## File map

| Path | Role |
| --- | --- |
| `src/create-sim-deps.ts` | `SimDeps` + fork tree |
| `src/clock.ts` / `scheduler*.ts` / `timers.ts` | Kernel time |
| `src/network*.ts` | Mesh, partition, hold, faults |
| `src/action.ts` / `knobs.ts` / `faults.ts` | Catalogs |
| `src/std-actions.ts` | `std.*` chaos helpers |
| `src/node-kind.ts` | Kind values (no global registry) |
| `src/define-system.ts` | `SystemDef` / `defineSystem` |
| `src/world.ts` / `world-types.ts` | `openWorld` / `World` |
| `src/play.ts` | Private play loop (`PLAY_STEP_MS`) |
| `src/scenario.ts` / `json.ts` / `trace.ts` | Scenario v1, JSON, traces |
| `src/until.ts` | Predicate `until` / `never` (used by World) |
| `src/pbt/assert-sample.ts` | `assertSample` / `replay` / pins |
| `src/test/acme-kv/` | Canonical multi-node fixture |

---

## Verify

```bash
bun run --filter @pkgs/determinism tc
bun test pkgs/determinism
bun test pkgs/determinism/src/test/acme-kv
PBT_SAMPLE_RUNS=1 bun test pkgs/sync-engine/src/tests/scenarios/acme-world.system.pbt.test.ts
PBT_SAMPLE_RUNS=1 bun test pkgs/room/src/tests/scenarios/room-world.system.pbt.test.ts
bun test pkgs/auth/src/tests/system pkgs/db-schema/src/tests/system
bun test pkgs/matchmaking/src/tests
```

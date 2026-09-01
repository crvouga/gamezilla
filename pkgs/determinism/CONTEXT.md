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

**Same seed → same timeline.** Virtual clock, discrete-event scheduler with
quiescence probes, seeded RNG/IDs (including same-time scheduling picks), and
an in-process network mesh replace wall time, `setTimeout`, `Math.random`, and
real sockets.

**The framework owns the World.** Packages declare:

1. **Node kinds** — values from `defineNodeKind` (boot/dispose/endpoints/view)
2. **Actions** — one `defineAction` per chaos or domain op (`class: 'library' | 'domain'`)
3. **System** — topology, knobs, actions, optional facade, settle, invariants

They do **not** invent package-local World DSLs, dual `SimDeps` mints inside
node boot, or mega-libraries with `match` catch-alls.

```text
defineNodeKind + defineAction + defineKnob
  → defineSystem (+ optional facade)
  → openWorld / assertSample / replay / assertFaultPins
  → assertDeterministic (trace record → replay-validate)
```

`acme-kv` under `src/test/acme-kv/` is the **canonical toy** (LWW client/server
over real `network.send`). It is a **test fixture**, not a reusable KV library.

---

## Goals

| Goal | Meaning |
| --- | --- |
| Deterministic replay | One seed + knobs + action list → identical outcomes |
| Proven determinism | Trace record/replay detects consumer nondeterminism |
| Framework-owned World | One composition path; packages plug kinds + actions + facade |
| Shrinkable PBT | `fc.commands` over weighted actions; model filters; real replay + settle |
| Failure artifacts | Scenario v1 JSON + recorded trace |
| Harness isolation | `SimDeps` never leaks into product `ClientEnv` / `ServerEnv` |
| Opinionated protocol | High buy-in; one authorship school; no optional soup |

## Non-goals

- Not a product runtime, DI container, or CRDT library
- Not a substitute for product hard-determinism rules in `DETERMINISM.md`
- Not determined-style `checkpoint()` / `failpoint()` in product code — deps stay injected
- Settle does **not** magically guarantee convergence — packages define it
- Model hooks are a **command filter / shrink aid**, not a live oracle under loss
- Timer *deadline reordering* (determined's "any pending timer may fire") is
  **deferred** — same-`at` ties are entropy-picked; earlier deadlines still fire
  first when `at` differs. See `docs/determined-new-arch.md` for related notes.

---

## Architecture (layers)

```text
┌──────────────────────────────────────────────────────────┐
│ PBT  @pkgs/determinism/pbt                               │
│   assertSample / replay / assertFaultPins                │
│   assertDeterministic (gate) / assertSampleProperty / fc │
├──────────────────────────────────────────────────────────┤
│ World / System                                           │
│   defineSystem + openWorld → World<S, F>                 │
│   kinds-as-values + actions + facade / settle / inv.     │
├──────────────────────────────────────────────────────────┤
│ Catalogs                                                 │
│   defineKnob (+ arb) / defineFault / defineAction        │
│   std.partition / std.heal / std.healAll / std.advance   │
├──────────────────────────────────────────────────────────┤
│ Kernel (in-package; not a second public API)             │
│   createSimDeps → SimClock, SimScheduler, Timers,        │
│     SeededRng forks (io / ids / sched), createId         │
│   Quiescence-probe drain + seeded same-time picks        │
│   createSimNetwork (partition / hold / faults / inFlight)│
│   Trace v2 record/replay, scenario v1                    │
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
  class: 'domain',                // or 'library' (weights PBT sampling)
  arb: (ctx) => fc.record({ … }), // ctx.edges from SystemDef.network.edges
  dispatch: async (world, action) => { … },
  allows?: (model, action) => boolean,
  apply?: (model, action) => void,
});

defineKnob({ id: 'clientCount', default: 2, arb: fc.integer({ min: 2, max: 3 }) });
```

Standard chaos helpers (derive role pair from `network.edges[0]` when omitted):

```ts
stdNetChaos() // or stdNetChaos({ fromRole: 'client', toRole: 'server' })
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
    { kind: clientKind, role: 'client', count: { fromKnob: 'clientCount' }, idFor: (i) => `c${i}` },
  ],
  network: { defaults: RELIABLE_NET_FAULTS, edges: [{ fromRole: 'client', toRole: 'server' }] },
  actions: […stdNetChaos(), putAction],
  model: { initial: () => ({ map: {} }) },  // required by assertSample
  facade?: async (world) => kitHandle,      // optional typed world.facade
  settle: async (world) => { /* heal / catch-up */ },
  invariants: async (world) => null | { invariant, detail },
});
```

- **Actions** = library + domain in one list. No `match` escape hatch.
- **`network.edges`** enforced: `send` across undeclared role pairs throws.
- **`count`**: `number | { fromKnob: string }` (no parallel `countFromKnob`).
- **`facade`**: post-boot handle builder (replaces `prepare`). Use for kit
  facades / hydration warmup. Exposed as `world.facade`.
- **`settle`** / **`invariants`**: required; invariants run after settle only.

### 4. World (`openWorld`)

```ts
await using host = await openWorld(system, { seed, knobs });
const kit = host.facade; // typed F from SystemDef
await host.advance(10);
await host.idle();
```

Control ports:

`advance` / `idle` / `until(pred)` / `never(pred)` /
`partition` / `heal` / `healAll` / `hold` / `release` / `releaseAll` /
`node(role, id?)` / `roleIds` / `settle` / `dispose` / `Symbol.asyncDispose`

Also exposes: `deps`, `clock`, `network`, `nodes`, `state`, `facade`, `knobs`,
`faults`, `networkDefaults`, `startMs`, `seed`.

- **`partition` / `heal` take node ids** — framework expands to endpoint pairs.
- **`idle()`** is the quiescence-aware public drain (`scheduler.runUntilIdle`).

### 5. PBT (`@pkgs/determinism/pbt`)

| API | Role |
| --- | --- |
| `assertSample(system, { maxCommands, numRuns? })` | Requires `model` + non-empty `actions`; runs determinism gate |
| `replay(system, inputs \| scenario \| json)` | Fixed action list; gate + open world for inspection |
| `assertFaultPins(system, pins)` | Named pin matrices over `replay` |
| `assertDeterministic(system, inputs)` | Double-run: record trace, replay-validate |
| `assertSampleProperty(name, property, params?)` | Low-level `fc.assert` |

Flow inside `assertSample`:

1. Model: `fc.asyncModelRun` — per-action `allows` / `apply` (**before** world boot)
2. Play: openWorld → dispatch each action → `advance(PLAY_STEP_MS)` (10 ms)
3. `world.settle()` → system.settle → system.invariants
4. Determinism gate on the collected scenario

Library actions are sampled at weight 1; domain at weight 3.

Env: `PBT_SAMPLE_RUNS`, `PBT_SAMPLE_INTERRUPT_MS`.

---

## Kernel contracts (load-bearing)

### Scheduler

- Heap ordered by `(at, seq)`; **same-`at` ties** are entropy-picked via
  `rng.fork('sched')` + `sample()` (forced choice of size 1 consumes **no** entropy)
- **Quiescence probe**: after starting a task, wait for settle **or** a macrotask
  (`setImmediate`). A still-unsettled task is suspended on an unmanaged promise;
  other due events may fire to unblock it. Empty heap + stuck tasks → named deadlock.
- Nested drain → throws `SimScheduler: nested drain`
- `SimClock` does not go backwards; advance only via scheduler drains

### Network

- Opaque `SimNetKey` for per-edge fault overlays and hold queues
- **Heal-before-drop:** if partitioned, sample `unpartitionProbability` before drop
- **`inFlightCount()`:** scheduled deliveries. **Held** packets are *not* in-flight
- Declared `network.edges` enforced on role pairs (undirected)

### Seed fork tree (`createSimDeps` — called by `openWorld` / playground)

```text
root(seed) → fork('io') → random
           → fork('ids') → createId
           → fork('sched') → same-time picks
openWorld  → deps.rng.fork('net') → mesh
```

Node boots receive `ctx.deps`. Do **not** mint a second `createSimDeps` inside boot.

### Trace v2

Typed sequence of `sample` / `entropy` / `timer_*` / `net` / `fault` / `lifecycle` /
`step` / `invariant` records. `createRecordingTrace` / `createReplayingTrace` with
positioned divergence errors and `assertFullyConsumed()`.

### Scenario v1

```ts
{ version: 1, inputs: { seed, startMs, knobs, actions, networkDefaults }, meta }
```

Failure artifacts bundle `scenario + trace + error`.

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
| Trace | `createRecordingTrace`, `createReplayingTrace`, `createSimTrace`, `TraceRecord` |
| Entropy | `sample` (forced-choice-safe pick) |
| Deps | `createSimDeps`, `SimDeps`, `SimClock`, `SimScheduler` (types) |

**Not public:** `createSimNetwork`, `createNetEffect`, scheduler/clock/timers factories,
`playActions`, global kind registry, free `until`/`never`, wildcard `./*`.

**`@pkgs/determinism/pbt`:** `assertSample`, `replay`, `assertFaultPins`,
`assertDeterministic`, `assertSampleProperty`, `arbWorldSeed`, `arbFromKnobDefs`, `fc`.

---

## Consumers

| SystemDef.id | Where | Notes |
| --- | --- | --- |
| `acme-kv` | `src/test/acme-kv/` | Canonical; `stdNetChaos()` + put; settle = heal + rebroadcast |
| `sync.world` | sync-engine `defineSyncSystem` | Kit facade via `facade:`; `host.facade` in scenarios |
| `room.world` | room `defineRoomSystem` | Same pattern |
| `auth.idp` | auth `tests/system` | Framework-native |
| `db-schema.reconcile` | db-schema `tests/system` | Framework-native |
| `matchmaking.replicas` | matchmaking `sim/system` | `facade` builds handle; `stdAdvance` |
| `sim.product` | `@sim/test` | `facade` returns `Sim` |

Convention: factories in `**/sim/system/`; standalone systems in `**/tests/system/`;
shrinking suites `*.system.pbt.test.ts`; pins `*.sim.test.ts`.

```ts
await using host = await openWorld(system, { seed, knobs });
await host.facade.runFor(50); // kit API on the typed facade
```

---

## Representative toy: `acme-kv`

Path: [`src/test/acme-kv/`](src/test/acme-kv/). **Fixture only.**

```text
clients --put--> server --replicate--> clients
```

| Piece | Detail |
| --- | --- |
| Nodes | server + client (`count: { fromKnob: 'clientCount' }`, `c0…`) |
| Domain | `{ kind: 'put', clientId, key, value }` via `network.send` |
| Library | `stdNetChaos()` from declared edges |
| Settle | `healAll` → rebroadcast store → `idle` |
| Invariants | caches == server (checked after settle) |

---

## Sharp edges (design-review checklist)

1. **Kinds are values** — import the kind object into `nodes`; no ambient registry.
2. **One action list** — unique `kind` strings; no `match` routing.
3. **Model ≠ live under loss** — settle must heal/catch up; mid-play may diverge.
4. **Settle is product policy** — acme-kv rebroadcasts; sync reconnects; not CRDT magic.
5. **Nested drain** — do not re-enter scheduler drain from inside a scheduled task.
6. **`World.idle`** — only public drain; quiescence-aware.
7. **Held vs inFlight** — waiting on `inFlightCount()===0` while keys are held can hang.
8. **Harness-only** — never put `SimDeps` on product env; depcruise enforces no product→determinism.
9. **One SimDeps per World** — node boots use `ctx.deps`; kit facades are `world.facade`.
10. **Roles, not clients** — topology is roles; never hardcode `'client'` in the framework.
11. **Trace divergence** — a gate failure means consumer nondeterminism, not a flaky test.

When proposing changes, say which layer you touch (kernel / catalogs / world /
PBT), what contracts you preserve or break, and how `acme-kv` + one product
system would migrate. **No shims / `@deprecated` aliases.**

---

## File map

| Path | Role |
| --- | --- |
| `src/create-sim-deps.ts` | `SimDeps` + fork tree |
| `src/clock.ts` / `scheduler*.ts` / `timers.ts` / `quiescence.ts` | Kernel time |
| `src/sample.ts` | Forced-choice-safe entropy pick |
| `src/network*.ts` | Mesh, partition, hold, faults |
| `src/action.ts` / `knobs.ts` / `faults.ts` | Catalogs |
| `src/std-actions.ts` | `std.*` chaos helpers |
| `src/node-kind.ts` | Kind values (no global registry) |
| `src/define-system.ts` | `SystemDef` / `defineSystem` |
| `src/world.ts` / `world-types.ts` | `openWorld` / `World` |
| `src/play.ts` | Private play loop (`PLAY_STEP_MS`) |
| `src/scenario.ts` / `json.ts` / `trace.ts` | Scenario v1, JSON, Trace v2 |
| `src/until.ts` | Predicate `until` / `never` (used by World) |
| `src/pbt/assert-sample.ts` | `assertSample` / `replay` / pins |
| `src/pbt/assert-deterministic.ts` | Determinism gate |
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

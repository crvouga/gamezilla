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

1. **Node kinds** — values from `node()` (boot/dispose via `listen`)
2. **Knobs** — `knob(default, arb)` entries keyed in `defineSystem.knobs`
3. **Actions** — `action({ arb, dispatch, … })` entries keyed in `defineSystem.actions`
4. **Chaos** — `chaos.network()` / `chaos.advance()` spread into `actions`
5. **System** — topology, knobs, actions, optional `extend`, settle, invariants

They do **not** invent package-local World DSLs, dual `SimDeps` mints inside
node boot, or mega-libraries with `match` catch-alls.

```text
node + knob + action + chaos
  → defineSystem (+ optional extend)
  → openWorld / assertSample / replay / assertPins
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
| Framework-owned World | One composition path; packages plug kinds + actions + extend |
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
│ PBT  @pkgs/determinism/pbt                             │
│   assertSample / assertWorldProperty / replay / assertPins│
│   assertDeterministic (gate) / assertSampleProperty / fc │
├──────────────────────────────────────────────────────────┤
│ World / System                                           │
│   defineSystem + openWorld → World<K, N, X>              │
│   typed nodes/knobs + actions + extend / settle / inv.   │
├──────────────────────────────────────────────────────────┤
│ Catalogs                                                 │
│   knob() / action() / chaos.network() / chaos.advance()  │
├──────────────────────────────────────────────────────────┤
│ Kernel (in-package; not a second public API)             │
│   createSimDeps → SimClock, SimScheduler, Timers,        │
│     SeededRng forks (io / ids / sched), createId, trace  │
│   Quiescence-probe drain + seeded same-time picks        │
│   createSimNetwork (partition / hold / faults / inFlight)│
│   Trace record/replay, scenario v1                       │
└──────────────────────────────────────────────────────────┘
```

Boot order = `SystemDef.nodes` declaration order. Later nodes see earlier ones via
`NodeBootContext.peers` (`single`, `get`, `ids`).

---

## Authoring path (API)

### 1. `node()` (value)

```ts
const serverKind = node({
  boot: async (ctx) => {
    // ctx.deps, ctx.network, ctx.knob, ctx.peers, ctx.listen(…)
  },
  dispose?: async (handle) => { … },
});
```

Kinds are **values** passed into `SystemDef.nodes` keyed by **role** — there is
no process-global registry. Register endpoints with `ctx.listen(deliver, endpointId?)`.

Counted roles spread the kind and add `count` + optional `id`:

```ts
client: {
  ...clientKind,
  count: (knobs) => knobs['clientCount'] as number,
  id: (i) => `c${i}`,
},
```

### 2. `knob()` + `action()`

```ts
const CLIENT_COUNT = knob(2, fc.integer({ min: 2, max: 3 }));

const putAction = action({
  weight: 3,                      // PBT sampling weight (default 1)
  arb: (ctx) => fc.record({ … }), // ctx.ids, ctx.knobs, ctx.edges
  dispatch: async (world, action) => { … },
  allows?: (model, action) => boolean,
  apply?: (model, action) => void,
});
```

Action **keys** in `defineSystem.actions` become the wire `kind` string
(e.g. `'chaos.partition'`, `'put'`).

### 3. `chaos`

Standard network chaos helpers (derive role pair from `network.edges[0]` when omitted):

```ts
const netChaos = chaos.network({ fromRole: 'client', toRole: 'server' });
// → { 'chaos.partition', 'chaos.heal', 'chaos.healAll' }

chaos.advance({ minMs: 1, maxMs: 500 }) // → 'chaos.advance' action
```

Spread into `actions`:

```ts
actions: {
  ...netChaos,
  put: putAction,
  'chaos.advance': chaos.advance(),
},
```

### 4. `defineSystem`

```ts
defineSystem({
  id: 'acme-kv',
  startMs?: number,
  knobs: { clientCount: CLIENT_COUNT },
  nodes: {
    server: serverKind,
    client: { …clientKind, count: (k) => k['clientCount'] as number, id: (i) => `c${i}` },
  },
  network: {
    faults?: SimNetFaultProfile,
    edges: [{ fromRole: 'client', toRole: 'server' }],
  },
  actions: { …netChaos, put: putAction },
  model?: { initial: () => ({ map: {} }) },  // required by assertSample
  extend?: async (world) => ({ …kitMethods }), // merged onto World<K, N, X>
  settle: async (world) => { … },
  invariants: async (world) => { … },
});
```

- **Actions** live in one keyed record. No `match` escape hatch.
- **`network.edges`** enforced: `send` across undeclared role pairs throws.
- **`extend`**: post-boot kit surface merged onto the opened world (replaces the
  old separate `facade` / `host.facade` pattern). Keys must not collide with
  framework controls (`advance`, `nodes`, `settle`, …).
- **`settle`** runs before **`invariants`** on every `world.settle()` call.

### 5. World (`openWorld`)

```ts
await using world = await openWorld(system, { seed, knobs });
await world.advance(10);
await world.idle();
await world.play(actions);
await world.settle();
// kit methods from extend are on `world` directly
```

Control ports on every `World`:

| Port | Role |
| --- | --- |
| `seed`, `startMs`, `deps`, `knobs`, `nodes`, `network`, `networkDefaults` | Boot state |
| `ids(role)` | Node ids for a role |
| `now()` | Virtual clock |
| `advance(ms)` / `idle()` | Scheduler drains |
| `until(pred, { withinMs? })` | Wait until predicate (throws on timeout) |
| `never(pred, { forMs })` | Fail if predicate becomes true within window |
| `run(promise)` | Drain until an unmanaged promise settles |
| `partition(a, b)` | Returns `Disposable` — heal on dispose |
| `heal(a, b)` / `healAll()` | Clear partitions |
| `hold(key)` | Returns `Disposable` — release on dispose |
| `release(key)` / `releaseAll()` | Release held packets |
| `play(actions)` | Dispatch action list + `PLAY_STEP_MS` (10 ms) steps |
| `settle()` | `system.settle` then `system.invariants` |
| `dispose()` / `[Symbol.asyncDispose]` | Tear down nodes + unregister endpoints |

Also: `OpenWorldOpts.trace` enables recording trace via `createSimDeps`.

### 6. PBT (`@pkgs/determinism/pbt`)

| API | Role |
| --- | --- |
| `assertSample(system, { maxCommands?, numRuns? })` | Requires `model` + non-empty `actions`; runs determinism gate |
| `assertWorldProperty(system, arbs, run, params?)` | Property over `openWorld` + custom arbitraries |
| `replay(system, inputs \| scenario \| json)` | Fixed action list; gate + open world for inspection |
| `assertPins(system, pins)` | Named pin matrices over `replay` |
| `assertDeterministic(system, inputs)` | Double-run: record trace, replay-validate |
| `assertSampleProperty(name, property, params?)` | Low-level `fc.assert` wrapper |
| `arbSeed()` / `arbKnobs(system)` / `arbAction(system, knobs)` | Shared arbitraries |
| `fc` | Re-export for convenience |

Flow inside `assertSample`:

1. Model: `fc.asyncModelRun` — per-action `allows` / `apply` (**before** world boot)
2. Play: `openWorld` → `world.play(actions)` → `world.settle()`
3. Determinism gate on the collected scenario (`assertDeterministic`)

Action sampling uses each action's `weight` (default 1). Spread multiple copies
into the command pool by repeating entries or raising `weight`.

Env: `PBT_SAMPLE_RUNS`, `PBT_SAMPLE_INTERRUPT_MS`.

---

## Kernel contracts (load-bearing)

### `createSimDeps`

Harness-only mint called by `openWorld` (and playground `createSim` when injected):

```ts
createSimDeps({ seed, startMs?, http?, trace? }): SimDeps
```

`SimDeps` fields: `seed`, `clock`, `scheduler`, `timers`, `rng`, `random`,
`createId`, `http`, `trace`.

- **`scheduler.reset(atMs)`** — drop pending tasks and reset virtual clock (used
  by kit crash/restart flows; not a public World port).
- **`trace`** — `createDisabledTrace()` by default; `true` → `createRecordingTrace()`.

Node boots receive `ctx.deps`. Do **not** mint a second `createSimDeps` inside boot.

### Seed fork tree

```text
root(seed) → fork('io') → random
           → fork('ids') → createId
           → fork('sched') → same-time picks
openWorld  → deps.rng.fork('net') → mesh
```

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

### Trace

Typed sequence of `sample` / `entropy` / `timer_*` / `net` / `lifecycle` /
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
| Authoring | `defineSystem`, `node`, `knob`, `action`, `chaos` |
| World | `openWorld`, `World`, `OpenWorldOpts`, `UntilOpts`, `NeverOpts` |
| Network types | `SimNetwork`, `SimNetKey`, `RELIABLE_NET_FAULTS`, … |
| Scenario / JSON | `captureScenario`, `parseScenario`, `JsonValue`, `canonicalJsonStringify` |
| Trace | `createRecordingTrace`, `createReplayingTrace`, `SimTrace`, `TraceRecord` |
| Entropy | `sample` (forced-choice-safe pick) |
| Deps | `createSimDeps`, `SimDeps` |
| Play constant | `PLAY_STEP_MS` |

**Not public:** `createSimNetwork`, scheduler/clock/timers factories,
`playActions`, global kind registry, wildcard `./*`.

**`@pkgs/determinism/pbt`:** `assertSample`, `assertWorldProperty`, `replay`,
`assertPins`, `assertDeterministic`, `assertSampleProperty`, `arbSeed`, `arbKnobs`,
`arbAction`, `fc`.

---

## Consumers

| SystemDef.id | Where | Notes |
| --- | --- | --- |
| `acme-kv` | `src/test/acme-kv/` | Canonical; `chaos.network()` + put; settle = heal + rebroadcast |
| `sync.acme` | sync-engine `defineSyncSystem` | Kit via `extend`; `openAcmeWorld` types the merged world |
| `room.world` | room `defineRoomSystem` | Same pattern; kit methods on opened world |
| `auth.idp` | auth `tests/system` | Framework-native |
| `db-schema.reconcile` | db-schema `tests/system` | Framework-native |
| `matchmaking.replicas` | matchmaking `sim/system` | `extend` builds kit; `chaos.advance` |
| `sim.product` | `@sim/test` | `extend` returns `Sim` |

Convention: factories in `**/sim/system/`; standalone systems in `**/tests/system/`;
shrinking suites `*.system.pbt.test.ts`; pins `*.sim.test.ts`.

```ts
await using world = await openAcmeWorld({ seed, knobs: { clientCount: 0 } });
await world.runFor(50); // kit API merged via extend
```

---

## Representative toy: `acme-kv`

Path: [`src/test/acme-kv/`](src/test/acme-kv/). **Fixture only.**

```text
clients --put--> server --replicate--> clients
```

| Piece | Detail |
| --- | --- |
| Nodes | `server` singleton + `client` (`count` from knob, ids `c0…`) |
| Domain | `{ kind: 'put', clientId, key, value }` via `network.send` |
| Chaos | `chaos.network()` from declared edges |
| Settle | `healAll` → rebroadcast store → `idle` |
| Invariants | caches == server (checked after settle) |

---

## Sharp edges (design-review checklist)

1. **Kinds are values** — import the kind object into `nodes`; no ambient registry.
2. **One action record** — unique action keys; no `match` routing.
3. **Model ≠ live under loss** — settle must heal/catch up; mid-play may diverge.
4. **Settle is product policy** — acme-kv rebroadcasts; sync reconnects; not CRDT magic.
5. **Nested drain** — do not re-enter scheduler drain from inside a scheduled task.
6. **`World.idle`** — only public drain; quiescence-aware.
7. **Held vs inFlight** — waiting on `inFlightCount()===0` while keys are held can hang.
8. **Harness-only** — never put `SimDeps` on product env; depcruise enforces no product→determinism.
9. **One SimDeps per World** — node boots use `ctx.deps`; kit surface is `extend`.
10. **Roles, not clients** — topology is roles; never hardcode `'client'` in the framework.
11. **Trace divergence** — a gate failure means consumer nondeterminism, not a flaky test.
12. **`extend` collisions** — kit keys must not shadow framework controls.

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
| `src/action.ts` / `knobs.ts` / `chaos.ts` | Catalogs |
| `src/node.ts` | Kind values (no global registry) |
| `src/define-system.ts` | `SystemDef` / `defineSystem` |
| `src/world.ts` / `world-types.ts` | `openWorld` / `World` |
| `src/play.ts` | Private play loop (`PLAY_STEP_MS`) |
| `src/scenario.ts` / `json.ts` / `trace.ts` | Scenario v1, JSON, trace |
| `src/pbt/assert-sample.ts` | `assertSample` / `assertWorldProperty` / `assertPins` |
| `src/pbt/assert-deterministic.ts` | Determinism gate |
| `src/pbt/arbs.ts` | `arbSeed` / `arbKnobs` / `arbAction` |
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

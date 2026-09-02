# `@pkgs/determinism` — CONTEXT for design review

Fresh-agent brief. Read this before proposing API or architecture changes.
Product apps/libs must not import this package (depcruise: `product-no-sim-deps`).
Allowed consumers: `@sim/*`, package `sim/` / `tests/scenario/` / scenario tests.

Hard-determinism for *product* code (floats, key order, locale sorts, room
`hash(state)`, LWW sync columns) lives in [`DETERMINISM.md`](../../DETERMINISM.md).
This doc is about the **World framework** itself. Vocabulary is the DST glossary
in [`AUDIT.md`](AUDIT.md) — Kernel / Models / Harness.

---

## What this package is

A **harness-only deterministic simulation + PBT framework** for multi-node systems.

**Same Seed → same timeline.** A `VirtualClock` owned by the `Scheduler`,
quiescence-driven time advancement, a seeded RNG tree for ids and same-time
Task picks, and an in-process `Network` Model replace wall time, `setTimeout`,
`Math.random`, and real sockets.

**The framework owns the World.** Packages declare:

1. **Nodes** — values from `node({ start, stop? })` (register endpoints via `listen`)
2. **Knobs** — `knob(default, arb)` entries keyed in `defineScenario.knobs`
3. **Commands** — `command({ generate, apply, precondition?, applyToModel? })`
   keyed in `defineScenario.commands`
4. **Network Commands** — `networkCommands()` / `advanceCommand()` spread into `commands`
5. **Scenario** — topology, knobs, commands, optional `extend`, `converge`, `always`

They do **not** invent package-local World DSLs, mint a second `WorldPorts`
inside node start, or build mega-libraries with `match` catch-alls.

```text
node + knob + command + networkCommands
  → defineScenario (+ optional extend)
  → openWorld / runScenario / replay / runPins
  → assertDeterministic (Trace record → replay-validate)
```

`acme-kv` under `src/test/acme-kv/` is the **canonical toy** (LWW client/server
over real `network.send`). It is a **test fixture**, not a reusable KV library.

---

## Goals

| Goal | Meaning |
| --- | --- |
| Deterministic replay | One Seed + knobs + Command list → identical outcomes |
| Proven determinism | Trace record/replay detects consumer nondeterminism |
| Framework-owned World | One composition path; packages plug Nodes + Commands + extend |
| Shrinkable PBT | `fc.commands` over weighted Commands; reference-model filters; real replay + converge |
| Failure reports | Repro v2 JSON + recorded Trace |
| Harness isolation | `WorldPorts` never leaks into product `ClientEnv` / `ServerEnv` |
| Opinionated protocol | High buy-in; one authorship school; no optional soup |

## Non-goals

- Not a product runtime, DI container, or CRDT library
- Not a substitute for product hard-determinism rules in `DETERMINISM.md`
- Not determined-style `checkpoint()` / `failpoint()` in product code — ports stay injected
- `converge` does **not** magically guarantee convergence — packages define it
- Reference-model hooks are a **Command filter / shrink aid**, not a live oracle under loss
- Timer *deadline reordering* (determined's "any pending timer may fire") is
  **deferred** — same-`at` ties are Choices; earlier deadlines still fire first
  when `at` differs. See `docs/determined-new-arch.md` for related notes.

---

## Architecture (layers)

```text
┌──────────────────────────────────────────────────────────┐
│ Harness / PBT  @pkgs/determinism/pbt                     │
│   runScenario / runWorldProperty / replay / runPins      │
│   assertDeterministic (gate) / runProperty               │
├──────────────────────────────────────────────────────────┤
│ Harness / World + Scenario                               │
│   defineScenario + openWorld → World<K, N, X>            │
│   typed nodes/knobs + commands + extend / converge / always │
│   Catalogs: knob() / command() / networkCommands() / advanceCommand() │
│   createWorldPorts → WorldPorts (clock, scheduler, timers, rng, createId, http, trace) │
├──────────────────────────────────────────────────────────┤
│ Models (src/models)                                      │
│   createNetwork (partition / hold / faults / inFlight)   │
│   NodeDef / NodeContext (start / stop)                   │
├──────────────────────────────────────────────────────────┤
│ Kernel (src/kernel)                                      │
│   VirtualClock, Scheduler, Timers, choose(), TraceRecorder │
│   Quiescence-probe drain + seeded same-time picks        │
└──────────────────────────────────────────────────────────┘
```

Layering rule: Kernel imports nothing above it; Models import only Kernel;
Harness imports Kernel + Models. `TODO(dst-audit)`: enforce with depcruise (Phase 3.1).

Start order = `ScenarioDef.nodes` declaration order. Later nodes see earlier ones
via `NodeContext.peers` (`single`, `get`, `nodeIds`).

---

## Authoring path (API)

### 1. `node()` (value)

```ts
const serverNode = node({
  start: async (ctx) => {
    // ctx.ports, ctx.network, ctx.knob, ctx.peers, ctx.listen(…)
  },
  stop?: async (handle) => { … },
});
```

Nodes are **values** passed into `ScenarioDef.nodes` keyed by **role** — there is
no process-global registry. Register endpoints with `ctx.listen(deliver, endpointId?)`.

Counted roles spread the node and add `count` + optional `id`:

```ts
client: {
  ...clientNode,
  count: (knobs) => knobs['clientCount'] as number,
  id: (i) => `c${i}`,
},
```

### 2. `knob()` + `command()`

```ts
const CLIENT_COUNT = knob(2, fc.integer({ min: 2, max: 3 }));

const putCommand = command({
  weight: 3,                           // PBT sampling weight (default 1)
  generate: (ctx) => fc.record({ … }), // ctx.nodeIds, ctx.knobs, ctx.edges
  apply: async (world, cmd) => { … },
  precondition?: (model, cmd) => boolean,
  applyToModel?: (model, cmd) => void,
});
```

Command **keys** in `defineScenario.commands` become the wire `kind` string
(e.g. `'network.partition'`, `'put'`).

### 3. Network Commands

Standard Network Commands (derive role pair from `network.edges[0]` when omitted):

```ts
const netCommands = networkCommands({ fromRole: 'client', toRole: 'server' });
// → { 'network.partition', 'network.heal', 'network.healAll' }

advanceCommand({ minMs: 1, maxMs: 500 }) // → 'time.advance' Command
```

Spread into `commands`:

```ts
commands: {
  ...netCommands,
  put: putCommand,
  'time.advance': advanceCommand(),
},
```

### 4. `defineScenario`

```ts
defineScenario({
  id: 'acme-kv',
  startTime?: number,
  knobs: { clientCount: CLIENT_COUNT },
  nodes: {
    server: serverNode,
    client: { …clientNode, count: (k) => k['clientCount'] as number, id: (i) => `c${i}` },
  },
  network: {
    faults?: NetworkFaults,
    edges: [{ fromRole: 'client', toRole: 'server' }],
  },
  commands: { …netCommands, put: putCommand },
  referenceModel?: { initial: () => ({ map: {} }) },  // required by runScenario
  extend?: async (world) => ({ …kitMethods }), // merged onto World<K, N, X>
  converge: async (world) => { … },
  always: async (world) => { … },
});
```

- **Commands** live in one keyed record. No `match` escape hatch.
- **`network.edges`** enforced: `send` across undeclared role pairs throws.
- **`extend`**: post-start kit surface merged onto the opened World. Keys must
  not collide with framework controls (`advance`, `nodes`, `converge`, …).
- **`converge`** runs before **`always`** on every `world.converge()` call.

### 5. World (`openWorld`)

```ts
await using world = await openWorld(scenario, { seed, knobs });
await world.advance(10);
await world.quiesce();
await world.apply(commands);
await world.converge();
// kit methods from extend are on `world` directly
```

Controls on every `World`:

| Control | Role |
| --- | --- |
| `seed`, `startTime`, `ports`, `knobs`, `nodes`, `network`, `networkFaults` | Start state |
| `nodeIds(role)` | Node ids for a role |
| `now()` | Virtual time |
| `advance(ms)` / `quiesce()` | Scheduler drains |
| `eventually(pred, { withinMs? })` | Bounded liveness (throws on timeout) |
| `never(pred, { forMs })` | Fail if predicate becomes true within window |
| `resolve(promise)` | Drain until a host promise settles |
| `partition(a, b)` | Returns `Disposable` — heal on dispose |
| `heal(a, b)` / `healAll()` | Clear partitions |
| `hold(key)` | Returns `Disposable` — release on dispose |
| `release(key)` / `releaseAll()` | Release held packets |
| `apply(commands)` | Apply Command list + `COMMAND_STEP_MS` (10 ms) steps |
| `converge()` | `scenario.converge` then `scenario.always` |
| `dispose()` / `[Symbol.asyncDispose]` | Stop nodes + unregister endpoints |

Also: `OpenWorldOptions.trace` enables a `TraceRecorder` via `createWorldPorts`.

### 6. PBT (`@pkgs/determinism/pbt`)

| API | Role |
| --- | --- |
| `runScenario(scenario, { maxCommands?, numRuns? })` | Requires `referenceModel` + non-empty `commands`; runs determinism gate |
| `runWorldProperty(scenario, arbs, run, params?)` | Property over `openWorld` + custom arbitraries |
| `replay(scenario, inputs \| repro \| json)` | Fixed Command list; gate + open World for inspection |
| `runPins(scenario, pins)` | Named pin matrices over `replay` |
| `assertDeterministic(scenario, inputs)` | Double-run: record Trace, replay-validate |
| `runProperty(name, property, params?)` | Low-level `fc.assert` wrapper |
| `arbSeed()` / `arbKnobs(scenario)` / `arbCommand(scenario, knobs)` | Shared arbitraries |

Flow inside `runScenario`:

1. Reference model: `fc.asyncModelRun` — per-Command `precondition` / `applyToModel` (**before** World start)
2. Apply: `openWorld` → `world.apply(commands)` → `world.converge()`
3. Determinism gate on the collected Repro (`assertDeterministic`)

Command sampling uses each Command's `weight` (default 1). Spread multiple copies
into the pool by repeating entries or raising `weight`.

Env: `PBT_SAMPLE_RUNS`, `PBT_SAMPLE_INTERRUPT_MS`.

---

## Kernel contracts (load-bearing)

### `createWorldPorts`

Harness-only mint called by `openWorld` (and playground `createSim` when injected):

```ts
createWorldPorts({ seed, startTime?, http?, trace? }): WorldPorts
```

`WorldPorts` fields: `seed`, `clock`, `scheduler`, `timers`, `rng`, `random`,
`createId`, `http`, `trace`.

- **`scheduler.reset(atMs)`** — drop pending Tasks and reset virtual time (used
  by kit crash/restart flows; not a public World control).
  `TODO(dst-audit)`: replace with Task ownership + cancel (Phase 3.3).
- **`trace`** — `NOOP_TRACE_RECORDER` by default; `true` → `createTraceRecorder()`.

Node starts receive `ctx.ports`. Do **not** mint a second `createWorldPorts` inside start.

### Seed fork tree

```text
root(seed) → fork('io') → random
           → fork('ids') → createId
           → fork('sched') → same-time Task picks
openWorld  → ports.rng.fork('net') → Network Model
```

(`'sched'` / `'net'` labels are kept until structural ChoiceIds land in Phase 3.2 —
renaming them shifts every seeded stream.)

### Scheduler

- Heap ordered by `(at, seq)`; **same-`at` ties** are a Choice via
  `rng.fork('sched')` + `choose()` (forced choice of size 1 consumes **no** entropy)
- **Quiescence probe**: after starting a Task, wait for settle **or** a macrotask
  (`setImmediate`). A still-unsettled Task is suspended on an unmanaged promise;
  other due Tasks may fire to unblock it. Empty heap + stuck Tasks → named deadlock.
- Nested drain → throws `Scheduler: nested drain`
- `VirtualClock` does not go backwards; advances only via Scheduler drains

### Network

- Opaque `FlowKey` for per-edge fault overlays and hold queues
- **Heal-before-drop:** if partitioned, sample `healProbability` before drop
- **`inFlightCount()`:** scheduled deliveries. **Held** packets are *not* in-flight
- Declared `network.edges` enforced on role pairs (undirected)

### Trace

Typed sequence of `choice` / `task_create` / `task_fire` / `network` records.
`createTraceRecorder` / `createTraceResolver` with positioned divergence errors
and `assertFullyConsumed()`.
`TODO(dst-audit)`: versioned envelope + checksums (Phase 3.4 / 4).

### Repro v2

```ts
{ version: 2, inputs: { seed, startTime, knobs, commands, networkFaults }, meta }
```

v1 documents are rejected loudly. Failure reports bundle `repro + trace + error`.

---

## Public API

**Root `@pkgs/determinism`** — authoring + World + types:

| Concern | Exports |
| --- | --- |
| Authoring | `defineScenario`, `node`, `knob`, `command`, `networkCommands`, `advanceCommand` |
| World | `openWorld`, `World`, `OpenWorldOptions`, `EventuallyOptions`, `NeverOptions` |
| Network types | `Network`, `FlowKey`, `NetworkFaults`, `RELIABLE_NETWORK`, … |
| Repro / JSON | `stringifyRepro`, `parseRepro`, `REPRO_VERSION`, `JsonValue`, `canonicalJsonStringify` |
| Trace | `createTraceRecorder`, `createTraceResolver`, `TraceRecorder`, `TraceRecord` |
| Choice | `choose` (forced-choice-safe pick) |
| Ports | `createWorldPorts`, `WorldPorts` |
| Step constant | `COMMAND_STEP_MS` |

**Not public:** `createNetwork`, scheduler/clock/timers factories,
`applyCommands`, global node registry, wildcard `./*`.

**`@pkgs/determinism/pbt`:** `runScenario`, `runWorldProperty`, `replay`,
`runPins`, `assertDeterministic`, `runProperty`, `arbSeed`, `arbKnobs`,
`arbCommand`. Import `fc` from `fast-check` directly.

---

## Consumers

| ScenarioDef.id | Where | Notes |
| --- | --- | --- |
| `acme-kv` | `src/test/acme-kv/` | Canonical; `networkCommands()` + put; converge = heal + rebroadcast |
| `sync.acme` | sync-engine `defineSyncSystem` | Kit via `extend`; `openAcmeWorld` types the merged World |
| `room.world` | room `defineRoomSystem` | Same pattern; kit methods on opened World |
| `auth.idp` | auth `tests/scenario` | Framework-native |
| `db-schema.reconcile` | db-schema `tests/scenario` | Framework-native |
| `matchmaking.replicas` | matchmaking `sim/scenario` | `extend` builds kit; `advanceCommand` |
| `sim.product` | `@sim/test` | `extend` returns `Sim` |

Convention: factories in `**/sim/scenario/`; standalone scenarios in `**/tests/scenario/`;
shrinking suites `*.scenario.pbt.test.ts`; pins `*.sim.test.ts`.

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
| Network Commands | `networkCommands()` from declared edges |
| Converge | `healAll` → rebroadcast store → `quiesce` |
| Always | caches == server (checked after converge) |

---

## Sharp edges (design-review checklist)

1. **Nodes are values** — import the node object into `nodes`; no ambient registry.
2. **One Command record** — unique Command keys; no `match` routing.
3. **Reference model ≠ live under loss** — converge must heal/catch up; mid-apply may diverge.
4. **Converge is product policy** — acme-kv rebroadcasts; sync reconnects; not CRDT magic.
5. **Nested drain** — do not re-enter Scheduler drain from inside a scheduled Task.
6. **`World.quiesce`** — only public drain; quiescence-aware.
7. **Held vs inFlight** — waiting on `inFlightCount()===0` while keys are held can hang.
8. **Harness-only** — never put `WorldPorts` on product env; depcruise enforces no product→determinism.
9. **One `WorldPorts` per World** — node starts use `ctx.ports`; kit surface is `extend`.
10. **Roles, not clients** — topology is roles; never hardcode `'client'` in the framework.
11. **Trace divergence** — a gate failure means consumer nondeterminism, not a flaky test.
12. **`extend` collisions** — kit keys must not shadow framework controls.

When proposing changes, say which layer you touch (Kernel / Models / Harness /
PBT), what contracts you preserve or break, and how `acme-kv` + one product
scenario would migrate. **No shims / `@deprecated` aliases.**

---

## File map

| Path | Role |
| --- | --- |
| `src/kernel/clock.ts` / `scheduler*.ts` / `timers.ts` / `quiescence.ts` | Kernel time |
| `src/kernel/choice.ts` | `choose` — forced-choice-safe pick |
| `src/kernel/trace.ts` / `json.ts` | Trace record/resolve, canonical JSON |
| `src/models/network*.ts` | Network Model: partition, hold, faults |
| `src/models/node.ts` | `NodeDef` / `NodeContext` (no global registry) |
| `src/harness/world-ports.ts` | `WorldPorts` + fork tree |
| `src/harness/command.ts` / `knobs.ts` / `network-commands.ts` | Catalogs |
| `src/harness/node.ts` | `node()` bound to `WorldPorts` |
| `src/harness/define-scenario.ts` | `ScenarioDef` / `defineScenario` |
| `src/harness/world.ts` / `world-types.ts` / `world-controls.ts` | `openWorld` / `World` |
| `src/harness/apply-commands.ts` | Private apply loop (`COMMAND_STEP_MS`) |
| `src/harness/repro.ts` | Repro v2 + `FailureReport` |
| `src/pbt/run-scenario.ts` | `runScenario` / `runWorldProperty` / `runPins` |
| `src/pbt/assert-deterministic.ts` | Determinism gate |
| `src/pbt/arbs.ts` | `arbSeed` / `arbKnobs` / `arbCommand` |
| `src/test/acme-kv/` | Canonical multi-node fixture |

---

## Verify

```bash
bun run --filter @pkgs/determinism tc
bun test pkgs/determinism
bun test pkgs/determinism/src/test/acme-kv
PBT_SAMPLE_RUNS=1 bun test pkgs/sync-engine/src/tests/scenarios/acme-world.scenario.pbt.test.ts
PBT_SAMPLE_RUNS=1 bun test pkgs/room/src/tests/scenarios/room-world.scenario.pbt.test.ts
bun test pkgs/auth/src/tests/scenario pkgs/db-schema/src/tests/scenario
bun test pkgs/matchmaking/src/tests
```

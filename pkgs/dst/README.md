# `@pkgs/dst`

**Deterministic Simulation & Testing (DST)** — a harness-only framework for
multi-node distributed systems. Same seed, knobs, and command list always
produce the same virtual timeline. Property-based tests can shrink failures to
minimal repros, and a trace replay gate catches consumer nondeterminism before
it reaches CI.

Hard-determinism rules for *product* code (floats, key order, locale sorts,
room `hash(state)`, LWW sync columns) live in
[`DETERMINISM.md`](../../DETERMINISM.md). This document covers the **World
framework** itself.

---

## Why this library exists

Distributed systems are hard to test with wall clocks, real sockets, and
`Math.random`. Flaky tests hide real bugs; deterministic tests that don't
exercise timing and network faults miss others.

`@pkgs/dst` replaces nondeterministic I/O with injected ports under a
**VirtualClock** and in-process **Network** model. You describe:

- **Nodes** (clients, servers, brokers…)
- **Actions** (domain stimuli + `std.network` / `std.time` admin)
- **Properties** (`property.always` / `.eventually` / `.sometimes`, plus scenario `converge`)

The framework owns composition (`openWorld`, `check`, `replay`, `runExamples`). You plug
in behavior via a declared **Surface** — no package-local World DSLs, no second
`WorldPorts` minted inside node starts, no reference models or `precondition` gates.

### Benefits

| Benefit | What you get |
| --- | --- |
| **Reproducible runs** | One Repro v3 JSON (seed + knobs + actions) replays identically |
| **Proven determinism** | `assertDeterministic` records a Trace, replays it, and fails on the first divergence |
| **Shrinkable chaos** | `check` online-walks actions with weight gating; ddmin shrinks failing sequences |
| **Network fault injection** | Partitions, holds, latency, drops, duplicates — all seeded and replayable |
| **Virtual time** | Quiescence-driven scheduler; `advance`, `waitUntil`, `never` without real waits |
| **Surface-typed catalogs** | `actions<S>()` / `properties<S>()` + `extend` implements `S` on `World` |
| **Harness isolation** | `WorldPorts` never leaks into product `ClientEnv` / `ServerEnv` (depcruise enforced) |

### When to use it

- Sim worlds (`@sim/test`), package `sim/scenario/` factories, and
  `tests/scenario/` suites for sync-engine, room, auth, db-schema,
  matchmaking, etc.
- Any multi-node system where you want PBT over partitions, timing, and
  concurrent actions.

### When not to use it

- Product runtime code — apps, libs, and servers must **not** import
  `@pkgs/dst` (`product-no-sim-deps` in depcruise).
- Single-process unit tests that don't need virtual time or network models.
- CRDT / convergence guarantees — `converge` is **your** policy, not magic.

**Allowed consumers:** `@sim/*`, package `sim/` / `tests/scenario/` / scenario
tests only.

---

## Quick start

```ts
import fc from 'fast-check';
import {
  actions,
  defineScenario,
  knob,
  node,
  nodeCount,
  openWorld,
  properties,
  property,
  std,
} from '@pkgs/dst';
import { check } from '@pkgs/dst/pbt';

interface MySurface {
  put(key: string, value: string): Promise<void>;
  knownKeys(): readonly string[];
}

const myActions = actions<MySurface>()({
  put: {
    weight: 1,
    generate: (ctx) =>
      fc.record({ key: fc.constantFrom('a', 'b'), value: fc.string() }),
    apply: async (surface, { key, value }) => surface.put(key, value),
  },
});

const myProps = properties<MySurface>()({
  keysStable: property.always((s) => s.knownKeys().length >= 0),
});

const scenario = defineScenario({
  id: 'my-system',
  knobs: { clientCount: knob(2, fc.integer({ min: 2, max: 3 })) },
  nodes: { server: serverNode, client: { ...clientNode, count: nodeCount((k) => k.clientCount), id: (i) => `c${i}` } },
  network: { edges: [{ fromRole: 'client', toRole: 'server' }] },
  actions: { ...std.network(), ...std.time(), ...myActions },
  properties: myProps,
  extend: async (world) => ({ /* kit-only methods — not Base controls */ }),
  converge: async (world) => { world.healAll(); await world.quiesce(); },
});

const world = await openWorld(scenario, { seed: 42, knobs: { clientCount: 2 } });
try {
  await world.apply([{ kind: 'put', key: 'a', value: 'hello' }]);
  await world.converge();
} finally {
  await world.dispose();
}

const report = await check(scenario, { episodeLength: 14, episodes: 8 });
// report.coverage on success; CheckFailedError carries report on failure
```

Canonical toy fixture: [`src/test/acme-kv/`](src/test/acme-kv/) — LWW KV over
real `network.send`. **Test fixture only**, not a reusable library.

---

## Core concepts

```text
Surface + node + knob + actions<S>() + properties<S>() + std.*
  → defineScenario (+ extend implements Surface)
  → openWorld / check / replay / runExamples
  → assertDeterministic (Trace record → replay-validate)
```

| Term | Meaning |
| --- | --- |
| **Surface** | Declared interface (`Base` + kit methods). Catalogs typed with `actions<S>()` / `properties<S>()`; `extend` returns kit-only fields merged onto `World`. |
| **Seed** | Root of a forked RNG tree — drives ids, random picks, same-time task order, network faults |
| **Scenario** | Named config: topology, knobs, actions, properties, network edges/faults, `converge` |
| **World** | Live sim: virtual time, nodes, network, framework controls + merged Surface |
| **Action** | External stimulus: `weight(surface)`, `generate({ surface, knobs, … })`, total `apply(surface, payload)` |
| **Property** | `property.always` (step or `{ at: 'converge' }`), `.eventually`, `.sometimes` — coverage + vacuity |
| **Knob** | Scenario parameter with default + fast-check arbitrary; `KnobValues<K>` inferred (no casts) |
| **Repro** | Serialized inputs (v3): optional seed, startTime, knobs, actions, networkFaults |
| **CampaignReport** | `check` success payload: episodes, coverage, failures |

---

## Authoring guide

### 1. `node()` — declare participants

Nodes are **values** keyed by **role** in `defineScenario.nodes`. There is no
global registry.

```ts
const serverNode = node({
  start: async (ctx) => {
    // ctx.id, ctx.role, ctx.index
    // ctx.ports — clock, timers, scheduler, rng, createId, http, trace
    // ctx.network — send, register endpoints via ctx.listen(deliver, endpointId?)
    // ctx.knob — read knob defaults/values
    // ctx.peers — single(role), get(role, id), nodeIds(role)
  },
  stop?: async (handle) => { … },
});
```

**Counted roles** — spread the node and add `count` + optional `id`:

```ts
client: {
  ...clientNode,
  count: (knobs) => knobs['clientCount'] as number,
  id: (i) => `c${i}`,
},
```

Start order follows `ScenarioDef.nodes` declaration order. Later nodes see
earlier ones via `ctx.peers`.

### 2. `knob()` — scenario parameters

```ts
const CLIENT_COUNT = knob(2, fc.integer({ min: 2, max: 3 }));
// knob(defaultValue, fastCheckArbitrary)
```

Knobs are resolved at World open and exposed on `world.knobs`.

### 3. `command()` — workload + reference model hooks

```ts
const putCommand = command({
  weight: 3,                           // PBT sampling weight (default 1)
  generate: (ctx) => fc.record({ … }), // ctx.nodeIds, ctx.knobs, ctx.edges
  apply: async (world, payload) => { … },
  precondition?: (model, payload) => boolean,  // reference-model guard
  applyToModel?: (model, payload) => void,     // advance reference model
});
```

Command **keys** in `defineScenario.commands` become the wire `kind` string
(e.g. `'put'`, `'network.partition'`).

### 4. Network & time commands

```ts
const netCommands = networkCommands({ fromRole: 'client', toRole: 'server' });
// → 'network.partition', 'network.heal', 'network.healAll'

advanceCommand({ minMs: 1, maxMs: 500 }) // → 'time.advance'
```

Roles default from `network.edges[0]` when omitted.

### 5. `defineScenario()` — wire it together

```ts
defineScenario({
  id: 'acme-kv',
  startTime?: number,
  knobs: { clientCount: CLIENT_COUNT },
  nodes: { server: serverNode, client: { … } },
  network: {
    faults?: NetworkFaults,   // latency, drops, partitions, …
    edges: [{ fromRole: 'client', toRole: 'server' }],
  },
  commands: { …netCommands, put: putCommand, 'time.advance': advanceCommand() },
  referenceModel?: { initial: () => ({ map: {} }) },  // required by runScenario
  extend?: async (world) => ({ …kitMethods }),          // merged onto World<K, N, X>
  converge: async (world) => { … },                     // drive to convergence point
  always: async (world) => { … },                       // safety properties
});
```

Rules:

- **One command record** — unique keys; no `match` routing escape hatch.
- **`network.edges`** — `send` across undeclared role pairs throws.
- **`extend`** — kit methods merged post-start; keys must not collide with
  framework controls (`advance`, `nodes`, `converge`, …).
- **`converge`** runs before **`always`** on every `world.converge()` call.

### 6. `openWorld()` — run the sim

```ts
await using world = await openWorld(scenario, {
  seed: number | bigint | string,
  knobs?: Partial<KnobValues>,
  startTime?: number,
  networkFaults?: NetworkFaults,
  trace?: boolean | TraceRecorder,
});
```

#### World controls

| Control | Description |
| --- | --- |
| `seed`, `startTime`, `ports`, `knobs`, `nodes`, `network`, `networkFaults` | Start state |
| `nodeIds(role)` | Node ids for a role |
| `now()` | Current virtual time (ms) |
| `advance(ms)` | Advance virtual time; drain due scheduler tasks |
| `quiesce()` | Drain until quiescence (no runnable tasks; only pending timers) |
| `eventually(pred, { withinMs? })` | Bounded liveness — throws on timeout |
| `never(pred, { forMs })` | Fail if predicate becomes true within window |
| `resolve(promise)` | Drain until a host promise settles |
| `partition(a, b)` | Returns `Disposable` — auto-heal on dispose |
| `heal(a, b)` / `healAll()` | Clear network partitions |
| `hold(key)` | Returns `Disposable` — release held packets on dispose |
| `release(key)` / `releaseAll()` | Release held packets |
| `apply(commands)` | Apply command list + `COMMAND_STEP_MS` (10 ms) between steps |
| `converge()` | Run `scenario.converge` then `scenario.always` |
| `dispose()` / `[Symbol.asyncDispose]` | Stop nodes, unregister endpoints |

Kit methods from `extend` are available directly on `world`.

---

## PBT (`@pkgs/dst/pbt`)

Import `fc` from `fast-check` directly for custom arbitraries.

### Runners

| API | Purpose |
| --- | --- |
| `runScenario(scenario, opts?)` | Sample seed + knobs + command sequence; apply; converge; determinism gate. Requires `referenceModel` + non-empty `commands`. |
| `runWorldProperty(scenario, arbs, run, params?)` | Property over `openWorld` + custom arbitraries |
| `replay(scenario, inputs \| repro \| json)` | Fixed command list with divergence detection; returns `{ world, repro, trace }` |
| `runPins(scenario, pins, opts?)` | Named pin matrices — fixed commands replayed across many seeds |
| `assertDeterministic(scenario, inputs)` | Record → replay → fresh: triple-run with Trace validation |
| `runProperty(name, property, params?)` | Low-level `fc.assert` wrapper with shared run budget |

### Arbitraries

| API | Purpose |
| --- | --- |
| `arbSeed()` | Random seed for custom properties |
| `arbKnobs(scenario)` | Sample all knob values from scenario defs |
| `arbCommand(scenario, knobs)` | Pick one command (weighted) for given knobs |

### `runScenario` flow

1. **Reference model** — `fc.asyncModelRun`: per-command `precondition` /
   `applyToModel` filters the sequence **before** World start
2. **Apply** — `openWorld` → `world.apply(commands)` → `world.converge()`
3. **Gate** — `assertDeterministic` on the collected repro

Command sampling uses each command's `weight` (default 1). Raise weight or
repeat entries to bias the pool.

### Options & environment

```ts
runScenario(scenario, {
  maxCommands?: number,              // default 14
  numRuns?: number,                  // overrides env
  interruptAfterTimeLimit?: number,  // overrides env (ms)
});
```

| Env var | Effect |
| --- | --- |
| `PBT_SAMPLE_RUNS` | Override default run count (CI: 12, local: 6) |
| `PBT_SAMPLE_INTERRUPT_MS` | Per-run time limit (default 60s; 120s when `PBT_RANDOM=1`) |

### Pins

```ts
type Pin = {
  readonly name: string;
  readonly knobs?: Partial<Record<string, JsonValue>>;
  readonly commands: readonly Command[];
};
```

`runPins` replays each pin's fixed commands across many seeds — good for
regression matrices in `*.sim.test.ts`.

### Repro v2

```ts
type Repro = {
  version: 2;
  inputs: {
    seed: string;
    startTime: number;
    knobs: Record<string, JsonValue>;
    commands: readonly Command[];
    networkFaults: NetworkFaults;
  };
  meta: ReproMeta;
};
```

Use `stringifyRepro` / `parseRepro` to serialize. v1 documents are rejected.
Failure reports bundle `repro + trace + error`.

---

## Public API reference

Two entry points:

```ts
import { … } from '@pkgs/dst';
import { … } from '@pkgs/dst/pbt';
```

### `@pkgs/dst` — authoring, World, types

#### Authoring

| Export | Kind | Description |
| --- | --- | --- |
| `defineScenario` | fn | Create a `ScenarioDef` |
| `node` | fn | Declare a node value |
| `knob` | fn | Declare a knob (default + arb) |
| `command` | fn | Declare an unbound command def |
| `networkCommands` | fn | `{ 'network.partition', 'network.heal', 'network.healAll' }` |
| `advanceCommand` | fn | `'time.advance'` command factory |

#### World

| Export | Kind | Description |
| --- | --- | --- |
| `openWorld` | fn | Boot nodes, network, scheduler; return `World` |
| `World` | type | Controls + knobs + nodes + extend surface |
| `OpenWorldOptions` | type | `seed`, `knobs`, `startTime`, `networkFaults`, `trace` |
| `EventuallyOptions` | type | `{ withinMs? }` |
| `NeverOptions` | type | `{ forMs }` |
| `COMMAND_STEP_MS` | const | `10` — ms stepped between command applies |

#### Scenario & command types

| Export | Kind |
| --- | --- |
| `ScenarioDef`, `AnyScenarioDef` | type |
| `ReferenceModelDef` | type |
| `Command`, `CommandDef`, `UnboundCommandDef`, `CommandGeneratorContext` | type |
| `KnobDef`, `KnobValues` | type |
| `NodeDef`, `CountedNodeDef`, `NodeEntry`, `NodeContext` | type |
| `AdvanceCommandOptions`, `PartitionRoles` | type |
| `Peers` | type |

#### Network

| Export | Kind | Description |
| --- | --- | --- |
| `Network` | type | In-process network model API |
| `FlowKey`, `NodeId`, `EndpointId`, `Deliver` | type | Network addressing |
| `NetworkFaults` | type | Latency, drop, duplicate, partition probabilities, … |
| `RELIABLE_NETWORK` | const | Zero-fault defaults |

#### Ports & trace

| Export | Kind | Description |
| --- | --- | --- |
| `createWorldPorts` | fn | Harness-only port bundle (playground `createSim`) |
| `WorldPorts` | type | `seed`, `clock`, `scheduler`, `timers`, `rng`, `random`, `createId`, `http`, `trace` |
| `createTraceRecorder` | fn | Start recording Trace events |
| `createTraceResolver` | fn | Replay Trace; fail on divergence |
| `TraceRecorder`, `TraceRecord` | type | Trace types |
| `choose` | fn | Forced-choice-safe pick from array |

#### Repro & JSON

| Export | Kind | Description |
| --- | --- | --- |
| `stringifyRepro`, `parseRepro` | fn | Serialize / deserialize Repro v2 |
| `REPRO_VERSION` | const | `2` |
| `Repro`, `ReproInputs`, `ReproMeta`, `FailureReport` | type | Repro shapes |
| `JsonValue`, `JsonPrimitive` | type | JSON-safe values |
| `canonicalJsonStringify` | fn | Deterministic JSON stringify |

#### Scheduler types (read-only)

| Export | Kind |
| --- | --- |
| `Scheduler`, `Task`, `TaskBody` | type |

**Not exported** (internal): `createNetwork`, scheduler/clock/timers factories,
`applyCommands`, `bindCommandKind`, global node registry, wildcard `./*`.

### `@pkgs/dst/pbt` — property-based testing

| Export | Kind | Description |
| --- | --- | --- |
| `runScenario` | fn | Full scenario PBT with determinism gate |
| `runWorldProperty` | fn | Custom property over opened World |
| `replay` | fn | Deterministic replay for inspection |
| `runPins` | fn | Pin matrix runner |
| `assertDeterministic` | fn | Triple-run determinism gate |
| `runProperty` | fn | Low-level `fc.assert` wrapper |
| `arbSeed`, `arbKnobs`, `arbCommand` | fn | Shared arbitraries |
| `RunScenarioOptions`, `RunWorldPropertyOptions`, `RunPropertyOptions` | type | Runner options |
| `RunInputs` | type | `{ seed, knobs?, commands, networkFaults?, converge? }` |
| `Pin` | type | Named fixed command sequence |

---

## Architecture

```text
┌──────────────────────────────────────────────────────────┐
│ Harness / PBT  @pkgs/dst/pbt                             │
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

Layering: Kernel imports nothing above it; Models import only Kernel; Harness
imports Kernel + Models.

### Seed fork tree

```text
root(seed) → fork('io')   → random
           → fork('ids')  → createId
           → fork('sched') → same-time Task picks
openWorld  → ports.rng.fork('net') → Network Model
```

### Scheduler

- Heap ordered by `(at, seq)`; **same-`at` ties** resolved via
  `rng.fork('sched')` + `choose()` (forced choice of size 1 consumes no entropy)
- **Quiescence probe**: after starting a task, wait for settle or a macrotask.
  Stuck tasks on unmanaged promises may unblock when other due tasks fire.
- Nested drain throws `Scheduler: nested drain`
- `VirtualClock` never goes backwards

### Network

- Opaque `FlowKey` for per-edge fault overlays and hold queues
- **Heal-before-drop:** if partitioned, sample `healProbability` before drop
- **`inFlightCount()`:** scheduled deliveries (held packets are *not* in-flight)
- Declared `network.edges` enforced on role pairs (undirected)

### Trace

Typed sequence: `choice` / `task_create` / `task_fire` / `network` records.
`createTraceResolver` fails with positioned divergence errors and
`assertFullyConsumed()`.

A determinism gate failure means **consumer nondeterminism**, not a flaky test.

---

## Consumers in this repo

| ScenarioDef.id | Location | Notes |
| --- | --- | --- |
| `acme-kv` | `src/test/acme-kv/` | Canonical toy; networkCommands + put |
| `sync.acme` | sync-engine `defineSyncSystem` | Kit via `extend`; typed `openAcmeWorld` |
| `room.world` | room `defineRoomSystem` | Same pattern |
| `auth.idp` | auth `tests/scenario` | Framework-native |
| `db-schema.reconcile` | db-schema `tests/scenario` | Framework-native |
| `matchmaking.replicas` | matchmaking `sim/scenario` | `extend` + `advanceCommand` |
| `sim.product` | `@sim/test` | `extend` returns `Sim` |

**Conventions:**

- Factories in `**/sim/scenario/`
- Standalone scenarios in `**/tests/scenario/`
- Shrinking suites: `*.scenario.pbt.test.ts`
- Pins / smoke: `*.sim.test.ts`

```ts
await using world = await openAcmeWorld({ seed, knobs: { clientCount: 0 } });
await world.runFor(50); // kit API from extend
```

---

## Goals & non-goals

| Goal | Meaning |
| --- | --- |
| Deterministic replay | One Seed + knobs + Command list → identical outcomes |
| Proven determinism | Trace record/replay detects consumer nondeterminism |
| Framework-owned World | One composition path; packages plug Nodes + Commands + extend |
| Shrinkable PBT | `fc.commands` over weighted Commands; reference-model filters; real replay + converge |
| Failure reports | Repro v2 JSON + recorded Trace |
| Harness isolation | `WorldPorts` never leaks into product env |
| Opinionated protocol | High buy-in; one authorship school; no optional soup |

**Non-goals:**

- Not a product runtime, DI container, or CRDT library
- Not a substitute for product hard-determinism in `DETERMINISM.md`
- No `checkpoint()` / `failpoint()` in product code
- `converge` does not magically guarantee convergence
- Reference-model hooks are a **command filter / shrink aid**, not a live oracle under loss
- Timer deadline reordering (determined-style "any pending timer may fire") is **deferred** — same-`at` ties are Choices; earlier deadlines still fire first when `at` differs

---

## Sharp edges

1. **Nodes are values** — import into `nodes`; no ambient registry.
2. **One command record** — unique keys; no `match` routing.
3. **Reference model ≠ live under loss** — converge must heal/catch up; mid-apply may diverge from model.
4. **Converge is product policy** — acme-kv rebroadcasts; sync reconnects; not CRDT magic.
5. **Nested drain** — do not re-enter Scheduler drain from inside a scheduled task.
6. **`World.quiesce`** — only public drain; quiescence-aware.
7. **Held vs inFlight** — waiting on `inFlightCount() === 0` while keys are held can hang.
8. **Harness-only** — never put `WorldPorts` on product env.
9. **One `WorldPorts` per World** — node starts use `ctx.ports`; kit surface is `extend`.
10. **Roles, not clients** — topology is roles; never hardcode `'client'` in the framework.
11. **`extend` collisions** — kit keys must not shadow framework controls.

When proposing API changes, state which layer you touch (Kernel / Models / Harness /
PBT), what contracts you preserve or break, and how `acme-kv` + one product
scenario would migrate. **No shims / `@deprecated` aliases.**

---

## File map

| Path | Role |
| --- | --- |
| `src/kernel/clock.ts`, `scheduler*.ts`, `timers.ts`, `quiescence.ts` | Virtual time |
| `src/kernel/choice.ts` | `choose` — forced-choice-safe pick |
| `src/kernel/trace.ts`, `json.ts` | Trace record/resolve, canonical JSON |
| `src/models/network*.ts` | Network model: partition, hold, faults |
| `src/models/node.ts` | `NodeDef` / `NodeContext` |
| `src/harness/world-ports.ts` | `WorldPorts` + fork tree |
| `src/harness/command.ts`, `knobs.ts`, `network-commands.ts` | Catalogs |
| `src/harness/node.ts` | `node()` bound to `WorldPorts` |
| `src/harness/define-scenario.ts` | `ScenarioDef` / `defineScenario` |
| `src/harness/world.ts`, `world-types.ts`, `world-controls.ts` | `openWorld` / `World` |
| `src/harness/apply-commands.ts` | Private apply loop (`COMMAND_STEP_MS`) |
| `src/harness/repro.ts` | Repro v2 + `FailureReport` |
| `src/pbt/run-scenario.ts` | `runScenario` / `runWorldProperty` / `runPins` |
| `src/pbt/assert-deterministic.ts` | Determinism gate |
| `src/pbt/arbs.ts` | `arbSeed` / `arbKnobs` / `arbCommand` |
| `src/pbt/replay.ts` | `replay` |
| `src/pbt/run-property.ts` | `runProperty` |
| `src/test/acme-kv/` | Canonical multi-node fixture |

---

## Verify

```bash
bun run --filter @pkgs/dst tc
bun test pkgs/dst
bun test pkgs/dst/src/test/acme-kv
PBT_SAMPLE_RUNS=1 bun test pkgs/sync-engine/src/tests/scenarios/acme-world.scenario.pbt.test.ts
PBT_SAMPLE_RUNS=1 bun test pkgs/room/src/tests/scenarios/room-world.scenario.pbt.test.ts
bun test pkgs/auth/src/tests/scenario pkgs/db-schema/src/tests/scenario
bun test pkgs/matchmaking/src/tests
```

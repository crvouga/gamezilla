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

1. **Node kinds** — how to boot/dispose a role and which mesh endpoints it owns
2. **System topology** — which nodes exist (counts from knobs), knobs, library
   (chaos/infra) + domain actions, and how to **settle**

They do **not** invent package-local `openWorld` / World DSLs / `runCommands` /
`worldPropertyInputs` for DST.

```text
defineNodeKind → defineSystem → openWorld / assertSample / replay / assertFaultPins
```

`acme-kv` under `src/test/acme-kv/` is the **canonical toy** (LWW client/server
over real `network.send`). It is a **test fixture**, not a reusable KV library —
same naming vibe as sync-engine’s `acme` app.

---

## Goals

| Goal | Meaning |
| --- | --- |
| Deterministic replay | One seed + knobs + action list → identical outcomes |
| Framework-owned World | One composition path; packages plug nodes + actions |
| Shrinkable PBT | `fc.commands` over library+domain; model filters; real replay + settle |
| Failure artifacts | Scenario v1 JSON + optional trace for pins / shrinks |
| Harness isolation | `SimDeps` never leaks into product `ClientEnv` / `ServerEnv` |

## Non-goals

- Not a product runtime, DI container, or CRDT library
- Not a substitute for product hard-determinism rules in `DETERMINISM.md`
- Settle does **not** magically guarantee convergence — packages define it
  (often heal + catch-up / reconnect)
- Model hooks are a **command filter / shrink aid**, not a bit-exact oracle of
  live state under packet loss

---

## Architecture (layers)

```text
┌──────────────────────────────────────────────────────────┐
│ PBT  @pkgs/determinism/pbt                               │
│   assertSample / replay / assertFaultPins                │
│   assertSampleProperty / actionCommand / runCommands…    │
├──────────────────────────────────────────────────────────┤
│ World / System                                           │
│   defineSystem + openWorld → World                       │
│   defineNodeKind registry → boot topology + endpoints    │
│   library + domain dispatch / settle / checkInvariants   │
├──────────────────────────────────────────────────────────┤
│ Catalogs                                                 │
│   defineSystemKnob / createKnobCatalog                   │
│   defineFault / createFaultCatalog                       │
│   defineLibrary                                          │
├──────────────────────────────────────────────────────────┤
│ Kernel                                                   │
│   createSimDeps → SimClock, SimScheduler, Timers,        │
│     SeededRng forks, createId, HttpClient stub           │
│   createSimNetwork (partition / hold / faults / inFlight)│
│   until / never, playActionsOnWorld, scenario, trace     │
└──────────────────────────────────────────────────────────┘
```

| Layer | Owns | Does not own |
| --- | --- | --- |
| Kernel | Time, task heap, packet schedule, seed forks | Domain SQL, product clients |
| Catalogs | Knob / fault / library defs | World lifecycle |
| World/System | Boot order, endpoints, control ports, settle hook | Package converge policy internals |
| PBT | Sample seed×knobs×commands; model-run then play | Dual-open fingerprints (use `assertSampleProperty`) |

Boot order = `SystemDef.nodes` declaration order. Later nodes see earlier ones via
`NodeBootContext.nodesByRole` / `nodesById`.

---

## Authoring path (API)

### 1. `defineNodeKind`

```ts
defineNodeKind({
  id: 'acme-kv.client',
  boot: async (ctx) => { /* ctx.deps, ctx.network, ctx.system, ctx.nodesByRole */ },
  dispose: async (handle) => { … },
  endpoints: (handle) => [{ id: `acme-kv:client:${handle.id}`, deliver }],
  view: (handle) => handle,
});
```

`NodeBootContext`: `nodeId`, `role`, `index`, `deps`, `scheduler`, `network`,
`knobs`, `faults`, mutable `system` bag, `nodesByRole`, `nodesById`.

Registry is **process-global** (`defineNodeKind` → `Map`). Import node modules
before `openWorld`. `clearNodeKindRegistry` is for contract tests only.
`registerAcmeKvNodeKinds()`-style re-register after clears if needed.

### 2. `defineSystem`

```ts
defineSystem({
  id: 'acme-kv',
  system: () => ({ /* mutable bag */ }),
  knobs: [defineSystemKnob({ id: 'clientCount', default: 2, arb: fc.integer({ min: 2, max: 3 }) })],
  nodes: [
    { kind: 'acme-kv.server', role: 'server', count: 1 },
    { kind: 'acme-kv.client', role: 'client', countFromKnob: 'clientCount', idFor: (i) => `c${i}` },
  ],
  network: { defaults: RELIABLE_NET_FAULTS },
  library: [/* partition, heal, … */],
  domain: { arbs, dispatch },
  model: { initial, allows, apply },  // optional; shared or per-domain
  prepareConverge?: async (world) => { … },
  checkInvariants?: async (world) => InvariantViolation | null,
  settle: async (world) => { /* required */ },
});
```

- **Library** = infra/chaos (`partition`, `heal`, crashes, …). Routed by
  `action.kind === lib.kind` or `lib.match`.
- **Domain** = product ops (`put`, mutations, …). Actions are `JsonValue` with a
  `kind` string (`SystemAction`).
- **`settle`** (required): heal/catch-up/assert converge. Called by
  `world.assertConverged()` and by `assertSample` / `replay` after play.

### 3. World (`openWorld`)

Control ports on `World`:

`runFor` / `runUntilIdle` / `until` / `never` / `partition` / `heal` / `healAll` /
`hold` / `release` / `releaseAll` / `node(role, id?)` / `roleIds` /
`assertConverged` / `dispose` / `Symbol.asyncDispose`

Also exposes: `deps`, `clock`, `scheduler`, `network`, `nodes`, `system`,
`knobs`, `faults`, `networkDefaults`, `startMs`, `seed`.

`world.system` is the package bag from `defineSystem.system()`. Dispatch receives
`World`, not a package World class.

### 4. PBT (`@pkgs/determinism/pbt`)

| API | Role |
| --- | --- |
| `assertSample(system, { maxCommands, numRuns? })` | Sample seed×knobs×`fc.commands` → model-run → play → settle |
| `replay(system, { seed, knobs?, actions, settle? })` | Fixed action list (scripted pins) |
| `assertFaultPins(system, pins)` | Named pin matrices over `replay` |
| `assertSampleProperty(name, property, params?)` | Low-level `fc.assert` wrapper (DST run/interrupt defaults) |

Flow inside `assertSample`:

1. Model: `fc.asyncModelRun` — `allows` / `apply` only; pushes onto `WorldReal.actions`
2. Real: `playActionsOnWorld` — `dispatch` each action; optional `checkInvariants` per step
3. `prepareConverge?` then `settle`

Env: `PBT_SAMPLE_RUNS`, `PBT_SAMPLE_INTERRUPT_MS` (see `assert-property.ts`).

---

## Kernel contracts (load-bearing)

### Scheduler

- Heap ordered by `(at, seq)` — same-time events fire in **insertion order**
- Nested `runFor` / `runUntilIdle` / `runUntil` → throws `SimScheduler: nested drain`
- Due burst: fire due tasks → fixed microtask flushes; see `scheduler-core.ts` /
  `scheduler-limits.ts`
- `SimClock` does not go backwards; advance only via scheduler drains (and `reset`)

### Network

- Opaque `SimNetKey` for per-edge fault overlays and hold queues
- **Heal-before-drop:** if partitioned, sample `unpartitionProbability` before drop
- Fault profile: delay / jitter / loss / duplicate / reorder window / spontaneous
  partition+heal (`SimNetFaultProfile`, `RELIABLE_NET_FAULTS`)
- **`inFlightCount()`:** scheduled deliveries (including drop-at-fire paths).
  **Held** packets are *not* in-flight until `release`

### Seed fork tree (`createSimDeps`)

```text
root(seed) → fork('io') → random
           → fork('ids') → createId
openWorld  → deps.rng.fork('net') → mesh
```

Extra `createId` draws must not desync network RNG.

### Scenario v1

```ts
{ version: 1, inputs: { seed, startMs, knobs, actions, networkDefaults }, meta }
```

Canonical JSON via `canonicalJsonStringify`. Unknown top-level keys rejected.

### Default HTTP

`SimDeps.http` rejects unless injected — nodes that need HTTP wire it at boot.

---

## Public API (by concern)

**Root `@pkgs/determinism`**

| Concern | Exports |
| --- | --- |
| Deps / time | `createSimDeps`, `SimDeps`, `createSimClock`, `createSimScheduler`, `createSimTimers` |
| Network | `createSimNetwork`, `SimNetwork`, `SimNetKey`, `RELIABLE_NET_FAULTS`, `createNetEffect` |
| Catalogs | `defineFault` / `createFaultCatalog`, `defineKnob` / `createKnobCatalog`, `defineLibrary` |
| Authoring | `defineNodeKind`, `defineSystem`, `defineSystemKnob`, `SystemDef`, `NodeSpec` |
| World | `openWorld`, `World`, `OpenWorldOpts` |
| Play / wait | `playActionsOnWorld`, `SimPlayHost`, `until`, `never` |
| Scenario / JSON | `captureScenario`, `parseScenario`, `JsonValue`, `canonicalJsonStringify` |
| Trace | `createSimTrace`, `SimTrace` |

**`@pkgs/determinism/pbt`:** `assertSample`, `replay`, `assertFaultPins`,
`assertSampleProperty`, `arbWorldSeed`, `arbFromKnobDefs`, `actionCommand`,
`runCommandsOnWorld`, `fc`.

---

## Consumers

| SystemDef.id | Where | Customizes |
| --- | --- | --- |
| `acme-kv` | `src/test/acme-kv/` | Toy LWW over `network.send`; settle = heal + rebroadcast |
| `sync.acme` | sync-engine `defineSyncSystem` | Broker+server+clients; rich library/domain; facade settle |
| `room.counter` / authz / match-clock | room `defineRoomSystem` | Room server/client; hash converge |
| `auth.idp` | auth `tests/system` | Store + zero-endpoint actors; fingerprint settle |
| `db-schema.reconcile` | db-schema `tests/system` | Server/client peers; schema catch-up |
| `matchmaking.replicas` | matchmaking `sim/system` | Store + replicas; tick settle |
| `sim.product` | `@sim/test` | Full product sim node for playground |

Convention: factories in `**/sim/system/`; standalone systems in `**/tests/system/`;
shrinking suites `*.system.pbt.test.ts`; pins `*.sim.test.ts`.

---

## Representative toy: `acme-kv`

Path: [`src/test/acme-kv/`](src/test/acme-kv/). **Fixture only.**

```text
clients --put--> server --replicate--> clients
```

| Piece | Detail |
| --- | --- |
| Nodes | `acme-kv.server` (1), `acme-kv.client` (`clientCount`, `c0…`) |
| Endpoints | `acme-kv:server`, `acme-kv:client:{id}` |
| Domain | `{ kind: 'put', clientId, key, value }` via `network.send` |
| Library | `partition` / `heal` on client↔server edges |
| Settle | `healAll` → rebroadcast store → `runUntilIdle` → caches == server |

Study this before copying a product factory. Tests:
`acme-kv.system.pbt.test.ts`, `acme-kv.sim.test.ts`.

---

## Sharp edges (design-review checklist)

1. **Global node-kind registry** — process-wide IDs; import order; collisions across packages.
2. **Untyped `JsonValue` actions** — string `kind` routing; weak exhaustiveness.
3. **Model ≠ live under loss** — model often assumes delivery; settle must heal/catch up.
4. **Settle is product policy** — acme-kv rebroadcasts; sync reconnects; not CRDT magic.
5. **Nested drain** — do not `runFor` / scheduler drain from inside a scheduled task’s async work that re-enters drain.
6. **`World.runUntilIdle` vs scheduler `runUntilIdle`** — different budgets (world: capped loop toward `nextDueAt`).
7. **Held vs inFlight** — waiting on `inFlightCount()===0` while keys are held can hang; use `heldSummary` / `until` wisely.
8. **Harness-only** — never put `SimDeps` on product env; depcruise enforces no product→determinism imports.
9. **HTTP stub** — inject real/fake HTTP in node boot when needed.

When proposing changes, say which layer you touch (kernel / catalogs / world /
PBT), what contracts you preserve or break, and how `acme-kv` + one product
system would migrate.

---

## File map

| Path | Role |
| --- | --- |
| `src/create-sim-deps.ts` | `SimDeps` + fork tree |
| `src/clock.ts` | `SimClock` |
| `src/scheduler*.ts` | Discrete-event scheduler + nested-drain |
| `src/timers.ts` | `Timers` over scheduler |
| `src/network*.ts` | Mesh, partition, hold, faults, inFlight |
| `src/faults.ts` / `knobs.ts` / `library.ts` | Catalogs |
| `src/node-kind.ts` | Global node-kind registry |
| `src/define-system.ts` | `SystemDef` / `defineSystem` |
| `src/world.ts` / `world-types.ts` | `openWorld` / `World` |
| `src/play.ts` | `playActionsOnWorld` / model hooks |
| `src/scenario.ts` / `json.ts` / `trace.ts` | Scenario v1, JSON, traces |
| `src/until.ts` | `until` / `never` |
| `src/pbt/assert-sample.ts` | `assertSample` / `replay` / pins |
| `src/pbt/assert-property.ts` | Low-level PBT + seed/knob arbs |
| `src/*.contract.test.ts` | Kernel / catalog / defineSystem contracts |
| `src/test/acme-kv/` | Canonical multi-node fixture |

---

## Verify

```bash
bun run --filter @pkgs/determinism tc
bun test pkgs/determinism/src/test/acme-kv
bun test pkgs/determinism
PBT_SAMPLE_RUNS=1 bun test pkgs/sync-engine/src/tests/scenarios/acme-world.system.pbt.test.ts
PBT_SAMPLE_RUNS=1 bun test pkgs/room/src/tests/scenarios/room-world.system.pbt.test.ts
bun test pkgs/auth/src/tests/system pkgs/db-schema/src/tests/system
bun test pkgs/matchmaking/src/tests/scenarios
```

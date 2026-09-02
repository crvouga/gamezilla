# `@pkgs/determinism` — DST audit (Phase 1: inventory)

Status: **Phase 1 complete; decisions in §8 resolved (see §8.1). Phase 2 complete (see §9.1). Phase 3 not started.**

### Decisions taken (2026-09-01)

| # | Decision |
| --- | --- |
| D1 | Follow `AGENTS.md`: **no deprecated aliases**; every rename updates all call sites in the same change. §10 stays empty. |
| D2 | Rename `Sim*` kernel names **and** update `AGENTS.md`, `DETERMINISM.md`, `.dependency-cruiser.cjs`, `.cursor/rules/dependency-injection.mdc`. |
| D3 | `defineSystem`→`defineScenario`, `SystemDef`→`ScenarioDef`; `SimScenario`→`Repro`. Directory convention `**/system/`→`**/scenario/`, suffix `*.system.pbt.test.ts`→`*.scenario.pbt.test.ts`. |
| D4 | **Remove** the wall-I/O spin tolerance. Host I/O must be registered at the boundary as an **Effect** (Storage decorator / `ports.effect`); the Scheduler waits only on registered Effects and never advances virtual time while one is pending; unregistered host async → deadlock error. |
| D5 | **Full unification**: knobs + Commands are generated from the Choice stream (`GeneratorResolver`), `fc.commands`/`asyncModelRun` are dropped, one Shrinker minimizes the choice sequence. fast-check remains only for consumer-authored `runProperty` properties. |
| D6 | Remove `scheduler.reset`; `Task.owner` + `Scheduler.cancel`; Node `crash` cancels owned tasks. |
| D7 | Remove `fc` re-export. |
| D8 | Brand `VirtualTime` in Kernel signatures; unwrap at `WorldPorts.clock`. |
| D9 | Implement Storage as a fault-injecting `SqlClient` decorator (`write → ok \| io_error \| torn-on-crash`) in Phase 4. |
| D10 | Rename fault fields (`drop`/`latency`/`heal`) and bump Repro schema to v2 (v1 rejected loudly). |
| D11 | `invariants→always`, `settle→converge`; `World.never` → `always(¬p)` in Phase 4. |

Git: the working tree carries unrelated uncommitted work in several consumer packages, so phases are applied as green checkpoints in the tree (verified per boundary) rather than as commits; the commit boundaries in §9 remain the intended history.

Baseline at audit time: `bun run --filter @pkgs/determinism tc` → clean; `bun test pkgs/determinism` → 45 pass / 0 fail.
Package size: 4 451 lines across 41 `.ts` files (incl. tests + `acme-kv` fixture). External consumers: ~130 files in `pkgs/{room,sync-engine,auth,db-schema,db-indexes,sql-client,matchmaking}`, `libs/chess`, `sim/{console,test}`.

Glossary terms used below (World, Choice, ChoiceEngine, ChoiceId, Scheduler, Clock, Task, Trace, Seed, Model, Network, Storage, Node, Fault, Buggify, Command, Workload, Scenario, Observation, Property, Reference model, Runner, Shrinker, Replay, Quiescence) are the canonical vocabulary from the audit brief. **Repro** is one proposed addition (see §8 D3).

---

## 1. Proposed layer assignment (current tree is flat `src/`)

| Layer | Current files | Notes |
| --- | --- | --- |
| **Kernel** | `clock.ts`, `scheduler.ts`, `scheduler-core.ts`, `scheduler-types.ts`, `scheduler-limits.ts`, `timers.ts`, `quiescence.ts`, `sample.ts`, `trace.ts`, `json.ts` | `create-sim-deps.ts` straddles Kernel and SUT-boundary (see L3) |
| **Models** | `network.ts`, `network-state.ts`, `network-send.ts`, `node.ts` | No Storage model exists |
| **Harness** | `action.ts`, `chaos.ts`, `knobs.ts`, `define-system.ts`, `world.ts`, `world-types.ts`, `world-controls.ts`, `play.ts`, `scenario.ts`, `pbt/*` | |
| **Fixture** | `test/acme-kv/*` | Canonical toy; stays a fixture |

Physical separation proposed for Phase 3: `src/kernel/`, `src/models/`, `src/harness/` + depcruise rules (§4, L8).

---

## 2. Exported-symbol inventory → glossary

Legend: ✅ canonical · 🔁 rename · ⚠ concept mismatch (needs more than a rename) · 🗑 delete (duplicate / vestigial).

### 2.1 Root `@pkgs/determinism` (`src/index.ts`)

| Export | File | Glossary term | Verdict | Note |
| --- | --- | --- | --- | --- |
| `action`, `ActionDef`, `UnboundActionDef`, `SystemAction`, `ActionArbContext` | `action.ts` | **Command** | 🔁 ⚠ | "Action" is a forbidden synonym. Fields: `allows`=precondition, `apply`=applyToModel, `dispatch`=apply(real), `arb`=generator. No per-command postcondition. |
| `chaos` (`chaos.network()`, `chaos.advance()`) | `chaos.ts` | **Command** (admin ops) | 🔁 | "Chaos" is a forbidden synonym for Fault, but these are not Faults (no biased Choice) — they are externally applied Commands (`partition`/`heal`/`healAll`/`advance`). |
| `SimDeps`, `createSimDeps` | `create-sim-deps.ts` | SUT-boundary port bundle (no glossary term) | 🔁 ⚠ | "Sim" is a forbidden World synonym. Bundle = `{seed, clock, scheduler, timers, rng, random, createId, http, trace}` — mixes Kernel (`scheduler`, `trace`, `rng`) with SUT ports (`clock`, `timers`, `createId`, `random`, `http`). Load-bearing in `AGENTS.md`. |
| `defineSystem`, `SystemDef`, `AnySystemDef`, `SystemModelDef` | `define-system.ts` | **Scenario** | 🔁 ⚠ | `SystemDef` = topology + Workload (`actions` w/ generators) + fault weights (`network.faults`) + Properties (`invariants`, `settle`) → this **is** the glossary Scenario. Name collision with existing `SimScenario` (see below, §8 D3). `model` = **Reference model**. |
| `knob`, `KnobDef`, `KnobValues` | `knobs.ts` | — (gap) | ✅ keep | Scenario parameter sampled by the generator. Propose adding "Knob" to the glossary rather than renaming. |
| `canonicalJsonStringify`, `JsonValue`, `JsonPrimitive` | `json.ts` | utility | ✅ keep | Not glossary; fine as utility. |
| `SimNetwork`, `SimNetFaultProfile`, `SimNetKey`, `SimEndpointId`, `SimNodeId`, `SimDeliver`, `RELIABLE_NET_FAULTS` | `network*.ts` | **Network**, **Fault**, **Node**, **Partition** | 🔁 ⚠ | Drop `Sim` prefix. Hazards are raw `rng.bool(p)` draws, not weighted Choices (§6 I5). Profile field names use non-glossary words (`packetLossProbability`, `oneWayDelayMeanMs`, `unpartitionProbability`). |
| `node`, `NodeKindDef`, `NodeBootContext`, `CountedNodeSpec`, `NodeSpecEntry` | `node.ts` | **Node** | 🔁 ⚠ | Term correct. Three suffixes (`KindDef`/`Spec`/`SpecEntry`) for one idea. Lifecycle is `boot`/`dispose` only — no `start/stop/crash/restart`, no task ownership. |
| `PLAY_STEP_MS` | `play.ts` | (Command step quantum) | 🔁 | "play" is not glossary. |
| `sample` | `sample.ts` | **Choice** (`choose`) | 🔁 ⚠ | Signature `sample(rng, reason, items, trace?)` threads RNG + trace separately; `reason` is a free-form label, not a structural ChoiceId; uniform only (no weights). |
| `captureScenario`, `parseScenario`, `stringifyScenario`, `SimScenario`, `SimScenarioInputs`, `SimScenarioMeta` | `scenario.ts` | **Repro** (proposed) / conflicts with **Scenario** | 🔁 ⚠ | `SimScenario` = `{seed, knobs, actions, networkDefaults}` — a concrete reproducible *input instance*, not a Scenario (configuration). `stringifyScenario` is a pure alias of `captureScenario` → 🗑. |
| `SimFailureArtifact` | `scenario.ts` | Failure report | 🔁 | Type exists; never constructed anywhere in the package (grep: 0 constructions). |
| `SimScheduler`, `SimTask` | `scheduler.ts` | **Scheduler**, **Task** | 🔁 ⚠ | `SimTask` is `() => void \| Promise<void>` — a callback, not a Task (id/owner/due). The real Task record is internal `Queued`. No `cancel` (asymmetry: `schedule` without `cancel`). `runUntilIdle` uses forbidden "Idle". `reset(atMs)` moves virtual time backwards. Exposes mutable `clock`. |
| `createRecordingTrace`, `createReplayingTrace`, `SimTrace`, `TraceRecord` | `trace.ts` | **Trace**, **TraceResolver** (Replay) | 🔁 ⚠ | `SimTrace` is a *recorder/sink* interface, not the serializable Trace. No envelope (version / seed / framework version / checksum interval). `createReplayingTrace` is a *verifier* (compares re-derived records) not a *resolver* (does not drive choices from the trace). Record kinds `entropy`, `timer_cancel`, `lifecycle`, `step`, `invariant` are declared but **never emitted** (grep: 0 sites) → vestigial. |
| `openWorld`, `World`, `OpenWorldOpts`, `UntilOpts`, `NeverOpts` | `world*.ts` | **World**, **Property** | 🔁 | `Opts` is an abbreviation. `until(pred,{withinMs})` is glossary **`eventually(p, bound)`** — the name `until` must be freed for LTL `until(p, q)`. `never(p,{forMs})` ≡ `always(¬p)` over a window. `idle()` uses forbidden "Idle". `settle()` collides with forbidden "Settled" (but means system-defined convergence, not Quiescence). `play()`, `run(promise)`, `ids()`, `deps`, `networkDefaults`, `startMs` — see rename map. |

### 2.2 `@pkgs/determinism/pbt` (`src/pbt/index.ts`)

| Export | File | Glossary term | Verdict | Note |
| --- | --- | --- | --- | --- |
| `assertSample`, `AssertSampleOpts` | `assert-sample.ts` | **Runner** (run Scenario under GeneratorResolver) | 🔁 | fast-check `commands` + `asyncModelRun`; reference model is consulted **before** world boot (filter only). |
| `assertWorldProperty`, `AssertWorldPropertyParams` | `assert-sample.ts` | Runner (custom arbitraries) | 🔁 | Type `AssertWorldPropertyParams` is not exported from index but used in `assertPins` signature. |
| `assertPins`, `FaultPin` | `assert-sample.ts` | Runner over fixed Repros | 🔁 | "Pin" is fine; `FaultPin` is misnamed (pins are Command lists, not faults). |
| `assertDeterministic`, `DeterministicRunInputs` | `assert-deterministic.ts` | Replay + divergence gate | ✅ / 🔁 | Runs record → replay → fresh (3 worlds). `DeterministicRunInputs` ≡ `ReplayInputs` (identical shape) → one must go. |
| `assertSampleProperty` | `assert-property.ts` | Runner (raw `fc.assert`) | 🔁 | 48 consumer hits / 16 files — the most-used low-level entry. Reads `process.env` (documented boundary). |
| `arbWorldSeed`, `arbFromKnobDefs` | `assert-property.ts` | — | 🗑 | Not exported from index; duplicates of `arbSeed` / `arbKnobs`. |
| `replay`, `ReplayInputs` | `replay.ts` | **Replay** (mode) | ✅ / 🗑 | Function name fine. `ReplayInputs` duplicate of `DeterministicRunInputs`. Fallback failure report hardcodes a zeroed fault profile (`replay.ts:76-87`) instead of `RELIABLE_NET_FAULTS`. |
| `arbAction`, `arbKnobs`, `arbSeed` | `arbs.ts` | **Workload / Generator** | 🔁 (`arbAction`) | Generators consume fast-check, not sim Choices (§6 I1). |
| `fc` | `arbs.ts` | — | 🗑 | Leaky re-export of a third-party lib (2 consumer imports). Consumers already depend on `fast-check` via catalog. |

### 2.3 Internal but layer-relevant

| Symbol | File | Note |
| --- | --- | --- |
| `SimClock` (`now/advance/set/reset`) | `clock.ts` | Reachable via `world.deps.scheduler.clock` → mutable Clock leaks (§6 I3). |
| `Queued`, `InFlightTask`, `DrainContext` | `scheduler-types.ts`, `scheduler-core.ts` | `Queued` is the true **Task**. No `owner`. |
| `waitQuiescence` | `quiescence.ts` | ✅ canonical term. |
| `createSimTimers` | `timers.ts` | `clearTimeout` tombstones the closure but leaves the heap entry → `pendingCount()` over-reports; no `timer_cancel` record. |
| `createKnobCatalog`, `resolveKnobDefs`, `KnobDefWithId` | `knobs.ts` | Fine (internal). |
| `playActions` | `play.ts` | Duplicated dispatch loop in `world-controls.ts:191-208` and `pbt/assert-deterministic.ts:31-53`. |
| `roleIdsFromKnobs`, `idsFromKnobs` | `pbt/role-ids.ts` | Re-implements node-id derivation already in `node.ts:defaultNodeId` → two sources of truth. |
| `bindActionKind`, `bindActions` | `action.ts`, `world.ts` | Fine after rename. |
| `ChaosWorld` (local structural type + casts) | `chaos.ts:4-9` | Duck-typed World; bypasses `World` type. |

---

## 3. Rename map (old → new)

Grouped by layer. "Consumer hits" = occurrences outside `pkgs/determinism` (`rg`, `.ts/.tsx/.md`, excluding `bun.lock`). Phase-2 items are mechanical; ⚠ items need Phase 3 (shape change).

### 3.1 Kernel

| Old | New | Phase | Consumer hits |
| --- | --- | --- | --- |
| `SimClock` (mutable) | split: read-only `Clock` (`@pkgs/clock`) for all consumers; internal `createVirtualClock()` whose mutator is held **only** by the Scheduler | 3 ⚠ | 0 direct (via `.deps.scheduler.clock`) |
| `SimScheduler` | `Scheduler` | 2 | 42 / 19 files |
| `SimTask` | `TaskBody` | 2 | 0 |
| `Queued` (internal) | `Task` (`{ id, owner, at, label, run }`) | 3 ⚠ | 0 |
| `SimScheduler.runUntilIdle` | `Scheduler.runUntilQuiescent` | 2 | in `.deps.` (67 hits, 20 files — see §3.4) |
| `SimScheduler.pendingCount` | `Scheduler.pendingTaskCount` | 2 | ″ |
| `SimScheduler.reset(atMs)` | **delete** → Node-owned `cancel` (§8 D6) | 3 ⚠ | `pkgs/room/src/sim/settle.ts`, `pkgs/sync-engine/src/sim/broker-restart.ts`, `world-boot-parts.ts` |
| — | add `Scheduler.cancel(taskId)` (symmetry) | 3 | — |
| `CreateSimSchedulerOpts.schedRng: SeededRng` | `SchedulerOptions.choice: ChoiceEngine` | 3 ⚠ | 0 |
| `createSimTimers` | `createTimers` (internal) | 2 | 0 |
| `sample(rng, reason, items, trace?)` | `ChoiceEngine.choose(choiceId, alternatives, weights?)`; file `sample.ts` → `choice.ts` | 3 ⚠ | 0 external |
| `SeededRng` forks (`'io'`,`'ids'`,`'sched'`,`'net'`) | `SeededResolver` scopes with structural ChoiceIds (`world/ids`, `world/scheduler/next`, `world/network/<from>→<to>/drop`, …) | 3 ⚠ | `.rng` 47 hits / 29 files |
| `SimTrace` | `TraceRecorder` (sink) | 2 | 0 external |
| — | new `Trace` envelope `{ schemaVersion, frameworkVersion, seed, checksumInterval, records }` | 3 ⚠ | — |
| `createRecordingTrace` | `createTraceRecorder` | 2 | 0 |
| `createReplayingTrace` | `createTraceResolver` (Replay mode; verifier today, resolver after Phase 3) | 2 name / 3 semantics | 0 |
| `createDisabledTrace` | `NOOP_TRACE_RECORDER` | 2 | 0 |
| `TraceRecord` kinds: `'sample'`→`'choice'`; `'timer_create'/'timer_fire'`→`'task_create'/'task_fire'`; `'net'`→`'network'` | | 2 (record kinds are not persisted anywhere today) | 0 |
| `TraceRecord` kinds `'entropy'`, `'timer_cancel'`, `'lifecycle'`, `'step'`, `'invariant'` | **delete** (never emitted); reintroduce `'task_cancel'`, `'command'`, `'checksum'` in Phase 4 when emitted | 2 🗑 | 0 |
| `SimDeps` | `WorldPorts` | 2 | 28 / 10 files (+ `AGENTS.md`, `DETERMINISM.md`, depcruise comment) |
| `createSimDeps` | `createWorldPorts` | 2 | 20 / 8 files |
| `SimDeps.rng: SeededRng` | `WorldPorts.choice: ChoiceEngine` (raw RNG removed from the public bundle) | 3 ⚠ | 47 / 29 files |
| `SimDeps.trace` | `WorldPorts.trace: TraceRecorder` | 2 | 2 / 2 files |
| `CreateSimDepsArgs` | `CreateWorldPortsOptions` | 2 | 0 |

### 3.2 Models

| Old | New | Phase | Consumer hits |
| --- | --- | --- | --- |
| `SimNetwork` | `Network` | 2 | 51 / 17 files |
| `SimNetworkState`, `createSimNetwork`, `buildSimNetworkApi` (internal) | `NetworkState`, `createNetwork`, `buildNetworkApi` | 2 | 0 |
| `SimNetFaultProfile` | `NetworkFaults` | 2 | 1 |
| `RELIABLE_NET_FAULTS` | `RELIABLE_NETWORK` | 2 | 3 / 2 files |
| `SimNetKey` | `FlowKey` (opaque per-flow key for hold queues / fault overlays) | 2 | 10 / 3 files |
| `SimEndpointId` / `SimNodeId` / `SimDeliver` | `EndpointId` / `NodeId` / `Deliver` | 2 | 2 / 0 / 1 |
| `HeldPacket`, `packetId` | `HeldMessage`, `messageId` | 2 | 0 |
| Fault fields `packetLossProbability` / `oneWayDelayMeanMs` / `oneWayDelayJitterMs` / `unpartitionProbability` | `dropProbability` / `latencyMeanMs` / `latencyJitterMs` / `healProbability` (glossary: latency, drop, duplication, reordering, partition) | 3 ⚠ (serialized in Repro v1 → v2) | 99 / 22 files |
| `NodeKindDef` / `CountedNodeSpec` / `NodeSpecEntry` | `NodeDef` / `CountedNodeDef` / `NodeEntry` | 2 | 0 external (kits use `node()`) |
| `NodeBootContext` | `NodeContext` | 2 | 0 external |
| `PeersView` | `Peers` | 2 | 0 |
| `NodeDef.boot` / `NodeDef.dispose` | `start` / `stop` | 2 | `node(` 154 hits / 56 files (field names inside) |
| — | add `crash` / `restart` with task cancellation + Storage crash semantics | 4 | — |

### 3.3 Harness — authoring

| Old | New | Phase | Consumer hits |
| --- | --- | --- | --- |
| `action()` / `ActionDef` / `UnboundActionDef` | `command()` / `CommandDef` / `UnboundCommandDef` | 2 | 10 / 4 files; 12 / 2 files |
| `SystemAction` | `Command` (wire payload `{ kind, … }`) | 2 | 26 / 4 files |
| `ActionArbContext` | `CommandGeneratorContext` | 2 | 0 |
| `ActionDef.arb` / `.dispatch` / `.allows` / `.apply` | `.generate` / `.apply` / `.precondition` / `.applyToModel` | 2 | inside `action(` sites |
| — | add `.postcondition?(model, world, command)` | 4 | — |
| `bindActionKind` | `bindCommandKind` | 2 | 0 |
| `chaos.network()` → kinds `'chaos.partition'|'chaos.heal'|'chaos.healAll'` | `networkCommands()` → `'network.partition'|'network.heal'|'network.healAll'` | 2 | 5 / 2 files (pinned kind strings) |
| `chaos.advance()` → `'chaos.advance'` | `advanceCommand()` → `'time.advance'` | 2 | ″ |
| `defineSystem` / `SystemDef` / `AnySystemDef` | `defineScenario` / `ScenarioDef` / `AnyScenarioDef` (§8 D3) | 2 | 30 / 13; 12 / 5; 10 / 5 |
| `SystemModelDef` / `SystemDef.model` | `ReferenceModelDef` / `.referenceModel` | 2 | via `defineSystem` sites |
| `SystemDef.actions` | `.commands` | 2 | ″ |
| `SystemDef.invariants` | `.always` (Invariant is alias-only for `always(p)`) | 2 name / 4 taxonomy | 9 / 9 files |
| `SystemDef.settle` | `.converge` | 2 | 17 / 16 files |
| `SystemDef.startMs` | `.startTime` | 2 | few |
| `knob` / `KnobDef` / `KnobValues` | keep | — | 37 / 11 |
| `PLAY_STEP_MS` / `playActions` | `COMMAND_STEP_MS` / `applyCommands` | 2 | 7 / 3 files |

### 3.4 Harness — World

| Old | New | Phase | Consumer hits |
| --- | --- | --- | --- |
| `OpenWorldOpts` / `UntilOpts` / `NeverOpts` | `OpenWorldOptions` / `EventuallyOptions` / `AlwaysOptions` | 2 | 1 / 2 / 4 |
| `World.deps` | `World.ports` | 2 | 67 / 20 files |
| `World.networkDefaults` / `OpenWorldOpts.networkDefaults` | `.networkFaults` | 2 | 11 / 8 files |
| `World.startMs` | `.startTime` | 2 | few |
| `World.ids(role)` | `.nodeIds(role)` | 2 | (untracked; low) |
| `World.idle()` | `.quiesce()` | 2 | 6 / 6 files |
| `World.until(p, {withinMs})` | `.eventually(p, {withinMs})` | 2 | 4 / 1 file |
| `World.never(p, {forMs})` | `.always(() => !p(), {forMs})` — polarity flip is a call-site rewrite, not mechanical | 4 | 5 / 2 files |
| — | add LTL `.until(p, q, bound)` | 4 | — |
| `World.run(promise)` | `.resolve(promise)` | 2 | (untracked) |
| `World.play(actions)` | `.apply(commands)` | 2 | 19 / 9 files |
| `World.settle()` | `.converge()` | 2 | 10 / 4 files |
| `partition/heal/healAll/hold/release/releaseAll/dispose/now/advance` | keep | — | — |

### 3.5 Harness — Repro / failure report (`scenario.ts`)

| Old | New | Phase | Consumer hits |
| --- | --- | --- | --- |
| `SimScenario` / `SimScenarioInputs` / `SimScenarioMeta` | `Repro` / `ReproInputs` / `ReproMeta` | 2 | 0 external |
| `captureScenario` | `stringifyRepro` | 2 | 1 |
| `stringifyScenario` | **delete** (alias) | 2 🗑 | 0 |
| `parseScenario` | `parseRepro` | 2 | 0 |
| `Repro.inputs.actions` / `.networkDefaults` | `.commands` / `.networkFaults` → **schema v2** | 3 ⚠ | serialized in consumer pin fixtures? (none found in-repo) |
| `SimFailureArtifact` | `FailureReport` `{ repro, trace, error, firstDivergentStep?, seed }` | 2 name / 4 content | 1 |

### 3.6 Harness — `/pbt`

| Old | New | Phase | Consumer hits |
| --- | --- | --- | --- |
| `assertSample` / `AssertSampleOpts` | `runScenario` / `RunScenarioOptions` | 2 | 49 / 18 files |
| `assertWorldProperty` / `AssertWorldPropertyParams` | `runWorldProperty` / `RunWorldPropertyOptions` (export the type) | 2 | 10 / 3 files |
| `assertPins` / `FaultPin` | `runPins` / `Pin` | 2 | 12 / 5 files |
| `assertDeterministic` | keep | — | 5 / 1 file |
| `DeterministicRunInputs` + `ReplayInputs` (identical) | one `RunInputs` | 2 🗑 | 0 |
| `assertSampleProperty` / `AssertSamplePropertyParams` | `runProperty` / `RunPropertyOptions` | 2 | 48 / 16 files |
| `arbWorldSeed`, `arbFromKnobDefs` | **delete** (dupes of `arbSeed`/`arbKnobs`) | 2 🗑 | 0 |
| `arbAction` | `arbCommand` | 2 | 3 / 1 file |
| `fc` re-export | **delete** (import `fast-check` directly) | 2 🗑 | 2 / 2 files |
| `replay` | keep | — | 5 |
| `roleIdsFromKnobs` / `idsFromKnobs` | fold into `node.ts` (`nodeIdsForRole`) — single id derivation | 2 | 0 |

### 3.7 Docs / repo-level text that names these symbols

`AGENTS.md` (hard-rules paragraph naming `SimClock`, `SimScheduler`, `SimDeps`, `createSimDeps`, `openWorld`, `assertSample`, `replay`, `assertPins`, `node`/`knob`/`action`/`chaos`/`defineSystem`), `DETERMINISM.md`, `pkgs/determinism/CONTEXT.md`, `pkgs/determinism/docs/*`, `.dependency-cruiser.cjs` rule `product-no-sim-deps` (comment + name), `pkgs/{room,sync-engine,matchmaking,pbt}/README.md`, `sim/test/src/setup/TESTING.md`, `.cursor/rules/dependency-injection.mdc`. Directory/file conventions `**/sim/system/`, `**/tests/system/`, `*.system.pbt.test.ts` follow `defineSystem` — rename to `*.scenario.pbt.test.ts` only if D3 lands on "Scenario".

---

## 4. Layering violations (file:line)

| # | Location | Violation | Severity |
| --- | --- | --- | --- |
| L1 | `src/node.ts:3` `import type { KnobDef } from './knobs'`; `NodeBootContext.knob` (`node.ts:17`) | **Model → Harness.** Node boot context depends on the Harness knob catalog. Fix: Harness passes a resolved `(id) => JsonValue` reader; Node layer types it structurally. | error |
| L2 | `src/node.ts:1` imports `SimDeps`; `src/create-sim-deps.ts:2` imports `@pkgs/http-client`; `SimDeps.http` (`create-sim-deps.ts:27`) | **Kernel bundle carries a SUT-boundary port (`http`).** Kernel should not know about HTTP. Fix: `WorldPorts` (harness) composes Kernel `{scheduler, choice, trace}` + SUT ports `{clock, timers, createId, random, http}`. | warn |
| L3 | `src/trace.ts:38-54` | **Kernel type knows Harness concepts** (`lifecycle`, `step`, `invariant` record kinds) — and none are emitted. Fix: delete; Phase 4 adds `'command'` / `'checksum'` via a Harness-extensible record union or a generic `custom` record. | warn |
| L4 | `src/scheduler-core.ts:1,17,106-109` | Kernel Scheduler takes `SeededRng` (a concrete PRNG from `@pkgs/uuid`) **optionally**, with a hidden FIFO fallback (`due[0]`) when absent. Kernel must depend on the `ChoiceEngine` abstraction, never optional. (Also §6 I4.) | error |
| L5 | `src/network-send.ts:130,198,215,261`; `src/network-state.ts:131-132` | Model draws `rng.bool` / `rng.random` / `rng.int` directly, bypassing Kernel `sample`/Choice and the Trace (only *outcomes* are traced as `'net'` records, not the choices). (§6 I5, I10.) | error |
| L6 | `src/world-types.ts:28-30` `WorldControls.deps`, `.network`; `src/scheduler.ts:21` `SimScheduler.clock: SimClock` | World hands out raw Kernel objects incl. a **mutable clock** (`advance`/`set`/`reset`) and `scheduler.reset`. Misuse surface (§6 I3). | error |
| L7 | `src/scheduler.ts:96-99` `reset(atMs)` → `clock.reset` | Virtual time can go **backwards** through a public Kernel method. Used by consumer kits for crash/restart (`pkgs/room/src/sim/settle.ts`, `pkgs/sync-engine/src/sim/broker-restart.ts`). | error |
| L8 | `src/` (flat), `.dependency-cruiser.cjs` | **No physical layering and no import-lint** between Kernel / Models / Harness. Only rule is `product-no-sim-deps` (external). | error |
| L9 | `src/world-controls.ts:191-208`, `src/pbt/assert-deterministic.ts:31-53`, `src/play.ts` | Command dispatch loop implemented **three times** (World.play, assertDeterministic.playOnWorld, playActions). | warn |
| L10 | `src/pbt/role-ids.ts` vs `src/node.ts:57-66` | Node-id derivation implemented twice (Harness re-derives what Models own). | warn |
| L11 | `src/chaos.ts:4-9,52,81,92,112` | Harness casts `world as ChaosWorld` (local duck type) instead of using `World`. | nit |
| L12 | `src/timers.ts:24-30,43-49` | `clearTimeout`/`clearInterval` tombstone the closure but never remove the heap entry nor emit `timer_cancel` → `pendingCount()` lies; Scheduler has no `cancel`. | warn |

No Kernel file imports from `pbt/` or `world*`/`define-system`/`action`/`chaos` — that direction is clean today.

---

## 5. Nondeterminism-leak grep (`pkgs/determinism/src`, non-test)

Patterns: `Math.random`, `Date.now`, `new Date()`, `performance.now`, `getRandomValues`, `randomUUID`, `setTimeout`, `setInterval`, `setImmediate`, `process.hrtime`, `queueMicrotask`, `Promise.race`, `process.env`, unordered iteration.

| Location | Hit | Classification |
| --- | --- | --- |
| `src/quiescence.ts:8` | `setImmediate(resolve)` | **(b) documented boundary** — the quiescence probe (macrotask yield). Required by design. Not covered by `no-bare-io.grit` (only `setTimeout`/`setInterval` banned). Needs an explicit `// @dst-boundary` style pragma + lint carve-out so no *other* file may use it. |
| `src/scheduler-core.ts:113` | `Promise.race([tracked.promise, waitQuiescence()])` | **(b) documented boundary** — races a sim task against the host macrotask probe. Same carve-out. |
| `src/scheduler-core.ts:140,156-174` | `MAX_WALL_SPINS_BEFORE_ADVANCE = 64` wall-clock macrotask spins before virtual-time advance | **⚠ design tension** — deliberately tolerates real host async (SQLite WASM / PGlite) inside the simulation. Advancement depends on how many macrotask turns wall I/O takes → a latent nondeterminism source if I/O is slow; the constant is a tuned guess. See §8 D4. |
| `src/network-state.ts:131`; `src/network-send.ts:90-93,130,198,215,261` | `rng.random()`, `rng.int`, `rng.bool` | **(a) must route through Choice** — seeded, so deterministic, but not a Choice (no id, no weights, not trace-recorded as a decision). |
| `src/pbt/assert-property.ts:12,17,21,26` | `process.env[PBT_SAMPLE_RUNS \| CI \| PBT_SAMPLE_INTERRUPT_MS \| PBT_RANDOM]` | **(b) outside boundary** — Runner configuration; affects run count / time limit only, not the simulated timeline. Document. |
| `src/world.ts:45,249,291`; `src/knobs.ts:35,56`; `src/pbt/{arbs,assert-sample,assert-deterministic,role-ids}.ts` | `Object.entries/keys(system.nodes \| actions \| knobs)` | **(b) deterministic** — JS insertion order; boot order = declaration order (documented in `CONTEXT.md`). Caveat: integer-like keys are reordered by the engine — add a `defineScenario` validation rejecting numeric-string keys. |
| `src/world.ts:64` `[...m.values()][0]`; `src/network.ts:90,96` `[...state.heldKeys]` (sorted at :96, unsorted at :90) | Map/Set iteration | **(b) deterministic** — insertion order; `releaseAll` order = hold order (fine, but document). |
| `src/scheduler-core.ts:25` `heap.sort((a,b) => a.at - b.at \|\| a.seq - b.seq)` | array sort | **(b) deterministic** — total order on `(at, seq)`. (O(n log n) per push — perf note, not determinism.) |
| `src/network-state.ts:131` `Math.floor((rng.random()*2-1)*jitter)` | float math | **(b) deterministic** on one engine; cross-engine float caveat already in `DETERMINISM.md`. |
| `src/scheduler.contract.test.ts:53,56,158` | `setImmediate`, `timers.setTimeout` | test file — allowed. |
| `Date`, `Math.random`, `performance.now`, `crypto.*`, `queueMicrotask`, `process.hrtime` | — | **0 hits.** |

`assertDeterministic` (record → replay → fresh) is the runtime backstop for the whole class; it is exercised by every `assertSample` run.

---

## 6. Architectural-invariant check

| # | Invariant | Status | Evidence |
| --- | --- | --- | --- |
| I1 | Single source of nondeterminism | ❌ | Three universes: (1) `SeededRng` fork tree (`io`/`ids`/`sched`/`net`) — kernel; (2) fast-check's own PRNG for knobs + Commands + the sim `seed` integer (`pbt/arbs.ts`, `assert-sample.ts`); (3) host macrotask timing tolerated by `MAX_WALL_SPINS_BEFORE_ADVANCE`. Trace is a *verifier*, not the source. |
| I2 | Layering enforced | ❌ | L1, L8. |
| I3 | Clock subordinate to Scheduler | ❌ | `SimClock.advance/set/reset` public (`clock.ts:2-7`); reachable via `world.deps.scheduler.clock`; `scheduler.reset` (`scheduler.ts:96`). |
| I4 | Scheduling is a Choice | 🟡 | Same-`at` ties go through `sample(rng,'sched.pick',…)` when `schedRng` is supplied (always, via `createSimDeps`), **but** `scheduler-core.ts:106-109` has a FIFO fallback and it is tested (`scheduler.contract.test.ts:8`). Earliest-deadline-first across different `at` is fixed policy (acceptable: only *runnable* tasks are a Choice; deadline reordering is an explicit non-goal in `CONTEXT.md`). |
| I5 | Faults are weighted Choices | ❌ | Network hazards are `rng.bool(p)` draws (L5). No ChoiceId; not weighted alternatives; not replayable independently of the RNG stream. `hold/release` and explicit `partition/heal` are Commands (fine). |
| I6 | Structural, stable ChoiceIds | ❌ | Labels are flat strings (`'sched.pick'`, fork labels). Trace records key tasks by auto-incremented `seq` (`scheduler.ts:69`) — a bare counter; any added `scheduleAt` shifts every later id. No stability guarantee documented. |
| I7 | Traces versioned & self-describing | ❌ | `TraceRecord[]` has no envelope. Only the Repro (`SimScenario.version: 1`) is versioned and validated (`scenario.ts:119`). |
| I8 | Divergence detection on by default in Replay | 🟡 | `replay()` → `assertDeterministic` always records + replays and fails at first mismatched **record** with position + expected/actual (`trace.ts:92-98`) ✅. `openWorld({ trace })` alone is opt-in. No periodic **state** checksums (only record-level equality). |
| I9 | Explicit SUT boundary | ✅ | One answer: **injected ports** (`ctx.deps` for Nodes; unpacked `clock/timers/createId/random/http` for product envs). Documented in `AGENTS.md`, `DETERMINISM.md`, `CONTEXT.md`; enforced by `no-bare-io.grit` + depcruise `product-no-sim-deps`. Caveat: wall-I/O tolerance (D4). |
| I10 | No test doubles masquerading as Models | 🟡 | Network is a genuine Model (state + scheduled tasks) but its nondeterminism bypasses Choice (I5). `rejectAllHttp` is a stub that fails loudly (acceptable — not a Model). Consumer-side fakes (e.g. `pkgs/auth/src/testing/fake-google.ts`) are out of this package's scope but should be audited in Phase 5. |

---

## 7. Feature-completeness checklist

### Kernel

| Capability | Status | Where / gap |
| --- | --- | --- |
| Virtual-time scheduler, quiescence-driven advancement | ✅ | `scheduler-core.ts` (`runUntilIdleHeap`, `runUntilPred`, `advanceToNextDue`, `settleOrDeadlock`; deadlock named with task labels). |
| Choice with weights | 🟡 | `sample.ts` uniform only; `rng.bool(p)` is weighted-binary but not a Choice. No `choose(id, alternatives, weights)`. |
| Resolver: seeded | ✅ | `@pkgs/uuid` `createSeededRng` (Mulberry32; `fork(label)`). |
| Resolver: trace (Replay) | 🟡 | `createReplayingTrace` *verifies* re-derived records; it does not *resolve* choices from the trace, so a trace cannot drive a run whose seed/RNG changed, and unresolved choices cannot fall back to defaults. |
| Resolver: generator (PBT) | 🟡 | fast-check generates knobs + Commands + the atomic sim seed; in-sim choices are not part of the generated/shrunk space. |
| Resolver: search (exhaustive) | ❌ | — |
| Structural ChoiceIds | ❌ | See I6. |
| Versioned Trace serialization | ❌ | `canonicalJsonStringify` exists; no envelope, no writer/reader for a `.trace.json`. |
| Divergence checksums | 🟡 | Record-level equality at every record (stronger than periodic checksums for *decisions*), no *state* checksums. `RoomModule.hash(state)` exists in product (`DETERMINISM.md`) but the kernel has no checksum hook. |
| Determinism-contract doc + lint | ✅ product / 🟡 framework | `DETERMINISM.md` + `no-bare-io.grit`, `no-bare-fs.grit`, `no-wall-io-defaults.grit`, `no-mutation-nondeterminism.grit`. Missing: `setImmediate` / `Promise.race` / `queueMicrotask` bans with a single carve-out for `quiescence.ts`/`scheduler-core.ts`; no layer-boundary lint. |

### Models

| Capability | Status | Where / gap |
| --- | --- | --- |
| Network: latency | ✅ | `sampleDelayMs` (mean ± jitter). |
| Network: drop | ✅ | `tryLoss`. |
| Network: duplicate | ✅ | `networkSend` (same `packetId`). |
| Network: reorder | ✅ | `reorderWindowMs` extra delay. |
| Network: partition / heal | ✅ | Explicit `partition/heal/healAll` + spontaneous `partitionProbability` / `unpartitionProbability` (heal-before-drop). Plus `hold/release` flow-key queues (extra, useful). |
| — all hazards as weighted Choices at stable ids | ❌ | I5. |
| Storage (crash-consistent writes, fsync, torn writes) | ❌ | **Absent.** Consumers run real SQLite WASM / PGlite inside the sim; `pkgs/sync-engine/src/sim/storage-pressure.ts` is a product-level pressure knob, not a Storage Model. See D9. |
| Node lifecycle `start/stop/crash/restart` | 🟡 | `boot`/`dispose` only (`node.ts`). Crash/restart re-implemented per consumer: `pkgs/room/src/sim/world.ts:120-122,308-309` (`crashClientSync`/`restartClient`), `pkgs/sync-engine/src/sim/broker-restart.ts`, `world-restart.ts` — some via `scheduler.reset`. No `Task.owner` → cannot cancel a crashed node's tasks. |
| Timers / timeouts as scheduled Tasks | ✅ | `timers.ts` (`Timers` port over Scheduler). Gap: cancel leaves heap entry (L12). |
| Buggify hooks | ❌ | — |

### Harness

| Capability | Status | Where / gap |
| --- | --- | --- |
| Command with pre/postconditions | 🟡 | `allows` (precondition on reference model), `apply` (model), `dispatch` (real). No postcondition. |
| Reference-model checking | 🟡 | `fc.commands` + `fc.asyncModelRun` (`assert-sample.ts:73-87`) runs the model **before** the World exists — model is a command filter/shrink aid, not an oracle compared against real outputs (`CONTEXT.md` non-goals). |
| Workload generators consume Choices | 🟡 | Generators consume fast-check arbitraries, shrinkable by fc; not sim Choices (I1). |
| Property taxonomy `always` / `eventually(bound)` / `until(p,q)` | 🟡 | `until(p,{withinMs})` = `eventually` ✅ (`world-controls.ts:63-77`); `never(p,{forMs})` = windowed `always(¬p)` ✅; `SystemDef.invariants` = `always` after each Command + after converge ✅. Missing: first-class `always(p)` (positive polarity), LTL `until(p, q)`, Property as a value (currently imperative throw-on-violation). |
| Quiescence + fairness for liveness | 🟡 | Quiescence ✅ (`quiescence.ts`, `runUntilIdleHeap` 3 idle rounds). Fairness: seeded uniform tie-break is fair in expectation but **undocumented**; no starvation guard. |
| Runner with seed sweep | 🟡 | `assertSample` (numRuns via fc), `assertPins` (per-pin seed sweep via `arbSeed`), root `tools/scripts/test-pbt-random.ts` (N whole-file attempts, prints `FC_SEED=` replay line — see the attached terminal). No `runSeeds(scenario, seeds)` with a structured failure list. |
| Shrinker over choice sequences | 🟡 | fc shrinks Commands + knobs + seed integer. Seed is atomic → internal nondeterminism does not shrink. |
| Replay-from-trace CLI / entry point | 🟡 | `replay(system, ReplayInputs \| Repro \| json)` ✅ entry point (from **Repro inputs**, not from a Trace). CLIs are per-consumer: `pkgs/room/src/tests/system/run-seed.ts`, `pkgs/sync-engine/src/tests/system/run-seed.ts`, `pkgs/db-indexes/src/tests/system/replay-cli.ts`. No framework CLI. |
| Failure report (seed, trace file, minimal repro, first violating step) | 🟡 | `SimFailureArtifact` type (never constructed); `formatDeterminismFailure` prints Repro JSON + trace *length*; divergence error carries record position + expected/actual (`trace.ts:92-98`); `until` timeout message carries seed/now/pending/held (`world-controls.ts:71-76`). No file output, no "first violating step" for property failures, no minimal repro beyond fc's shrunk Command list. |

---

## 8. Decisions needed before Phase 2 (and recorded disagreements)

**D1 — Deprecated aliases: repo policy vs. audit ground rule.** The brief says "add a deprecated alias for one release"; `AGENTS.md` (Hard Rules) and `CONTEXT.md` say **never** leave `@deprecated` markers, shims, or aliases — delete and update all call sites in the same change. I intend to follow the repo rule: **no aliases**, every rename updates all ~130 consumer files in the same commit, and this section stays empty. Confirm or override.

**D2 — `Sim*` prefix is mandated by `AGENTS.md`.** `SimClock`, `SimScheduler`, `SimDeps`, `createSimDeps` appear by name in the always-applied `AGENTS.md` hard rule and the depcruise rule `product-no-sim-deps`. Renaming them (§3.1) means editing `AGENTS.md`, `DETERMINISM.md`, `.dependency-cruiser.cjs`, `.cursor/rules/dependency-injection.mdc`. Confirm the rename is in scope for those files.

**D3 — "System" vs "Scenario" vs "Repro".** Glossary "Scenario" = configuration (topology + Workload + faults + Properties) = today's `SystemDef`. Today's `SimScenario` = a concrete input instance `{seed, knobs, commands, networkFaults}`. Proposal: `defineSystem`→`defineScenario`, `SystemDef`→`ScenarioDef`; `SimScenario`→**`Repro`** (add to glossary: "a serialized Seed + knobs + Command list that reproduces one execution; Repro ≠ Trace — a Trace is the choice sequence, a Repro is the inputs"). Alternative: keep "System" (not a forbidden synonym) and rename only `SimScenario`→`Repro`. The first is glossary-exact but renames 13 consumer files' `defineSystem` + the `**/system/` directory convention + `*.system.pbt.test.ts` suffix; the second is cheaper. Pick one.

**D4 — Disagreement: wall-I/O tolerance in the Scheduler (`MAX_WALL_SPINS_BEFORE_ADVANCE`).** Invariant 1 forbids host async escaping the Scheduler. This framework deliberately lets Nodes run **real SQLite WASM / PGlite** and waits up to 64 macrotask turns before advancing virtual time so that I/O finishes at the same virtual `now` on record and replay. I believe the current design is *better for this repo* — it is what lets `@sim/test` run the real product stack with real SQL engines under a virtual clock — and removing it would force a Storage Model that the product doesn't use (D9). Proposal: keep it, but (a) make it an explicit, named SUT-boundary exemption in the determinism-contract doc, (b) make the spin budget a `WorldPorts` option rather than a constant, (c) record a `'wall_spin'` trace record so replay detects when the budget behaved differently. Ask: agree?

**D5 — Two nondeterminism universes (fast-check vs in-sim Choice).** Fully unifying (Hypothesis-style: Commands/knobs generated *from* the sim Choice stream, so one Shrinker minimizes everything) would replace fast-check's `commands`/`asyncModelRun` and its shrinker — a rewrite of `/pbt`. Proposal for this audit: introduce a real `ChoiceEngine` (`SeededResolver`, `TraceResolver`) for **in-sim** choices with structural ChoiceIds + a choice-sequence Shrinker, and keep fast-check as the `GeneratorResolver` front-end for knobs + Commands (its shrinker remains for those). Record as **🟡 partial by design** in §7. Ask: acceptable, or go all the way?

**D6 — `scheduler.reset(atMs)` removal.** Violates monotonic virtual time; used by room/sync-engine kits for crash/restart. Replacement: `Task.owner` + `Node.crash()` cancelling that node's tasks; time never rewinds. Touches `pkgs/room/src/sim/settle.ts`, `pkgs/sync-engine/src/sim/{broker-restart,world-boot-parts}.ts`. Confirm.

**D7 — Delete `fc` re-export from `/pbt`** (2 consumer imports → `import fc from 'fast-check'`). Confirm.

**D8 — `VirtualTime` branded type.** Glossary wants virtual time as its own type. `@pkgs/clock` `Clock.now()` returns `number` and is the *product* port; branding inside the Kernel forces a cast at the port boundary. Proposal: brand Kernel-internal signatures (`Scheduler.scheduleAt(at: VirtualTime)`, `World.now(): VirtualTime`) with `VirtualTime = number & { __brand }` and unwrap at `WorldPorts.clock`. Or skip branding (record as deliberate deviation). Pick.

**D9 — Storage Model.** ❌ missing. Consumers use real engines, so a Kernel-level Storage Model with fsync/torn-write semantics would be vestigial unless wired as a fault-injecting `SqlClient` decorator (a Model wrapping the real engine at the `SqlTx` boundary: `write → ok | io_error | torn-on-crash`). Options: (a) stub `models/storage.ts` with `// TODO(dst-audit)`; (b) implement the decorator in Phase 4. Pick.

**D10 — Network fault-profile field renames change the serialized Repro (schema v1 → v2).** 99 hits / 22 files use `packetLossProbability` etc. Confirm the rename + version bump (with loud rejection of v1, per Invariant 7) or keep field names and only rename the type.

**D11 — `SystemDef.invariants` → `always`, `settle` → `converge`, `World.never` → `always(¬p)`.** `never` removal is a polarity flip at 5 call sites (not mechanical) → scheduled for Phase 4 with the taxonomy. Confirm the target names.

**Effect** — no interception concept exists; nothing vestigial to delete. Noted, no action.

---

## 9. Proposed refactor order

Each bullet = one commit; every commit compiles and is green (`bun run --filter @pkgs/determinism tc && bun test pkgs/determinism` + affected consumer suites).

**Phase 2 — mechanical renames (no behavior change)**
1. Kernel names: `SimScheduler`→`Scheduler`, `SimTask`→`TaskBody`, `runUntilIdle`→`runUntilQuiescent`, `pendingCount`→`pendingTaskCount`, `SimTrace`→`TraceRecorder`, `create*Trace`→`createTraceRecorder`/`createTraceResolver`/`NOOP_TRACE_RECORDER`; delete never-emitted record kinds; rename record kinds. Update consumers (19 files).
2. `SimDeps`→`WorldPorts`, `createSimDeps`→`createWorldPorts`; `World.deps`→`World.ports`. Update consumers + `AGENTS.md`/`DETERMINISM.md`/depcruise comment (D2).
3. Models: `SimNetwork*`→`Network*`, `SimNetKey`→`FlowKey`, `RELIABLE_NET_FAULTS`→`RELIABLE_NETWORK`, `Node*Def` consolidation, `boot/dispose`→`start/stop`.
4. Commands: `action`→`command` (+ field renames), `SystemAction`→`Command`, `chaos.*`→`networkCommands`/`advanceCommand` (+ wire kinds), `PLAY_STEP_MS`→`COMMAND_STEP_MS`, `World.play`→`apply`.
5. Scenario/Repro (per D3): `defineSystem`→`defineScenario` etc.; `SimScenario`→`Repro`; delete `stringifyScenario`; `SimFailureArtifact`→`FailureReport`; `.model`→`.referenceModel`; `.actions`→`.commands`; `.invariants`→`.always`; `.settle`→`.converge`; `World.settle`→`converge`, `idle`→`quiesce`, `until`→`eventually`, `ids`→`nodeIds`, `run`→`resolve`, `*Opts`→`*Options`, `networkDefaults`→`networkFaults`, `startMs`→`startTime`.
6. `/pbt`: `assert*`→`run*`, `FaultPin`→`Pin`, merge `DeterministicRunInputs`/`ReplayInputs`→`RunInputs`, delete `arbWorldSeed`/`arbFromKnobDefs`/`fc` re-export, `arbAction`→`arbCommand`; fold `role-ids.ts` into `node.ts`.
7. Docs: `CONTEXT.md`, `docs/*`, consumer READMEs, `TESTING.md` — glossary terms only.

### 9.1 Phase 2 — completion record (2026-09-01)

All seven Phase 2 items are applied in the working tree. Verification at the boundary:
`bun run lint` clean; root `tsc -p tsconfig.json` clean (the only remaining errors are the
pre-existing missing-Jest-globals diagnostics in `sim/test/src/scenario/product-system.boot.test.ts`
and `tools/scripts/turbo-ci-run.test.ts`, which are Jest/Bun files outside the root project's
types); per-package `tc` green for `determinism`, `sync-engine`, `room`, `auth`, `matchmaking`,
`db-schema`, `db-indexes`, `sim/console`, `sim/test`; tests green — determinism 45,
sync-engine 475, room 117, matchmaking 77, sql-client 229, auth 24, db-schema 108, db-indexes 71,
libs (`chess`/`spaces`/`auth`/`friends`/`profile`), `sim/test` Jest 15/15.

Deviations / notes recorded during the sweep:

| Item | Note |
| --- | --- |
| RNG fork labels | `rng.fork('sched')` / `rng.fork('net')` **kept** (renaming shifts every seeded stream = behavior change). Structural ChoiceIds replace them in Phase 3.2. |
| Physical layers | Files already moved into `src/kernel`, `src/models`, `src/harness` as part of the rename (no import-direction fixes yet — L1/L2 and depcruise rules remain Phase 3.1). |
| Consumer-local names | Consumer wrapper types keep their own names (`SimClock = Scheduler['clock']` in sync-engine, `createSim({ deps })`, sync `SimFaultOptions`, room/sync kit `waitUntil`/`waitNever`, `RoomSystemAction`, `defineSyncSystem`, …). Only the framework's public surface was renamed; consumer wrappers that *mirror* framework fields (`ReplaySyncInputs.actions→commands`, `.settle→converge`, `WaitWorld.deps→ports`) were aligned. |
| `SyncNetwork` | sync-engine's traffic-keyed wrapper (`src/sim/network.ts`) was `SimNetwork`; renamed to `SyncNetwork` so it no longer collides with the framework `Network` Model it wraps. |
| Directory convention (D3) | `**/sim/system/` → `**/sim/scenario/`, `**/tests/system/` → `**/tests/scenario/`, `sim/test/src/system/` → `sim/test/src/scenario/`; suffix `*.system.pbt.test.ts` → `*.scenario.pbt.test.ts` (8 files). Files named `system.ts` inside those dirs and consumer identifiers (`AUTH_SYSTEM`, `defineSyncSystem`) are untouched. |
| Repro v2 (D10) | `REPRO_VERSION = 2` exported; `parseRepro` rejects v1 loudly; `run-seed.ts` failure artifacts emit v2. |
| Historical docs | `PBT_AUDIT.md`, `PBT_FINDINGS.md`, `antithesis/scratchbook/**` still use pre-rename names — they are dated reports, left as-is. `pkgs/sync-engine/README.md` also had stale kit names (`world.until` → `world.waitUntil`) fixed in passing. |
| Pre-existing depcruise cycles | `ci:depcruise` reports 3 `no-circular` errors inside `pkgs/sync-engine/src/sim/scenario/` and `pkgs/room/src/sim/scenario/` (`define-*-system ↔ system/node-kinds/play`). Verified present on `HEAD` before this work; not introduced by the rename. |

**Phase 3 — structural**
8. Physical layers `src/kernel|models|harness` + depcruise rules `kernel-not-models`, `kernel-not-harness`, `models-not-harness`; fix L1 (knob reader injected structurally), L2 (`http` moves to harness `WorldPorts`).
9. `ChoiceEngine` (`choose(id, alternatives, weights?)`), `SeededResolver`, structural `ChoiceId` paths; Scheduler takes `ChoiceEngine` (required — delete FIFO fallback, L4/I4); scheduling choice id `<world>/scheduler/next`.
10. Network hazards → weighted Choices at `<world>/network/<from>→<to>/{drop,duplicate,latency,reorder,partition,heal}` (L5/I5). Golden test `network.contract.test.ts:133` will change → re-pin.
11. Clock subordinate: `createVirtualClock` mutator private to Scheduler; `Scheduler.clock` becomes read-only `Clock`; delete `scheduler.reset` (D6) → `Task.owner` + `Scheduler.cancel(taskId)`; `timers.ts` uses `cancel` (fix L12). Migrate room/sync-engine kits.
12. Trace envelope `{ schemaVersion: 1, frameworkVersion, seed, checksumInterval, records }`; `parseTrace` rejects unknown version loudly; `TraceResolver` drives choices from records (with default fallback for unresolved ids); Repro schema v2 (D10). Optional `VirtualTime` brand (D8).

**Phase 4 — fill gaps (smallest first)**
13. Divergence checksums: `Scenario.checksum?(world) → string` hook, `'checksum'` records every N Commands, verified in Replay.
14. Property taxonomy: `always(p)`, `eventually(p, { withinMs })`, `until(p, q, { withinMs })` as values on a `properties` field; `World.never` → `always(¬p)` call-site rewrite (D11); fairness statement in docs.
15. Node lifecycle `crash`/`restart` in the framework (task cancellation by owner; Storage crash hook if D9=b).
16. Shrinker over the in-sim choice sequence (delta-debug records; unresolved → default).
17. `buggify(id, probability)` on `WorldPorts.choice`.
18. Reference-model checking against real outputs: `postcondition(model, world, command)`; `FailureReport` with first violating step; Storage per D9.
19. Framework `replay` CLI (`pkgs/determinism/scripts/replay.ts`) reading a `FailureReport`/Repro/Trace file; consumer `run-seed.ts` scripts become thin wrappers.

**Phase 5 — hardening**
20. Lint: extend `no-bare-io.grit` (or a new `no-host-async.grit`) with `setImmediate`, `queueMicrotask`, `Promise.race` for `pkgs/determinism/src/**` with a single allow-list for `kernel/quiescence.ts` + `kernel/scheduler-core.ts`; depcruise layer rules in CI.
21. Meta-tests: same seed twice → identical `Trace` + checksums; corrupt one choice record → `TraceResolver` divergence fires at that index; v1 trace against v2 parser → loud failure.
22. `README`/`CONTEXT.md`/`AGENTS.md` glossary pass; delete `docs/determined*.md` or mark as historical background (they document a different library's API).

---

## 10. Deprecated aliases

None planned (see D1). If D1 is overridden, aliases will be listed here with a removal commit reference.

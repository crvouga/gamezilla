---
name: DST Scenario Host Surface
overview: Reduce `@pkgs/dst` to an algebra of singular, composable primitives — Host, System, Observation, Action, Property, Run — where every Observation / Action / Property body is an async generator speaking one three-word protocol (read an Observation, `draw` from a `Gen`, yield a function to act) and four verbs (`start`, `walk`, `check`, `replay`) drive it. Properties are monitors that read Observations at every checkpoint and throw on violation; they attach to the Run so every scripted test, sim test, walk and replay checks them identically. No formula algebra, no declarative action fields, no `Sut`, no nodes / knobs / topology / plural catalogs / extension merging; every consumer migrates in one change.
todos:
  - id: kernel
    content: "`@pkgs/dst/kernel`: `Clock` / `Scheduler` / `Rng` interfaces + virtual and wall impls; derived `createTimers`, `createNetwork`, `createTrace`, `fingerprint`; nothing else exported"
    status: pending
  - id: host
    content: "`defineHost({ caps, open })` + `Host.with(session => extra)`; `Session` with `fork(name)`; `Capability` / `CapabilityError`; `virtualHost()` (default host for `start` / `check`) / `wallHost()` — the only two ready-made values in `@pkgs/dst`"
    status: pending
  - id: system
    content: "`defineSystem({ id, knobs?: Gen<K>, boot(session, knobs) → S })` returning `System` with bound `defineObservation` / `defineAction` / `defineProperty`; systems nest via `session.fork`; `boot` puts `session` on `S` when actions need it; delete `defineScenario` / `node` / `knob` / `extend` / `nodes` / `edges` / `faults`"
    status: pending
  - id: protocol
    content: "The body protocol: `Effect<S> = Observation | Draw | Act`; `observe(...o)` tuple request, `draw(gen)` request, yielded function = act; one driver (`step.ts`) answers reads from the checkpoint memo, draws from the recording / replaying / scripted rng, acts against the surface + `session.settle()`; `Observation` / `Draw` are iterable so `yield*` returns their `T`"
    status: pending
  - id: observation
    content: "`defineObservation({ id, async *read(s) })`: leaf reads touch the surface, composed ones `yield*` other observations; per-checkpoint memo keyed by observation id; only observations a body asks for run; observed values are the recorded state; no `.map`"
    status: pending
  - id: action
    content: "`defineAction({ id, weight?, requires?, async *run() })`: reads, then `draw`s, then acts; `return` before the first draw / act = not enabled (probe rule); scripted `run.apply(a, ...draws)` answers draws positionally and throws `ActionNotEnabled`; `weighted([[w, a], …])`; no built-in actions — `partition` / `heal` / `passTime` are `defineAction`s over `s.session` in the specs that want them"
    status: pending
  - id: property
    content: "`defineProperty({ id, requires?, async *monitor() })`: each `yield*` is answered at the next checkpoint (checkpoint 0 at `start`); throw inside the loop = safety violation (`PropertyViolation`, in-trace); throw from `finally` when the framework closes monitors (dispose / episode end) = unmet obligation (end-of-trace); `check` fails the campaign on an obligation unmet in every episode (vacuity)"
    status: pending
  - id: gen
    content: "`Gen<T> = (rng: Rng) => T` is the only randomness interface (`knobs`, `draw`); `@pkgs/dst`, `/pbt`, `/kernel` import no PBT library (depcruise rule + contract test; `fast-check` → optional peer + dev dep); new entrypoint `@pkgs/dst/fast-check` with `gen(arbitrary) → Gen<T>` (drives fc via a pure-rand `RandomGenerator` over our `Rng`) and `arbitrary(gen) → fc.Arbitrary<T>`; delete `arbSeed` / `runProperty` / `arbs.ts`"
    status: pending
  - id: start
    content: "`start(system, { seed, host?, knobs?, properties? })` → `Run<S>` = `{ apply(action, ...draws), observe(o), assert(property), [Symbol.asyncDispose] }` and nothing else; `apply` is the only checkpoint; `assert` runs a monitor for one checkpoint; dispose closes monitors (end-of-trace obligations throw here)"
    status: pending
  - id: walk
    content: "`walk(run, { actions, steps? | budgetMs?, stopOnViolation? })` → `Walk { transitions, violations, coverage, choices }`; step = probe every leaf to its first draw / act (reads memoised) → pick enabled leaf by weight → finish it → checkpoint → record; `run.apply` is the same step with the leaf fixed"
    status: pending
  - id: pbt
    content: "`check(system, { properties, actions, … })` = episodes × (start + walk + close monitors) + native shrink over recorded choices (drop steps, then minimise draws toward 0, re-running `Gen`s on the shrunk draws — no library shrinkers); `replay(system, repro | walk, …)` re-walks choices and diffs observed-state fingerprints; Repro v3 = `{ seed, knobs, choices: [{ action, draws }], meta }`"
    status: pending
  - id: ui-explore
    content: "`@pkgs/ui-testing/explore`: `Driver.inventory()` + bare exports — observations `inventory(actor)` / `screen(actor)` / `errors(actor)`, actions `tap / fill / back / scroll`, properties `noErrorBoundary / noConsoleError`; RNTL and Playwright"
    status: pending
  - id: acme-kv
    content: "acme-kv fixture as the canonical spec: forked sessions, leaf + composed observations, `defineAction` × n, `defineProperty` × n incl. one obligation, scripted test with attached properties, `check` on virtual, `walk` + `replay` on wall; contract tests: types, observation, action, monitor, gen, shrink, weighted, checkpoint, walk, fork, knobs-from-seed, wall-host, capability, no-pbt-library, public-api"
    status: pending
  - id: migrate-sync
    content: "sync-engine: `defineSyncSystem` → `defineSystem` with boot loop; `sync-observations.ts` (`pending`, `serverHash`, `clientHash`, `invariantViolations` from today's `checkInvariants`), one `defineAction` per stimulus, one `defineProperty` per invariant; every sim test opens with `properties: SYNC_PROPERTIES`; delete WeakMap runtime + aliases"
    status: pending
  - id: migrate-room
    content: "room (+chess): `defineRoomSystem` → `defineSystem`; observations `serverHash`, `clientState(id)`, `connected`; singular actions / properties; sim tests attach properties; delete `bindRoomRuntime` / `bootRoomKitWorld`"
    status: pending
  - id: migrate-small
    content: "matchmaking, auth, db-schema, db-indexes, sql-client: single-`boot` systems, small observations, singular actions / properties, `start` + host, drop wrappers"
    status: pending
  - id: product-host
    content: "@sim/test: `simHost` / `maxHost` = `virtualHost().with(…)` / `wallHost().with(s => ({ sql, ui, http }))`; `defineProductSystem` → `defineSystem`; `openSim` attaches `PRODUCT_PROPERTIES` (`noErrorBoundary`, domain invariants) so every existing scenario checks them; `product-walk.sim.test.tsx` runs `walk` with the `@pkgs/ui-testing/explore` actions + a product `partition` action on both hosts"
    status: pending
  - id: sim-console
    content: "sim/console `createSim` takes a `Session`; playground root opens `virtualHost()`; Reports render `Walk.transitions` (observed state before / action / after, violations on the timeline)"
    status: pending
  - id: docs-guards
    content: "Rewrite pkgs/dst README around the algebra table + protocol + checkpoint loop + one full spec; add CONTEXT.md; update DETERMINISM.md / AGENTS.md / TESTING.md; depcruise rule for `@pkgs/dst/kernel`"
    status: pending
  - id: verify
    content: "tc + tests for dst, ui-testing and every consumer; @sim/test sim and max incl. the walk test; `rg` sweep for removed names; `bun run lint`; `bun check`"
    status: pending
isProject: false
---

# DST redesign: an algebra of singular primitives, one body protocol

## Why

The current `@pkgs/dst` has the right seed but hard-codes non-primitives and lacks two primitives:

- **Topology is baked in.** `node` / `knob` / `nodes` / `edges` / `faults` / `ctx.peers` / `nodeIds(role)` are one way to build a multi-node system; single-node consumers carry them as dead weight.
- **Fidelity is not a framework concept.** `openWorld` mints virtual ports + model network itself; `sim`/`max` lives only in [sim/test/src/setup/open-sim.ts](sim/test/src/setup/open-sim.ts).
- **There is no named observation of state.** Properties are `check(surface) => boolean` doing ad-hoc live reads, so there is no recorded state sequence, no `before → action → after` trace, no coverage, no replay divergence check. Bombadil solves this with `extract` cells: small, named, JSON-valued reads against the live system that are the only thing properties see.
- **Properties are locked inside PBT.** Scripted sim tests assert one thing at the end; the invariants encoded in `properties<S>()` never run against the ~150 scripted sync / room / product scenarios.
- **Catalogs are plural records; surfaces leak the kernel; the API is wide and stale.** WeakMap runtime bags, `@deprecated` aliases, 25-member `WorldControls`, README documents a deleted API, `pkgs/dst/CONTEXT.md` missing.

## The algebra

Six sorts. Each has exactly one constructor (`defineX`) or is produced by a verb. Observation, Action and Property bodies are **async generators** that speak one protocol with three requests — read an Observation, `draw` from a `Gen`, yield a function to act — so composition and control flow are plain TypeScript (`yield*`, `if`, `for`, `try / finally`) and the framework still sees every read (memo), every draw (repro / shrink) and every act (settle, enablement). Two plain function types carry the rest: `Gen<T>` (randomness) and `Act<S>` (what an action yields). Nothing else is public, and no third-party PBT library appears in any signature.

```mermaid
flowchart LR
  subgraph sorts [Sorts and their operators]
    Host["Host — defineHost · .with(extra)"]
    System["System — defineSystem · nests via session.fork"]
    Observation["Observation — defineObservation · yield* another · observe(a, b)"]
    Action["Action — defineAction · weighted([[w, a]…])"]
    Property["Property — defineProperty · control flow"]
    Run["Run — start · apply / observe / assert"]
  end
  Gen["Gen T = (rng) => T · adapters: @pkgs/dst/fast-check"]
  Host -->|"open(seed)"| Session["Session · fork(name)"]
  System -->|"boot(session)"| Surface["Surface S"]
  Gen -->|"knobs"| System
  Gen -->|"yield* draw(gen)"| Action
  Session --> Run
  Surface --> Run
  Run -->|"read(s), memo per checkpoint"| Observation
  Observation -->|"yield* o"| Action
  Observation -->|"yield* observe(a, b) — one per checkpoint"| Property
  Run -->|"apply(action)"| Checkpoint["Checkpoint: probe → draw → act + settle → resume monitors → record"]
  Checkpoint --> Walk["Walk: transitions · violations · coverage · choices"]
  Walk -->|"check = episodes × walk + shrink"| Report
  Walk -->|"replay = re-walk choices, diff fingerprints"| Report
```

- **Host** (fidelity). `defineHost({ caps, open })`. Operator `host.with(session => extra)` adds ports (sql, ui, http). Laws: `h.with(f).with(g) ≡ h.with(s => ({ ...f(s), ...g(s) }))`; `h.with(() => ({})) ≡ h`.
- **Session** (opened Host). Kernel (`Clock`, `Scheduler`, `Rng`) + derived (`Timers`, `Network`, `Trace?`) + `caps`. Operator `session.fork(name)`: child Rng stream + network address `name`, shared scheduler / network / trace. Laws: forks are independent streams; adding a fork never perturbs siblings; deterministic per seed.
- **System** (recipe). `defineSystem({ id, knobs?, boot(session, knobs) → S })`. Composes by nesting: `boot` may call another System's `boot` on `session.fork(name)`. `S` is what observations read and actions act on; a `boot` that wants fault actions puts `session` on `S`.
- **Observation** (a named read of live state). `defineObservation({ id, async *read(s: S) { … return value } })`, value JSON. A leaf reads the real surface — a `SELECT count(*)`, one actor's screen name, one client's pending count — never a whole-state dump. A composed observation reads other observations with `yield*` and never touches `s`. `observe(a, b, …)` is the tuple observation (one request, one checkpoint). Laws: memoised per checkpoint (one read per id per step however many bodies ask); only observations some body asked for run at all; an observation is a pure function of the checkpoint (reading it twice at one checkpoint is one read). The observed values at a checkpoint are the recorded state, so `fingerprint`, transitions, coverage and replay divergence work on exactly the slice that was needed — Bombadil's `State` captured per step, with observations as the cells.
- **Gen** (randomness). `type Gen<T> = (rng: Rng) => T` — a deterministic function of draws from the session's `Rng` (`next(): number` in [0, 1), `fork(name)`). It is the only randomness interface the framework knows: `knobs` is a `Gen<K>`, `draw(gen)` is how an action gets a payload. Composition is function composition; a library is a `Gen` factory behind an adapter (`gen(fcArbitrary)` in `@pkgs/dst/fast-check`; a `@pkgs/dst/<lib>` adapter for any other). Laws: same draws ⇒ same value; `gen(fc.constant(x)) ≡ () => x`. Because every `rng.next()` a `Gen` makes is recorded as a **choice**, shrinking is done by the framework over the draw sequence (Hypothesis-style internal shrinking) and re-running the `Gen`s — adapted libraries' own shrinkers are never used, so nothing is lost by adapting.
- **Action** (stimulus). `defineAction({ id, weight?, requires?, async *run() { … } })`. The body reads (`yield* o`), decides (`if (…) return`), draws (`yield* draw(gen)`) and acts (`yield s => s.put(k, v)`). **Enablement is the probe rule**: the framework runs the body until its first `draw` or act; if the body `return`s first, the action is not enabled at this checkpoint. Each yielded function is awaited against the surface and followed by `session.settle()` before the body resumes, so a body may act, read the result, and act again. Operator `weighted([[w, a], …]) → Action`. Laws: associative up to weight normalisation; `weighted([[1, a]]) ≡ a`; disabled leaves vanish (so a branch with no enabled leaf vanishes too). Scripted `run.apply(a, ...draws)` answers the body's draws positionally and throws `ActionNotEnabled` if the body returns before them. Observation and Action are duals: one looks at the surface, the other acts on it — and only through `yield`, so the framework is always between them.
- **Property** (a monitor over checkpoints). `defineProperty({ id, requires?, async *monitor() { for (;;) { … } } })`. Each `yield*` in a monitor is answered at the **next checkpoint** — one `yield*` = one step, so several values at one checkpoint are read with `observe(a, b, …)`; carrying state across iterations gives `next` (keep the previous values), bounded liveness (read a clock observation), and model-based checks (an in-memory model beside the system) with no algebra. Throwing is the violation. Laws: a throw while the monitor is being resumed at a checkpoint is a **safety violation** at that step (`PropertyViolation`, fails the run); a throw while the framework is **closing** monitors (`return()` at dispose / episode end, i.e. from `finally`) is an **unmet obligation** (end-of-trace) — how `sometimes` / coverage is written; `check` fails the campaign only when an obligation is unmet in every episode.
- **Run** (opened System, with properties attached). Three methods, one per sort it touches: `apply(action, ...draws)`, `observe(observation)`, `assert(property)`. `apply` is the only **checkpoint**: probe the action (throw `ActionNotEnabled`), finish its body (draws from the session rng unless supplied — recorded as a `Choice`; acts + settle), resume every attached monitor with the observations it asked for (fresh reads, memoised), record the transition, throw `PropertyViolation`. `observe` is a memoised read at the current checkpoint — the scripted test's `expect` input. `assert` runs a property's monitor for exactly one checkpoint (the current one) and closes it: any property doubles as a point assertion. Time, network, crashes and convergence are not methods: they are actions (`passTime`, `partition`, `heal`, `restart`) over `s.session`, applied like any other. `[Symbol.asyncDispose]` closes the attached monitors, so a scripted test's obligations are checked at `await using` scope end. This is what makes properties a force multiplier: a scripted sync test, a `@sim/test` chess flow, a random walk and a replay are all just different sequences of `apply`; the monitors are resumed identically in all of them.
- **Verbs**. `start(system, { host, seed, knobs?, properties? })`, `walk(run, { actions, … }) → Walk`, `check(system, …) → Report`, `replay(system, repro | walk, …) → Report`. `check ≡ shrink ∘ episodes ∘ (close ∘ walk ∘ start)`; `replay(walk(r)) ≡ walk(r)` up to fingerprints of observed state.

## Naming scheme (enforced by an export-snapshot contract test)

- **`defineX({ … }) → X`**, singular, one per sort: `defineHost`, `defineSystem`, `defineObservation`, `defineAction`, `defineProperty`. Every one takes one object with an `id` (except Host) and returns the noun type.
- **Bare lowercase requests, operators and verbs**: `observe`, `draw`, `weighted`, `start`, `walk`, `check`, `replay`, `parseRepro`, `stringifyRepro`. There is no `now` / `always` / `eventually` / `sometimes` / `next` / `not`: those are `if`, `for (;;)`, a clock read, `finally`, the previous iteration's values, and `!`.
- **Body methods are verbs named for the sort**: `read` (Observation), `run` (Action), `monitor` (Property). All three are `async *`.
- **Ready-made values are bare exports, owned by the package whose every use case would otherwise write them.** No `std` namespace. `@pkgs/dst` ships exactly two: `virtualHost()` — the default `host` for `start` / `check`, so most specs never name a host — and `wallHost()`. Fault actions are not framework values: `partition` / `heal` / `passTime` are four-line `defineAction`s over `s.session.network` / `s.session.scheduler`, written by the spec that wants them (the counter spec has none). `@pkgs/ui-testing/explore` ships what every UI spec needs and nothing else: observations `inventory(actor)`, `screen(actor)`, `errors(actor)`; actions `tap(actor)`, `fill(actor)`, `back(actor)`, `scroll(actor)`; properties `noErrorBoundary(actor)`, `noConsoleError(actor)`.
- **Bound spec constructors**: `System` exposes `defineObservation` / `defineAction` / `defineProperty` with `S` fixed; specs destructure them once (`const { defineObservation, defineAction, defineProperty } = kv`) and write no type arguments — `read(s)` gets `s: S`, a yielded `s => …` is contextually typed as `Act<S>`, `yield* o` returns `o`'s `T`. The bare exports remain for library code generic over `S`.
- **Library adapters**: one entrypoint per library, named after it, exporting a lowercase constructor into our type and one back: `@pkgs/dst/fast-check` → `gen(arbitrary): Gen<T>`, `arbitrary(gen): fc.Arbitrary<T>`. The core entrypoints never import a PBT library.
- **Noun types only**: `Host`, `Session`, `System`, `Run`, `Observation`, `Action`, `Property`, `Effect`, `Act`, `Draw`, `Gen`, `Walk`, `Report`, `Repro`, `Choice`, `Capability`, `CapabilityError`, `PropertyViolation`, `ActionNotEnabled`, `Ports`, `Clock`, `Scheduler`, `Rng`. No plurals, no `Extractor` / `Cell` / `Formula` / `Arbitrary` / `Sut` / `World`, no `*Def`, `*Catalog`, `*Extension`, `*Kit`, `*Controls`, `Base`, `Unbound*`, `Node*`, `Knob*`.

## Public API (the whole thing)

### `@pkgs/dst`

```ts
// kernel interfaces (impls in @pkgs/dst/kernel; hosts pick them)
type Clock = { now(): number }
type Scheduler = { schedule(task, atMs?): Disposable; advance(ms): Promise<void>; settle(): Promise<void>; virtual: boolean }   // settle: drain ready events without moving time
type Rng = { next(): number; fork(name: string): Rng }                     // next(): uniform in [0, 1). The one draw primitive.
type Gen<T> = (rng: Rng) => T                                              // randomness: a deterministic function of draws. No library type anywhere below.
type Ports = { clock; timers; rng; createId(); random(); network: Endpoint }
type Session<P extends Ports = Ports> = { ports: P; scheduler; network: Network; trace?: Trace; caps: ReadonlySet<Capability>; fork(name): Session<P>; dispose() }
type Capability = 'virtualTime' | 'partition' | 'trace'

// the body protocol — what a generator may yield
type Act<S> = (s: S) => unknown                                            // act: awaited against the surface, then session.settle()
type Draw<P>                                                               // draw(gen): yield* returns P; every rng.next() is recorded as part of a Choice
type Effect<S> = Observation<S, unknown> | Draw<unknown> | Act<S>
type Body<S, R> = AsyncGenerator<Effect<S>, R, any>
observe<S, O extends Observation<S, unknown>[]>(...o: O)                                → Observation<S, ValuesOf<O>>   // tuple read: one request, one checkpoint
draw<P>(g: Gen<P>)                                                                       → Draw<P>
// Observation<S, T> and Draw<P> are iterable (a one-shot generator yielding the request and returning the answer), so `const v = yield* o` is typed T.

// constructors — one per sort
defineHost<P>({ caps, open(seed): Promise<Session<P>> })                                 → Host<P>
defineSystem<S, K = {}>({ id, knobs?: Gen<K>, boot(session, knobs): Promise<S> })         → System<S, K>     // S inferred from boot
defineObservation<S, T extends JsonValue>({ id, read(s: S): Body<S, T> })                 → Observation<S, T> // may yield Observations only
defineAction<S>({ id, weight?, requires?, run(): Body<S, void> })                         → Action<S>         // yields Observations, Draws, Acts; return before the first Draw / Act = not enabled
defineProperty<S>({ id, requires?, monitor(): Body<S, void> })                            → Property<S>       // yields Observations only; each yield* is answered at the next checkpoint; throw = violation

// System carries the three spec constructors pre-bound to its S — the same functions, S fixed:
type System<S, K> = { id; knobs; boot; defineObservation: <T>(def) => Observation<S, T>; defineAction: (def) => Action<S>; defineProperty: (def) => Property<S> }
// Spec code:     const { defineObservation, defineAction, defineProperty } = kv;   // zero type annotations after this line
// Library code:  bare defineObservation<S> / defineAction<S> / defineProperty<S> for values generic over S (@pkgs/ui-testing/explore)
// Unification:   start(kv, { properties }) / check(kv, { properties, actions }) require Property<S> / Action<S> for kv's S — mixing systems is a compile error.

// operators
Host.with<Q>(extra: (s: Session<P>) => Q)                                       → Host<P & Q>
Session.fork(name)                                                              → Session<P>
weighted<S>(branches: readonly [number, Action<S>][])                           → Action<S>

// hosts — the only ready-made values
virtualHost({ network?: NetworkFaults, startTime? })         // caps: virtualTime, partition, trace. The default host.
wallHost({ network: 'model' | 'none', settleMs? })           // caps: partition iff 'model'

// instances
type Run<S> = {                                                            // what tests receive: three methods, one per sort
  apply(action: Action<S>, ...draws: readonly unknown[]): Promise<void>,   // the checkpoint; draws answer the body's `draw`s in order, generated from the session rng when omitted (recorded as a Choice)
  observe<T>(o: Observation<S, T>): Promise<T>,                            // memoised at the current checkpoint
  assert(p: Property<S>): Promise<void>,                                   // run the monitor for this one checkpoint, then close it; throws PropertyViolation
  [Symbol.asyncDispose](): Promise<void>,                                  // closes attached monitors: unmet obligations throw here
}
type Choice = { action: string; draws: readonly number[] }                 // one step: which leaf, and every rng.next() its draws consumed
type Walk = { transitions: readonly { t; before: Record<observationId, JsonValue>; action: { id; payload: readonly JsonValue[] }; after: Record<observationId, JsonValue> }[]; violations: readonly { property; at; error }[]; coverage: { states; actions: Record<string, number> }; choices: readonly Choice[] }

// verbs
start(system, { seed, host?, knobs?, properties?: readonly Property<S>[] })  → Run<S>   // host defaults to virtualHost(); boot, then checkpoint 0 (monitors' first reads); attached monitors resumed at every apply
walk(run, { actions: readonly Action<S>[], steps? | budgetMs?, stopOnViolation? }) → Walk // in-trace violations collected into Walk (stopOnViolation ends the walk early instead of throwing)
parseRepro / stringifyRepro                                                              // Repro v3: { seed, knobs, choices, meta: { system, host } }
```

### `@pkgs/dst/fast-check` — the only module that imports `fast-check`

```ts
gen<T>(arbitrary: fc.Arbitrary<T>): Gen<T>          // rng => arbitrary.generate(new fc.Random(randomGeneratorOver(rng)), undefined).value
arbitrary<T>(g: Gen<T>): fc.Arbitrary<T>            // for code that still runs fc.assert / @pkgs/pbt with our generators; no shrink (shrinking is ours)
```

`randomGeneratorOver(rng)` is a pure-rand `RandomGenerator` (`clone`, `next`, `unsafeNext` → int32 from `rng.next()`), so every value fast-check produces is a function of recorded draws and replays / shrinks exactly like a hand-written `Gen`. fast-check's shrinkers are ignored by construction. Any other library gets the same shape of adapter in its own entrypoint; the core never grows a dependency for it.

Removed: `defineScenario`, `node`, `knob`, `nodeCount`, `extend`, `nodes`, `edges`, `faults`, whole-state `observe(world) → O` on the system, `actions<S>()`, `properties<S>()`, `property.*` namespace, the whole `std` namespace, the `Formula` algebra (`now` / `next` / `always` / `eventually` / `sometimes` / `not` / `.and` / `.or` / `.implies` / `.within`), `Observation.map`, action fields `when` / `from` / `generate` / `apply`, `Sut`, `World` / `openWorld` / `WorldControls` and every World member except what `Run` keeps (`world.ports`, `world.nodes`, `world.nodeIds`, `world.partition`, `world.heal*`, `world.hold`, `world.release*`, `world.network*`, `world.edges`, `world.startTime`, `world.resolve`, `world.propertyCoverage`, `world.advance`, `world.quiesce`, `world.converge`, `world.check`, `world.now`, `world.waitUntil`, `world.never`, `world.session`, `world.surface`, `world.walk`, `world.dispose`), `System.converge`, `openWorld({ onViolation })`, `WorldPorts`, `createWorldPorts`, `applyActions`, `STEP_MS`, `bindActionKind`, `Base`, `ScenarioDef`, `NodeDef`, `CountedNodeDef`, `NodeEntry`, `KnobDef`, `ActionCatalog`, `UnboundActionDef`, `PropertyCatalog`, `PropertyDef`; every `fc.Arbitrary` in a signature, `arbSeed`, `arbKnobs`, `runProperty`, `arbs.ts`, and the `@pkgs/pbt` dependency of `@pkgs/dst`.

### `@pkgs/dst/kernel` — host authors and `sim/console` only

`createVirtualClock`, `createVirtualScheduler`, `createWallClock`, `createWallScheduler`, `createRng`, `createTimers`, `createNetwork` (+ `Network`, `Endpoint`, `NetworkFaults`, `RELIABLE_NETWORK`), `createTrace` (+ `Trace`), `fingerprint`, `canonicalJsonStringify`. Depcruise: only `pkgs/dst/**`, `sim/**`, `**/sim/**` may import it.

### `@pkgs/dst/pbt`

```ts
check(system, { host?, properties, actions, seed?, knobs?, episodes?, steps?, shrink?, swarm?, budgetMs?, stopOnViolation? }) → Report   // throws CheckFailedError
replay(system, repro | walk | readonly repro[], { host?, properties, actions })                                                → Report   // re-walk; diffs fingerprint(observed) per step; trace gate when caps has trace
```

`check` owns episodes and shrinking natively: the campaign `seed` (default from `PBT_SEED` / wall entropy at the test entry) forks one `Rng` per episode; `knobs` are `system.knobs(episodeRng)`; each step's leaf pick and payload draws are recorded as `Choice`s. An episode = `start` + `walk` + close monitors. A safety violation fails the episode and is shrunk: (1) delta-debug over steps (drop blocks of `Choice`s), then (2) per-draw minimisation toward 0 (binary search on each `draws[i]`), re-running the affected `Gen` on the shrunk draws and re-walking — the same replaying `Rng` `replay` uses. An obligation unmet at close is recorded per property; `check` fails with `Vacuity` when a property's obligation was unmet in every episode (no shrink — there is no witness to minimise). Fewer steps and smaller payloads fall out of one mechanism for every library or hand-written `Gen`.

### `@pkgs/ui-testing/explore` — Bombadil browser defaults for our drivers

```ts
Driver.inventory(): Promise<Inventory>                                   // fingerprinted pressables, inputs, back-able navigation
inventory(actor) / screen(actor) / errors(actor)            → Observation<S, …>   // actor: (s: S) => Driver | null
tap(actor) / fill(actor) / back(actor) / scroll(actor)      → Action<S>           // read inventory(actor), return if empty, draw a target, yield s => driver.tap(target)
noErrorBoundary(actor) / noConsoleError(actor)              → Property<S>         // for (;;) if ((yield* errors(actor)).length) throw
```

## A complete spec

Specs are free to use fast-check for payload generation through the `gen` adapter; the framework only ever sees `Gen<T>`.

```ts
import fc from 'fast-check';
import { gen } from '@pkgs/dst/fast-check';

const kv = defineSystem({
  id: 'kv',
  knobs: gen(fc.record({ clients: fc.integer({ min: 1, max: 4 }) })),          // Gen<{ clients: number }>; equivalently: rng => ({ clients: 1 + Math.floor(rng.next() * 4) })
  boot: async (session, { clients }) => {
    const server = startServer(session.fork('server'));
    return { session, server, clients: range(clients).map(i => startClient(session.fork(`client:${i}`), 'server')) };   // `session` on S so fault actions can reach network / scheduler
  },
});
const { defineObservation, defineAction, defineProperty } = kv;   // constructors bound to this system's surface type; no <S> anywhere below

// observations: leaves read the live system; composed ones read other observations
const clientIds  = defineObservation({ id: 'clientIds',  async *read(s) { return s.clients.map(c => c.id); } });
const pending    = defineObservation({ id: 'pending',    async *read(s) { return s.clients.map(c => c.pending()); } });
const serverHash = defineObservation({ id: 'serverHash', async *read(s) { return s.server.hash(); } });          // SELECT md5(...) — not a dump
const clientHash = defineObservation({ id: 'clientHash', async *read(s) { return Promise.all(s.clients.map(c => c.hash())); } });
const quiet      = defineObservation({ id: 'quiet',      async *read()  { return (yield* pending).every(n => n === 0); } });
const converged  = defineObservation({ id: 'converged',  async *read()  { const [h, cs] = yield* observe(serverHash, clientHash); return cs.every(c => c === h); } });

// actions: read → decide → draw → act. `return` before the first draw / act means "not enabled here".
const put = defineAction({ id: 'put', weight: 3, async *run() {
  const ids = yield* clientIds;
  if (ids.length === 0) return;
  const { client, key, value } = yield* draw(gen(fc.record({ client: fc.constantFrom(...ids), key: fc.string(), value: fc.string() })));
  yield s => s.clients.find(c => c.id === client)!.put(key, value);
}});
const restartAny = defineAction({ id: 'restartAny', async *run() {
  const ids = yield* clientIds;
  if (ids.length === 0) return;
  const id = yield* draw(rng => ids[Math.floor(rng.next() * ids.length)]!);        // hand-written Gen — no library at all
  yield s => s.clients.find(c => c.id === id)!.restart();
}});
// faults are ordinary actions over the session's network and clock — nothing built in
const partition = defineAction({ id: 'partition', requires: ['partition'], async *run() {
  const ids = yield* clientIds;
  if (ids.length === 0) return;
  const id = yield* draw(rng => ids[Math.floor(rng.next() * ids.length)]!);
  yield s => s.session.network.partition(['server'], [`client:${id}`]);
}});
const heal     = defineAction({ id: 'heal',     requires: ['partition'],   async *run() { yield s => s.session.network.healAll(); } });
const passTime = defineAction({ id: 'passTime', requires: ['virtualTime'], async *run() {
  const ms = yield* draw(rng => Math.floor(rng.next() * 5_000));
  yield s => s.session.scheduler.advance(ms);
}});
const faults = weighted([[2, partition], [2, heal], [1, passTime]]);

// properties: monitors. One `yield*` per checkpoint; throw = violation.
const converges = defineProperty({ id: 'converges', async *monitor() {              // always(quiet ⇒ converged)
  for (;;) {
    const [q, ok, h, cs] = yield* observe(quiet, converged, serverHash, clientHash);
    if (q && !ok) throw new Error(`quiet but diverged: server ${h}, clients ${cs.join(',')}`);
  }
}});
const agree = defineProperty({ id: 'agree', async *monitor() {                      // not attached (false mid-partition); used as a point assertion via run.assert
  for (;;) if (!(yield* converged)) throw new Error('clients disagree with the server');
}});
const writesHappen = defineProperty({ id: 'writesHappen', async *monitor() {        // sometimes(serverHash ≠ empty): an obligation, checked when monitors close
  let seen = false;
  try { for (;;) seen ||= (yield* serverHash) !== EMPTY_HASH; }
  finally { if (!seen) throw new Error('no write ever reached the server'); }
}});
const KV_PROPERTIES = [converges, writesHappen];

// 1. scripted test — three verbs; monitors resumed at every apply; host defaults to virtualHost()
await using run = await start(kv, { seed: 7, properties: KV_PROPERTIES });
await run.apply(put, { client: 'client:0', key: 'a', value: '1' });     // the argument answers the body's `draw`
await run.apply(partition, 'client:0');
await run.apply(put, { client: 'client:0', key: 'a', value: '2' });
await run.apply(heal);
await run.apply(passTime, 5_000);                                       // let retries fire; `converges` is re-checked here like at every apply
await run.assert(agree);                                                // point check: every client matches the server now
expect(await run.observe(quiet)).toBe(true);                            // ad-hoc expectation: read and compare
await run.apply(put);                                                   // no draws supplied: drawn from the session rng (deterministic per seed)
// scope end: monitors close → writesHappen's `finally` runs (satisfied here)

// 2. exploration
await check(kv, { properties: KV_PROPERTIES, actions: [put, restartAny, faults], episodes: 50, steps: 40 });

// 3. same system, wall host, headless walk + replay
await using wall = await start(kv, { host: wallHost({ network: 'model' }), seed: 7, properties: KV_PROPERTIES });
const w = await walk(wall, { actions: [put, restartAny, faults], budgetMs: 10_000 });   // passTime drops out: wall host lacks virtualTime; violations land in w.violations
expect(w.violations).toEqual([]);
await replay(kv, w, { host: wallHost({ network: 'model' }), properties: KV_PROPERTIES, actions: [put, restartAny, faults] });
```

## A second spec: SQL observations, SQL actions (sync-engine shape)

Observations are queries — aggregates and hashes, never row dumps. Actions are writes through the real write path (`mutate`) or a server-side SQL write that must publish. Handles come from today's `SimClientHandle` (`db: SqlClient`, `mutate`) and `SimServer`.

```ts
const sync = defineSystem({
  id: 'sync',
  knobs: gen(fc.record({ clients: fc.integer({ min: 1, max: 3 }) })),
  boot: async (session, { clients }) => {
    const server = await startSyncServer(session.fork('server'));                       // Postgres (pglite / embedded) via session.ports.sql
    const clientList = await Promise.all(range(clients).map(i => startSyncClient(session.fork(`client:${i}`), server)));   // local SQLite each
    return { session, server, clients: clientList };
  },
});
const { defineObservation, defineAction, defineProperty } = sync;

// --- observations: SQL against the live databases ------------------------------------------------
const clientIds   = defineObservation({ id: 'clientIds',   async *read(s) { return s.clients.map(c => c.id); } });
const pending     = defineObservation({ id: 'pending',     async *read(s) {
  return Promise.all(s.clients.map(c => c.db.query<{ n: number }>(sql`select count(*) as n from sync_engine_mutations where uploaded_at is null`).then(r => r[0].n))); } });
const serverNotes = defineObservation({ id: 'serverNotes', async *read(s) {
  return s.server.db.query<{ h: string; n: number }>(sql`select md5(string_agg(id || ':' || coalesce(body,'') || ':' || coalesce(deleted_at::text,''), ',' order by id)) as h, count(*) as n from notes`).then(r => r[0]); } });
const clientNotes = defineObservation({ id: 'clientNotes', async *read(s) {
  return Promise.all(s.clients.map(c => c.db.query<{ h: string; n: number }>(sql`select hex(md5(group_concat(id || ':' || coalesce(body,'') || ':' || coalesce(deleted_at,''), ','))) as h, count(*) as n from (select * from notes order by id)`).then(r => r[0]))); } });
const liveNoteIds = defineObservation({ id: 'liveNoteIds', async *read(s) {
  return s.server.db.query<{ id: string }>(sql`select id from notes where deleted_at is null order by id limit 50`).then(r => r.map(x => x.id)); } });
const clock       = defineObservation({ id: 'clock',       async *read(s) { return s.session.ports.clock.now(); } });
const quiet       = defineObservation({ id: 'quiet',       async *read()  { return (yield* pending).every(n => n === 0); } });
const converged   = defineObservation({ id: 'converged',   async *read()  { const [sv, cs] = yield* observe(serverNotes, clientNotes); return cs.every(c => c.h === sv.h && c.n === sv.n); } });

// --- actions: writes through the real paths ------------------------------------------------------
const createNote = defineAction({ id: 'createNote', async *run() {
  const ids = yield* clientIds;
  if (ids.length === 0) return;
  const { client, body } = yield* draw(gen(fc.record({ client: fc.constantFrom(...ids), body: fc.string({ maxLength: 20 }) })));
  yield s => s.clients.find(c => c.id === client)!.mutate(createNoteMutation, { id: s.session.ports.createId(), body });
}});
const editNote = defineAction({ id: 'editNote', async *run() {
  const [ids, notes] = yield* observe(clientIds, liveNoteIds);
  if (ids.length === 0 || notes.length === 0) return;
  const { client, id, body } = yield* draw(gen(fc.record({ client: fc.constantFrom(...ids), id: fc.constantFrom(...notes), body: fc.string({ maxLength: 20 }) })));
  yield s => s.clients.find(c => c.id === client)!.mutate(editNoteMutation, { id, body });
}});
const deleteNote = defineAction({ id: 'deleteNote', async *run() {                  // soft delete
  const [ids, notes] = yield* observe(clientIds, liveNoteIds);
  if (ids.length === 0 || notes.length === 0) return;
  const { client, id } = yield* draw(gen(fc.record({ client: fc.constantFrom(...ids), id: fc.constantFrom(...notes) })));
  yield s => s.clients.find(c => c.id === client)!.mutate(deleteNoteMutation, { id });
}});
const serverEdit = defineAction({ id: 'serverEdit', async *run() {                  // server-initiated write: raw SQL in one tx + notifyChannels (the rule the sim must enforce)
  const notes = yield* liveNoteIds;
  if (notes.length === 0) return;
  const { id, body } = yield* draw(gen(fc.record({ id: fc.constantFrom(...notes), body: fc.string({ maxLength: 20 }) })));
  yield s => s.server.db.transaction(async tx => {
    await tx.run(sql`update notes set body = ${body}, updated_at = ${s.session.ports.clock.now()} where id = ${id}`);
    await notifyChannels(tx, ['notes']);
  });
}});
const partition = defineAction({ id: 'partition', requires: ['partition'], async *run() {   // same shape as the kv spec, over sync's clientIds
  const ids = yield* clientIds;
  if (ids.length === 0) return;
  const id = yield* draw(rng => ids[Math.floor(rng.next() * ids.length)]!);
  yield s => s.session.network.partition(['server'], [`client:${id}`]);
}});
const heal     = defineAction({ id: 'heal',     requires: ['partition'],   async *run() { yield s => s.session.network.healAll(); } });
const passTime = defineAction({ id: 'passTime', requires: ['virtualTime'], async *run() {
  const ms = yield* draw(rng => Math.floor(rng.next() * 30_000));
  yield s => s.session.scheduler.advance(ms);
}});
const faults = weighted([[2, partition], [2, heal], [1, passTime]]);

// --- properties: monitors over the SQL observations ----------------------------------------------
const converges = defineProperty({ id: 'converges', async *monitor() {              // always(quiet ⇒ converged)
  for (;;) { const [q, ok] = yield* observe(quiet, converged); if (q && !ok) throw new Error('quiet but diverged'); }
}});
const eventuallyConverges = defineProperty({ id: 'eventuallyConverges', async *monitor() {   // liveness with a bound: once writes stop, everyone matches within 10s of virtual time
  for (;;) {
    const [q, t0] = yield* observe(quiet, clock);
    if (!q) continue;
    for (;;) {
      const [q2, ok, t] = yield* observe(quiet, converged, clock);
      if (!q2 || ok) break;                                                         // writes resumed, or converged: back to watching
      if (t - t0 > 10_000) throw new Error(`still diverged ${t - t0}ms after going quiet`);
    }
  }
}});
const noHardDelete = defineProperty({ id: 'noHardDelete', async *monitor() {        // row counts never shrink anywhere: deletes are tombstones
  let [sv, cs] = yield* observe(serverNotes, clientNotes);
  for (;;) {
    const [sv2, cs2] = yield* observe(serverNotes, clientNotes);
    if (sv2.n < sv.n || cs2.some((c, i) => c.n < cs[i].n)) throw new Error('a notes row disappeared');
    [sv, cs] = [sv2, cs2];
  }
}});
const editsReachClients = defineProperty({ id: 'editsReachClients', async *monitor() {   // obligation
  let seen = false;
  try { for (;;) { const [sv, cs] = yield* observe(serverNotes, clientNotes); seen ||= sv.n > 0 && cs.some(c => c.h === sv.h); } }
  finally { if (!seen) throw new Error('no client ever matched a non-empty server'); }
}});
export const SYNC_PROPERTIES = [converges, eventuallyConverges, noHardDelete, editsReachClients];

// scripted sim test — same three verbs, same properties
await using run = await start(sync, { seed: 3, knobs: { clients: 2 }, properties: SYNC_PROPERTIES });
await run.apply(createNote, { client: 'client:0', body: 'a' });
await run.apply(partition, 'client:1');
await run.apply(serverEdit, { id: (await run.observe(liveNoteIds))[0], body: 'b' });
expect((await run.observe(clientNotes))[1].n).toBe(0);                 // the partitioned client has seen nothing
await run.apply(heal);
await run.apply(passTime, 10_000);
expect(await run.observe(converged)).toBe(true);                       // same observation the `converges` monitor reads

// exploration
await check(sync, { properties: SYNC_PROPERTIES, actions: [createNote, editNote, deleteNote, serverEdit, faults], episodes: 100, steps: 60 });
```

Only the observations the attached monitors ask for run at a checkpoint (`pending`, `serverNotes`, `clientNotes`, `clock` — four aggregate queries for two clients, each once however many monitors read it); `liveNoteIds` runs only while `walk` is probing an action whose body reads it.

## A third spec: an HTML counter app driven through the DOM (Bombadil's counter, grown into a small app)

Three screens, each with its own action set. The root element carries `data-screen` (the same attribute `ScreenBase` renders in the product), so one observation tells the walk where it is:

- `home` — `#count`, `#increment`, `#decrement`, `#step` (shows the current step), `#to-settings`, `#reset` (opens the confirm dialog)
- `settings` — `#step-1` / `#step-5` / `#step-10` radio buttons, `#back`
- `confirm-reset` — modal over home: `#confirm`, `#cancel`

No network, no virtual time; a real browser, so the host is wall + Playwright. Screen- and data-conditional actions are just `return`s at the top of the body; nested `weighted` sets the mix per screen and the mix between screens. Every leaf that returns vanishes, so a single action tree serves the whole app.

```ts
import { errors, fill, inventory, noConsoleError, screen, tap } from '@pkgs/ui-testing/explore';

const browserHost = wallHost({ network: 'none' }).with(async () => ({ ui: await playwrightDrivers({ headless: true }) }));   // caps: none of virtualTime / partition / trace

const counter = defineSystem({
  id: 'counter',
  boot: async session => {
    const web  = await serveStatic(session.fork('web'), { root: 'fixtures/counter' });     // @pkgs/static-file-server on a loopback port
    const page = await session.ports.ui.open(`${web.origin}/index.html`);                  // Driver for this page
    return { page, origin: web.origin };
  },
});
const { defineObservation, defineAction, defineProperty } = counter;
const actor = (s: { page: Driver }) => s.page;   // adapter for the explore cells; structural, so they attach to any surface with a `page`

// --- observations: DOM reads --------------------------------------------------------------------
const route = screen(actor);                                                               // Observation<_, string | null>: the `data-screen` of the visible root
const count = defineObservation({ id: 'count', async *read(s) { return Number(await s.page.text('#count')); } });   // #count is rendered on every screen
const step  = defineObservation({ id: 'step',  async *read(s) { return Number(await s.page.text('#step')); } });
const SCREENS = new Set(['home', 'settings', 'confirm-reset']);

// --- actions: home ------------------------------------------------------------------------------
const increment = defineAction({ id: 'increment', async *run() {
  if ((yield* route) !== 'home') return;
  yield s => s.page.click('#increment');
}});
const decrement = defineAction({ id: 'decrement', async *run() {                          // data-conditional: the button is disabled at 0, so the action is too
  const [r, c] = yield* observe(route, count);
  if (r !== 'home' || c === 0) return;
  yield s => s.page.click('#decrement');
}});
const openSettings = defineAction({ id: 'openSettings', async *run() {
  if ((yield* route) !== 'home') return;
  yield s => s.page.click('#to-settings');
}});
const openReset = defineAction({ id: 'openReset', async *run() {                          // only offered when there is something to reset
  const [r, c] = yield* observe(route, count);
  if (r !== 'home' || c === 0) return;
  yield s => s.page.click('#reset');
}});
const home = weighted([[6, increment], [4, decrement], [1, openSettings], [1, openReset]]);

// --- actions: settings --------------------------------------------------------------------------
const setStep = defineAction({ id: 'setStep', async *run() {
  if ((yield* route) !== 'settings') return;
  const n = yield* draw(rng => [1, 5, 10][Math.floor(rng.next() * 3)]!);                  // hand-written Gen; shrinks toward step 1
  yield s => s.page.click(`#step-${n}`);
}});
const leaveSettings = defineAction({ id: 'leaveSettings', async *run() {
  if ((yield* route) !== 'settings') return;
  yield s => s.page.click('#back');
}});
const settings = weighted([[2, setStep], [1, leaveSettings]]);

// --- actions: confirm dialog --------------------------------------------------------------------
const confirmReset = defineAction({ id: 'confirmReset', async *run() { if ((yield* route) !== 'confirm-reset') return; yield s => s.page.click('#confirm'); } });
const cancelReset  = defineAction({ id: 'cancelReset',  async *run() { if ((yield* route) !== 'confirm-reset') return; yield s => s.page.click('#cancel'); } });
const confirm = weighted([[1, confirmReset], [2, cancelReset]]);

// --- actions: everywhere ------------------------------------------------------------------------
const reload = defineAction({ id: 'reload', async *run() { yield s => s.page.reload(); } });   // no reads, no draws: always enabled
const monkey = weighted([[3, tap(actor)], [1, fill(actor)]]);                              // Bombadil's blind `clicks` / `inputs` over inventory(actor), low weight

const COUNTER_ACTIONS = weighted([[10, home], [10, settings], [10, confirm], [1, reload], [1, monkey]]);
//   only one of home / settings / confirm has enabled leaves at any checkpoint — the others vanish, so their 10s never compete

// --- properties: invariants ---------------------------------------------------------------------
const knownScreen = defineProperty({ id: 'knownScreen', async *monitor() {
  for (;;) { const r = yield* route; if (!SCREENS.has(r)) throw new Error(`unknown screen ${r}`); }
}});
const nonNegative = defineProperty({ id: 'nonNegative', async *monitor() {
  for (;;) if ((yield* count) < 0) throw new Error('count went negative');
}});
const stateMachine = defineProperty({ id: 'stateMachine', async *monitor() {              // count moves by ±step, resets to 0, or stays
  let [c, st] = yield* observe(count, step);
  for (;;) {
    const [n, st2] = yield* observe(count, step);
    if (![c, c + st, c - st, 0].includes(n)) throw new Error(`count jumped ${c} → ${n} with step ${st}`);
    [c, st] = [n, st2];
  }
}});
const resetNeedsConfirm = defineProperty({ id: 'resetNeedsConfirm', async *monitor() {    // count only becomes 0 from the confirm dialog or by legitimately decrementing to 0
  let [c, st, r] = yield* observe(count, step, route);
  for (;;) {
    const [n, st2, r2] = yield* observe(count, step, route);
    if (n === 0 && c !== 0 && r !== 'confirm-reset' && c - st !== 0) throw new Error(`reset to 0 from ${r} without confirming`);
    [c, st, r] = [n, st2, r2];
  }
}});
const cancelKeepsCount = defineProperty({ id: 'cancelKeepsCount', async *monitor() {      // from the dialog: still in the dialog, reset to 0, or unchanged
  let [r, c] = yield* observe(route, count);
  for (;;) {
    const [r2, c2] = yield* observe(route, count);
    if (r === 'confirm-reset' && r2 !== 'confirm-reset' && c2 !== 0 && c2 !== c) throw new Error(`count changed ${c} → ${c2} leaving the dialog`);
    [r, c] = [r2, c2];
  }
}});
const stepPersists = defineProperty({ id: 'stepPersists', async *monitor() {              // leaving settings keeps the chosen step
  let [r, st] = yield* observe(route, step);
  for (;;) {
    const [r2, st2] = yield* observe(route, step);
    if (r === 'settings' && st2 !== st) throw new Error(`step changed ${st} → ${st2} on leaving settings`);
    [r, st] = [r2, st2];
  }
}});
const noErrors = noConsoleError(actor);
const COUNTER_INVARIANTS = [knownScreen, nonNegative, stateMachine, resetNeedsConfirm, cancelKeepsCount, stepPersists, noErrors];

// --- properties: obligations (coverage) — attached to walks, not to short scripts ----------------
const getsBusy = defineProperty({ id: 'getsBusy', async *monitor() {                      // the walk must actually count
  let max = 0;
  try { for (;;) max = Math.max(max, yield* count); }
  finally { if (max <= 20) throw new Error(`count never exceeded 20 (max ${max})`); }
}});
const visitsAll = defineProperty({ id: 'visitsAll', async *monitor() {
  const seen = new Set<string>();
  try { for (;;) seen.add(yield* route); }
  finally { for (const r of ['settings', 'confirm-reset']) if (!seen.has(r)) throw new Error(`never visited ${r}`); }
}});
const resetsHappen = defineProperty({ id: 'resetsHappen', async *monitor() {
  let seen = false;
  let [r, c] = yield* observe(route, count);
  try { for (;;) { const [r2, c2] = yield* observe(route, count); seen ||= r === 'confirm-reset' && c > 0 && c2 === 0; [r, c] = [r2, c2]; } }
  finally { if (!seen) throw new Error('no confirmed reset ever happened'); }
}});
const COUNTER_COVERAGE = [getsBusy, visitsAll, resetsHappen];

// scripted — `apply` on an action whose body returns throws ActionNotEnabled, so the script cannot drift from the app's own rules
await using run = await start(counter, { host: browserHost, seed: 1, properties: COUNTER_INVARIANTS });
await run.apply(openSettings);
await run.apply(setStep, 5);
await run.apply(leaveSettings);
await run.apply(increment);
await run.apply(increment);
expect(await run.observe(count)).toBe(10);
expect(await run.observe(route)).toBe('home');
await run.apply(openReset);
await run.apply(cancelReset);
expect(await run.observe(count)).toBe(10);
await run.apply(openReset);
await run.apply(confirmReset);
expect(await run.observe(count)).toBe(0);
await expect(run.apply(decrement)).rejects.toBeInstanceOf(ActionNotEnabled);   // nothing to decrement

// exploration on a real browser: `check` is refused (no virtualTime / trace) — use `walk` + `replay`
await using x = await start(counter, { host: browserHost, seed: 42, properties: [...COUNTER_INVARIANTS, ...COUNTER_COVERAGE] });
const w = await walk(x, { actions: [COUNTER_ACTIONS], budgetMs: 60_000 });
expect(w.violations).toEqual([]);
expect(w.coverage.actions.confirmReset).toBeGreaterThan(0);
await replay(counter, w, { host: browserHost, properties: COUNTER_INVARIANTS, actions: [COUNTER_ACTIONS] });   // diffs count / step / route / errors fingerprints per step
// scope end closes the monitors: getsBusy / visitsAll / resetsHappen throw here if the walk never got there
```

Same algebra, different sort instances: the "network" is a static file server, the "surface" is one Playwright page, and this spec imports no PBT library — its randomness is the walk's leaf pick plus one hand-written `Gen`. Screen-conditional enablement is `if ((yield* route) !== 'home') return`; a product spec does the same with `screen(actorA)` to scope its lobby actions. The same spec runs on `virtualHost().with(jsdom)` if a jsdom `Driver` is added later, at which point `check` with shrinking becomes available with no spec change.

The product spec is the same shape: `simHost = virtualHost().with(s => ({ sql: pglite(s), ui: rntl(s), http: hono(s) }))`; observations `screen(actorA)`, `inventory(actorA)`, `errors(actorA)` from `@pkgs/ui-testing/explore` plus domain ones like `defineObservation({ id: 'spaceMembers', async *read(s) { return s.session.ports.sql.query('select count(*) …') } })`; `openSim` attaches `PRODUCT_PROPERTIES` so every existing chess / auth / spaces scenario checks `noErrorBoundary(actorA)` and domain invariants on every `actor.tap` that goes through `run.apply(tap(actorA), fingerprint)`; the drivers' `expect(...)` calls read through `run.observe(screen(actorA))` or reuse a property via `run.assert(p)`.

## The body driver, the checkpoint and the explore loop

```
drive(body, mode):                                                       // one driver for read / run / monitor bodies
  loop: r = await body.next(answer)
    r.done                      → return r.value
    r.value is Observation      → answer = memo[o.id] ??= drive(o.read(surface), 'read')        // tuple observe(a, b) = drive each component
    r.value is Draw             → mode must be 'run'; answer = g(rng)  where rng is recording (walk / check), replaying (replay / shrink) or scripted (run.apply(a, ...draws), positional)
    r.value is a function       → mode must be 'run'; await value(surface); await session.settle(); memo = {}; answer = undefined
    monitor mode                → a yielded Observation suspends the monitor; it is answered at the next checkpoint (below)

probe(action): g = action.run(); drive g until its first Draw / function (→ enabled, parked) or return (→ not enabled; g.return())

run.apply(action, ...draws):                                             // the checkpoint — the only place state changes
  if !(caps ⊇ action.requires) or !probe(action).enabled: throw ActionNotEnabled
  before = { ...memo }                                                   // whatever the probe read
  finish the parked body: draws answered positionally (scripted) or from the recording rng (→ Choice.draws); acts settle
  for each attached monitor: answer its pending read from the fresh memo and drive to its next read; a throw → PropertyViolation { property, at: t }
  trace.push({ t, before, action: { id, payload: drawn values }, after: memo }); coverage.states += fingerprint(after) unseen
  throw the first PropertyViolation (walk catches and collects)

start(system, opts):  session = host.open(seed); surface = boot(session, knobs); start every monitor and drive it to its first read; answer it (checkpoint 0)
run.observe(o):       drive(o.read) against the current memo — valid until the next apply
run.assert(p):        start p's monitor, answer its first read from the current memo, drive it to its next read, then p.return(); any throw → PropertyViolation
run dispose:          for each attached monitor: return() — a throw is an unmet obligation (PropertyViolation { at: 'end' }); then session.dispose()

walk(run, { actions }):
  loop until steps / budget / stopOnViolation:
    leaves  = flatten(actions).filter(a => caps ⊇ a.requires)
    enabled = leaves.filter(a => probe(a).enabled)                       // reads memoised: N probes cost the distinct observations they touch
    pick a by weight via walkRng; return() every other parked body
    try run.apply(a) catch PropertyViolation → violations.push
  return { transitions: trace, violations, coverage, choices }

replay / shrink: same loop with a replayingRng that serves the recorded (or shrunk) `draws` for that step, so the same Gen yields the same payload.
```

Headless and headful differ only in which observations, actions and properties are in the lists. `run.apply` in a scripted test and `run.apply` inside `walk` are the same function; the trace, choices and coverage exist for both, and `walk` merely returns them.

## Design rules

1. **Observations are the only way state reaches actions and monitors.** Small, named, JSON, memoised per checkpoint, run on demand. No whole-state snapshot; the surface is touched only inside a leaf `read` and inside a yielded act — tests never touch it.
2. **One protocol.** Everything a body does passes through `yield`: an Observation (read), a `Draw` (randomness), a function (act). That is what lets the framework memoise, record, settle and decide enablement without any declarative field, and it is why there is no formula algebra, no `from` / `when` / `generate` / `apply`, and no `.map`.
3. **Three conventions, each a contract test.** (a) An action that returns before its first draw or act is not enabled. (b) In a monitor, one `yield*` is one checkpoint — read several values at once with `observe(a, b, …)`. (c) A throw while a monitor is resumed is a safety violation; a throw while it is closed is an unmet obligation.
4. **Properties attach to the Run, not to a verb.** Every `apply` resumes them; scripted tests, sim drivers, walks and replays share the same step; obligations are checked when the Run closes.
5. **Singular everything.** One `defineX` per sort; lists are the only aggregate; `weighted` is the only Action combinator; `yield*` / `observe` the only Observation composition; control flow the only Property composition.
6. **The Run has three methods.** `apply` (Action), `observe` (Observation), `assert` (Property). Anything a test wants to *do* is an action; anything it wants to *know* is an observation; anything it wants to *hold* is a property. Time, network, crash and convergence controls are spec-defined actions over `s.session`, not Run methods.
7. **No runtime bags.** `bindSyncRuntime` / `bindRoomRuntime` deleted; `boot` returns handles (and `session`, when actions need it).
8. **Capabilities, not fidelity strings.** `requires` filters leaves in `walk` and gates scripted `apply`; `scheduler.advance` on a wall scheduler is a real wait; `partition` without the capability throws `CapabilityError`.
9. **Knobs are a `Gen`.** `check` samples `system.knobs(episodeRng)`; `start` derives from `seed` when omitted.
10. **Hierarchical determinism via `session.fork`.** Names are network addresses; systems nest by forking.
11. **`apply` is the only step; `walk` is the only loop.** `check` and `replay` compose them.
12. **The export list is a test.** `public-api.contract.test.ts` snapshots `@pkgs/dst`, `@pkgs/dst/pbt`, `@pkgs/dst/kernel`, `@pkgs/dst/fast-check`, `@pkgs/ui-testing/explore`.
13. **Randomness is one function type; libraries are adapters.** `Gen<T> = (rng: Rng) => T` is the only thing `knobs` and `draw` speak. `@pkgs/dst`, `/pbt`, `/kernel` import no PBT library (depcruise `dst-core-no-pbt-library` + `no-pbt-library.contract.test.ts` walking the module graph). Shrinking works on recorded draws, so an adapted library contributes generation only — swapping fast-check for anything else, or for hand-written `Gen`s, changes no framework code and loses no shrinking.
14. **No `std`.** A ready-made value earns a bare export only if every use case of its package would otherwise write it: `virtualHost` / `wallHost` in `@pkgs/dst` (virtual is the default, so it is usually unnamed); the nine UI cells in `@pkgs/ui-testing/explore`. Faults, time and domain stimuli are `defineAction`s in the spec — same sort, same four lines, no privileged namespace.

## Package layout after

```
pkgs/dst/src/
  index.ts        define* + observe / draw / weighted + virtualHost / wallHost + types + start + walk + repro (≈24 exports)
  kernel/         clock.ts, scheduler.ts (virtual + wall), rng.ts (Rng + recording / replaying / scripted Rng), timers.ts, network.ts, trace.ts, fingerprint.ts, json.ts → @pkgs/dst/kernel
  host/           host.ts (Host/Session/Capability/CapabilityError), define-host.ts, virtual-host.ts, wall-host.ts
  system/         define-system.ts, define-observation.ts, define-action.ts, define-property.ts, effect.ts (Effect / Act / Draw, observe, draw, iterable requests), gen.ts (Gen type), weighted.ts, repro.ts
  run/            start.ts, drive.ts (the body driver: answer reads from the memo, draws from the rng, acts against the surface + settle), probe.ts, checkpoint.ts (apply: finish body → resume monitors → record), walk.ts
  pbt/            check.ts, shrink.ts (steps delta-debug + draw minimisation), replay.ts
  fast-check/     index.ts (gen, arbitrary, randomGeneratorOver) → @pkgs/dst/fast-check — the only file importing fast-check
  test/acme-kv/   the spec above, as fixture + contract tests
pkgs/ui-testing/src/explore/   inventory.ts (Driver.inventory), observations.ts, actions.ts, properties.ts, index.ts (bare exports)
```

`pkgs/dst/package.json`: `exports` gain `./kernel` and `./fast-check`; `fast-check` moves from `dependencies` to `peerDependencies` (`optional: true`) + `devDependencies`; `@pkgs/pbt` is dropped. Consumers that use `gen(fc.…)` already depend on `fast-check` via the catalog.

## Migration (all in one change)

Codemod-able: `defineScenario` → `defineSystem`; `extend:` → `boot` return; `node({ start })` → function called in `boot` with `session.fork(name)`; `knob(d, arb)` → entry in `knobs: gen(fc.record({...}))`; each key of `actions<S>()({ k: { generate(ctx), apply(surface, p) } })` → `defineAction({ id: 'k', async *run() { … } })` where every read `generate` did on `ctx.surface` becomes `yield* o` on an observation (add one if missing), `return fc.constant(null)` becomes `return`, the returned `fc.Arbitrary` becomes `const p = yield* draw(gen(arb))`, and `apply(surface, p)` becomes `yield s => …`; each key of `properties<S>()({ k: property.always(check) })` → `defineProperty({ id: 'k', async *monitor() { for (;;) { const [...] = yield* observe(...); if (!check(...)) throw new Error(...) } } })` with `check`'s reads turned into observations; in tests every direct read `world.<surfaceKey>…` → `run.observe(o)`; every direct control `world.partition(a, b)` / `world.advance(ms)` / `world.heal*()` / `world.quiesce()` / `world.converge()` / `world.waitUntil(p, …)` → `run.apply(partition, …)` / `run.apply(passTime, ms)` / `run.apply(heal)` / `run.apply(passTime, …)` + `expect(await run.observe(converged)).toBe(true)` with the spec's own actions (acme-kv shape); `std.network()` / `std.time()` → those same actions; `openWorld(s, { seed })` → `start(s, { seed })` (no host on the virtual tier); `runExamples` / `assertDeterministic` → `replay`.

- **acme-kv**: the spec above.
- **sync-engine** ([define-sync-system.ts](pkgs/sync-engine/src/sim/scenario/define-sync-system.ts), `system.ts`, `node-kinds.ts`, `world-boot*.ts`): `defineSyncSystem(opts)` returns `defineSystem(...)` whose `boot` returns `{ session, server, clients }`; `sync-observations.ts` = `clientIds`, `pending`, `online`, `serverHash`, `clientHash`, `clock`, `quiet`, `converged`, `invariantViolations` (today's `checkInvariants` as a query returning `string[]`); `sync-actions.ts` one `defineAction` per stimulus (`mutate`, `addClient`, `crash`, `reconnect`, `partition`, `heal`, `passTime`, `tamperStorage`, `brokerCrash`, …: every method of today's `SystemWorldSurface` that changes state becomes an action body, every one that reads becomes an observation, `checkInvariants` / `assertConverged` become monitors); `sync-properties.ts` one `defineProperty` per invariant, exported as `SYNC_PROPERTIES`. Every sim test opens with `properties: SYNC_PROPERTIES` and is written with `apply` / `observe` / `assert` only — the ~126 scripted scenarios become invariant monitors. WeakMap runtime + aliases deleted.
- **room** ([define-room-system.ts](pkgs/room/src/sim/scenario/define-room-system.ts), `world.ts`): observations `serverHash`, `clientState(id)`, `connected`; actions `crash`, `restart`, `partition`, `heal`, `passTime`; `ROOM_PROPERTIES` attached in sim tests; `RoomSurface` keeps `session`, `clients`, `server`; drops kernel fields. Chess inherits.
- **matchmaking**: kit reads `session` in `boot`; drop `openMatchmakingWorld`.
- **auth / db-schema / db-indexes / sql-client**: single-boot systems, small observations; existing PBT properties become `defineProperty` monitors.
- **@sim/test**: replace [open-sim.ts](sim/test/src/setup/open-sim.ts) with `sim/test/src/host/{sim-host,max-host}.ts` built with `.with`; `defineProductSystem` → `defineSystem`; `openSim(testId, ctx)` attaches `PRODUCT_PROPERTIES` and returns the `Run`; driver helpers (`chess-flows.ts` etc.) go through `run.apply(tap(actor), fingerprint)` so each interaction is a checkpoint and read through `run.observe(screen(actor))`; add `product-walk.sim.test.tsx` (`walk` with `tap` / `fill` / `back` / `scroll` + a product `partition` action, `steps: 40`) on both tiers; `topology-partition.sim.test.tsx` relies on `partition.requires` (the action is simply not enabled on a host without the capability).
- **@pkgs/ui-testing**: add `inventory()` to the `Driver` contract (RNTL from the host tree; Playwright from the DOM; same fingerprint shape: `testId`, `role`, `accessibleName`, `text`, `structuralPath`), plus the `explore/` entrypoint with its nine bare exports written as generator bodies.
- **sim/console**: `createSim` takes a `Session`; Reports get a transitions view over `Walk` (observed state before / action / after) — the Bombadil `inspect` analog on the existing reporting UI.
- **Repro fixtures**: v3 `{ seed, knobs, choices: [{ action, draws }], meta: { system, host } }`; parse rejects v<3.
- **fast-check call sites**: every `fc.Arbitrary` returned from an action `generate` or passed as a knob (sync-engine, room, matchmaking, auth, db-schema, db-indexes, sql-client, acme-kv) becomes `yield* draw(gen(…))` / `knobs: gen(…)` from `@pkgs/dst/fast-check`; `runProperty` / `arbSeed` callers move to `check` (seed via its `seed` option). `@pkgs/pbt` stays as-is for plain unit PBT that never touches a Run.

## Docs and guards

- Rewrite [pkgs/dst/README.md](pkgs/dst/README.md): algebra table (sort · constructor · operator · laws), the three-request protocol and its three conventions, the checkpoint / explore loop, the full spec above; add `pkgs/dst/CONTEXT.md`.
- Update [DETERMINISM.md](DETERMINISM.md), AGENTS.md DST paragraph (`node` / `knob` / `command` / `defineScenario` / `runScenario` / `runPins` / `createWorldPorts` / `openWorld` → `defineSystem` / `session.fork` / `defineObservation` / `defineAction` / `defineProperty` / `observe` / `draw` / `start` / `walk` / `check` / `replay` / `virtualHost`), [sim/test/src/setup/TESTING.md](sim/test/src/setup/TESTING.md).
- Depcruise: only `pkgs/dst/**`, `sim/**`, `**/sim/**` may import `@pkgs/dst/kernel`; `pkgs/dst/src/**` except `pkgs/dst/src/fast-check/**` and `*.test.ts` may not import `fast-check` or `@pkgs/pbt` (`dst-core-no-pbt-library`).
- Contract tests: `types` (tsd-style: a spec written with `const { defineObservation, defineAction, defineProperty } = kv` needs no type arguments; `yield* o` is typed `T`; a yielded `s => …` is typed `Act<S>`; a `Property<RoomSurface>` passed to `start(kvSystem, …)` is a compile error), `observation` (memo per checkpoint, laziness — unrequested observations never run, composition via `yield*` and `observe` reads each component once, a leaf read never runs twice at one checkpoint), `action` (probe rule: `return` before the first draw / act → not enabled and the body is closed; a body that reaches a draw is enabled; scripted `apply` of a disabled action throws `ActionNotEnabled`; scripted draws answer positionally; each act is followed by `settle` and invalidates the memo; a yielded draw / act inside a `read` or `monitor` body throws), `monitor` (checkpoint 0 at `start`; one `yield*` per checkpoint — two consecutive single reads see two checkpoints; a throw during resume → `PropertyViolation` with `at`; a throw from `finally` at dispose → `PropertyViolation` with `at: 'end'`; `assert` runs one checkpoint and closes), `gen` (determinism: same draws ⇒ same value for a hand-written `Gen` and for `gen(fc.record(…))`; recording / replaying `Rng` round-trip; `gen(fc.constant(x))` law; `arbitrary(gen)` round-trip), `shrink` (a failing walk shrinks to fewer steps and smaller payloads for a fast-check-generated and a hand-written payload alike), `weighted` (laws; a branch whose leaves are all disabled vanishes and its weight does not dilute siblings), `checkpoint` (throw vs collect, transitions recorded from scripted `apply`, `before` / `after` slices), `walk` (enablement, weights, coverage, stopOnViolation, choices recorded, unpicked parked bodies are closed), `vacuity` (`check` fails only when an obligation is unmet in every episode), `fork`, `knobs-from-seed`, `wall-host`, `capability`, `no-pbt-library` (module graph of the three core entrypoints), `public-api`; `apply-commands.contract.test.ts` folds into `checkpoint.contract.test.ts`.

## Verification

- `bun run --filter @pkgs/dst tc && bun test pkgs/dst`; `bun test pkgs/ui-testing`.
- Per consumer: `PBT_SAMPLE_RUNS=1 bun test <pkg>/…pbt.test.ts` + `*.sim.test.ts` (now with properties attached).
- `bun run --filter @sim/test test` (sim) and `test:max` including `product-walk.sim.test.tsx`.
- `rg` for every removed name returns nothing outside git history.
- `bun run lint` (grit + depcruise) and `bun check`.

## Out of scope (follow-ups)

Novelty-guided selection (weight by unseen `fingerprint(after)`), resource-leak sliding-window monitor over an observation, process-fate action, long-running CI walks on `maxHost` — all new `Observation` / `Action` / `Property` values or a `walk` option; no API change.

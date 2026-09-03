# `@pkgs/dst`

Deterministic simulation testing for TypeScript. Same seed + system knobs +
action choices ⇒ the same run. Used by sync-engine, room, matchmaking,
sql-client, auth, db-schema, db-indexes, product sim (`@sim/test`), and
package-local scenario kits.

This file is the single source of truth for the package: summary, usage,
implementation map, and the context an LLM needs to design a next version.
Root determinism policy lives in [`DETERMINISM.md`](../../DETERMINISM.md).

---

## What it is

A small algebra of singular primitives. Packages declare a **System**
(topology from typed knobs), **Observations** (named reads), **Actions**
(stimuli), and **Properties** (monitors). The framework owns the run:
`start` / `walk` / `check` / `replay`.

It is **not** a product runtime. `Host` / `Session` are harness-only.
Product `ClientEnv` / `ServerEnv` receive unpacked ports (`clock`, `timers`,
`createId`, `random`, `http`) — never the Session bag.

Deleted (do not reintroduce): `World` / `openWorld` / `pin` / `spec` /
positional `draws:` / `defineScenario` / `node` / `knob` / `std` / Formula
algebra / `WorldControls`.

---

## Algebra

| Sort | Constructor | Composition | Role |
| --- | --- | --- | --- |
| Host | `defineHost` / `virtualHost` / `wallHost` | `.with(extra)` | Fidelity (virtual vs wall) |
| Session | `host.open(seed)` | `.fork(name)` | Kernel + ports for one node |
| System | `defineSystem({ name, generate(session, knobs) })` | typed knobs + optional `draw` | Recipe → surface `S` |
| Observation | `defineObservation({ name, observe })` | `yield*` / `observe({ a, b })` | Named read of live state |
| Action | `defineAction({ name, generate(...args) })` | typed params / `{ weight, act }` | Stimulus |
| Property | `defineProperty({ name, watch })` | control flow | Monitor over checkpoints |
| Run | `start(system, { knobs })` | `apply` / `observe` / `assert` | Live handle |
| Gen | `(rng) => T` | function composition | Randomness (`@pkgs/dst/fast-check` adapts fc) |

Bind the surface once with `defineSurface<S>()` (also spread onto `System<S>`).

---

## Mental model (irreducible)

1. **Host** opens a **Session** (virtual or wall clock, model network, caps).
2. **System.generate(session, knobs)** boots topology from typed knobs,
   optionally draws extra entropy, returns surface `S`.
3. **Observations** read `S` (or compose other observations). Memoised per
   checkpoint; parameterized observations key by `name + fingerprint(args)`.
4. **Actions** have typed `generate(...args)`. Probe rule: return before the
   first act = disabled. Weight on the first act = pick probability.
   Bare `(s) => …` = weight 1.
5. **Properties** are monitors: body re-invoked each checkpoint when it
   completes; throw = violation; `finally` on close = obligation.
6. **Run** = `start` → `{ apply, observe, assert }`. `walk` / `check` /
   `replay` compose Runs.

`run.apply(action, ...args)` is the only checkpoint: probe → draw → act +
`session.settle()` → resume monitors → record. Waiting for a condition is
polling with `untilObserved(run, obs, passTime)` (one `passTime` checkpoint
per step). Negative: `neverObserved`.

Actions are stimuli only. Heal or revive, then observe `quiet` / `converged`.
Do not encode wait / assert / settle / converge as actions.

---

## Public surface

Four entrypoints (`pkgs/dst/package.json` `exports`):

| Import | Contents |
| --- | --- |
| `@pkgs/dst` | `defineSystem` / `defineObservation` / `defineAction` / `defineProperty` / `defineSurface` / `draw` / `observe` / `start` / `walk` / `untilObserved` / `neverObserved` / `virtualHost` / `wallHost` / `defineHost` / `REPRO_VERSION` / `parseRepro` / `stringifyRepro` + types (`Run`, `Session`, `Host`, `Action`, …) |
| `@pkgs/dst/pbt` | `check`, `replay`, `CheckFailedError` |
| `@pkgs/dst/kernel` | Clock / scheduler / rng / network factories. **Host authors + sim only.** Depcruise: `pkgs/dst/**`, `sim/**`, `**/sim/**`. |
| `@pkgs/dst/fast-check` | `gen(arbitrary)`, `arbitrary(gen)`, `randomGeneratorOver` |

Contract: `src/public-api.contract.test.ts`. Forbidden on the public
`@pkgs/dst` object: `defineScenario`, `actions`, `properties`, `knob`,
`node`, `std`, `runProperty`, `arbSeed`, `checkSystem`, `replaySystem`,
`getRunInternal`, `RunInternal`, `Body`. `Run` has no `_internal` field;
tests speak only `apply` / `observe` / `assert`. `walk` / `check` / `replay`
reach internals via a package-private WeakMap (`getRunInternal`).

`CampaignReport` is a historical type alias of `Report` in `@pkgs/dst/pbt`.
That is a leftover — do not add more aliases.

---

## Authoring

### System

```ts
const kv = defineSystem({
  name: 'kv',
  *generate(session, knobs: { clients: number }) {
    const server = startServer(session.fork('server'));
    return {
      session,
      server,
      clients: range(knobs.clients).map((i) =>
        startClient(session.fork(`client:${i}`), server)
      ),
    };
  },
});
const { defineObservation, defineAction, defineProperty } = kv;
```

- `generate` may be sync, async, a generator, or an async generator.
- Yield `draw(gen)` for extra entropy (recorded on the Repro as `system`).
- Put `session` on `S` when actions need network / scheduler.
- `session.fork(name)` is memoised by name (second fork of `'server'` returns
  the same Session).
- Default host is `virtualHost()`. Override with `start(..., { host })`.

### Observation

```ts
export const liveNote = defineObservation({
  name: 'liveNote',
  observe: async (s, nodeId: string, id: string) => { /* … */ },
});

await run.observe(liveNote('bob', 'n1'));
```

- Result type is constrained to `JsonValue` (JSON-serialisable, finite
  numbers, sorted-key objects). Needed for memo keys, transition snapshots,
  and coverage fingerprints.
- Zero-arg: `yield* quiet` or `run.observe(quiet)`.
- Parameterized: `yield* liveNote('bob', 'n1')` or `run.observe(liveNote('bob', 'n1'))`.
- Compose with a **named record**, not positional tuples:

  ```ts
  const o = yield* observe({ quiet, cut: partitioned });
  ```

- Memoised per checkpoint. `observe` on `Run` does **not** checkpoint; it
  reads the current memo / live state. After an act, settle clears the memo.

### Action

```ts
export const online = defineAction({
  name: 'online',
  generate: (clientId: string, value: boolean) => (s) =>
    requireClient(s, clientId).online(value),
});

await run.apply(online, 'alice', true);
```

Scripted tests pass typed args: `run.apply(put, 'client:0', 'a', '1')`.
Random-walk pools accept **only zero-arg** actions (draw, then
`yield* typedAction(...args)`).

```ts
export const randomPut = defineAction({
  name: 'randomPut',
  *generate() {
    const ids = yield* clientIds;
    if (ids.length === 0) return; // disabled
    const { client, key, value } = yield* draw(gen(arbPut(ids)));
    yield* put(client, key, value);
  },
});
```

Gate faults with a `caps` observation:

```ts
if (!(yield* caps).includes('partition')) return;
```

### Property

```ts
export const converges = defineProperty({
  name: 'converges',
  *watch() {
    const o = yield* observe({ quiet, converged, cut: partitioned });
    if (o.quiet && o.cut.length === 0 && !o.converged) {
      throw new Error('quiet but diverged');
    }
  },
});
```

Attach via `start(..., { properties })` or `check(..., { properties })`.
`run.assert(p)` runs a property once (not as a standing monitor).
Bodies that complete restart at the next checkpoint. `finally` on dispose
is the obligation check (`check` treats end-only failures as vacuity if
they miss every episode).

### Body protocol

`generate(...args)` may return a bare act, a `{ weight, act }`, a promise, a
generator, or any iterable.

1. **Read** — `yield* observation` / `yield* observation(...args)` /
   `yield* observe({ quiet, cut: partitioned })`
2. **Draw** — `yield* draw(gen)` (entropy only — not scripted params)
3. **Act** — return `(s) => …` or `{ weight, act: s => … }`, or `yield`
   them inside a generator

`yield* action` / `yield* action(...args)` delegates. An action that returns
before its first act is not enabled. Bare function = weight 1; `weight: 0` =
disabled.

Do not import `fast-check` from core dst modules. Scenario kits may import
`fc` to build arbitraries, then wrap with `gen()` from `@pkgs/dst/fast-check`.

---

## Driving a run

```ts
await using run = await start(kv, {
  seed: 7,
  knobs: { clients: 2 },
  properties: KV_PROPERTIES,
});
await run.apply(put, 'client:0', 'a', '1');
expect(await run.observe(quiet)).toBe(true);

await check(kv, {
  properties: KV_PROPERTIES,
  actions: KV_ACTIONS,
  knobs: gen(arbKvKnobs()),
  episodes: 20,
  steps: 40,
});
```

### Waiting

```ts
await run.apply(heal); // stimulus only
await untilObserved(run, quiet, passTime, { maxMs: 2_000 });
await untilObserved(run, converged, passTime, { maxMs: 5_000 });
expect(await run.observe(converged)).toBe(true);

await neverObserved(run, liveNote('bob', 'late'), passTime, {
  forMs: 200,
  pred: (n) => n != null,
});
```

`untilObserved` / `neverObserved` require a typed `passTime: Action<S, [ms: number]>`.
Defaults: `stepMs: 50`, `maxMs: 5_000`. Predicate defaults to truthiness.

### Walk / check / replay

- `walk(run, { actions, steps?, budgetMs?, stopOnViolation? })` — probes every
  zero-arg action, picks by weight, finishes the chosen body. Returns
  transitions, choices, coverage, violations.
- `check(system, { properties, actions, knobs?, episodes?, steps?, … })` —
  episodes × (start + walk + close) + shrink. Throws `CheckFailedError`.
  Seed: `opts.seed` else `PBT_SEED` env else pinned `424242`.
- `replay(system, repro | walk | string, { actions, properties?, host? })` —
  re-applies named choices (args, or recorded draws for zero-arg actions).

Repro v4:

```ts
{
  version: 4,
  seed,
  system: number[],   // rng floats from generate draws
  knobs: unknown,     // JSON-projected typed knobs
  choices: { action, draws, args }[],
  meta: { system, host? },
}
```

---

## Host, Session, kernel

**Ports** on every Session: `clock`, `timers`, `rng`, `createId`, `random`,
`network` (per-fork `Endpoint`: send/listen).

**Session** also holds: `scheduler`, `network` (the full model `Network`:
partition/heal/inFlight), optional `trace`, `caps`, `fork`, `dispose`,
`settle`.

**Capabilities:** `'virtualTime' | 'partition' | 'trace'`.
`virtualHost()` has all three. `wallHost({ network })` does not have
`virtualTime`; partition only if `network: 'model'`.

**Fidelity:**

- `virtualHost({ startTime?, network? })` — virtual clock + model network.
  Default `startTime` is `0`. Product systems usually pass
  `1_700_000_000_000`.
- `wallHost({ network: 'model' | 'none', settleMs?, networkFaults? })`.
- `.with(session => extraPorts)` — extra keys appear on `session.ports` and
  forks (see `acme-counter` `openPage`).
- `defineHost({ caps, open })` for custom hosts.

After every act the driver awaits `session.settle()`. Virtual settle is
`scheduler.advance(0)` / `runFor(0)` — due-at-now only, no time travel.
Long-lived timers (sync heartbeats) mean a naïve settle never returns;
sync overrides `settle` for that reason.

Kernel (`@pkgs/dst/kernel`) is the clock / scheduler / rng / network
implementation. Two scheduler types are exported under overlapping names:

- `Scheduler` from `scheduler-api.ts` — session-facing (`advance`, `settle`,
  `underlying`).
- `VirtualScheduler` — alias of the heap scheduler from `scheduler.ts`,
  also the type of `scheduler.underlying`.

Most sim kits import `VirtualScheduler` and call `scheduler.underlying`.

---

## Examples

Slim toys under [`src/examples/`](src/examples/) (not public exports):

| Toy | Teaches |
| --- | --- |
| [`acme-kv`](src/examples/acme-kv/scenario.ts) | typed knobs, forks, faults, `check` / `walk` |
| [`acme-sync`](src/examples/acme-sync/scenario.ts) | SQL-shaped aggregates + pending, converge after partition |
| [`acme-counter`](src/examples/acme-counter/scenario.ts) | DOM reads/acts (happy-dom + Bun.WebView), screen-conditional enablement, walk + replay |

These are the intended authoring shape: small `S`, observations for reads,
typed actions + zero-arg random wrappers, properties that throw on
`quiet ∧ healed ∧ !converged`.

---

## Who uses it

| Consumer | System | How tests drive it |
| --- | --- | --- |
| `@pkgs/sync-engine` | `defineSyncSystem(app)` → `sync.system` | ~100 `*.sim.test.ts` call `start(acmeSystem, { host: syncVirtualHost(), knobs })` then `run.apply(pin, …args)`. PBT via `checkSync`. Separate `runSeed` workload. |
| `@pkgs/room` | `defineRoomSystem(app)` | `startRoom` wrapper; pins via `run.apply`; tagged `RoomSystemAction` replayed by `applyRoomAction` → `run.apply`. |
| `@pkgs/matchmaking` | `defineMatchmakingSystem` | `startMatchmaking`; `untilObserved` / `neverObserved` for radius growth. |
| `@pkgs/sql-client` | `sqlClientWeb` | closest to the toys; `check` over `SQL_CLIENT_WEB_ACTIONS`. |
| `@pkgs/auth` | `auth.idp` | `check(auth, …)` PBT. |
| `@pkgs/db-schema` | `db-schema.reconcile` | `check` + scripted `start`. |
| `@pkgs/db-indexes` | `db-indexes.reconcile` | `check` + known-seed pins. |
| `@sim/test` | `product` (`sim.product`) | `openSim` + `walk`; UI via `@pkgs/ui-testing` observations/actions. |
| `@pkgs/ui-testing` | (no system) | generic `inventory` / `tap` / `fill` factories over a `Driver`. |
| `@sim/console` | playground | `virtualHost` + kernel scheduler types for checkpoint UI. |

**Two authoring styles in the wild:**

1. **Toy / leaf kits** bind definers from the system:
   `const { defineAction, … } = kv` (`sql-client`, `auth`, `db-schema`,
   `db-indexes`, `sim/test` product, dst examples).
2. **Product kits** bind a second surface: `defineSurface<SyncSurface>()`
   in a different file from `defineSystem` (sync-engine, room, matchmaking).
   Needed because actions live in many files; the type `S` is declared
   separately from the system value.

**Two driving styles:**

1. **Algebra** — `run.apply(typedAction, ...args)` / `run.observe(obs(args))`
   / `untilObserved`. This is what new tests should do.
2. **Kit / tagged-union leftovers** — `dispatchSyncAction(surface, action)`,
   `applyRoomAction(run, { kind })`, `surface.waitUntil(pred)`,
   `surface.drainUntilConverged()`, `runSeed` packing a whole workload into
   one `seedWorkload` act that writes a closure. These predate the algebra
   cut and still dominate sync-engine and room.

---

## Do / don't

- **Do** bind the surface once: `defineSurface<S>()` or destructure from the
  `System`.
- **Do** put `session` on `S` when actions need network/scheduler.
- **Do** gate faults with a `caps` observation.
- **Do** use `yield* observe({ quiet, cut: partitioned })` (named record).
- **Do** wait with `untilObserved(run, obs, passTime, { maxMs })`.
- **Do** negative waits with `neverObserved(run, obs, passTime, { forMs })`.
- **Do** keep random walk pools as zero-arg actions that draw then
  `yield* typedAction(…args)`.
- **Don't** encode wait / assert / settle / converge as **actions**.
- **Don't** import `@pkgs/dst/kernel` from product libs (only dst, `sim/**`,
  `**/sim/**`).
- **Don't** import `fast-check` from core dst modules.
- **Don't** add `World` / `openWorld` / `pin` / `spec` / positional `draws:`.
- **Don't** reach `Run` internals — no `_internal`; tests speak only
  `apply` / `observe` / `assert`.
- **Don't** add package-local World openers / kit DSLs — `start` / `walk` /
  `check` / `replay` are the run API. (`startRoom` / `startMatchmaking` /
  `checkSync` / `runSeed` are the existing exceptions; do not grow them.)

---

## Implementation map

```
src/index.ts          public algebra
src/host/             virtualHost / wallHost / defineHost / Session
src/system/           define* + effect protocol (tags, draw, observe)
src/run/              drive / probe / start / walk / until / checkpoint
src/pbt/              check / replay / shrink
src/kernel/           clocks, schedulers, rng, fingerprint, json, timers
src/models/           in-process network (delay/loss/dup/partition)
src/fast-check/       gen / arbitrary adapters
src/examples/         teaching toys (not public API)
```

Effect tags are `Symbol.for('dst.*')`. Observation / Action values are
callable (bind args) **and** iterable (so `yield*` works without calling).

Probe (`src/run/probe.ts`): run the body with a forked rng until the first
`Act` with `weight > 0`. Observations and draws during probe are live (they
must be read-only). Unpicked probes are `return()`'d.

Checkpoint (`src/run/checkpoint.ts`): perform the act, `settle()`, clear
observation memo, resume every monitor, snapshot memo into a `Transition`.

---

## Design defects (for a next version)

These are the load-bearing problems. A rewrite should fix them rather than
paper over them with more wrappers.

### 1. The body protocol is too many shapes

An action `generate` may return `Act | void | Promise<…> | Generator |
AsyncGenerator | Iterable | AsyncIterable`. Probe, drive, and continue-body
each reimplement the same type tests (`isAct` / `isObservation` / `isDraw`
/ `isAction` / `isBoundAction`). `isAct` treats any non-tagged function as
an act, so a misplaced helper can be executed as a stimulus.

**v2:** one body type. Generator of `{ read } | { draw } | { act, weight? }`
(or an explicit `Effect` union that is not also a function). No bare
functions, no dual `yield` vs `yield*`, no iterable-that-is-also-callable.

### 2. Enablement and weight are implicit

`return` before the first act = disabled. `weight: 0` = disabled. Bare fn =
weight 1. Composite actions (`outage` = partition + passTime + heal) inherit
the first nested act's weight. Easy to get wrong; hard to see in a catalog.

**v2:** explicit `enabled` / `weight` from the probe, computed from
observations, not from control flow. Or: actions are always enabled and
walk filters a separate `when` observation — but the current rule exists
because screen-conditional UI (acme-counter) needs it.

### 3. `Run` cannot see `S`

`Run` is `{ apply, observe, assert, [asyncDispose] }`. There is no
`run.surface` / `run.session`. That is intentional (tests should not poke
the kit). The consequence: every product surface became a god object so
scripted code could still call `s.drainUntilConverged()`, `s.waitUntil()`,
`s.checkInvariants()`, `s.kit.drain()`. Those methods then get wrapped as
actions (`drainUntilConverged` in `expect-converged.ts`) or called from
inside acts (`room-actions.ts` `await s.kit.drain()`).

**v2:** either (a) keep Run sealed and make the observation/action set
complete enough that kit methods die, or (b) give Run a typed, read-only
handle for diagnostics and force all mutation through `apply`. Do not keep
both.

### 4. `untilObserved` is coupled to a `passTime` action

Every system reinvent `passTime(ms)` with the same signature. Product sim
special-cases RNTL (`ui.runFor(ms)`). Sync overrides Session.settle because
heartbeats never quiesce, then still needs `passTime` to make progress.

**v2:** waiting should be a Run operation that advances the host's
scheduler (`run.elapse(ms)` / `run.until(obs)`), not an action in the
catalog. Passing time is a stimulus in a random walk; it is not the same
thing as a poll clock.

### 5. Two action universes per product system

Sync and room each have:

- **Pins** — typed `run.apply(mutate, clientId, def, args)`.
- **Pool** — zero-arg `random*` that draw then delegate.
- **Tagged unions** — `SyncAction` / `RoomSystemAction` dispatched by
  `dispatchSyncAction` / `applyRoomAction` for seed replay.

Three names for one stimulus. Shrink/replay of algebra `Choice`s cannot
replay a `runSeed` path; `runSeed` fabricates a fake Repro whose
`choices[].args` are empty.

**v2:** one action is one name. Scripted args are the generate parameters.
Walk draws them. Replay stores them. Delete tagged-union dispatchers.

### 6. Package-local World openers came back under new names

`startRoom`, `startMatchmaking`, `checkSync`, `syncVirtualHost`,
`runSeed`, `expectConverged`. AGENTS.md bans World openers; these are
the same pattern (hide `start` + host + default knobs + properties).

Some of this is justified (`syncVirtualHost` must wrap `settle` + dispose
hooks). Most is not (`startRoom` reading `process.env.SIM_SEED`).

**v2:** Host composition stays. Default knobs stay on the system. Do not
add `startX` functions that mint Runs.

### 7. Surfaces leak the kernel and the kit

`SyncSurface` (`surface-types.ts`) is a 20-method façade: `waitUntil`,
`waitNever`, `drainUntilConverged`, `revive`, `advance`, `checkInvariants`,
storage-pressure arms, broker crash, … Room surface holds the whole kit.
Matchmaking `buildMatchmakingKit` is the surface.

The toys keep `S = { session, server, clients }`. That is the target.
Product surfaces grew because Run is sealed and observations were added
later than the kit.

**v2:** `S` is data (nodes + session). Methods on `S` that change state
are actions; methods that read are observations. No `wait*` on `S`.

### 8. Observations must be `JsonValue`

Forces casts (`as unknown as JsonValue` in ui-testing), blocks Maps/bytes,
and makes `rows(_label, nodeId, sqlStatement)` fingerprint SQL objects
for the memo key. `fingerprint` catch-all falls back to `JSON.stringify`
via `payloadOf`. Unstable args ⇒ stale memo or collisions.

`ui-testing` factories all use `name: 'inventory'` (and `'tap'`, `'fill'`).
Memo keys ignore the `actor` closure. Two actors on one Run share one memo
slot.

**v2:** memo keys must include identity the author supplies (actor id,
node id), not only `name + args`. Either drop the JsonValue bound (snapshot
via an explicit serializer) or keep it and enforce it at `defineObservation`
so casts fail in CI.

### 9. Host extension is awkward

`.with(extra)` merges ports onto the session and forks. Sync cannot use it:
it needs to replace `settle` and register dispose hooks, so it **reimplements
Host** (`syncVirtualHost`) and a WeakMap (`sessionTeardown`) that throws if
you pass a plain `virtualHost()`. Counter and matchmaking **mutate**
`session.dispose` in `generate`.

**v2:** Session lifecycle hooks (`onDispose`, `settle` override) belong on
Host/Session, not in generate bodies or WeakMaps keyed by host brand.

### 10. `settle` is the wrong default for long-lived systems

Framework settle = drain due-at-now. Sync heartbeats reschedule forever, so
sync replaces settle with `runFor(0)` (same thing) and documents that
algebra settle "must not wait for global quiescence". Room acts call
`kit.drain()` in addition to settle. `expectConverged` is a third settle
(revive + drainUntilConverged + softQuiet loop that **reimplements**
`untilObserved`).

**v2:** settle = "effects of this act have been delivered", defined by the
host. Quiescence / convergence are observations. Never both.

### 11. Kernel API is wide and aliased

`@pkgs/dst/kernel` exports two `Scheduler` types, `createScheduler` vs
`createVirtualScheduler`, `asSeededRng` (callers write `as never`),
`createRngInternal` (private `_seeded` field used by `virtualHost`),
recording/replaying RNGs. Sim kits depend on `scheduler.underlying` (heap
API) rather than Session.scheduler.

Depcruise allows any `**/sim/**` file to import kernel. That is most of
sync-engine and room sim.

**v2:** Session is the only handle. Kernel is host-private. If a sim needs
the heap, that is a Host capability, not an import of `@pkgs/dst/kernel`.

### 12. Replay does not replay system draws

`Repro.system` records floats from `generate`'s `draw`s. Shrink minifies
them. `replay()` then calls `start({ seed, knobs })`, which records **new**
draws from the seed — it never installs `createReplayingRng(repro.system)`.
Shrinking `system` draws therefore cannot affect replay unless knobs already
determine topology.

Choice draws **are** replayed (by swapping `internal.rng` for zero-arg
actions). Scripted `apply(action, ...args)` ignores stored draws.

**v2:** start must accept replayed system rng. Scripted args vs drawn args
should be one mechanism (record the bound args; do not special-case
zero-arg).

### 13. `check` / `startRoom` read `process.env`

`check` reads `PBT_SEED`; `startRoom` and many sim tests read `SIM_SEED`.
That is wall entropy / wall config inside the algebra. The pinned default
`424242` is the right idea; env as a side channel is not.

### 14. Properties that loop are confusing

`eventuallyConverges` (`sync-properties.ts`) `while (true)`'s on
`yield* observe(...)`. That is legal (each yield parks until the next
checkpoint) but looks like a busy loop and duplicates `untilObserved`.
Authors copy it.

**v2:** monitors are one-shot predicates per checkpoint, plus an optional
obligation on close. Liveness (`eventually`) is `untilObserved` in the
test, or a property that records `t0` and throws past a bound — not a
while loop.

### 15. Probe cost and purity

`walk` probes **every** pool action every step, each with a forked rng,
running observations against live `S`. Observations must be pure; several
are not obviously so (`checkInvariants` throws-and-catches, `get` in
sql-client **writes** `state.mismatches`). A probe of `randomGet` would
mutate.

**v2:** distinguish reads from acts in the type system. Probe may only
read. Walk should not need to fully drive a generator to learn weight.

### 16. leftover catalogs on `System`

`defineSyncSystem` `Object.assign`s `.actions` and `.properties` onto the
system value. The public-api contract **forbids** those keys on `@pkgs/dst`.
The deleted catalog API (`actions<S>()`, `properties<S>()`) is back as ad
hoc fields so `checkSync` can pass `def.actions`.

**v2:** `check({ actions, properties })` takes lists. Systems do not grow
fields.

### 17. `CampaignReport` alias, `getRunInternal` export from `./run`

Soft-deprecated alias. `getRunInternal` is correctly hidden from
`@pkgs/dst` but re-exported from `src/run/index.ts` (package-internal).
Fine if the package boundary is the export map; confusing for in-repo
imports of deep paths.

### 18. AGENTS.md vs this algebra

AGENTS.md currently says "converge as actions/properties". The algebra
rule is the opposite: converge is an **observation** + property; heal/revive
are the actions. The AGENTS line is a leftover of the World cut.

---

## Misusage in this repo (concrete)

Fix these in consumers even if v1 stays; a v2 that keeps the same shapes
will otherwise be used the same way.

| Location | What's wrong |
| --- | --- |
| `sync-engine/.../expect-converged.ts` | `drainUntilConverged` **action** wraps kit drain; `softQuiet` reimplements `untilObserved`. Test helper should be `apply(revive)` + `untilObserved(quiet)` + `untilObserved(converged)`. |
| `sync-engine/.../run-seed.ts` | Entire workload is one action (`seedWorkload`) that mutates a closure (`job.result`). Bypasses walk, choices, and real Repro. |
| `sync-engine/.../define-sync-system.ts` | God `SyncSurface`; `waitUntil` / `drainUntilConverged` / `checkInvariants` as methods; Host reimplemented; WeakMap dispose; `asSeededRng`. Attaches `.actions` / `.properties` onto System. |
| `sync-engine/.../sync-actions.ts` | Library kinds become one `defineAction` per tagged union entry; all `weight: 1`; chaos errors swallowed in `applySyncAction`. |
| `sync-engine/.../sync-observations.ts` | `rows(_label, nodeId, statement)` — SQL object in memo args; `pendingEventCount` alias of `pending`. |
| `sync-engine/.../sync-pin-actions.ts` + `pin-chaos-actions.ts` | Second, complete action catalog next to `createSyncActions`. |
| `room/.../room-actions.ts` | Almost every act calls `s.kit.drain()` (settle-in-the-action). |
| `room/.../apply-room-action.ts` | Tagged-union dispatcher over `run.apply`. |
| `room/.../start-room.ts` | World opener; reads `SIM_SEED`. |
| `room/.../replay.ts` | Own replay (list of tagged actions), not `@pkgs/dst/pbt` `replay`. |
| `sql-client/.../system.ts` `get` | **Read encoded as an action** that pushes into `mismatches`. Should be an observation; property already watches `mismatchCount`. |
| `sql-client/.../system.ts` `converged` property | Named `converged` but it is a property, not an observation — collides with the vocabulary used everywhere else. |
| `acme-counter/scenario.ts` | Mutates `session.dispose`; casts `session.ports` for `openPage` instead of a typed Host `.with`. |
| `matchmaking/.../define-matchmaking-system.ts` | Mutates `session.dispose`; `asSeededRng(... as never)`; `startMatchmaking` World opener. |
| `ui-testing/.../observations.ts` | Unbound `defineObservation` (no `defineSurface`); shared `name: 'inventory'` across actors; `as unknown as JsonValue`. |
| `sim/test/.../system.ts` | Casts `session.ports as ProductExtra` rather than a typed host. |
| `sync-engine` / `room` / `matchmaking` `**/sim/**` | Broad `@pkgs/dst/kernel` imports (`VirtualScheduler`, `Network`, `asSeededRng`) — legal under depcruise, against the "Session is the handle" rule. |
| Many `*.sim.test.ts` | `properties: []` on `start`, then `expectConverged` at the end — standing monitors off, converge bolted on. |

**Correct usage to copy:** dst examples (`acme-kv`, `acme-sync`,
`acme-counter`); `sql-client` / `auth` / `db-schema` / `db-indexes` systems
(small `S`, system-bound definers, `check` over zero-arg pools); sync-engine
**pins** that `run.apply(mutate, …)` then `run.observe(liveNote(…))`
(`single-client-mutate-uploads-and-persists.sim.test.ts`); matchmaking
`untilObserved` / `neverObserved` (`radius-growth.sim.test.ts`);
`sim/test` `untilObserved` in `run-driver.ts`.

---

## Constraints a rewrite must keep

A new version that drops these is a different tool, not a dst v2.

1. **Determinism.** Same seed + knobs + choices ⇒ same Run. No wall
   `Date.now` / `Math.random` / `fetch` in the algebra. Host injects
   clock, rng, network, ids.
2. **Singular primitives.** One System, one Observation, one Action, one
   Property, one Run. No catalogs-as-records, no Formula tree, no World.
3. **Stimuli vs reads vs invariants.** Actions change the world.
   Observations read it. Properties watch it. Waiting is polling reads
   plus time, not an action named `converge`.
4. **Typed knobs and typed action args.** Scripted tests are ordinary
   function calls (`apply(put, 'c0', 'a', '1')`), not stringly `pin()`.
5. **Probe-by-weight random walk** over a pool of enabled actions, with
   recorded draws so a failing episode shrinks and replays.
6. **Host as fidelity.** Virtual vs wall vs product extras (SQL, UI
   driver, WebView) without the System knowing which.
7. **Session.fork** for topology. Model network partition/heal as
   capability-gated stimuli.
8. **Harness-only Session.** Product runtime still takes unpacked ports.
9. **Four import paths** (algebra / pbt / kernel / fast-check), kernel
   confined to hosts + sim.
10. **No dependency patches, no Io bag, no package-local World DSL.**

Nice-to-have that v1 already has and v2 should not lose: observation
memo per checkpoint; named `observe({ a, b })`; `await using run`;
Repro as data (versioned JSON); vacuity detection on obligations;
`ActionNotEnabled` / `PropertyViolation` / `CheckFailedError` as named
errors.

---

## Extending (v1)

New stimulus = `defineAction`. New read = `defineObservation`. New
invariant = `defineProperty` attached via `start(..., { properties })` or
`check(..., { properties })`. Fidelity = new Host or `.with(extra ports)`.

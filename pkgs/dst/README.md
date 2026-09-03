# `@pkgs/dst`

Deterministic simulation testing for TypeScript. Same seed + knobs + action
choices ⇒ the same run. The algebra does not know about clients, browsers,
SQL, rooms, or networks — a **Host** supplies those. Any stateful system
that can boot behind a Host is in scope.

Root determinism policy: [`DETERMINISM.md`](../../DETERMINISM.md).

The shape matches [Bombadil](https://antithesishq.github.io/bombadil/browser/bombadil-manual.txt)
and Hypothesis / `eqc_statem` / fast-check commands: **reads**,
**enablement + args + act**, and **checkpoint checks** are separate;
the framework picks; scripted `apply` is a first-class citizen. dst
adds a deterministic Host (virtual time, model network, typed knobs,
Repro). Reads are plain `(s: S, ...args) => T` — no extract/Cell
wrapper. There is no Formula combinator tree: use `if`, previous-check
`ctx`, and `run.until`.

---

## What it is

Packages declare a **System** (boot a typed surface `S` from knobs),
**Actions** (named stimuli with explicit enablement and args), and
**Properties** (checkpoint predicates). Reads are ordinary functions of
`S`. The framework owns the run: `script` / `walk` / `explore` /
`replay`.

It is **not** a product runtime. `Host` / `Session` are harness-only.
Product `ClientEnv` / `ServerEnv` receive unpacked ports (`clock`,
`timers`, `createId`, `random`, `http`) — never the Session bag.

Out of scope forever: World openers, Formula algebra, generator action
bodies, observation constructors, catalogs hung on `System`, and
package wrappers around `script` / `explore`.

---

## Algebra

| Sort | Constructor | Role |
| --- | --- | --- |
| Host | `defineHost` / `virtualHost` / `wallHost` | Fidelity: clock, rng, network, extras |
| Session | `host.open(seed)` | Kernel + ports for one node; `fork(name)` |
| System | `defineSystem({ name, generate(session, knobs) })` | Recipe → surface `S` |
| Action | `defineAction({ name, enabled, weight, args, act })` | Named stimulus |
| Property | `defineProperty({ name, check, close? })` | Predicate at each checkpoint |
| Run | `script(system, { knobs, properties })` | `apply` / `observe` / `assert` / `until` / `elapse` |
| Gen | `(rng) => T` | Randomness (`@pkgs/dst/fast-check` adapts fc) |

Reads are not a sort. A read is `(s: S, ...args) => Awaitable<T>`.
Every framework callback may return a `Promise` (`Awaitable<T> = T |
Promise<T>`). The Host awaits. UI queries and SQL reads are async; in-
process `inFlight()` is sync. Same type either way.

`walk` is the search primitive (public). `explore` is episodes × walk +
shrink. `replay` re-applies a Repro.

---

## Mental model

1. **Host** opens a **Session** (virtual or wall clock, model network or
   none, caps, extra ports).
2. **System.generate(session, knobs)** boots topology from typed knobs
   and returns surface `S`. `S` is data (nodes + whatever the domain
   needs). No methods that wait, drain, or converge.
3. **Reads** are pure functions of `S`. They may be async (DOM, SQL).
   `enabled` / `weight` / `check` `await` them. `run.observe(quiet)` is
   the same function through a sealed Run (memoised per checkpoint by
   function identity + args — including the probe’s own `await count(s)`
   so `enabled` and `weight` share one UI query).
4. **Actions** are `{ enabled, weight, args, act }`. Probe **awaits**
   `enabled(s)` and `weight(s)` only — it never runs `act`, never draws.
   Both are live: a counter’s `increment` can get heavier as `count(s)`
   stays small, lighter as it grows. Walk awaits `args(s)` for the chosen
   action, then `act(s, ...args)`. Scripted tests pass those args
   themselves: `run.apply(put, 'c0', 'a', '1')`.
5. **Properties** `await check(s, ctx)` at every checkpoint. Throw =
   safety violation. `await close(ctx)` on dispose = obligation (vacuity
   if unmet in every episode). Cross-step state is `ctx`, not a
   `while (true)` loop.
6. **Run** is sealed for mutation: the only stimulus is `apply` or
   `elapse`. Waiting is `until` / `never`, which elapse the host clock
   and re-read. Quiescence and convergence are functions of `S`.

`run.apply` / `run.elapse` are the checkpoints: act (or tick) →
`session.settle()` → clear read memo → run every `check` → record a
`Choice`.

---

## Public surface

Three entrypoints (`pkgs/dst/package.json` `exports`):

| Import | Contents |
| --- | --- |
| `@pkgs/dst` | Algebra: `defineSystem` / `defineAction` / `defineProperty` / `defineSurface` / `script` / `walk` / `explore` / `replay` / `ExploreFailedError` / `virtualHost` / `wallHost` / `defineHost` / `REPRO_VERSION` / `parseRepro` / `stringifyRepro` + types |
| `@pkgs/dst/kernel` | Clock / scheduler / rng / network factories. **Host authors only.** Depcruise: `pkgs/dst/**` host + kernel, not `**/sim/**`. |
| `@pkgs/dst/fast-check` | `gen(arbitrary)`, `arbitrary(gen)`, `randomGeneratorOver` |

`Run` has no `_internal` and no `surface`. Tests speak `apply` /
`observe` / `assert` / `until` / `never` / `elapse`. See
`public-api.contract.test.ts` for the forbidden-export list.

---

## Authoring

Bind action / property definers from the system (or `defineSurface<S>()`
when they live in several files). Reads are ordinary functions of `S`.

```ts
const kv = defineSystem({
  name: 'kv',
  generate(session, knobs: { clients: number }) {
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
const { defineAction, defineProperty } = kv;
```

`generate` is `(session, knobs) => S | Promise<S>`. Topology is knobs.
Do not draw inside `generate`. `session.rng` exists so *nodes* receive
an injected `Random` — not so the recipe can hide extra entropy.

Put `session` on `S` only when actions must reach network / scheduler.
`session.fork(name)` is memoised by name.

### Reads

A pure function of `S`. Sync or async. No constructor.

```ts
export function quiet(s: KvSurface): boolean {
  return s.session.network.inFlight() === 0;
}

export async function count(s: CounterSurface): Promise<number> {
  return Number(await s.page.text('#count'));
}

export async function liveNote(
  s: KvSurface,
  nodeId: string,
  id: string
) { /* SQL / UI */ }

await run.observe(quiet);
await run.observe(count);
await run.observe(liveNote, 'bob', 'n1');
```

Inside `enabled` / `weight` / `check`, `await` it:

```ts
enabled: async (s) => (await route(s)) === 'home',
weight: async (s) => ((await count(s)) < 50 ? 6 : 2),
```

Rules:

- **Pure.** Probe and `check` may call it. A “get” that writes a
  mismatch log is not a read — it is an action, or it is a bug.
- **Identity is the function + args.** Do not close over an actor and
  reuse one name; pass `actorId` as an argument.
- **Memo** for the duration of one probe or checkpoint, keyed by
  function identity + `fingerprint(args)`. `enabled` and `weight` both
  `await count(s)` → one DOM/SQL round-trip. `run.observe` uses the same
  cache. The cache clears at the next checkpoint.
- **Names** for traces come from `function count` (`.name`). Anonymous
  arrows are fine when you do not care about the label.

`run.observe` exists because Run does not expose `S`. It is not a
second kind of observation.

### Action

One name. Scripted args are the walk args. Replay stores them.
`enabled` and `weight` are both functions of `S`, recomputed every
probe. `enabled` is whether the action is legal; `weight` is how often
walk should pick it **in this state**.

```ts
export const increment = defineAction({
  name: 'increment',
  enabled: async (s) => (await route(s)) === 'home',
  weight: async (s) => ((await count(s)) < 50 ? 6 : 2),
  act: (s) => s.page.click('#increment'),
});

export const decrement = defineAction({
  name: 'decrement',
  enabled: async (s) =>
    (await route(s)) === 'home' && (await count(s)) > 0,
  weight: async (s) => Math.min(await count(s), 4),
  act: (s) => s.page.click('#decrement'),
});
```

Walk sees a low count → increment is 6× decrement. Count climbs past 50
→ increment drops to 2, decrement is capped at 4. Same actions, different
mix, no extra `randomIncrement` wrapper.

Scripted args and a constant mix (sugar: a number is `() => n`):

```ts
export const put = defineAction({
  name: 'put',
  enabled: (s) => s.clients.length > 0,
  weight: 3,
  args: (s) =>
    gen(
      fc.tuple(
        fc.constantFrom(...s.clients.map((c) => c.id)),
        fc.string({ minLength: 1, maxLength: 8 }),
        fc.string({ maxLength: 16 })
      )
    ),
  act: (s, client: string, key: string, value: string) => {
    const c = s.clients.find((x) => x.id === client);
    if (c === undefined) return;
    sendPut({ server: s.server, client: c, key, value });
  },
});

await run.apply(put, 'client:0', 'a', '1');
```

| Field | Default | Meaning |
| --- | --- | --- |
| `enabled(s)` | `() => true` | Probe; `Awaitable<boolean>`. false ⇒ not in the pool |
| `weight(s)` | `() => 1` | `Awaitable<number>` this step. A number `n` is `() => n`. `<= 0` ⇒ not in the pool |
| `args(s)` | none (zero-arg) | `Awaitable<Gen<A>>` drawn by walk; ignored by `apply` |
| `act(s, ...args)` | required | Stimulus. `Awaitable<void>`. Must not wait-for-converge |

`enabled` vs `weight`: `decrement` is illegal at 0 (`enabled`); at 12 it
is legal and only moderately interesting (`weight: 4`). Do not encode
“rarely” as `enabled: false`.

Screen-conditional UI is `enabled` on the route, `weight` on the count.

Capability-gated faults:

```ts
export const partition = defineAction({
  name: 'partition',
  enabled: (s) =>
    caps(s).includes('partition') && s.clients.length > 0,
  weight: (s) => (partitioned(s).length === 0 ? 2 : 1),
  args: (s) => gen(fc.constantFrom(...s.clients.map((c) => c.id))),
  act: (s, id: string) => {
    s.session.network.partition('server', id);
  },
});
```

Macros (outage = partition + time + heal) are either:

- one `act` that performs several stimuli as **one** choice, or
- omitted — walk will pick the primitives in sequence.

Do not delegate by yielding other actions. One named action covers
both scripted pins and the walk pool — do not keep a parallel
`random*` wrapper or a tagged-union dispatcher for replay.

Inventory-driven UI (Bombadil’s “return N click templates”) is one
action whose `args` ranges over the current inventory:

```ts
export const tap = defineAction({
  name: 'tap',
  enabled: async (s) => (await inventory(s, 'alice')).targets.length > 0,
  args: async (s) => {
    const { targets } = await inventory(s, 'alice');
    return gen(fc.constantFrom(...targets));
  },
  act: (s, target: Target) => s.driver.tap(target),
});
```

### Property

A checkpoint function, plus optional close. The constructor exists
because vacuity reports a **name**, and `setup` / `check` / `close`
share `ctx`. All three are `Awaitable`.

```ts
export const converges = defineProperty({
  name: 'converges',
  check: async (s) => {
    if (
      (await quiet(s)) &&
      (await partitioned(s)).length === 0 &&
      !(await converged(s))
    ) {
      throw new Error(
        `quiet but diverged: server ${String(await serverHash(s))}`
      );
    }
  },
});
```

Cross-step (Bombadil `now(() => { const initial = cell.current; … })`):

```ts
export const counterSteps = defineProperty({
  name: 'counter-steps',
  setup: async (s) => ({ prev: await count(s) }),
  check: async (s, ctx: { prev: number }) => {
    const n = await count(s);
    if (Math.abs(n - ctx.prev) > 1) throw new Error('jumped');
    return { prev: n };
  },
});
```

Obligation (coverage / “sometimes heal”):

```ts
export const healedOnce = defineProperty({
  name: 'healed-once',
  setup: () => ({ hit: false }),
  check: (s, ctx: { hit: boolean }) => ({
    hit: ctx.hit || partitioned(s).length === 0,
  }),
  close: (ctx) => {
    if (!ctx.hit) throw new Error('never healed');
  },
});
```

`explore` treats a `close` throw that happens in **every** episode as
vacuity (no witness to shrink). A throw from `check` is a safety
violation and shrinks.

Liveness in a **scripted** test is `run.until`, not a property loop.
Bounded “if error then gone within 5s” in explore is a `check` that
records `errorAt` on `ctx` and throws when `(await clock(s)) - errorAt`
exceeds the bound. That is ordinary code, not `eventually().within()`.

`run.assert(p)` runs `setup` + `check` once (not as a standing monitor).

---

## Driving a run

Who chooses the path is the top-level distinction:

| Verb | Who chooses | Role |
| --- | --- | --- |
| `script` | Human | Open a run; drive with `apply` / `observe` / `until` |
| `explore` | Framework | Search (episodes × `walk` + shrink) |
| `replay` | Recorded Repro | Reproduce a discovered path |

```ts
import { script, explore, replay, walk } from '@pkgs/dst';
import { gen } from '@pkgs/dst/fast-check';

await using run = await script(kv, {
  seed: 7,
  knobs: { clients: 2 },
  properties: KV_PROPERTIES,
});
await run.apply(put, 'client:0', 'a', '1');
await run.apply(partition, 'client:0');
await run.until(quiet, { maxMs: 2_000 });
await run.apply(heal);
await run.until(converged, { maxMs: 5_000 });
expect(await run.observe(converged)).toBe(true);

await explore(kv, {
  properties: KV_PROPERTIES,
  actions: [put, partition, heal],
  knobs: gen(arbKvKnobs()),
  time: { weight: 1, minMs: 0, maxMs: 5_000 },
  episodes: 20,
  steps: 40,
});
```

### Run

```ts
type Awaitable<T> = T | Promise<T>;
type Read<S, A extends unknown[], T> = (s: S, ...args: A) => Awaitable<T>;

type Run<S> = {
  apply<A extends unknown[]>(action: Action<S, A>, ...args: A): Promise<void>;
  observe<T, A extends unknown[]>(read: Read<S, A, T>, ...args: A): Promise<T>;
  assert(p: Property<S>): Promise<void>;
  elapse(ms: number): Promise<void>;
  until<T>(
    read: Read<S, [], T>,
    opts?: { maxMs?: number; stepMs?: number; pred?: (t: T) => boolean }
  ): Promise<T>;
  never<T>(
    read: Read<S, [], T>,
    opts: { forMs: number; stepMs?: number; pred?: (t: T) => boolean }
  ): Promise<void>;
  [Symbol.asyncDispose](): Promise<void>;
};
```

- **`apply`** — checkpoint. Throws `ActionNotEnabled` if `enabled` is
  false at probe time (scripted tests that fire a disabled action fail
  loudly; they do not no-op).
- **`observe`** — call `read(s, ...args)` without exposing `S`. No
  checkpoint.
- **`elapse(ms)`** — Host-defined time step, then settle + checks.
  Recorded as a `Choice` `{ action: 'elapse', args: [ms] }` so replay
  does not need a per-system clock action.
- **`until` / `never`** — poll `observe` and `elapse(stepMs)` until the
  predicate or the bound. Default `stepMs: 50`, `until.maxMs: 5_000`.
  Predicate defaults to truthiness. Time advance is `elapse`, not a
  system action. Extra args belong on the function:
  `run.until((s) => liveNote(s, 'bob', 'late'))`.

`Run` does not expose `surface` or `session`. If a test needs a read,
write a function. If it needs a stimulus, add an action. Kit methods
named `waitUntil` / `drainUntilConverged` / `checkInvariants` do not
come back.

### Walk / explore / replay

- `walk(run, { actions, steps?, budgetMs?, stopOnViolation?, time? })` —
  probe every action (`await enabled(s)` + `await weight(s)`), pick by
  that step’s weights, `await args(s)`, `await act`. Optional `time`
  injects `elapse` into the pool.
- `explore(system, { properties, actions, knobs?, episodes?, steps?,
  time?, seed?, shrink?, budgetMs? })` — episodes × (script + walk +
  close) + shrink. Throws `ExploreFailedError`. Seed is `opts.seed` or
  pinned `424242`. **No `process.env`.**
- `replay(system, repro, { actions, properties?, host? })` — boots with
  the Repro’s knobs and re-applies each `Choice` (named action + args,
  or `elapse`).

Repro:

```ts
{
  version: 5,
  seed,
  knobs: unknown,          // JSON-projected typed knobs
  choices: { action, args }[],
  meta: { system, host? },
}
```

No separate `system:` draw tape — topology is knobs. Shrink (1) delta-
debugs choices (2) minimises knobs and JSON args toward empty / 0.

---

## Host, Session, kernel

Every Session still has ports: `clock`, `timers`, `rng`, `createId`,
`random`, `network` (per-fork `Endpoint`).

Session also holds: `scheduler`, `network` (partition / heal /
`inFlight`), optional `trace`, `caps`, `fork`, `dispose`, `settle`,
**`elapse(ms)`**, **`onDispose(fn)`**.

**Capabilities:** `'virtualTime' | 'partition' | 'trace'`.
`virtualHost()` has all three. `wallHost({ network })` has no
`virtualTime`; partition only if `network: 'model'`.

**Settle** = “effects of this act have been delivered”, defined by the
Host. Virtual default: drain due-at-now, no time travel. It is **not**
global quiescence. Heartbeats that reschedule forever are fine: settle
returns after the current due set. Convergence is a function of `S`.

**Elapse** = Host-defined tick. Virtual: `scheduler.advance(ms)`. Wall:
wait `ms` (or the UI driver’s `runFor`). Product extras that must move
with time (RNTL) belong on the Host, not as a system action.

**Lifecycle** belongs on Session, not in `generate`:

```ts
const page = await ports.openPage();
session.onDispose(() => page.dispose());
```

**`.with(session => extraPorts)`** merges keys onto `session.ports` and
forks. **`settle` overrides** are Host options (`defineHost({ settle })`
or `virtualHost({ settle })`), not a reimplemented Host and not a
WeakMap keyed by host brand.

Kernel (`@pkgs/dst/kernel`) is host-private. Session is the only handle
sim kits see. If a sim needs the scheduler heap, that is a Host
capability, not an import of `createVirtualScheduler`.

---

## Same algebra, different domains

The framework does not change. The Host and `S` do.

### Multi-node service (sync, room, matchmaking, kv)

`S = { session, server, clients }`. Actions: mutate, partition, heal.
Reads: `quiet`, `converged`, live row. Properties: quiet ∧ healed ⇒
converged. `time` on in explore. Host: `virtualHost({ startTime })`.

### UI (DOM, RN, WebView)

`S = { page }` or `{ driver }`. Actions: tap / fill / back; `enabled`
on the current screen; `weight` on live widgets (e.g. `count(s)`).
Reads: `route`, `count`, `inventory(s, actorId)`.
Properties: no error boundary, no console error. Host: `.with(openPage)`
or a Playwright/RNTL host; `elapse` is the driver’s clock. This is the
Bombadil use case without Bombadil’s Formula layer or `extract`.

### Schema / indexes / SQL client / auth

`S = { db }` or `{ engine, migrations }`. No network. Actions: apply
migration, insert row, rebuild index. Reads: catalog, mismatch count.
Properties: `mismatchCount(s) === 0`. Omit `time`. Host: `virtualHost`
or a tiny SQL host. `get` is a function, not an action that writes
`state.mismatches`.

### Product sim (`@sim/test`)

`S` is the product graph. Host is `simHost` / `maxHost` (real Postgres,
MinIO, …). Same `script` / `explore`. Extra ports via `.with`, not
`session.ports as ProductExtra`.

A new domain is: a Host (if fidelity differs), a `defineSystem`,
functions of `S`, actions, properties. Not a package-local World opener.

---

## Do / don't

- **Do** bind action / property definers once (`defineSurface<S>()` or
  from the System).
- **Do** keep `S` as data. Reads = functions; stimuli = actions.
- **Do** put `enabled(s)` and `weight(s)` on the action. Both may be
  async. Weight is live — bump `increment` when `await count(s)` is
  low, drop it when high.
- **Do** pass actor / node identity as function args, not closures.
- **Do** wait with `run.until` / `run.never`.
- **Do** attach standing properties on `script` / `explore`.
- **Don't** wrap reads in a constructor or drive actions as generators.
- **Don't** add `randomFoo` wrappers next to `foo`.
- **Don't** encode wait / assert / settle / converge as actions.
- **Don't** hang `.actions` / `.properties` on the System. Pass lists.
- **Don't** wrap `script` / `explore` in package helpers — Host + knobs
  + the algebra verbs are the API.
- **Don't** import `@pkgs/dst/kernel` from sim kits (Session + public
  Session-adjacent types only).
- **Don't** read `process.env` for seeds.
- **Don't** reintroduce Formula / World / catalogs-as-records / Cells.

---

## Invariants

1. **Determinism.** Same seed + knobs + choices ⇒ same Run. No wall
   `Date.now` / `Math.random` / `fetch` in the algebra. Host injects
   clock, rng, network, ids.
2. **Singular primitives.** One System, one Action, one Property, one
   Run. No Observation sort, no catalogs-as-records, no Formula tree,
   no World.
3. **Stimuli vs reads vs invariants.** Actions change the world.
   Functions read it. Properties watch it. Waiting is polling reads
   plus Host time.
4. **Typed knobs and typed action args.** Scripted tests are ordinary
   calls (`apply(put, 'c0', 'a', '1')`).
5. **Probe-by-weight random walk** over enabled actions, with recorded
   args so a failing episode shrinks and replays.
6. **Host as fidelity.** Virtual vs wall vs product extras without the
   System knowing which.
7. **Session.fork** for topology. Model network partition/heal as
   capability-gated stimuli.
8. **Harness-only Session.** Product runtime takes unpacked ports.
9. **Three import paths** (algebra / kernel / fast-check), kernel
   confined to host authors inside `pkgs/dst`.
10. **No dependency patches, no Io bag, no package-local World DSL.**
11. **Domain-agnostic algebra.** No type, helper, or default action
    that assumes clients, browsers, SQL, or games. Those live in
    Hosts and in consuming packages.

Also: read memo on `run.observe` per checkpoint; `await using run`;
Repro as versioned JSON; vacuity on obligations;
`ActionNotEnabled` / `PropertyViolation` / `ExploreFailedError`.

---

## Layout

```
src/index.ts          public algebra
src/host/             virtualHost / wallHost / defineHost / Session
src/system/           defineSystem / defineAction / defineProperty / defineSurface
src/run/              probe / script / walk / explore / replay / checkpoint
src/kernel/           clocks, schedulers, rng, fingerprint, json, timers
src/models/           in-process network
src/fast-check/       gen / arbitrary adapters
src/examples/         teaching toys (acme-kv, acme-sync, acme-counter)
```

Probe is `enabled` + `weight` (never runs `act`). Checkpoint: act /
elapse → settle → checks → `Choice`.

---

## Extending

New stimulus = `defineAction`. New read = a function of `S`. New
invariant = `defineProperty` attached via `script` / `explore`.
New fidelity = new Host or `.with(extra ports)`. New domain = those,
not a new framework.

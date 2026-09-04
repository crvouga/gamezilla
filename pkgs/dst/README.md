# `@pkgs/dst`

Deterministic simulation testing for TypeScript. Same seed + args + action
choices ⇒ the same script. The algebra does not know about clients, browsers,
SQL, rooms, or networks — a **Host** supplies those. Any stateful system
that can boot behind a Host is in scope.

Root determinism policy: [`DETERMINISM.md`](../../DETERMINISM.md).

The shape matches [Bombadil](https://antithesishq.github.io/bombadil/browser/bombadil-manual.txt)
and Hypothesis / `eqc_statem` / fast-check commands: **reads**,
**enablement + args + act**, and **checkpoint checks** are separate;
the framework picks; scripted `apply` is a first-class citizen. dst
adds a deterministic Host (virtual time, model network, typed args,
Repro). Reads are plain `(s: S, ...args) => T` — no extract/Cell
wrapper. There is no Formula combinator tree: use `if`, previous-check
`ctx`, and `s.until`.

---

## What it is

Packages declare a **System** (boot a typed surface `S` from `args`),
register **Actions** / **Properties** / **Hosts** on that system, and
drive scripts with **methods**: `system.script` / `system.explore` /
`system.replay` / `s.walk`. Reads are ordinary functions of `S`.

It is **not** a product runtime. `Host` / `Session` are harness-only.
Product `ClientEnv` / `ServerEnv` receive unpacked ports (`clock`,
`timers`, `createId`, `random`, `http`) — never the Session bag.

Out of scope forever: World openers, Formula algebra, generator action
bodies, observation constructors, free `script` / `explore` verbs, and
package wrappers around `defineSystem` / `script` / `explore`.

---

## Algebra

| Sort | Constructor | Role |
| --- | --- | --- |
| Host | `defineHost` / `virtualHost` / `wallHost` | Fidelity factories used **inside** `system.host({ create })` |
| Session | `host.open(seed)` | Kernel + ports for one node; `fork(name)` |
| System | `defineSystem({ name, create, args?, draw? })` | Recipe → surface `S`; catalogs via methods |
| Action | `system.action({ name, enabled, weight, args?, draw?, act })` | Named stimulus (catalogued) |
| Property | `system.property({ name, check, close? })` | Predicate at each checkpoint |
| Script | `system.script({ seed, host?, args? })` | `apply` / `observe` / `assert` / `until` / `elapse` / `walk` |
| Gen | `(rng) => T` | Randomness (`@pkgs/dst/fast-check` adapts fc) |

**Naming (one concept, one word):**

| Role | Field | Shape |
| --- | --- | --- |
| Default values | `args` on system / action | `Args` or apply tuple `A` |
| Overlay for this script / apply | `script({ args })` / `apply(action, ...)` | `Partial<Args>` overlay; apply is a full tuple override |
| How explore / walk samples | `draw` | system: `() => Gen<Args>`; action: `(s) => Gen<A>` |
| Fidelity | `system.host({ name, default?, create })` | named Host factory; `script({ host: 'playwright' })` |

`draw` is named so it does not clash with `gen()` from `@pkgs/dst/fast-check`.
Do not name a field `gen`, `defaults`, or `knobs`.

Reads are not a sort. A read is `(s: S, ...args) => Awaitable<T>`.
Every framework callback may return a `Promise`. The Host awaits.

---

## Mental model

1. **Host** opens a **Session** (virtual or wall clock, model network or
   none, caps, extra ports). Hosts are **registered by name** on the
   system; `script` / `explore` pick a name (or the `default: true`).
2. **System.create(session, args)** boots topology from typed args and
   returns surface `S`. `S` is data. No methods that wait, drain, or
   converge.
3. **Reads** are pure functions of `S`. They may be async (DOM, SQL).
4. **Actions** are `{ enabled, weight, args?, draw?, act }`. Probe
   awaits `enabled` / `weight`. Walk awaits `draw(s)` for the chosen
   action, then `act`. Scripted tests pass args themselves or use
   `action.args` defaults: `await s.apply(put)` /
   `await s.apply(put, 'c0', 'a', '1')`.
5. **Properties** `await check(s, ctx)` at every checkpoint. Throw =
   safety violation. `await close(ctx)` on dispose = obligation.
6. **Script** is sealed for mutation: the only stimulus is `apply` or
   `elapse`. Waiting is `until` / `never`.

`s.apply` / `s.elapse` are the checkpoints: act (or tick) →
`session.settle()` → clear read memo → run every `check` → record a
`Choice`.

---

## Public surface

Three entrypoints (`pkgs/dst/package.json` `exports`):

| Import | Contents |
| --- | --- |
| `@pkgs/dst` | `defineSystem` / unbound `defineAction` (walk-time helpers only) / `ExploreFailedError` / `virtualHost` / `wallHost` / `defineHost` / `REPRO_VERSION` / `parseRepro` / `stringifyRepro` + types |
| `@pkgs/dst/kernel` | Clock / scheduler / rng / network factories. **Host authors only.** |
| `@pkgs/dst/fast-check` | `gen(arbitrary)`, `arbitrary(gen)`, `randomGeneratorOver` |

Free `script` / `walk` / `explore` / `replay` / `defineSurface` /
`defineProperty` are **not** exported. Prefer `system.script` /
`s.walk`. Unbound `defineAction` exists for walk-time helpers that
cannot be pre-registered (e.g. `tap(actor)` in `@pkgs/ui-testing`).

`Script` has no `_internal` and no `surface`. See
`public-api.contract.test.ts`.

---

## Authoring

```ts
import { defineSystem, virtualHost, wallHost } from '@pkgs/dst';
import { gen } from '@pkgs/dst/fast-check';
import fc from 'fast-check';

export const kv = defineSystem({
  name: 'acme-kv',
  args: { clients: 2 },
  draw: () => gen(fc.record({ clients: fc.integer({ min: 1, max: 3 }) })),
  create(session, args: { clients: number }) {
    const server = startServer(session.fork('server'));
    const clients = range(args.clients).map((i) =>
      startClient(session.fork(`client:${i}`), server)
    );
    return { session, server, clients };
  },
});

kv.host({ default: true, name: 'virtual', create: () => virtualHost() });
kv.host({ name: 'wall-model', create: () => wallHost({ network: 'model' }) });

export const put = kv.action({
  name: 'put',
  enabled: (s) => s.clients.length > 0,
  weight: 3,
  args: ['client:0', 'a', '1'] as const,
  draw: (s) =>
    gen(
      fc.tuple(
        fc.constantFrom(...s.clients.map((c) => c.id)),
        fc.string({ minLength: 1, maxLength: 8 }),
        fc.string({ maxLength: 16 })
      )
    ),
  act: (s, client: string, key: string, value: string) => {
    /* ... */
  },
});

export const converges = kv.property({
  name: 'converges',
  check: (s) => {
    if (quiet(s) && !converged(s)) throw new Error('diverged');
  },
});
```

`create` is `(session, args) => S | Promise<S>`. Topology is `args`.
Do not draw inside `create`. `draw` on the system samples per explore
episode; omit it when every episode should use `args`.

`system.hosts` is the registered name list — use it for matrices:

```ts
describe.each(kv.hosts)('acme-kv ($0)', (host) => {
  test('pin', async () => {
    await using s = await kv.script({ seed: 7, host });
    /* ... */
  });
});
```

Shared library actions (room `addClient` across counter / chess) are
unbound `defineAction` (or registered on one system) then
`otherSystem.action(existingAction)`.

### Reads

A pure function of `S`. Sync or async. No constructor.

```ts
export function quiet(s: KvSurface): boolean {
  return s.session.network.inFlight() === 0;
}

await s.observe(quiet);
await s.observe(liveNote, 'bob', 'n1');
```

### Action

| Field | Default | Meaning |
| --- | --- | --- |
| `enabled(s)` | `() => true` | Probe; false ⇒ not in the pool |
| `weight(s)` | `() => 1` | Live weight this step. A number `n` is `() => n` |
| `args` | none | Default apply tuple when `s.apply(action)` has no rest |
| `draw(s)` | none | Walk / explore sampler (`Gen<A>`) |
| `pool` | `true` | `false` ⇒ scripted/replay only (excluded from explore / walk) |
| `act(s, ...args)` | required | Stimulus. Must not wait-for-converge |

```ts
await s.apply(put); // uses put.args
await s.apply(put, 'client:1', 'b', '2'); // full override
```

### Property

Register on the system — there is no free `defineProperty`.

```ts
export const converges = kv.property({
  name: 'converges',
  check: (s) => { /* throw if quiet but diverged */ },
});
```

`script` / `explore` attach every registered property. There is no
opt-out — register only the properties that should stand on every script.

---

## Driving a script

| Verb | Who chooses | Role |
| --- | --- | --- |
| `system.script` | Human | Open a script; drive with `apply` / `observe` / `until` |
| `system.explore` | Framework | Search (episodes × `walk` + shrink) |
| `system.replay` | Recorded Repro | Reproduce a discovered path |
| `s.walk` | Framework | Weighted walk over the pool (or an explicit `actions` list) |

```ts
await using s = await kv.script({ seed: 7 });
await s.apply(put);
await s.apply(partition, 'client:0');
await s.until(quiet, { maxMs: 2_000 });
await s.apply(heal);
await s.until(converged, { maxMs: 5_000 });

await kv.explore({
  time: { weight: 1, minMs: 0, maxMs: 5_000 },
  episodes: 20,
  steps: 40,
  seed: 42,
});

await kv.script({ seed: 7, host: 'wall-model', args: { clients: 3 } });
```

### Args / draw resolution

| Site | Rule |
| --- | --- |
| `script({ seed })` | use `system.args` |
| `script({ seed, args })` | `{ ...system.args, ...opts.args }` |
| `explore()` | `draw()`; if omitted, every episode uses `args` |
| `explore({ args })` | fixed `Args` or a one-off `Gen<Args>` instead of `draw` |
| `apply(action)` | use `action.args` |
| `apply(action, ...args)` | full override — no partial tuple merge |
| walk | `action.draw(s)`; action `args` are not a walk input |

### Script

```ts
type Script<S> = {
  apply<A extends unknown[]>(action: Action<S, A>, ...args: A | []): Promise<void>;
  observe<T, A extends unknown[]>(read: Read<S, A, T>, ...args: A): Promise<T>;
  assert(p: Property<S>): Promise<void>;
  elapse(ms: number): Promise<void>;
  until<T>(read: Read<S, [], T>, opts?: { maxMs?: number; stepMs?: number; pred?: (t: T) => boolean }): Promise<T>;
  never<T>(read: Read<S, [], T>, opts: { forMs: number; stepMs?: number; pred?: (t: T) => boolean }): Promise<void>;
  walk(opts?: WalkOptions<S>): Promise<Walk>;
  [Symbol.asyncDispose](): Promise<void>;
};
```

### Walk / explore / replay

- `s.walk({ actions?, steps?, … })` — defaults to the registered pool
  (`pool !== false`). Product-walk may pass actor-bound `tap(actor)`.
- `system.explore({ episodes?, steps?, time?, seed?, args? })` —
  catalogs and default host come from the system. Throws
  `ExploreFailedError`.
- `system.replay(repro, { host? })` — boots with the Repro’s `args` and
  re-applies each `Choice`.

Repro:

```ts
{
  version: 6,
  seed,
  args: unknown,          // JSON-projected typed args
  choices: { action, args }[],
  meta: { system, host? },
}
```

---

## Host, Session, kernel

Every Session still has ports: `clock`, `timers`, `rng`, `createId`,
`random`, `network` (per-fork `Endpoint`).

**Capabilities:** `'virtualTime' | 'partition' | 'trace'`.
`virtualHost()` has all three. `wallHost({ network })` has no
`virtualTime`; partition only if `network: 'model'`.

Register hosts on the system — do not pass a `Host` object through
`script`:

```ts
counter.host({ default: true, name: 'happydom', create: () => happyDomHost() });
counter.host({ name: 'webview', create: () => webViewHost() });
await counter.script({ seed: 1, host: 'webview' });
```

`virtualHost` / `wallHost` / `defineHost` stay as Host constructors used
**inside** `create` — they are not script options.

**Lifecycle** belongs on Session, not in `create`:

```ts
const page = await ports.openPage();
session.onDispose(() => page.dispose());
```

Kernel (`@pkgs/dst/kernel`) is host-private.

---

## Same algebra, different domains

### Multi-node service (sync, room, matchmaking, kv)

`S = { session, server, clients }`. Literal `defineSystem` per app;
shared `ROOM_DRAW` / `roomVirtual` constants are fine. Fold JSON
variants into `args` (matchmaking `tuning` / sync `sessionQuery`).

### UI (DOM, RN, WebView)

`S = { page }`. Register happydom / webview hosts; matrix via
`describe.each(counter.hosts)`.

### Product sim (`@sim/test`)

`product.host({ name: 'rntl' | 'playwright', … })`. `openSim` picks a
host name from fidelity. Product-walk keeps an explicit `actions` list
on `s.walk` (actor-bound UI actions cannot be pre-registered).

A new domain is: a Host (if fidelity differs), a `defineSystem`,
functions of `S`, `system.action` / `system.property`. Not a
package-local World opener or `defineXSystem` factory.

---

## Do / don't

- **Do** register actions / properties / hosts on the System.
- **Do** keep `S` as data. Reads = functions; stimuli = actions.
- **Do** put defaults on `args` and samplers on `draw`.
- **Do** wait with `s.until` / `s.never`.
- **Do** use `system.hosts` for host matrices.
- **Don't** wrap `defineSystem` / `script` / `explore` in package
  helpers (`defineRoomSystem`, `openRoom`, `syncKnobs`, …).
- **Don't** pass Host objects through `script` — register names.
- **Don't** thread `actions` / `knobs` catalogs at call
  sites when the registry defaults apply.
- **Don't** import `@pkgs/dst/kernel` from sim kits.
- **Don't** read `process.env` for seeds.
- **Don't** reintroduce Formula / World / Cells / free explore verbs.

---

## Invariants

1. **Determinism.** Same seed + args + choices ⇒ same Script.
2. **Singular primitives.** One System, one Action, one Property, one
   Script. Catalogs live **on** the System via registration.
3. **Stimuli vs reads vs invariants.** Actions change the world.
   Functions read it. Properties watch it.
4. **Typed args.** Scripted tests are ordinary calls.
5. **Probe-by-weight random walk** with recorded args for shrink/replay.
6. **Host as fidelity** — named, registered, selectable.
7. **Session.fork** for topology.
8. **Harness-only Session.**
9. **Three import paths** (algebra / kernel / fast-check).
10. **No dependency patches, no Io bag, no package-local World DSL.**
11. **Domain-agnostic algebra.**

---

## Layout

```
src/index.ts          public algebra
src/host/             virtualHost / wallHost / defineHost / Session
src/system/           defineSystem / defineAction / effect / repro
src/script/           probe / script / walk / explore / checkpoint (internal)
src/kernel/           clocks, schedulers, rng, fingerprint, json, timers
src/models/           in-process network
src/fast-check/       gen / arbitrary adapters
src/examples/         teaching toys (acme-kv, acme-sync, acme-counter)
```

---

## Extending

New stimulus = `system.action` (or unbound `defineAction` for walk-time
helpers). New read = a function of `S`. New invariant =
`system.property`. New fidelity = `system.host`. New domain = those,
not a new framework.

# `@pkgs/dst`

Deterministic simulation testing: an algebra of singular primitives.

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

## Body protocol

`generate(...args)` may return a bare act, a `{ weight, act }`, a promise, a generator, or any iterable.

1. **Read** — `yield* observation` / `yield* observation(...args)` / `yield* observe({ quiet, cut: partitioned })`
2. **Draw** — `yield* draw(gen)` (entropy only — not scripted params)
3. **Act** — return `(s) => …` or `{ weight, act: s => … }`, or `yield` them inside a generator

`yield* action` / `yield* action(...args)` delegates. An action that returns before its first act is not enabled. Bare function = weight 1; `weight: 0` = disabled.

Scripted tests pass typed args: `run.apply(put, 'client:0', 'a', '1')`. Random walk pools accept only zero-arg actions (draw then `yield* typedAction(...)`).

## Checkpoint loop

`run.apply(action, ...args)` is the only checkpoint: probe → draw → act + settle → resume monitors → record. Property bodies that complete are re-invoked at the next checkpoint. `walk` probes every zero-arg action, picks by weight, finishes the chosen body. `check` = episodes × (start + walk + close) + shrink. `replay` re-applies choices (args + recorded draws).

Waiting for a condition = poll with `untilObserved(run, obs, passTime)` (one checkpoint per step). Negative: `neverObserved(run, obs, passTime, { forMs })`.

Actions are stimuli only — never encode settle / converge / assert as actions. Heal or revive, then observe `quiet` / `converged`.

## Examples

Slim toys under [`src/examples/`](src/examples/) (not public exports):

| Toy | Teaches |
| --- | --- |
| [`acme-kv`](src/examples/acme-kv/scenario.ts) | typed knobs, forks, faults, `check` / `walk` |
| [`acme-sync`](src/examples/acme-sync/scenario.ts) | SQL-shaped aggregates + pending, converge after partition |
| [`acme-counter`](src/examples/acme-counter/scenario.ts) | DOM reads/acts (happy-dom + Bun.WebView), screen-conditional enablement, walk + replay |

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

## Entrypoints

- `@pkgs/dst` — define*, defineSurface, observe/draw, virtualHost/wallHost, start/walk, types
- `@pkgs/dst/pbt` — check, replay
- `@pkgs/dst/kernel` — Clock/Scheduler/Rng/Network factories (host authors + sim only)
- `@pkgs/dst/fast-check` — `gen(arbitrary)`, `arbitrary(gen)`

## Guides

- [`CONTEXT.md`](CONTEXT.md) — fresh-agent orientation
- Root [`DETERMINISM.md`](../../DETERMINISM.md)

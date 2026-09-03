# `@pkgs/dst`

Deterministic simulation testing: an algebra of singular primitives.

## Algebra

| Sort | Constructor | Composition | Role |
| --- | --- | --- | --- |
| Host | `defineHost` / `virtualHost` / `wallHost` | `.with(extra)` | Fidelity (virtual vs wall) |
| Session | `host.open(seed)` | `.fork(name)` | Kernel + ports for one node |
| System | `defineSystem({ name, generate })` | `yield* draw` / nest systems | Recipe → surface `S` |
| Observation | `defineObservation({ name, observe })` | `yield*` / `observe(a,b)` | Named read of live state |
| Action | `defineAction({ name, generate })` | `yield*` / `{ weight, act }` | Stimulus |
| Property | `defineProperty({ name, watch })` | control flow | Monitor over checkpoints |
| Run | `start(system, opts)` | `apply` / `observe` / `assert` | Live handle |
| Gen | `(rng) => T` | function composition | Randomness (`@pkgs/dst/fast-check` adapts fc) |

## Body protocol

Bodies are sync or async generators. Three requests:

1. **Read** — `yield* observation` or `yield observation` (prefer bare `yield` in infinite `watch` loops)
2. **Draw** — `yield* draw(gen)`
3. **Act** — `yield s => …` or `yield { weight, act: s => … }`

`yield* action` delegates. An action that returns before its first act is not enabled. The first act's weight is the pick weight (bare function = 1; `weight: 0` = disabled).

## Checkpoint loop

`run.apply(action)` is the only checkpoint: probe → draw → act + settle → resume monitors → record. `walk` probes every action, picks by weight, finishes the chosen body. `check` = episodes × (start + walk + close) + shrink. `replay` re-walks choices.

Waiting for a condition = poll with `untilObserved(run, obs, passTime)` (one checkpoint per step; do not busy-loop `observe` alone — memoisation would stick). Negative: `neverObserved(run, obs, passTime, { forMs })`.

Actions are stimuli only — never encode settle / converge / assert as actions. Heal or revive, then observe `quiet` / `converged`.

Tests use `start` / `Run` only. `open*World`, `play*Actions`, and `Run._internal` are forbidden.

## Examples

Slim toys under [`src/examples/`](src/examples/) (not public exports):

| Toy | Teaches |
| --- | --- |
| [`acme-kv`](src/examples/acme-kv/scenario.ts) | drawn topology, forks, faults, `check` / `walk` |
| [`acme-sync`](src/examples/acme-sync/scenario.ts) | SQL-shaped aggregates + pending, converge after partition |
| [`acme-counter`](src/examples/acme-counter/scenario.ts) | DOM reads/acts (happy-dom + Bun.WebView), screen-conditional enablement, walk + replay |

```ts
const kv = defineSystem({
  name: 'kv',
  *generate(session) {
    const n = yield* draw(gen(fc.integer({ min: 1, max: 3 })));
    const server = startServer(session.fork('server'));
    return {
      session,
      server,
      clients: range(n).map((i) => startClient(session.fork(`client:${i}`), server)),
    };
  },
});
const { defineObservation, defineAction, defineProperty } = kv;

await using run = await start(kv, { seed: 7, draws: [2], properties: KV_PROPERTIES });
await run.apply(put, { client: 'client:0', key: 'a', value: '1' });
expect(await run.observe(quiet)).toBe(true);

await check(kv, { properties: KV_PROPERTIES, actions: KV_ACTIONS, episodes: 20, steps: 40 });
```

## Entrypoints

- `@pkgs/dst` — define*, observe/draw, virtualHost/wallHost, start/walk, types
- `@pkgs/dst/pbt` — check, replay
- `@pkgs/dst/kernel` — Clock/Scheduler/Rng/Network factories (host authors + sim only)
- `@pkgs/dst/fast-check` — `gen(arbitrary)`, `arbitrary(gen)`

## Guides

- [`CONTEXT.md`](CONTEXT.md) — fresh-agent orientation
- Root [`DETERMINISM.md`](../../DETERMINISM.md)

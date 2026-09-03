# `@pkgs/dst` — agent context

## What this package is

A **deterministic simulation testing** framework for TypeScript. Same seed + system draws + action choices ⇒ same run. Used by sync-engine, room, product sim, and package-local scenario kits.

## Mental model (irreducible)

1. **Host** opens a **Session** (virtual or wall clock, model network, caps).
2. **System.generate(session)** draws knobs, forks sessions for nodes, returns surface `S`.
3. **Observations** read `S` (or compose other observations). Memoised per checkpoint.
4. **Actions** read → decide → draw → act. Probe rule: return before first act = disabled. Weight on first act = pick probability.
5. **Properties** are monitors: each `yield` is answered at the next checkpoint; throw = violation; `finally` on close = obligation.
6. **Run** = `start` → `{ apply, observe, assert }`. `walk` / `check` / `replay` compose Runs.

## Do / don't

- **Do** put `session` on `S` when actions need network/scheduler.
- **Do** gate faults with a `caps` observation (`if (!(yield* caps).includes('partition')) return`).
- **Do** use bare `yield obs` in infinite property watches (Bun hangs on `yield*` + `try/finally` + infinite loop).
- **Don't** import `@pkgs/dst/kernel` from product libs (depcruise: only `pkgs/dst/**`, `sim/**`, `**/sim/**`).
- **Don't** import `fast-check` from core dst modules — use `@pkgs/dst/fast-check` adapters.
- **Don't** add `World` / `openWorld` / `defineScenario` / `knob` / `node` / `std` — deleted.

## Key files

```
src/index.ts          public algebra
src/host/             virtualHost / wallHost / Session
src/system/           define* + effect protocol
src/run/              drive / probe / start / walk
src/pbt/              check / replay / shrink
src/kernel/           clocks, schedulers, rng, network
src/fast-check/       gen / arbitrary adapters
src/examples/         teaching toys (not public API)
  acme-kv/            network + faults + check/walk
  acme-sync/          SQL-shaped pending/converge (in-memory)
  acme-counter/       DOM Page via happy-dom + Bun.WebView
```

## Extending

New stimulus = `defineAction`. New read = `defineObservation`. New invariant = `defineProperty` attached via `start(..., { properties })` or `check(..., { properties })`. Fidelity = new Host or `.with(extra ports)`.

# `@pkgs/io`

Single injectable bag for all nondeterministic I/O in product runtime.

```ts
type Io = {
  clock: Clock;
  timers: Timers;
  createId: CreateId;
  random: Random;
  http: HttpClient;
  seed: bigint;
};
```

## Factories

- **`wallIo()`** — production (wall clock, crypto ids, global fetch). Only wall adapters may touch bare globals.
- **`createSimIo({ seed, startMs?, http? })`** — virtual clock + seeded ids/random for simulation.

## React / server

- **`IoProvider` / `useIo()`** — React composition root.
- **`runWithIo(io, fn)` / `getIo()`** — AsyncLocalStorage for workers / request scope.

## Policy

Product code must not use bare `Date.now`, zero-arg `new Date()`, `setTimeout`, `fetch`, `crypto.randomUUID`, `Math.random`, etc. Call `wallIo()` only at process entries (scripts / app boot / CLI); helpers take injected ports. Entry files mark `// @io-wall-ok`. CI: `bun run ci:no-bare-io`, `ci:no-resolve-wall-defaults` (see `AGENTS.md`).

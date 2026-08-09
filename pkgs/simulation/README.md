# `@pkgs/simulation`

Application-agnostic **multi-actor UI simulation** for acceptance tests.

- **UI is the only assertion surface** — interact via `@pkgs/ui-testing` (`Driver`, `by`, `expectVisible`, …).
- **Full system is opaque** — inject a `SimulationSystem` that boots whatever stack you need (in-process fakes, real HTTP, etc.).
- **Default is in-process** — no browser, no real network required.
- **No product or sync-engine coupling** — this package never imports `@libs/*`, `@apps/*`, or `@pkgs/sync-engine`.

## Install

```json
{
  "dependencies": {
    "@pkgs/simulation": "workspace:*",
    "@pkgs/ui-testing": "workspace:*"
  }
}
```

Package tests preload happy-dom + `react-native` → `react-native-web` via `@pkgs/ui-testing`’s bun preload (see `bunfig.toml`).

## Quick start

```ts
import { openSimulation } from '@pkgs/simulation';
import { by, expectVisible } from '@pkgs/ui-testing';

await using sim = await openSimulation({
  seed: 1,
  system: mySystem, // you implement SimulationSystem
  // ui: 'in-process' (default) | 'playwright'
});

const alice = await sim.actor('alice');
const bob = await sim.actor('bob');

await alice.open('/');
await alice.ui.tap(by.role('button', 'Create'));
await expectVisible(bob.ui, by.text('Game night'));
```

## Ports: plug in your system

```ts
import type { SimulationSystem } from '@pkgs/simulation';
import type { AppHarness } from '@pkgs/ui-testing';

const mySystem: SimulationSystem = {
  async start(ctx) {
    // ctx.clock / ctx.timers / ctx.seed / ctx.rng / ctx.ui
    // Boot shared backend here (DBs, in-proc servers, fakes, …).
    return {
      async createSession(actorId) {
        const harness: AppHarness = {
          createRoot: () => /* your app root for this actor */,
        };
        return {
          ui: 'in-process' as const,
          harness,
          open: async (path) => {
            /* deep-link / router */
          },
          dispose: async () => {
            /* tear down session */
          },
        };
      },
      async dispose() {
        /* tear down shared backend */
      },
    };
  },
};
```

For `ui: 'playwright'`, each session must return `{ ui: 'playwright', page, baseUrl?, open, dispose }` instead of a harness. Scenarios still only see `actor.ui: Driver`.

## Driver matrix

| `ui` | Meaning |
|------|---------|
| `in-process` (default) | React tree in Bun via `@pkgs/ui-testing` InProcessDriver |
| `playwright` | Injected Playwright `Page` via PlaywrightDriver |

Closeness to production is chosen by **which `SimulationSystem` you pass** and the `ui` kind — not by leaking lower-level APIs into tests.

## Determinism

- `seed` → stable `SeededRng` passed into `system.start`
- `SimulationClock` (virtual, start at `startMs` or `0`) passed as `ctx.clock`
- Re-run the same seed + system for reproducible actor scheduling on your side

## What not to do

- Do not assert against sync engines, mutation clients, SQL, or HTTP from scenarios
- Do not put product DSLs (spaces, chess, …) in this package — build them on `Driver` in your app/test package
- Do not import `@pkgs/sync-engine` here

## Product consumer (follow-up)

Wire a product `SimulationSystem` in `@libs/integration-test` (or a feature package) that boots the real app stack in-process. Keep acceptance scenarios asserting only through `actor.ui`. Live Playwright (`check:browser`) can reuse the same scenarios with `ui: 'playwright'`.

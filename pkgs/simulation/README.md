# `@pkgs/simulation`

Application-agnostic **multi-actor UI simulation** for acceptance tests.

- **UI is the only assertion surface** — interact via `@pkgs/ui-testing` `Driver` methods (`tap`, `expect.visible`, …) with plain `testId` strings.
- **Exclusive objects and methods** — scenarios call `Simulation.open`, `sim.actor`, `alice.ui.*`. No free helpers and no route/deep-link APIs on actors.
- **Full system is opaque** — inject a `SimulationSystem` class that boots whatever stack you need (in-process fakes, real HTTP, etc.).
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

Package UI demos run under Jest + `jest-expo` + RNTL (no Bun `mock.module`,
no `react-native` → web remapping). Non-UI unit tests stay on Bun.

## Quick start

```ts
import { Simulation } from '@pkgs/simulation';

await using sim = await Simulation.open({
  seed: 1,
  system: new MySimulationSystem(), // you implement SimulationSystem
  // ui: 'in-process' (default) | 'playwright'
});

const alice = await sim.actor('alice');
const bob = await sim.actor('bob');

await alice.ui.tap('create');
await bob.ui.expect.visible('shared-title');
await bob.ui.expect.text('shared-title', 'Game night');
```

## Ports: plug in your system

```ts
import type { SimulationSystem, SimulationStartContext } from '@pkgs/simulation';
import type { AppHarness } from '@pkgs/ui-testing';

class MySimulationSystem implements SimulationSystem {
  async start(ctx: SimulationStartContext) {
    // ctx.io (createSimIo bag: clock/timers/createId/random/http)
    // ctx.rng / ctx.ui
    // Boot shared backend here (DBs, in-proc servers, fakes, …).
    return {
      async createSession(actorId: string) {
        const harness: AppHarness = {
          createRoot: () => /* your app root for this actor */,
        };
        return {
          ui: 'in-process' as const,
          harness,
          dispose: async () => {
            /* tear down session */
          },
        };
      },
      async dispose() {
        /* tear down shared backend */
      },
    };
  }
}
```

For `ui: 'playwright'`, each session must return `{ ui: 'playwright', page, baseUrl?, dispose }` instead of a harness. Scenarios still only see `actor.ui: Driver`.

## Driver matrix

| `ui` | Meaning |
|------|---------|
| `in-process` (default) | React Native tree via `@pkgs/ui-testing` InProcessDriver + RNTL |
| `playwright` | Injected Playwright `Page` via PlaywrightDriver |

Closeness to production is chosen by **which `SimulationSystem` you pass** and the `ui` kind — not by leaking lower-level APIs into tests.

## Determinism

- `seed` → `createSimIo({ seed })` bag on `ctx.io` (virtual clock + seeded ids/random)
- Extra `ctx.rng` for system-side forks
- Re-run the same seed + system for reproducible actor scheduling on your side
- Prefer injecting `ctx.io` into app providers (`IoProvider` / sync factories)

## Step reports (HTML timeline)

Pass `report: true` (or `{ store, testId, runId? }`) to write **report data** on
`dispose()`. Every Driver mutation / `wait` / `expect.*` is a timeline
step. `wait` / `expect.*` and `sim.step` also poll change-gated UI frames while they run.
`isVisible` / `getText` are not recorded.

```ts
import { createNodeFsObjectStore } from '@pkgs/object-store/impl-node-fs';
import { Simulation } from '@pkgs/simulation';
import { resolveLocalReportDataDir } from '@pkgs/simulation-report';

const store = createNodeFsObjectStore({
  rootDir: resolveLocalReportDataDir(), // <repo>/simulation-report-data
});

const sim = await Simulation.open({
  seed: 1,
  system: new MySimulationSystem(),
  report: {
    store,
    runId: process.env.SIM_REPORT_RUN_ID, // optional; default UTC stamp
    testId: 'my-scenario',
  },
});
// …taps / types…
await sim.dispose();
```

Artifacts (data only — viewer is separate):

```text
simulation-report-data/   # repo root, gitignored
  runs/index.json
  runs/<runId>/manifest.json
  runs/<runId>/snapshot-shell.css
  runs/<runId>/tests/<testId>/steps.json
  runs/<runId>/tests/<testId>/frames/f-….html
```

View with `@apps/simulation-report`:

```bash
bun run --filter @pkgs/simulation-report build
bun run --filter @apps/simulation-report dev
# http://127.0.0.1:7789/b/local/r/<runId>/t/my-scenario
```

Re-run tests to refresh data; the SPA does not need a rebuild. Optional
`await sim.step('label', fn)` adds a human milestone (with frame polling).
`sim.reportPath` is the object-store key for the per-test `steps.json` after flush.

## What not to do

- Do not assert against sync engines, mutation clients, SQL, or HTTP from scenarios
- Do not deep-link / open routes from scenarios (`actor.open` does not exist)
- Do not put product DSLs (spaces, chess, …) in this package — build them on `Driver` in your app/test package
- Do not import `@pkgs/sync-engine` here

## Product consumer

Wire a product `SimulationSystem` class in a feature or test package that boots the real app stack in-process. Keep acceptance scenarios asserting only through `actor.ui`.

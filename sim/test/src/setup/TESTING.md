# Sim tests (DST)

Product system graph lives in `@libs/runtime`. Open a world with `openSim` from
`sim/test/src/setup/open-sim.ts` — a thin wrapper over framework
`openWorld(defineProductSystem(…))` (`sim/test/src/scenario/`). The product system
uses `defineScenario` with `node` / `knob` / `command` + optional `extend` (kit
surface merged onto the opened world). Playground still calls `createSim`
directly as a wall composition root; `createSim` accepts injected `ports` from
`@pkgs/dst` (`createWorldPorts`: clock, scheduler, timers, rng, trace) so
the same boot path works inside the `product.sim` node kind.

**Authoring** — scenarios import `describe` from `@pkgs/ui-testing` and pass
`ctx` into `openSim(testId, ctx)`. Never import `@jest/globals` / `@playwright/test`
in scenario files.

```tsx
import { describe } from '@pkgs/ui-testing';
import { openSim } from '../setup/open-sim';

describe('space create', (ctx) => {
  ctx.test('host creates a space', async () => {
    await using sim = await openSim('space-create', ctx);
    // AppDriver …
  }, 30_000);
});
```

**SQL fabric** (`SIM_SQL_BACKEND=real|mem`, default **`real`**):

- `real` — server **PGlite** + client **better-sqlite3** (Jest/Node) or
  **bun:sqlite** when `Bun` is present; playground browser clients use
  **SQLite WASM**. Seed:
  `sim/test/.cache/sim-backend-seed.pglite.bin`
- `mem` — legacy **postgres-mem** + **sqlite-mem**. Seed:
  `sim/test/.cache/sim-backend-seed.pgmm.json`

Engine selection is only in `@sim/console` `getSimSqlFabric()` — not in product
libs. Playground web loads PGlite/SQLite WASM from
`sim/console/public/generated/` (`bun run --filter @sim/console bundle:sim-sql-wasm`;
wired into `predev` / `setup`) so Metro's Hermes classic bundle never sees
`import.meta`.

**System snapshots** (committed fixtures; infrastructure only — scenarios still use UI setup):

- One JSON file per world under `sim/test/fixtures/snapshots/<id>.json`
  (portable logical dump: server/client SQL rows + client KV + rooms + clock).
- `openSim(id, ctx, { snapshot: 'signed-in-alice' })` restores a fixture (not wired in
  scenario tests yet).
- Regenerate after schema or DSL changes:
  `bun run --filter @sim/test snapshot` (separate Jest config; not part of `test`).
- Stale `localSchemaVersion` fails restore with instructions to re-run `snapshot`.

Builders live in `sim/test/src/snapshots/builders/` (same AppDriver DSL as scenarios).
Catalog: `signed-in-alice`, `signed-in-pair`, `friends-pair`, `both-in-space`.

**Fidelity** (`ctx.fidelity` from the installed runner, or `openSim` options for snapshot builders):

| Tier | Command | Host | UI driver | System |
| --- | --- | --- | --- | --- |
| `sim` (default) | `bun run --filter @sim/test test` | Jest + jest-expo | RNTL in-process | Seed PGlite/SQLite; in-process Hono `fetch` |
| `max` | `bun run --filter @sim/test test:max` | Playwright Test | Playwright (one context per actor) | Real Postgres + MinIO/EMQX; Hono on loopback HTTP; Expo web on `:5173` |

- **`sim`** — world mesh (`partition`, crash) is first-class. Server schema is migrated
  **once** into the seed file (Jest `globalSetup` /
  `bun run --filter @sim/test seed:sim-db`); each `openSim` clones that seed
  instead of re-running DDL.
- **`max`** — world-mesh scenarios skip when `ctx.fidelity !== 'sim'`. Sidecars boot via
  `playwright.global-setup.mjs` → `ensureMaxFidelityStack`. Each `openSim` listens the
  sim Hono app on `127.0.0.1:8787` and drives the exported web client. Build the web
  bundle first: `EXPO_PUBLIC_API_URL=http://127.0.0.1:8787 bun run --filter @apps/client build`.
  Snapshot auth KV is injected per actor page before hydrate.

**Reports** (`SIM_REPORT`):

- Default: off in Jest (`SIM_REPORT=0`) for speed; leaves any existing dump under
  `sim/console/public/reports` in place (header shows the run's `updatedAt`
  timestamp so age is obvious).
- Set `SIM_REPORT=1` (or `bun test:sim:report`) to wipe + rewrite HTML frames.

View captured timelines in **`bun run dev`** (`@sim/console` → Reports).
Production browsing of reports stays on the API Worker `/sim-console` mount
(B2).

Mem-engine wishlist (when `SIM_SQL_BACKEND=mem`):
[`docs/sim-mem-engine-wishlist.md`](../../../docs/sim-mem-engine-wishlist.md).

Do not use a local Wrangler + API Worker stack for manual feature work. That is
CI / production, not `bun dev`.

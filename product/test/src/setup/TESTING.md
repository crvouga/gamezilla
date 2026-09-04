# Sim tests

Product system + fabric live in **`@product/sim`**. Hosts are registered
runtimes on that System:

| Host name | Factory | Command | UI | SQL / HTTP |
| --- | --- | --- | --- | --- |
| `in-process` (default) | `inProcessRuntime` | `bun run --filter @product/test test` | React tree (RNTL under bun:test; embedded `App` in playground) | Seed PGlite/SQLite; in-process Hono `fetch`; caps include `partition` |
| `bun-webview` | `bunWebviewRuntime` | `SIM_MODE=real` / `bun run --filter @product/test test:max` | `Bun.WebView` per actor (tests); playground embeds actor **URL** (iframe) | Seed SQL + model network by default; `SIM_MODE=real` uses real Postgres + MinIO/EMQX and no `partition` cap. Hono on loopback HTTP via `listenSimHttpServer` |

Open a run with `openSim` from `product/test/src/setup/open-sim.ts` — a thin
helper over `product.run({ seed, runtime })` (plus snapshot restore + reporter).
Host name is `in-process` unless `SIM_MODE=real` / `{ mode: 'real' }` (then
`bun-webview`). Standing properties (`noErrorBoundary`) are registered with
`product.property`.

Playground (`@product/console`) also calls `product.run` only — default
`runtime: 'in-process'`; optional `bun-webview` when a localhost web sidecar is up.
Neither console nor test opens a Session / `createSim` outside `@product/sim`.

**Authoring** — scenarios import `describe` / `test` from `bun:test` and call
`openSim(testId)`. Drive UI with named `defineAction`s from `@product/sim`
(`s.apply(signInWithDev, 'alice')`). Explore still uses `spawnActor` / `uiOp` /
`partition`. Scenario actions are `pool: false`. Reads are plain functions of `S`.

```tsx
import { describe, test } from 'bun:test';
import { openSim } from '../src/setup/open-sim';
import { createSpace, returnToTabs, signInWithDev } from '../src/sim';

describe('space create', () => {
  test('host creates a space', async () => {
    await using s = await openSim('space-create');
    await s.apply(signInWithDev, 'alice');
    await s.apply(returnToTabs, 'alice');
    await s.apply(createSpace, 'alice');
  });
});
```

Faults (partition / restoreNetwork) are `defineAction`s gated by the `caps` read.
On the bun-webview real-mode host (no `partition` cap), `s.apply(partition, …)`
throws `ActionNotEnabled`.

**SQL fabric** (`SIM_SQL_BACKEND=real|mem`, default **`real`**):

- `real` — server **PGlite** + client **better-sqlite3** (Node) or
  **bun:sqlite** when `Bun` is present; playground browser clients use
  **SQLite WASM**. Seed:
  `product/test/.cache/sim-backend-seed.pglite.bin`
- `mem` — legacy **postgres-mem** + **sqlite-mem**. Seed:
  `product/test/.cache/sim-backend-seed.pgmm.json`

Engine selection lives in `@product/sim` (`getSimSqlEngines` / fabric) — not in
product libs. Playground web loads PGlite/SQLite WASM from
`product/console/public/generated/` (`bun run --filter @product/console bundle:sim-sql-wasm`;
wired into `predev` / `setup`) so Metro's Hermes classic bundle never sees
`import.meta`. Seed with `bun run --filter @product/sim seed:sim-db` (also
aliased from `@product/test`).

**System snapshots** (committed fixtures; infrastructure only — scenarios still use UI setup):

- One JSON file per snapshot under `product/test/fixtures/snapshots/<id>.json`
  (portable logical dump: server/client SQL rows + client KV + rooms + clock).
- `openSim(id, { snapshot: 'signed-in-alice' })` restores a fixture (not wired in
  scenario tests yet).
- Regenerate after schema or DSL changes:
  `bun run --filter @product/test snapshot` (not part of `test`).
- Stale `localSchemaVersion` fails restore with instructions to re-run `snapshot`.

Builders live in `product/test/src/snapshots/builders/` (same `s.apply` actions as scenarios).
Catalog: `signed-in-alice`, `signed-in-pair`, `friends-pair`, `both-in-space`.

**Host details**

- **`in-process`** — the network mesh (`partition`) is first-class. Server schema is migrated
  **once** into the seed file (`bun run --filter @product/sim seed:sim-db`); each
  `openSim` clones that seed instead of re-running DDL.
- **`bun-webview`** — wall time. Default: model network + seed SQL.
  `listenSimHttpServer` binds Hono on `127.0.0.1:8787` and enforces createSimNet
  crash/partition (actor id via `x-sim-actor`). Tests drive `Bun.WebView`;
  playground embeds the web origin URL. `SIM_MODE=real` boots sidecars via
  `ensureMaxFidelityStack` (real Postgres + MinIO/EMQX), serves Expo web
  (`e2e/serve-max-web.ts`), and does not enable `partition`. Snapshot auth KV
  is injected per actor WebView before hydrate.

**Reports** (`SIM_REPORT`):

- Default: off (`SIM_REPORT=0`) for speed; leaves any existing dump under
  `product/console/public/reports` in place (header shows the run's `updatedAt`
  timestamp so age is obvious).
- Set `SIM_REPORT=1` (or `bun test:sim:report`) to wipe + rewrite HTML frames.

View captured timelines in **`bun run dev`** (`@product/console` → Reports).
Production browsing of reports stays on the API Worker `/sim-console` mount
(B2).

Mem-engine wishlist (when `SIM_SQL_BACKEND=mem`):
[`docs/sim-mem-engine-wishlist.md`](../../../docs/sim-mem-engine-wishlist.md).

Do not use a local Wrangler + API Worker stack for manual feature work. That is
CI / production, not `bun dev`.

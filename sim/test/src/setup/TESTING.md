# Sim tests (DST)

Product system graph lives in `@libs/runtime`. Open a world with `openSim` from
`sim/test/src/setup/open-sim.ts`.

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
wired into `predev` / `setup`) so Metro’s Hermes classic bundle never sees
`import.meta`.

**Fidelity** (`openSim(id, { fidelity })` or `SIM_FIDELITY`):

- `sim` (default) — fabric above + in-memory leaves / RNTL driver.
  World mesh (`partition`, crash) is first-class. Server schema is migrated
  **once** into the seed file (Jest `globalSetup` /
  `bun run --filter @sim/test seed:sim-db`); each `openSim` clones that seed
  instead of re-running DDL.
- `max` — `SIM_FIDELITY=max` / `bun run --filter @sim/test test:max`.
  World-mesh scenarios skip. Server is embedded real Postgres via
  `tools/scripts/boot-local-stack.ts` (plus MinIO/EMQX when needed). Clients
  still use the fabric’s real SQLite path. Playwright needs an injected page
  (`PLAYWRIGHT_BASE_URL` / driver wiring); default max still uses the
  rntl driver until that URL is set.

**Reports** (`SIM_REPORT`):

- Default: on — HTML frames land under `sim/console/public/reports` /
  `runs/latest_run/` and show in **`bun run dev`** → Reports.
- Set `SIM_REPORT=0` to skip frame I/O (faster suite; console stays empty).

View captured timelines in **`bun run dev`** (`@sim/console` → Reports).
Production browsing of reports stays on the API Worker `/sim-console` mount
(B2).

Mem-engine wishlist (when `SIM_SQL_BACKEND=mem`):
[`docs/sim-mem-engine-wishlist.md`](../../../docs/sim-mem-engine-wishlist.md).

Do not use a local Wrangler + API Worker stack for manual feature work. That is
CI / production, not `bun dev`.

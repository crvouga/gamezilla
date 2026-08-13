# DST / UI simulation testing

In-process API DB is **SQLite** (`boot-sim-sqlite`). Prod still uses Postgres;
the same portable app SQL runs on both.

Migrated schema is cached at `test/ui/.cache/sim-backend-seed.sqlite` (gitignored).
A fingerprint of [`migrate-sim-sqlite.ts`](./migrate-sim-sqlite.ts) decides when to
rebuild. Each `Simulation.open` clones that seed into `:memory:` (or restores the
shared process handle) instead of re-migrating — warm with
`bun run --filter @test/ui seed:sim-db` if desired.

Three layers. Keep them separate so copy renames and layout tweaks do not
rewrite scenarios.

```text
scenarios/*.sim.test.tsx
  → AppDriver / AuthFlows / ProfileFlows   (intent journeys under src/drivers/)
    → @pkgs/ui-testing Driver              (testId-only; ui.expect.*)
product UI
  → testID={Handles.*} from @libs/dst-handles
```

Agnostic boot helpers live in `@pkgs/simulation` (seeded SQLite, timing, serialized
HTTP). Store DDL lives in `@pkgs/kv` / `@pkgs/entity-store`. Instance factories
live in `@apps/api` (`createSimApiApp`) and `@apps/client` (`createClientApp`).

## Runner boundary (do not blur)

| Suite | Runner | Where |
|-------|--------|--------|
| Product UI DST (`*.sim.test.tsx`) | **jest-expo** (`--runInBand`) | `@test/ui` only |
| In-process RNTL / demo UI | **jest-expo** | `@pkgs/ui-testing`, `@pkgs/simulation` |
| Pure logic / unit | **`bun:test`** | libs / pkgs (not this package) |

`@test/ui` is DST-only: `jest.config.cjs` `testMatch` is
`src/scenarios/**/*.sim.test.ts(x)`. Do **not** add RN component unit tests or
Vitest here — `ClientSimulationSystem` mounts real `ExpoRoot` via RNTL and needs
the RN Jest env + Babel pipeline (Lingui macros, `jsx-source-attr`, stubs).

Why `--runInBand`: one process shares diverted `fetch`, in-memory SQLite, and the
simulation-report `runId` marker keyed by `process.pid`. Parallel workers would
race those globals.

Jest transform cache lives at `test/ui/.cache/jest` (gitignored). CI restores it
via `.github/actions/jest-cache` on `check-gates` / `check-verify`. Locally, warm
reruns reuse that directory automatically.

`transformIgnorePatterns` come from
`@pkgs/ui-testing/jest-transform-ignore.cjs` (Bun-nested allowlist) — do not
revert to “transform all of `node_modules`”.

## What changes where

| Change | Touch |
|--------|--------|
| Button copy / a11y label / layout | Product UI only (scenarios stay green if handles stay put) |
| New control must be addressed | Add `Handles.*` in `@libs/dst-handles`, pass `testID={Handles.*}` in product UI, use it from a flow |
| New multi-step journey | Add / extend a flow under `src/drivers/` |
| New behavior under test | Add a scenario that calls `AppDriver` only |

## Simulation report

`openSim` stamps one `runId` per Jest process (shared across scenario files) so
all tests from `bun run --filter @test/ui test` appear under a single run in
`@apps/simulation-report`. Override with `SIM_REPORT_RUN_ID` for cross-process
suites.

Each kept UI frame dumps **every live actor’s HTML** (`views[]`) plus
**server + every actor** SQLite (`serialize()` → gzip, content-hash dedup).

In the report player:

- Bottom **timeline** + transport scrub frames.
- **Node tabs** (`?node=`) split HTML | SQLite per actor/server.
- SQLite pane defaults to **Diff** (prev↔current); switch to **Query** for Monaco.
- Acting-actor HTML highlights the step’s `testId("…")` target.

## Rules (CI)

- **Scenarios** must not import `@pkgs/ui-testing` (Biome) and must not call `by.*` (`ci:dst-selector-discipline`).
- **Drivers** (`src/drivers/**`) must not use `by.text` / `by.nth` / `by.role` / `by.label` — only `Handles` + `Driver` testIds.
- **Package contents:** only `*.sim.test.ts(x)` under `src/scenarios/` (enforced by Jest `testMatch`; do not add other `*.test.*` here).

## Adding a scenario

1. Copy [`new-sim-test.template.ts`](../fixtures/new-sim-test.template.ts) into `src/scenarios/<name>.sim.test.tsx`.
2. Prefer existing `app.auth.*` / `app.profile.*` flows.
3. If a step is missing, add a flow method that uses `Handles` + `Driver` — do not reach for `by.*` in the scenario.

## Adding a handle

1. Add the id to `Handles` in `@libs/dst-handles`.
2. Thread `testID` on the product control (and on `@pkgs/ui` primitives if the prop is missing).
3. Reference `Handles.foo` from a driver — never hard-code the string in scenarios.

# Agent Notes

## Hard Rules

- **Never patch dependencies.** Do not use `bun patch`, `patch-package`, `pnpm patch`, or any other dependency-patching mechanism. Do not add a `patches/` directory or a `patchedDependencies` / `pnpm.patchedDependencies` / `resolutions` field to `package.json`. If a third-party library has a bug, work around it in our own code or accept the behavior — never fork the dep in-tree. CI enforces this via `bun run check:no-patches`.

- **Never disable structural size limits for app code.** The Tiger-Style caps in `pkgs/eslint-rules/size-limits.cjs` (`max-lines`, `max-lines-per-function`, `max-statements`, `max-depth`, `max-params`, `max-nested-callbacks`, `complexity`, `max-classes-per-file`, `max-statements-per-line`) are load-bearing. Do **not** add per-file `'off'` overrides in any `{apps,libs,pkgs}/*/eslint.config.js`, and do **not** add `/* eslint-disable max-lines-per-function */` (or sibling) comments in source files. If a function tripped the cap, refactor it: extract sub-components, helper hooks, or pure helpers. The cap is the constraint, not a suggestion. The only legitimate exemption is `testOverrides()` (already wired in via the shared base config). Run `bun run scripts/check-no-size-limit-overrides.ts` to scan for offenders.

## CI / Turbo Remote Cache

GitHub Actions runs checks with `DOPPLER_CONFIG=local`. Caching is backed by **Vercel Remote Caching** — ensure the Doppler **`local`** config defines `TURBO_TOKEN` (a [Vercel Access Token](https://vercel.com/account/tokens) scoped to the team) and `TURBO_TEAM` (the Vercel team slug). The optional knobs `TURBO_CACHE` (default `remote:rw`), `TURBO_LOG_ORDER`, and `TURBO_TELEMETRY_DISABLED` are derived defaults populated by `infra provision`. The values are mirrored from the active config to `local` automatically (see `mirrorSharedToLocal` in `libs/infra/src/cli/resources/doppler.ts`). `bun run check:ci` passes `--concurrency=6 --cache-workers=2 --cache=local:rw,remote:r` to every Turbo invocation: fewer parallel tasks and serialized cache HTTP (default 10 workers) stay under Vercel's artifact API rate limit, and CI reads the shared remote cache without uploading new artifacts (Doppler still defaults to `remote:rw` for `bun run dev` and other commands). Occasional `429` warnings are benign cache misses; if they persist, lower `--cache-workers` to `1`.

The previous self-hosted Cloudflare Worker cache (Worker `gamezilla-turbo-cache`, R2 bucket `turborepo-cache`, the WAF bot-skip rule, and the `TURBO_API` Doppler key) is torn down but the resource code stays in the registry with `routineStatus: 'destroyed'` — the Worker (`turbo-cache-worker.ts`), the bucket (`TurboCacheBucketResource` in `r2-buckets.ts`), and the WAF rule (`turbo-cache-waf-bot-skip-rule.ts`). Routine `provision` / `dryRun` / `deploy-resources` skip `'destroyed'` resources; `infra deploy` ends with a tail phase that walks every `'destroyed'` resource in reverse topological order (Worker → bucket → rule) and calls its existing `destroy()` so the cloud converges on the registry's intent (`'created'` resources up, `'destroyed'` resources gone) on every production deploy. Every `Resource.destroy()` is required to be idempotent so the phase is a no-op once the stack is fully cleaned up. To bring the self-hosted stack back online, flip `routineStatus` to `'created'` on those three resources and rerun `infra deploy`.

For local development without Doppler, run `bunx turbo login` + `bunx turbo link` to write a personal `.turbo/config.json`.

## CI/CD job layout

The deployment pipeline (`.github/workflows/deployment-pipeline.yml`) follows three rules:

1. **Turbo-cacheable tasks run inside one `turbo-ci` job.** Format, syncpack + catalog + no-patches, knip, depcruise, circular-deps, audit, i18n, plus per-package `tc` / `lint` / `test` / `build` all live under root `ci:*` scripts and per-package tasks in `turbo.json`. CI invokes them with `bun run check:ci` so Turbo's task graph + Vercel Remote Cache (via the Doppler-injected `TURBO_TOKEN` + `TURBO_TEAM`) handle ordering and reuse with zero extra YAML. Root `turbo.json` sets `"ui": "stream"` (not `tui`) so CI logs stream live — `bun run dev` still passes `--ui=tui`. `check:ci:turbo` runs `@apps/client setup` first so `expo lint` has `.env.local`.
2. **Non-Turbo tasks get their own job only when they need a different runner shape.** `static` runs actionlint + gitleaks (gitleaks needs `fetch-depth: 0`); `qa-api` and `qa-browser` need Playwright browsers and artifact uploads.
3. **The production deploy is one atomic `deploy` job.** A single checkout + `infra-setup` runs `bun run infra deploy`, which holds the PlanetScale-backed global lock in-process across every phase (provision → migrate → deploy-resources → stripe-sync → smoke → refresh-config → ensure-destroyed). A tiny always-run `lock-release` job is the safety net for crashed / cancelled deploys.

When adding a new check, default to a turbo task under `ci:*` (or extend an existing one). Only carve out a new GitHub Actions job if the check truly needs a unique runner shape.

## Local database

Local dev runs a **real PostgreSQL cluster** managed by `@pkgs/postgres` — no Docker, no PGlite. The wrapper spawns `postgres` directly (in our process group, so it can never be orphaned by the dev shell), waits on `pg_isready`, and translates `SIGINT`/`SIGTERM` from `turbo dev` into a `pg_ctl stop -m fast`. Required CLI tooling (`postgres`, `pg_ctl`, `initdb`, `pg_isready`) is enforced by `bun run infra setup` / `status` via the `PostgresDep` class.

The whole stack starts together via `bun run dev` at the repo root; to run just Postgres (foreground, logs visible): `bun run --filter @pkgs/postgres dev`. Stop it with `bun run --filter @pkgs/postgres kill` — this targets only our wrapper PID + cluster data dir; it will **not** terminate unrelated Postgres servers that happen to be on the same port. To wipe every database in the managed cluster (stop + delete `pkgs/postgres/.postgres/` so the next `dev` reinitializes from scratch): `bun run --filter @pkgs/postgres drop`.

Set Doppler **`local`** `DB_URL` to `postgres://postgres:postgres@127.0.0.1:5432/postgres?sslmode=disable`. Migrations: `DOPPLER_CONFIG=local doppler run -- bun run --filter @apps/api db:migrate`. Persistent data lives in `pkgs/postgres/.postgres/data/`; the wrapper PID and a tee'd `postgres.log` live in `pkgs/postgres/.postgres/run/`. Tunables (all optional): `PG_HOST`, `PG_PORT`, `PG_DATA_DIR`, `PG_USER`, `PG_PASSWORD`, `PG_DATABASE`, `PG_BIN_DIR` (force a specific Postgres install).

The wrapper also auto-launches the [`pgweb`](https://github.com/sosedoff/pgweb) GUI as a sibling foreground process (default `http://127.0.0.1:5555` — chosen to sit next to the Postgres port and avoid collisions with Expo Web on `8081` / Jupyter on `8888`), pre-connected to the local DB. Stops with the cluster on Ctrl-C / `turbo dev` shutdown — no orphans. GUI failure (missing binary, port collision) is non-fatal: a warning logs and the cluster keeps running. Required tool: `pgweb` (Homebrew: `brew install pgweb`), enforced by `bun run infra setup` via the `PgwebDep` class. Tunables: `PG_GUI` (set to `off`/`0`/`false` to skip; default off in CI), `PG_GUI_HOST`, `PG_GUI_PORT`, `PG_GUI_BIN`.

Platform support:

- **macOS / Linux** — install Postgres (`brew install postgresql@17` on macOS; `apt-get install postgresql` on Debian/Ubuntu, etc.) and pgweb (`brew install pgweb`); run `bun run dev` directly.
- **Windows** — run dev inside WSL2; native Windows is not supported by `@pkgs/postgres` (the lifecycle script still produces a clear error message + install hint if invoked there).

## Per-feature package layout

Workspace packages live under three top-level tier directories with matching npm scopes — pick the tier that fits the package's role:

| Tier | Path    | Scope    | Contains                                                           |
| ---- | ------- | -------- | ------------------------------------------------------------------ |
| Apps | `apps/` | `@apps/` | Deployed product surfaces (`client`, `api`).                       |
| Libs | `libs/` | `@libs/` | Product-flavored reusable code (`chess`, `auth`, `spaces`, …).     |
| Pkgs | `pkgs/` | `@pkgs/` | Agnostic utilities, framework, CLIs, dev infra, runnable examples. |

Inside each one, runtimes are isolated by three flat sibling folders — no deeper nesting:

```
<tier>/<name>/
  package.json          # name "@<tier>/<name>", subpath-pattern `exports`
  tsconfig.json         # extends ../../tsconfig.json
  eslint.config.js      # createSharedBlocks + linguiRules
  src/
    client/             # React Native / Expo
    server/             # Cloudflare Worker / Hono
    shared/             # isomorphic — entities, ports, pure logic
```

Cross-package imports always use deep paths: `@<tier>/<name>/client/<file>`, `@<tier>/<name>/server/<file>`, `@<tier>/<name>/shared/<file>`. The `exports` field uses one Node subpath pattern per runtime folder (with `.ts` / `.tsx` array fallback) so adding/removing/renaming a file requires zero `package.json` change while bundlers still see one module per import site:

```jsonc
"exports": {
  "./client/*": ["./src/client/*.ts", "./src/client/*.tsx"],
  "./server/*": ["./src/server/*.ts", "./src/server/*.tsx"],
  "./shared/*": ["./src/shared/*.ts", "./src/shared/*.tsx"]
}
```

Do **not** add `index.ts` barrels that mix `client` / `server` / `shared` (Metro / Wrangler need per-runtime resolution to drop the wrong runtime from the bundle). A per-runtime `client/index.ts` / `server/index.ts` / `shared/index.ts` is fine when there's a real reason to expose a curated facade (see `libs/auth/src/server/index.ts`); add it as an explicit `"./server": "./src/server/index.ts"` entry alongside the wildcard.

Flat (runtime-agnostic) packages — the per-utility micro-packages (`@pkgs/assert`, `@pkgs/keyword`, `@pkgs/kv`, …), `ui`, `api`, `patch-db`, `patch-db-example`, `room-example`, `stripe` — use a single pattern that also resolves bare folder imports via per-folder `index.ts`:

```jsonc
"exports": {
  "./*": ["./src/*.ts", "./src/*.tsx", "./src/*/index.ts"]
}
```

Within a feature package, prefer **relative** imports between sibling files (`./foo`, `../shared/bar`); use the `@<tier>/<name>/...` alias only for imports from a different feature package.

Feature-specific scripts (seeders, dev refreshers, migration runners) live in `<tier>/<name>/scripts/` and are wired up via the package's `scripts` block in `package.json` (e.g. `bun run --filter @libs/<name> seed:<x>`). Lint targets `eslint src` so script files use Tiger-style structure but keep the freedom to grow long top-level orchestrators. Add `./scripts/**/*.ts` to the package `tsconfig.json` `include` and the root `tsconfig.json` `include` so type-checking covers them.

`apps/client/src/app/**` (Expo Router) and `apps/api/src/api.ts` (worker entry) stay as 1-line re-export stubs that point at the feature packages — that keeps URL routes and the `Room` Durable Object class binding stable.

### Current feature packages

- `@libs/auth` — sign-in flows, sessions, devices, account-scoped local SQLite (`account-db*`), Better Auth bootstrap + Postgres migrations runner.
- `@libs/chess` — chess board UI, puzzle play / picker, settings. The chess puzzle seeding script lives in `libs/chess/scripts/seed-chess-puzzles.ts` (run via `bun run chess:puzzles:seed`); it assumes the schema has already been migrated by `bun run db:migrate`.
- `@libs/client-config` — server-pushed runtime config (singleton `clientConfig` entity): shared entity defs, server `POST /client-config/refresh` route, client cards / screens, and `dev-refresh-client-config.ts`.
- `@libs/profile` — public profile, dicebear avatar editor, display-name generator.
- `@libs/spaces` — spaces / lobby / multiplayer plumbing, game dispatch via `space-module.ts`.
- `@libs/stripe` — Stripe routes, catalog mirror, webhook handler, ABAC policies for stripe entities (`abac-policies.ts`).

### Adding a new game

Each game is its own package modelled after `@libs/chess`. To add `@libs/connect-four` (or numberlink, tic-tac-toe, battleship, etc.):

1. Scaffold `libs/<game>/`:
   - `package.json` with `"name": "@libs/<game>"`, per-file `exports`, deps mirroring what the implementation actually imports (typically a granular subset of the `@pkgs/<util>` micro-packages — `assert`, `keyword`, `attribute`, etc. — plus `@pkgs/patch-db`, `@lingui/*`, `react`, `react-native`).
   - `tsconfig.json` extending root.
   - `eslint.config.js` copied from `libs/chess/eslint.config.js`.
   - Empty `src/{client,server,shared}/`.
2. Add path alias to root `tsconfig.json`: `"@libs/<game>/*": ["./libs/<game>/src/*"]` and the matching `include` entries.
3. Add the package's `src` directory to `lingui.config.cjs` `catalogs.include` so translatable strings are extracted.
4. Implement the game:
   - `shared/<game>-main-menu.ts` — `RoomModule` + `MainMenu` reducer (state, command/event router).
   - `shared/<game>-play.ts` — game-play reducer (moves, win/loss state).
   - `shared/<game>-entities.ts` — patch-db entity types if the game persists puzzles, sessions, leaderboards, etc.
   - `client/<game>-main-menu.tsx`, `client/<game>-board.tsx`, `client/<game>-settings-screen.tsx`, etc. — flat under `client/`.
5. Register the game in `libs/spaces/src/shared/games.ts` (composed game module) and `libs/spaces/src/shared/space-module.ts` (top-level router).
6. Register ABAC policies for any new entity types in `apps/api/src/patch-db/abac-policies-registry.ts`.
7. Wire the client entry in `libs/spaces/src/client/module/games-main-menu.tsx` so the new game shows up in the games list.

`apps/api` and `apps/client` themselves do **not** need to be edited beyond the registries above — game packages compose into spaces, and spaces is already wired into the shells.

### Layering rules (enforced by depcruise + ci:tier-imports)

**Tier pyramid** — one-way dependencies between tiers, enforced by `bun run ci:tier-imports` (authoritative; scans `@<tier>/<name>` imports + workspace `package.json` deps) and depcruise rules `pkgs-not-libs`, `pkgs-not-apps`, `libs-not-apps`:

```text
apps  →  libs, pkgs   (apps compose anything)
libs  →  pkgs only    (libs may not import apps)
pkgs  →  pkgs only    (leaf tier: reusable, app-agnostic)
```

`pkgs/` packages are the foundation: they must work in any monorepo, with no references to `gamezilla`, `apps/api`, `@libs/*`, or any product surface (in code, comments, or default config strings).

**Other layering rules:**

- `shared/` cannot import from `client/` or `server/` anywhere in the repo (`shared-pure`).
- Within and across feature packages, `client/` cannot import from `server/` and vice-versa (`client-not-server`, `server-not-client`).
- Every `@pkgs/<utility>` micro-package (`assert`, `keyword`, `attribute`, `message`, `kv`, `sql-client`, `logger`, etc.) stays runtime-agnostic and feature-agnostic — no imports from `spaces`, `chess`, or any other product package.
- `apps/client` cannot reach any feature's `server/`; `apps/api` cannot reach any feature's `client/` (`apps-client-no-server`, `apps-api-no-client`).

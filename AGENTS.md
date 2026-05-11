# Agent Notes

## Hard Rules

- **Never patch dependencies.** Do not use `bun patch`, `patch-package`, `pnpm patch`, or any other dependency-patching mechanism. Do not add a `patches/` directory or a `patchedDependencies` / `pnpm.patchedDependencies` / `resolutions` field to `package.json`. If a third-party library has a bug, work around it in our own code or accept the behavior — never fork the dep in-tree. CI enforces this via `bun run check:no-patches`.

## CI / Turbo Remote Cache

GitHub Actions runs checks with `DOPPLER_CONFIG=local`. For Turbo Remote Cache hits in CI, ensure the Doppler **`local`** config defines `TURBO_API`, `TURBO_TOKEN`, `TURBO_TEAM`, and `TURBO_CACHE` (e.g. `remote:rw`). See `packages/infra/src/cli/secrets/turbo-token.ts` for hints.

## Local database

Local dev runs a **real PostgreSQL cluster** managed by `@gamezilla/pg` — no Docker, no PGlite. The wrapper spawns `postgres` directly (in our process group, so it can never be orphaned by the dev shell), waits on `pg_isready`, and translates `SIGINT`/`SIGTERM` from `turbo dev` into a `pg_ctl stop -m fast`. Required CLI tooling (`postgres`, `pg_ctl`, `initdb`, `pg_isready`) is enforced by `bun run infra setup` / `status` via the `PostgresDep` class.

The whole stack starts together via `bun run dev` at the repo root; to run just Postgres (foreground, logs visible): `bun run --filter @gamezilla/pg dev`. Stop it with `bun run --filter @gamezilla/pg kill` — this targets only our wrapper PID + cluster data dir; it will **not** terminate unrelated Postgres servers that happen to be on the same port. To wipe every database in the managed cluster (stop + delete `packages/pg/.postgres/` so the next `dev` reinitializes from scratch): `bun run --filter @gamezilla/pg drop`.

Set Doppler **`local`** `DB_URL` to `postgres://postgres:postgres@127.0.0.1:5432/postgres?sslmode=disable`. Migrations: `DOPPLER_CONFIG=local doppler run -- bun run --filter @gamezilla/api db:migrate`. Persistent data lives in `packages/pg/.postgres/data/`; the wrapper PID and a tee'd `postgres.log` live in `packages/pg/.postgres/run/`. Tunables (all optional): `PG_HOST`, `PG_PORT`, `PG_DATA_DIR`, `PG_USER`, `PG_PASSWORD`, `PG_DATABASE`, `PG_BIN_DIR` (force a specific Postgres install).

The wrapper also auto-launches the [`pgweb`](https://github.com/sosedoff/pgweb) GUI as a sibling foreground process (default `http://127.0.0.1:5555` — chosen to sit next to the Postgres port and avoid collisions with Expo Web on `8081` / Jupyter on `8888`), pre-connected to the local DB. Stops with the cluster on Ctrl-C / `turbo dev` shutdown — no orphans. GUI failure (missing binary, port collision) is non-fatal: a warning logs and the cluster keeps running. Required tool: `pgweb` (Homebrew: `brew install pgweb`), enforced by `bun run infra setup` via the `PgwebDep` class. Tunables: `PG_GUI` (set to `off`/`0`/`false` to skip; default off in CI), `PG_GUI_HOST`, `PG_GUI_PORT`, `PG_GUI_BIN`.

Platform support:

- **macOS / Linux** — install Postgres (`brew install postgresql@17` on macOS; `apt-get install postgresql` on Debian/Ubuntu, etc.) and pgweb (`brew install pgweb`); run `bun run dev` directly.
- **Windows** — run dev inside WSL2; native Windows is not supported by `@gamezilla/pg` (the lifecycle script still produces a clear error message + install hint if invoked there).

## Per-feature package layout

Feature code lives in `packages/<name>/` workspace packages. Inside each one, runtimes are isolated by three flat sibling folders — no deeper nesting:

```
packages/<name>/
  package.json          # name "@gamezilla/<name>", per-file `exports`
  tsconfig.json         # extends ../../tsconfig.json
  eslint.config.js      # createSharedBlocks + linguiRules
  src/
    client/             # React Native / Expo
    server/             # Cloudflare Worker / Hono
    shared/             # isomorphic — entities, ports, pure logic
```

Cross-package imports always use deep paths: `@gamezilla/<name>/client/<file>`, `@gamezilla/<name>/server/<file>`, `@gamezilla/<name>/shared/<file>`. Every file gets an `exports` entry; do **not** add `index.ts` barrels across the runtime boundary (Metro / Wrangler need `exports` + tree-shaking to drop the wrong runtime from the bundle).

Within a feature package, prefer **relative** imports between sibling files (`./foo`, `../shared/bar`); use the `@gamezilla/<name>/...` alias only for imports from a different feature package.

Feature-specific scripts (seeders, dev refreshers, migration runners) live in `packages/<name>/scripts/` and are wired up via the package's `scripts` block in `package.json` (e.g. `bun run --filter @gamezilla/<name> seed:<x>`). Lint targets `eslint src` so script files use Tiger-style structure but keep the freedom to grow long top-level orchestrators. Add `./scripts/**/*.ts` to the package `tsconfig.json` `include` and the root `tsconfig.json` `include` so type-checking covers them.

`packages/client/src/app/**` (Expo Router) and `packages/api/src/api.ts` (worker entry) stay as 1-line re-export stubs that point at the feature packages — that keeps URL routes and the `Space` Durable Object class binding stable.

### Current feature packages

- `@gamezilla/auth` — sign-in flows, sessions, devices, account-scoped local SQLite (`account-db*`), Better Auth bootstrap + Postgres migrations runner.
- `@gamezilla/chess` — chess board UI, puzzle play / picker, settings. The chess puzzle seeding script lives in `packages/api/scripts/seed-chess-puzzles.ts` (run via `bun run chess:puzzles:seed`).
- `@gamezilla/client-config` — server-pushed runtime config (singleton `clientConfig` entity): shared entity defs, server `POST /client-config/refresh` route, client cards / screens, and `dev-refresh-client-config.ts`.
- `@gamezilla/profile` — public profile, dicebear avatar editor, display-name generator.
- `@gamezilla/spaces` — spaces / lobby / multiplayer plumbing, game dispatch via `space-module.ts`.
- `@gamezilla/stripe` — Stripe routes, catalog mirror, webhook handler, ABAC policies for stripe entities (`abac-policies.ts`).

### Adding a new game

Each game is its own package modelled after `@gamezilla/chess`. To add `@gamezilla/connect-four` (or numberlink, tic-tac-toe, battleship, etc.):

1. Scaffold `packages/<game>/`:
   - `package.json` with `"name": "@gamezilla/<game>"`, per-file `exports`, deps mirroring what the implementation actually imports (typically `@gamezilla/lib`, `@gamezilla/patch-db`, `@lingui/*`, `react`, `react-native`).
   - `tsconfig.json` extending root.
   - `eslint.config.js` copied from `packages/chess/eslint.config.js`.
   - Empty `src/{client,server,shared}/`.
2. Add path alias to root `tsconfig.json`: `"@gamezilla/<game>/*": ["./packages/<game>/src/*"]` and the matching `include` entries.
3. Add the package's `src` directory to `lingui.config.cjs` `catalogs.include` so translatable strings are extracted.
4. Implement the game:
   - `shared/<game>-main-menu.ts` — `RoomModule` + `MainMenu` reducer (state, command/event router).
   - `shared/<game>-play.ts` — game-play reducer (moves, win/loss state).
   - `shared/<game>-entities.ts` — patch-db entity types if the game persists puzzles, sessions, leaderboards, etc.
   - `client/<game>-main-menu.tsx`, `client/<game>-board.tsx`, `client/<game>-settings-screen.tsx`, etc. — flat under `client/`.
5. Register the game in `packages/spaces/src/shared/games.ts` (composed game module) and `packages/spaces/src/shared/space-module.ts` (top-level router).
6. Register ABAC policies for any new entity types in `packages/api/src/patch-db/abac-policies-registry.ts`.
7. Wire the client entry in `packages/spaces/src/client/games-main-menu.tsx` so the new game shows up in the games list.

`packages/api` and `packages/client` themselves do **not** need to be edited beyond the registries above — game packages compose into spaces, and spaces is already wired into the shells.

### Layering rules (enforced by depcruise)

- `shared/` cannot import from `client/` or `server/` anywhere in the repo (`shared-pure`).
- Within and across feature packages, `client/` cannot import from `server/` and vice-versa (`client-not-server`, `server-not-client`).
- `packages/lib` stays runtime-agnostic and feature-agnostic (`lib-no-features`).
- `packages/client` cannot reach any feature's `server/`; `packages/api` cannot reach any feature's `client/` (`apps-client-no-server`, `apps-api-no-client`).

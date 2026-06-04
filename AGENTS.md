# Agent Notes

## Hard Rules

- **Never patch dependencies.** Do not use `bun patch`, `patch-package`, `pnpm patch`, or any other dependency-patching mechanism. Do not add a `patches/` directory or a `patchedDependencies` / `pnpm.patchedDependencies` / `resolutions` field to `package.json`. If a third-party library has a bug, work around it in our own code or accept the behavior — never fork the dep in-tree. CI enforces this via `bun run check:no-patches`.

- **Never disable structural size limits for app code.** The Tiger-Style caps in `pkgs/eslint-rules/size-limits.cjs` (`max-lines`, `max-lines-per-function`, `max-statements`, `max-depth`, `max-params`, `max-nested-callbacks`, `complexity`, `max-classes-per-file`, `max-statements-per-line`) are load-bearing. Do **not** add per-file `'off'` overrides in any `{apps,libs,pkgs}/*/eslint.config.js`, and do **not** add `/* eslint-disable max-lines-per-function */` (or sibling) comments in source files. If a function tripped the cap, refactor it: extract sub-components, helper hooks, or pure helpers. The cap is the constraint, not a suggestion. The only legitimate exemption is `testOverrides()` (already wired in via the shared base config). Run `bun run scripts/check-no-size-limit-overrides.ts` to scan for offenders.

## `@pkgs/ui` design system

`@pkgs/ui` is the only design-system surface in the repo. Every component, prop type, hook, and theme helper is implemented in-house under `pkgs/ui/src/components/**` and re-exported from `pkgs/ui/src/index.ts`. There is no adapter indirection, no swappable backend, and no third-party UI library — consumers always do `import { Button, Text, useTheme } from '@pkgs/ui';` and the import resolves to the in-house implementation directly.

```
pkgs/ui/src/
  index.ts              # public API -- `export * from './components'` + theme/explorer/expo helpers
  components/           # one folder per component (button/, text/, modal/, ...)
  theme/                # design tokens + `useTheme` hook
  animation/            # cross-platform animation helpers
  expo/                 # `preventSplashAutoHide`, `hideSplash`
  explorer/             # storybook-style explorer screens
  svg/                  # SVG helpers
```

**Adding a new component:**

1. Implement it under `pkgs/ui/src/components/<name>/<name>.tsx` (and an `index.ts` re-export inside the folder).
2. Add the public export to `pkgs/ui/src/components/index.ts`.
3. `bun run --filter @pkgs/ui tc lint` verifies it wires up.

### Mutation UX

Every mutation should make its outcome obvious. Pick the surface by weight, not by feature:

- **Destructive or confirm-first mutations** (sign out, leave / end space, delete, rename, wipe DB) → `MutationModal`. It runs the whole `idle → loading → success / error` lifecycle in place: success is dismissible, errors are retryable. Thin wrappers (`EndSpaceConfirmModal`, `useSignOutConfirmationModal`, …) compose over it. Navigate from `onSuccess` only when the surface is a full screen; floating controls (the space miniplayer) skip navigation and let the UI react to the underlying state change.
- **Lightweight, no-confirm actions** (join space, create space, anything that today was a bare `void doThing()`) → `Button` with `useMutationButton`. The button itself flips to a spinner, then a success check, then a retryable error face — no extra dialog. Pass `onSuccess` (with `successHoldMs: 0` to navigate immediately, or the default brief hold to flash success first).
- **Screen form save / cancel** → `FormActionsFooter` in the `ScreenBase` `footer` slot, never header `actions`. On mobile it pins to the bottom above the safe-area inset; on wider screens it renders inline at the end of the form. The submit button is a `useMutationButton`, so saves show `Saving… → Saved` then run `onSuccess` (e.g. `router.back()`).
- **Card-level inline async** (admin refreshers) → the `client-config-server-refresh.tsx` pattern: `useAsync` + compact `SuccessState` / `ErrorState` beneath the button.

`useMutationButton` and `MutationModal` both build on `useMutationLifecycle`, so the phase semantics stay identical across modal and inline surfaces.

Centered modals (`ModalContent`, `ResponsiveSurface`, `ConfirmationModal`, `MutationModal`) use width buckets only: `size="small" | "medium" | "large" | "fullWidth"` (default `medium`). Confirm dialogs stay on `medium`; wide inspectors use `large`; near-edge layouts use `fullWidth`. Do not pass custom width via `style`.

## CI / Turbo Remote Cache

GitHub Actions runs checks with `DOPPLER_CONFIG=dev`. Caching is backed by **Vercel Remote Caching** — ensure the Doppler **`dev`** config defines `TURBO_TOKEN` (a [Vercel Access Token](https://vercel.com/account/tokens) scoped to the team) and `TURBO_TEAM` (the Vercel team slug). The optional knobs `TURBO_CACHE` (default `remote:rw`), `TURBO_LOG_ORDER`, and `TURBO_TELEMETRY_DISABLED` are derived defaults populated by `infra provision`. The values are mirrored from the active config to `dev` automatically (see `mirrorSharedToDev` in `libs/infra/src/cli/resources/doppler.ts`). The `turbo-ci` job runs `scripts/check-turbo-remote-cache.ts` under `doppler run` first (Doppler `dev` must expose `TURBO_TOKEN` + `TURBO_TEAM`; only `DOPPLER_TOKEN_SHARED` is a GitHub secret). The script rejects missing env, bad tokens, and Turbo’s `Remote caching unavailable` probe warning; without remote cache CI reruns every task cold (~10+ min) with misleading blank log lines. `bun run check:ci` invokes `scripts/turbo-ci-run.ts`, which passes `--concurrency=6 --cache-workers=1 --summarize --output-logs=hash-only --log-order=grouped` to every Turbo invocation: fewer parallel tasks and serialized cache HTTP stay under Vercel's artifact API rate limit. CI uses `--cache=local:rw,remote:rw` so later runs hit `cache hit` instead of cold `cache miss`; local `bun check` uses `remote:r` (read-only) to avoid upload 429s against the shared Vercel cache.

The previous self-hosted Cloudflare Worker cache (Worker `gamezilla-turbo-cache`, R2 bucket `turborepo-cache`, the WAF bot-skip rule, and the `TURBO_API` Doppler key) is torn down but the resource code stays in the registry with `routineStatus: 'destroyed'` — the Worker (`turbo-cache-worker.ts`), the bucket (`TurboCacheBucketResource` in `r2-buckets.ts`), and the WAF rule (`turbo-cache-waf-bot-skip-rule.ts`). Routine `provision` / `dryRun` / `deploy-resources` skip `'destroyed'` resources; `infra deploy` ends with a tail phase that walks every `'destroyed'` resource in reverse topological order (Worker → bucket → rule) and calls its existing `destroy()` so the cloud converges on the registry's intent (`'created'` resources up, `'destroyed'` resources gone) on every production deploy. Every `Resource.destroy()` is required to be idempotent so the phase is a no-op once the stack is fully cleaned up. To bring the self-hosted stack back online, flip `routineStatus` to `'created'` on those three resources and rerun `infra deploy`.

For local development without Doppler, run `bunx turbo login` + `bunx turbo link` to write a personal `.turbo/config.json`.

## CI/CD job layout

The deployment pipeline (`.github/workflows/deployment-pipeline.yml`) follows three rules:

1. **Turbo-cacheable tasks run inside one `turbo-ci` job.** Format, syncpack + catalog + no-patches, knip, depcruise, circular-deps, audit, i18n, plus per-package `tc` / `lint` / `test` / `build` all live under root `ci:*` scripts and per-package tasks in `turbo.json`. CI invokes them with `bun run check:ci` so Turbo's task graph + Vercel Remote Cache (via the Doppler-injected `TURBO_TOKEN` + `TURBO_TEAM`) handle ordering and reuse with zero extra YAML. Root `turbo.json` sets `"ui": "stream"` (not `tui`) so CI logs stream live — `bun run dev` still passes `--ui=tui`. `check:ci:turbo` runs `@apps/client setup` first so `expo lint` has `.env.local`.
2. **Non-Turbo tasks get their own job only when they need a different runner shape.** `static` runs actionlint + gitleaks (gitleaks needs `fetch-depth: 0`); `qa-api` and `qa-browser` need Playwright browsers and artifact uploads.
3. **The production deploy is one atomic `deploy` job.** A single checkout + `infra-setup` runs `bun run infra deploy`: provision and `db:migrate` run before the PlanetScale-backed global lock is acquired (avoids holding a direct slot during migrate); the lock then covers deploy-resources → stripe-sync → smoke → refresh-config → ensure-destroyed. `db:migrate` retries on Postgres `53300` / “too many clients”. A tiny always-run `lock-release` job is the safety net for crashed / cancelled deploys.

When adding a new check, default to a turbo task under `ci:*` (or extend an existing one). Only carve out a new GitHub Actions job if the check truly needs a unique runner shape.

## Local database

Local dev runs a **real PostgreSQL 18 cluster** managed by `@pkgs/postgres` — no Docker, no PGlite, **no system Postgres install**. The cluster binaries (`postgres`, `initdb`, `pg_ctl`) ship via the [`embedded-postgres`](https://github.com/leinelissen/embedded-postgres) npm package and are hydrated by `bun install` (the platform-specific `@embedded-postgres/*` binary packages are listed in the root `package.json` `trustedDependencies` so Bun runs their symlink post-install). The wrapper (`pkgs/postgres/src/embedded-cluster.ts`) drives `embedded-postgres`, which spawns `postgres` directly in our process group (so it can never be orphaned by the dev shell), resolves once the postmaster logs `database system is ready to accept connections`, and on `SIGINT`/`SIGTERM` from `turbo dev` performs a fast shutdown (escalating signals on the recorded `postmaster.pid` if it wedges). There is no `PostgresDep` to install.

The whole stack starts together via `bun run dev` at the repo root; to run just Postgres (foreground, logs visible): `bun run --filter @pkgs/postgres dev`. Stop it with `bun run --filter @pkgs/postgres kill` — this targets only our wrapper PID + cluster data dir; it will **not** terminate unrelated Postgres servers that happen to be on the same port. To wipe every database in the managed cluster (stop + delete `pkgs/postgres/.postgres/` so the next `dev` reinitializes from scratch): `bun run --filter @pkgs/postgres drop`.

Set Doppler **`dev`** `DB_URL` to `postgres://postgres:postgres@127.0.0.1:5432/postgres?sslmode=disable`. Migrations: `bun db:migrate` (the root script wraps `bun run --filter @apps/api db:migrate` in `DOPPLER_CONFIG=dev doppler run --` so the migrate script picks up the right project/config; without it, a globally-configured Doppler CLI token has no project/config bound and the secrets/download API returns HTTP 400). Persistent data lives in `pkgs/postgres/.postgres/data/`; the wrapper PID and a tee'd `postgres.log` live in `pkgs/postgres/.postgres/run/`. Tunables (all optional): `PG_HOST`, `PG_PORT`, `PG_DATA_DIR`, `PG_USER`, `PG_PASSWORD`, `PG_DATABASE`.

The wrapper also auto-launches the [`pgweb`](https://github.com/sosedoff/pgweb) GUI as a sibling foreground process (default `http://127.0.0.1:5555` — chosen to sit next to the Postgres port and avoid collisions with Expo Web on `8081` / Jupyter on `8888`), pre-connected to the local DB. Stops with the cluster on Ctrl-C / `turbo dev` shutdown — no orphans. GUI failure (missing binary, port collision) is non-fatal: a warning logs and the cluster keeps running. Required tool: `pgweb` (Homebrew: `brew install pgweb`), enforced by `bun run infra setup` via the `PgwebDep` class. Tunables: `PG_GUI` (set to `off`/`0`/`false` to skip; default off in CI), `PG_GUI_HOST`, `PG_GUI_PORT`, `PG_GUI_BIN`.

Platform support (only `pgweb` needs a manual install now; the Postgres binaries come from npm):

- **macOS / Linux** — install pgweb (`brew install pgweb`); run `bun run dev` directly.
- **Windows** — run dev inside WSL2; native Windows is not exercised by `@pkgs/postgres`.

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

Flat (runtime-agnostic) packages — the per-utility micro-packages (`@pkgs/assert`, `@pkgs/keyword`, `@pkgs/kv`, …), `ui`, `api`, `patch-db`, `patch-db-widgets`, `room-widgets`, `stripe` — use a single pattern that also resolves bare folder imports via per-folder `index.ts`:

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

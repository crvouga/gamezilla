# Agent Notes

## Hard Rules

- **Never patch dependencies.** Do not use `bun patch`, `patch-package`, `pnpm patch`, or any other dependency-patching mechanism. Do not add a `patches/` directory or a `patchedDependencies` / `pnpm.patchedDependencies` / `resolutions` field to `package.json`. If a third-party library has a bug, work around it in our own code or accept the behavior — never fork the dep in-tree. CI enforces this via `bun run check:no-patches`.

- **Never disable structural size limits for app code.** The Tiger-Style caps in `pkgs/eslint-rules/size-limits.cjs` (`max-lines`, `max-lines-per-function`, `max-statements`, `max-depth`, `max-params`, `max-nested-callbacks`, `complexity`, `max-classes-per-file`, `max-statements-per-line`) are load-bearing. Do **not** add per-file `'off'` overrides in any `{apps,libs,pkgs}/*/eslint.config.js`, and do **not** add `/* eslint-disable max-lines-per-function */` (or sibling) comments in source files. If a function tripped the cap, refactor it: extract sub-components, helper hooks, or pure helpers. The cap is the constraint, not a suggestion. The only legitimate exemption is `testOverrides()` (already wired in via the shared base config). Run `bun run tooling/scripts/check-no-size-limit-overrides.ts` to scan for offenders.

- **PowerSync is the default for client reads and writes.** Client UI reads local SQLite via `useWatch*` / sync streams. Client mutations use `runClientWrite` / `useWrite` on a shared `defineWrite`, which execute locally then upload through `POST /api/sync/upload`. Do **not** add feature REST GET/POST for data that is (or can be) in the user’s sync scope. Absolute REST exceptions only: username uniqueness / ensure (`PUT /profile/username`, `POST /profile/ensure`), cross-user search (`POST /friends/search`), system config refresh (`POST /client-config/refresh`), Stripe/webhooks/external APIs, and invite token minting when server RNG is required. Prefer shrinking that list, never growing it casually.

- **Every mutation is an isomorphic `@pkgs/write` `defineWrite` in a vertical slice.** Organize by mutation/feature with mirrored folders across runtimes — not horizontal hubs (`*-actions.ts`, `*-lifecycle-writes.ts`, flat `shared/writes/` dumping grounds):

  ```
  libs/<feature>/src/
    client/<slice>/     # hooks + UI (use-join-space, join-space-button, …)
    shared/<slice>/     # defineWrite + pure authorize/helpers (join-space-write, …)
    server/<slice>/     # REST/inbox only when absolute exception needs it
  ```

  Client and server import the same `shared/<slice>/*-write` module. Sync-native path: client slice hook calls `runClientWrite` (`mode: 'full'`) → upload reuses the **same** `authorize` via `createRowWriteBinding`. REST-exception path: `server/<slice>/` runs `runWrite({ mode: 'full' })` with the same write. Ban bare `sql.run` mutations outside `defineWrite.execute`. Ban god-hooks that re-export every mutation (`useSpaceActions`); each UI calls its slice hook. Package-level `shared/row-bindings.ts` (or equivalent) only composes slice authorizes into upload auth; wired in `apps/api/src/sync/row-write-registry.ts`. Never revive obsolete `server/write-policies.ts` names.

## `@pkgs/ui` design system

`@pkgs/ui` is the only design-system surface in the repo. Every component, prop type, hook, and theme helper is implemented in-house under `pkgs/ui/src/components/**` and re-exported from `pkgs/ui/src/index.ts`. There is no adapter indirection, no swappable backend, and no third-party UI library — consumers always do `import { Button, Text, useTheme } from '@pkgs/ui';` and the import resolves to the in-house implementation directly.

```
pkgs/ui/src/
  index.ts              # public API -- `export * from './components'` + theme/explorer/expo helpers
  component-id/         # DOM identifiers (`componentDataSet`) for web inspector / E2E
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
3. Wire DOM identifiers: accept optional `dataSet?: ComponentDataSet` and spread `{...componentDataSet('<PascalName>', dataSet)}` on the root host (see `pkgs/ui/src/component-id/`). `bun run ci:component-ids` enforces this for visual component folders.
4. `bun run --filter @pkgs/ui tc lint` verifies it wires up.

**DOM identifiers (dev + E2E only):** On web, every `@pkgs/ui` host exposes `data-component="<Name>"`. Babel (`pkgs/babel-plugins/jsx-source-attr.cjs`) also injects `data-src="<repo-path>:<line>"` on allowlisted JSX. `ScreenBase` requires `screenId` and renders `data-screen`. These are stripped from production web bundles (`EXPO_PUBLIC_E2E` keeps them on for `qa-browser`).

### Mutation UX

Every mutation should make its outcome obvious. Pick the surface by weight, not by feature:

- **Destructive or confirm-first mutations** (sign out, leave / end space, delete, rename, wipe DB) → `MutationModal`. It runs the whole `idle → loading → success / error` lifecycle in place: success is dismissible, errors are retryable. Thin wrappers (`EndSpaceConfirmModal`, `useSignOutConfirmationModal`, …) compose over it. Stay on the current screen after success — dismiss the modal and let the UI react to the underlying state change.
- **Lightweight, no-confirm actions** (join space, create space, anything that today was a bare `void doThing()`) → `Button` with `useMutationButton`. The button itself flips to a spinner, then a success check, then a retryable error face — no extra dialog. Omit `onSuccess` navigation; use `successHoldMs: 0` only when you need an immediate follow-up side effect (not route changes).
- **Screen form save / cancel** → `FormActionsFooter` in the `ScreenBase` `footer` slot, never header `actions`. It pins to the bottom above the safe-area inset so it stays visible while scrolling. The submit button is a `useMutationButton`, so saves show `Saving… → Saved` in place. Use Cancel or breadcrumbs to navigate away — do not `router.back()` from `onSuccess`.
- **Card-level inline async** (admin refreshers) → the `client-config-server-refresh.tsx` pattern: `useAsync` + compact `SuccessState` / `ErrorState` beneath the button.

`useMutationButton` and `MutationModal` both build on `useMutationLifecycle`, so the phase semantics stay identical across modal and inline surfaces.

Centered modals (`ModalContent`, `ResponsiveSurface`, `ConfirmationModal`, `MutationModal`) use width buckets only: `size="small" | "medium" | "large" | "fullWidth"` (default `medium`). Confirm dialogs stay on `medium`; wide inspectors use `large`; near-edge layouts use `fullWidth`. Do not pass custom width via `style`.

## CI / Turbo cache

GitHub Actions runs checks with `SECRETS_ENV=dev`. Turbo caching in CI is **local disk only**: `actions/cache` persists `.turbo`, and `tooling/scripts/turbo-ci-run.ts` passes `--cache=local:rw` (stripping `TURBO_TOKEN` / `TURBO_TEAM` so secrets-run-injected creds cannot hit Vercel). Local developers may still use Vercel Remote Cache via `TURBO_TOKEN` / `TURBO_TEAM` / optional `TURBO_CACHE` from secrets env `dev`. Optional knobs `TURBO_LOG_ORDER` and `TURBO_TELEMETRY_DISABLED` remain derived defaults from `infra provision`. Look for `cache hit` / `cache miss` in Turbo output.

Object storage (TTS audio cache, etc.) uses **S3-compatible** storage via `@pkgs/object-store/impl-s3`. The API Worker fetches `B2_APP_KEY_ID` / `B2_APP_KEY` plus `S3_BUCKET` / `S3_ENDPOINT` / `S3_REGION` from the secret store at boot and injects a namespaced store through `createS3ObjectStore`, which always applies the injected root prefix (from `PROJECT_CONFIG.objectStore.namespace`, e.g. `gamezilla/`) before feature-level prefixes (e.g. `tts-audio/`). The S3 transport layer rejects any wire key that does not start with that root prefix. Buckets live on Backblaze B2 (`gamezilla-development` / `gamezilla-production`) but **app code couples only to the S3 / ObjectStore APIs** — B2 appears in the infra `s3-bucket` provisioner (ensure buckets via the B2 native API) and in the object-store secret `seed()` helpers (mint per-bucket application keys into the secret store: `dev` → development bucket, `prd` → production bucket; endpoint `https://s3.<region>.backblazeb2.com`, region e.g. `us-west-004`). Operator-supplied `B2_MASTER_KEY_ID` / `B2_MASTER_KEY` authorize provision only (CI / infra CLI; never pushed to the Worker); minted `B2_APP_KEY_ID` / `B2_APP_KEY` are what the Worker uses. Every secret the app needs is defined in `libs/infra/src/cli/secrets/registry.ts` (`new Secret({ name, validate, seed? })`); `bun run check:secrets` (part of `check:ci`) validates both `dev` and `prd`, and provision purges any stored secret not in that registry.

## CI/CD job layout

The deployment pipeline (`.github/workflows/deployment-pipeline.yml`) follows three rules:

1. **Turbo-cacheable tasks run inside one `turbo-ci` job.** Format, syncpack + catalog + no-patches, knip, depcruise, circular-deps, audit, i18n, plus per-package `tc` / `lint` / `test` / `build` all live under root `ci:*` scripts and per-package tasks in `turbo.json`. CI invokes them with `bun run check:ci` so Turbo's task graph + GHA `.turbo` local cache handle ordering and reuse. Root `turbo.json` sets `"ui": "stream"` (not `tui`) so CI logs stream live — `bun run dev` still passes `--ui=tui`. `check:ci:turbo` runs `@apps/client setup` first so `expo lint` has `.env.local`.
2. **Non-Turbo tasks get their own job only when they need a different runner shape.** `static` runs actionlint + gitleaks (gitleaks needs `fetch-depth: 0`); `qa-api` and `qa-browser` need Playwright browsers and artifact uploads.
3. **The production deploy is one atomic `deploy` job.** A single checkout + `infra-setup` runs `bun run infra deploy`: provision and `db:migrate` run before the Postgres-backed global lock is acquired (avoids holding a direct slot during migrate); the lock then covers deploy-resources → stripe-sync → smoke → refresh-config → ensure-destroyed. `db:migrate` retries on Postgres `53300` / “too many clients”. A tiny always-run `lock-release` job is the safety net for crashed / cancelled deploys.

When adding a new check, default to a turbo task under `ci:*` (or extend an existing one). Only carve out a new GitHub Actions job if the check truly needs a unique runner shape.

## Local database

Local dev and CI use **hosted dev Postgres** only — there is no embedded/local Postgres process. `DATABASE_URL` comes exclusively from secrets env **`dev`** (injected by `bun run tooling/scripts/secrets-run.ts`, which defaults to `SECRETS_ENV=dev` from the repo-root secrets scope config).

- **`bun run dev`** — `secrets-run` → turbo starts api + client; `@apps/api` `setup` writes `.dev.vars` with the secrets env `dev` `DATABASE_URL` (mirrored, not loopback).
- **`bun db:migrate`** — `secrets-run` → `@apps/api db:migrate` against secrets env `dev` `DATABASE_URL`.
- **Production** — only `bun run infra` sets `SECRETS_ENV=prd`; deploy runs `db:migrate` against secrets env `prd` `DATABASE_URL`.

### Database safety (Tiger policy)

Non-deploy contexts must never reach production Postgres. Guards live in `@libs/infra/shared/database-url-policy`:

1. **`assertDevSecretsEnv`** — scripts exit unless `SECRETS_ENV === 'dev'`.
2. **`assertNonProdDatabaseUrl`** — rejects loopback URLs and URLs equal to secrets env `prd` `DATABASE_URL` (dual-fetch at setup/migrate time).
3. **API worker** — when `SECRETS_ENV` binding is `dev`, the first DB request asserts non-prod URL.
4. **`ci:database-url-policy`** — static check that every DATABASE_URL entrypoint wires the guards.
5. **Escape hatch** — `ALLOW_PRODUCTION_DATABASE_URL=1` (mirrors `EXPO_PUBLIC_ALLOW_PRODUCTION_API_URL` for the API).

## Per-feature package layout

Workspace packages live under three top-level tier directories with matching npm scopes — pick the tier that fits the package's role:

| Tier | Path    | Scope    | Contains                                                           |
| ---- | ------- | -------- | ------------------------------------------------------------------ |
| Apps | `apps/` | `@apps/` | Deployed product surfaces (`client`, `api`).                       |
| Libs | `libs/` | `@libs/` | Product-flavored reusable code (`chess`, `auth`, `spaces`, …).     |
| Pkgs | `pkgs/` | `@pkgs/` | Agnostic utilities, framework, CLIs, dev infra, runnable examples. |

Inside each one, runtimes are isolated by three sibling folders. Under each runtime, organize by **vertical slice** (one folder per mutation/feature) with mirrored names across `client/` / `shared/` / `server/` — do not add horizontal hubs that force jumping across many directories to follow one request:

```
<tier>/<name>/
  package.json          # name "@<tier>/<name>", subpath-pattern `exports`
  tsconfig.json         # extends ../../tsconfig.json
  eslint.config.js      # createSharedBlocks + linguiRules
  src/
    client/<slice>/     # React Native / Expo — hooks + UI for that slice
    server/<slice>/     # Cloudflare Worker / Hono — only when the slice needs REST/inbox
    shared/<slice>/     # isomorphic defineWrite + pure helpers for that slice
```

Example (`join-space`): `client/join-space/use-join-space.ts` + `join-space-button.tsx`, `shared/join-space/join-space-write.ts`, optional `server/join-space/join-space-service.ts`. Nested paths resolve via exports wildcards (`@libs/spaces/client/join-space/use-join-space`).
Cross-package imports always use deep paths: `@<tier>/<name>/client/<file>`, `@<tier>/<name>/server/<file>`, `@<tier>/<name>/shared/<file>`. The `exports` field uses one Node subpath pattern per runtime folder (with `.ts` / `.tsx` array fallback) so adding/removing/renaming a file requires zero `package.json` change while bundlers still see one module per import site:

```jsonc
"exports": {
  "./client/*": ["./src/client/*.ts", "./src/client/*.tsx"],
  "./server/*": ["./src/server/*.ts", "./src/server/*.tsx"],
  "./shared/*": ["./src/shared/*.ts", "./src/shared/*.tsx"]
}
```

Do **not** add `index.ts` barrels that mix `client` / `server` / `shared` (Metro / Wrangler need per-runtime resolution to drop the wrong runtime from the bundle). A per-runtime `client/index.ts` / `server/index.ts` / `shared/index.ts` is fine when there's a real reason to expose a curated facade (see `libs/auth/src/server/index.ts`); add it as an explicit `"./server": "./src/server/index.ts"` entry alongside the wildcard.

Flat (runtime-agnostic) packages — the per-utility micro-packages (`@pkgs/assert`, `@pkgs/keyword`, `@pkgs/kv`, …), `ui`, `api`, `room-widgets`, `stripe` — use a single pattern that also resolves bare folder imports via per-folder `index.ts`:

```jsonc
"exports": {
  "./*": ["./src/*.ts", "./src/*.tsx", "./src/*/index.ts"]
}
```

Within a feature package, prefer **relative** imports between sibling files (`./foo`, `../shared/bar`); use the `@<tier>/<name>/...` alias only for imports from a different feature package.

Feature-specific scripts (seeders, dev refreshers, migration runners) live in `<tier>/<name>/scripts/` and are wired up via the package's `scripts` block in `package.json` (e.g. `bun run --filter @libs/<name> seed:<x>`). Lint targets `eslint src` so script files use Tiger-style structure but keep the freedom to grow long top-level orchestrators. Add `./scripts/**/*.ts` to the package `tsconfig.json` `include` and the root `tsconfig.json` `include` so type-checking covers them.

`apps/client/src/app/**` (Expo Router) and `apps/api/src/api.ts` (worker entry) stay as 1-line re-export stubs that point at the feature packages — that keeps URL routes and the `Room` Durable Object class binding stable.

### Current feature packages

- `@libs/db` — single source of truth for Postgres/PowerSync table definitions (`defineTable`, column constants), composed `SYNC_TABLE_REGISTRY`, and canonical `schema.sql`. Feature packages import table names/columns from here; upload authorization is composed from each feature’s slice writes into a package-level `shared/row-bindings.ts` (or equivalent), then into `apps/api/src/sync/row-write-registry.ts`.
- `@libs/auth` — sign-in flows, sessions, devices, account-scoped local SQLite, auth port/adapters + Postgres migrations runner.
- `@libs/chess` — chess board UI, puzzle play / picker, settings. The chess puzzle seeding script lives in `libs/chess/scripts/seed-chess-puzzles.ts` (run via `bun run chess:puzzles:seed`); it assumes the schema has already been migrated by `bun run db:migrate`.
- `@libs/client-config` — server-pushed runtime config (singleton `clientConfig` entity): shared entity defs, server `POST /client-config/refresh` route, client cards / screens, and `dev-refresh-client-config.ts`.
- `@libs/profile` — public profile, dicebear avatar editor, username generator (vertical slices: ensure-local, patch-avatar, ensure-online, set-username).
- `@libs/spaces` — spaces / lobby / multiplayer plumbing, game dispatch via `space-module.ts` (lifecycle mutations as vertical slices: create/join/leave/end/rename/set-visibility).
- `@libs/stripe` — Stripe routes, catalog mirror, webhook handler, ABAC policies for stripe entities (`abac-policies.ts`).
- `@libs/friends` — friendship graph (vertical slices per mutation: send/accept/decline/cancel/remove/block/unblock).

### Adding a new game

Each game is its own package modelled after `@libs/chess`. To add `@libs/connect-four` (or numberlink, tic-tac-toe, battleship, etc.):

1. Scaffold `libs/<game>/`:
   - `package.json` with `"name": "@libs/<game>"`, per-file `exports`, deps mirroring what the implementation actually imports (typically a granular subset of the `@pkgs/<util>` micro-packages — `assert`, `keyword`, `attribute`, etc. — plus `@pkgs/sync-engine`, `@lingui/*`, `react`, `react-native`).
   - `tsconfig.json` extending root.
   - `eslint.config.js` copied from `libs/chess/eslint.config.js`.
   - Empty `src/{client,server,shared}/`.
2. Add path alias to root `tsconfig.json`: `"@libs/<game>/*": ["./libs/<game>/src/*"]` and the matching `include` entries.
3. Add the package's `src` directory to `lingui.config.cjs` `catalogs.include` so translatable strings are extracted.
4. Implement the game:
   - `shared/<game>-main-menu.ts` — `RoomModule` + `MainMenu` reducer (state, command/event router).
   - `shared/<game>-play.ts` — game-play reducer (moves, win/loss state).
   - `shared/<game>-entities.ts` — attribute/entity type defs for domain constants.
   - Add any new sync tables to `@libs/db` (`libs/db/src/shared/<game>-tables.ts`) and register them in `libs/db/src/shared/table-registry.ts`.
   - `client/<game>-main-menu.tsx`, `client/<game>-board.tsx`, `client/<game>-settings-screen.tsx`, etc. — flat under `client/`.
5. Register the game in `libs/spaces/src/shared/games.ts` (composed game module) and `libs/spaces/src/shared/space-module.ts` (top-level router).
6. Add `defineWrite` mutations under `libs/<game>/src/shared/<slice>/`, expose table upload auth via a package-level `shared/row-bindings.ts` composed from slices, and register them in `apps/api/src/sync/row-write-registry.ts`. Prefer PowerSync client writes over new REST. Put client hooks/UI in `client/<slice>/`.
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

# Agent Notes

## Hard Rules

- **All nondeterministic I/O goes through `@pkgs/io`.** Product runtime (`apps/client`, `apps/api`, `apps/postgres`, `libs/*`, `pkgs/*`, including scripts) must not call bare `Date.now`, zero-arg `new Date()`, `performance.now`, `setTimeout` / `setInterval`, `fetch`, `crypto.randomUUID`, `Math.random`, or `crypto.getRandomValues`. Use a single injected `Io` bag (`io.clock`, `io.timers`, `io.http`, `io.createId`, `io.random`) from composition roots (`IoProvider` / `runWithIo` / `createSimIo` / `wallIo` at process entry). Inject via React context (`useIo` / `useClock` / `useTimers` / `useHttpClient` / `useCreateId`) or constructor/param — never silent wall fallbacks and never module-level `wallIo()` in helpers/libraries. Do **not** reintroduce `resolveNow` / `resolveTimers` / `resolveCreateId` / `resolveRandom` / `resolveClock`, or `cryptoCreateId` / `mathRandom` — wall RNG/UUID lives only inside `wallIo()`. `wallIo()` / `wallClock` / `wallTimers` / `createGlobalHttpClient()` are allowed only in **test files** or **entry-shaped** files marked `// @io-wall-ok` (`**/scripts/**`, wall adapters, `create-app` / `api` / `cli-io` / `app-io-provider` / `polyfill-entry`, and similar process roots — see `tools/scripts/io-scan-pragma.ts`). Wall clock/timers live in `@pkgs/clock`; wall HTTP in `@pkgs/http-client`; composition `wallIo()` in `@pkgs/io`. **SQL engines must not mint time or ids:** no `DEFAULT now()`, `gen_random_uuid()`, `randomblob`, `strftime('now')`, `datetime('now')`, or bare SQL `now()` / `gen_random_uuid()` in DML — managed columns and framework timestamps come from injected `now` / `createId` (mutation wrap + store constructors); SQL stubs that must mention engine UUID helpers mark `@io-wall-ok` on an entry-shaped path. CI: `bun run ci:no-bare-io`, `bun run ci:no-resolve-wall-defaults`, `bun run ci:no-sql-wall-io`, `bun run ci:hard-determinism`, and `bun run ci:sim-determinism`. Hard-determinism gotchas (floats, object key order, locale sorts, room `hash(state)`, LWW sync): see [`DETERMINISM.md`](DETERMINISM.md).

- **Never patch dependencies.** Do not use `bun patch`, `patch-package`, `pnpm patch`, or any other dependency-patching mechanism. Do not add a `patches/` directory or a `patchedDependencies` / `pnpm.patchedDependencies` / `resolutions` field to `package.json`. If a third-party library has a bug, work around it in our own code or accept the behavior — never fork the dep in-tree. CI enforces this via `bun run check:no-patches`.

- **Never disable structural size limits for app code.** The Tiger-Style caps in root [`biome.json`](biome.json) (`noExcessiveLinesPerFile`, `noExcessiveLinesPerFunction`, `useMaxParams`, `noExcessiveNestedCallbacks`, `noExcessiveCognitiveComplexity`, `noExcessiveClassesPerFile`) are load-bearing. Do **not** add new size-rule `'off'` overrides in `biome.json`, and do **not** add `biome-ignore` comments for those rules in source files. If a function tripped the cap, refactor it: extract sub-components, helper hooks, or pure helpers. The cap is the constraint, not a suggestion. The only legitimate exemptions are the test / known-path `overrides` already wired in `biome.json`. Run `bun run ci:no-size-limit-overrides` to scan for offenders.

- **Local SQLite + defineQuery/mutations is the default for client reads and writes.** Client UI reads local SQLite via `useQuery` (table-change reactivity). Status / paint gate come from `useSyncEngine()` (`status`, `paintReady`); writes go through `useMutationClient()` / `mutate()`. Server mounts one `createSyncApp` (query + mutations). Hydration uses event-driven `POST /api/query` (batch body: `{ queries }` → `{ responses }`) on initial connect plus pubsub pushes — not periodic polling; client mutations drain through `POST /api/mutations`. Do **not** add feature REST GET/POST for data that is (or can be) in the user’s sync scope. Absolute REST exceptions only: cross-user search (`POST /friends/search`), system config refresh (`POST /client-config/refresh`), and Stripe/external APIs. Prefer shrinking that list, never growing it casually. Username claims go through the `claimUsername` mutation (not REST). Profile bootstrap uses the `ensureProfile` mutation (auto username on upload). Sync wire is protocol v3 (`x-sync-protocol: 3`); pre-cut clients get `upgrade_required` without a local DB wipe. Mutation/query authoring derives write sets and wake topics from SQL AST capture + `defineTopicMap` (no hand-declared write/invalidate lists). `@pkgs/sync-engine` public API is four entrypoints only: `client`, `server`, `shared`, `test`.

- **Writes are mutations.** Client business code calls `mutate()` through `@pkgs/sync-engine/client` (`useMutationClient()`); each mutation applies its domain SQL in the local transaction and queues an idempotent mutation record for upload. Domain defs use `defineMutation` / `defineQuery` from `@pkgs/sync-engine/shared`. Server upload replays mutations in one Postgres transaction with the authenticated actor and records permanent `MutationError` / validation failures as write rejections. Server-initiated inbox actions invoke the same mutation definitions. Do not add a second rules engine, raw CRUD upload, or feature REST write path. Any code writing DOMAIN tables outside mutation replay must call `notifyChannels` (pubsub push); a missed call is caught by the reconciliation tick (and fails the channel-exhaustiveness CI check when mutation/query wiring is incomplete). Organize mutations by vertical slice:

  ```
  libs/<feature>/src/
    client/<slice>/     # hooks + UI calling mutate()
    shared/<slice>/     # pure helpers / SQL helpers for that slice
    shared/mutations/   # defineMutation defs for the feature
    shared/queries/     # defineQuery defs for the feature (hydrated via POST /api/query)
    server/<slice>/     # REST/inbox only when absolute exception needs it
  ```

  Domain mutation definitions and their SQL live under `libs/<feature>/src/shared/mutations/`. Domain query definitions live under `libs/<feature>/src/shared/queries/`. The mutation environment contains the actor, account, and device identity. Ban god-hooks that re-export every mutation (`useSpaceActions`); each UI calls its slice hook.

- **Domain rows are soft-delete only.** Removals set managed `deleted_at` (never `DELETE FROM` domain tables). `defineQuery` snapshots **include** soft-deleted rows (tombstones on the wire, with `deleted_at` selected); UI / live client reads filter `deleted_at IS NULL`. Sync-engine merge upserts snapshot rows verbatim (including `deleted_at`) and rebases pending `_mutations` on top — no absence GC, no `_row_scopes`. Unsubscribe / denied only clears `_scope_meta`. Mutation `tx` rejects domain hard deletes at apply/replay (`NO_HARD_DELETE`). Framework tables (`_mutations`, `_scope_meta`, `write_rejections`, `_mutations_applied`) may still hard-delete. CI: `bun run ci:no-domain-hard-delete`.

- **Three-layer DI (primitives / use cases / transaction-scoped).** Only `SqlClient` + `Io` are long-lived. Use-case classes take `(db, io)` and open transactions for writes (reads pass `db` as `SqlTx` without a write tx). Repositories/services/publishers/handlers take `SqlTx` (`Pick` of `query`/`run` from `SqlClient`) + `Io`, constructed on demand inside the use case — never eagerly on a container. Exported top-level functions must not take injectable deps as parameters. Factory **functions** `(tx, io) => …` are the wiring escape hatch; no `*Container` / registry classes. Do not convert `defineMutation` / `defineQuery` `run` handlers or React hooks. Details: [`docs/dependency-injection.md`](docs/dependency-injection.md). CI: `ci:no-top-level-di-functions`, `ci:no-eager-di-construction`, `ci:layer-c-sql-tx`, `ci:no-di-container`.

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
4. `bun run --filter @pkgs/ui tc` and root `bun run ci:lint` verify it wires up.

**DOM identifiers (dev + E2E only):** On web, every `@pkgs/ui` host exposes `data-component="<Name>"`. Babel (`pkgs/babel-plugins/jsx-source-attr.cjs`) also injects `data-src="<repo-path>:<line>"` on allowlisted JSX. `ScreenBase` requires `screenId` and renders `data-screen`. These are stripped from production web bundles (`EXPO_PUBLIC_E2E` keeps them on for browser E2E).

### Mutation UX

Every mutation should make its outcome obvious. Pick the surface by weight, not by feature:

- **Destructive or confirm-first mutations** (sign out, leave / end space, delete, rename, wipe DB) → `MutationModal`. It runs the whole `idle → loading → success / error` lifecycle in place: success is dismissible, errors are retryable. Thin wrappers (`EndSpaceConfirmModal`, `useSignOutConfirmationModal`, …) compose over it. Stay on the current screen after success — dismiss the modal and let the UI react to the underlying state change.
- **Lightweight, no-confirm actions** (join space, create space, anything that today was a bare `void doThing()`) → `Button` with `useMutationButton`. The button itself flips to a spinner, then a success check, then a retryable error face — no extra dialog. Omit `onSuccess` navigation; use `successHoldMs: 0` only when you need an immediate follow-up side effect (not route changes).
- **Screen form save / cancel** → `FormActionsFooter` in the `ScreenBase` `footer` slot, never header `actions`. It pins to the bottom above the safe-area inset so it stays visible while scrolling. The submit button is a `useMutationButton`, so saves show `Saving… → Saved` in place. Use Cancel or breadcrumbs to navigate away — do not `router.back()` from `onSuccess`.
- **Card-level inline async** (admin refreshers) → the `client-config-server-refresh.tsx` pattern: `useAsync` + compact `SuccessState` / `ErrorState` beneath the button.

`useMutationButton` and `MutationModal` both build on `useMutationLifecycle`, so the phase semantics stay identical across modal and inline surfaces.

Centered modals (`ModalContent`, `ResponsiveSurface`, `ConfirmationModal`, `MutationModal`) use width buckets only: `size="small" | "medium" | "large" | "fullWidth"` (default `medium`). Confirm dialogs stay on `medium`; wide inspectors use `large`; near-edge layouts use `fullWidth`. Do not pass custom width via `style`.

## CI / Turbo cache

GitHub Actions runs checks with `SECRETS_ENV=dev`. Turbo caching in CI is **local + remote**: `actions/cache` persists `.turbo` with **per-job** keys (restore/save via `.github/actions/turbo-cache`, save on failure), and `tools/scripts/turbo-ci-run.ts` uses `--cache=local:rw,remote:rw` when `TURBO_TOKEN` / `TURBO_TEAM` are present from secrets-auth (Vercel Remote Cache). Local developers default to `local:rw` and may opt into remote via `TURBO_CACHE=remote:rw` (or `local:rw,remote:rw`) from secrets env `dev`. Optional knobs `TURBO_LOG_ORDER` and `TURBO_TELEMETRY_DISABLED` remain derived defaults from `infra provision`. Look for `cache hit` / `cache miss` in Turbo output.

Object storage (TTS audio cache, etc.) uses **S3-compatible** storage via `@pkgs/object-store/impl-s3`. The API Worker reads `B2_APP_KEY_ID` / `B2_APP_KEY` plus `S3_BUCKET` / `S3_ENDPOINT` / `S3_REGION` at boot and injects a namespaced store through `createS3ObjectStore`, which always applies the injected root prefix (from `PROJECT_CONFIG.objectStore.namespace`, e.g. `gamezilla/`) before feature-level prefixes (e.g. `tts-audio/`). The S3 transport layer rejects any wire key that does not start with that root prefix. **Non-prod (`SECRETS_ENV=dev`)** uses local **`@apps/minio`** (`http://127.0.0.1:9000`); `@apps/api` `setup` writes those loopback S3 secrets into `.dev.vars` (Infisical B2 app keys ignored for local runtime). Missing S3 secrets still fall back to an in-memory store so the Worker can boot. **Production** uses Infisical → Backblaze B2 (`gamezilla-production`); app code couples only to the S3 / ObjectStore APIs — B2 appears in the infra `s3-bucket` provisioner and object-store secret `seed()` helpers (`dev` Infisical still seeds the development B2 bucket for `check:secrets`; `prd` → production). Operator-supplied `B2_MASTER_KEY_ID` / `B2_MASTER_KEY` authorize provision only (CI / infra CLI; never pushed to the Worker). Every secret the app needs is defined in `libs/infra/src/cli/secrets/registry.ts` (`new Secret({ name, validate, seed? })`); `bun run check:secrets` (part of `check:ci`) validates both `dev` and `prd`, and provision purges any stored secret not in that registry.

## CI/CD job layout

The deployment pipeline (`.github/workflows/deployment-pipeline.yml`) follows three rules:

1. **Turbo-cacheable tasks fan out across parallel jobs** — `check-gates` (root `ci:*` + `check:secrets:validate`), `check-verify` (`tc` / `test` + root `ci:lint` via Biome), `check-build` (package-scoped `@apps/api#build` / minio / postgres — not Expo client build). Root `ci:*` / `check:*` scripts and per-package tasks live in `turbo.json`. Local `bun run check` is one offline `turbo-ci-run` graph (`tc` / `test` / `ci:lint` / gate `ci:*` / `check:static` / those app `#build`s) — no Infisical, no `check:secrets:validate`, no registry audit. `bun run check:ci` / `check:ci:gates` still include secrets validate (Infisical fingerprint + live probes). Live `check:api` is CI / opt-in only. `check:secrets:validate` is Turbo-cached on `CHECK_SECRETS_FINGERPRINT` (sha256 of registry values in `dev` + `prd`). GHA keeps parallel jobs as thin subsets (`check:ci:gates|verify|build`). On `pull_request`, verify/build set `TURBO_AFFECTED_BASE` so `turbo-ci-run` adds `--filter=...[<base>]`. Root `turbo.json` sets `"ui": "stream"` (not `tui`) so CI logs stream live — `bun run dev` still passes `--ui=tui`. `@apps/client` `tc` / `test` depend on `setup` via `apps/client/turbo.json`.
2. **Non-Turbo tasks get their own job only when they need a different runner shape.** `check-static` runs actionlint + gitleaks (gitleaks needs `fetch-depth: 0`); `check-api` runs `check:api` against a live preview Worker. Locally that script remains a root Turbo task (`//#check:api`) but is not in `bun check`.
3. **The production deploy is one atomic `deploy` job.** A single checkout + `infra-setup` runs `bun run infra deploy`: provision and `db:migrate` run before the Postgres-backed global lock is acquired (avoids holding a direct slot during migrate); the lock then covers deploy-resources → stripe-sync → smoke → refresh-config → ensure-destroyed. `db:migrate` retries on Postgres `53300` / “too many clients”. A tiny always-run `lock-release` job is the safety net for crashed / cancelled deploys.

When adding a new check, default to a turbo task under `ci:*` (or extend an existing one). Only carve out a new GitHub Actions job if the check truly needs a unique runner shape.

## Local database

Non-production (`SECRETS_ENV=dev`) is **self-contained**: Turbo starts **`@apps/postgres`** (`15432`), **`@apps/minio`** (`9000`), and **`@apps/emqx`** (MQTT WS `8083` / API `18083`) alongside api/client. `@apps/api` `setup` always writes loopback `DATABASE_URL`, MinIO `S3_*` / `B2_APP_*`, and local `EMQX_*` into `.dev.vars` (Infisical Neon/B2/EMQX ignored for those). No third-party cloud is required to boot or use the core app. Production (`SECRETS_ENV=prd`) uses Infisical Neon + B2 (+ Railway EMQX) only.

- **`bun run dev`** — offline by default (`SECRETS_ENV=dev LOCAL_SECRETS=1 turbo dev`); starts postgres + minio + emqx + api + client; postgres migrates/seeds; api `.dev.vars` points at local sidecars; `setup-dev-vars` seeds `BETTER_AUTH_SECRET` locally. No Infisical. Optional cloud overlays (Google/Stripe/TTS/LLM) stay on `secrets-run` scripts (`preview`, `check:api`, etc.), not on `dev` / `check`.
- **Sign-in** — email/password is enabled when `SECRETS_ENV=dev` (create an account in the sign-in modal). Google OAuth appears only when both Google client secrets are configured. Anon play still works without signing in.
- **Optional clouds degrade** — missing Stripe / ElevenLabs / OpenAI / Google secrets never crash the Worker. `GET /api/features` reports `{ google, emailPassword, stripe, tts, llm }`; those routes return 503 / UI hides entry points until configured.
- **`bun preview` / CI check stacks** — same local sidecars; turbo preview includes `@apps/postgres` and `@apps/minio`.
- **`bun db:migrate`** — migrates the URL from `.dev.vars` (local embedded after setup), waiting until Postgres is up.
- **`bun run db:wipe:dev`** — secrets env `dev` only: `DROP SCHEMA public CASCADE` on the local (or resolved) DB, then remigrate. Production blocked by fail-closed Tiger guards (no confirm flag). Hard reset: `rm -rf apps/postgres/data`.
- **Production** — only `bun run infra` sets `SECRETS_ENV=prd`; deploy runs `db:migrate` against secrets env `prd` `DATABASE_URL`.

### Database migrations (`@pkgs/db-migrate`)

Server SQL migrations are expressed only as `DatabaseMigration` classes (interface + `ComposedDatabaseMigration.register` from `@pkgs/db-migrate`). Each package owns its unit (`SyncEngineDatabaseMigration`, `KvPostgresDatabaseMigration`, `PostgresSchemaDatabaseMigration`, …); `@libs/db/server` (`runPostgresMigrations`) composes them (including `PostgresAdvisoryLockedTransactionMigration` for the migrate mutex). Domain schema application on Postgres and local SQLite goes through `@pkgs/db-schema/postgres` / `@pkgs/db-schema/sqlite` migration classes only (no public `reconcile` API). Do not add ad-hoc `migrateUp` / free-function DDL entrypoints for new schema — implement `DatabaseMigration` and register it at the compose site (or call `.migrate({ sqlClient, logger })` from lazy boot). `@apps/api` owns URL/policy/retry orchestration (`migratePostgresApp` / `migrate-cli.ts`); `@apps/postgres` boot imports `@libs/db/server/run-postgres-migrations` in-process. Root `db:migrate` / infra shell out to `apps/api/src/db/migrate-cli.ts` (apps must not import other `@apps/*` packages).

### Database safety (Tiger policy)

Non-deploy contexts must never reach production Postgres. Guards live in `@libs/infra/shared/database-url-policy`:

1. **`assertDevSecretsEnv`** — scripts exit unless `SECRETS_ENV === 'dev'`.
2. **`assertNonProdDatabaseUrl`** — rejects URLs equal to secrets env `prd` `DATABASE_URL` and production-only hostnames (dual-fetch at setup/migrate time). Loopback (`@apps/postgres`) is allowed for `dev`.
3. **API worker** — when `SECRETS_ENV` binding is `dev`, the first DB request asserts non-prod URL.
4. **`ci:database-url-policy`** — static check that every DATABASE_URL entrypoint wires the guards.
5. **Escape hatch** — `ALLOW_PRODUCTION_DATABASE_URL=1` (mirrors `EXPO_PUBLIC_ALLOW_PRODUCTION_API_URL` for the API). `db:wipe:dev` refuses this hatch and requires a live `prd` dual-fetch before any destructive SQL.

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
  tsconfig.tc.json      # scoped `tc` only (extends ../../tsconfig.json); IDE uses root tsconfig.json
  src/
    client/<slice>/     # React Native / Expo — hooks + UI for that slice
    server/<slice>/     # Cloudflare Worker / Hono — only when the slice needs REST/inbox
    shared/<slice>/     # pure helpers / SQL helpers for that slice
```

Lint/format is root-only Biome ([`biome.json`](biome.json) + [`tools/biome-plugins/`](tools/biome-plugins/)); packages do not ship per-package lint configs.

Example (`join-space`): `client/join-space/use-join-space.ts` + `join-space-button.tsx`, `shared/join-space/` helpers + `@libs/spaces/shared/rules` rules, optional `server/join-space/` only for REST exceptions. Nested paths resolve via exports wildcards (`@libs/spaces/client/join-space/use-join-space`).
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

Feature-specific scripts (seeders, dev refreshers, migration runners) live in `<tier>/<name>/scripts/` and are wired up via the package's `scripts` block in `package.json` (e.g. `bun run --filter @libs/<name> seed:<x>`). Root Biome still formats/lints package sources; `**/scripts/**` overrides relax console + cognitive-complexity noise for long CLI orchestrators. Add `./scripts/**/*.ts` to the package `tsconfig.tc.json` `include` and the root `tsconfig.json` `include` so type-checking covers them. Package `"tc"` scripts use `tsc --noEmit -p ./tsconfig.tc.json` so scoped CI checks stay fast while the IDE language service uses the root mega-project (Rename Symbol / Find All References across packages). Do not name the package config `tsconfig.json` — that steals file ownership from the root and breaks cross-package rename. Exception: `apps/client/tsconfig.json` (Expo).

`apps/client/src/app/**` (Expo Router) and `apps/api/src/api.ts` (worker entry) stay as 1-line re-export stubs that point at the feature packages — that keeps URL routes and the `Room` Durable Object class binding stable.

### Current feature packages

- `@libs/db` — domain schema via `defineSchema` (`app-schema.ts`) applied by `PostgresSchemaDatabaseMigration` / `SqliteSchemaDatabaseMigration` on Postgres migrate and local SQLite open; sync topics. Framework tables (`_mutations`, `write_rejections`, …) are owned by `@pkgs/sync-engine` (`SyncEngineDatabaseMigration` / `FRAMEWORK_SERVER_DDL`) and applied at migrate time. Domain mutations validate and apply their own authorized SQL against declared table names.

- `@libs/auth` — sign-in flows, sessions, devices, account-scoped local SQLite, auth port/adapters + Postgres migrations runner.
- `@libs/chess` — chess board UI, puzzle play / picker, settings. The chess puzzle seeding script lives in `libs/chess/scripts/seed-chess-puzzles.ts` (run via `bun run chess:puzzles:seed`); it assumes the schema has already been migrated by `bun run db:migrate`.
- `@libs/client-config` — server-pushed runtime config (singleton `clientConfig` entity): shared entity defs, server `POST /client-config/refresh` route, client cards / screens, and `dev-refresh-client-config.ts`.
- `@libs/profile` — public profile, dicebear avatar editor, username generator (vertical slices: ensure-local, patch-avatar, ensure-online, set-username).
- `@libs/spaces` — spaces / lobby / multiplayer plumbing, game dispatch via `space-module.ts` (lifecycle mutations as vertical slices: create/join/leave/end/rename/set-visibility).
- `@libs/stripe` — Stripe checkout routes, catalog mirror, ABAC policies for stripe entities (`abac-policies.ts`).
- `@libs/friends` — friendship graph (vertical slices per mutation: send/accept/decline/cancel/remove/block/unblock).

### Adding a new game

Each game is its own package modelled after `@libs/chess`. To add `@libs/connect-four` (or numberlink, tic-tac-toe, battleship, etc.):

1. Prefer `bun run scaffold:game -- <kebab-name>` (creates `RoomModule` with required `hash(state)`, `*.sim.test.ts` / unit skeletons, no wall globals). Or scaffold `libs/<game>/` manually:
   - `package.json` with `"name": "@libs/<game>"`, per-file `exports`, deps mirroring what the implementation actually imports (typically a granular subset of the `@pkgs/<util>` micro-packages — `assert`, `keyword`, `attribute`, etc. — plus `@pkgs/sync-engine`, `@lingui/*`, `react`, `react-native`).
   - `tsconfig.tc.json` extending root; `"tc": "tsc --noEmit -p ./tsconfig.tc.json"`.
   - Empty `src/{client,server,shared}/` plus a `hash(state)` on every `RoomModule` (see [`DETERMINISM.md`](DETERMINISM.md)).
2. Add path alias to root `tsconfig.json`: `"@libs/<game>/*": ["./libs/<game>/src/*"]` and the matching `include` entries.
3. Add the package's `src` directory to `lingui.config.cjs` `catalogs.include` so translatable strings are extracted.
4. Implement the game:
   - `shared/<game>-main-menu.ts` — `RoomModule` + `MainMenu` reducer (state, command/event router).
   - `shared/<game>-play.ts` — game-play reducer (moves, win/loss state).
   - `shared/<game>-entities.ts` — attribute/entity type defs for domain constants.
   - Add any new sync tables to `@libs/db` `app-schema.ts` (`defineSchema`).
   - `client/<game>-main-menu.tsx`, `client/<game>-board.tsx`, `client/<game>-settings-screen.tsx`, etc. — flat under `client/`.
5. Register the game in `libs/spaces/src/shared/games.ts` (composed game module) and `libs/spaces/src/shared/space-module.ts` (top-level router).
6. Add client hooks under `libs/<game>/src/client/<slice>/` that call domain mutation definitions under `libs/<game>/src/shared/mutations/`. Prefer domain mutation writes over new REST.
7. Wire the client entry in `libs/spaces/src/client/module/games-main-menu.tsx` so the new game shows up in the games list.
   `apps/api` and `apps/client` themselves do **not** need to be edited beyond the registries above — game packages compose into spaces, and spaces is already wired into the shells.

### Layering rules (enforced by depcruise + ci:tier-imports)

**Tier pyramid** — one-way dependencies between tiers, enforced by `bun run ci:tier-imports` (authoritative; scans `@<tier>/<name>` imports + workspace `package.json` deps) and depcruise rules `pkgs-not-libs`, `pkgs-not-apps`, `libs-not-apps`:

```text
apps  →  libs, pkgs   (never other @apps/* packages)
libs  →  pkgs only    (libs may not import apps)
pkgs  →  pkgs only    (leaf tier: reusable, app-agnostic)
```

`pkgs/` packages are the foundation: they must work in any monorepo, with no references to `gamezilla`, `apps/api`, `@libs/*`, or any product surface (in code, comments, or default config strings).

**Other layering rules:**

- `@apps/<name>` must not import or depend on another `@apps/<other>` (`ci:tier-imports` apps-not-apps). Same-package deep imports and type-only `import type` are fine.
- `shared/` cannot import from `client/` or `server/` anywhere in the repo (`shared-pure`).
- Within and across feature packages, `client/` cannot import from `server/` and vice-versa (`client-not-server`, `server-not-client`).
- Every `@pkgs/<utility>` micro-package (`assert`, `keyword`, `attribute`, `message`, `kv`, `sql-client`, `logger`, etc.) stays runtime-agnostic and feature-agnostic — no imports from `spaces`, `chess`, or any other product package.
- `apps/client` cannot reach any feature's `server/`; `apps/api` cannot reach any feature's `client/` (`apps-client-no-server`, `apps-api-no-client`).

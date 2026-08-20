# Agent Notes

## Hard Rules

- **All nondeterministic I/O is injected.** Product runtime (`apps/client`, `apps/system-console`, `apps/server`, `libs/*`, `pkgs/*`, including scripts) must not call bare `Date.now`, zero-arg `new Date()`, `performance.now`, `setTimeout` / `setInterval`, `fetch`, `crypto.randomUUID`, `Math.random`, or `crypto.getRandomValues`. Inject `Clock` / `Timers` (`@pkgs/clock`), HTTP (`@pkgs/http-client`), and `createId` / `random` (`@pkgs/uuid` `createSimAdapters`) from composition roots (`createClient(env)` / `createServer(env)` / `createSim` / wall adapters at process entry). Inject via React context (`ClockProvider` / `useClock` / `useTimers` / `useHttpClient` / `useCreateId`) or constructor/param — never silent wall fallbacks and never an `Io` bag (`wallIo` / `createSimIo` / `useIo` / `getIo` / `runWithIo`). Do **not** reintroduce `resolveNow` / `resolveTimers` / `resolveCreateId` / `resolveRandom` / `resolveClock`, or `cryptoCreateId` / `mathRandom`. `wallClock` / `wallTimers` / `createGlobalHttpClient()` / `crypto.randomUUID` are allowed only in **test files** or **entry-shaped** files marked `// @io-wall-ok` (`**/scripts/**`, wall adapters, `create-app` / `cli-io` / `polyfill-entry`, and similar process roots — see `tools/scripts/io-scan-pragma.ts`). **File content I/O goes through `@pkgs/object-store`:** libraries take an injected `ObjectStore` (sidecar layout for blobs, tree layout for source/CI trees). Wall `node:fs` / `expo-file-system` only in `@io-wall-ok` adapters (`wall-node-fs.ts`, `wall-expo-fs.ts`). Process I/O (`spawn` / `chmod`) stays on `@pkgs/os` — not ObjectStore. **SQL engines must not mint time or ids:** no `DEFAULT now()`, `gen_random_uuid()`, `randomblob`, `strftime('now')`, `datetime('now')`, or bare SQL `now()` / `gen_random_uuid()` in DML — managed columns and framework timestamps come from injected `now` / `createId` (mutation wrap + store constructors); SQL stubs that must mention engine UUID helpers mark `@io-wall-ok` on an entry-shaped path. CI: Biome plugins under `tools/biome-plugins/` (via `ci:lint`) for bare I/O / FS / wall defaults / hard-determinism; `bun run ci:no-sql-wall-io`, `bun run ci:sim-determinism`. Hard-determinism gotchas (floats, object key order, locale sorts, room `hash(state)`, LWW sync): see [`DETERMINISM.md`](DETERMINISM.md).

- **Never patch dependencies.** Do not use `bun patch`, `patch-package`, `pnpm patch`, or any other dependency-patching mechanism. Do not add a `patches/` directory or a `patchedDependencies` / `pnpm.patchedDependencies` / `resolutions` field to `package.json`. If a third-party library has a bug, work around it in our own code or accept the behavior — never fork the dep in-tree. CI enforces this via `bun run check:no-patches`.

- **Never disable structural size limits for app code.** The Tiger-Style caps in root [`biome.json`](biome.json) (`noExcessiveLinesPerFile`, `noExcessiveLinesPerFunction`, `useMaxParams`, `noExcessiveNestedCallbacks`, `noExcessiveCognitiveComplexity`, `noExcessiveClassesPerFile`) are load-bearing. Do **not** add new size-rule `'off'` overrides in `biome.json`, and do **not** add `biome-ignore` comments for those rules in source files. If a function tripped the cap, refactor it: extract sub-components, helper hooks, or pure helpers. The cap is the constraint, not a suggestion. The only legitimate exemptions are the test / known-path `overrides` already wired in `biome.json`. Run `bun run ci:no-size-limit-overrides` to scan for offenders.

- **Local SQLite + defineQuery/mutations is the default for client reads and writes.** Client UI reads local SQLite via `useQuery` (table-change reactivity). Status / paint gate come from `useSyncEngine()` (`status`, `paintReady`); writes go through `useMutationClient()` / `mutate()`. Server mounts one `createSyncApp` (query + mutations). Hydration uses event-driven `POST /api/query` (batch body: `{ queries }` → `{ responses }`) on initial connect plus pubsub pushes — not periodic polling; client mutations drain through `POST /api/mutations`. Do **not** add feature REST GET/POST for data that is (or can be) in the user’s sync scope. Absolute REST exceptions only: cross-user search (`POST /friends/search`) and billing/external APIs. Prefer shrinking that list, never growing it casually. Username claims go through the `claimUsername` mutation (not REST). Profile bootstrap uses the `ensureProfile` mutation (auto username on upload). Sync wire is protocol v3 (`x-sync-protocol: 3`); pre-cut clients get `upgrade_required` without a local DB wipe. Mutation/query authoring derives write sets and wake topics from SQL AST capture + `defineTopicMap` (no hand-declared write/invalidate lists). `@pkgs/sync-engine` public API is four entrypoints only: `client`, `server`, `shared`, `test`.

- **Writes are mutations.** Client business code calls `mutate()` through `@pkgs/sync-engine/client` (`useMutationClient()`); each mutation applies its domain SQL in the local transaction and queues an idempotent mutation record for upload. Domain defs use `defineMutation` / `defineQuery` from `@pkgs/sync-engine/shared`. Server upload replays mutations in one Postgres transaction with the authenticated actor and records permanent `MutationError` / validation failures as write rejections. Server-initiated inbox actions invoke the same mutation definitions. Do not add a second rules engine, raw CRUD upload, or feature REST write path. Any code writing DOMAIN tables outside mutation replay must call `notifyChannels` (pubsub push); a missed call is caught by the reconciliation tick (and fails the channel-exhaustiveness CI check when mutation/query wiring is incomplete). Organize product libs by vertical slice — one folder per request:

  ```
  libs/<feature>/src/
    use-cases/<use-case>/
      client/     # hook + that request's own confirm UI
      shared/     # defineMutation / defineQuery / validation for THIS request
      server/     # REST / outbox consumer / Layer-B class for THIS request
    shared/       # domain primitives only (types, repos, RoomModule)
    root/
      client/     # app screens / chrome that compose many use-case hooks
      server/     # app Hono mounts / outbox lists
    public/       # what other @libs packages may import
  ```

  Omit empty `client/` / `server/` stubs inside a use case. Split mutation/query hubs so each `defineMutation` / `defineQuery` lives in its use case `shared/`. App sync registries (`FRIENDS_MUTATIONS`) live in `root/`. Other libs import `@libs/<pkg>/public/…` only; apps and tests may also import `@libs/<pkg>/root/…`. Never import `use-cases/` or `shared/` from outside the package. Use cases must not import other use cases, `root/`, or `public/`. Ban god-hooks that re-export every mutation (`useSpaceActions`); each UI calls its slice hook.

  Domain mutation definitions and their SQL live under `libs/<feature>/src/use-cases/<use-case>/shared/`. The mutation environment contains the actor, account, and device identity. CI: `ci:use-case-isolation`, `ci:libs-import-surface`.

- **Domain rows are soft-delete only.** Removals set managed `deleted_at` (never `DELETE FROM` domain tables). `defineQuery` snapshots **include** soft-deleted rows (tombstones on the wire, with `deleted_at` selected); UI / live client reads filter `deleted_at IS NULL`. Sync-engine merge upserts snapshot rows verbatim (including `deleted_at`) and rebases pending `sync_engine_mutations` on top — no absence GC, no `_row_scopes`. Unsubscribe / denied only clears `sync_engine_scope_meta`. Mutation `tx` rejects domain hard deletes at apply/replay (`NO_HARD_DELETE`). Framework tables (`sync_engine_mutations`, `sync_engine_scope_meta`, `sync_engine_write_rejections`, `sync_engine_mutations_applied`) may still hard-delete. CI: `bun run ci:no-domain-hard-delete`.

- **Style only through `@pkgs/ui` `sx`.** Do not import `StyleSheet` or pass RN `style` / `contentContainerStyle` / `View` / `Text` / `Pressable` from `react-native` in product or composed UI. Layout primitives (`Box`, `Text`, `Pressable`, `Stack`, `ScrollView`) take `sx` (and ScrollView/FlatList `frameSx` for the scroller). Only `@pkgs/ui` host adapters compile `sx` onto the native `style` prop. Crash UI (`root-error-boundary.tsx`) is the sole product exception. CI: `bun run ci:no-rn-style-api` plus Biome plugin `no-rn-style-prop.grit` (via `ci:lint`).

- **Three-layer DI (primitives / use cases / transaction-scoped).** Only `SqlClient` + `Io` are long-lived. Use-case classes take `(db, io)` and open transactions for writes (reads pass `db` as `SqlTx` without a write tx). Repositories/services/publishers/handlers take `SqlTx` (`Pick` of `query`/`run` from `SqlClient`) + `Io`, constructed on demand inside the use case — never eagerly on a container. Exported top-level functions must not take injectable deps as parameters. Factory **functions** `(tx, io) => …` are the wiring escape hatch; no `*Container` / registry classes. Do not convert `defineMutation` / `defineQuery` `run` handlers or React hooks. Details: [`docs/dependency-injection.md`](docs/dependency-injection.md). CI: `ci:no-top-level-di-functions`, `ci:no-eager-di-construction`, `ci:layer-c-sql-tx`; Biome plugin `no-di-container.grit` (via `ci:lint`).

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
3. Style with `sx` on `Box` / `Text` / `Pressable` — never RN `style` / `StyleSheet`. Host adapters call `useHostSx('<PascalName>', sx, dataSet)`; composed components set `dataSet={{ component: '<PascalName>', ...dataSet }}` on the root Box (see `pkgs/ui/src/component-id/`). `bun run ci:component-ids` and `bun run ci:no-rn-style-api` enforce this.
4. `bun run --filter @pkgs/ui tc` and root `bun run ci:lint` verify it wires up.

**DOM identifiers (dev + E2E only):** On web, every `@pkgs/ui` host exposes `data-component="<Name>"`. Babel (`pkgs/babel-plugins/jsx-source-attr.cjs`) also injects `data-src="<repo-path>:<line>"` on allowlisted JSX. `ScreenBase` requires `screenId` and renders `data-screen`. These are stripped from production web bundles (`EXPO_PUBLIC_E2E` keeps them on for browser E2E).

### Mutation UX

Every mutation should make its outcome obvious. Pick the surface by weight, not by feature:

- **Destructive or confirm-first mutations** (sign out, leave / end space, delete, rename, wipe DB) → `MutationModal`. It runs the whole `idle → loading → success / error` lifecycle in place: success is dismissible, errors are retryable. Thin wrappers (`EndSpaceConfirmModal`, `useSignOutConfirmationModal`, …) compose over it. Stay on the current screen after success — dismiss the modal and let the UI react to the underlying state change.
- **Lightweight, no-confirm actions** (join space, create space, anything that today was a bare `void doThing()`) → `Button` with `useMutationButton`. The button itself flips to a spinner, then a success check, then a retryable error face — no extra dialog. Omit `onSuccess` navigation; use `successHoldMs: 0` only when you need an immediate follow-up side effect (not route changes).
- **Screen form save / cancel** → `FormActionsFooter` in the `ScreenBase` `footer` slot, never header `actions`. It pins to the bottom above the safe-area inset so it stays visible while scrolling. The submit button is a `useMutationButton`, so saves show `Saving… → Saved` in place. Use Cancel or breadcrumbs to navigate away — do not `router.back()` from `onSuccess`.
- **Card-level inline async** (admin refreshers) → `useAsync` + compact `SuccessState` / `ErrorState` beneath the button.

`useMutationButton` and `MutationModal` both build on `useMutationLifecycle`, so the phase semantics stay identical across modal and inline surfaces.

Centered modals (`ModalContent`, `ResponsiveSurface`, `ConfirmationModal`, `MutationModal`) use width buckets only: `size="small" | "medium" | "large" | "fullWidth"` (default `medium`). Confirm dialogs stay on `medium`; wide inspectors use `large`; near-edge layouts use `fullWidth`. Do not pass custom width via `sx`.

## CI / Turbo cache

GitHub Actions runs checks with `SECRETS_ENV=dev`. Turbo caching in CI is **local + remote**: `actions/cache` persists `.turbo` with **per-job** keys (restore/save via `.github/actions/turbo-cache`, save on failure), and `tools/scripts/turbo-ci-run.ts` uses `--cache=local:rw,remote:rw` when `TURBO_TOKEN` / `TURBO_TEAM` are present from secrets-auth (Vercel Remote Cache). Local developers default to `local:rw` and may opt into remote via `TURBO_CACHE=remote:rw` (or `local:rw,remote:rw`) from secrets env `dev`. Optional knobs `TURBO_LOG_ORDER` and `TURBO_TELEMETRY_DISABLED` remain derived defaults from `infra provision`. Look for `cache hit` / `cache miss` in Turbo output.

Object storage (TTS audio cache, etc.) uses **S3-compatible** storage via `@pkgs/object-store/impl-s3`. The API Worker reads `B2_APP_KEY_ID` / `B2_APP_KEY` plus `S3_BUCKET` / `S3_ENDPOINT` / `S3_REGION` at boot and injects a namespaced store through `createS3ObjectStore`, which always applies the injected root prefix (from `PROJECT_CONFIG.objectStore.namespace`, e.g. `gamezilla/`) before feature-level prefixes (e.g. `tts-audio/`). The S3 transport layer rejects any wire key that does not start with that root prefix. **CI / fidelity-max** may boot **`@pkgs/minio-server`** (`http://127.0.0.1:9000`). Missing S3 secrets still fall back to an in-memory store so the Worker can boot. **Production** uses Infisical → Backblaze B2 (`gamezilla-production`). Operator-supplied `B2_MASTER_KEY_ID` / `B2_MASTER_KEY` authorize provision only. Every secret the app needs is defined in `libs/infra/src/cli/secrets/registry.ts`; `bun run check:secrets` (part of `check:ci`) validates both `dev` and `prd`.

## CI/CD job layout

The deployment pipeline (`.github/workflows/deployment-pipeline.yml`) follows three rules:

1. **Turbo-cacheable tasks fan out across parallel jobs** — `check-gates` (root `ci:*` + `check:secrets:validate`), `check-verify` (`tc` / `test` + root `ci:lint` via Biome), `check-build` (package-scoped `@apps/server#build` — not Expo client build). Root `ci:*` / `check:*` scripts and per-package tasks live in `turbo.json`. Local `bun run check` is one offline `turbo-ci-run` graph (`tc` / `test` / `ci:lint` / gate `ci:*` / `check:static` / those app `#build`s) — no Infisical, no `check:secrets:validate`, no registry audit. `bun run check:ci` / `check:ci:gates` still include secrets validate (Infisical fingerprint + live probes). Live `check:api` is CI / opt-in only. `check:secrets:validate` is Turbo-cached on `CHECK_SECRETS_FINGERPRINT` (sha256 of registry values in `dev` + `prd`). GHA keeps parallel jobs as thin subsets (`check:ci:gates|verify|build`). On `pull_request`, verify/build set `TURBO_AFFECTED_BASE` so `turbo-ci-run` adds `--filter=...[<base>] --filter=//` (affected packages plus root tasks such as `ci:lint`). Root `turbo.json` sets `"ui": "stream"` (not `tui`) so CI logs stream live — `bun run dev` still passes `--ui=tui`.
2. **Non-Turbo tasks get their own job only when they need a different runner shape.** `check-static` runs actionlint + gitleaks (gitleaks needs `fetch-depth: 0`); `check-api` runs `check:api` against a live preview Worker. Locally that script remains a root Turbo task (`//#check:api`) but is not in `bun check`.
3. **The production deploy is one atomic `deploy` job.** A single checkout + `infra-setup` runs `bun run infra deploy`: provision and `db:migrate` run before the Postgres-backed global lock is acquired (avoids holding a direct slot during migrate); the lock then covers deploy-resources → billing-sync → smoke → ensure-destroyed. `db:migrate` retries on Postgres `53300` / “too many clients”. A tiny always-run `lock-release` job is the safety net for crashed / cancelled deploys.

When adding a new check, default to a turbo task under `ci:*` (or extend an existing one). Only carve out a new GitHub Actions job if the check truly needs a unique runner shape.

## Local development

**Manual work is sim-only.** `bun run dev` starts **only `@apps/system-console`** (Reports + Playground, sqlite-mem World, reports on port 7789). It does **not** start Wrangler, Postgres, MinIO, or EMQX. The product Expo app is separate (`bun run dev:client` → `@apps/client`).

Representativeness of production is **port contract matrices** (sqlite-mem vs PGlite, Kv, ObjectStore, PubSub, billing/TTS/LLM stubs) plus `@test/system` `openSim({ fidelity: 'max' })` / `SYSTEM_FIDELITY=max`. Sidecar processes live in `@pkgs/postgres-embedded`, `@pkgs/minio-server`, `@pkgs/emqx-server` and are booted from tests/CI (`tools/scripts/boot-local-stack.ts`, `tools/scripts/boot-embedded-postgres.ts`).

Production (`SECRETS_ENV=prd`) uses Infisical Neon + B2 (+ Railway EMQX) only.

- **`bun run dev`** — `@apps/system-console` (Reports + Playground). Feature work happens here.
- **`bun run dev:client`** — `@apps/client` product app only (no console chrome).
- **Sign-in in the playground** — email/password against the in-process sim API.
- **Optional clouds** — still degrade in the real API Worker when secrets are missing.
- **`bun db:migrate`** — migrates `DATABASE_URL` (CI / after booting embedded Postgres). Not part of daily `bun dev`.
- **`bun run db:wipe:dev`** — secrets env `dev` only; destructive on the resolved non-prod URL.
- **Production** — only `bun run infra` sets `SECRETS_ENV=prd`.

### Database migrations (`@pkgs/db-migrate`)

Server SQL migrations are expressed only as `DatabaseMigration` classes (interface + `ComposedDatabaseMigration.register` from `@pkgs/db-migrate`). Each package owns its unit (`SyncEngineDatabaseMigration`, `KvPostgresDatabaseMigration`, `PostgresSchemaDatabaseMigration`, …); `@libs/runtime/server/run-postgres-migrations` (`PostgresMigrationRunner`) composes them (including `PostgresAdvisoryLockedTransactionMigration` for the migrate mutex).

**Domain tables** are declared with `defineTable` in each feature lib’s `shared/schema/` (exported via `public/schema.ts`), composed by `registerTables` in `@libs/runtime/root/app-schema`, and applied only through `@pkgs/db-schema/postgres` / `@pkgs/db-schema/sqlite` migration classes (no public `reconcile` API). **Do not add raw `.sql` schema files** under `libs/` / `pkgs/` / `apps/` / `test/` — CI enforces `ci:no-raw-schema-sql`.

**Framework / infra tables** (sync-engine, outbox, kv, entity-store, matchmaking, Better Auth) stay as package-owned TypeScript `DatabaseMigration` DDL units — they are not soft-delete domain sync tables and do not use `defineTable`.

Do not add ad-hoc `migrateUp` / free-function DDL entrypoints for new **domain** schema — implement `defineTable` + register in app-schema (or a `DatabaseMigration` at the compose site for framework/infra). `@apps/server` owns URL/policy/retry orchestration (`migratePostgresApp` / `migrate-cli.ts`); tests/CI boot `@pkgs/postgres-embedded` then call api migrate/seed scripts. Root `db:migrate` / infra shell out to `apps/server/src/db/migrate-cli.ts` (apps must not import other `@apps/*` packages).

### Database safety (Tiger policy)

Non-deploy contexts must never reach production Postgres. Guards live in `@libs/infra/shared/database-url-policy`:

1. **`assertDevSecretsEnv`** — scripts exit unless `SECRETS_ENV === 'dev'`.
2. **`assertNonProdDatabaseUrl`** — rejects URLs equal to secrets env `prd` `DATABASE_URL` and production-only hostnames (dual-fetch at setup/migrate time). Loopback (`@pkgs/postgres-embedded`) is allowed for `dev`.
3. **API worker** — when `SECRETS_ENV` binding is `dev`, the first DB request asserts non-prod URL.
4. **`ci:database-url-policy`** — static check that every DATABASE_URL entrypoint wires the guards.
5. **Escape hatch** — `ALLOW_PRODUCTION_DATABASE_URL=1` (mirrors `EXPO_PUBLIC_ALLOW_PRODUCTION_API_URL` for the API). `db:wipe:dev` refuses this hatch and requires a live `prd` dual-fetch before any destructive SQL.

## Per-feature package layout

Workspace packages live under four top-level tier directories with matching npm scopes — pick the tier that fits the package's role:

| Tier | Path    | Scope    | Contains                                                           |
| ---- | ------- | -------- | ------------------------------------------------------------------ |
| Test | `test/` | `@test/` | System tests / DST (may import apps+libs+pkgs). |
| Apps | `apps/` | `@apps/` | Deployed product surfaces (`client`, `server`, `room-server`). |
| Libs | `libs/` | `@libs/` | Product-flavored reusable code (`chess`, `auth`, `spaces`, …).     |
| Pkgs | `pkgs/` | `@pkgs/` | Agnostic utilities, framework, CLIs, dev infra, runnable examples. |

Inside each **product** `@libs` package, organize by use case so one directory traces a request from client to server to db. Do not add horizontal mutation/query hubs:

```
libs/<feature>/
  package.json          # name "@libs/<feature>"; exports ./public/* and ./root/* only
  tsconfig.tc.json
  src/
    use-cases/<use-case>/{client,shared,server}/
    shared/             # domain primitives used by use-cases and root
    root/{client,server}/
    public/             # cross-lib contract
```

Exempt (no request to trace; keep their current trees): `@libs/infra`, `@libs/games`, `@libs/runtime`, `@libs/dst-handles`.

Lint/format is root-only Biome ([`biome.json`](biome.json) + [`tools/biome-plugins/`](tools/biome-plugins/)); packages do not ship per-package lint configs.

Example (`friend-request-send`): `use-cases/friend-request-send/client/use-send-friend-request.ts`, `shared/send-friend-request-mutation.ts`, optional `server/` consumer. Composition UI (FriendActionPills) lives in `public/` if other libs need it, otherwise `root/client`. Apps import `@libs/friends/root/client/friends-list-screen`. Other libs import `@libs/friends/public/…`.

Product lib `exports`:

```jsonc
"exports": {
  "./public/*": ["./src/public/*.ts", "./src/public/*.tsx"],
  "./root/*": ["./src/root/*.ts", "./src/root/*.tsx"]
}
```

Do **not** export `use-cases/` or `shared/`. Do **not** add a god barrel that mixes client UI with server Hono. Within a feature package, prefer **relative** imports; use the `@libs/<name>/public/…` alias only for a **different** feature package.

`pkgs/` keep `src/{client,server,shared}/` (or a flat `./*` export for micro-packages). Flat runtime-agnostic packages (`@pkgs/assert`, `ui`, …) still use:

```jsonc
"exports": {
  "./*": ["./src/*.ts", "./src/*.tsx", "./src/*/index.ts"]
}
```

Feature-specific scripts (seeders, dev refreshers, migration runners) live in `<tier>/<name>/scripts/` and are wired up via the package's `scripts` block in `package.json` (e.g. `bun run --filter @libs/<name> seed:<x>`). Root Biome still formats/lints package sources; `**/scripts/**` overrides relax console + cognitive-complexity noise for long CLI orchestrators. Add `./scripts/**/*.ts` to the package `tsconfig.tc.json` `include` and the root `tsconfig.json` `include` so type-checking covers them. Package `"tc"` scripts use `tsc --noEmit -p ./tsconfig.tc.json` so scoped CI checks stay fast while the IDE language service uses the root mega-project (Rename Symbol / Find All References across packages). Do not name the package config `tsconfig.json` — that steals file ownership from the root and breaks cross-package rename. Exception: `apps/client/tsconfig.json` (Expo).

`apps/client/src/app/**` (Expo Router) and `apps/server/src/api.ts` (worker entry) stay as 1-line re-export stubs that point at the feature packages — that keeps URL routes and the `RoomServerDurableObject` Durable Object class binding stable.

### Current feature packages

- `@libs/runtime` — product composition hub: `defineTable` tables from feature libs composed via `registerTables` in `root/app-schema.ts`; sync topic map in `root/app-topic-map.ts`; Postgres migrate runner in `server/run-postgres-migrations.ts`. **`@libs/runtime` is the sole lib allowed to import other `@libs/*`.** Framework tables (`sync_engine_mutations`, `sync_engine_write_rejections`, …) are owned by `@pkgs/sync-engine` (`SyncEngineDatabaseMigration` / `FRAMEWORK_SERVER_DDL`) and applied at migrate time. Domain mutations validate and apply their own authorized SQL against declared table names.

- `@libs/auth` — sign-in flows, sessions, devices, account-scoped local SQLite, auth port/adapters + Postgres migrations runner.
- `@libs/chess` — chess board UI, puzzle play / picker, settings. The chess puzzle seeding script lives in `libs/chess/scripts/seed-chess-puzzles.ts` (run via `bun run chess:puzzles:seed`); it assumes the schema has already been migrated by `bun run db:migrate`.
- `@libs/client-config` — synced runtime config (`client_config` key/value scalar rows). Worker materializes from secrets via `EnsureClientConfigMaterialized` (no HTTP); clients read local SQLite via `useClientConfig`. Client runtime knobs (EMQX WSS URL, observability backend) live here — not in `EXPO_PUBLIC_*` Expo env (API URL / commit provenance / E2E / Watchman stay build-time env).
- `@libs/profile` — public profile, dicebear avatar editor, username generator (vertical slices: ensure-local, patch-avatar, ensure-online, set-username).
- `@libs/spaces` — spaces / lobby / multiplayer plumbing, game dispatch via `space-module.ts` (lifecycle mutations as vertical slices: create/join/leave/end/rename/set-visibility).
- `@libs/billing` — billing checkout/portal routes and product catalog SPEC (vendor via `@pkgs/billing-stripe`).
- `@libs/friends` — friendship graph (vertical slices per mutation: send/accept/decline/cancel/remove/block/unblock).

### Adding a new game

Each game is its own package modelled after `@libs/chess`. To add `@libs/connect-four` (or numberlink, tic-tac-toe, battleship, etc.):

1. Prefer `bun run scaffold:game -- <kebab-name>` (creates `RoomModule` with required `hash(state)`, `*.sim.test.ts` / unit skeletons, no wall globals). Or scaffold `libs/<game>/` manually:
   - `package.json` with `"name": "@libs/<game>"`, per-file `exports`, deps mirroring what the implementation actually imports (typically a granular subset of the `@pkgs/<util>` micro-packages — `assert`, `keyword`, `attribute`, etc. — plus `@pkgs/sync-engine`, `@lingui/*`, `react`, `react-native`).
   - `tsconfig.tc.json` extending root; `"tc": "tsc --noEmit -p ./tsconfig.tc.json"`.
   - Empty `src/shared/<game>/` RoomModule plus `src/use-cases/`, `src/root/{client,server}/`, `src/public/` (omit empty runtimes). `hash(state)` on every `RoomModule` (see [`DETERMINISM.md`](DETERMINISM.md)).
2. Add path alias to root `tsconfig.json`: `"@libs/<game>/*": ["./libs/<game>/src/*"]` and the matching `include` entries.
3. Add the package's `src` directory to `lingui.config.cjs` `catalogs.include` so translatable strings are extracted.
4. Implement the game:
   - `shared/<game>/<game>-main-menu.ts` — `RoomModule` + `MainMenu` reducer (state, command/event router).
   - `shared/<game>/<game>-play.ts` — game-play reducer (moves, win/loss state).
   - `shared/<game>/<game>-entities.ts` — attribute/entity type defs for domain constants.
   - Add any new sync tables via `defineTable` in the owning feature lib's `shared/schema/` (export from `public/schema.ts`); register in `@libs/runtime/root/app-schema.ts`.
   - `root/client/<game>-main-menu.tsx`, board, settings, etc. — app chrome that composes use cases.
5. Register the game in spaces `shared/` games registry and `space-module.ts` (top-level router). Other libs consume the game via `@libs/<game>/public/…`.
6. Add client hooks under `libs/<game>/src/use-cases/<slice>/client/` that call domain mutation definitions under `use-cases/<slice>/shared/`. Prefer domain mutation writes over new REST.
7. Wire the client entry in spaces `root/client` games menu so the new game shows up in the games list.
   `apps/server` and `apps/client` themselves do **not** need to be edited beyond the registries above — game packages compose into spaces, and spaces is already wired into the shells.

### Layering rules (enforced by depcruise + ci:tier-imports)

**Tier pyramid** — one-way dependencies between tiers, enforced by `bun run ci:tier-imports` (authoritative; scans `@<tier>/<name>` imports + workspace `package.json` deps) and depcruise rules `pkgs-not-libs`, `pkgs-not-apps`, `libs-not-apps`, `apps|libs|pkgs-not-test`:

```text
test  →  apps, libs, pkgs, tools  (system tests / DST)
apps  →  apps, libs, pkgs (never @test/*; cross-app OK e.g. client → server)
libs  →  pkgs only
pkgs  →  pkgs only (leaf tier: reusable, app-agnostic)
```

`pkgs/` packages are the foundation: they must work in any monorepo, with no references to `gamezilla`, `apps/server`, `@libs/*`, or any product surface (in code, comments, or default config strings).

**Other layering rules:**

- `@test/<name>` may import `@apps/*`, `@libs/*`, `@pkgs/*`, and tools. Product apps/libs/pkgs must not import `@test/*`.
- `@apps/<name>` may import other `@apps/<other>` (e.g. client composing the in-process sim Hono factory). Same-package deep imports and type-only `import type` are fine.
- **`@apps/server` Hono/runtime source is isomorphic.** Platform engines (`pg`, `node:*`, …) live only behind injected ports (e.g. `OpenSqlClient`) and `@api-wall-ok` adapter/entry modules. Isomorphic files must not import wall modules. CI: `bun run ci:server-isomorphic`.
- `shared/` cannot import from `client/` or `server/` anywhere in the repo (`shared-pure`). Product-lib `shared/` also must not import `use-cases/`, `root/`, or `public/` (`ci:use-case-isolation`).
- Within and across feature packages, `client/` cannot import from `server/` and vice-versa (`client-not-server`, `server-not-client`).
- Other `@libs/*` may import a product lib only through `@libs/<pkg>/public/…`. Apps and tests may also import `@libs/<pkg>/root/…` (`ci:libs-import-surface`).
- Every `@pkgs/<utility>` micro-package (`assert`, `keyword`, `attribute`, `message`, `kv`, `sql-client`, `logger`, etc.) stays runtime-agnostic and feature-agnostic — no imports from `spaces`, `chess`, or any other product package.
- `apps/client` cannot reach any feature's `server/`; `apps/server` cannot reach any feature's `client/` (`apps-client-no-server`, `apps-api-no-client`).

# Agent Notes

## Hard Rules

- **Never leave deprecated code.** Do not add `@deprecated` markers, deprecated aliases, shim re-exports, or “kept for migration” optional fields. Delete the old API and update all call sites in the same change. Soft-deprecation / compatibility leftovers are banned.

- **All nondeterministic I/O is injected.** Product runtime (`apps/client`, `apps/server`, `apps/product`, `libs/*`, `pkgs/*`, including scripts) must not call bare `Date.now`, zero-arg `new Date()`, `performance.now`, `setTimeout` / `setInterval`, `fetch`, `crypto.randomUUID`, `Math.random`, or `crypto.getRandomValues`. Inject `Clock` / `Timers` (`@pkgs/clock`), HTTP (`@pkgs/http-client`), and `createId` / `random` (`@pkgs/uuid`) from composition roots (`createClient(env)` / `createServer(env)` / `createRoomServer(env)` / `createSim` via harness-only `virtualTimeRuntime()` / `Session` from `@pkgs/sim` / wall adapters at process entry). **`Session` / Runtime are harness-only** — only `@apps/product`, package `src/sim/` systems, and tests hold them; product `ClientEnv` / `ServerEnv` / `RoomServerEnv` receive unpacked `clock` / `timers` / `createId` / `random` / `http`. Never an `Io` bag (`wallIo` / `createSimIo` / `useIo` / `getIo` / `runWithIo`). Inject via Solid context (`ClockProvider` / `useClock` / `useTimers` / `useHttpClient` / `useCreateId`) or constructor/param — never silent wall fallbacks. Do **not** reintroduce `resolveNow` / `resolveTimers` / `resolveCreateId` / `resolveRandom` / `resolveClock`, or `cryptoCreateId` / `mathRandom`. `wallClock` / `wallTimers` / `createGlobalHttpClient()` / `crypto.randomUUID` are allowed only in **test files** or **entry-shaped** files marked `// @io-wall-ok` (`**/scripts/**`, wall adapters, `create-app` / `cli-io` / `polyfill-entry`, and similar process roots — see `tools/scripts/io-scan-pragma.ts`). **File content I/O goes through `@pkgs/object-store`:** libraries take an injected `ObjectStore` (sidecar layout for blobs, tree layout for source/CI trees). Wall `node:fs` only in `@io-wall-ok` adapters (`wall-node-fs.ts`). Process I/O (`spawn` / `chmod`) stays on `@pkgs/os` — not ObjectStore. **SQL engines must not mint time or ids:** no `DEFAULT now()`, `gen_random_uuid()`, `randomblob`, `strftime('now')`, `datetime('now')`, or bare SQL `now()` / `gen_random_uuid()` in DML — managed columns and framework timestamps come from injected `now` / `createId` (mutation wrap + store constructors); SQL stubs that must mention engine UUID helpers mark `@io-wall-ok` on an entry-shaped path. CI: Biome plugins under `tools/biome-plugins/` (via `bun run lint`) for bare I/O / FS / wall defaults / hard-determinism. Hard-determinism gotchas (floats, object key order, locale sorts, room `hash(state)`, LWW sync): see [`DETERMINISM.md`](DETERMINISM.md). **Scenario authoring** lives only in `@pkgs/sim`: packages declare `defineSystem` / `defineAction` / `defineProperty` (topology via `session.fork`; reads are plain functions of `S`; converge is a read + property, restoreNetwork/revive are the stimuli); the framework owns the run via `system.run` / `s.randomActions` / `system.explore` / `system.replay`. Do **not** add package-local World openers / kit DSLs. Kernel mechanics: Runtime/Session, virtual/wall schedulers, network, Recording. **Reporting is first-class in `@pkgs/sim` / `@pkgs/ui-testing` / `@pkgs/sim-report`:** `defineSnapshot` captures frames, `recordingDriver` turns UI ops into steps, `@pkgs/sim-report` `writeHtmlReport` renders one standalone `index.html` (Playwright-style `<sim-report>` web component). No report tabs, report servers, or console report viewers. Fresh-agent guide: [`pkgs/sim/README.md`](pkgs/sim/README.md).

- **Never patch dependencies.** Do not use `bun patch`, `patch-package`, `pnpm patch`, or any other dependency-patching mechanism. Do not add a `patches/` directory or a `patchedDependencies` / `pnpm.patchedDependencies` / `resolutions` field to `package.json`. If a third-party library has a bug, work around it in our own code or accept the behavior — never fork the dep in-tree.

- **Never disable structural size limits for app code.** The Tiger-Style caps in root [`biome.json`](biome.json) (`noExcessiveLinesPerFile`, `noExcessiveLinesPerFunction`, `useMaxParams`, `noExcessiveNestedCallbacks`, `noExcessiveCognitiveComplexity`, `noExcessiveClassesPerFile`) are load-bearing. Do **not** add new size-rule `'off'` overrides in `biome.json`, and do **not** add `biome-ignore` comments for those rules in source files. If a function tripped the cap, refactor it: extract sub-components, helper hooks, or pure helpers. The cap is the constraint, not a suggestion. The only legitimate exemptions are the test / known-path `overrides` already wired in `biome.json`.

- **Local SQLite + defineQuery/mutations is the default for client reads and writes.** Client UI reads local SQLite via `useQuery` (table-change reactivity). Status / paint gate come from `useSyncEngine()` (`status`, `paintReady`); writes go through `useMutationClient()` / `mutate()`. Server mounts one `createSyncApp` (query + mutations). Hydration uses event-driven `POST /api/query` (batch body: `{ queries }` → `{ responses }`) on initial connect plus pubsub pushes — not periodic polling; client mutations drain through `POST /api/mutations`. Do **not** add feature REST GET/POST for data that is (or can be) in the user’s sync scope. Absolute REST exceptions only: billing/external APIs. Prefer shrinking that list, never growing it casually. Username claims go through the `claimUsername` mutation (not REST). Profile bootstrap uses the `ensureProfile` mutation (auto username on upload). Sync wire is protocol v3 (`x-sync-protocol: 3`); pre-cut clients get `upgrade_required` without a local DB wipe. Mutation/query authoring derives write sets and wake topics from SQL AST capture + `defineTopicMap` (no hand-declared write/invalidate lists). `@pkgs/sync-engine` public API is five entrypoints only: `client`, `server`, `shared`, `sim`, `solid` (Solid bindings: `SyncEngineProvider` / `createQuery` / `useSyncEngine` / `useMutationClient`; hook-only `useMutationClient` may import `@pkgs/sync-engine/solid/mutation-client` so lazy routes do not pull `createMutationClient` / `node-sql-parser`).

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

  Domain mutation definitions and their SQL live under `libs/<feature>/src/use-cases/<use-case>/shared/`. The mutation environment contains the actor, account, and device identity.

- **Domain rows are soft-delete only.** Removals set managed `deleted_at` (never `DELETE FROM` domain tables). `defineQuery` snapshots **include** soft-deleted rows (tombstones on the wire, with `deleted_at` selected); UI / live client reads filter `deleted_at IS NULL`. Sync-engine merge upserts snapshot rows verbatim (including `deleted_at`) and rebases pending `sync_engine_mutations` on top — no absence GC, no `_row_scopes`. Unsubscribe / denied only clears `sync_engine_scope_meta`. Mutation `tx` rejects domain hard deletes at apply/replay (`NO_HARD_DELETE`). Framework tables (`sync_engine_mutations`, `sync_engine_scope_meta`, `sync_engine_write_rejections`, `sync_engine_mutations_applied`) may still hard-delete.

- **Style with Solid builtins via `@pkgs/ui`.** Prefer `class` / `classList` for layout and tokens; use `style` only for dynamic values hosts cannot express as classes. Do **not** use `sx` / `frameSx` / `fieldSx` (removed). Do **not** use class-merge helpers (`joinClass` / `cn` / `clsx` / `twMerge`) — only Solid's built-in `classList`. Scroll/list hosts take frame `class`/`style` and content `contentClass`/`contentStyle`. Crash UI (`root-error-boundary.tsx`) may still need exceptional inline styles. CI: Biome plugin `no-inline-style-prop.grit` (via `bun run lint`) bans `sx` / `frameSx` / `fieldSx`.

- **Three-layer DI (primitives / use cases / transaction-scoped).** Only `SqlClient` + `Io` are long-lived. Use-case classes take `(db, io)` and open transactions for writes (reads pass `db` as `SqlTx` without a write tx). Repositories/services/publishers/handlers take `SqlTx` (`Pick` of `query`/`run` from `SqlClient`) + `Io`, constructed on demand inside the use case — never eagerly on a container. Factory **functions** `(tx, io) => …` are the wiring escape hatch; no `*Container` / registry classes. Do not convert `defineMutation` / `defineQuery` `run` handlers or Solid hooks. Details: [`docs/dependency-injection.md`](docs/dependency-injection.md). CI: Biome plugin `no-di-container.grit` (via `bun run lint`).

- **Test layout.** Package-level tests live in `tests/` (sibling of `src/`). Colocate `module.test.ts` only next to public entrypoint modules. All tests are black-box against the package `exports` (no exceptions — no deep `src/` imports from tests). Sim harness code either lives in `src/sim/` and is exported as `./sim` (e.g. `@pkgs/sync-engine/sim`), or is peeled into a sibling `-sim` package (e.g. `@pkgs/room-sim`, `@pkgs/matchmaking-sim`, `@pkgs/auth-sim`).

## `@pkgs/ui` design system

`@pkgs/ui` is the only design-system surface in the repo. Every component, prop type, hook, and theme helper is implemented in-house under `pkgs/ui/src/components/**` and re-exported from `pkgs/ui/src/index.ts`. There is no adapter indirection, no swappable backend, and no third-party UI library — consumers always do `import { Button, Text, useTheme } from '@pkgs/ui';` and the import resolves to the in-house implementation directly.

### Solid reactivity

Solid components run once; reactivity is tracking, not re-render. Product UI freezes have come from treating Solid like React:

- **Never destructure component props** (`function Foo({ x })` or `const { x } = props`). Use `props.x` in JSX / memos / effects so updates track. Enforced by `solid/no-destructure`.
- **Hooks that expose lists / status return `Accessor`s** (e.g. `friends()`, `isLoading()`), not getter-bags that look like plain values. Destructuring `const { friends } = useFriends()` snapshots forever.
- **Do not derive UI once at setup** (`const pills = render(props.status)` outside `createMemo` / `<Switch>`). Compute inside a memo or render branch so status changes update the tree.
- **Pass `Accessor`s into hooks that subscribe** (`useFriendshipStatus(() => props.userId)`), or remount with `<Show when={id} keyed>`. Bare `string` props read at hook setup will not track.
- Lint: `eslint.config.mjs` full Solid block on `tools/port/solid-scope.json` `dirs`/`files`; product libs use `reactivityDirs` (core reactivity rules) and `noDestructureDirs` (spaces/chess — destructure only until Accessor-passing is ratcheted). Run `bun run lint:eslint` (`bun check` / deploy).

```
pkgs/ui/src/
  index.ts              # public API -- `export * from './components'` + theme/explorer/web helpers
  component-id/         # DOM identifiers (`componentDataSet`) for web inspector / E2E
  components/           # one folder per component (button/, text/, modal/, ...)
  theme/                # design tokens + `useTheme` hook
  navigation/           # app router + href helpers
  explorer/             # storybook-style explorer screens
  web/                  # web host adapters
```

**Adding a new component:**

1. Implement it under `pkgs/ui/src/components/<name>/<name>.tsx` (and an `index.ts` re-export inside the folder).
2. Add the public export to `pkgs/ui/src/components/index.ts`.
3. Style with `class` / `classList` / `style` on HTML elements — never `sx`, and never class-merge helpers (`joinClass` / `cn` / `clsx`). Composed components set `data-*` via `dataAttrs({ component: '<PascalName>', ... })` on the root (see `pkgs/ui/src/component-id/`).
4. `bun run --filter @pkgs/ui tc` and root `bun run lint` verify it wires up.

**DOM identifiers (dev + E2E only):** On web, every `@pkgs/ui` host exposes `data-component="<Name>"`. `ScreenBase` requires `screenId` and renders `data-screen`. These are stripped from production web bundles (`VITE_E2E` keeps them on for browser E2E).

### Mutation UX

Every mutation should make its outcome obvious. Pick the surface by weight, not by feature:

- **Destructive or confirm-first mutations** (sign out, leave / end space, delete, rename, wipe DB) → `MutationModal`. It runs the whole `idle → loading → success / error` lifecycle in place: success is dismissible, errors are retryable. Thin wrappers (`EndSpaceConfirmModal`, `useSignOutConfirmationModal`, …) compose over it. Stay on the current screen after success — dismiss the modal and let the UI respond to the underlying state change.
- **Lightweight, no-confirm actions** (join space, create space, anything that today was a bare `void doThing()`) → `Button` with `useMutationButton`. The button itself flips to a spinner, then a success check, then a retryable error face — no extra dialog. Omit `onSuccess` navigation; use `successHoldMs: 0` only when you need an immediate follow-up side effect (not route changes).
- **Screen form save / cancel** → `FormActionsFooter` in the `ScreenBase` `footer` slot, never header `actions`. It pins to the bottom above the safe-area inset so it stays visible while scrolling. The submit button is a `useMutationButton`, so saves show `Saving… → Saved` in place. Use Cancel or breadcrumbs to navigate away — do not `router.back()` from `onSuccess`.
- **Card-level inline async** (admin refreshers) → `useAsync` + compact `SuccessState` / `ErrorState` beneath the button.

`useMutationButton` and `MutationModal` both build on `useMutationLifecycle`, so the phase semantics stay identical across modal and inline surfaces.

Centered modals (`ModalContent`, `ResponsiveSurface`, `ConfirmationModal`, `MutationModal`) use width buckets only: `size="small" | "medium" | "large" | "fullWidth"` (default `medium`). Confirm dialogs stay on `medium`; wide inspectors use `large`; near-edge layouts use `fullWidth`. Do not pass custom width via ad-hoc style when a size bucket fits.

## CI / Turbo cache

GitHub Actions runs checks with `SECRETS_ENV=dev`. Turbo caching is **local + remote** when `TURBO_TOKEN` / `TURBO_TEAM` are present: `actions/cache` persists `.turbo` with **per-job** keys (restore/save via `.github/actions/turbo-cache`, save on failure), and `tools/scripts/turbo-ci-run.ts` passes `--cache=local:rw,remote:rw` against the self-hosted cache at `https://turborepo.chrisvouga.dev` (`TURBO_API`, injected via secrets-auth / `secrets-run`). Missing token/team is a hard error in CI. Platform-scoped leaves (`test:e2e`, `test:contract`) also hash `turbo-platform-key.json`, which `tools/scripts/turbo-ci-run.ts` rewrites on every run with `{platform, arch, bun}`: Turborepo's hash ignores the OS, so without it a macOS result satisfies a Linux run and macOS-only harnesses silently stop running there. `SIM_FIDELITY` and `POSTGRES_SCHEMA` are hashed globally (`globalEnv`), because they change what the sim and DB tests actually run — a fidelity-max result must never be served to a mem-fabric run. Framework inference is off (`--framework-inference=false`) so only explicit `turbo.json` `env` / `globalEnv` enter the hash. `TURBO_CACHE` may tighten modes but cannot drop remote when creds are present. Optional knobs `TURBO_LOG_ORDER` and `TURBO_TELEMETRY_DISABLED` remain derived defaults from provision. Look for `cache hit` / `cache miss` in Turbo output.

**Offline-first local secrets:** `bun run secrets:pull` exports Infisical `dev`+`prd` into gitignored `.cache/secrets/` (JSON maps + fingerprint + meta). `bun check` goes through `secrets-run`, which for `SECRETS_ENV=dev` prefers that cache and does **not** call Infisical when present (warns if older than 24h). Missing cache bootstraps once from Infisical when available. CI still injects secrets via secrets-auth (no disk cache required). `SECRETS_ENV=prd` / deploy stay Infisical-first. Without Turbo creds, `turbo-ci-run` uses `local:rw` so check still runs.

**One check surface:** `bun check` is the whole gate — `//#check` depends on the PR-body contract (`//#ci:pr-template`), Biome + vocab + Solid eslint, the ci gates (syncpack / depcruise / audit / i18n), `@apps/client#check:critical-path`, `tc`, `test`, the app builds (`@apps/server#build`, `@apps/room-server#build`), the scoped package `test:contract` / `test:e2e` leaves, `@libs/billing#billing:check`, `@libs/secrets#check` and `@tools#check:static`. PR CI and the deploy gate run that same set. `//#deploy` is a strict superset — it adds `@apps/server#check:api` (live probe), `@apps/client#check:bundle-budget` (needs the Vite web build; Slow-3G / low-end Android bar in [`docs/low-end-android-perf.md`](docs/low-end-android-perf.md)) and `@apps/server#smoke`, which pulls provision → migrate → room deploy → API deploy → product deploy → billing sync. Low-end device gates are **static** (critical-path + bundle-budget); runtime Lighthouse is manual only (`bun run --filter @apps/client check:lighthouse`), and coverage is a separate opt-in report (`bun run check:coverage`). Both check and deploy go through `secrets-run` → `turbo-ci-run`, which flattens aggregators to leaf tasks so the root `check` / `deploy` scripts never re-enter Turbo.

**Local → CI reuse:** run `bun run secrets:pull` then `bun check` (or `deploy:dev`) so Turbo remote creds are warm; push the same tree and the deployment pipeline reuses those remote artifacts for cacheable tasks. Match `SECRETS_ENV=dev` for PR CI; `prd` `build` hashes separately when `VITE_*` differ. Uncacheable steps (`cache: false`: the PR-template contract, check:api, provision, migrate, deploy, smoke, OTA) always re-run.

Object storage (TTS audio cache, etc.) uses **S3-compatible** storage via `@pkgs/object-store-s3/impl-s3`. The API Worker reads `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` plus `S3_BUCKET` / `S3_ENDPOINT` / `S3_REGION` at boot and injects a namespaced store through `createS3ObjectStore`, which always applies the injected root prefix (from `PRODUCT_CONFIG.objectStore.namespace`, e.g. `gamezilla/`) before feature-level prefixes (e.g. `tts-audio/`). The S3 transport layer rejects any wire key that does not start with that root prefix. **CI / fidelity-max** may boot **`@pkgs/minio-server`** (`http://127.0.0.1:9000`). Missing S3 secrets still fall back to an in-memory store so the Worker can boot. **Production** uses Infisical → Cloudflare R2 (`gamezilla-production`). Provision uses `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` to ensure R2 buckets and mint per-env S3 API tokens (endpoint `https://<accountid>.r2.cloudflarestorage.com`, region `auto`). After renaming Worker secret keys, delete any stale bindings not in the registry once (`wrangler secret bulk` does not remove old names). Every secret the app needs is defined in `libs/secrets/src/shared/secrets/registry.ts`; `bun check` / `bun run deploy` run `@libs/secrets#check` (validates both `dev` and `prd`).

## CI/CD job layout

Two workflow files, both on GitHub-hosted `ubuntu-latest` (the repo is private on
a plan without larger runners):

1. **PRs run exactly one check.** `.github/workflows/pr.yml` has a single job
   named `check` that runs `bun run check` with `SECRETS_ENV=dev` — the same
   `//#check` leaf set as the deploy gate, nothing more. It also re-runs on
   `edited` so a PR body edit re-validates `//#ci:pr-template`. Never split the
   check surface into per-check jobs: assign a new check to `//#check` in
   `turbo.json`, or add a `ci:*` root task, and it rides along in that one job.
   `//#deploy` is a strict superset of `//#check` (it adds
   `@apps/server#check:api`, `@apps/client#check:bundle-budget` and
   `@apps/server#smoke`, which pulls provision → migrate → room deploy → API
   deploy → product deploy → billing sync), so it is never listed as a
   `dependsOn` of another aggregator.
2. **`main` deploys in two stages.** `.github/workflows/deploy.yml` runs
   `canary-dev` (`SECRETS_ENV=dev bun run deploy`) and, only when that job
   succeeds, `release-prod` (`SECRETS_ENV=prd bun run deploy`,
   `environment: production`). Both jobs invoke `bun run deploy` with
   `SECRETS_ENV` set at the job level rather than the `deploy:dev` /
   `deploy:prd` aliases, which force `TURBO_UI=tui`. The dev stage is a
   rehearsal: it builds the real product bundle, applies migrations to the dev
   database and `wrangler deploy --dry-run`s all three workers, but serves no
   traffic — prod is still the first environment to receive worker code.
   `deploy:dev` never runs on PRs; the dev scope is a shared singleton and
   `@libs/db#migrate` / `@libs/secrets#provision` are not dry-run gated.

The two `test:e2e` leaves (`@pkgs/auth`, `@pkgs/sql-client-sqlite-web`) drive a
browser through `Bun.WebView`, which is macOS-only: they log a skip and exit 0
on other platforms, and `turbo.json` marks both `cache: false` so a macOS result
can never satisfy a Linux run. Do not re-enable caching for them.

CI pins Bun `1.4.2` (`packageManager`, `.github/actions/setup`). Do not downgrade
to 1.3.x: that resolver does not fall back to `.tsx` for wildcard subpaths, so
`@pkgs/*/solid` (and every import that resolves through a tsconfig `paths`
wildcard to a `.tsx` file) fails on the runner while passing locally.

Every PR check is required by GitHub, not by convention:
`tools/github-config/main-protection.json` (applied with `bun run github:config`)
requires everything that reports on the PR — ours and third-party apps' — against
the latest `main`, so GitHub itself refuses the merge until all of it is green.
**Agents never merge PRs** — no `gh pr merge`, no auto-merge, no merge queue;
merging is always a human decision on GitHub.

**`main` only moves through a merged PR.** GitHub enforces it — every setting
this repo applies on GitHub lives in `tools/github-config/` as the REST payload,
applied by `bun run github:config` (drift check `bun run github:config:check`):

- `main-protection.json` — a PR is required to change `main`, and direct pushes,
  force-pushes and deletions are rejected, admins included. **Required checks are
  never named here**: the script reads what actually reports on open PRs
  (`gh pr checks`, third-party apps included) and requires all of it, strictly
  (the branch must be up to date). Add, rename or drop a PR check and
  `bun run github:config` follows; pushed-only checks (the deploy jobs) are
  excluded because they never report on a PR. Verified by pushing to a protected
  branch with the local hook bypassed: `remote: - Changes must be made through a
  pull request.`
- `repo-settings.json` — `delete_branch_on_merge`, so merging a PR cleans up its
  branch, plus the merge-method policy: **merge commits only** — squash and
  rebase merges are disabled, so `main` keeps every PR's commit graph and merge
  base.

Two local layers back it up: `tools/githooks/pre-push` refuses pushes to
`refs/heads/main` (`core.hooksPath` is set by `.superset/setup.sh`, or
`bun run hooks:install`), and `.github/workflows/deploy.yml` fails before it
deploys any commit that is not associated with a pull request — that job also
re-runs the whole `check` leaf set first, so a merged-but-red PR cannot
ship. The other hook, `tools/githooks/pre-commit` (repo-wide
`lint tc --affected`), is opt-in per commit (`GIT_LINT_PRECOMMIT=1 git commit …`):
checks belong to PR CI, and `--affected` spans every package while a global
dependency is dirty.

## Superset workspaces

Every Superset workspace is a git worktree bootstrapped by
`.superset/setup.sh` (`bun install`, `.cache/secrets`, `apps/*/.env.local`),
torn down by `.superset/teardown.sh`, and launched from the Run button through
`.superset/run.sh`. `.superset/config.json` owns exactly those three keys;
per-machine extras belong in the gitignored `.superset/config.local.json`.

- **Ports.** `source .superset/port.sh` gives a workspace its own four-port
  block (`VITE_PORT`/`PREVIEW_PORT`, `POSTGRES_PORT`, `MINIO_API_PORT`,
  `MINIO_CONSOLE_PORT`); the Run pane sources it automatically, and any terminal
  that boots a sidecar (`@pkgs/postgres-embedded`, `@pkgs/minio-server`) must
  source it first. EMQX (`1883`/`8083`/`18083`), the e2e harness ports
  (`4177`/`4178`) and the wrangler preview (`8788`) stay machine-wide
  singletons: at most one workspace at a time may run something that binds them
  (fidelity-max sims, `test:contract`, `check:api`).
- **Checks.** PR CI owns `bun check` — it is the whole gate, so prefer
  `bun fmt` plus `bun run --filter <pkg> tc` and `bun run --filter <pkg> test`
  while iterating. Every PR body fills `.github/pull_request_template.md`
  completely; `//#ci:pr-template` fails the PR on a missing section, empty
  content or an unchecked box. Then run `/pr-ready`
  (`.agents/commands/pr-ready.md`) — the single PR command: it syncs with
  `main`, commits, pushes, opens/updates the PR, addresses review comments, and
  drives the PR check green. It never merges: a green PR is handed to a human.

## Local development

**Manual work is the product super-app.** `bun run dev` starts **`@apps/product`** (wall client at `/`, Simulator at `/simulator` — flat sibling screens linked only through their command palettes (`Open Simulator` / `Exit simulator`), no tab bar or console chrome; default SQL fabric for sims is **postgres-mem** server + **sqlite-mem** clients). Sim test reports are standalone HTML artifacts (`bun run test:product:report` → `apps/product/sim-report/index.html`, built by `@pkgs/sim-report` `writeHtmlReport`), never a console tab or a report server. It does **not** start Wrangler, real Postgres, MinIO, or EMQX. Standalone client remains available (`bun run dev:client` → `@apps/client` only).

**Highest-fidelity local run** — `bun run stack` runs the whole product in the foreground
loopback: embedded Postgres, MinIO, EMQX, a **simulated Google IdP on its own
port with its own internal state** (`@pkgs/idp-google-sim`), N Bun API
instances running the production Worker handler, and a round-robin load
balancer in front of them (room WebSockets are hashed by topic so a room keeps
one authority, as a Durable Object does). Every port is OS-assigned and the
addresses are published to `.cache/localhost-stack/<instance>.json`, so
several stacks run concurrently. `bun run test:product:localhost` boots one,
runs the sim suite against it with `SIM_MODE=stack`, and tears it down. See
[`tools/scripts/localhost-stack/README.md`](tools/scripts/localhost-stack/README.md).

**Sign-in has one provider: Google.** There is no dev/test IdP route in the
API. Simulations and the localhost stack both run `@pkgs/idp-google-sim`,
which serves Google's real endpoints (PKCE, code exchange, userinfo, JWKS)
so the production `google-oauth.ts` path is the path under test. Point it
somewhere else with the `GOOGLE_IDP_ORIGIN` Worker binding; unset means real
Google.

Representativeness of production is **port contract matrices** (postgres-mem / sqlite-mem vs live engines, Kv, ObjectStore, PubSub, billing/TTS/LLM stubs) plus `@apps/product` `openSim({ fidelity: 'max' })` / `SIM_FIDELITY=max` for embedded real Postgres (+ MinIO/EMQX). Sidecar processes live in `@pkgs/postgres-embedded`, `@pkgs/minio-server`, `@pkgs/emqx-server` and are booted from tests/CI (`tools/scripts/boot-local-stack.ts`, `tools/scripts/boot-embedded-postgres.ts`).

`@apps/product` migrates the mem fabric **once** (`seed:sim-db` → `apps/product/.cache/sim-backend-seed.pgmm.json`) and clones per `openSim`. Mem-engine wishlist: [`docs/sim-mem-engine-wishlist.md`](docs/sim-mem-engine-wishlist.md). Suite notes: [`apps/product/src/test/setup/TESTING.md`](apps/product/src/test/setup/TESTING.md).

Production (`SECRETS_ENV=prd`) uses Infisical Neon + Cloudflare R2 (+ Railway EMQX) only.

- **`bun run sims:open`** — multiselect project sims and open Simulator.app.
- **`bun run dev`** — `@apps/product` super-app (`/` = real client, `/simulator` = Simulator; `?simulator` on `/` hands off). Press **`i`** or **Shift+I** to open the project iPad in the simulator (bypasses the default simulator picker).
- **`bun run dev:client`** — `@apps/client` standalone only (no product console).
- **Sign-in in the simulator** — Google against the in-process simulated IdP node.
- **Optional clouds** — still degrade in the real API Worker when secrets are missing.
- **`bun db:migrate`** — migrates `DATABASE_URL` (CI / after booting embedded Postgres). Not part of daily `bun dev`.
- **`bun run db:wipe:dev`** — secrets env `dev` only; destructive on the resolved non-prod URL.
- **Production** — only `bun run infra` sets `SECRETS_ENV=prd`.

### Database migrations (`@pkgs/db-migrate`)

Server SQL migrations are expressed only as `DatabaseMigration` classes (interface + `ComposedDatabaseMigration.register` from `@pkgs/db-migrate`). Each package owns its unit (`SyncEngineDatabaseMigration`, `KvPostgresDatabaseMigration`, `PostgresSchemaDatabaseMigration`, …); `@libs/runtime/server/run-postgres-migrations` (`PostgresMigrationRunner`) composes them (including `PostgresAdvisoryLockedTransactionMigration` for the migrate mutex).

**Domain tables** are declared with `defineTable` in each feature lib’s `shared/schema/` (exported via `public/schema.ts`), composed by `registerTables` in `@libs/runtime/root/app-schema`, and applied only through `@pkgs/db-schema-postgres` / `@pkgs/db-schema-sqlite` migration classes (no public `reconcile` API). **Do not add raw `.sql` schema files** under `libs/` / `pkgs/` / `apps/`.

**Framework / infra tables** (sync-engine, outbox, kv, entity-store, matchmaking) are also declared with `defineTable` + package-local `registerTables`, then applied via package `*DatabaseMigration` wrappers (`PostgresSchemaDatabaseMigration` / `SqliteSchemaDatabaseMigration` / `applySqliteSchema`). They are **not** registered in product `appSchema` (not synced). Soft-delete + managed `id` / timestamps apply; former custom PKs become `uniqueIndexes`. One-shot cutover migrations may rebuild legacy shapes before reconcile. **IdP tables** (`idp_*` in `@pkgs/auth`) use the same `defineTable` pattern and are also **not** in `appSchema`.

**Never author `CREATE TABLE` strings** in product or test code — use `defineTable` + `applySqliteSchema` / `applyPostgresSchema` / `*SchemaDatabaseMigration`. The only DDL emitters are `@pkgs/db-schema-postgres` / `@pkgs/db-schema-sqlite` `emit.ts`. Biome grit `no-raw-create-table` enforces this.

Do not add ad-hoc `migrateUp` / free-function DDL entrypoints for new schema — implement `defineTable` + register (app-schema for synced domain; package-local schema for infra). `@apps/server` owns URL/policy/retry orchestration (`migratePostgresApp` / `migrate-cli.ts`); tests/CI boot `@pkgs/postgres-embedded` then call api migrate/seed scripts. Root `db:migrate` / infra shell out to `apps/server/src/db/migrate-cli.ts` (apps must not import other `@apps/*` packages).

### Database safety (Tiger policy)

Non-deploy contexts must never reach production Postgres. Guards live in `@libs/db/public/database-url-policy`:

1. **`assertDevSecretsEnv`** — scripts exit unless `SECRETS_ENV === 'dev'`.
2. **`assertNonProdDatabaseUrl`** — rejects URLs equal to secrets env `prd` `DATABASE_URL` and production-only hostnames (dual-fetch at setup/migrate time). Loopback (`@pkgs/postgres-embedded`) is allowed for `dev`.
3. **API worker** — when `SECRETS_ENV` binding is `dev`, the first DB request asserts non-prod URL.
4. **Review** — every DATABASE_URL entrypoint must wire `assertDevSecretsEnv` / `assertNonProdDatabaseUrl` from `@libs/db/public/database-url-policy`.
5. **Escape hatch** — `ALLOW_PRODUCTION_DATABASE_URL=1` (mirrors `VITE_ALLOW_PRODUCTION_API_URL` for the API). `db:wipe:dev` refuses this hatch and requires a live `prd` dual-fetch before any destructive SQL.

## Per-feature package layout

Workspace packages live under three top-level tier directories with matching npm scopes — pick the tier that fits the package's role:

| Tier | Path    | Scope    | Contains                                                           |
| ---- | ------- | -------- | ------------------------------------------------------------------ |
| Apps | `apps/` | `@apps/` | Deployed product surfaces (`server`, `room-server`) plus the composition hub `product` (www super-app: wall client + Tests/Simulator, shared System + hosts, `openSim` / scenarios). `@apps/client` remains a standalone library/app for local `dev:client` (not deployed). |
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

Exempt (no request to trace; keep their current trees): `@libs/db`, `@libs/secrets`, `@libs/games`, `@libs/runtime`, `@libs/test-ids`.

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

Feature-specific scripts (seeders, dev refreshers, migration runners) live in `<tier>/<name>/scripts/` and are wired up via the package's `scripts` block in `package.json` (e.g. `bun run --filter @libs/<name> seed:<x>`). Root Biome still formats/lints package sources; `**/scripts/**` overrides relax console + cognitive-complexity noise for long CLI orchestrators. Add `./scripts/**/*.ts` to the package `tsconfig.tc.json` `include` and the root `tsconfig.json` `include` so type-checking covers them. Package `"tc"` scripts use `tsc --noEmit -p ./tsconfig.tc.json` so scoped CI checks stay fast while the IDE language service uses the root mega-project (Rename Symbol / Find All References across packages). Do not name the package config `tsconfig.json` — that steals file ownership from the root and breaks cross-package rename. Exception: `apps/client/tsconfig.json` (app router).

`apps/client/src/app/**` (app router) and `apps/server/src/api.ts` (worker entry) stay as 1-line re-export stubs that point at the feature packages — that keeps URL routes and the `RoomServerDurableObject` Durable Object class binding stable.

### Current feature packages

- `@apps/product` — www super-app (`/` wall client, `/simulator` Simulator), shared product System + fabric (`createSim`, SQL engines, net/fetch, snapshots) and registered hosts (`in-process`, `bun-webview`), plus the test harness (`openSim` / scenarios). Console and test call `product.run({ runtime })` only; neither owns a parallel boot.

- `@libs/runtime` — product composition hub: `defineTable` tables from feature libs composed via `registerTables` in `root/app-schema.ts`; sync topic map in `root/app-topic-map.ts`; Postgres migrate runner in `server/run-postgres-migrations.ts`. **`@libs/runtime` is the sole lib allowed to import other `@libs/*`.** Framework tables (`sync_engine_*`, outbox, kv, …) are owned by their packages via package-local `defineTable` schemas + `*DatabaseMigration` (not in `appSchema`). Domain mutations validate and apply their own authorized SQL against declared table names.

- `@libs/auth` — sign-in flows, sessions, devices, account-scoped local SQLite, auth port/adapters + Postgres migrations runner.
- `@libs/chess` — chess board UI, puzzle play / picker, settings. The chess puzzle seeding script lives in `libs/chess/scripts/seed-chess-puzzles.ts` (run via `bun run chess:puzzles:seed`); it assumes the schema has already been migrated by `bun run db:migrate`. Every sim host seeds puzzles on boot (Node: `apps/product/fixtures/chess-puzzles.sim.csv`, 3 documented puzzles; web / product-simulator: the inline 50-row fixture in `apps/product/src/sim/setup/`), so `bun run dev` and scenario tests never need a manual seed. Feed config is one shared signal per chess surface (`ChessPuzzleFeedProvider`); the pool syncs per rating band around the effective rating (`chessPuzzlePoolRangesForRating`). Puzzle scenarios: `bun run --filter @apps/product test:chess`.
- `@libs/client-config` — synced runtime config (`client_config` key/value scalar rows). Worker materializes from secrets via `EnsureClientConfigMaterialized` (no HTTP); clients read local SQLite via `useClientConfig`. Client runtime knobs (EMQX WSS URL, observability backend) live here — not in `VITE_*` build-time env (API URL / commit provenance / E2E / Watchman stay build-time env).
- `@libs/profile` — public profile, dicebear avatar editor, username generator (vertical slices: ensure-local, patch-avatar, ensure-online, set-username).
- `@libs/spaces` — spaces / lobby / multiplayer plumbing, game dispatch via `space-module.ts` (lifecycle mutations as vertical slices: create/join/leave/end/rename/set-visibility).
- `@libs/billing` — billing checkout/portal routes and product catalog SPEC (vendor via `@pkgs/billing-stripe`).
- `@libs/friends` — friendship graph (vertical slices per mutation: send/accept/decline/cancel/remove/block/unblock).

### Adding a new game

Each game is its own package modelled after `@libs/chess`. To add `@libs/connect-four` (or numberlink, tic-tac-toe, battleship, etc.):

1. Prefer `bun run scaffold:game -- <kebab-name>` (creates `RoomModule` with required `hash(state)`, `*.sim.test.ts` / unit skeletons, no wall globals). Or scaffold `libs/<game>/` manually:
   - `package.json` with `"name": "@libs/<game>"`, per-file `exports`, deps mirroring what the implementation actually imports (typically a granular subset of the `@pkgs/<util>` micro-packages — `assert`, `keyword`, `attribute`, etc. — plus `@pkgs/sync-engine`, `@lingui/*`, `solid-js`).
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

### Layering rules (enforced by depcruise)

**Tier pyramid** — one-way dependencies between tiers, enforced by depcruise rules `pkgs-not-libs`, `pkgs-not-apps`, `libs-not-apps` (path-based; relative-import escape hatch):

```text
apps    →  apps, libs, pkgs (cross-app OK e.g. client → server; apps/product is the composition hub and may compose other apps)
libs    →  pkgs only
pkgs    →  pkgs only (leaf tier: reusable, app-agnostic)
```

`pkgs/` packages are the foundation: they must work in any monorepo, with no references to `gamezilla`, `apps/server`, `@libs/*`, or any product surface (in code, comments, or default config strings).

**Other layering rules:**

- `@apps/product` composes product apps (sim fabric / hosts, product-simulator, system worlds, test harness). libs/pkgs must not import `@apps/*`.
- `@apps/<name>` may import other `@apps/<other>` (e.g. client composing the in-process sim Hono factory). Same-package deep imports and type-only `import type` are fine.
- **`@apps/server` Hono/runtime source is isomorphic.** Platform engines (`pg`, `node:*`, …) live only behind injected ports (e.g. `OpenSqlClient`) and `@api-wall-ok` adapter/entry modules. Isomorphic files must not import wall modules.
- `shared/` cannot import from `client/` or `server/` anywhere in the repo (`shared-pure`). Product-lib `shared/` also must not import `use-cases/`, `root/`, or `public/`.
- Within and across feature packages, `client/` cannot import from `server/` and vice-versa (`client-not-server`, `server-not-client`).
- Other `@libs/*` may import a product lib only through `@libs/<pkg>/public/…`. Apps may also import `@libs/<pkg>/root/…`.
- Every `@pkgs/<utility>` micro-package (`assert`, `keyword`, `attribute`, `message`, `kv`, `sql-client`, `logger`, etc.) stays runtime-agnostic and feature-agnostic — no imports from `spaces`, `chess`, or any other product package.
- `apps/client` cannot reach any feature's `server/`; `apps/server` cannot reach any feature's `client/` (`apps-client-no-server`, `apps-api-no-client`).

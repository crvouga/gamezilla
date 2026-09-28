# Agent Notes

## Hard Rules

- **We never test manually. Ever.** A green `bun check` is the whole release decision; nothing is verified by hand — no click-through, no QA pass, no "tested locally", not once. Running the app (`bun run dev`, `bun run stack`, the Harness) is for building and debugging, never evidence. If you want to look at the app to know a change works, a check is missing: write it. If no check can reach the behavior, change the product until one can. **Exploratory tests are property-based or model-based** (`assertProperty` from `@pkgs/property` — raw `fc.assert` / `fc.sample` are banned as unseeded; `fc.commands` models; `@pkgs/harness` systems; Quint models in `specs/<domain>/*.qnt` for product features — no product random walks). **Regression tests are example-based**: every bug found gets the literal failing input pinned as an example test marked `// regression: <bug-id>` and an entry in `libs/tools/goal/known-bugs.json` — a property is never the guard. Delete example tests a property subsumes unless they pin a bug or a decided value. No skipped / `.only` / `.todo` / `.if` / `.failing` tests, no `--pass-with-no-tests`, no retries, no test file outside a gate script. Tests are in-process on virtual time and must be fast. Policy and enforcement: [`docs/TESTING.md`](docs/TESTING.md).

- **Specs are for business readers.** Every line in `specs/` must be understood by a non-technical business person (A0 in [`docs/SPEC_STANDARDS.md`](docs/SPEC_STANDARDS.md)); every behavior and e2e test is a spec; each framework package tests through one kitchen-sink example app ([`docs/TESTING.md`](docs/TESTING.md) § "One example app per package").

- **Never leave deprecated code.** Do not add `@deprecated` markers, deprecated aliases, shim re-exports, or “kept for migration” optional fields. Delete the old API and update all call sites in the same change. Soft-deprecation / compatibility leftovers are banned.

- **Access is decided only by `@libs/permissions`.** Feature gates, usage limits, upsells and "sign in to…" prompts all come from a permission decision: `useCan` / `useDecision` / `usePermissions` on the client, `requireInMutation` / `decideInMutation` in mutation bodies (same synced rows locally and on replay), `requirePermission` in server routes. What a denial unlocks (sign in, see plans) is policy config (`unlockRefs`), rendered by `DenialSurface` or run by `useUnlock` — never a feature's own branch. Sign-in state and membership are facts private to auth, billing and permissions: no product code outside them reads `isAnon` / `isSignedIn`, imports `@libs/auth/public/access-facts`, queries `is_anon` / `billing_subscriptions`, or names a role or plan (`@libs/permissions/root/access-model` is for tests and the policy-materializing root only). Billing shows its own membership; the shell chrome shows identity, never a tier or signed-in label. Account-only actions deny anonymous subjects through a policy restriction (`reason: 'requires_account'`), not code. CI: Biome plugins `import-access-facts.grit`, `import-access-model.grit`, `no-access-state-vocabulary.grit`, `no-tier-vocabulary*.grit` (via `bun run lint`).

- **All nondeterministic I/O is injected.** Product runtime (`apps/client`, `apps/server`, `apps/product`, `libs/*`, `pkgs/*`, including scripts) must not call bare `Date.now`, zero-arg `new Date()`, `performance.now`, `setTimeout` / `setInterval`, `fetch`, `crypto.randomUUID`, `Math.random`, or `crypto.getRandomValues`. Inject `Clock` / `Timers` (`@pkgs/clock`), HTTP (`@pkgs/http-client`), and `createId` / `random` (`@pkgs/uuid`) from composition roots (`createClient(env)` / `createServer(env)` / `createRoomServer(env)` / `createHarness` via harness-only `virtualTimeRuntime()` / `Session` from `@pkgs/harness` / wall adapters at process entry). **`Session` / Runtime are harness-only** — only `@libs/harness`, `@apps/product`, package `src/harness/` systems, and tests hold them; product `ClientEnv` / `ServerEnv` / `RoomServerEnv` receive unpacked `clock` / `timers` / `createId` / `random` / `http`. Never an `Io` bag (`wallIo` / `createHarnessIo` / `useIo` / `getIo` / `runWithIo`). Inject via Solid context (`ClockProvider` / `useClock` / `useTimers` / `useHttpClient` / `useCreateId`) or constructor/param — never silent wall fallbacks. Do **not** reintroduce `resolveNow` / `resolveTimers` / `resolveCreateId` / `resolveRandom` / `resolveClock`, or `cryptoCreateId` / `mathRandom`. `wallClock` / `wallTimers` / `createGlobalHttpClient()` / `crypto.randomUUID` are allowed only in **test files** or **entry-shaped** files marked `// @io-wall-ok` (`**/scripts/**`, wall adapters, `create-app` / `cli-io` / `polyfill-entry`, and similar process roots — see `libs/tools/biome-plugins/no-bare-io.grit`). **File content I/O goes through `@pkgs/object-store`:** libraries take an injected `ObjectStore` (sidecar layout for blobs, tree layout for source/CI trees). Wall `node:fs` only in `@io-wall-ok` adapters (`wall-node-fs.ts`). Process I/O (`spawn` / `chmod`) stays on `@pkgs/os` — not ObjectStore. **SQL engines must not mint time or ids:** no `DEFAULT now()`, `gen_random_uuid()`, `randomblob`, `strftime('now')`, `datetime('now')`, or bare SQL `now()` / `gen_random_uuid()` in DML — managed columns and framework timestamps come from injected `now` / `createId` (mutation wrap + store constructors); SQL stubs that must mention engine UUID helpers mark `@io-wall-ok` on an entry-shaped path. CI: Biome plugins under `tools/biome-plugins/` (via `bun run lint`) for bare I/O / FS / wall defaults / hard-determinism. Hard-determinism gotchas (floats, object key order, locale sorts, room `hash(state)`, LWW sync): see [`docs/DETERMINISM.md`](docs/DETERMINISM.md). **Scenario authoring** lives only in `@pkgs/harness`: packages declare `defineSystem` / `defineAction` / `defineProperty` (topology via `session.fork`; reads are plain functions of `S`; converge is a read + property, restoreNetwork/revive are the stimuli); the framework owns the run via `system.run` / `s.randomActions` / `system.explore` / `system.replay`. Do **not** add package-local World openers / kit DSLs. Kernel mechanics: Runtime/Session, virtual/wall schedulers, network, Recording. **Reporting is first-class in `@pkgs/harness` / `@pkgs/ui-testing` / `@pkgs/harness-report`:** `defineSnapshot` captures frames, `recordingDriver` turns UI ops into steps, `@pkgs/harness-report` `writeHtmlReport` renders one standalone `index.html` (Playwright-style `<harness-report>` web component). No report tabs, report servers, or console report viewers. Fresh-agent guide: [`pkgs/harness/README.md`](pkgs/harness/README.md).

- **One naming convention.** Markdown docs are `SCREAMING_SNAKE_CASE.md` (`README.md`, `docs/GOAL.md`); every other file and every directory is `lower-kebab-case` with a lowercase extension chain (`foo-bar.test.ts`, `icon@2x.png`). Repo-wide docs live in `docs/`; package docs in `<pkg>/docs/` (only `README.md` sits at the package root). Tool-mandated names (`Dockerfile`, `Caddyfile`, `.agents/commands/<command-id>.md`, …) are the only exemptions, listed in `NAMING_EXEMPT` (`libs/tools/naming/naming-rules.ts`) — extend that list rather than bypassing the gate. CI: every package's `lint` checks its own paths (`bun run lint:naming` sweeps the whole repo in ~50 ms). Fix: `bun run naming:fix` (dry run) then `--write` — renames the paths and rewrites every import, asset URL, config path and doc link that points at them; review its heuristic / manual-review output.

- **Never patch dependencies.** Do not use `bun patch`, `patch-package`, `pnpm patch`, or any other dependency-patching mechanism. Do not add a `patches/` directory or a `patchedDependencies` / `pnpm.patchedDependencies` / `resolutions` field to `package.json`. If a third-party library has a bug, work around it in our own code or accept the behavior — never fork the dep in-tree.

- **Infrastructure is OpenTofu, and stateful resources are never destroyed.** Every deployed resource (Workers' hostnames, R2 buckets and credentials, DNS, the EMQX broker on Railway, the Grafana Cloud stack, the secrets OpenTofu derives) is declared in `libs/infra/tofu` — env-agnostic modules and stacks; per-environment values only in `libs/infra/tofu/envs/<env>.tfvars.json`. Never create, change or delete infrastructure from TypeScript, a script or a console (Biome `no-infra-outside-tofu.grit` fails `lint` on vendor admin endpoints). Never delete or replace anything that may hold data: stateful resources carry `prevent_destroy`, and `libs/infra/policy/stateful.rego` (run on every plan by `libs/infra/scripts/tofu.ts`) allow-lists the only types that may ever be deleted — add a new type to `deletable` only if losing it loses no data. Retire a stateful resource with `removed { lifecycle { destroy = false } }`. What code must never create (the Neon project and its root branch, shared secrets, the one Google OAuth redirect URI) is set once by a person and asserted, never managed; everything per-environment — Infisical environment and shared-secret import (`fleet` stack), Neon branch + endpoint + `DATABASE_URL`, buckets, broker, tokens — comes from the env file, so a new `envs/<env>.tfvars.json` needs no manual step anywhere. There is no destroy path. Guide: [`docs/INFRA.md`](docs/INFRA.md).

- **Never disable structural size limits for app code.** The Tiger-Style caps in root [`biome.json`](biome.json) (`noExcessiveLinesPerFile`, `noExcessiveLinesPerFunction`, `useMaxParams`, `noExcessiveNestedCallbacks`, `noExcessiveCognitiveComplexity`, `noExcessiveClassesPerFile`) are load-bearing. Do **not** add new size-rule `'off'` overrides in `biome.json`, and do **not** add `biome-ignore` comments for those rules in source files. If a function tripped the cap, refactor it: extract sub-components, helper hooks, or pure helpers. The cap is the constraint, not a suggestion. The only legitimate exemptions are the test / known-path `overrides` already wired in `biome.json`.

- **Local SQLite + defineQuery/mutations is the default for client reads and writes.** Client UI reads local SQLite via `useQuery` (table-change reactivity). Status / paint gate come from `useSyncEngine()` (`status`, `paintReady`); writes go through `useMutationClient()` / `mutate()`. Server mounts one `createSyncApp` (query + mutations). Hydration uses event-driven `POST /api/query` (batch body: `{ queries }` → `{ responses }`) on initial connect plus pubsub pushes — not periodic polling; client mutations drain through `POST /api/mutations`. Do **not** add feature REST GET/POST for data that is (or can be) in the user’s sync scope. Absolute REST exceptions only: billing/external APIs. Prefer shrinking that list, never growing it casually. Username claims go through the `claimUsername` mutation (not REST). Profile bootstrap uses the `ensureProfile` mutation (auto username on upload). Sync wire is protocol v3 (`x-sync-protocol: 3`); pre-cut clients get `upgrade_required` without a local DB wipe. Mutation/query authoring derives write sets and wake topics from SQL AST capture + `defineTopicMap` (no hand-declared write/invalidate lists). `@pkgs/sync-engine` public API is five entrypoints only: `client`, `server`, `shared`, `harness`, `solid` (Solid bindings: `SyncEngineProvider` / `createQuery` / `useSyncEngine` / `useMutationClient`; hook-only `useMutationClient` may import `@pkgs/sync-engine/solid/mutation-client` so lazy routes do not pull `createMutationClient` / `node-sql-parser`).

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

- **Three-layer DI (primitives / use cases / transaction-scoped).** Only `SqlClient` + `Io` are long-lived. Use-case classes take `(db, io)` and open transactions for writes (reads pass `db` as `SqlTx` without a write tx). Repositories/services/publishers/handlers take `SqlTx` (`Pick` of `query`/`run` from `SqlClient`) + `Io`, constructed on demand inside the use case — never eagerly on a container. Factory **functions** `(tx, io) => …` are the wiring escape hatch; no `*Container` / registry classes. Do not convert `defineMutation` / `defineQuery` `run` handlers or Solid hooks. CI: Biome plugin `no-di-container.grit` (via `bun run lint`).

- **Test layout.** Package-level tests live in `tests/` (sibling of `src/`). Colocate `module.test.ts` only next to public entrypoint modules. All tests are black-box against the package `exports` (no exceptions — no deep `src/` imports from tests). Harness code either lives in `src/harness/` and is exported as `./harness` (e.g. `@pkgs/sync-engine/harness`), or is peeled into a sibling `-harness` package (e.g. `@pkgs/room-harness`, `@pkgs/matchmaking-harness`, `@pkgs/auth-harness`). **`bun test` is the only test runner** — no Vitest / Jest (Biome `no-vitest.grit`). Solid / DOM tests run in the same `bun test` invocation with `--conditions=browser --conditions=development --preload @pkgs/bun-test-solid/preload` (Babel Solid + Lingui transform, happy-dom, jest-dom matchers; types via `@pkgs/bun-test-solid/jest-dom`).

## Debugging with observability

Run `bun obs` before adding logging or rerunning a failed test. The trace artifact is
the first debugging surface in local development, CI, and production:

- “It just happened” with no identifier → `bun obs last`.
- Any trace, session, mutation, test, device, or user ID →
  `bun obs find <identifier>`.
- Slow behavior → `bun obs slow`; unexplained write →
  `bun obs mutation <mutation-id>`.
- Failing e2e → `bun obs test '<test name>' --source <downloaded-artifact>`.
- Production alert → run the literal `bun obs … --source prod` command in the alert.

Examples:

```sh
bun obs last --window 10m
bun obs find 4f2c17d8 --source .observability
bun obs test 'offline edits converge' --source artifacts
```

Observability explains interactions, requests, mutations, sync, SQL, and failures. It
does not replace browser screenshots/devtools for visual or CSS bugs, code reading for
Solid signal wiring, or compiler output for build/type errors. For visual failures use
browser tooling plus `bun obs last` to recover the state-changing activity behind the
render. See [`docs/OBSERVABILITY.md`](docs/OBSERVABILITY.md).

## `@pkgs/ui` design system

`@pkgs/ui` is the only design-system surface in the repo. Every component, prop type, hook, and theme helper is implemented in-house under `pkgs/ui/src/components/**` and re-exported from `pkgs/ui/src/index.ts`. There is no adapter indirection, no swappable backend, and no third-party UI library — consumers always do `import { Button, Text, useTheme } from '@pkgs/ui';` and the import resolves to the in-house implementation directly.

### Solid reactivity

Solid components run once; reactivity is tracking, not re-render. Product UI freezes have come from treating Solid like React:

- **Never destructure component props** (`function Foo({ x })` or `const { x } = props`). Use `props.x` in JSX / memos / effects so updates track. Enforced by `solid/no-destructure`.
- **Hooks that expose lists / status return `Accessor`s** (e.g. `friends()`, `isLoading()`), not getter-bags that look like plain values. Destructuring `const { friends } = useFriends()` snapshots forever.
- **Do not derive UI once at setup** (`const pills = render(props.status)` outside `createMemo` / `<Switch>`). Compute inside a memo or render branch so status changes update the tree.
- **Pass `Accessor`s into hooks that subscribe** (`useFriendshipStatus(() => props.userId)`), or remount with `<Show when={id} keyed>`. Bare `string` props read at hook setup will not track.
- Lint: oxlint (`oxlint.config.mts`, eslint-plugin-solid loaded as a JS plugin, type-aware rules through oxlint-tsgolint) runs the full Solid set — typescript strict + stylistic, jsx-a11y strict, every applicable `solid/*` rule — on `libs/tools/port/solid-scope.json` `dirs`/`files`; product libs use `reactivityDirs` (core reactivity rules) and `noDestructureDirs` (spaces/chess — destructure only until Accessor-passing is ratcheted). A JS `switch` in a PascalCase component is banned everywhere by the Biome plugin `no-switch-in-component.grit` (use `<Switch>`/`<Match>`). Suppress with `oxlint-disable-next-line <rule> -- reason`; unused suppressions fail. Runs inside each package's `lint` (`bun check` / deploy).

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

**DOM identifiers:** On web, every `@pkgs/ui` host exposes `data-component="<Name>"`. `ScreenBase` requires `screenId` and renders `data-screen`. These are stripped from production web bundles (`VITE_E2E` keeps them on for browser E2E). Call-site test ids (`dataSet={{ testid }}` → `data-testid`) are **not** stripped: the production synthetic journeys (`@apps/product#health`) drive the real bundle by `data-testid`, so every host ships them in every build.

### Mutation UX

Every mutation should make its outcome obvious. Pick the surface by weight, not by feature:

- **Destructive or confirm-first mutations** (sign out, leave / end space, delete, rename, wipe DB) → `MutationModal`. It runs the whole `idle → loading → success / error` lifecycle in place: success is dismissible, errors are retryable. Thin wrappers (`EndSpaceConfirmModal`, `useSignOutConfirmationModal`, …) compose over it. Stay on the current screen after success — dismiss the modal and let the UI respond to the underlying state change.
- **Lightweight, no-confirm actions** (join space, create space, anything that today was a bare `void doThing()`) → `Button` with `useMutationButton`. The button itself flips to a spinner, then a success check, then a retryable error face — no extra dialog. Omit `onSuccess` navigation; use `successHoldMs: 0` only when you need an immediate follow-up side effect (not route changes).
- **Screen form save / cancel** → `FormActionsFooter` in the `ScreenBase` `footer` slot, never header `actions`. It pins to the bottom above the safe-area inset so it stays visible while scrolling. The submit button is a `useMutationButton`, so saves show `Saving… → Saved` in place. Use Cancel or breadcrumbs to navigate away — do not `router.back()` from `onSuccess`.
- **Card-level inline async** (admin refreshers) → `useAsync` + compact `SuccessState` / `ErrorState` beneath the button.

`useMutationButton` and `MutationModal` both build on `useMutationLifecycle`, so the phase semantics stay identical across modal and inline surfaces.

Centered modals (`ModalContent`, `ResponsiveSurface`, `ConfirmationModal`, `MutationModal`) use width buckets only: `size="small" | "medium" | "large" | "fullWidth"` (default `medium`). Confirm dialogs stay on `medium`; wide inspectors use `large`; near-edge layouts use `fullWidth`. Do not pass custom width via ad-hoc style when a size bucket fits.

## CI / Turbo cache

GitHub Actions runs checks with `SECRETS_ENV=dev`. Turbo caching is **local + remote** when `TURBO_TOKEN` is present (`TURBO_TEAM` is the code constant `local`): `libs/tools/scripts/turbo-ci-run.ts` passes `--cache=local:rw,remote:rw` against the self-hosted cache at `https://turborepo.chrisvouga.dev` (`TURBO_API`, injected via secrets-auth / `secrets-run`). A missing token is a hard error in CI. CI does **not** persist `.turbo` with `actions/cache` — the remote cache is the only cross-run cache. **Every run plans first** ([`turbo-preflight.ts`](libs/tools/scripts/turbo-preflight.ts)): `turbo run --dry=json` asks both caches about every task (~1s); all hits means the gate already passed for these inputs and turbo is not run at all; otherwise turbo runs **only the missed task ids** (plus their `dependsOn` closure — identical hashes; never `--only`, which drops dependency hashes and caches under the wrong keys), after that closure's remote hits are prefetched in parallel into the local cache (the remote artifact is byte-for-byte turbo's local `<hash>.tar.zst`). Without that, turbo's `--concurrency` also throttles cache restores and a 2-core runner spent ~40s restoring ~400 hits across the country before doing any work. The heartbeat that keeps a grouped-log step alive is in-process in `turbo-ci-run`, not a background shell loop. Platform-scoped leaves (`test:contract`) also hash `turbo-platform-key.json`, which `libs/tools/scripts/turbo-ci-run.ts` rewrites on every run with `{platform, arch, bun}`: Turborepo's hash ignores the OS, so without it a macOS result satisfies a Linux run and macOS-only harnesses silently stop running there. Env that changes a test's verdict is declared in that task's turbo `env` (`HARNESS_FIDELITY` / fast-check knobs on `test`, plus `HARNESS_MODE` / `HARNESS_WITH_DOM` / `HARNESS_FRAMES` on `test:e2e`) — a fidelity-max result must never be served to a mem-fabric run. Framework inference is off (`--framework-inference=false`) so only explicit `turbo.json` `env` enters the hash. `TURBO_CACHE` may tighten modes but cannot drop remote when creds are present. Only real secrets live in Infisical: `secrets-auth` masks every stored value in the job log, so a low-entropy config value (`1`, `local`, `auto`) shreds unrelated output — Turbo knobs (`TURBO_TEAM`, `TURBO_CACHE`, `TURBO_LOG_ORDER`, telemetry off) are code defaults in `turbo-ci-run`. CI log order is `grouped`: one collapsible `::group::` per task. **Output is `errors-only`**: a task's logs print only when that task fails, so a green run shows the plan, the heartbeat and turbo's summary — never what a passing test wrote (`TURBO_OUTPUT_LOGS=full` to watch one locally). Code under test stays quiet on its own too: `crash()` never logs (the crash handler owns the failure's surface — a thrown error the runner reports, the browser overlay, the Node handler's print-then-exit), and sidecars (`@pkgs/emqx-server`) buffer their output and print it only when they die unexpectedly.

**Checks are time-limited at every layer, and the limits are enforced.**
Nothing in the gate may run unbounded:

| Layer | Limit | Where |
| --- | --- | --- |
| Whole `check` run, laptop | 10 min | `DEFAULT_RUN_DEADLINE_SECONDS` |
| Whole `check` run, CI | 20 min | `CI_RUN_DEADLINE_SECONDS` |
| Whole `deploy` run | 45 min | `DEPLOY_RUN_DEADLINE_SECONDS` |
| Check workflow `check` step | 25 min | `timeout-minutes`, `.github/workflows/check.yml` |
| Check workflow `check` job | 30 min | `timeout-minutes`, `.github/workflows/check.yml` |
| Deploy workflow jobs | 55 min | `timeout-minutes`, `.github/workflows/deploy.yml` |
| One task | 300 s (×2 on CI) | `DEFAULT_TASK_BUDGET_SECONDS` |

The run deadlines are **absolute** — never scaled by `SLOW_RUNNER_MULTIPLIER`,
which corrects per-task budgets only; scaling the run deadline is what once let
a wedged Check run sit for 90 minutes. Each in-process deadline sits **below**
its workflow `timeout-minutes`, so `turbo-ci-run` kills the run and names the
task still running before GitHub cancels the step and says nothing
(`check-budget.test.ts` asserts the ordering). Per-task budgets are read back
from turbo's `--summarize` summary; cache hits are never measured. All of them
live in [`libs/tools/scripts/check-budget.ts`](libs/tools/scripts/check-budget.ts).
**Make the task faster before you raise its number**, and when you do raise
one, put the measurement in the commit body. `CHECK_DEADLINE_SECONDS`
overrides the wall clock for a single run; there is no "off".

**Keep the gate fast; it is measured every run.** `turbo-ci-run` prints the
ten slowest tasks that executed, so the CI log always says where the time
went.

**Every check is a cached, per-package task.** The gate's speed comes from the
cache, not from guessing what changed: there is no affected filter and no
changed-files lint. A package's checks live in its own tasks — `tc`, `lint`,
`test`, `test:contract`, `test:e2e` — and each hashes the package's whole
tracked tree (`$TURBO_DEFAULT$`) plus, through `dependsOn: ["tc"]` → `^tc`,
every package it depends on. An unchanged package is a cache hit on every
machine that shares the remote cache, and a change reruns exactly its package
and its dependents. `turbo-deploy-graph.test.ts` fails the build if any task
`bun check` can reach is `cache: false`, or if a package check task enumerates
its inputs instead of hashing the whole package (that is how a fixture or a
`tests/` tsconfig include falls out of the hash and a stale pass is served).
Rules that follow from it:

- **A package check reads only its own package and what it declares.** A test
  that scans other packages' files (a repo-wide grep, a naming sweep) is
  unsound under per-package caching — it passes from cache after the file it
  scans changed. Put a per-file rule in a Biome Grit plugin (it then runs in
  every package's `lint`), a per-package rule in
  [`lint-package.ts`](libs/tools/scripts/lint-package.ts), and declare a
  fixture package as a dependency.
- **`lint` is one script for every package**
  ([`lint-package.ts`](libs/tools/scripts/lint-package.ts)): path naming,
  Biome (including the import-boundary rules), the Solid oxlint scope, the
  package-boundary rules and the `docs/GOAL.md` proofs that live in the
  package — all over that package's files, run from the repo root so they
  resolve the one root config, with Biome and oxlint running concurrently. It
  depends on `tc` because type-aware rules read upstream types. Type-aware
  oxlint (oxlint-tsgolint, a Go port of the TypeScript checker) resolves each
  file's nearest `tsconfig.json`, so every file in the Solid scope must be in
  one — ~1–1.5s a package where ESLint took up to ~6s.
  `//#lint:root` covers paths in no package (root config, editor and agent
  settings).
- **`tc` is incremental** (`--incremental`, `.cache/tc.tsbuildinfo`,
  gitignored so it never enters a hash): on a cache miss tsc re-checks what
  changed rather than the package's whole graph — `@apps/product#tc` goes from
  21s to 12s after a leaf edit.
- **Root `//#` leaves are only for subjects that belong to no package**
  (lockfile audit, syncpack, the i18n catalog, agent-command projections, goal
  bookkeeping), each with explicit inputs. Explicit input globs do **not**
  honour `.gitignore` — a bare `**` hashes `.turbo/` run logs and never hits
  cache — so a root task that reads broadly uses `$TURBO_DEFAULT$` with
  negations, and reaches into a package through `dependsOn` on its `tc`.
- **Nondeterministic inputs become cache keys.** Platform (`test:contract`,
  via `turbo-platform-key.json`) and the commits under scan (`@libs/tools#check:secrets`, via `CHECK_SECRETS_RANGE` = `<merge-base>..<head>`, so a local run and its PR share one cache entry)
  are exported by `turbo-ci-run` and declared in the task's `env` / `inputs`.

**Feature work should rerun little, so keep the graph narrow.** A package's
declared dependencies are its blast radius: a change reruns every dependent's
`tc` / `lint` / `test`. Prefer small packages, depend on `public/` ports rather
than whole features, and never let a shell or `pkgs/` package name a feature.
E2e lives with the feature it exercises: the package's specs
(`specs/<domain>/*.feature` and `*.qnt` for its `specDomains`) and
`libs/<feature>/tests/e2e/`, run by that package's `test:e2e` — every
package's is the one harness runner `libs/harness/scripts/test-e2e.ts`
(`bun test --parallel`, preloading `@libs/harness/preload`, reports into
the package's report bucket) — against a composition of only the slices it
needs (`composeHarnessSlices`, see
[`docs/FEATURE_SUBSYSTEMS.md`](docs/FEATURE_SUBSYSTEMS.md)), so a change to a
feature it does not compose leaves it cached. **No e2e lives in `apps/`.**
There are no product random walks: a feature's state machine is a Quint model
in `specs/<domain>/`, whose drawn traces the product must follow step for
step, every standing property checked after each step
([`docs/SPEC_DRIVEN_DEVELOPMENT.md`](docs/SPEC_DRIVEN_DEVELOPMENT.md)). The
widest task is `@libs/runtime#test:e2e` (the composition root): the few
full-composition harnesses (shell boot, the platform model, critical journeys)
that depend on everything, kept small on purpose. Run a subset with
`bun run spec specs/chess/puzzle-play.feature` or
`bun run spec specs/spaces/space-hosting.qnt`.

**The latest test report is part of the cache.** Every `test:e2e` run writes
each scenario's and each Quint trace's step timeline, the drawn traces and
JUnit into `<package>/.cache/harness-report` — the task's declared `outputs` — so
turbo stores the report with the verdict, remotely too. `bun run
test:report` runs `turbo-ci-run --restore-outputs test:e2e` (same flags and
env as `bun check`: every hit restores its bucket, only changed suites run)
and folds the buckets into one `harness-report/index.html`: always the report of
the code as it is, whoever ran it. UI frames are opt-in (`--frames`,
`HARNESS_FRAMES=1`), a separate cache entry.

**A green `bun check` must mean a green Check workflow.** The gate is only worth
running if the two agree, so a check leaf's **verdict** may not depend on which
machine runs it. Do not branch on `CI` / `GITHUB_ACTIONS` to decide pass, fail
or skip — `scripts/check-*.ts` may not read them at all, and the
`no-ci-verdict.grit` Biome rule fails `lint` on any that do (reporting-only
reads are exempted by path in `biome.json`, with the reason beside the read). Adapting *resources* is fine and stays explicit: concurrency, log
order and the `SLOW_RUNNER_MULTIPLIER` budget correction. Two real bugs came
from getting this wrong: the billing offer check skipped off CI and
hard-failed on it, so a laptop reported green over a check it never ran, and
the property harness explored 40 cases in CI against 10 locally off one seed,
so CI searched 30 cases nobody had run. When a leaf genuinely cannot run
locally (it needs real credentials), `turbo-ci-run` drops it, names it, and
**exits non-zero** — an incomplete gate reports as incomplete rather than
green.

**Offline-first local secrets:** `bun run secrets:pull` exports Infisical `dev`+`prd` into gitignored `.cache/secrets/` (JSON maps + meta). `bun check` goes through `secrets-run`, which for `SECRETS_ENV=dev` prefers that cache and does **not** call Infisical when present (warns if older than 24h). Missing cache bootstraps once from Infisical when available. CI still injects secrets via secrets-auth (no disk cache required). `SECRETS_ENV=prd` / deploy stay Infisical-first. Without Turbo creds, `turbo-ci-run` uses `local:rw` so check still runs.

**One check surface:** `bun check` is the whole gate — `//#check` depends on the per-package `tc`, `lint`, `test`, `test:contract` and `test:e2e`, the root leaves (`//#lint:root`, syncpack, audit, i18n, agent-commands, goals), `@apps/product#check:offline-shell` (every file the wall client can load is in the service worker's precache, under budget — built from the real `dist/`), each Worker's `check:worker-bundle` (`wrangler deploy --dry-run` under the upload limit — nothing else in the gate bundles a Worker), `@libs/runtime#check:schema-evolution`, `@libs/tools#check:actionlint` and `@libs/tools#check:secrets` (gitleaks over the commits the change adds — the only secret scan; no GitHub App checks run on PRs). A package's static checks are ordinary tests in that package (the client critical path, the append-only contract manifest, feature table boundaries, the billing offer). **A `//#check` leaf verifies; it never mutates the outside world.** The billing offer is validated as a value and touches no provider — reconciling it onto Stripe is `billing:sync`, on deploy. A gate leaf that writes to a vendor needs vendor credentials, which is how the gate ends up green on one machine and red on another. The Check workflow and the Deploy workflow run that same set. `//#deploy` is `//#check` plus `@apps/server#check:api` (live probe) and `@apps/product#health` (every `specs/health/` and `specs/journeys/` scenario, live), which pull `@libs/infra#apply:foundation` → migrate → room deploy → API deploy → product deploy → `@libs/infra#apply:edge` → billing sync before they run.

**Two commands:** `bun check` checks the *code* before it ships (every task cached; verifies, never mutates); `bun health` checks the *live deployment(s)* (`bun health` = secrets env `dev`, `bun health:prd` = production). **Every health check and critical journey is Gherkin:** `specs/health/*.feature` (DNS/TLS, the Workers, Postgres + schema, client config, R2, EMQX, Grafana Cloud, secrets, billing keys, the Google OAuth client, infrastructure drift) and `specs/journeys/*.feature`. `@apps/product` runs both through `liveDomains` in its `health` task (`apps/product/scripts/health.ts`, `cache: false`): one live world per scenario (`apps/product/tests/steps/live-world.ts`), step definitions in `apps/product/tests/steps/*.steps.ts` (`// @io-wall-ok`, secrets arrive as env via `secrets-run`). Tags pick where a scenario runs live — `@production`, `@oauth-relay`, `@observability` (see [`docs/SPEC_DRIVEN_DEVELOPMENT.md`](docs/SPEC_DRIVEN_DEVELOPMENT.md)). There is deliberately no `//#health` root task: with a root `health` script, a bare `health` dependency would resolve to that root task itself, a cycle turbo refuses to plan (`turbo-deploy-graph.test.ts` fails `bun check` on any root-task cycle). Checks are read-only (self-cleaning round-trips at most) and assert *configured correctly*, not just *up*; they read the environment's hosts and names from `@libs/infra/public/envs` (every environment is a full replica). Secret validation lives here, not in `bun check` — a revoked vendor key is a live-deployment problem, not a code problem. The `health` task's `dependsOn` is the deploy chain, so deploy runs every check last; standalone `bun health` passes turbo `--only` (via `turbo-ci-run`) and deploys nothing. The Health workflow (`.github/workflows/health.yml`) runs it hourly against every environment. A new live resource adds a scenario to `specs/health/` (spec commit) and its step definition.

**Critical journeys are synthetic monitoring.** The user flows that must never break (app boots, Google sign-in hands off, sign in/out, host and end a space, open a chess puzzle, save a profile change, people search answers) are the scenarios of `specs/journeys/`. Their step definitions (`libs/runtime/tests/steps/journeys.steps.ts`) drive the app through `@pkgs/ui-testing` `Driver` gestures over `data-testid`s (`@libs/runtime/harness/critical-journeys`) on a `JourneyHost`, and run twice: in `bun check` against the full composition (`@libs/runtime` `specDomains`, simulated Google sign-in), and in `@apps/product#health` (`liveDomains`) in a real browser (`Bun.WebView`: WebKit on macOS, the runner's Chrome elsewhere) against the production web client and API, one fresh device per scenario. `@browser` scenarios stop at a host limit in the harness. A production failure saves a screenshot, the page HTML and the browser console under `apps/product/.cache/critical-journeys/<scenario>/`, which the Health and Deploy workflows upload. Signed-in journeys sign in as a fixed synthetic-monitor user: the runner trades `SYNTHETIC_MONITOR_TOKEN` (registry secret, pushed to the API Worker) at the hidden `POST /api/auth/synthetic-monitor/code` for a one-time `/sso-callback?code=` URL, and the browser finishes the real sign-in path. The route answers 404 without the secret and can never mint a session for anyone else (`pkgs/auth-inhouse/src/server/synthetic-monitor.ts`). A new must-never-break flow is a new scenario. It must pass in the harness first, and its writes clean up after themselves (`JourneyHost.defer`). The harness is same-origin, so cross-origin behavior (CORS on `api.` answers to `www.`) is proven only live — `specs/health/sign-in.feature` checks it. The API also serves **readiness** at `GET /api/health/ready` (`application/health+json`, `503` when Postgres fails `SELECT 1` within 3 s) beside liveness at `GET /api/health`; `specs/health/serving-people.feature` checks both.

Low-end device gates are **static** (the critical-path test; Slow-3G / low-end Android bar in [`docs/LOW_END_ANDROID_PERF.md`](docs/LOW_END_ANDROID_PERF.md)), and coverage is a separate opt-in report (`bun run check:coverage`). Both check and deploy go through `secrets-run` → `turbo-ci-run`, which flattens aggregators to leaf tasks so the root `check` / `deploy` scripts never re-enter Turbo.

**Local → CI reuse:** run `bun run secrets:pull` then `bun check` (or `deploy:dev`) so Turbo remote creds are warm; push the same tree and the Check and Deploy workflows reuse those remote artifacts for cacheable tasks. Match `SECRETS_ENV=dev` for the Check workflow; `prd` `build` hashes separately when `VITE_*` differ. Every `bun check` task is cached; only deploy steps (`cache: false`: check:api, infra apply, migrate, deploy, health, OTA) always re-run.

Object storage (TTS audio cache, etc.) uses **S3-compatible** storage via `@pkgs/object-store-s3/impl-s3`. The API Worker reads `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` plus `S3_BUCKET` / `S3_ENDPOINT` / `S3_REGION` at boot and injects a namespaced store through `createS3ObjectStore`, which always applies the injected root prefix (from `PRODUCT_CONFIG.objectStore.namespace`, e.g. `gamezilla/`) before feature-level prefixes (e.g. `tts-audio/`). The S3 transport layer rejects any wire key that does not start with that root prefix. **CI / fidelity-max** may boot **`@pkgs/minio-server`** (`http://127.0.0.1:9000`). Missing S3 secrets still fall back to an in-memory store so the Worker can boot. Each environment's R2 bucket and its bucket-scoped S3 credential are OpenTofu resources (`libs/infra/tofu/modules/object-store`), written into that environment's Infisical secrets (endpoint `https://<accountid>.r2.cloudflarestorage.com`, region `auto`). Worker secrets upload with the version (`wrangler deploy --secrets-file`), which never removes old names — after renaming a Worker secret key, delete the stale binding once. Every secret the app needs is defined in `libs/secrets/src/shared/secrets/registry.ts`; `bun health` runs `@libs/secrets#health` (validates every registry secret live against the vendor, per secrets env; the Deploy and Health workflows cover `dev` and `prd`).

## Workflows

Exactly three GitHub Actions workflows, all on GitHub-hosted `ubuntu-latest`
(the repo is private on a plan without larger runners). Use these names
everywhere; never add a fourth:

| Workflow | File | Question it answers |
| --- | --- | --- |
| **Check** | `.github/workflows/check.yml` | Is the code good? (`bun check`, on every PR) |
| **Deploy** | `.github/workflows/deploy.yml` | Ship the code (`bun run deploy`, on `main`) |
| **Health** | `.github/workflows/health.yml` | Is the deployment good? (`bun health`, hourly) |

1. **Check is one gate, sharded across runners.** `.github/workflows/check.yml`
   runs the `//#check` leaf set `bun run check` runs, with `SECRETS_ENV=dev` —
   the same set as the deploy gate, nothing more — but not on one 2-core
   runner: `check:plan` dry-runs the gate and splits the cache misses across up
   to `MAX_SHARDS` `check:shard` runners
   ([`check-shards.ts`](libs/tools/scripts/check-shards.ts), balanced by the
   measured `check-task-costs.json`; published by `check:matrix`, a job that
   loads no secrets, because the runner drops any job output that contains a
   masked Infisical value), each shard runs its task ids through
   `turbo-ci-run` (turbo restores the `dependsOn` closure from the shared remote
   cache or builds it), and the `check` job is green only when the plan and
   every shard are. `check` is the one required check. The verdict is still
   turbo's: a plan-time HIT is a passed task and every MISS runs on exactly one
   shard. Refresh the cost table from a cold run summary
   (`bun run libs/tools/scripts/check-shards.ts --write-costs <summary.json>`)
   when shards drift out of balance — stale costs slow a run, never change it.
   Never split the check *surface* into per-check jobs: assign a new check to
   `//#check` in `turbo.json` — preferably as a test or lint rule inside the
   package it is about — and the planner schedules it. `//#deploy` depends on
   `//#check` and adds `@apps/server#check:api` and `health` (whose
   per-package tasks pull infra apply (foundation) → migrate → room deploy → API deploy →
   product deploy → billing sync), so it is never listed as a `dependsOn` of
   another aggregator. Live-resource probes go in a package's `health` script,
   never in `//#check`.
2. **Deploy ships `main` to every env file, standard envs first.**
   `.github/workflows/deploy.yml` is data-driven: `deploy:matrix` (no
   secrets; it also runs the merged-PR guard) reads
   `libs/infra/tofu/envs/*.tfvars.json` via
   [`workflow-env-matrix.ts`](libs/infra/scripts/workflow-env-matrix.ts), then
   one `deploy:<env>` job per `protection: "standard"` env runs in parallel
   (`fail-fast: false`) and, only when all of them succeed, one `deploy:<env>`
   job per `protection: "production"` env (`environment: production`). Adding
   an env file needs no workflow edit. Every job runs `bun run deploy` with
   `SECRETS_ENV=<env>` at the job level (not the `deploy:dev` / `deploy:prd`
   aliases, which force `TURBO_UI=tui`). Each standard env is a full replica
   (its own Workers, bucket, broker on its own hostnames) deployed with the
   same chain as prd, so every change runs in a real environment before
   production. Deploy never runs on PRs; each environment is a shared
   singleton. Deploy ends with every package's `health` task.
   **Rehearse it locally before merging** anything that touches deploy, infra,
   secrets, Workers or `health`: `mise install`, then `bun run deploy:dev` from
   the PR branch. It is the exact `//#deploy` graph the Deploy job runs
   (check → tofu apply → migrate → Workers → billing sync → health) against the
   dev replica, so a green local run is a green `deploy:dev` job. Deploy stops
   at the first failure; once the deploy steps pass, `SECRETS_ENV=dev bun run
   health` re-probes without deploying and reports every failing probe in one
   pass. Merge only when both are green, and merge right after: a rehearsal
   that adopts or creates resources puts them in the env's state, so until
   the branch lands `main`'s Deploy plans to delete them — the stateful
   policy refuses, and `main` stays red for that env. Caveat: the Railway broker builds from
   `main` (`libs/infra/tofu/modules/pubsub`), so broker image changes only
   reach dev after merge — test them with `docker build` + a root-owned volume.
3. **Health checks the live deployment between deploys.**
   `.github/workflows/health.yml` runs `bun health` hourly as one
   `health:<env>` matrix job per env file (production envs in the GitHub
   `production` environment; the same probes Deploy runs last) and deploys
   nothing.

UI tests run in-process, in happy-dom, inside each package's `test` leaf —
`bun check` drives no real browser. UI suites are written against the
polymorphic `@pkgs/ui-testing` `Driver` and run on `@pkgs/ui-testing-solid-dom`
(Solid in happy-dom, virtual clock). `@pkgs/ui-testing-bun-webview` implements the same `Driver`
and is used only by the opt-in live-browser product harnesses
(`HARNESS_MODE=real|stack`); swapping hosts is a driver choice, never a suite
rewrite.

CI pins Bun `1.4.2` (`mise.toml`, mirrored in `packageManager`). Do not downgrade
to 1.3.x: that resolver does not fall back to `.tsx` for wildcard subpaths, so
`@pkgs/*/solid` (and every import that resolves through a tsconfig `paths`
wildcard to a `.tsx` file) fails on the runner while passing locally.

The gate is required by GitHub, not by convention:
the OpenTofu bootstrap stack (`libs/infra/tofu/modules/repository`, applied with
`bun run infra:bootstrap`) requires each PR workflow's gate job (`check`) against the latest `main`, so
GitHub itself refuses the merge until it is green — and it is green only when
the plan and every shard are.
**Agents never merge.** `/pr-ready` takes a PR to a green Ready to merge
button and stops; a human merges — never `--admin`, never the merge queue,
never a red, pending or draft PR.

**`main` only moves through a merged PR.** GitHub enforces it — every setting
this repo applies on GitHub is an OpenTofu resource in the bootstrap stack
(`libs/infra/tofu/modules/repository`, applied by a person with
`bun run infra:bootstrap`, which also owns the CI's Infisical OIDC identity and
the Actions variables it reads):

- `github_branch_protection.main` — a PR is required to change `main`, and
  direct pushes, force-pushes and deletions are rejected, admins included.
  Required checks are `global.tfvars.json` `github.required_checks`, strict
  (the branch must be up to date); `libs/infra/tests/global-file.test.ts`
  fails `bun check` unless they are exactly the gate job — the job named after
  its workflow — of every workflow that runs on pull requests. `check:plan`
  and the `check:shard` runners are never required: their count varies per
  run, and a PR that needed fewer shards would wait forever on the missing
  ones. The Deploy and Health workflows never report on a PR.
- `github_repository` — `delete_branch_on_merge`, so merging a PR cleans up its
  branch, plus the merge-method policy: **merge commits only** — squash and
  rebase merges are disabled, so `main` keeps every PR's commit graph and merge
  base. Auto-merge is off; a human merges.

Two local layers back it up: `libs/tools/githooks/pre-push` refuses pushes to
`refs/heads/main` (`core.hooksPath` is set by `.superset/setup.sh`, or
`bun run hooks:install`), and the Deploy workflow fails before it
deploys any commit that is not associated with a pull request — it also
re-runs the whole `check` leaf set first, so a merged-but-red PR cannot
ship. The other hook, `libs/tools/githooks/pre-commit` (repo-wide
`lint tc --affected`), is opt-in per commit (`GIT_LINT_PRECOMMIT=1 git commit …`):
checks belong to the Check workflow, and `--affected` spans every package while a global
dependency is dirty.

## Superset workspaces

Every Superset workspace is a git worktree bootstrapped by
`.superset/setup.sh` (`bun install`, `.cache/secrets`, `apps/*/.env.local`),
torn down by `.superset/teardown.sh`, and launched from the Run button through
`.superset/run.sh`. `.superset/config.json` owns exactly those three keys;
per-machine extras belong in the gitignored `.superset/config.local.json`.

- **Ports.** `source .superset/port.sh` gives a workspace its own port block
  (`VITE_PORT`/`PREVIEW_PORT`, `POSTGRES_PORT`); the Run pane sources it
  automatically, and any terminal that boots a sidecar
  (`@pkgs/postgres-embedded`) must source it first. EMQX
  (`1883`/`8083`/`18083`) and the wrangler preview (`8788`) stay machine-wide
  singletons: at most one workspace at a time may run something that binds them
  (fidelity-max harnesses, `test:contract`, `check:api`).
- **Checks.** `bun check` is the whole gate (the same leaf set the Check workflow runs).
  While iterating, prefer `bun fmt` plus `bun run --filter <pkg> tc` and
  `bun run --filter <pkg> test`. `bun check:remote` runs the real Check workflow
  (`.github/workflows/check.yml`) on GitHub for the current branch: it runs
  `git-sync` (`--message` commits a dirty tree), dispatches the run and blocks
  until it finishes (exit code = verdict); Ctrl-C cancels the run on GitHub. `bun run git-sync`
  (`/git-sync`, `.agents/commands/git-sync.md`) is the one commit/push/trunk-sync step: it
  pushes the branch, merges the latest `origin/main`, pushes, and fast-forwards local `main`,
  and `bun check:remote` goes through it. Every PR body follows
  `.github/PULL_REQUEST_TEMPLATE.md` (not CI-enforced). Then run `/pr-ready`
  (a user-level skill, not a repo command) — the single PR command: it syncs
  with the base, clears conflicts, opens/updates the PR, drives every check
  green and resolves review threads until Ready to merge is green. It does not
  merge; a human does. `/ci-green` (`.agents/commands/ci-green.md`) widens
  that to all three workflows: it surveys Check, Deploy and Health, fixes
  every red root cause on the one PR (reproduced locally first, since Deploy
  and Health only run from `main`), and loops until they are green.
- **Agent commands.** `.agents/commands/<name>.md` (with `description:`
  frontmatter) is the only place a slash command is written. `bun run
  agents:sync` projects it into every harness: `.claude/commands`,
  `.cursor/commands` and `.opencode/commands` are symlinks to it; Gemini CLI
  (`.gemini/commands/*.toml`), Copilot (`.github/prompts/*.prompt.md`),
  Windsurf (`.windsurf/workflows/*.md`) and Codex (`.agents/skills/*/SKILL.md`)
  get generated stubs that load the source. Never edit those outputs;
  `//#ci:agent-commands` fails `bun check` on any drift.

## Local development

**Manual work is the product super-app.** `bun run dev` starts **`@apps/product`** (wall client at `/`, Harness at `/harness` — flat sibling screens linked only through their command palettes (`Open Harness` / `Exit harness`), no tab bar or console chrome; default SQL fabric for harnesses is **mockingbird-postgres** server + **mockingbird-sqlite** clients). Harness test reports are one standalone HTML artifact over every package's e2e suite (`bun run test:report` → `harness-report/index.html`, rendered by `@pkgs/harness-report`), never a console tab or a report server. It does **not** start Wrangler, real Postgres, S3rver, or MQTT. Standalone client remains available (`bun run dev:client` → `@apps/client` only).

**Highest-fidelity local run** — `bun run stack` runs the whole product in the foreground
loopback: embedded Postgres, S3rver, Aedes MQTT, **simulated Google and Apple IdPs, each on
its own port with its own internal state** (`@pkgs/idp-mock`), N Bun API
instances running the production Worker handler, and a round-robin load
balancer in front of them (room WebSockets are hashed by topic so a room keeps
one authority, as a Durable Object does). Every port is OS-assigned and the
addresses are published to `.cache/localhost-stack/<instance>.json`, so
several stacks run concurrently. `bun run --filter @apps/product test:stack` boots one,
runs the harness suite against it with `HARNESS_MODE=stack`, and tears it down. See
[`apps/product/docs/LOCALHOST_STACK.md`](apps/product/docs/LOCALHOST_STACK.md).

**Auth is a port; the in-house IdP is one vendor behind it.** Product code
(`@libs/auth`, `@libs/server-app`, `@libs/client-app`, every feature) knows
auth only through `@pkgs/auth`: `AuthClientPort` on the device,
`AuthServerPort` on the API, and the `AuthProviderModule` a composition root
builds. The in-house IdP (`@pkgs/auth-inhouse`: its `/auth/*` routes, `idp_*`
tables, bearer store, Google/Apple exchanges) is treated exactly like a hosted
service — Clerk, Firebase Auth, WorkOS, Cognito or Better Auth would be a
sibling `@pkgs/auth-<vendor>` package passing the same
`@pkgs/auth/contract` suite. It is chosen in one place per side:
`@libs/runtime/root/server/app-auth-provider.ts` (Worker + migrate runner)
and the wall / harness `ClientEnv.createAuthClient`. Biome
`import-auth-vendor.grit` fails `lint` on any other import of
`@pkgs/auth-inhouse`, `@pkgs/auth-harness` or an auth vendor SDK. Never read
`idp_*` tables, IdP secrets or `/auth/*` wire shapes from product code — add
what you need to the port and implement it in the adapter.

**Sign-in providers: Google everywhere, Apple outside production.** There is no
dev/test IdP route in the API. Simulations and the localhost stack both run
`@pkgs/idp-mock`, which serves Google's real endpoints (PKCE, code exchange,
userinfo, JWKS) — or, as a second instance, Sign in with Apple's (`form_post`,
ES256 client-secret JWT, name-once `user` blob, Hide My Email relays,
server-to-server notifications) — so the production `@pkgs/auth-inhouse`
`providers/google-oauth.ts` and `providers/apple-oauth.ts` paths are the paths under test. Point Google
somewhere else with the `GOOGLE_IDP_ORIGIN` Worker binding (unset means real
Google). Apple is **mock-only**: it is enabled only by the five `APPLE_*`
bindings together, and the Worker refuses them when `SECRETS_ENV=prd`.
Test weird provider behaviour through the mock's faults and control plane
(`/__idp/*`), never with a stubbed relying party.

**Accounts link, never merge silently.** A user holds any number of provider
identities, at most one per provider; an identity never moves between users,
and the last one cannot be removed. A new identity joins an existing account
by address **only** when both addresses are provider-verified and neither is
an Apple relay; any other address match parks a pending link the person must
confirm (sign in to the existing account) or decline (a separate account).
Linking from Settings needs a link ticket bound to the signed-in session. The
policy is specified in `specs/auth/` (its features and the
`outside-accounts.qnt` model, run by `@pkgs/auth-harness`'s `test:e2e`), and the
reference model in `@pkgs/auth-harness` checks every harness step against it — change
the spec first, then the reference model.

Each provider's **wire** is real; its **screens** deliberately are not — they
say `OAuth Mock` (`IDP_BRAND` in `pkgs/idp-mock/src/shared/brand.ts`),
with their own mark, palette and shape language. The mock must never pass for a
real provider: do **not** restore Google's logo, palette, page titles or footer
links, and do **not** swap in an invented brand that reads as real. It must
also stay a **high-fidelity** mock of social sign-in — keep flow parity with
Google / Apple (address step, account chooser, password, consent with scopes,
create-account, refusal); saying "mock" is not licence to make it a toy.

Representativeness of production is **port contract matrices** (mockingbird-postgres / mockingbird-sqlite vs live engines, Kv, ObjectStore, PubSub, billing/TTS/LLM stubs) plus `@apps/product` `openHarness({ fidelity: 'max' })` / `HARNESS_FIDELITY=max` for embedded real Postgres (+ S3rver/EMQX). Sidecar processes live in `@pkgs/postgres-embedded`, `@pkgs/s3-server`, `@pkgs/aedes-server`, `@pkgs/emqx-server` and are booted from tests/CI (`apps/server/scripts/boot-local-stack.ts`, `apps/server/scripts/boot-embedded-postgres.ts`).

The harness (`@libs/harness`) migrates each composition's mem fabric **once** into `<package>/.cache/harness-seed-<composition>.pgmm.json` and clones it per `openHarness`. Suite notes: [`libs/harness/README.md`](libs/harness/README.md).

Deployed environments (`SECRETS_ENV=<env>`, one `libs/infra/tofu/envs/<env>.tfvars.json` each; production-ness is its `protection`, never its name) use Neon + Cloudflare R2 + Railway EMQX + Grafana Cloud, all declared in `libs/infra/tofu` ([`docs/INFRA.md`](docs/INFRA.md)).

- **`bun run sims:open`** — multiselect project sims and open Simulator.app.
- **`bun run dev`** — `@apps/product` super-app (`/` = real client, `/harness` = Harness; `?harness` on `/` hands off). Press **`i`** or **Shift+I** to open the project iPad in the harness (bypasses the default harness picker).
- **`bun run dev:client`** — `@apps/client` standalone only (no product console).
- **Sign-in in the harness** — Google against the in-process simulated IdP node.
- **Optional clouds** — still degrade in the real API Worker when secrets are missing.
- **`bun db:migrate`** — migrates `DATABASE_URL` (CI / after booting embedded Postgres). Not part of daily `bun dev`.
- **`bun run db:wipe:dev`** — secrets env `dev` only; destructive on the resolved non-prod URL.
- **Production** — only `bun run infra` sets `SECRETS_ENV=prd`.

### Database migrations (`@pkgs/db-migrate`)

Server SQL migrations are expressed only as `DatabaseMigration` classes (interface + `ComposedDatabaseMigration.register` from `@pkgs/db-migrate`). Each package owns its unit (`SyncEngineDatabaseMigration`, `KvPostgresDatabaseMigration`, `PostgresSchemaDatabaseMigration`, …); `@libs/runtime/server/run-postgres-migrations` (`PostgresMigrationRunner`) composes them (including `PostgresAdvisoryLockedTransactionMigration` for the migrate mutex).

**Domain tables** are declared with `defineTable` in each feature lib’s `shared/schema/` (exported via `public/schema.ts`), composed by `registerTables` in `@libs/runtime/root/app-schema`, and applied only through `@pkgs/db-schema-postgres` / `@pkgs/db-schema-sqlite` migration classes (no public `reconcile` API). **Do not add raw `.sql` schema files** under `libs/` / `pkgs/` / `apps/`.

**Framework / infra tables** (sync-engine, outbox, kv, entity-store, matchmaking) are also declared with `defineTable` + package-local `registerTables`, then applied via package `*DatabaseMigration` wrappers (`PostgresSchemaDatabaseMigration` / `SqliteSchemaDatabaseMigration` / `applySqliteSchema`). They are **not** registered in product `appSchema` (not synced). Soft-delete + managed `id` / timestamps apply; former custom PKs become `uniqueIndexes`. One-shot cutover migrations may rebuild legacy shapes before reconcile. **IdP tables** (`idp_*` in `@pkgs/auth-inhouse`, applied through its `AuthProviderModule.postgresMigration`) use the same `defineTable` pattern and are also **not** in `appSchema`.

**Never author `CREATE TABLE` strings** in product or test code — use `defineTable` + `applySqliteSchema` / `applyPostgresSchema` / `*SchemaDatabaseMigration`. The only DDL emitters are `@pkgs/db-schema-postgres` / `@pkgs/db-schema-sqlite` `emit.ts`. Biome grit `no-raw-create-table` enforces this.

Do not add ad-hoc `migrateUp` / free-function DDL entrypoints for new schema — implement `defineTable` + register (app-schema for synced domain; package-local schema for infra). `@apps/server` owns URL/policy/retry orchestration (`migratePostgresApp` / `migrate-cli.ts`); tests/CI boot `@pkgs/postgres-embedded` then call api migrate/seed scripts. Root `db:migrate` / infra run `libs/runtime/scripts/migrate-cli.ts` (apps must not import other `@apps/*` packages).

### Database safety (Tiger policy)

Non-deploy contexts must never reach production Postgres. Guards live in `@libs/db/public/database-url-policy`:

1. **`assertNonProductionSecretsEnv`** — scripts exit unless `SECRETS_ENV` names a `protection: "standard"` env.
2. **`assertNonProdDatabaseUrl`** — rejects URLs equal to any production env's `DATABASE_URL` and production-only hostnames (dual-fetch at setup/migrate time). Loopback (`@pkgs/postgres-embedded`) is allowed for non-production envs.
3. **API worker** — on a non-production deployment (`DEPLOYMENT_PROTECTION`, rendered from the env file), the first DB request asserts a non-prod URL.
4. **Review** — every DATABASE_URL entrypoint must wire `assertNonProductionSecretsEnv` / `assertNonProdDatabaseUrl` from `@libs/db/public/database-url-policy`.
5. **Escape hatch** — `ALLOW_PRODUCTION_DATABASE_URL=1` (mirrors `VITE_ALLOW_PRODUCTION_API_URL` for the API). `db:wipe:dev` refuses this hatch and requires a live dual-fetch of every production env before any destructive SQL.

## Per-feature package layout

Workspace packages live under three top-level tier directories with matching npm scopes — pick the tier that fits the package's role:

| Tier | Path    | Scope    | Contains                                                           |
| ---- | ------- | -------- | ------------------------------------------------------------------ |
| Apps | `apps/` | `@apps/` | Deployed product surfaces (`server`, `room-server`) plus the composition hub `product` (www super-app: wall client + Tests/Harness, shared System + hosts, `openHarness` / scenarios). `@apps/client` remains a standalone library/app for local `dev:client` (not deployed). |
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

Exempt (no request to trace; keep their current trees): `@libs/db`, `@libs/secrets`, `@libs/games`, `@libs/runtime`, `@libs/test-ids`, `@libs/tools`.

Lint/format is root-only Biome ([`biome.json`](biome.json) + [`libs/tools/biome-plugins/`](libs/tools/biome-plugins/)); packages do not ship per-package lint configs.

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

- `@apps/product` — www super-app (`/` wall client, `/harness` Harness) and the live-browser runners (`test:max`, `test:stack`, which run every package's e2e on the `bun-webview` host; `HARNESS_MODE=real` sidecars are registered through `src/harness/setup/real-stack-preload.ts`). It owns no e2e. The full composition (`APP_COMPOSITION` / `APP_SYSTEM`: every feature, the production migrate) lives in `@libs/runtime/harness/app-composition`, and its suites in `libs/runtime/tests/e2e`. Console and test call `APP_SYSTEM.run({ runtime })` only; neither owns a parallel boot.
- `@libs/harness` — the harness fabric (`createHarness`, SQL engines, net/fetch, snapshots), hosts (`in-process`, `bun-webview`), `openHarness`, and `defineProductSystem` / `composeHarnessSlices`, generic over a `HarnessComposition`. A shell: it may not depend on a feature. Features export their slices from `@libs/<feature>/harness/*`; their e2e lives in `libs/<feature>/tests/e2e/` ([`libs/harness/README.md`](libs/harness/README.md)).

- `@libs/runtime` — product composition hub: `defineTable` tables from feature libs composed via `registerTables` in `root/app-schema.ts`; sync topic map in `root/app-topic-map.ts`; Postgres migrate runner in `server/run-postgres-migrations.ts`. **`@libs/runtime` is the sole lib allowed to import other `@libs/*`.** Framework tables (`sync_engine_*`, outbox, kv, …) are owned by their packages via package-local `defineTable` schemas + `*DatabaseMigration` (not in `appSchema`). Domain mutations validate and apply their own authorized SQL against declared table names.

- `@libs/auth` — sign-in flows, sessions, devices, account-scoped local SQLite; maps the auth service's users onto product accounts (`auth_external_accounts`) through the `@pkgs/auth` port only.
- `@pkgs/auth` — the auth abstraction: client / server ports, the `AuthProviderModule` composition roots build, and the `@pkgs/auth/contract` suite every adapter passes. `@pkgs/auth-inhouse` — the in-house IdP, one adapter behind it ([`pkgs/auth/README.md`](pkgs/auth/README.md)).
- `@libs/chess` — chess board UI, puzzle play / picker, settings. The chess puzzle seeding script lives in `libs/chess/scripts/seed-chess-puzzles.ts` (run via `bun run chess:puzzles:seed`); it assumes the schema has already been migrated by `bun run db:migrate`. Every harness that composes chess seeds puzzles on boot (Node: `libs/chess/fixtures/chess-puzzles.harness.csv`, 3 documented puzzles; web / product-harness: the inline 50-row fixture in `libs/chess/src/harness/`), so `bun run dev` and scenario tests never need a manual seed. Feed config is one shared signal per chess surface (`ChessPuzzleFeedProvider`); the pool syncs per rating band around the effective rating (`chessPuzzlePoolRangesForRating`). Puzzle scenarios: `bun run --filter @libs/chess test:e2e`.
- `@libs/client-config` — synced runtime config (`client_config` key/value scalar rows). Worker materializes from secrets via `EnsureClientConfigMaterialized` (no HTTP); clients read local SQLite via `useClientConfig`. Client runtime knobs (EMQX WSS URL, observability backend) live here — not in `VITE_*` build-time env (API URL / commit provenance / E2E / Watchman stay build-time env).
- `@libs/profile` — public profile, dicebear avatar editor, username generator (vertical slices: ensure-local, patch-avatar, ensure-online, set-username).
- `@libs/spaces` — spaces / lobby / multiplayer plumbing, game dispatch via `space-module.ts` (lifecycle mutations as vertical slices: create/join/leave/end/rename).
- `@libs/billing` — billing checkout/portal/callback routes and the offer, over the `@pkgs/billing` membership port only. Providers (`@pkgs/billing-stripe`, `@pkgs/billing-paddle`, `@pkgs/billing-mock`) each export one `MembershipProviderModule`; `@pkgs/billing-providers` is the single list composition roots iterate (API boot, `billing:sync`, secret registry) — never name a provider elsewhere (Biome `import-billing-vendor.grit`). Several may run at once (`BILLING_PROVIDER` picks where new checkouts go); every provider secret is optional.
- `@libs/friends` — friendship graph (vertical slices per mutation: send/accept/decline/cancel/remove/block/unblock).

- `@libs/tools` — repo/CI plumbing: Biome Grit plugins, git hooks, GitHub config-as-code, turbo CI runner, i18n/coverage/static gates.

### Adding a new game

Each game is its own package modelled after `@libs/chess`. To add `@libs/connect-four` (or numberlink, tic-tac-toe, battleship, etc.):

1. Scaffold `libs/<game>/` manually:
   - `package.json` with `"name": "@libs/<game>"`, per-file `exports`, deps mirroring what the implementation actually imports (typically a granular subset of the `@pkgs/<util>` micro-packages — `assert`, `keyword`, `attribute`, etc. — plus `@pkgs/sync-engine`, `@lingui/*`, `solid-js`).
   - `tsconfig.tc.json` extending root; `"tc": "tsc --noEmit -p ./tsconfig.tc.json"`.
   - Empty `src/shared/<game>/` RoomModule plus `src/use-cases/`, `src/root/{client,server}/`, `src/public/` (omit empty runtimes). `hash(state)` on every `RoomModule` (see [`docs/DETERMINISM.md`](docs/DETERMINISM.md)).
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

### Layering rules (enforced by Biome)

Every layering rule is a Grit plugin, `libs/tools/biome-plugins/import-*.grit`, matched against each import specifier (static, `export … from`, `import()`, `require()`) and scoped by its `includes` in `biome.json`; each has a must-report and a must-allow probe in `libs/tools/scripts/import-boundaries.test.ts`. Biome's own `noImportCycles` bans file-level cycles and `noUndeclaredDependencies` bans importing a package the importer's `package.json` does not declare — load-bearing, since turbo builds its cache graph from `package.json`. (These replaced dependency-cruiser, which had cruised 0 modules per package and so enforced nothing.)

**Tier pyramid** — one-way dependencies between tiers, enforced by `import-pkgs-tier` / `import-libs-tier` (workspace specifiers and the relative-import escape hatch):

```text
apps    →  apps, libs, pkgs (cross-app OK e.g. client → server; apps/product is the composition hub and may compose other apps)
libs    →  pkgs only
pkgs    →  pkgs only (leaf tier: reusable, app-agnostic)
```

`pkgs/` packages are the foundation: they must work in any monorepo, with no references to `gamezilla`, `apps/server`, `@libs/*`, or any product surface (in code, comments, or default config strings).

**Other layering rules:**

### Gherkin acceptance specifications

Every acceptance spec lives in the flat top-level tree `specs/<domain>/` —
Gherkin features (`<feature>.feature`) and Quint models (`<model>.qnt`), one
directory per `@domain`, no nesting. A package runs the domains its
`package.json` lists in `specDomains` (each domain exactly one package; its
`turbo.json` adds `$TURBO_ROOT$/specs/<domain>/**` to `test:e2e` inputs)
through its `test:e2e` task. Spec text is owned by the spec writer and changes
only in isolated `spec:` commits; implementers treat it as read-only. Step
definitions live in `tests/steps/`, model bindings in `tests/quint/`; both
call deterministic harness actions and reads, and steps are catalogued in
generated `STEPS_CATALOG.md` files.
See [`docs/SPEC_DRIVEN_DEVELOPMENT.md`](docs/SPEC_DRIVEN_DEVELOPMENT.md) and
each bounded context's ubiquitous language (`specs/<domain>/ubiquitous-language.yml`,
shared kernel `specs/ubiquitous-language.yml`; domain-driven design — every spec word
and Quint name is a glossary term, contexts integrate only through borrowed
terms and published `events.qnt`). Strict BDD, product behavior only, no
implementation details: specs are written with the
[`spec-upsert`](.agents/skills/spec-upsert/SKILL.md) skill, bound with
[`spec-implement`](.agents/skills/spec-implement/SKILL.md), and audited with
[`spec-audit`](.agents/skills/spec-audit/SKILL.md), all against the one rulebook
[`docs/SPEC_STANDARDS.md`](docs/SPEC_STANDARDS.md). `bun run spec:check` enforces ownership-neutral
structure and vocabulary; `bun run spec --tags '<expression>'` runs matching
scenarios across packages. The release decision remains only `bun check`.

- `@apps/product` composes product apps (the product-harness, the live-browser runners). libs/pkgs must not import `@apps/*`.
- `@apps/<name>` may import other `@apps/<other>` (e.g. client composing the in-process harness Hono factory). Same-package deep imports and type-only `import type` are fine.
- **`@apps/server` Hono/runtime source is isomorphic.** Platform engines (`pg`, `node:*`, …) live only behind injected ports (e.g. `OpenSqlClient`) and `@api-wall-ok` adapter/entry modules. Isomorphic files must not import wall modules.
- `shared/` cannot import from `client/` or `server/` anywhere in the repo (`shared-pure`). Product-lib `shared/` also must not import `use-cases/`, `root/`, or `public/`.
- Within and across feature packages, `client/` cannot import from `server/` and vice-versa (`client-not-server`, `server-not-client`).
- Other `@libs/*` may import a product lib only through `@libs/<pkg>/public/…`. Apps may also import `@libs/<pkg>/root/…`.
- Every `@pkgs/<utility>` micro-package (`assert`, `keyword`, `attribute`, `message`, `kv`, `sql-client`, `logger`, etc.) stays runtime-agnostic and feature-agnostic — no imports from `spaces`, `chess`, or any other product package.
- `apps/client` cannot reach any feature's `server/`; `apps/server` cannot reach any feature's `client/` (`apps-client-no-server`, `apps-api-no-client`).

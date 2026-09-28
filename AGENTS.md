# Agent Notes

Docs: [`docs/GOAL.md`](docs/GOAL.md) (what v1 must be),
[`docs/TESTING.md`](docs/TESTING.md), [`docs/SPEC_STANDARDS.md`](docs/SPEC_STANDARDS.md),
[`docs/CI.md`](docs/CI.md), [`docs/DETERMINISM.md`](docs/DETERMINISM.md),
[`docs/FEATURE_SUBSYSTEMS.md`](docs/FEATURE_SUBSYSTEMS.md),
[`docs/INFRA.md`](docs/INFRA.md), [`docs/OBSERVABILITY.md`](docs/OBSERVABILITY.md),
[`docs/LOW_END_ANDROID_PERF.md`](docs/LOW_END_ANDROID_PERF.md). State each
rule once: link to a doc rather than restating it.

## Hard Rules

- **We never test manually. Ever.** A green `bun check` is the whole release decision; nothing is verified by hand — no click-through, no QA pass, no "tested locally". Running the app is for building and debugging, never evidence; if you want to look at it to know a change works, write the missing check, and if no check can reach the behavior, change the product until one can. Exploratory tests are property- or model-based (`assertProperty` from `@pkgs/property` only; `fc.commands` models; `@pkgs/harness` systems; Quint models for product features — no product random walks). Every bug found gets its literal failing input pinned as an example test marked `// regression: <bug-id>` plus an entry in `libs/tools/goal/known-bugs.json`. No skipped / `.only` / `.todo` / `.if` / `.failing` tests, no `--pass-with-no-tests`, no retries. Tests run in-process on virtual time and are fast. Policy: [`docs/TESTING.md`](docs/TESTING.md).

- **Specs are for business readers.** Every line in `specs/` is understood by a non-technical business person (A0 in [`docs/SPEC_STANDARDS.md`](docs/SPEC_STANDARDS.md)); every behavior test is a spec; each framework package tests through one kitchen-sink example app. Spec text changes only in `spec:` commits; implementers treat it as read-only. Write specs with [`spec-upsert`](.agents/skills/spec-upsert/SKILL.md), bind them with [`spec-implement`](.agents/skills/spec-implement/SKILL.md), audit them with [`spec-audit`](.agents/skills/spec-audit/SKILL.md).

- **Never leave deprecated code.** No `@deprecated` markers, deprecated aliases, shim re-exports, or "kept for migration" optional fields. Delete the old API and update every call site in the same change.

- **Access is decided only by `@libs/permissions`.** Feature gates, usage limits, upsells and "sign in to…" prompts all come from a permission decision: `useCan` / `useDecision` / `usePermissions` on the client, `requireInMutation` / `decideInMutation` in mutation bodies, `requirePermission` in server routes. What a denial unlocks is policy config (`unlockRefs`), rendered by `DenialSurface` or run by `useUnlock` — never a feature's own branch. No product code outside auth, billing and permissions reads `isAnon` / `isSignedIn`, imports `@libs/auth/public/access-facts`, queries `is_anon` / `billing_subscriptions`, or names a role or plan (`@libs/permissions/root/access-model` is for tests and the policy root only). The shell chrome shows identity, never a tier. Account-only actions deny anonymous subjects through a policy restriction (`reason: 'requires_account'`). CI: `import-access-facts.grit`, `import-access-model.grit`, `no-access-state-vocabulary.grit`, `no-tier-vocabulary*.grit`.

- **All nondeterministic I/O is injected.** Product runtime (`apps/*`, `libs/*`, `pkgs/*`, scripts included) never calls bare `Date.now`, zero-arg `new Date()`, `performance.now`, `setTimeout` / `setInterval`, `fetch`, `crypto.randomUUID`, `Math.random` or `crypto.getRandomValues`. Inject `Clock` / `Timers` (`@pkgs/clock`), HTTP (`@pkgs/http-client`) and `createId` / `random` (`@pkgs/uuid`) from composition roots (`createClient(env)` / `createServer(env)` / `createRoomServer(env)` / `createHarness`, wall adapters at process entry), via Solid context (`ClockProvider` / `useClock` / `useTimers` / `useHttpClient` / `useCreateId`) or constructor/param — never a silent wall fallback, never an `Io` bag. `Session` / Runtime are harness-only (`@libs/harness`, `@apps/product`, package `src/harness/`, tests); product envs receive unpacked ports. Do not reintroduce `resolveNow` / `resolveTimers` / `resolveCreateId` / `resolveRandom` / `resolveClock`, `cryptoCreateId` or `mathRandom`. Wall implementations only in tests or entry-shaped files marked `// @io-wall-ok` (`no-bare-io.grit`). File content I/O goes through an injected `@pkgs/object-store` (wall `node:fs` only in `@io-wall-ok` adapters); process I/O stays on `@pkgs/os`. SQL never mints time or ids: no `DEFAULT now()`, `gen_random_uuid()`, `randomblob`, `strftime('now')`, `datetime('now')` or bare `now()` in DML. Scenario authoring lives only in `@pkgs/harness` (`defineSystem` / `defineAction` / `defineProperty`, run by `system.run` / `system.explore` / `system.replay`; no package-local world openers or DSLs; guide: [`pkgs/harness/README.md`](pkgs/harness/README.md)); reports are one standalone HTML file from `@pkgs/harness-report`, never a report tab or server. Gotchas (floats, key order, locale, `hash(state)`, LWW): [`docs/DETERMINISM.md`](docs/DETERMINISM.md).

- **One naming convention.** Markdown docs are `SCREAMING_SNAKE_CASE.md`; every other file and directory is `lower-kebab-case` with a lowercase extension chain. Repo-wide docs live in `docs/`, package docs in `<pkg>/docs/` (only `README.md` at the package root). Tool-mandated names are the only exemptions, listed in `NAMING_EXEMPT` (`libs/tools/naming/naming-rules.ts`). Check: `bun run lint:naming`; fix: `bun run naming:fix` (dry run) then `--write`, which also rewrites every reference.

- **Agents never create branches or worktrees.** Commit to the branch and worktree you started in: no `EnterWorktree`, no `isolation: "worktree"` subagents, no `git worktree add`, no `git checkout -b` / `git switch -c`. Parallel agents split work by files and commit only their own paths (never `git add -A` over another agent's edits), then `git pull --rebase` before pushing. Enforced by `.claude/hooks/no-agent-worktrees.sh`.

- **Agents never merge.** `/pr-ready` takes a PR to a green Ready to merge and stops; a human merges — never `--admin`, never a red, pending or draft PR. `main` moves only through a merged PR ([`docs/CI.md`](docs/CI.md#main-only-moves-through-a-merged-pr)).

- **Never patch dependencies.** No `bun patch`, `patch-package`, `pnpm patch`, `patches/` directory, or `patchedDependencies` / `resolutions` field. Work around a third-party bug in our code or accept it.

- **Infrastructure is OpenTofu; environments are cattle, data is never lost by accident.** Every deployed resource is declared in `libs/infra/tofu` (env-agnostic modules and stacks; per-environment values only in `libs/infra/tofu/envs/<env>.tfvars.json`), so any environment rebuilds from its env file alone. Never create, change or delete infrastructure from TypeScript, a script or a console (`no-infra-outside-tofu.grit`). `libs/infra/policy/stateful.rego` allow-lists the only types an ordinary apply may delete (add one only if losing it loses no data); retire a stateful resource with `removed { lifecycle { destroy = false } }`. The one destroy path is `bun run infra:destroy` for a `protection: "standard"` environment; production and the global stateful resources (`prevent_destroy`) can never be torn down. Guide: [`docs/INFRA.md`](docs/INFRA.md).

- **Never disable structural size limits.** The Tiger-Style caps in [`biome.json`](biome.json) (`noExcessiveLinesPerFile`, `noExcessiveLinesPerFunction`, `useMaxParams`, `noExcessiveNestedCallbacks`, `noExcessiveCognitiveComplexity`, `noExcessiveClassesPerFile`) are load-bearing: no new `'off'` overrides, no `biome-ignore` for them. Refactor instead — extract components, hooks or pure helpers.

- **Local SQLite + `defineQuery` / mutations for client reads and writes.** UI reads local SQLite via `useQuery`; status and paint gate come from `useSyncEngine()` (`status`, `paintReady`); writes go through `useMutationClient()` / `mutate()`. The server mounts one `createSyncApp`. Hydration is event-driven `POST /api/query` (batch `{ queries }` → `{ responses }`) on connect plus pubsub pushes — never polling; mutations drain through `POST /api/mutations`. No feature REST for data that is (or can be) in the user's sync scope; the only exceptions are billing / external APIs — shrink that list, never grow it casually. Sync wire is protocol v3 (`x-sync-protocol: 3`); older clients get `upgrade_required` without a local DB wipe. Write sets and wake topics derive from SQL AST capture + `defineTopicMap`, never hand-declared lists. `@pkgs/sync-engine` has five entrypoints: `client`, `server`, `shared`, `harness`, `solid` (hook-only `useMutationClient` may import `@pkgs/sync-engine/solid/mutation-client` so lazy routes skip `node-sql-parser`).

- **Writes are mutations.** Client code calls `mutate()`; each mutation (`defineMutation` from `@pkgs/sync-engine/shared`) applies its domain SQL in the local transaction and queues an idempotent record for upload. The server replays mutations in one Postgres transaction as the authenticated actor and records permanent `MutationError` / validation failures as write rejections; server-initiated inbox actions invoke the same definitions. No second rules engine, raw CRUD upload or feature REST write path. Code writing domain tables outside mutation replay must call `notifyChannels`. Each `defineMutation` / `defineQuery` lives in its use case's `shared/` ([package layout](#package-layout)); no god-hooks re-exporting every mutation (`useSpaceActions`).

- **Domain rows are soft-delete only.** Removal sets managed `deleted_at`, never `DELETE FROM` a domain table (mutation `tx` rejects it: `NO_HARD_DELETE`). `defineQuery` snapshots include tombstones; UI reads filter `deleted_at IS NULL`. Merge upserts snapshot rows verbatim and rebases pending `sync_engine_mutations` on top — no absence GC. Unsubscribe / denied only clears `sync_engine_scope_meta`. Framework tables (`sync_engine_*`) may hard-delete.

- **Style with Solid builtins via `@pkgs/ui`.** `class` / `classList` for layout and tokens; `style` only for dynamic values classes cannot express. No `sx` / `frameSx` / `fieldSx`, no class-merge helpers (`joinClass` / `cn` / `clsx` / `twMerge`). Scroll/list hosts take frame `class` / `style` and content `contentClass` / `contentStyle`. CI: `no-inline-style-prop.grit`.

- **Three-layer DI.** Only `SqlClient` and the injected ports are long-lived. Use-case classes take `(db, ports)` and open transactions for writes (reads pass `db` as `SqlTx`). Repositories / services / publishers / handlers take `SqlTx` (`Pick` of `query` / `run`) plus ports and are constructed on demand inside the use case. Factory functions `(tx, ports) => …` are the wiring escape hatch; no `*Container` or registry classes (`no-di-container.grit`). `defineMutation` / `defineQuery` handlers and Solid hooks stay as they are.

- **Test layout.** Package tests live in `tests/` (sibling of `src/`); colocate `module.test.ts` only next to public entrypoints. Every test is black-box against the package `exports` — no deep `src/` imports. Harness code lives in `src/harness/` exported as `./harness`, or in a sibling `-harness` package (`@pkgs/room-harness`, `@pkgs/auth-harness`, …). `bun test` is the only runner (`no-vitest.grit`); Solid / DOM tests run with `--conditions=browser --conditions=development --preload @pkgs/bun-test-solid/preload`.

## Debugging

Run `bun obs` before adding logs or rerunning a failure: `bun obs last` when
it just happened, `bun obs find <any id>` otherwise. Workflow, sources and
credentials: [`docs/OBSERVABILITY.md`](docs/OBSERVABILITY.md).

## `@pkgs/ui` design system

`@pkgs/ui` is the only design-system surface: every component, prop type,
hook and theme helper is in-house under `pkgs/ui/src/components/**`,
re-exported from `pkgs/ui/src/index.ts` (`import { Button, Text, useTheme }
from '@pkgs/ui'`). No adapter layer, no third-party UI library.

**Adding a component:** `pkgs/ui/src/components/<name>/<name>.tsx` plus an
`index.ts`, exported from `pkgs/ui/src/components/index.ts`; style with
`class` / `classList` / `style`; set `data-*` on the root via
`dataAttrs({ component: '<PascalName>', ... })`.

**DOM identifiers:** every host exposes `data-component="<Name>"`, and
`ScreenBase` requires `screenId` (`data-screen`); both are stripped from
production bundles (`VITE_TEST_HOOKS` keeps them). Call-site test ids
(`dataSet={{ testid }}` → `data-testid`) ship in every build — the live
critical journeys drive the real bundle by them.

### Solid reactivity

Components run once; reactivity is tracking, not re-rendering.

- Never destructure props (`function Foo({ x })`, `const { x } = props`); read
  `props.x` where it should track.
- Hooks that expose lists or status return `Accessor`s (`friends()`,
  `isLoading()`), not getter bags.
- Never derive UI once at setup; compute inside `createMemo` or a render
  branch.
- Pass `Accessor`s into subscribing hooks (`useFriendshipStatus(() =>
  props.userId)`), or remount with `<Show when={id} keyed>`.
- No JS `switch` in a component (`no-switch-in-component.grit`); use
  `<Switch>` / `<Match>`.

Lint: oxlint (`oxlint.config.mts`, eslint-plugin-solid, type-aware via
oxlint-tsgolint) runs the full Solid set on
`libs/tools/port/solid-scope.json` `dirs` / `files`; product libs get
`reactivityDirs` and `noDestructureDirs`. Suppress with
`oxlint-disable-next-line <rule> -- reason`; unused suppressions fail.

### Mutation UX

Make every mutation's outcome obvious; pick the surface by weight:

- **Destructive or confirm-first** (sign out, leave / end space, delete,
  rename) → `MutationModal` (`idle → loading → success / error` in place;
  success dismissible, errors retryable). Stay on the screen after success.
- **Lightweight, no confirm** (join or create a space) → `Button` with
  `useMutationButton` (spinner → check → retryable error). No `onSuccess`
  navigation; `successHoldMs: 0` only for an immediate non-route side effect.
- **Screen form save / cancel** → `FormActionsFooter` in the `ScreenBase`
  `footer` slot, never header `actions`. Leave via Cancel or breadcrumbs, never
  `router.back()` in `onSuccess`.
- **Card-level inline async** → `useAsync` + compact `SuccessState` /
  `ErrorState`.

Centered modals take `size="small" | "medium" | "large" | "fullWidth"`
(default `medium`; confirms stay `medium`), never an ad-hoc width.

## Checks and CI

`bun check` is the whole gate; `bun health` probes the live deployments. Every
check is a cached, per-package task that reads only its own package; a new
check goes into the package it is about. A gate leaf verifies and never
touches the outside world, and its verdict never depends on the machine
(never branch on `CI`). Make a slow task faster before raising its budget.
Exactly three workflows: Check, Deploy, Health. Rehearse anything touching
deploy, infra, secrets, Workers or `health` with `bun run deploy:dev` before
merging. Details: [`docs/CI.md`](docs/CI.md).

## Superset workspaces

Each workspace is a git worktree set up by `.superset/setup.sh` (`bun
install`, `.cache/secrets`, `apps/*/.env.local`), torn down by
`.superset/teardown.sh` and run by `.superset/run.sh`; per-machine extras go
in the gitignored `.superset/config.local.json`.

- **Ports.** `source .superset/port.sh` before booting a sidecar
  (`@pkgs/postgres-embedded`); the Run pane does it. EMQX
  (`1883` / `8083` / `18083`) and the wrangler preview (`8788`) are
  machine-wide: one workspace at a time may bind them.
- **Iterating.** `bun fmt`, `bun run --filter <pkg> tc`, `bun run --filter
  <pkg> test`, then `bun check`. `bun check:remote` runs the real Check
  workflow for the branch (through `git-sync`) and blocks on its verdict.
  `bun run git-sync` (`/git-sync`) is the one commit/push/trunk-sync step.
  PR bodies follow `.github/PULL_REQUEST_TEMPLATE.md`. `/pr-ready` drives a PR
  to Ready to merge; `/ci-green` drives Check, Deploy and Health green.
- **Agent commands.** `.agents/commands/<name>.md` (with `description:`
  frontmatter) is the only source of a slash command; `bun run agents:sync`
  projects it into every harness (`.claude/commands`, `.cursor/commands`,
  `.opencode/commands`, `.gemini/commands`, `.github/prompts`,
  `.windsurf/workflows`, `.agents/skills`). Never edit the outputs;
  `//#ci:agent-commands` fails on drift.

## Local development

- **`bun run dev`** — `@apps/product`: the wall client at `/`, the Harness at
  `/harness` (linked through their command palettes; `?harness` on `/` hands
  off; `i` / Shift+I opens the project iPad). Harness fabric is
  mockingbird-postgres server + mockingbird-sqlite clients, Google sign-in
  against an in-process simulated IdP. No Wrangler, real Postgres, S3rver or
  MQTT.
- **`bun run dev:client`** — `@apps/client` alone.
- **`bun run stack`** — the highest-fidelity local run: embedded Postgres,
  S3rver, Aedes MQTT, simulated Google and Apple IdPs, N Bun API instances
  running the production Worker handler behind a load balancer
  ([`apps/product/docs/LOCALHOST_STACK.md`](apps/product/docs/LOCALHOST_STACK.md)).
- **`bun run test:report`** — one `harness-report/index.html` over every
  package's spec suite.
- **`bun run sims:open`** — pick project simulators and open Simulator.app.
- **`bun db:migrate`** migrates `DATABASE_URL`; **`bun run db:wipe:dev`** wipes
  a non-production database.

Production-likeness comes from port contract suites (mem engines vs live
Postgres, Kv, ObjectStore, PubSub, billing / TTS / LLM stubs) and
the live-browser runs `HARNESS_MODE=real` (`bun run --filter @apps/product
test:max`: sidecars from `@pkgs/postgres-embedded`, `@pkgs/s3-server`,
`@pkgs/aedes-server`, `@pkgs/emqx-server`) and `HARNESS_MODE=stack`
(`test:stack`). The harness migrates each composition once into
`<package>/.cache/harness-seed-<composition>.pgmm.json` and clones it per
`openHarness` ([`libs/harness/README.md`](libs/harness/README.md)).

### Auth

- **Auth is a port.** Product code knows auth only through `@pkgs/auth`
  (`AuthClientPort`, `AuthServerPort`, `AuthProviderModule`). The in-house IdP
  `@pkgs/auth-inhouse` is one vendor behind it, chosen in
  `@libs/runtime/root/server/app-auth-provider.ts` and the client env's
  `createAuthClient`. Never import it elsewhere (`import-auth-vendor.grit`),
  and never read `idp_*` tables, IdP secrets or `/auth/*` wire shapes from
  product code — extend the port.
- **Providers: Google everywhere, Apple outside production.** Simulations and
  the stack run `@pkgs/idp-mock`, which serves Google's (and Sign in with
  Apple's) real protocol, so the production provider code is what runs.
  `GOOGLE_IDP_ORIGIN` redirects Google (unset = real Google). Apple is
  mock-only: enabled by all five `APPLE_*` bindings, refused when
  `SECRETS_ENV=prd`. Test odd provider behavior through the mock's faults and
  `/__idp/*`, never a stubbed relying party.
- **The mock never passes for a real provider.** Its screens say `OAuth Mock`
  (`IDP_BRAND`, `pkgs/idp-mock/src/shared/brand.ts`) — no Google logo,
  palette, titles or footer, no invented real-looking brand — yet keep full
  flow parity (address, account chooser, password, consent, create-account,
  refusal).
- **Accounts link, never merge silently.** At most one identity per provider
  per user; an identity never moves; the last one cannot be removed. A new
  identity joins an existing account by address only when both addresses are
  provider-verified and neither is an Apple relay; otherwise a pending link
  waits for the person. Settings linking needs a session-bound link ticket.
  The policy is `specs/auth/`; change the spec first, then the reference
  model in `@pkgs/auth-harness`.

### Database

- Migrations are `DatabaseMigration` classes (`@pkgs/db-migrate`), one unit
  per package, composed by `PostgresMigrationRunner` in `@libs/runtime`
  (advisory-locked). Root `db:migrate` runs `libs/runtime/scripts/migrate-cli.ts`.
- Tables are `defineTable` only — domain tables in a feature's
  `shared/schema/` (exported via `public/schema.ts`, registered in
  `@libs/runtime/root/app-schema`), framework tables (sync-engine, outbox, kv,
  matchmaking, `idp_*`) package-local and not in `appSchema`. The only DDL
  emitters are `@pkgs/db-schema-postgres` / `@pkgs/db-schema-sqlite`: no raw
  `.sql` schema files, no `CREATE TABLE` strings (`no-raw-create-table`), no
  ad-hoc `migrateUp`.
- **Non-deploy contexts never reach production Postgres.** Every
  `DATABASE_URL` entrypoint wires `assertNonProductionSecretsEnv` and
  `assertNonProdDatabaseUrl` from `@libs/db/public/database-url-policy`
  (rejects any production env's URL and production hostnames; loopback is
  fine). A non-production API Worker asserts it on the first DB request. The
  escape hatch `ALLOW_PRODUCTION_DATABASE_URL=1` is refused by `db:wipe:dev`.

## Package layout

| Tier | Path | Contains | May import |
| --- | --- | --- | --- |
| Apps | `apps/` (`@apps/`) | deployed surfaces (`server`, `room-server`), the `product` super-app, standalone `client` | apps, libs, pkgs |
| Libs | `libs/` (`@libs/`) | product code: features, shells, platform, `runtime`, `tools` | pkgs, plus other libs' `public/` |
| Pkgs | `pkgs/` (`@pkgs/`) | agnostic utilities, frameworks, dev infra | pkgs only |

`pkgs/` must work in any monorepo: no `gamezilla`, `@libs/*` or product
references, in code, comments or defaults. How features, shells and the
composition root (`@libs/runtime`, the one package that knows every feature)
fit together, and how to add a feature, is
[`docs/FEATURE_SUBSYSTEMS.md`](docs/FEATURE_SUBSYSTEMS.md).

A product lib is organized by use case, so one directory traces a request
from client to server to database:

```
libs/<feature>/src/
  use-cases/<use-case>/
    client/     # that request's hook + its own confirm UI
    shared/     # its defineMutation / defineQuery / validation
    server/     # its REST / outbox consumer
  shared/       # domain primitives (types, repos, RoomModule, schema)
  root/         # feature manifest, screens and chrome composing many use cases
  harness/      # actions, reads and slices for its specs
  public/       # what other libs may import
```

Omit empty `client/` / `server/`. Package `exports` are `./public/*`,
`./root/*` (and `./harness/*`) only — never `use-cases/` or `shared/`. Other
libs import `@libs/<pkg>/public/…`; apps and tests may also import `root/`.
Use cases never import other use cases, `root/` or `public/`. Prefer relative
imports inside a package. Exempt from this tree: `@libs/db`, `@libs/secrets`,
`@libs/games`, `@libs/runtime`, `@libs/test-ids`, `@libs/tools`.

`pkgs/` use `src/{client,server,shared}/`, or a flat `"./*"` export for
micro-packages. Package scripts live in `<pkg>/scripts/` (include
`./scripts/**/*.ts` in `tsconfig.tc.json` and the root `tsconfig.json`).
Package type-checking uses `tsconfig.tc.json` (`tsc --noEmit -p
./tsconfig.tc.json`), never a package `tsconfig.json` — that would steal files
from the root project and break cross-package rename (exception:
`apps/client`).

**Layering is enforced by Biome** (`libs/tools/biome-plugins/import-*.grit`,
each probed in `libs/tools/scripts/import-boundaries.test.ts`, plus
`noImportCycles` and `noUndeclaredDependencies`):

- the tier pyramid above;
- `shared/` never imports `client/` or `server/`, and a product lib's
  `shared/` never imports `use-cases/`, `root/` or `public/`;
- `client/` and `server/` never import each other; `apps/client` reaches no
  `server/`, `apps/server` no `client/`;
- `@apps/server` source is isomorphic: platform engines (`pg`, `node:*`) only
  behind injected ports and `@api-wall-ok` modules;
- libs and pkgs never import `@apps/*`.

**Games.** A game is a feature package modeled on `@libs/chess`: a
`RoomModule` in `shared/` with `hash(state)`
([`docs/DETERMINISM.md`](docs/DETERMINISM.md)), its `*GameShared` definition
appended to `GAME_DEFINITIONS` in `libs/games/src/game-plugins.ts`, and its
`src/` added to the Lingui catalogs (`LINGUI_CATALOG_SOURCES`, `libs/tools/scripts/lingui-scope.ts`).
**Billing providers** each export one `MembershipProviderModule`;
`@pkgs/billing-providers` is the single list composition roots iterate —
never name a provider elsewhere (`import-billing-vendor.grit`).
**Runtime client config** (EMQX URL, observability backend) is synced
`@libs/client-config`, not `VITE_*` build env.

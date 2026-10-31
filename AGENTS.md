# Agent Notes

What the app is is specified in [`specs/`](specs/). How to write a spec is
[`specs/README.md`](specs/README.md). Product, stack, and mechanism are
[`README.md`](README.md). State each rule once: link to that file rather
than restating it.

## Hard Rules

- **We never test manually. Ever.** A green full verification (the `release` profile's whole gate: on every pull request's `verify:end`, and again in Release on the exact commit it ships) is the whole release decision; nothing is verified by hand — no click-through, no QA pass, no "tested locally". Running the app is for building and debugging, never evidence; if you want to look at it to know a change works, write the missing verification, and if no verification can reach the behavior, change the product until one can. Exploratory tests are property- or model-based (`assertProperty` from `@pkgs/property-shared-ts` only; `fc.commands` models; `@pkgs/harness-root-shared-ts` systems; Quint models for product subs — no product random walks). Every bug found gets its literal failing input pinned as an example test marked `// regression: <bug-id>` plus its own file `libs/tools-harness-ts/goal/known-bugs/<bug-id>.json` (`summary`, `regressionTest`). No skipped / `.only` / `.todo` / `.if` / `.failing` tests, no `--pass-with-no-tests`, no retries. Tests run in-process on virtual time and are fast. Policy: [`README.md`](README.md#correctness-machinery).

- **Specs are for business readers.** Every line in `specs/` is understood by a non-technical business person (A0 in [`specs/README.md`](specs/README.md)); every behavior test is a spec; each framework package tests through one kitchen-sink example app. Spec text changes only in `spec:` commits; implementers treat it as read-only. What the app should be lives only in `specs/`, with no discrete versions of the app; [`README.md`](README.md) is the implementation briefing and never a second product definition. Step catalogs (`<package>/STEPS_CATALOG.md`, index `docs/STEPS_CATALOG.md`) are generated and gitignored: `bun install` writes them and `bun run spec:catalog` refreshes them. Write specs with [`spec-upsert`](.agents/skills/spec-upsert/SKILL.md), bind them with [`spec-implement`](.agents/skills/spec-implement/SKILL.md), audit them with [`spec-audit`](.agents/skills/spec-audit/SKILL.md).

- **A person recovers without support.** There is no support team. A person-facing change meets the definition of done in [`docs/SELF_SERVICE_READINESS.md`](docs/SELF_SERVICE_READINESS.md) (distinct loading / empty / failure states, work preserved, a next action on every error, safe retries, observable failures) and updates its readiness-matrix row in the same change. Product copy never sends a person to support. CI: `@libs/tools-harness-ts#ci:goals`.

- **Never leave deprecated code.** No `@deprecated` markers, deprecated aliases, shim re-exports, or "kept for migration" optional fields. Delete the old API and update every call site in the same change.

- **Access is decided only by `@libs/permissions`.** Sub gates, usage limits, upsells and "sign in to…" prompts all come from a permission decision: `useCan` / `useDecision` / `usePermissions` on the client, `requireInMutation` / `decideInMutation` in mutation bodies, `requirePermission` in server routes. What a denial unlocks is policy config (`unlockRefs`), rendered by `DenialSurface` or run by `useUnlock` — never a sub's own branch. No product code outside auth, billing and permissions reads `isAnon` / `isSignedIn`, imports `@libs/auth/public/access-facts`, queries `is_anon` / `billing_subscriptions`, or names a role or plan (`@libs/permissions/root/access-model` is for tests and the policy root only). The shell chrome shows identity, never a tier. Account-only actions deny anonymous subjects through a policy restriction (`reason: 'requires_account'`). CI: `import-access-facts.grit`, `import-access-model.grit`, `no-access-state-vocabulary.grit`, `no-tier-vocabulary*.grit`.

- **All nondeterministic I/O is injected.** Product runtime (`apps/*`, `libs/*`, `pkgs/*`, scripts included) never calls bare `Date.now`, zero-arg `new Date()`, `performance.now`, `setTimeout` / `setInterval`, `fetch`, `crypto.randomUUID`, `Math.random` or `crypto.getRandomValues`. Inject `Clock` / `Timers` (`@pkgs/clock`), HTTP (`@pkgs/http-client`) and `createId` / `random` (`@pkgs/uuid`) from composition roots (`createClient(env)` / `createServer(env)` / `createRoomServer(env)` / `createHarness`, wall adapters at process entry), via Solid context (`ClockProvider` / `useClock` / `useTimers` / `useHttpClient` / `useCreateId`) or constructor/param — never a silent wall fallback, never an `Io` bag. `Session` / Runtime are harness-only (`@libs/harness-ts`, `@apps/product-ts`, `-harness` packages, tests); product envs receive unpacked ports. Do not reintroduce `resolveNow` / `resolveTimers` / `resolveCreateId` / `resolveRandom` / `resolveClock`, `cryptoCreateId` or `mathRandom`. Wall implementations only in tests or entry-shaped files marked `// @io-wall-ok` (`no-bare-io.grit`). File content I/O goes through an injected `@pkgs/object-store` (wall `node:fs` only in `@io-wall-ok` adapters); process I/O stays on `@pkgs/os`. SQL never mints time or ids: no `DEFAULT now()`, `gen_random_uuid()`, `randomblob`, `strftime('now')`, `datetime('now')` or bare `now()` in DML. Scenario authoring lives only in `@pkgs/harness-root-shared-ts` (`defineSystem` / `defineAction` / `defineProperty`, run by `system.run` / `system.explore` / `system.replay`; no package-local world openers or DSLs; guide: [`pkgs/harness-root-shared-ts/README.md`](pkgs/harness-root-shared-ts/README.md)); reports go object store → Atlas: CI publishes to the shared reports store, and the standalone Atlas explorer renders it — no reports screen, command, or API in the product app or harness. Gotchas (floats, key order, locale, `hash(state)`, LWW): [`README.md`](README.md#correctness-machinery).

- **One naming convention.** Markdown docs are `SCREAMING_SNAKE_CASE.md`; every other file and directory is `lower-kebab-case` with a lowercase extension chain. The repo briefing is `README.md`. A package may keep its own `README.md` and `<pkg>/docs/`. `docs/` at the repo root holds the generated (gitignored) step-catalog index. Tool-mandated names are the only exemptions, listed in `NAMING_EXEMPT` (`libs/tools-harness-ts/naming/naming-rules.ts`). Verify: `bun run lint:naming`; fix: `bun run naming:fix` (dry run) then `--write`, which also rewrites every reference.

- **Every package declares its language.** `package.json` carries `"language"` (`typescript`, `swift`, or `neutral` for specs, schemas and data) beside `category`, and native packages declare `"platforms"`. Every package's name ends in its runtime suffix, then its language suffix (`@pkgs/clock-shared-swift`, `@libs/<slice>-client-ts`); apps omit the runtime suffix and neutral packages both. There are no exemptions. Implementations in different languages meet only through neutral packages, and native manifests (`Package.swift`, the Xcode project) name exactly the workspace dependencies `package.json` does. Native tools build; Turborepo runs them through the thin wrappers in `libs/tools-harness-ts/scripts/` (`swift-task.ts`, `xcode-task.ts`). Toolchains are pinned in `mise.toml`, and an Apple build that did not happen is never a pass. Guide: [`docs/POLYGLOT.md`](docs/POLYGLOT.md). CI: `@libs/tools-harness-ts#ci:package-names` (names, one pass over every manifest) and `language-boundaries.ts` in every package's `lint` (dependencies, native manifests).

- **Own every long-lived command.** Use the launch and cleanup entry points in [`README.md`](README.md#laptop). Never start an unmanaged background server, watcher, compiler, database, browser, simulator, or media worker.

- **Turborepo is the only task runner.** Every root script is `turbo run <tasks>` (its own body is the root task `task:<command>`), an alias of one, or a task body declared in `turbo.json`. No script runs another script (`bun run <script>`, `--filter`, `--cwd`, `pre`/`post` hooks) or backgrounds a process (`&`): order is `dependsOn`, side by side is `with`. Every task is `cache: false` or declares `inputs` and `outputs`. `lint` fails on anything else; the rule and its few named exceptions are [`libs/tools-harness-ts/scripts/task-runner-policy.ts`](libs/tools-harness-ts/scripts/task-runner-policy.ts).

- **Keep the Turbo cache effective.** An edit should rerun as few `lint`, `tc` and `test` tasks as it must. `@libs/tools-harness-ts#ci:cache-hygiene` (`bun run ci:cache-hygiene`) fails on a new hub package (one whose edits rerun 50 or more packages), a hub that grows, a hub that bundles files few packages use, a `$TURBO_ROOT$` glob over every package in a task's inputs, a new global dependency, import aliases in `tsconfig.base.json`, and derived files out of date. Every failure says what to do. After editing `biome.json`, a package's imports or its dependencies, run `bun run cache:sync`; `bun run cache:explain <package>` shows why a package is costly. Thresholds, exceptions and the reasoning: [`docs/CI_REQUIREMENTS.md`](docs/CI_REQUIREMENTS.md#cache-friendly-structure).

- **Agents use git and pull requests freely.** Agents may create branches and worktrees (`git worktree add`, `git switch -c`, a harness's worktree-isolated subagents), push their branches, and open, label, comment on and update pull requests, so one change is one reviewable PR. Agents sharing one worktree split work by files and commit only their own paths (`git commit -- <paths>`, never `git add -A` over another agent's edits). Never rewrite history someone else pushed: no force-push to a branch you did not create, and never to `main`. Delete a branch and worktree you created once its PR is closed or merged.

- **Concurrent worktrees never share a hot file.** Many agents work at once, so nothing they routinely add to is one shared file. A register is a directory with one file per entry (`libs/tools-harness-ts/goal/known-bugs/<bug-id>.json`); a list of local modules is discovered from the filesystem (`tests/<kind>/index.ts` loads every `*.steps.ts` / `*.binding.ts`); output derived from sources (step catalogs, the compiled Lingui catalog `messages.ts`) is gitignored and written by `bun install` (`postinstall` → `bun run generate`), never committed.

- **Atlas is an npm dependency, never a copy.** `@crvouga/atlas` installs from npm through the root `catalog`: no submodule, vendored copy, `git` / `file:` dependency or patch. Import only its documented paths (`@crvouga/atlas`, `/spec`, `/schema`, `/reports/<module>`, …) and run its `atlas` / `atlas-visualizer` commands. A bug or gap in Atlas is an issue at [crvouga/atlas](https://github.com/crvouga/atlas/blob/main/docs/reporting-issues.md), never a fix made from here; a workaround in our code is named in that issue and removed when the release that fixes it lands. Upgrade by raising the catalog entry in a commit of its own. Guide: [dogfooding](https://github.com/crvouga/atlas/blob/main/docs/dogfooding.md).

- **No git hooks.** Do not add a `pre-commit`, `pre-push`, `core.hooksPath`, Husky, or any other git hook. A direct push to `main` is allowed. Release still runs the whole Verify gate on that commit before it ships ([`README.md`](README.md#correctness-machinery)).

- **Agents never merge a pull request.** `/pr-ready` takes a PR to a green Ready to merge and stops; a human merges — never `--admin`, never a red, pending or draft PR. A person may also push `main` directly.

- **Never patch dependencies.** No `bun patch`, `patch-package`, `pnpm patch`, `patches/` directory, or `patchedDependencies` / `resolutions` field. Work around a third-party bug in our code or accept it.

- **Infrastructure is code, zero-ops, and web scale; environments are cattle, data is never lost by accident.** Every deployed resource is declared in `libs/infra-shared-ts/tofu` (env-agnostic modules and stacks; per-environment values only in `libs/infra-shared-ts/tofu/envs/<env>.tfvars.json`), so any environment rebuilds from its env file alone. Never create, change or delete infrastructure from TypeScript, a script or a console (`no-infra-outside-tofu.grit`). `libs/infra-shared-ts/policy/stateful.rego` allow-lists the only types an ordinary apply may delete (add one only if losing it loses no data); retire a stateful resource with `removed { lifecycle { destroy = false } }`. The one destroy path is `bun run infra:destroy` for a `protection: "standard"` environment; production and the global stateful resources (`prevent_destroy`) can never be torn down. Resources and why: [`README.md`](README.md#infrastructure).

- **Never disable structural size limits.** The Tiger-Style caps in [`biome.json`](biome.json) (`noExcessiveLinesPerFile`, `noExcessiveLinesPerFunction`, `useMaxParams`, `noExcessiveNestedCallbacks`, `noExcessiveCognitiveComplexity`, `noExcessiveClassesPerFile`) are load-bearing: no new `'off'` overrides, no `biome-ignore` for them. Refactor instead — extract components, hooks or pure helpers.

- **Local SQLite + `defineQuery` / mutations for client reads and writes.** UI reads local SQLite via `useQuery`; status and paint gate come from `useSyncEngine()` (`status`, `paintReady`); writes go through `useMutationClient()` / `mutate()`. The server mounts one `createSyncApp`. Hydration is event-driven `POST /api/query` (batch `{ queries }` → `{ responses }`) on connect plus pubsub pushes — never polling; mutations drain through `POST /api/mutations`. No sub REST for data that is (or can be) in the user's sync scope; the only exceptions are billing / external APIs — shrink that list, never grow it casually. Sync wire is protocol v3 (`x-sync-protocol: 3`); older clients get `upgrade_required` without a local DB wipe. Write sets and wake topics derive from SQL AST capture + `defineTopicMap`, never hand-declared lists. `@pkgs/sync-engine` has five entrypoints: `client`, `server`, `shared`, `harness`, `solid` (hook-only `useMutationClient` may import `@pkgs/sync-engine/solid/mutation-client` so lazy routes skip `node-sql-parser`).

- **Writes are mutations.** Client code calls `mutate()`; each mutation (`defineMutation` from `@pkgs/sync-engine/shared`) applies its domain SQL in the local transaction and queues an idempotent record for upload. The server replays mutations in one Postgres transaction as the authenticated actor and records permanent `MutationError` / validation failures as write rejections; server-initiated inbox actions invoke the same definitions. No second rules engine, raw CRUD upload or sub REST write path. Code writing domain tables outside mutation replay must call `notifyChannels`. Each `defineMutation` / `defineQuery` lives in its use case's `shared/` ([package layout](#package-layout)); no god-hooks re-exporting every mutation (`useSpaceActions`).

- **Domain rows are soft-delete only.** Removal sets managed `deleted_at`, never `DELETE FROM` a domain table (mutation `tx` rejects it: `NO_HARD_DELETE`). `defineQuery` snapshots include tombstones; UI reads filter `deleted_at IS NULL`. Merge upserts snapshot rows verbatim and rebases pending `sync_engine_mutations` on top — no absence GC. Unsubscribe / denied only clears `sync_engine_scope_meta`. Framework tables (`sync_engine_*`) may hard-delete.

- **Screens compose `@pkgs/ui`; only the design system styles.** Product packages (`libs/*-client`, `apps/client-ts`, `apps/product-ts`, the feedback and harness-console clients) write no DOM elements and no `class` / `classList` / `style`: layout is `Stack*` / `Grid` / `Layer` props, text is `P` / `Text` / `H1`–`H6`, paint is `Surface` or a component variant. Inside `@pkgs/ui-root-client-ts` (and component packages such as the chess board) style with Solid builtins: `class` / `classList` for token utilities, `style` only for dynamic values classes cannot express. Component props are closed (token names and keywords): no `class` / `style` / `contentClass` escape hatch, no `sx` / `frameSx` / `fieldSx`, no class-merge helpers (`joinClass` / `cn` / `clsx` / `twMerge` / `cva`). CI: `design-vocabulary.ts` + `design-composition.ts` (every UI package's `lint`), `no-inline-style-prop.grit`.

- **Three-layer DI.** Only `SqlClient` and the injected ports are long-lived. Use-case classes take `(db, ports)` and open transactions for writes (reads pass `db` as `SqlTx`). Repositories / services / publishers / handlers take `SqlTx` (`Pick` of `query` / `run`) plus ports and are constructed on demand inside the use case. Factory functions `(tx, ports) => …` are the wiring escape hatch; no `*Container` or registry classes (`no-di-container.grit`). `defineMutation` / `defineQuery` handlers and Solid hooks stay as they are.

- **Test layout.** Package tests live in `tests/` (sibling of `src/`); colocate `module.test.ts` only next to public entrypoints. Every test is black-box against the package `exports` — no deep `src/` imports. Harness code lives in a sibling `-harness` package (`@pkgs/room-root-harness-ts`, `@pkgs/auth-root-harness-ts`, …). `bun test` is the only runner (`no-vitest.grit`); Solid / DOM tests run with `--conditions=browser --conditions=development --preload @pkgs/bun-test-solid-client-ts/preload`.

## Code graph

Graphify turns the repo into a knowledge graph in `graphify-out/` (gitignored).
It is a pinned `mise.toml` tool, so `mise install` provides it, and a cold
workspace writes its `/graphify` (Claude Code) / `$graphify` (Codex) skill
(`bun run graphify:install`; rerun it after a version bump). Build the graph once with `graphify update .`
(AST only, no API key; a few minutes), rerun it after code changes.

- When `graphify-out/graph.json` exists, run `graphify query "<question>"`
  before your first grep or source read on a codebase question; use
  `graphify path "<A>" "<B>"` for relationships and `graphify explain "<X>"`
  for one concept. Read raw files only for the lines the graph located.
- Never run `graphify hook install` or any Graphify git hook (no git hooks, below).
- Exclusions live in [`.graphifyignore`](.graphifyignore).

## Semantic code tools

Serena gives agents language-server navigation and edits over MCP
(`find_symbol`, `find_referencing_symbols`, symbol-level edits). It is a pinned
`mise.toml` tool; the project is [`.serena/project.yml`](.serena/project.yml).
Every harness's MCP entry for it (`.mcp.json`, `.codex/config.toml`,
`.cursor/mcp.json`, `.gemini/settings.json`, `.vscode/mcp.json`,
`opencode.json`) is generated by `bun run agents:sync` from
`libs/tools-harness-ts/scripts/sync-agent-mcp.ts`; never edit the Serena entries, and
`@libs/tools-harness-ts#ci:agent-commands` fails on drift. Windsurf and the Copilot CLI
only read per-user config, so add `mise exec -- serena start-mcp-server`
there yourself. Use the graph above to find where to look, Serena to read and
change the symbols it finds. The first start downloads the language server, so
give a client a longer MCP startup timeout (Claude Code: `MCP_TIMEOUT=60000`).

ast-grep searches and rewrites by syntax tree, not text: use it for a pattern
that grep cannot express and for a mechanical change across many call sites
(`ast-grep run -l tsx -p 'useQuery($$$ARGS)' libs`, `--rewrite` to change them),
instead of a regex over source. It is a pinned `mise.toml` tool; its `ast-grep`
(rules) and `ast-grep-outline` (file structure) skills come from
`ast-grep/agent-skill` through `skills-lock.json` into `.agents/skills`, which
Codex reads and `.claude/skills` links for Claude Code. Update them with
`bunx skills update`, never by hand. Repo-wide lint rules stay Biome plugins
(`libs/tools-harness-ts/biome-plugins/*.grit`), not ast-grep rules.

## Debugging

Local feedback reports are stored under `.feedback/`. Before investigating reported
defects, inspect that directory for open reports (`bun feedback --list`). Reporting
architecture and recovery: [`docs/FEEDBACKING.md`](docs/FEEDBACKING.md).

Run `bun obs` before adding logs or rerunning a failure: `bun obs last` when
it just happened, `bun obs find <any id>` otherwise. Workflow, sources and
credentials: [`README.md`](README.md#correctness-machinery).

## `@pkgs/ui` design system

For frontend design, new screens, UI changes and visual consistency reviews,
use [`frontend-design`](.agents/skills/frontend-design/SKILL.md), including
mobile and native app surfaces.

`@pkgs/ui` is the only design-system surface: every component, prop type,
hook and theme helper is in-house under `pkgs/ui-root-client-ts/src/*`,
re-exported from individual module exports (`import { Button }
from '@pkgs/ui-root-client-ts/button'`). No adapter layer, no third-party UI library.

**How it looks** is decided once, in
[`pkgs/ui-root-client-ts/README.md`](pkgs/ui-root-client-ts/README.md): the
palette, the type roles, panels for lists, radius by hierarchy, blue only
for what is chosen, one activity indicator. Screens are compositions of
components and set only their props; they never write markup, classes or
styles, and nothing anywhere picks an arbitrary value, a raw color, a step
off the 4px grid or a `dark:` variant (`design-vocabulary.ts` in every UI
package's `lint`, plus the locked Tailwind theme `src/theme.css`). A need the
components cannot express becomes a new component or variant, never markup in
a screen.

**Adding a component:** `pkgs/ui-root-client-ts/src/<name>/index.tsx`, exported through the
package's `./*` mapping; closed, typed props (token names and variants,
never `class` / `style`); style with `class` / `classList` / `style`
internally; set `data-*` on the root via `dataAttrs({ component:
'<PascalName>', ... })`; colocate CSF stories, fixtures, component styles and `baselines/` in the same slice, showing meaningful variants,
states and interactions, and a harness test.

**Agent UI workflow:** before building, reviewing or maintaining a component or
screen, follow the [Storybook agent workflow](pkgs/ui-root-harness-ts/README.md#agent-workflow)
(discovery → reuse → stories → automated evidence → maintenance). It is the
single workflow for every harness; `/storybook-ui <task>` is its command entry
point. Use it together with the design guidance above.

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
`libs/tools-harness-ts/port/solid-scope.json` `dirs` / `files`; product libs get
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

## Verification and CI

Four workflows, one contract each. Details:
[`README.md`](README.md#correctness-machinery).

| Workflow | Command | Contract |
| --- | --- | --- |
| Verify PR (`verify-pr.yml`) | `bun verify` | Deterministic, merge-blocking validation: the `release` profile, the whole gate Release runs, so a green pull request is a green release and Release restores its results from the remote cache. Keeps no test report or artifact: a failure is read from the job log. |
| Verify Nightly (`verify-nightly.yml`) | `bun verify-nightly` | Comprehensive verification and exploration on `main`, every night. Owns test reports, diagnostics and reproducibility. Never gates a merge or a deploy. |
| Release (`deploy.yml`) | `bun deploy` | Continuous production release: on every push to `main`, when `main` has moved, it runs the whole gate (`release` profile) on that exact commit, then ships it. |
| Health (`health.yml`) | `bun health` | Scheduled verification that production is available and correct. Releases nothing. |

- **Run `bun verify` before you call development work done.** It is the
  whole gate every pull request and Release run. Run `bun verify-nightly` (or one group:
  `bun verify-nightly random`) when a change deserves deeper verification, such
  as a new Quint model, a property, or sync and recovery code. An ordinary
  pull request never waits for a green nightly run.
- **One set of tests, two profiles.** `libs/tools-harness-ts/scripts/verify-profile.ts` is
  the only place they differ: the depth (`release` replays the fewest drawn traces of each Quint
  model that take every bound action, at the pinned property budget;
  `nightly` replays every trace at five times the budget), the time budgets,
  and whether reports are kept. The nightly-only
  suites are existing tasks (fresh-seed property runs, determinism fuzz,
  mutants, real-browser stack runs, UI quality, coverage, benchmarks). Never
  write a test that exists only for one profile.
- **A nightly finding is promoted.** Pin the failing trace in the model
  binding's `regressions`, or the shrunk input as a `// regression: <bug-id>`
  example, so the `release` profile replays it from then on.
- **The required status is `verify:end`.** Verify PR is three jobs
  (`verify:start`, `verify:shards (N)`, `verify:end`). They keep the `verify:`
  prefix wherever the gate runs (a pull request, Release's verification, the
  nightly run). Every CI job runs on a standard GitHub-hosted `ubuntu-24.04` runner: a fresh
  VM per job, never a machine that keeps files between jobs
  (the repository is public, so pull-request code is untrusted and must not
  run where a deploy later runs). CI does not check native packages or
  `test:posix` suites
  ([`docs/CI_REQUIREMENTS.md`](docs/CI_REQUIREMENTS.md#runner-operating-systems)).
  Code a CI task runs is OS-neutral: a repository path is `/`-separated
  (`slashPath` from `@pkgs/os-shared-ts/slash-path`; `no-native-relative-path.grit`
  refuses a bare `node:path` `relative()`), and nothing assumes a POSIX shell,
  `/tmp` or a tool the runner did not get from `mise.toml`.
  The ruleset on `main` does not require that verification before a push.
- **Every gate is a package-owned Turbo task.** The task list in
  `libs/tools-harness-ts/scripts/turbo-ci-run.ts` runs every gate through Turbo. There
  are no root `//#verify`, `//#ci:*`, or root lint verifications: each gate has
  explicit inputs and caching, and a new verification goes into the package it is
  about. Bespoke gates such as the Synthetic Population Worker hosting verification
  live in their owning package and join the same sharded task list. A gate
  leaf verifies and never touches the outside world, and its verdict never
  depends on the machine (never branch on `CI`). Make a slow task faster
  before raising its budget.
- **Release ships every push to `main`.** Every pushed commit is verified by the whole gate and
  shipped; it never waits for the nightly run. A red `release` run ships
  nothing, so a slow suite a merge broke stops the release, not the merge. `bun health` and `bun deploy` dispatch
  their workflows and block on the verdict; `bun health:local` and
  `bun deploy:local` run that work on this machine.
- **Exactly four workflows.** Rehearse anything touching deploy, infra,
  secrets, Workers or `health` in GitHub Actions before merging, triggered and
  managed locally with the GitHub CLI. Never execute a rehearsal on the
  developer machine.

## Workspaces

Each workspace is a git worktree created by an agent orchestrator (Superset,
super.engineering, …). All of them run the same lifecycle hooks from
`libs/tools-harness-ts/workspace/`: `run.sh` is the only start script. A cold workspace
prepares itself once (`mise install`, `bun install`,
`.cache/secrets`, `apps/*/.env.local`) and writes `.cache/workspace-warm`;
later runs skip that and start the stack. Preparation never fails the launch.
`teardown.sh` releases the workspace's listeners. Install and merge stay
Turborepo tasks (`//#workspace:*`, `step.sh`) that print only when they fail.
The hooks
derive paths from git, never from a tool's env vars. `bun run workspace:sync` projects them into
every orchestrator's config (`.superset/config.json`,
`.super.engineering/config.json`); never edit those, and
`@libs/tools-harness-ts#ci:workspace-lifecycle` fails on drift. A new orchestrator is one entry in
`ORCHESTRATORS` in `libs/tools-harness-ts/scripts/sync-workspace-lifecycle.ts`.
Per-machine extras go in the gitignored `.superset/config.local.json` or
super.engineering's app project settings.

- **Ports.** `source libs/tools-harness-ts/workspace/port.sh` before booting a sidecar
  (`@pkgs/postgres-mockingbird-server-ts`); the Run pane does it. EMQX
  (`1883` / `8083` / `18083`) and the wrangler preview (`8788`) are
  machine-wide: one workspace at a time may bind them.
- **Iterating.** `bun fmt`, `bunx turbo run tc test --filter=<pkg>` (cached),
  then `bun verify` for the local full gate.
  `bun run git-sync` (`/git-sync`) is the one commit/push/trunk-sync step.
  PR bodies follow `.github/PULL_REQUEST_TEMPLATE.md`. `/pr-ready` drives a PR
  to Ready to merge; `/ci-workflows-green` drives Verify, Release and Health
  green; the [`ci-green`](.agents/skills/ci-green/SKILL.md) skill runs the
  full pull-request suite locally and fixes every failure on the current
  branch.
- **Agent commands.** `.agents/commands/<name>.md` (with `description:`
  frontmatter) is the only source of a slash command; `bun run agents:sync`
  projects it into every harness (`.claude/commands`, `.cursor/commands`,
  `.opencode/commands`, `.gemini/commands`, `.github/prompts`,
  `.windsurf/workflows`, `.agents/skills`). Never edit the outputs;
  `@libs/tools-harness-ts#ci:agent-commands` fails on drift.

## Local development

- **`bun run dev`** — the localhost stack: Mockingbird Postgres, Mockingbird S3, Aedes
  MQTT, simulated Google, Apple and Stripe, and N Bun API instances running
  the production Worker handler behind a load balancer, with the product web
  app in front (`/`, `/harness`, `/simulator`). `bun run stack` is the same
  command. Each process is its own Turborepo task (`@apps/product-ts#dev:*`).
  Tasks, ports and flags: [`README.md`](README.md#laptop).
- **`bun run dev:client`** — `@apps/client-ts` alone.
- **`bun run sims:open`** — pick project simulators and open Simulator.app.
- **`bun db:migrate`** reconciles `DATABASE_URL` to the declared schemas;
  **`bun run db:wipe:dev`** wipes a non-production database.

Production-likeness comes from port contract suites (mem engines vs live
Postgres, Kv, ObjectStore, PubSub, billing / TTS / LLM stubs) and
the live-browser runs `HARNESS_MODE=real` (`bun run --filter @apps/product-ts
test:max`: sidecars from `@pkgs/postgres-mockingbird-server-ts`, `@pkgs/s3-server-ts`,
`@pkgs/aedes-server-ts`, `@pkgs/emqx-server-ts`) and `HARNESS_MODE=stack`
(`test:stack`). The harness migrates each composition once into
`<package>/.cache/harness-seed-<composition>.pgmm.json` and clones it per
`openHarness` ([`libs/harness-ts/README.md`](libs/harness-ts/README.md)).

### Auth

- **Auth is a port.** Product code knows auth only through `@pkgs/auth`
  (`AuthClientPort`, `AuthServerPort`, `AuthProviderModule`). The in-house IdP
  `@pkgs/auth-inhouse` is one vendor behind it, chosen in
  `@libs/runtime/root/server/app-auth-provider.ts` and the client env's
  `createAuthClient`. Never import it elsewhere (`import-auth-vendor.grit`),
  and never read `idp_*` tables, IdP secrets or `/auth/*` wire shapes from
  product code — extend the port.
- **Providers: Google everywhere, Apple outside production.** Simulations and
  the stack run `@crvouga/mockingbird-service-oauth`, which serves Google's
  (and Sign in with Apple's) real protocol, so the production provider code
  is what runs. `GOOGLE_IDP_ORIGIN` redirects Google (unset = real Google).
  Apple is mock-only: enabled by all five `APPLE_*` bindings, refused when
  `SECRETS_ENV=prd`. Test odd provider behavior through the mock's behavior,
  faults and `/__admin/*`, never a stubbed relying party.
- **Vendors are simulated by Mockingbird, never by in-house mocks.** Stripe
  (`@crvouga/mockingbird-service-stripe`) and Google / Apple
  (`@crvouga/mockingbird-service-oauth`) run in process in harnesses and as
  servers in the stack. A gap or divergence in a simulated vendor is an issue
  at [crvouga/mockingbird](https://github.com/crvouga/mockingbird/blob/main/docs/REPORTING_ISSUES.md),
  never a local mock or a workaround in product code.
- **Accounts link, never merge silently.** At most one identity per provider
  per user; an identity never moves; the last one cannot be removed. A new
  identity joins an existing account by address only when both addresses are
  provider-verified and neither is an Apple relay; otherwise a pending link
  waits for the person. Settings linking needs a session-bound link ticket.
  The policy is `specs/auth/`; change the spec first, then the reference
  model in `@pkgs/auth-root-harness-ts`.

### Database

- Schema changes are reconciliation only. `reconcilePostgres` in
  `@libs/runtime` brings Postgres in line; dialect drivers are
  `reconcilePostgresSchema` / `reconcileSqliteSchema`. There is no migration
  class. Root `db:migrate` runs `libs/runtime-server-ts/scripts/migrate-cli.ts`. Seed
  data stays on `@pkgs/db-migrate-shared-ts` seeders.
- Tables are `defineTable` only — domain tables in a sub's
  `shared/schema/` (exported via `public/schema.ts`, registered in
  `@libs/runtime/root/app-schema`), framework tables (sync-engine, outbox, kv,
  matchmaking, `idp_*`) package-local and not in `appSchema`. The only DDL
  emitters are `@pkgs/db-schema-postgres` / `@pkgs/db-schema-sqlite`: no raw
  `.sql` schema files, no `CREATE TABLE` strings (`no-raw-create-table`).
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
| Libs | `libs/` (`@libs/`) | product code: subs, shells, platform, `runtime`, `tools` | pkgs, plus other libs’ exported modules |
| Pkgs | `pkgs/` (`@pkgs/`) | agnostic utilities, frameworks, dev infra | pkgs only |

`pkgs/` must work in any monorepo: no brand or namespace
([`docs/BRANDING.md`](docs/BRANDING.md)), `@libs/*` or product references,
in code, comments or defaults. The tiers hold in every language;
how a Swift (or later Rust, Kotlin) package joins them is
[`docs/POLYGLOT.md`](docs/POLYGLOT.md). How subs, shells and the
composition root (`@libs/runtime`, the one package that knows every sub)
fit together, and how to add a sub, is
[`README.md`](README.md#repository).

Packages split by vertical slice and then runtime. Reusable client UI uses the component slice layout in the design-system guidance above; other packages keep flat `src/` modules.
The layout, explicit categories, import matrix and test ownership are defined
in [`README.md`](README.md#repository). Follow that layout for both libs and
framework packages. Do not recreate `use-cases/`, `shared/`, `root/`, `public/`
subdirectories outside the component slice convention. Import package modules through `./*` exports.

Package scripts live in `<pkg>/scripts/` (include `./scripts/**/*.ts` in
`tsconfig.tc.json` and the root `tsconfig.json`).
Package type-checking uses `tsconfig.tc.json` (`tsc --noEmit -p
./tsconfig.tc.json`), never a package `tsconfig.json` — that would steal files
from the root project and break cross-package rename (exception:
`apps/client-ts`).

**Layering is enforced by Biome** (`libs/tools-harness-ts/biome-plugins/import-*.grit`,
each probed in `libs/tools-harness-ts/scripts/import-boundaries.test.ts`, plus
`noImportCycles` and `noUndeclaredDependencies`):

- the tier pyramid above;
- runtime categories and flat source layout from the repository briefing;
- `@apps/server-ts` source is isomorphic: platform engines (`pg`, `node:*`) only
  behind injected ports and `@api-wall-ok` modules;
- libs and pkgs never import `@apps/*`.

**Games.** The product is a game framework with pluggable games
([`GAME_FRAMEWORK.md`](libs/games-shared-ts/docs/GAME_FRAMEWORK.md)). A game
supplies only its rules, board, copy, board gesture and known examples
(`defineTurnGame`, `defineGameClient`, a `HarnessGame` with `fixtures`); the
framework owns every shared screen, lifecycle, spec and suite. Follow
[`ADDING_A_GAME.md`](libs/games-shared-ts/docs/ADDING_A_GAME.md). Games never
import each other or a registry; only `"gameRegistry"` packages compose
games, and platform code never spells a game id (`package-boundaries.ts`).
Behaviour every game shares is specified once in `specs/games/` and runs per
game; shared code suites live in `libs/games-harness-ts/tests/conformance/<area>/`.
**Billing providers** each export one `MembershipProviderModule`;
`@pkgs/billing-providers-server-ts` is the single list composition roots iterate —
never name a provider elsewhere (`import-billing-vendor.grit`).
**Runtime client config** (EMQX URL, observability backend) is synced
`@libs/client-config`, not `VITE_*` build env.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->

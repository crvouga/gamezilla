# CI and the gate

Two commands: `bun check` checks the **code** (every task cached; verifies,
never mutates); `bun health` checks the **live deployments** (`dev`;
`bun health:prd` for production). What a test is lives in
[`TESTING.md`](TESTING.md).

## `bun check`

`//#check` depends on every package's `tc`, `lint`, `test`, `test:contract`
and the parts of its `test:spec` (`test:spec:<k>`, below); the root leaves (`//#lint:root`, syncpack, audit, i18n,
agent-commands, goals); `@apps/product#check:offline-shell` (every file the
wall client can load is precached, under budget, from the real `dist/`); each
Worker's `check:worker-bundle` (`wrangler deploy --dry-run` under the upload
limit); `@libs/runtime#check:schema-evolution`; `@libs/tools#check:actionlint`;
and `@libs/tools#check:secrets` (gitleaks over the commits the change adds).
Check and Deploy run that same set. `bun run check:coverage` is a separate
opt-in report.

- **A leaf verifies; it never touches the outside world.** The billing offer
  is validated as a value; reconciling it onto Stripe is `billing:sync`, on
  deploy.
- **The verdict never depends on the machine.** Never branch on `CI` /
  `GITHUB_ACTIONS` to pass, fail or skip (`no-ci-verdict.grit`; reporting-only
  reads are exempted by path in `biome.json`). Adapting resources —
  concurrency, log order, the `SLOW_RUNNER_MULTIPLIER` budget correction — is
  fine. A leaf that cannot run locally (it needs real credentials) is dropped
  by `turbo-ci-run`, named, and the run exits non-zero.
- **Every check is a cached, per-package task.** There is no affected filter.
  A package's tasks hash its whole tracked tree (`$TURBO_DEFAULT$`) and,
  through `tc` → `^src`, the source of every package it depends on. `src`
  is a script-less task hashing a package minus its `*.test.ts(x)`, so a
  test edit reruns only that package, while a source edit reruns every
  dependent.
  `turbo-deploy-graph.test.ts` fails if a task `bun check` reaches is
  `cache: false`, if a package task enumerates its inputs, or if a root task
  forms a cycle.
  - A package check reads only its own package and what it declares. A
    per-file rule is a Biome Grit plugin; a per-package rule goes in
    [`lint-package.ts`](../libs/tools/scripts/lint-package.ts); a fixture
    package is a declared dependency.
  - `lint` is one script for every package: naming, Biome (import
    boundaries included), the Solid oxlint scope, package-boundary rules and
    the package's `GOAL.md` proofs and banned words, run from the repo root.
    Biome runs on a temporary gitignored `.biome-scope.*.json` that excludes
    every package outside the package's dependency closure (whole-repo
    indexing was the cost), and type-aware oxlint on a temporary gitignored
    `<pkg>/jsconfig.json` extending `tsconfig.tc.json`.
  - `tc` is incremental (`.cache/tc.tsbuildinfo`, gitignored).
  - Root `//#` leaves are only for subjects in no package, each with explicit
    inputs. Explicit globs ignore `.gitignore`, so a broad root input uses
    `$TURBO_DEFAULT$` with negations.
  - Nondeterministic inputs become cache keys: `turbo-platform-key.json`
    (`{platform, arch, bun}`, rewritten every run) for `test:contract`, and
    `CHECK_SECRETS_RANGE` (`<merge-base>..<head>`) for `check:secrets`. Env
    that changes a verdict is in the task's turbo `env` (`HARNESS_FIDELITY`,
    fast-check knobs; `HARNESS_MODE` / `HARNESS_WITH_DOM` / `HARNESS_FRAMES`
    on `test:spec:<k>`).
- **Keep the graph narrow.** A package's dependencies are its blast radius:
  prefer small packages, depend on `public/` ports, and never let a shell or
  `pkgs/` package name a feature. A spec suite lives with its feature
  (`libs/<feature>/tests/harness/`, run by that package's `test:spec` through
  `libs/harness/scripts/test-spec.ts`) and composes only the slices it needs
  ([`FEATURE_SUBSYSTEMS.md`](FEATURE_SUBSYSTEMS.md)). The widest suite,
  `@libs/runtime#test:spec`, stays small on purpose.
- **A spec suite runs in parts.** One suite is one process, and on a 2-core
  runner the biggest took ten minutes while every other shard idled. So
  `bun check` never runs `test:spec` (that stays the whole suite, for local
  runs); it runs `test:spec:0` … `test:spec:<specParts - 1>`, each
  `test-spec.ts --part k/n`, which the sharder spreads like any other task.
  The split is weighed from the spec files alone (scenarios, outline rows, a
  fixed weight per Quint model — `libs/harness/scripts/spec-parts.ts`), so
  every part computes the same one. `spec:check` holds a package's scripts
  and turbo inputs to its `specParts`; raise `specParts` when a part grows
  past ~2 min on CI.
- **The report is cached with the verdict.** Each part writes
  `<package>/.cache/harness-report/part-<k>` as its turbo `outputs` (an
  unsplit run writes `all`); `bun run test:report` restores or reruns every
  part and folds them into one `harness-report/index.html`.

## `turbo-ci-run`

[`turbo-ci-run.ts`](../libs/tools/scripts/turbo-ci-run.ts) runs `check`,
`deploy` and `health` (through `secrets-run`), flattening aggregators to leaf
tasks so the root scripts never re-enter turbo.

- **Cache.** Local + remote (`--cache=local:rw,remote:rw`) against
  `https://turborepo.chrisvouga.dev` when `TURBO_TOKEN` is set (a missing
  token fails CI; locally it falls back to `local:rw`). CI keeps no
  `actions/cache`. Framework inference is off, so only declared `env` enters
  a hash. Turbo knobs are code defaults, not Infisical values: secrets-auth
  masks every stored value, and a low-entropy one (`1`, `local`) shreds logs.
- **Plan first** ([`turbo-preflight.ts`](../libs/tools/scripts/turbo-preflight.ts)):
  `turbo run --dry=json` asks both caches about every task; all hits means
  turbo is not run. Otherwise it prefetches the remote hits of the missed
  tasks' `dependsOn` closure in parallel, then runs only the missed task ids
  (never `--only`, which drops dependency hashes).
- **Output.** Grouped logs, `errors-only` (`TURBO_OUTPUT_LOGS=full` to watch
  locally), an in-process heartbeat, and the ten slowest tasks. Code under
  test stays quiet: `crash()` never logs, and sidecars print only when they
  die unexpectedly.
- **Time limits**, all in
  [`check-budget.ts`](../libs/tools/scripts/check-budget.ts):

  | Layer | Limit | Where |
  | --- | --- | --- |
  | `check` run, laptop / CI | 10 / 20 min | `DEFAULT_RUN_DEADLINE_SECONDS` / `CI_RUN_DEADLINE_SECONDS` |
  | `deploy` run | 45 min | `DEPLOY_RUN_DEADLINE_SECONDS` |
  | Check `check` step / job | 25 / 30 min | `timeout-minutes`, `check.yml` |
  | Deploy jobs | 55 min | `timeout-minutes`, `deploy.yml` |
  | One task | 300 s (×2 on CI) | `DEFAULT_TASK_BUDGET_SECONDS` |

  Run deadlines are absolute (never scaled by `SLOW_RUNNER_MULTIPLIER`) and
  sit below their workflow timeouts, so `turbo-ci-run` names the stuck task
  before GitHub cancels silently (`check-budget.test.ts`). Make a task faster
  before raising its number, and put the measurement in the commit body.
  `CHECK_DEADLINE_SECONDS` overrides one run; there is no "off".

**Secrets.** `bun run secrets:pull` caches Infisical `dev` + `prd` in
gitignored `.cache/secrets/`; `secrets-run` prefers it for `SECRETS_ENV=dev`
(warns after 24 h) and bootstraps it once when missing. CI injects secrets via
secrets-auth; `prd` and deploy stay Infisical-first. Run `secrets:pull` then
`bun check` locally and CI reuses the same remote cache entries.

## Workflows

Exactly three, on GitHub-hosted `ubuntu-latest`; never add a fourth.

| Workflow | File | Question |
| --- | --- | --- |
| **Check** | `.github/workflows/check.yml` | Is the code good? (`bun check`, every PR) |
| **Deploy** | `.github/workflows/deploy.yml` | Ship `main` (`bun run deploy`) |
| **Health** | `.github/workflows/health.yml` | Is the deployment good? (`bun health`, hourly) |

1. **Check** runs the `//#check` leaf set with `SECRETS_ENV=dev`, sharded:
   `check:plan` dry-runs the gate, `check:matrix` (no secrets — the runner
   drops outputs holding a masked value) publishes the split from
   [`check-shards.ts`](../libs/tools/scripts/check-shards.ts), balanced by
   `check-task-costs.json`, and up to `MAX_SHARDS` `check:shard` runners run
   their misses. The `check` job — the one required check — is green only when
   the plan and every shard are. Each shard uploads its turbo run summary;
   refresh the costs from a cold run (one that touched `turbo.json`) with
   `bun run libs/tools/scripts/check-shards.ts --harvest <run id>` — costs
   are CI seconds, never a laptop's.
   A new check goes into `//#check` in `turbo.json`, preferably as a test or
   lint rule in its package; never a new job.
2. **Deploy** (`deploy:matrix` reads `libs/infra/tofu/envs/*.tfvars.json`
   through [`workflow-env-matrix.ts`](../libs/infra/scripts/workflow-env-matrix.ts)
   and guards that the commit came from a merged PR) runs one `deploy:<env>`
   job per `protection: "standard"` env in parallel, then — only if all
   pass — each `"production"` env. Each runs `bun run deploy` with
   `SECRETS_ENV=<env>`: `//#check`, then `@apps/server#check:api` and every
   `health` task, which pull `@libs/infra#apply:foundation` → migrate → room
   deploy → API deploy → product deploy → `@libs/infra#apply:edge` → billing
   sync. Uncached deploy steps always rerun.
3. **Health** runs `bun health` hourly as one `health:<env>` job per env
   file and deploys nothing.

**Rehearse deploy before merging** anything touching deploy, infra, secrets,
Workers or `health`: `mise install`, then `bun run deploy:dev` from the PR
branch (the exact graph, against the dev replica). After the deploy steps
pass, `SECRETS_ENV=dev bun run health` re-probes without deploying. Merge
right after both are green: resources a rehearsal adopts are in the env's
state, and until the branch lands `main`'s Deploy would plan to delete them.
The Railway broker builds from `main`, so broker image changes reach dev only
after merge.

**Bun** is pinned to `1.4.2` (`mise.toml`, `packageManager`). 1.3.x does not
resolve `.tsx` through wildcard subpaths and fails on the runner.

## `main` only moves through a merged PR

The bootstrap stack (`libs/infra/tofu/modules/repository`, applied by a
person with `bun run infra:bootstrap`) owns every GitHub setting:

- branch protection on `main`: PR required; no direct pushes, force-pushes or
  deletions, admins included; required checks are `global.tfvars.json`
  `github.required_checks`, strict. `libs/infra/tests/global-file.test.ts`
  requires them to be exactly the gate job of every PR workflow (`check`),
  never `check:plan` or a shard.
- merge commits only (no squash or rebase), branches deleted on merge,
  auto-merge off.

Locally, `libs/tools/githooks/pre-push` refuses pushes to `main`
(`bun run hooks:install`, or `.superset/setup.sh`); `pre-commit` checks spec
ownership and, with `GIT_LINT_PRECOMMIT=1`, runs naming, `lint` and `tc`.
Deploy also refuses a commit with no PR and re-runs the whole gate first.

## Health and critical journeys

Every health check and critical journey is Gherkin
([`SPEC_STANDARDS.md`](SPEC_STANDARDS.md#live-domains)): `specs/health/`
(DNS/TLS, the Workers, Postgres + schema, client config, R2, EMQX, Grafana
Cloud, secrets, billing keys, the Google OAuth client, infrastructure drift)
and `specs/journeys/`. `@apps/product`'s `health` task
(`apps/product/scripts/health.ts`, `cache: false`) runs them through
`liveDomains`: one live world per scenario
(`apps/product/tests/steps/live-world.ts`), step definitions in
`apps/product/tests/steps/*.steps.ts` (`// @io-wall-ok`, secrets as env).
Checks are read-only (self-cleaning round-trips at most), assert *configured
correctly* rather than *up*, and read hosts and names from
`@libs/infra/public/envs`. Secret validation lives here, not in `bun check`.
Standalone `bun health` passes turbo `--only` and deploys nothing. There is
deliberately no `//#health` root task (a bare `health` dependency would
resolve to itself). A new live resource adds a `specs/health/` scenario.

Critical journeys (boot, Google sign-in hand-off, sign in/out, host and end a
space, open a puzzle, save a profile change, people search) are
`specs/journeys/`. Their steps (`libs/runtime/tests/steps/journeys.steps.ts`)
drive `@pkgs/ui-testing` `Driver` gestures over `data-testid`s on a
`JourneyHost`, and run twice: in `bun check` against the full composition,
and in `health` in a real browser (`Bun.WebView`) against the deployed app,
one fresh device per scenario. A live failure saves a screenshot, HTML and
console under `apps/product/.cache/critical-journeys/<scenario>/`. Signed-in
journeys trade `SYNTHETIC_MONITOR_TOKEN` at the hidden
`POST /api/auth/synthetic-monitor/code` for a one-time `/sso-callback?code=`
URL (404 without the secret; it can mint a session for nobody else —
`pkgs/auth-inhouse/src/server/synthetic-monitor.ts`). A new journey passes in
the harness first and cleans up after itself (`JourneyHost.defer`).
Cross-origin behavior (CORS) is proven only live. The API serves liveness at
`GET /api/health` and readiness at `GET /api/health/ready` (`503` when
Postgres fails `SELECT 1` within 3 s).

UI tests in `bun check` run in happy-dom on `@pkgs/ui-testing-solid-dom`;
`@pkgs/ui-testing-bun-webview` implements the same `Driver` for the opt-in
live-browser runs (`HARNESS_MODE=real|stack`). Swapping hosts never rewrites
a suite.

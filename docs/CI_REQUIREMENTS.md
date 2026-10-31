# CI requirements

Capacity plan for pull-request verifications. Every workflow job runs on a standard GitHub-hosted `ubuntu-24.04` runner ([below](#runner-operating-systems)); the sections that size a warm pool are the sizing a faster, dedicated fleet would need and provision nothing. The measured section is generated from [`libs/tools-harness-ts/scripts/verify-task-costs.json`](../libs/tools-harness-ts/scripts/verify-task-costs.json) and the workspace graph. [`libs/tools-harness-ts/scripts/ci-load.test.ts`](../libs/tools-harness-ts/scripts/ci-load.test.ts) fails when that section drifts, or when the corpus no longer fits the runner below.

Refresh after a cold Verify harvest:

```bash
bun run libs/secrets-server-ts/scripts/secrets-run.ts -- bun run libs/tools-harness-ts/scripts/verify-task-costs.ts --harvest <run id>
bun run libs/tools-harness-ts/scripts/ci-load.ts --write
```

To size hardware from real run history, `bun ci:stats` writes `.cache/ci-stats/CI_STATS.md`: the declared workload, the workflow files, and GitHub's run and job history (durations, queue waits, concurrency, agent-hours), as one brief to hand an LLM. Flags: `--days <n>` (default 14), `--budget`, `--goals`, `--have`, `--out`, `--no-github`. It needs a signed-in `gh`.

Commit the cost file and this document together. The budgets live in [`libs/tools-harness-ts/scripts/ci-runner-capacity.ts`](../libs/tools-harness-ts/scripts/ci-runner-capacity.ts). A task that no longer fits is split, or the runner constants change in that same commit with the measurement that justifies them. The five-minute promise stays.

## Promises

Wall clock is from the push to a posted verdict, on a warm runner that is free when the push arrives.

| Change | Verdict |
| --- | --- |
| Any pull request, including a lockfile or a foundational package | under 5 minutes |
| Any graph leaf (nothing else depends on the changed packages) | under 3 minutes |
| Nine out of ten leaves | under 90 seconds |

The proposed pool has six runners: up to three cooperating machines per verification, with capacity reserved for two simultaneous verifications. A small corpus uses fewer machines; the fit calculation chooses the smallest width that meets every deadline. A third concurrent verification waits, and that wait sits outside the promise. A newer push to the same pull request cancels the older run.

Release verification, deploy, health, and the nightly run have their own deadlines. They are not these promises. The nightly run is the `nightly` profile in [`libs/tools-harness-ts/scripts/verify-profile.ts`](../libs/tools-harness-ts/scripts/verify-profile.ts); it never gates a merge.

## What a pull-request verification runs

The affected Verify gate tasks. A cache hit is not scheduled.

A source change reruns that package and every transitive workspace dependent, because those tasks depend on `^src`. A test-only change stays on the package that holds the test: `src` inputs exclude `*.test.ts`. A workspace package that a package uses only from its tests and scripts (a `devDependency` its `src/` never imports) is not an edge of that package's own `src`: the package lists its `src` edges in its `turbo.json` (`libs/tools-harness-ts/scripts/src-task-edges.ts` writes them, `src-task-edges.test.ts` fails on drift). An edit to the helper reruns the package's own `lint`, `tc` and `test`, which `^src` still reaches, and stops there instead of walking up to everything that depends on the package. `mise.toml` and `tsconfig.base.json` (compiler options only) are global dependencies, and `bun.lock` is the audit input, so each of those misses the whole corpus. That full miss is still the five-minute promise. The workspace import aliases are in `tsconfig.paths.json`, which is not a global dependency: 73 of the 75 edits `tsconfig.base.json` took between 2026-09-01 and 2026-10-28 only added or renamed an alias, and each one missed every task. Packages resolve each other through `node_modules` and their `exports`, so `@apps/product-ts#tc` is the only task that lists the file. `lint` lists `biome.shared.json`, not `biome.json`: about three quarters of the entries in the plugins' `includes` lists name one package's directory, so `biome.json` is split into the shared part (rules, plugins, repository-wide scopes) and, per package, a `biome-scope.json` holding the entries that name it (`libs/tools-harness-ts/scripts/biome-scope-slices.ts` writes both after an edit to `biome.json`; `biome-scope-slices.test.ts` fails on drift). Scoping a package under a rule reruns that package's `lint`; a new rule, plugin or repository-wide scope still reruns every package's. A package's `src` also leaves out `tsconfig.tc.json`, `turbo.json` and `biome-scope.json`, which no dependent can see, and its `src` edges are the workspace packages its `src/` (and any other directory its `exports` name) imports, whichever section of `package.json` declares them.

Health, deploy, and `@apps/product-ts#verify:ui-quality` stay on the release path. The population worker's tests run on Bun inside this verification.

## Cache-friendly structure

A pull request is fast when most of its tasks are cache hits, and what makes an edit miss is the structure of the workspace, not the edit. `@libs/tools-harness-ts#ci:cache-hygiene` (in the Verify gate, about a second) keeps four structures from coming back. Its thresholds and every exception are in [`libs/tools-harness-ts/cache-hygiene.json`](../libs/tools-harness-ts/cache-hygiene.json); each failure says what is wrong, what it costs and what to do.

**Blast radius.** The number of packages whose `lint`, `tc` and `test` rerun when one file of a package changes: the package, every package whose `src` hash inherits its `src`, and every package that declares one of those. `bun run cache:explain <package>` prints it, who contributes to it, and which files reach few packages. `cache-hygiene.test.ts` checks the number against Turborepo's own dry run.

| Rule | Fails when | Threshold, and why | What to do |
| --- | --- | --- | --- |
| `hub-new` | a package's blast radius reaches 50 packages and `hubs` does not list it | 50 is 14% of the workspace (the median is 26; a third of the packages are above 50, mostly small foundations like `clock-shared-ts`). Above it one edit misses a seventh of the corpus | Cut an edge that is not needed (a package that only tests with it declares it in `devDependencies`, which takes it out of `src`), or split the package. A deliberate foundation: `bun run cache:sync -- --accept-hubs`, with the reason in the pull request |
| `hub-growth` | a listed hub's blast radius passes the accepted one by more than 10% plus 3 packages | One or two new consumers are normal. A new edge from a package everything depends on turned a leaf into a hub of 258 packages when I tried it | Remove the edge, or accept it as above |
| `hub-size` | a package at 100 or more has over 25 source files, or one at 50 or more has over 60 | The 42 packages at 100 or more have a median of 8 files and four of them exceed 25 (nine packages in all are in `grandfathered.size`, none allowed to grow). The more a hub holds, the more often it changes | Split by purpose; the narrow package is what dependents import |
| `hub-cohesion` | a package at 50 or more with 8 or more files has at least 8 files, and at least 30% of them, that reach at most a fifth of its blast radius (3 packages at the least) | Those files share a hash with the files everyone uses, so each edit to them reruns all of its dependents for nothing. Fourteen packages are grandfathered | Move them to `<domain>-<purpose>-<runtime>-ts` |
| `broad-input` | a task lists a `$TURBO_ROOT$` glob whose package directory is a wildcard (`libs/*/package.json`, `{apps,libs,pkgs}/*/src/**`, `$TURBO_ROOT$/**`) and is not in `broadInputs` | An edit to any matching file anywhere reruns the task. Eleven tasks are allowed, each a repository gate or a test that scans the workspace, with the number of globs and a reason | Name the packages as a brace list and add a test that fails when one is missing (`cache-package-paths.test.ts`) |
| `global-dependency` | `globalDependencies` or `globalEnv` in `turbo.json` holds anything but `tsconfig.base.json`, `mise.toml` and `VERIFY_TIME_LIMITS` | One edit reruns every task. 73 of the 75 edits to `tsconfig.base.json` since 2026-09-01 only added an alias | List the file as an input of the tasks that read it |
| `global-alias` | `tsconfig.base.json` has `compilerOptions.paths` | The aliases changed with every new package. They live in `tsconfig.paths.json` | Put the alias there |
| `derived` | the `src` edges in a `turbo.json`, or `biome.shared.json` or a `biome-scope.json`, do not match what they derive from | They only narrow what an edit reruns while they match | `bun run cache:sync` |

The growth tolerance and the hub threshold are the two numbers to tune. Lowering `hubBlast` makes more foundations list themselves; raising `growth` lets a hub creep. `bun run cache:sync -- --accept-hubs` rewrites `hubs` from the current graph, so a regression shows up as a diff in review, never silently.

**Conventions the rules rest on**

- A package declares a workspace dependency in `devDependencies` when only its tests and scripts use it. The `src` edges are derived from what `src/` (and any other directory `exports` names) imports either way, but a test-only import is still a rerun of the package's own tasks, and the declaration says so.
- Import aliases go in `tsconfig.paths.json`; `tsconfig.base.json` holds compiler options only.
- Scopes for one package go in `biome.json` as before. Run `bun run cache:sync` after editing it: `lint` hashes `biome.shared.json` and the package's own `biome-scope.json`, not `biome.json`.
- A new task input names the packages it reads. A wildcard over all packages belongs in a repository gate, with a line in `broadInputs`.
- A new package starts with no `turbo.json` and no exception. Run `bun run cache:sync` once and `bun run ci:cache-hygiene`; if it fails, fix the structure before asking for an exception.

**Not automated**, because the information is not in the repository: how often a package changes (a hub that never changes costs nothing, and a small one that changes daily costs a lot), which hubs are worth splitting (the file-level ceiling is about 14% of all invalidations, spread over a dozen packages), and whether a file read by path (`readFileSync` of another package's data) belongs in `src`'s inputs. The `lint` input list is covered for the scripts `lint-package.ts` imports (`cache-package-paths.test.ts`); `port/solid-scope.json` and `lingui-scope.ts` are per-package lists that still rerun every package's `lint` when edited.

## Hosted load this replaces

The [repository briefing](../README.md#correctness-machinery) defines the current hosted workflows. Their task timings are the load this plan must accommodate. Verify run 38104005459 (2026-10-11, pull request 176) is a run that actually executed the shards. It failed, so a green shard that finishes its work is at least this long.

The sizing below assumes a 2-core runner (measured on GitHub's `ubuntu-24.04`): 2 cores, about 7 GB, 32 shards, `VERIFY_CONCURRENCY=1`, `VERIFY_TEST_CONCURRENCY=1`, `GOMAXPROCS=1`, `RAYON_NUM_THREADS=1`.

| Stage | What the clock did |
| --- | --- |
| Plan | About 60 s. Setup (mise and `bun install`) was 25 s. Shards waited for the plan. |
| Each shard | About 60 s of checkout and install before tasks. The slowest shard's verification step ran about 16 minutes. |
| Consumers | Waited for the slowest shard, then about 50 s of setup and about 140 s downloading shard artifacts. The consumer verification step itself was instant. |
| Verify | Another setup and another artifact download. |
| Wall clock | 23 minutes, verdict failure. |

Other runs that week sat in the hosted queue for 10 to 30 minutes before a job started. Several posted a green `verify` job while the plan and shard jobs were skipped. That green is an empty status, not a finished corpus.

The structure sets a floor near five minutes before any uncached test runs: a plan job, a per-machine install on every shard, a barrier on the slowest shard, and an artifact fan-in. Adding shards does not remove that floor. The five-minute promise needs warm checkouts and one schedule across the allocated machines below.

## Runner operating systems

Every job requests `runs-on: ubuntu-24.04` (a standard GitHub-hosted Ubuntu image; actionlint validates the built-in label) and runs its `run:` steps in bash. `CI_RUNNER` in `package-hosts.ts` is the one place that names the label, and `workflow-native.test.ts` fails when a job requests another. Runners are ephemeral, so every job starts from an empty VM. That is a security requirement, not only a cost one: the repository is public, so a pull request's code is untrusted and must never run on a machine that keeps files between jobs and later runs a deploy with production secrets (`workflow-native.test.ts` refuses a `self-hosted` label), and setup installs dependencies before any secret is in the environment. On that empty VM, setup installs mise's pinned tools directly and restores bun's download cache from GitHub's cache; the optional mise tool archive is disabled after a stalled restore consumed most of a verification job's deadline. Anything else a job needs comes from the checkout, the remote Turbo cache or the CI artifacts bucket. GitHub's free plan runs 20 jobs at once across every workflow; Verify PR's `VERIFY_MAX_PARALLEL` (default 16) keeps four slots free for other runs' `verify:start` and `verify:end`.

Setup installs everything else from `mise.toml`, Chrome for Testing included (`http:chrome-for-testing`), and never installs the laptop-only coding-agent tools (`MISE_DISABLE_TOOLS`). The Chrome sandbox's AppArmor knob is opened with the hosted image's passwordless `sudo`. The visual-quality model (351 MB, too large for the remote cache) downloads in every job that judges UI quality, because no runner keeps a disk between jobs.

Checks that need another host are not run in CI, and are listed here so a change never brings them back silently:

| Check | Why it cannot run everywhere | Where it runs now |
| --- | --- | --- |
| `@pkgs/clock-shared-swift` (lint, tc, test) | Hosted Linux has no pinned Swift toolchain; macOS uses Xcode's (`native-toolchain.ts`) | `bun verify` on Linux or macOS |
| `@apps/client-swift` (iOS build, launch, smoke test) | Xcode and the iOS simulator exist only on macOS | `bun verify` on a Mac with the pinned Xcode |
| `@pkgs/pubsub-emqx-harness-ts` `emqx.contract.test.ts` | Its launcher is a shell script, and the gate is kept OS-neutral | `bun run test:posix` in the package |
| `@pkgs/dev-owner-server-ts` `dev-owner*.test.ts` | Dev-owner's launch gate is POSIX: `/bin/sh` `kill -STOP`, `ps`, `/proc`, process groups. It is local dev tooling; CI never sets `DEV_OWNER_ROOT` | `bun run test:posix` in the package |
| `@libs/tools-harness-ts` `verify-actionlint`, `workspace-run`, `verify-snapshot`, `verify-prepared-model`, `workflow-remote-tty` tests | Shebang fake executables run directly, the bash `workspace/*.sh` hooks with a POSIX PATH, `cp --reflink`/`cp -c` snapshots, a `Bun.Terminal` pseudo-terminal | `bun run test:posix` in the package |

`test:posix` is the one script outside the gate that `test-scripts.ts` accepts; no CI job and no `bun verify` runs it.

Everything else must behave the same on every runner, so code a CI task runs makes no assumption about the OS it is on:

- **Paths.** A repository path is `/`-separated wherever it is compared, stored, hashed, matched or printed: `slashPath(relative(...))` (`@pkgs/os-shared-ts/slash-path`), never a bare `node:path` `relative()` (`libs/tools-harness-ts/biome-plugins/no-native-relative-path.grit` refuses one), and `lastSegment` rather than `split('/')` for a file name. Windows file APIs accept `/`, so a slash path also opens the file. A file URL becomes a path through `fileURLToPath`, never `.pathname`, and an absolute path is never joined under another directory with its drive letter.
- **Processes and files.** Spawn programs directly or through Bun, not through `sh`; temporary files go under `os.tmpdir()`; a rename onto a file another process may hold is retried, because Windows refuses it: every `renameSync` goes through `renameReplacing` (`@pkgs/fs-server-ts/rename-replacing`, enforced by `no-bare-rename-sync.grit`). A recursive delete is retried the same way: Windows answers `EBUSY`/`EPERM` while a process that only just stopped still holds a file under the tree, and a throw from teardown turns a run whose every scenario passed into exit code 1 (Verify run 40769518282). Every recursive delete goes through `removeTree` (`@pkgs/fs-server-ts/remove-tree`), which waits out the locks for five seconds; `no-bare-recursive-rm.grit` refuses a bare `rmSync`/`rm`/`rmdirSync` with `recursive: true`. It throws when the tree stays locked, except `{ whenLocked: 'leave' }`, which teardown of scratch a run is finished with passes: it reports a `::warning::` and leaves the tree for the next job's checkout clean, because leftover scratch is not a verdict.
- **Tools.** A tool a task needs comes from `mise.toml` (Chrome for Testing included), never from what a runner happens to have installed.
- **Proof.** A pure function that handles paths has a test that feeds it `node:path`'s `win32` form as well as its `posix` form, so a macOS or Linux run catches a separator bug before a Windows runner does.

## Runner

Six proposed warm Linux x64 machines, grouped into two verification allocations of up to three machines each. Linux x64 matches the release runner's platform cache key (operating system, architecture, Bun, Chrome), so a remote cache hit is the same verdict. A macOS result stays a different key.

Each machine:

- At least the cores and memory in the measured section, and the provisioned 32 vCPU and 64 GB. The headroom is the JVM solver (one slot, 2 GB heap) and the chance the unmeasured scripts are slower than the family median.
- A persistent disk holding the git checkout, the `bun install` tree, the mise tools, and the local turbo cache. A pull request is a fetch and a cache lookup.
- Chrome kept installed. The plan fingerprints the renderer, and browser shards must match it.
- The same workload identity the Verify workflow already uses for secrets.

Per-task thread caps stay at one (`GOMAXPROCS`, `RAYON_NUM_THREADS`, lint threads). Allocate the measured spec and other slots on each cooperating machine. Set `VERIFY_TEST_CONCURRENCY=1` so a task admitted into one slot cannot expand into another sixteen workers. Each machine admits at most sixteen spec workers at 2 GB each, reserves 8 GB, and leaves two cores for the solver and OS. `VERIFY_SOLVER_SLOTS` stays 1.

The warm-start budget is 30 seconds. A `bun install` on every job is outside that budget.

## Schedule

One coordinator owns the verification and distributes duration-balanced work across its allocated warm machines. Prerequisites finish before dependent tasks; completed outputs use the existing exact-hash cache. Each worker keeps its checkout and local disk cache warm. The capacity model shares aggregate work across machines while retaining the full duration of every indivisible task and every leaf.

Only cache misses are scheduled. A shard whose tasks are all cache hits is omitted.

Packing stays duration-balanced. The bins are slots on the allocated warm machines. An indivisible task keeps its entire measured duration at every pool width. Split a long task when it breaks the promise; increasing width cannot hide it.

A newer push cancels the previous run for the same pull request.

## Leaves

A leaf has no workspace dependents, so a change there reruns that package's own verification scripts. The warm runner runs those scripts together. The wall clock is the longest of them plus the warm start, not their sum.

The measured section identifies the slowest leaf. Every indivisible leaf task must fit within 135 seconds, leaving the same 30-second warm start and 15-second verdict allowance inside the three-minute promise.

A foundational package such as `@pkgs/property-shared-ts` misses almost the whole corpus, because most packages depend on it. The allocated machines and their per-machine slots must keep that cone inside five minutes. Dependents wait on `src`, so the cone's wall clock stays the longest task in it, and the other tasks fill the remaining slots.

## Outside this verification

- `//#deploy`, the environment apply, migrations, and worker publish
- Health and the `@synthetic` probes
- `@apps/product-ts#verify:ui-quality` and the other nightly suites (Verify Nightly)
- Test reports, traces and coverage: the pull-request verification keeps none (Verify Nightly owns them)
- A laptop `bun verify`, which keeps the 10 minute deadline and admits one verification at a time

## Measured load

The final corpus overlays the passing structured results from Verify run 39476195748 and then Verify run 39479183963, whose code head was `ec9e6e6c5`. Later measurements replace earlier measurements; cache hits retain history. The final run passed every code check, including all 78 shared-game parts and all sixteen matched-game proof phases. Its only failing check used the old committed capacity data, refreshed below.

The longest shared-game part took 213 seconds. Device agreement fell from 267 to 197 seconds with the same invariant and two-step exhaustive bound; the unchanged whole-system proof recorded 119 seconds after duplicate input preparation was removed. The 30-unit part cap retains the fewest-part rule and every scenario and replay; all visual inputs and declared proof phases remain gated.

The generated sizing model totals 17,071 task-seconds, including 9,493 spec-seconds, using the harvested timings, retained history and family estimates. The five-minute, three-minute leaf and ninety-second percentile targets, the 16-worker cap, and each machine's 32 vCPU / 64 GB shape stay fixed. This is a sizing forecast; the hosted run remains the evidence of actual execution. The proposed pool changes no deployed infrastructure.

<!-- ci-load:start -->
Unmeasured scripts follow `estimateTask`: the family median when that family has a sample, otherwise 60 seconds. 574 cost keys name tasks outside the current graph and stay out of the cold total. The unit-test median is one second, the recorder floor. A family with no sample, such as an unmeasured `verify:board-contract`, reserves 60 seconds until a cold Verification is harvested.

| | |
| --- | --- |
| Packages | 361 |
| Verify scripts | 1502 |
| Measured scripts | 934 |
| Estimated scripts | 568 |
| Stale cost keys | 574 |
| Cold CPU | 19513 s |
| Spec parts | 12130 s across 374 tasks |
| Longest task | @libs/games-harness-ts#test:spec:49 213 s |

### Families

| Family | Tasks | CPU |
| --- | --- | --- |
| test:spec | 374 | 12130 s |
| lint | 359 | 1275 s |
| test:contract | 25 | 1004 s |
| verify:models:10 | 16 | 960 s |
| test | 270 | 931 s |
| verify:models | 46 | 748 s |
| verify:models:2 | 11 | 660 s |
| tc | 358 | 542 s |

### Leaves

49 leaves have verification scripts. On the warm runner their tasks run together, so the wall clock is the longest task plus the 30 s warm start.

| | |
| --- | --- |
| Leaf CPU, median | 4 s |
| Leaf CPU, 90th percentile | 103 s |
| Longest leaf task, 90th percentile | 33 s |
| Longest leaf task | 132 s |

| Package | CPU | Longest task |
| --- | --- | --- |
| @apps/product-ts | 1049 s | @apps/product-ts#test 132 s |
| @pkgs/chess-board-root-harness-ts | 192 s | @pkgs/chess-board-root-harness-ts#test:contract 52 s |
| @libs/tools-harness-ts | 123 s | @libs/tools-harness-ts#verify:rebrand 26 s |
| @apps/synthetic-population-worker-ts | 110 s | @apps/synthetic-population-worker-ts#test 79 s |
| @pkgs/matchmaking-root-harness-ts | 106 s | @pkgs/matchmaking-root-harness-ts#test:spec:4 33 s |

### Widest dependency cones

A cone is the package plus every transitive workspace dependent. A source change misses this CPU. The wall clock is the longest task in the cone when the runner has the slots below, because dependents wait on `src`, and `src` is not the long task.

| Package | Packages | CPU | Longest task |
| --- | --- | --- | --- |
| @pkgs/property-shared-ts | 292 | 19292 s | @libs/games-harness-ts#test:spec:49 213 s |
| @pkgs/clock-shared-ts | 257 | 19170 s | @libs/games-harness-ts#test:spec:49 213 s |
| @pkgs/assert-root-shared-ts | 252 | 19137 s | @libs/games-harness-ts#test:spec:49 213 s |

### Runner

Slot allocation target 240 s. Warm start 30 s. Verdict slack 15 s. Spec workers stay at or under 16 per runner.

| | |
| --- | --- |
| Runners per verification | 3 |
| Spec slots per runner | 16 |
| Other slots per runner | 11 |
| Cores required per runner | 29 |
| Memory required per runner | 40 GiB |
| Estimated makespan | 253 s |
| Provision | 6 × 32 vCPU, 64 GB, Linux x64 |
| Fits | yes |
<!-- ci-load:end -->

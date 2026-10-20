# CI requirements

Capacity plan for proposed self-hosted pull-request verifications. The current workflow uses GitHub-hosted shards; this document sizes a warm pool and does not provision infrastructure. The measured section is generated from [`libs/tools/scripts/verify-task-costs.json`](../libs/tools/scripts/verify-task-costs.json) and the workspace graph. [`libs/tools/scripts/ci-load.test.ts`](../libs/tools/scripts/ci-load.test.ts) fails when that section drifts, or when the corpus no longer fits the runner below.

Refresh after a cold Verify harvest:

```bash
bun run libs/tools/scripts/verify-task-costs.ts --harvest <run id>
bun run libs/tools/scripts/ci-load.ts --write
```

Commit the cost file and this document together. The budgets live in [`libs/tools/scripts/ci-runner-capacity.ts`](../libs/tools/scripts/ci-runner-capacity.ts). A task that no longer fits is split, or the runner constants change in that same commit with the measurement that justifies them. The five-minute promise stays.

## Promises

Wall clock is from the push to a posted verdict, on a warm runner that is free when the push arrives.

| Change | Verdict |
| --- | --- |
| Any pull request, including a lockfile or a foundational package | under 5 minutes |
| Any graph leaf (nothing else depends on the changed packages) | under 3 minutes |
| Nine out of ten leaves | under 90 seconds |

The proposed pool has six runners: up to three cooperating machines per verification, with capacity reserved for two simultaneous verifications. A small corpus uses fewer machines; the fit calculation chooses the smallest width that meets every deadline. A third concurrent verification waits, and that wait sits outside the promise. A newer push to the same pull request cancels the older run.

Release verification, deploy, health, and the nightly run have their own deadlines. They are not these promises. The nightly run is the `nightly` profile in [`libs/tools/scripts/verify-profile.ts`](../libs/tools/scripts/verify-profile.ts); it never gates a merge.

## What a pull-request verification runs

The affected Verify gate tasks. A cache hit is not scheduled.

A source change reruns that package and every transitive workspace dependent, because those tasks depend on `^src`. A test-only change stays on the package that holds the test: `src` inputs exclude `*.test.ts`. `mise.toml` and `tsconfig.base.json` are global dependencies, and `bun.lock` is the audit input, so each of those misses the whole corpus. That full miss is still the five-minute promise.

Health, deploy, and `@apps/product#verify:ui-quality` stay on the release path. The population worker's tests run on Bun inside this verification.

## Hosted load this replaces

The [repository briefing](../README.md#correctness-machinery) defines the current hosted workflows. Their task timings are the load this plan must accommodate. Verify run [38104005459](https://github.com/crvouga/gamezilla/actions/runs/38104005459) (2026-10-11, pull request 176) is a run that actually executed the shards. It failed, so a green shard that finishes its work is at least this long.

The runner is GitHub-hosted `ubuntu-24.04`: 2 cores, about 7 GB, 32 shards, `VERIFY_CONCURRENCY=1`, `VERIFY_TEST_CONCURRENCY=1`, `GOMAXPROCS=1`, `RAYON_NUM_THREADS=1`.

| Stage | What the clock did |
| --- | --- |
| Plan | About 60 s. Setup (mise and `bun install`) was 25 s. Shards waited for the plan. |
| Each shard | About 60 s of checkout and install before tasks. The slowest shard's verification step ran about 16 minutes. |
| Consumers | Waited for the slowest shard, then about 50 s of setup and about 140 s downloading shard artifacts. The consumer verification step itself was instant. |
| Verify | Another setup and another artifact download. |
| Wall clock | 23 minutes, verdict failure. |

Other runs that week sat in the hosted queue for 10 to 30 minutes before a job started. Several posted a green `verify` job while the plan and shard jobs were skipped. That green is an empty status, not a finished corpus.

The structure sets a floor near five minutes before any uncached test runs: a plan job, a per-machine install on every shard, a barrier on the slowest shard, and an artifact fan-in. Adding shards does not remove that floor. The five-minute promise needs warm checkouts and one schedule across the allocated machines below.

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

A foundational package such as `@pkgs/property-shared` misses almost the whole corpus, because most packages depend on it. The allocated machines and their per-machine slots must keep that cone inside five minutes. Dependents wait on `src`, so the cone's wall clock stays the longest task in it, and the other tasks fill the remaining slots.

## Outside this verification

- `//#deploy`, the environment apply, migrations, and worker publish
- Health and the `@synthetic` probes
- `@apps/product#verify:ui-quality` and the other nightly suites (Verify Nightly)
- Test reports, traces and coverage: the pull-request verification keeps none (Verify Nightly owns them)
- A laptop `bun verify`, which keeps the 10 minute deadline and admits one verification at a time

## Measured load

The sizing corpus was refreshed from the structured per-task results of [Verify run 39467547837](https://github.com/crvouga/gamezilla/actions/runs/39467547837), whose branch head was `a0561b4fc`. All 41 shared-game parts passed. Using those timings and the existing family estimates, the sizing model totaled 16,877 task-seconds, including 10,467 spec-seconds; a shared-game part took 360 s and the product code-test task took 201 s. These measurements require both a wider proposed pool and smaller indivisible tasks. The shared game suite now has 80 parts and product code tests have three disjoint Bun shards, with the same scenarios, traces and source files.

The five-minute, three-minute leaf and ninety-second percentile targets, the 16-worker cap, and each machine's 32 vCPU / 64 GB shape stay fixed. This is a sizing forecast; the hosted run remains the evidence of actual execution.

<!-- ci-load:start -->
Unmeasured scripts follow `estimateTask`: the family median when that family has a sample, otherwise 60 seconds. 553 cost keys name tasks outside the current graph and stay out of the cold total. The unit-test median is one second, the recorder floor. A family with no sample, such as an unmeasured `verify:board-contract`, reserves 60 seconds until a cold Verification is harvested.

| | |
| --- | --- |
| Packages | 328 |
| Verify scripts | 1242 |
| Measured scripts | 861 |
| Estimated scripts | 381 |
| Stale cost keys | 553 |
| Cold CPU | 17621 s |
| Spec parts | 11091 s across 241 tasks |
| Longest task | @libs/games-harness#test:spec:25 360 s |

### Families

| Family | Tasks | CPU |
| --- | --- | --- |
| test:spec | 241 | 11091 s |
| lint | 327 | 1185 s |
| test:contract | 26 | 1168 s |
| test | 232 | 996 s |
| verify:models:9 | 16 | 960 s |
| verify:models:2 | 11 | 660 s |
| verify:models | 37 | 599 s |
| tc | 327 | 513 s |

### Leaves

47 leaves have verification scripts. On the warm runner their tasks run together, so the wall clock is the longest task plus the 30 s warm start.

| | |
| --- | --- |
| Leaf CPU, median | 4 s |
| Leaf CPU, 90th percentile | 92 s |
| Longest leaf task, 90th percentile | 33 s |
| Longest leaf task | 201 s |

| Package | CPU | Longest task |
| --- | --- | --- |
| @apps/product | 1245 s | @apps/product#test 201 s |
| @pkgs/chess-board-root-harness | 195 s | @pkgs/chess-board-root-harness#test:contract 52 s |
| @pkgs/matchmaking-root-harness | 112 s | @pkgs/matchmaking-root-harness#test:spec:4 33 s |
| @apps/synthetic-population-worker | 103 s | @apps/synthetic-population-worker#test 79 s |
| @libs/synthetic-population-harness | 102 s | @libs/synthetic-population-harness#test:spec:0 59 s |

### Widest dependency cones

A cone is the package plus every transitive workspace dependent. A source change misses this CPU. The wall clock is the longest task in the cone when the runner has the slots below, because dependents wait on `src`, and `src` is not the long task.

| Package | Packages | CPU | Longest task |
| --- | --- | --- | --- |
| @pkgs/property-shared | 264 | 17418 s | @libs/games-harness#test:spec:25 360 s |
| @pkgs/clock-shared | 230 | 17300 s | @libs/games-harness#test:spec:25 360 s |
| @pkgs/assert-root-shared | 225 | 17252 s | @libs/games-harness#test:spec:25 360 s |

### Runner

Slot allocation target 240 s. Warm start 30 s. Verdict slack 15 s. Spec workers stay at or under 16 per runner.

| | |
| --- | --- |
| Runners per verification | 3 |
| Spec slots per runner | 16 |
| Other slots per runner | 10 |
| Cores required per runner | 28 |
| Memory required per runner | 40 GiB |
| Estimated makespan | 360 s |
| Provision | 6 × 32 vCPU, 64 GB, Linux x64 |
| Fits | no |
<!-- ci-load:end -->

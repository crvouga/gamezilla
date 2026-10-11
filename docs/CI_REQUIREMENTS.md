# CI requirements

Capacity contract for self-hosted pull-request checks. The measured section is generated from [`libs/tools/scripts/check-task-costs.json`](../libs/tools/scripts/check-task-costs.json) and the workspace graph. [`libs/tools/scripts/ci-load.test.ts`](../libs/tools/scripts/ci-load.test.ts) fails when that section drifts, or when the corpus no longer fits the runner below.

Refresh after a cold Check harvest:

```bash
bun run libs/tools/scripts/check-task-costs.ts --harvest <run id>
bun run libs/tools/scripts/ci-load.ts --write
```

Commit the cost file and this document together. The budgets live in [`libs/tools/scripts/ci-load.ts`](../libs/tools/scripts/ci-load.ts). A task that no longer fits is split, or the runner constants change in that same commit with the measurement that justifies them. The five-minute promise stays.

## Promises

Wall clock is from the push to a posted verdict, on a warm runner that is free when the push arrives.

| Change | Verdict |
| --- | --- |
| Any pull request, including a lockfile or a foundational package | under 5 minutes |
| Any graph leaf (nothing else depends on the changed packages) | under 3 minutes |
| Nine out of ten leaves | under 90 seconds |

The pool has two runners, so one in-flight check does not spend the other's budget. A third concurrent check waits, and that wait sits outside the promise. A newer push to the same pull request cancels the older run.

Release verification, deploy, and health have their own deadlines. They are not these promises.

## What a pull-request check runs

The affected Check gate tasks. A cache hit is not scheduled.

A source change reruns that package and every transitive workspace dependent, because those tasks depend on `^src`. A test-only change stays on the package that holds the test: `src` inputs exclude `*.test.ts`. `mise.toml` and `tsconfig.base.json` are global dependencies, and `bun.lock` is the audit input, so each of those misses the whole corpus. That full miss is still the five-minute promise.

Health, deploy, the synthetic-population image build, and `@apps/product#check:ui-quality` stay on the release path.

## Hosted load this replaces

`main` runs Check only as the release gate inside Deploy. Pull-request branches that still declare `on: pull_request` run the sharded hosted workflow. That workflow is the load below. Check run [38104005459](https://github.com/crvouga/gamezilla/actions/runs/38104005459) (2026-10-11, pull request 176) is a run that actually executed the shards. It failed, so a green shard that finishes its work is at least this long.

The runner is GitHub-hosted `ubuntu-24.04`: 2 cores, about 7 GB, 32 shards, `CHECK_CONCURRENCY=1`, `CHECK_TEST_CONCURRENCY=1`, `GOMAXPROCS=1`, `RAYON_NUM_THREADS=1`.

| Stage | What the clock did |
| --- | --- |
| Plan | About 60 s. Setup (mise and `bun install`) was 25 s. Shards waited for the plan. |
| Each shard | About 60 s of checkout and install before tasks. The slowest shard's check step ran about 16 minutes. |
| Consumers | Waited for the slowest shard, then about 50 s of setup and about 140 s downloading shard artifacts. The consumer check step itself was instant. |
| Verify | Another setup and another artifact download. |
| Wall clock | 23 minutes, verdict failure. |

Other runs that week sat in the hosted queue for 10 to 30 minutes before a job started. Several posted a green `check` job while the plan and shard jobs were skipped. That green is an empty status, not a finished corpus.

The structure sets a floor near five minutes before any uncached test runs: a plan job, a per-machine install on every shard, a barrier on the slowest shard, and an artifact fan-in. Adding shards does not remove that floor. The five-minute promise needs a warm checkout and one schedule on the machine below.

## Runner

Two warm Linux x64 machines. Linux x64 matches the release runner's platform cache key (operating system, architecture, Bun, Chrome), so a remote cache hit is the same verdict. A macOS result stays a different key.

Each machine:

- At least the cores and memory in the measured section, and the provisioned 32 vCPU and 64 GB. The headroom is the JVM solver (one slot, 2 GB heap) and the chance the unmeasured scripts are slower than the family median.
- A persistent disk holding the git checkout, the `bun install` tree, the mise tools, and the local turbo cache. A pull request is a fetch and a cache lookup.
- Chrome kept installed. The plan fingerprints the renderer, and browser shards must match it.
- The same workload identity the Check workflow already uses for secrets.

Per-task thread caps stay at one (`GOMAXPROCS`, `RAYON_NUM_THREADS`, lint threads). Sixteen spec workers on one machine, each taking every core, would oversubscribe it. Turbo's slot count is the "Other slots" plus "Spec slots" in the measured section. `CHECK_TEST_CONCURRENCY` stays unset, so `specWorkerCeiling` can open up to 16 spec workers (2 GB each, 8 GB reserved, two cores left for the solver and the OS). `CHECK_SOLVER_SLOTS` stays 1.

The warm-start budget is 30 seconds. A `bun install` on every job is outside that budget.

## Schedule

One process on the runner owns the check. Prerequisites, package tasks, and fan-in consumers share the local disk cache. They do not upload artifacts to each other.

Only cache misses are scheduled. A shard whose tasks are all cache hits is omitted.

Packing stays duration-balanced. The bins are slots on this runner. The long pole is a single task: a task longer than the 240 second work budget misses the promise at any width, and the test fails. Split that task.

A newer push cancels the previous run for the same pull request.

## Leaves

A leaf has no workspace dependents, so a change there reruns that package's own check scripts. The warm runner runs those scripts together. The wall clock is the longest of them plus the warm start, not their sum.

The slow leaf is the product contract test, on the order of a minute and a half. That is why every leaf is promised in under three minutes, and why ninety seconds is the promise for nine out of ten leaves rather than for the product app.

A foundational package such as `@pkgs/property-shared` misses almost the whole corpus, because most packages depend on it. The slots in the measured section keep that cone inside five minutes. Dependents wait on `src`, so the cone's wall clock stays the longest task in it, and the other tasks fill the remaining slots.

## Outside this check

- `//#deploy`, the environment apply, migrations, and worker publish
- Health and the `@synthetic` probes
- The synthetic-population image build
- `@apps/product#check:ui-quality`
- A laptop `bun check`, which keeps the 10 minute deadline and admits one check at a time

## Measured load

<!-- ci-load:start -->
Unmeasured scripts follow `estimateTask`: the family median when that family has a sample, otherwise 60 seconds. 536 cost keys name tasks outside the current graph and stay out of the cold total. The unit-test median is one second, the recorder floor. A family with no sample, such as an unmeasured `check:board-contract`, reserves 60 seconds until a cold Check is harvested.

| | |
| --- | --- |
| Packages | 316 |
| Check scripts | 1108 |
| Measured scripts | 191 |
| Estimated scripts | 917 |
| Stale cost keys | 536 |
| Cold CPU | 5296 s |
| Spec parts | 3632 s across 215 tasks |
| Longest task | @apps/product#test:contract 86 s |

### Families

| Family | Tasks | CPU |
| --- | --- | --- |
| test:spec | 215 | 3632 s |
| lint | 315 | 340 s |
| tc | 315 | 329 s |
| test | 218 | 265 s |
| check:board-contract | 4 | 240 s |
| check:models | 12 | 192 s |
| test:contract | 10 | 95 s |
| check:synthetic-population | 1 | 60 s |

### Leaves

48 leaves have check scripts. On the warm runner their tasks run together, so the wall clock is the longest task plus the 30 s warm start.

| | |
| --- | --- |
| Leaf CPU, median | 3 s |
| Leaf CPU, 90th percentile | 45 s |
| Longest leaf task, 90th percentile | 17 s |
| Longest leaf task | 86 s |

| Package | CPU | Longest task |
| --- | --- | --- |
| @pkgs/chess-board-root-harness | 156 s | @pkgs/chess-board-root-harness#test:spec:0 17 s |
| @apps/product | 149 s | @apps/product#test:contract 86 s |
| @pkgs/matchmaking-root-harness | 138 s | @pkgs/matchmaking-root-harness#test:spec:1 17 s |
| @apps/synthetic-population-worker | 123 s | @apps/synthetic-population-worker#check:synthetic-population 60 s |
| @libs/tools | 88 s | @libs/tools#ci:statecharts 60 s |

### Widest dependency cones

A cone is the package plus every transitive workspace dependent. A source change misses this CPU. The wall clock is the longest task in the cone when the runner has the slots below, because dependents wait on `src`, and `src` is not the long task.

| Package | Packages | CPU | Longest task |
| --- | --- | --- | --- |
| @pkgs/property-shared | 222 | 5051 s | @apps/product#test:contract 86 s |
| @pkgs/clock-shared | 220 | 5042 s | @apps/product#test:contract 86 s |
| @pkgs/assert-root-shared | 215 | 5024 s | @apps/product#test:contract 86 s |

### Runner

Work budget 240 s. Warm start 30 s. Verdict slack 15 s. Spec workers stay at or under 16.

| | |
| --- | --- |
| Spec slots | 16 |
| Other slots | 7 |
| Cores required | 25 |
| Memory required | 40 GiB |
| Estimated makespan | 238 s |
| Provision | 2 × 32 vCPU, 64 GB, Linux x64 |
| Fits | yes |
<!-- ci-load:end -->

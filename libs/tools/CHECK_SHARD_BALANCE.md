# Check shard balance

The supplied Depot attempt `6z4v9tdhbv` (workflow `ht6n53nczf`, job
`dlnxhpdslv`) stopped at the 1,200-second shard deadline. Its log confirms
647 identities, shard 0 at 168 tasks / 3,111 task-seconds and the other shards
at 79–80 task-seconds. CPU and memory capacity were not the scheduling defect.

The old planner already used longest-processing-time assignment. Its union-find
joined **every real dependency edge**, including the 158 independent spec parts
feeding `prepare:ui-quality`. Shared builds, the spec parts and the final visual
consumer became one connected component. The largest component went first to
shard 0. The 1 HTTP 200 / 167 HTTP 404 observations covered that shard's owners,
not all 647 discovered tasks.

The same 647-task graph and committed historical costs reproduce the old plan
exactly. Separating producer and consumer stages while retaining the old
five-second fallback gives **267 task-seconds on every check shard**. The new
family medians and 60-second fallback give this conservative cold plan:

| Check shard | Before tasks | Before task-seconds | After tasks | After task-seconds |
| --- | ---: | ---: | ---: | ---: |
| 0 | 168 | 3111 | 38 | 270 |
| 1 | 30 | 80 | 39 | 269 |
| 2 | 31 | 80 | 39 | 270 |
| 3 | 31 | 80 | 40 | 270 |
| 4 | 31 | 80 | 40 | 270 |
| 5 | 32 | 80 | 40 | 270 |
| 6 | 33 | 80 | 40 | 270 |
| 7 | 33 | 80 | 40 | 270 |
| 8 | 33 | 80 | 40 | 270 |
| 9 | 33 | 80 | 40 | 270 |
| 10 | 32 | 79 | 41 | 270 |
| 11 | 32 | 79 | 41 | 270 |
| 12 | 32 | 79 | 41 | 270 |
| 13 | 32 | 79 | 41 | 270 |
| 14 | 32 | 79 | 40 | 269 |
| 15 | 32 | 79 | 41 | 270 |

There are also four prerequisite builds (26 task-seconds) and two final consumers
(120 task-seconds). Total task coverage remains 647. The check-shard max/min is
1.00372; max/average is 1.00046, reducing the former 1056.2% imbalance to 0.05%.
Normal plans count cached verdicts as zero execution work and distribute them
on equal-load ties instead of putting all zero-weight tasks in one bin.

With 12 execution slots per job, the build dependency path is estimated at
17 seconds, the parallel check phase at 86 seconds (the product contract), and
the final consumer chain at 120 seconds: **223 seconds of task execution on the
critical path**. Serial execution within each owner gives a conservative
26 + 270 + 120 = **416 seconds**. These are planning estimates, not measured
Depot latency. They exclude queueing, checkout, tool installation, secret loading,
cache transfer/restoration and publication. Both final UI tasks lack historical
samples and currently use 60-second fallbacks; harvest a successful run before
using these numbers as a performance promise. The observed old wall time was
at least 1,200 seconds, but duration estimates alone cannot explain its entire
runtime. Per-task progress and timeouts now expose the remaining bottleneck.

One immutable plan is exported by `check:plan`, which also builds shared
prerequisites. Matrix jobs start only after it succeeds. `check:consumers` starts
only after every shard succeeds. Turbo retains the original dependency graph:
there is no `--only`, graph rewriting, relaxed verdict or duplicate rules engine.
Exact prerequisite cache archives are transferred as CI artifacts as well as
uploaded remotely. Shards download shared build artifacts only when their task
closure needs them. Cached producers transfer artifact bytes without executing
or restoring their outputs unnecessarily. Consumers restore declared outputs
through Turbo. Missing prerequisite artifacts and changed hashes fail before
execution; run summaries reject unexpected non-owned execution.

Build input globs previously included the literal
`node_modules/.vite/deps/_metadata.json`, containing generated optimizer
metadata and absolute paths. `!node_modules/**` removes this volatile input;
source files, declared environment, lockfile and upstream hashes stay intact.
The three file-producing builds declare `dist/**`; `@apps/server#build` is an
intentional no-op with no files. Secret-scan ranges, advisory audit snapshots,
public Vite build configuration and platform/browser fingerprints retain their
correctness scope. Platform/Bun versions are checked on every runner; installed
native renderers must match the planned fingerprint. Cache misses record exact
hashes and observed reasons in `planning.json`, including absent artifacts,
HTTP failures and lookup timeouts. A 404 is not proof of a hashing defect: compare
prior keys/inputs, successful uploads and retention.

Every executing task prints a start line. Successful artifact creation reports
completion while Turbo is still running; the final summary reports exact elapsed
time, exit code and cache status. A 30-second heartbeat names active tasks and
elapsed time. A one-second watchdog enforces the existing per-task budgets and
kills the process tree on timeout; the existing whole-run deadline remains.
Cold runs evict only assigned local cache keys and disable remote reads for
execution, retaining completed cross-stage prerequisites and remote writes.

The tradeoff is two scheduling barriers and artifact transfer in return for
parallelizing the 158 screenshot producers instead of binding them to one
machine. Final fan-in consumers share one job; genuine remaining dependency
chains remain indivisible. Imbalance checks warn at max/min > 1.25, max/average
> 1.20 and concentrated unknown counts (with integer-count rounding allowance).
A single oversized task or necessary chain still needs its own task-level split.
Chrome remains pinned at `154.0.8037.92`; Chrome/Mesa setup is conditional on
native browser work rather than repeated on every shard. Existing system package
installation is retained: this change introduces no mutable image or dependency
cache. Nested Rayon, lint, Go and solver limits remain unchanged because the
repository already pins a solver-contention regression. More threads require
measurements after correcting ownership, rather than masking that defect.

All changed files and their purposes:

| File (relative to repository root) | Change |
| --- | --- |
| `.depot/workflows/check.yml` | One plan/build job, parallel owners, final consumers, required stage verdicts and artifact transfer. |
| `.depot/actions/setup/action.yml` | Reuse the renderer action without repeating tool/dependency setup. |
| `.depot/actions/visual-renderer/action.yml` | Extract the existing fixed Chrome installation for conditional use. |
| `turbo.json` | Exclude generated dependency install trees from build hashes. |
| `libs/tools/scripts/check-plan.ts` | Look up the whole graph once, estimate costs, serialize context and print loads/miss diagnostics. |
| `libs/tools/scripts/check-shards.ts` | Version 2 staged ownership, cache-aware LPT, stable ties and imbalance warnings. |
| `libs/tools/scripts/check-stages.ts` | Separate builds/shared source producers and downstream fan-in consumers. |
| `libs/tools/scripts/check-task-estimates.ts` | Exact history, task-family medians, fallback weights and top-five summary. |
| `libs/tools/scripts/check-task-costs.ts` | Reject failed, zero, negative and invalid duration samples during harvesting. |
| `libs/tools/scripts/check-stage-cache.ts` | Compute dependency closure, prefetch and publish exact required artifacts. |
| `libs/tools/scripts/check-stage-transfer.ts` | Restore the immutable plan and prior-stage artifacts. |
| `libs/tools/scripts/check-browser-tasks.ts` | Identify uncached native browser tasks before installing Chrome. |
| `libs/tools/scripts/check-shard-run.ts` | Preserve context, enforce prerequisite verdicts and transfer consumer inputs. |
| `libs/tools/scripts/check-shard-process.ts` | Verify hashes/cache before running, enforce live budgets and whole-tree deadlines. |
| `libs/tools/scripts/check-shard-stream.ts` | Task starts/completions, elapsed time, bounded failure logs and heartbeat/watchdog state. |
| `libs/tools/scripts/turbo-preflight.ts` | Associate remote HTTP statuses and lookup failures with exact hashes. |
| `libs/tools/scripts/check-cache-diagnostics.ts` | Sanitized, actionable cache-miss reasons. |
| `libs/tools/scripts/check-shards.test.ts` | Skew, unknowns, dependencies, cache hits, deterministic ownership, progress and timeout coverage. |
| `libs/tools/scripts/check-cache-keys.test.ts` | Isolated installed-Turbo hash tests across paths/environment and volatile Vite metadata. |
| `libs/tools/scripts/check-task-costs.test.ts` | Failed/killed/invalid telemetry protection. |
| `libs/tools/scripts/check-plan-transfer.test.ts` | Transport the current staged plan format. |
| `libs/tools/scripts/check-workflow-cancel.test.ts` | Required producer/check/consumer verdicts and cancellation behavior. |
| `libs/tools/scripts/ui-quality-graph.test.ts` | Native model setup follows distributed producers; renderer setup remains explicit. |
| `libs/tools/goal/known-bugs.json` | Register shard-collapse, volatile-input and failed-duration regressions. |
| `libs/tools/CHECK_BENCHMARK.md` | Update staging, fallback and evidence guidance. |
| `libs/tools/CHECK_SHARD_BALANCE.md` | Reproduction, before/after plan, estimates, file inventory and tradeoffs. |

Automated validation: 452 tooling tests and 31 focused tests pass. Tooling type
checking, Biome lint, actionlint and naming checks pass. Full `bun check:local`
remains blocked by local disk exhaustion: Postgres reported SQLSTATE 53100 and
Turbo could not write summaries/logs. Runs after removing only investigation temporary files, with four and then
two local execution slots, also exhausted the disk.
No checks were skipped or budgets raised. The updated Depot workflow has not
been dispatched, so actual runtime and warm-cache overhead remain unmeasured.
This is not a green release verdict.

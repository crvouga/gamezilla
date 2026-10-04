# Check latency benchmark

## Result and measurement boundaries

Default: **16 shards, depot-ubuntu-24.04-64, Turbo concurrency 12**.
The **under-60-second cold target is not achieved**. The longest indivisible
model check alone takes approximately 87–96 seconds on the faster runner.
All 633 current checks remain required, including all original 555 and 78
additional specification slices.

Times are exact Depot run creation → required gate completion, including queue,
checkout, setup, execution, cache uploads and small evidence transfers. Optional
publication is excluded. CLI observation adds submission and up to two seconds
of polling delay, and is recorded separately. Each completed comparison row has
three cold/warm pairs against one frozen source fingerprint. With three samples,
nearest-rank p95 is the maximum observed sample, not a population-tail claim.
Comparison batches ran concurrently; queue interference is retained. Allocated
core-hours include Check jobs and publication, not unallocated queue time.
Cold means no Turbo-cache reads; tool caches and frozen installation remain.
Warm rows resolved **633/633 tasks from valid cache**; cold rows had zero hits.

## Supplied baseline

Workflow `8nq3l7gkbf`, run `3fd9gb8xhv`, job `f32zqgwgls`, attempt
`8zdp3vll5k`: **897.266 seconds** from native creation to required job completion.
The 16-vCPU runner used Turbo 12 (CPU average 87%, peak 97%; memory 19%, peak 30%).

| Component | Measured seconds |
| --- | --- |
| Wrapper total | 844.4 |
| Discovery/cache planning | 3.7 |
| Report preparation | 1.1 |
| Cache prefetch | 0.6 |
| Turbo phase, including overlapping inline publication | 823.2 |
| Final inline report closure | 15.7 |
| Checkout | approximately 1.7 |
| Frozen Bun install | approximately 1.4 |
| Actual mise install | 0.006 |
| Separate 703 MB tool-cache restore | approximately 3–4 |

Phases are rounded; publication overlapped execution, so 823.2 s is not a pure
execution measurement. The original graph has 555 executable tasks: 121 hits
(54 prevalidated, 67 Turbo), 434 executions, and two failures. The longest task
was `@apps/product#test:contract`, **329.823 s**; the longest dependency chain,
`@apps/product#tc → test:contract`, was **334.292 s**. Product tests took 169.970 s;
the longest chess slice took 122.015 s. The PR changed 684 files across 13 spec
domains, explaining much of the legitimate invalidation and 21.8% hit rate.
Authentication failure did not explain the misses.

Native timestamps, Turbo summary/graph and per-task durations are retained in
`.cache/check-optimization/baseline-*` and `reference-graph.json`. The exact
original graph was reconstructed from its reference source.

## Shard and runner comparison: one shared planning job

| Shards | vCPU | Turbo | Cold median / p95, s | Warm median / p95, s | Slowest median, s | Cold shard queue median, s | Total cold core-hours | Cold passes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 8 | 16 | 16 | 181.678 / 181.951 | 42.629 / 82.426 | 141.068 | 5.804 | 4.35 | 3/3 |
| 8 | 64 | 16 | 141.316 / 142.224 | 50.521 / 51.989 | 94.440 | 8.678 | 9.93 | 3/3 |
| 12 | 16 | 16 | 183.636 / 183.835 | 42.626 / 47.634 | 137.437 | 6.897 | 5.11 | 3/3 |
| 12 | 64 | 16 | 133.564 / 153.334 | 57.296 / 57.958 | 90.893 | 7.644 | 13.03 | 2/3 |
| 16 | 16 | 12 | 172.700 / 184.211 | 44.346 / 48.694 | 133.296 | 5.944 | 5.69 | 2/3 |
| 16 | 16 | 16 | 173.297 / 183.800 | 42.711 / 52.082 | 128.249 | 7.097 | 5.60 | 3/3 |
| 16 | 16 | 20 | 173.204 / 174.002 | 45.512 / 48.076 | 126.694 | 7.124 | 5.68 | 3/3 |
| 16 | 16 | 24 | 173.135 / 190.830 | 51.324 / 64.821 | 125.939 | 7.511 | 5.57 | 3/3 |
| 16 | 32 | 16 | 142.814 / 153.302 | 47.009 / 48.645 | 99.517 | 7.877 | 8.77 | 3/3 |
| 16 | 64 | 16 | 138.654 / 141.474 | 44.802 / 70.442 | 91.529 | 8.471 | 15.65 | 3/3 |
| 24 | 16 | 16 | 154.193 / 155.132 | 45.423 / 46.196 | 109.513 | 8.186 | 6.73 | 3/3 |
| 24 | 64 | 16 | 132.857 / 133.378 | 53.288 / 103.345 | 87.847 | 9.242 | 21.73 | 3/3 |
| 32 | 16 | 16 | 156.403 / 157.626 | 46.719 / 51.438 | 114.792 | 9.829 | 8.18 | 3/3 |
| 32 | 64 | 16 | 138.603 / 143.773 | 54.117 / 64.821 | 88.181 | 10.003 | 28.37 | 3/3 |

Two samples remained red: `zj9gzlt8r4` (16-vCPU/Turbo 12, whole-system exceeded
its existing 120-second deadline) and `b4cx3qcgv1` (12 shards/64 vCPU, access-sync
exited after only a JVM notice). Their latency stays in the table. Neither was
counted as a reliable release configuration or retried. The checker adapter now
retains exit signals and failed public model evidence; the original process
failure could not be diagnosed from the old adapter's output.

At 64 vCPU, 24 shared-plan shards had the best reliable cold median/p95,
132.857 / 133.378 s. Increasing to 32 did not help: one model check dominated
while queue/startup costs grew.

## Planning, worker pools and concurrency

Independent planning removes the serial planner bootstrap and second scheduling
wave. Every shard computes the same deterministic LPT owners; only its owned
hashes are queried. One compressed plan travels with shard zero's evidence to
publication. Rediscovery after a missing artifact happens only off the gate.

| Independent planning experiment | Cold median / p95, s | Warm median / p95, s | Samples per mode |
| --- | --- | --- | --- |
| 16 shards, 4 JVM CPUs | 123.156 / 123.568 | 51.797 / 52.305 | 3 |
| 16 shards, 8 JVM CPUs | 123.213 / 123.309 | 36.042 / 38.402 | 3 |
| 16 shards, 8 GiB heap, 4 JVM CPUs | 120.051 / 123.051 | 35.647 / 42.443 | 3 |
| 24 shards, 4 JVM CPUs | 122.942 / 127.840 | 36.282 / 52.834 | 3 |

The next version restricted cache lookups to approximately 39 owned hashes per
shard and compared every requested Turbo concurrency on the selected runner:

| Shards | vCPU | Turbo | Cold median / p95, s | Warm median / p95, s | Slowest median, s | Cold shard queue median, s | Total cold core-hours | Cold passes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 16 | 64 | 12 | 121.861 / 123.015 | 34.686 / 60.129 | 87.759 | 12.083 | 15.91 | 3/3 |
| 16 | 64 | 16 | 120.523 / 126.661 | 34.929 / 46.496 | 89.520 | 10.017 | 16.03 | 3/3 |
| 16 | 64 | 20 | 151.311 / 153.670 | 29.490 / 46.776 | 88.040 | 13.288 | 16.09 | 3/3 |
| 16 | 64 | 24 | 121.069 / 123.342 | 37.385 / 59.691 | 89.550 | 11.151 | 15.95 | 3/3 |

Turbo 12 had the lowest cold p95 (123.015 s) and shortest median critical shard
(87.759 s). Turbo 16's cold median was 1.338 s lower, with p95 3.646 s higher.
Warm all-hit shards do not invoke Turbo, so their concurrency differences are
scheduling/setup noise. Defaults follow cold p95; final repetition is below.

Three 633-object HEAD probes per setting all returned HTTP 200: median 2258 ms
at 64 workers, 1219 ms at 128, 973 ms at 256, and 978 ms at 512. The planner
uses 256 as a ceiling, with only the shard's own requests.

A Bun-only warm setup followed by a second mise cache action for partial misses
was rejected: run `1jzx5994v8` stalled five shards at its second restore, before
checks. Final shards use **one full cached toolchain restore**. Node runtime,
solver-thread, and alternative encoding experiments did not improve valid proof.

## Final implementation

- Classic longest-processing-time-first packing uses measured task seconds,
  task-ID code-point ties, then the lowest-index bin. Genuine build producers
  stay with consumers; source-only nodes preserve invalidation without a type
  check barrier. Planned and actual imbalance over 10% is flagged. Indivisible
  model/chess leaves explain remaining wall-time imbalance.
- Shards reject omitted, duplicated or unknown IDs, changed hashes, failed
  verdicts and unexpected executable dependencies. `fail-fast: false` preserves
  independent failures. Only `check` is required; it requires the entire matrix.
  Native matrix jobs retain individual cancellation/retry addresses.
- Remote authentication failures are fatal. Failed tasks never create successful
  entries. Cold mode writes outputs without deleting caches. Relevant source,
  dependency, configuration, environment and platform changes remain hashed;
  credentials, run IDs, performance controls and report artifacts do not.
- Current registry evidence is fetched before the pure cached advisory gate;
  fetch time is excluded and object key order normalized. Existing severity
  policy and three exemptions remain. Advisory changes invalidate that gate alone.
- Type-check outputs include the incremental record. Model outputs include
  evidence, symbolic bounds, counterexamples and TLC diagnostics; private checker
  data/linked tools are excluded, fixing observed HTTP 413 uploads. Configuration
  readers explicitly hash the external workflow/manifest/spec files they inspect.
  Timing telemetry is excluded from source/type/test hashes, while its JSON
  formatting remains required; changing estimates never discards semantic caches.
- Nested pools use Rayon 1, lint 1, GOMAXPROCS 1, model verification 4, four JVM
  active processors, Parallel GC, 8 GiB maximum/2 GiB initial heap. Independent
  compiler obligations run asynchronously. Equivalent cached LET bindings retain
  all existing models, clients, bounds, seeds and transitions.
- Raw successful reports are task outputs. Small evidence artifacts hold verdicts,
  one compressed plan, and failed public reports. Packaging/upload failure cannot
  change a validated check verdict. Separate publication runs after failures,
  restores missing raw outputs, deduplicates hashes and publishes one bounded
  parallel batch. Empty reports are not published; the required gate never waits.
- Checkout preserves history needed by security checks; frozen installation remains.
  A dependency-tree cache was rejected because regeneration is faster. Artifact
  diagnostics remove whole signed URLs, including credentials encoded in paths.
  Retained verdict manifests contain no environment values.

## Final-source measurements and validation

| Pair | Cold run | Cold seconds | Warm run | Warm seconds | Hits, cold / warm |
| --- | --- | --- | --- | --- | --- |
| 1 | `vk7gp8s4vb` | 123.863 | `2z0tbj4753` | 58.718 | 0 / 633 |
| 2 | `75cf04cmln` | 113.131 | `g0767z0pzx` | 32.136 | 0 / 633 |
| 3 | `lvs68ld73t` | 121.535 | `hlqhltfhkm` | 33.670 | 0 / 633 |

Cold median / observed p95: **121.535 / 123.863 s**.
Warm median / observed p95: **33.670 / 58.718 s**.
All six gates passed on fingerprint `22eff046c5033a3945904baa3e48215153d30cd6aeab7938d9bdbbc7a3ce0ffd`.
Median total allocated compute including publication: 16.318 cold
and 4.345 warm core-hours; speed takes priority over cost.
Cold slowest shard median / p95: 88.680 / 96.676 s.

Representative final pair (`lvs68ld73t` / `hlqhltfhkm`), shard zero:

| Component | Cold seconds | Warm seconds |
| --- | --- | --- |
| Checkout | 1.764 | 1.747 |
| Patch transfer | 0.167 | 0.187 |
| mise action, chiefly tool-cache restore | 3.088 | 3.307 |
| Frozen Bun install | 1.930 | 1.860 |
| Install completion → secrets injected | 0.485 | 0.474 |
| Current advisory snapshot | 0.573 | 0.143 |
| Turbo discovery | 0.795 | 0.788 |
| Cache planning / HEAD lookup | 0.076 | 0.511 |
| Producer-output prefetch | <0.001 | <0.001 |
| Required execution / cached-verdict validation | 88.675 | 0.002 |
| Evidence artifact transfer | 0.223 | 0.240 |
| Gate scheduling after matrix completion | 7.523 | 1.913 |
| Optional publication job, including its setup | 101.737 | 97.860 |

Shard scheduling median / observed p95 was 9.074 / 13.781 s cold and
11.504 / 15.495 s warm. These distributed phases overlap; do not sum them
into the workflow wall time. No separate planning job remains. Secret injection
is bounded by adjacent timestamps, rather than an instrumented internal timer.
Actual cold shard skew was 109.5% above the mean and emitted the required warning;
estimated task-work bins span only 264–265 s. LPT balances summed work, while
one unsplittable task determines elapsed time. Warm measured execution was 2 ms
per shard; its tail is queue/setup rather than task execution.

Automated real-Turbo tests prove output restoration, identical second-run hits,
source/dependent and relevant-environment invalidation, token/run-ID neutrality,
forced cold execution, private-output exclusion, and absent failed cache writes.
Property/configuration checks prove deterministic ownership for up to 600 inputs
and 64 bins, dependency grouping and every supported matrix count.

Native cold `lvs68ld73t` and consecutive warm `hlqhltfhkm` artifacts contain
633 distinct passing results with identical hashes: 0 and 633 hits respectively.
All original 555 IDs are present, with no duplicate or omitted owner. Native
source probe `spvrz6rq13` changed `pkgs/glicko2-shared/src/glicko2.ts`: exactly the 77
expected source/dependent checks executed, with the other 556 valid cache hits.
The source was restored byte-for-byte after patch upload. A separate timing-file
probe invalidated only `@libs/tools#lint`, preserving the other 632 hashes.
Fresh advisory-content invalidation changed only `//#ci:audit`.

Real failed run `b4cx3qcgv1` propagated a model child exit 1 to its shard and
required gate while independent shards completed and publication still ran.
The final native fault injection `xdl79kb195` deliberately supplied the literal
artifact name `invalid/name`: upload exited 1, all 16 required shards and the
gate still passed, and publication completed with the missing evidence reported.
The real process adapter regression pins JVM-notice-only SIGTERM and verifies
that exit/signal diagnostics survive. Cancellation guards and the canceled
prototype `fjpphmcz30` preserve native shard status; canceled work is excluded
from successful measurements. No failed sample was counted as a cache success.

Credential scan of 2,842 retained text files, native logs/artifact manifests and
the working diff found none of the 23 available configured secret values and
no signed URLs. Sentinel tests also verify private cache-output exclusion and
encoded-URL redaction. Verdict artifacts deliberately contain no environment
values; ephemeral runner credentials are never serialized. Actual available
credential values were checked locally; that is not a claim to possess every
ephemeral runner credential.

Local tooling, harness, product and Quint type/lint checks passed; tooling has
409 passing tests and harness 44. Native full-patch Check runs validate every
required task automatically. `bun check` invokes git-sync and would commit the
existing unfinished merge (`MERGE_HEAD` 59cbccb32ed5a58eb7054eb72d69974036db10db),
so it was not used to complete that human-managed merge. Native patch evidence
attests to its frozen input fingerprint, rather than a newly pushed commit.

## Remaining critical path

| Current task / chain | Measured seconds | Next optimization |
| --- | --- | --- |
| `@apps/product#test:contract` | 88.092 | Upstream typed-IR/compiler reuse; preserve all proofs |
| `@libs/chess#test:spec:29` | 51.879 | Profile harness/SQL evaluation with identical scenarios |
| `@libs/friends#test:spec:47` | 39.124 | Profile harness/SQL evaluation with identical scenarios |
| Longest executable dependency chain | 88.092 | Same product contract leaf; prior type-check barrier removed |

The representative configuration's hard execution lower bound is **88.092 s**
before setup and queue; the three cold critical-shard totals were 96.676,
87.082 and 88.680 s. This is a measured bound for the current implementation,
not a claim that every possible future compiler optimization has been exhausted.

The next substantial reduction requires speeding up whole-system compilation:
one captured log recorded Snowcat checking 72.334 s, then symbolic solving
19.456 s. Reuse typed intermediate representations or improve the upstream
compiler while retaining every invariant and bound; this repository never
patches dependencies. Dropping type checking or reducing proof coverage is not
an acceptable fix. Additional job shards cannot shorten one checker invocation.

Next profile the longest chess/friends scenario and reduce harness/SQL evaluation
cost with unchanged examples. Scheduling/startup tail needs faster Depot job
admission; more shards add arrivals without shortening the dominant leaf.
Warm latency is bounded by scheduling, checkout, cached tools, frozen installation,
secret injection, HEAD lookup and minimal evidence transfer.

## Controls and evidence

Set `CHECK_SHARDS` (8, 12, 16, 24, 32), `CHECK_CONCURRENCY`, `CHECK_RUNNER`, or
workflow-dispatch inputs. No Check-variable overrides exist. To add a count,
change dispatch options and its matrix preset together; automated checks verify
exact ownership. The plan is computed once. Shared builds run in `check:plan`,
parallel checks consume their exact Turbo artifacts, and `check:consumers`
aggregates screenshots after every producer passes. Durations live in
`check-task-costs.json`; unmeasured tasks use their task-family median or a
60-second fallback. Cached verdicts carry zero execution weight. The pinned
Chrome/Mesa setup runs only in planning and native-browser jobs. See
[`CHECK_SHARD_BALANCE.md`](CHECK_SHARD_BALANCE.md) for the reproduction,
load comparison, critical-path estimate and tradeoffs.

```sh
bun run libs/tools/scripts/check-task-costs.ts --harvest <native-run-id>
bun run libs/tools/scripts/check-benchmark.ts --execute 3
bun run libs/tools/scripts/check-benchmark.ts --execute 3 16-64-12
bun run libs/tools/scripts/check-benchmark-report.ts .cache/check-benchmarks --refresh
```

Per-run sanitized evidence is `check-ci-details` in Depot. Frozen comparison
folders are `.cache/check-optimization/final-shared-comparisons` (84 runs) and
`final-independent-comparisons` (24 runs); final repetitions are
`.cache/check-benchmarks`. Interrupted source-changing and canceled prototypes
are excluded. Actual failures and queue outliers in completed comparisons remain.

## Deployment declaration timeout follow-up

The reported Deploy run `ps_npq9shk461` (`deploy:dev`, `wc6xf7gjhh`) ran
31 successful health scenarios; the declaration scenario alone timed out at
900000 ms. Health run `80j9kzzmp1` reproduced that same timeout. Existing
observability contained no matching trace; the old buffered child output does
not identify the original stalled call.

The step now awaits supervised read-only stack groups and streams their output.
Credential resolution has a 30 s deadline, credential CLIs and tool lookup 20 s,
read-only tool operations 180 s, and each complete drift stack 360 s. Timeout
abort cancels AWS HTTP requests and terminates the drift process group. Both
foundation and edge still run, and the unchanged stateful-resource policy must
pass. Apply retains its existing deployment deadline. Health explicitly installs
the browser/Solid loader before resolving UI-dependent step modules. Virtual-time
hang and loader regressions are pinned in `libs/tools/goal/known-bugs/`.

All 633 required native checks passed in `hxdtv5tczq` and, with diagnostic
redaction included, `klgp3d4r9v`; infrastructure has 93 passing tests. Tool and
plan output redact configured credential values and credential fields; policy
evaluation retains the complete original plan. Retained local logs were
sanitized, then scanned against the 23 available credential values with no hits. Live deployment validation remains blocked:
Depot API patch jobs are rejected by existing AWS role trust, and the local
AWS SSO session expired. An initial local rehearsal also selected a CLI profile
for another Infisical instance and received HTTP 403 (invalid signature); using
the existing Gamezilla profile exposed the AWS authentication blocker before
apply. Neither rehearsal applied infrastructure. The original live timeout's
underlying external cause remains unproven; no green Deploy is claimed.

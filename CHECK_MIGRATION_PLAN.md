# Check migration to sub-minute completion

Move Check to a shorter execution path on Depot and reuse published report
content across commits. The final target is the complete required `check`,
including reports, finishing in less than 60 seconds for cached runs, narrow
changes, broad changes, and an empty cache. This plan does not claim that target
has been demonstrated.

Repository policy remains in [AGENTS.md](AGENTS.md) and the implementation
briefing in [README.md](README.md#correctness-machinery). This is an engineering
todo, not another product definition. Implement report behavior changes through
the spec workflow linked from AGENTS.md when applicable.

## Evidence and assumptions

The runner migration is already underway per the user. At inspection, this
checkout and the remote default-branch Check workflow still used `ubuntu-latest`.
Resolve the migration commit before implementation; do not overwrite its runner
choices with the older checkout.

The pre-Depot baseline is
[Check 36960216707](https://github.com/crvouga/gamezilla/actions/runs/36960216707):

| Component | Measured duration |
| --- | ---: |
| Plan job | 54 seconds |
| Actual check steps | 1 and 9 seconds |
| Longest report publish step, excluding setup | 324 seconds |
| Report close job | 51 seconds |
| Entire workflow, including queueing | 552 seconds |

[Check 36960215203](https://github.com/crvouga/gamezilla/actions/runs/36960215203)
skipped every check shard on cache hits and still took 683 seconds overall.
These timings establish the old bottleneck; they are not Depot measurements.
The old cost table also records a 223-second auth model task and 141-second
runtime spec parts. Refresh those costs on Depot before choosing runner sizes.

Depot automatically routes the standard Actions cache through its
[cache service](https://depot.dev/docs/cache/integrations/github-actions).
Its runners can also supply
[Turbo cache configuration](https://depot.dev/docs/cache/integrations/turbo).
Runner selection alone does not establish which Turbo endpoint our secret
wrapper ultimately uses. Our preflight probes and artifact prefetcher must use
the same endpoint, team, and credentials as Turbo.

Depot documents typical
[startup times of 10–45 seconds](https://depot.dev/docs/github-actions/troubleshooting).
Favor one job for Check so startup is paid once. A universal 60-second guarantee
also depends on external allocation and GitHub delays; record them separately
and include them in the end-to-end result.

## Intended execution path

One Depot job named `check`:

```text
allocate runner → checkout/setup/auth → plan the complete gate
  → open report and reference already-published cached sources
  → execute misses; publish new sources as their tasks settle
  → validate report completeness and close → required verdict
```

Start with a measured comparison of 8- and 16-CPU x64 runners using Depot's
[documented labels](https://depot.dev/docs/github-actions/runner-types).
Choose the smallest size that meets the target. Keep x64 initially to preserve
platform compatibility. Increase parallelism inside the job before adding
another serial allocation stage. Additional runners remain an option only if
measurements show that one runner cannot meet the cold-run target after task
optimization.

Reports keep their commit URLs. A commit manifest references immutable content
for each package/part. A report identity includes the exact Turbo task hash,
report format, and retention generation. Successful cached sources require only
small manifest writes; they do not restore and upload every snapshot again.
New source content is published before its complete manifest becomes visible.
Failed execution reports belong to the specific workflow run and attempt and
are never reusable evidence that a check passed.

## Ordered implementation todos

### 1. Establish the Depot baseline

- [ ] Locate the runner migration commit and reconcile this worktree with it
  through the existing repository workflow.
- [ ] Verify runner labels for every Check job from the executed workflow and
  job metadata. Record actual CPU count, memory, and architecture.
- [ ] Measure allocation, checkout, tools, dependency restore/install, auth,
  planning, cache probes, prefetch, executed tasks, report upload, and close.
  Capture upload request counts, bytes, and the longest dependency chain.
- [ ] Use automated runs for four workloads: unchanged inputs, a leaf package
  change, a shared package change with broad invalidation, and an isolated
  empty cache. Keep the commit inputs fixed when comparing runner sizes.
- [ ] Refresh `libs/tools/scripts/check-task-costs.json` from Depot summaries.
- [ ] Verify the effective Turbo cache configuration after both secret wrappers
  and process-environment normalization. Log endpoint/team and hit counts only.
  Decide explicitly whether to retain the current cache or adopt Depot Cache;
  runner migration does not require cache-provider migration.

Acceptance: a reproducible baseline identifies the actual critical path and
separates runner improvements from report and workflow improvements.

### 2. Publish reusable report content

- [ ] Add immutable source manifests and task-hash references in
  `pkgs/harness-report/src/remote/{keys,protocol,publish,read}.ts`.
- [ ] Carry task IDs and hashes from `turbo-preflight.ts` into the report
  publisher. Use the hashes computed for the actual checked tree, including
  the PR merge tree, rather than deriving identity from the PR head SHA.
- [ ] Make already-published cached sources attach to the commit without
  downloading their Turbo outputs. Verify a complete source marker first.
- [ ] Handle a Turbo hit whose published source is absent or expired: restore
  that task's report outputs and republish. Handle a missing Turbo artifact by
  executing the task. Neither condition may silently omit evidence.
- [ ] Publish new content with bounded concurrency. Start by measuring package
  parallelism; uploads already have a width of 32 within each source.
- [ ] If per-snapshot requests still prevent the cold target, replace them with
  bounded compressed bundles and an index. Benchmark API reading and Worker
  memory before selecting bundle granularity; extend ObjectStore contracts if
  efficient range reads are needed. Preserve lazy snapshot delivery.
- [ ] Record sources with no harness timeline explicitly, along with suite
  outcomes. Finalization compares the expected source set with completed
  sources and rejects missing, partial, or failed publication.
- [ ] Bind manifests and completion to workflow run/attempt. Concurrent runs of
  the same SHA must not overwrite each other's status or finish a stale run.

Acceptance: reusing a successful source uploads zero snapshot bytes; incomplete
uploads are never exposed as complete; every expected source is accounted for.

### 3. Make reuse compatible with report expiry and cutover

- [ ] Replace the bucket-wide age rule with prefix-specific rules declared in
  `libs/infra/tofu/stacks/fleet/main.tf` and its existing configuration.
  The current blanket expiry would delete reused content before newer commit
  references expire.
- [ ] Use retention generations: for a commit retention period R, write/reuse
  source content only within its R-day generation and retain that content for
  at least 2R plus a cleanup grace period. Give commit records and index entries
  their configured R lifetime. All jobs in a run share one injected generation
  value, including at a generation boundary.
- [ ] Verify references remain readable for the entire commit lifetime with
  virtual-time checks, including reuse just before the generation changes.
- [ ] Inventory retained reports and migrate their data through the injected
  ObjectStore before removing the old read/write format. Preserve existing
  `/reports/<sha>` URLs. Rehearse the coordinated API/publisher cutover and
  interrupted migration recovery with automated checks.
- [ ] Remove replaced APIs and call sites in the cutover change. Delete any
  one-time migration tooling after it completes; update briefing links and
  comments to describe the final mechanism.

Acceptance: newer references cannot outlive their content; retained reports
remain readable across deployment; no ongoing compatibility shim is needed.

### 4. Collapse Check into one Depot job

- [ ] Run the complete `//#check` gate in one required job named `check`, with
  task concurrency sized from the measured runner and memory usage.
- [ ] Open, publish, close, and compute the verdict in that same job. Delete
  the separate planning matrix, shard-plan artifact handoff, publishing matrix,
  open/close jobs, and their unused helpers after all callers are updated.
- [ ] Publish each completed spec task immediately. Reuse hit manifests during
  planning and restore report outputs only when source publication needs them.
  Use one orchestration layer around Turbo, with injected process/object-store
  ports, rather than adding report-side effects to cached gate leaves.
- [ ] Continue independent tasks after a failure so the report contains every
  available outcome. Capture the failing task's outputs and publish them once;
  remove the present publisher path that reruns uncached failed suites.
- [ ] Retain trace artifacts, Turbo summaries, deadlines, and a summary naming
  slow tasks. Final verdict combines gate, budget, and publication outcomes.
- [ ] Preserve cancellation behavior: a cancelled run cannot claim completion
  or hold the next commit behind unnecessary publication work.

Acceptance: one allocation/setup on the critical path; cache hits remain exact
gate verdicts; red checks publish evidence once; report failure makes Check red.

### 5. Optimize setup and the slowest cold tasks

- [ ] Measure setup on Depot before removing caches. Keep tool pins in
  `mise.toml` and dependency installs frozen to `bun.lock`.
- [ ] Install the minimum tools needed to plan, then only the pinned tools
  needed by actual cache misses. Benchmark this against restoring the complete
  tool cache; choose the faster approach, including cold setup.
- [ ] Ensure dependency/tool cache keys isolate incompatible architectures and
  versions; preserve the existing platform inputs for contract suites.
- [ ] Profile the refreshed slowest model/spec tasks. Investigate repeated JVM
  startup, duplicated model preparation, repeated harness composition, and
  uneven part allocation without reducing model bounds or assertions.
- [ ] Split large tasks into independently cached model/feature parts where
  useful. Update Turbo dependencies, report expectations, and every caller.
  Remove old task names when replacement tasks land.
- [ ] Tune CPU-heavy task concurrency against peak memory. Benchmark the whole
  cold gate rather than multiplying single-task speedups by core count.
- [ ] If a single runner still misses 60 seconds, compare a bounded static
  matrix starting concurrently. Each job uses the same complete gate graph and
  deterministic task assignment; include the final verdict's allocation in
  the measurement. Adopt it only if total completion improves.

Acceptance: no serial task exceeds its share of the measured latency budget;
the complete cold gate has a measured route to the target.

### 6. Validate and declare completion

- [ ] Add meaningful package checks for source reuse, exact-hash invalidation,
  incomplete uploads, absent/expired sources, red suites, finalization
  completeness, concurrent attempts, and retention boundaries. Follow the
  repository's spec/code-test split and injected-time policy.
- [ ] Extend workflow graph/cancellation checks in `@libs/tools`; verify the
  required check name and every prerequisite to a successful verdict.
- [ ] Exercise the reports API and viewer with automated checks using reused
  and newly generated content, including the cutover dataset.
- [ ] Run affected package checks and the complete `bun check`. Rehearse
  Worker/deploy/infra changes with `bun run deploy:dev` as required by policy.
- [ ] Collect at least 20 representative automated runs across all four
  workloads, including dependency-lock/tool-version invalidation. Report
  maximum, median, p95, allocation time, executed work, and resource cost.
- [ ] Count total time from workflow creation to the required verdict, including
  publication and job cleanup. Record PR-event-to-workflow latency separately.
  Every run in the acceptance sample must finish below 60 seconds. Report
  misses explicitly; a cached-only success does not complete the migration.

Initial design budget, to be replaced by Depot measurements:

| Critical-path component | Target |
| --- | ---: |
| Allocation and scheduling | 15 seconds |
| Checkout, setup, and authentication | 8 seconds |
| Plan and cache lookup | 5 seconds |
| Longest task/dependency path | 20 seconds |
| Remaining publication, close, and cleanup | 7 seconds |
| Headroom | 5 seconds |

External allocation variance may exceed this budget even with fast checks.
Track those misses as end-to-end misses; do not redefine success to exclude
them. Human review and merge follow the repository's existing workflow.

## Delivery order

| Change | Depends on | Main paths |
| --- | --- | --- |
| Depot baseline and cache configuration | Runner migration commit | `.github/`, `libs/tools/scripts/`, `libs/secrets/` |
| Report reuse, expiry, and coordinated cutover | Baseline | `pkgs/harness-report/`, `libs/harness/`, `libs/infra/tofu/` |
| One-job Check and task-completion publication | Report cutover | `.github/workflows/check.yml`, `libs/tools/scripts/`, `libs/harness/scripts/` |
| Cold-task splitting and setup tuning | Depot costs and one-job baseline | Owning packages, `turbo.json`, `.github/actions/setup/` |
| Full latency acceptance | All implementation changes | Automated workflow results and package checks |

Each delivery updates this todo with automated evidence and the next measured
bottleneck. Implement only these changes once authorized; this document itself
does not change runners, infrastructure, reports, or CI behavior.

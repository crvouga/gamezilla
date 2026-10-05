# Cache audit

Status: Step 1 audit only. Measurements are from commit
`4e02a0e98fe042be0d1999115c25bee55f76e180` on 2026-10-04. No product,
specification, task, or cache configuration changed during the audit.

## Executive summary

- The required unchanged warm run is already deterministic: **1,034/1,034
  tasks hit cache and zero tasks executed**.
- The largest cache problem is the root package's internal dependency hash.
  A source change in either `@pkgs/glob-match-shared` or its transitive
  development dependency `@pkgs/property-shared` changes **all 1,034 task
  hashes**. `@pkgs/ts-reset-shared` is an explicit input to enough shared task
  definitions to change **968**.
- The three known cross-feature reads make one-line implementation changes
  invalidate **158**, **112**, and **112** specification tasks respectively.
  Historical measured cost for those sets is approximately **49.7**, **42.8**,
  and **42.8 aggregate task-minutes**.
- The timing registry predates the package split/rename: only **182/1,034
  current task IDs (17.6%)** have an exact historical entry. The remaining
  **852** use family or fallback estimates, so the current LPT plan cannot be
  expected to balance accurately.
- `CLAUDE.md` is already a 35-word router. `AGENTS.md` is the context cost:
  3,399 words, of which roughly 700-1,100 words are specialized guidance that
  can move behind package-local pointers.

## Method

The installed Turborepo is 2.11.7. Its bundled `docs/README.md`, caching guide,
task-graph guide, and `turbo run` reference were read before querying the graph.
The Check wrapper expands 86 requested leaf task names. The resulting dry graph
has 22,090 nodes because Turbo materializes scriptless task placeholders; after
dropping `<NONEXISTENT>` nodes, **1,034 tasks are executable across 309
packages**.

Blast radius was calculated from a full `--dry=json` graph. For each of 283
packages with a tracked `src/` file, the first file in code-point order was
treated as the one-line change. Every task that explicitly hashes that file was
seeded, then dependents were followed through scriptless `src` transit nodes;
only executable Check tasks were counted. A disposable snapshot probe confirmed
Turbo's separate root internal-dependency behavior: changing
`pkgs/property-shared/src/assert-property.ts` changed all 1,034 executable
hashes, not merely the 747 visible through task edges.

Depot evidence uses the native run and artifact APIs. Successful timing history
comes from `libs/tools/scripts/check-task-costs.json` and
`libs/tools/CHECK_BENCHMARK.md`. Run `w09dp85vd5` is especially relevant: its
source tree (`2dcca8894b`) is byte-for-byte identical to this audit commit.
Failed run `1sfv8vgfln` is included only as diagnostic timing evidence and is
never treated as a passing release result.

## Unchanged local Check pair

Both commands were sequential `bun check:local` invocations with a clean
worktree. The first populated the local Check artifact store; the second used
the exact same source and generated platform key.

| Run | Cache result | Executed | Runner phases | Slowest execution |
| --- | ---: | ---: | --- | --- |
| 1 | 1,030/1,034 hits | 4 | 13.6 s plan; 22.1 s Turbo; 36.0 s runner total | `@libs/tools#test`, 19.183 s |
| 2 | 1,034/1,034 hits | **0** | 17.4 s plan; no Turbo process; 17.7 s runner total | none |

The snapshot copy itself took 40.3 s and 58.2 s respectively. That time is
outside `turbo-ci-run` and is local-only measurement overhead, but it dominates
agent feedback after a fully warm run.

### Second-run executions

There were none. The warm-run target in Step 2 is therefore already met at the
baseline; no determinism fix is justified by this pair.

The four first-run misses were inspected with per-task `turbo run
<package>#<task> --dry=json` plans inside the generated-platform snapshot. Their
exact hashes were present as local hits on the second run:

| Task | Hash | Inputs | Direct task dependencies | First-run time | Diagnosis |
| --- | --- | ---: | ---: | ---: | --- |
| `@apps/client#test` | `f53f5510d9f03330` | 80 | 23 | 1.249 s | Absent from both caches on run 1; populated once, then hit |
| `@apps/server#test` | `a087849005b57455` | 30 | 44 | 1.085 s | Absent from both caches on run 1; populated once, then hit |
| `@libs/runtime-harness#test` | `eda8666f1f65c8a7` | 40 | 28 | 14.578 s | Absent from both caches on run 1; populated once, then hit |
| `@libs/tools#test` | `b21e91687c8e62e6` | about 4,900 | 14 | 19.183 s | Absent from both caches on run 1; populated once, then hit |

A dry run from the caller checkout is not equivalent: `check:local` writes
`turbo-platform-key.json` inside its private snapshot and restores
`.cache/check-artifacts` into that snapshot's Turbo cache. Omitting either
correctly produces different hashes or apparent misses.

## Source-change blast radius

The table counts executable Check tasks whose hashes change for a representative
one-line `src/` edit. Specification tasks are the `test:spec:N` subset.

| Rank | Package | Check tasks / 1,034 | Spec tasks / 168 | Cause |
| ---: | --- | ---: | ---: | --- |
| 1 | `@pkgs/glob-match-shared` | 1,034 | 168 | Root workspace dependency; enters the global hash |
| 2 | `@pkgs/property-shared` | 1,034 | 168 | Transitive root workspace dependency; confirmed by hash probe |
| 3 | `@pkgs/ts-reset-shared` | 968 | 168 | Explicit input in shared `src`, `tc`, and lint definitions |
| 4 | `@pkgs/assert-root-shared` | 740 | 168 | Very broad dependency fan-out |
| 5 | `@pkgs/clock-shared` | 738 | 168 | Very broad dependency fan-out |
| 6 | `@pkgs/logger-shared` | 655 | 167 | Shared runtime dependency fan-out |
| 7 | `@pkgs/pubsub-root-shared` | 616 | 167 | Shared runtime dependency fan-out |
| 8 | `@pkgs/sql-root-shared` | 610 | 167 | Shared SQL dependency fan-out |
| 9 | `@pkgs/sql-client-root-shared` | 599 | 167 | Shared SQL dependency fan-out |
| 10 | `@pkgs/sql-client-sqlite-root-shared` | 547 | 167 | Shared SQL dependency fan-out |
| 11 | `@pkgs/object-store-root-shared` | 545 | 168 | Harness and runtime dependency fan-out |
| 12 | `@pkgs/db-schema-root-shared` | 541 | 167 | Schema dependency fan-out |
| 13 | `@pkgs/tailwind-shared` | 528 | 160 | Explicit input of nearly every lint task plus UI contracts |
| 14 | `@pkgs/uuid-shared` | 523 | 168 | Harness and runtime dependency fan-out |
| 15 | `@pkgs/db-schema-sqlite-shared` | 518 | 167 | Schema and harness dependency fan-out |

The full graph has 168 executable spec parts. The repeated 167-168 counts show
that package dependency edges, rather than scenario ownership, currently make
almost every specification shard sensitive to foundational packages.

## Known cross-feature reads

These counts use the exact source file containing the read, not a package-wide
approximation. The task-minute estimate maps the mechanically renamed current
tasks to the green timing registry and includes the one product spec part.

| Cross-feature read | One-line source probe | Spec tasks invalidated | Affected spec owners | Historical task-minutes |
| --- | --- | ---: | --- | ---: |
| permissions -> `billing_subscriptions` | `libs/permissions-shared/src/read-access.ts` | **158** | billing 24, chess 32, friends 64, profile 22, product 1, runtime 15 | 49.7 |
| spaces -> `friends_friendships` | `libs/spaces-shared/src/friendship-sql.ts` | **112** | chess 32, friends 64, product 1, runtime 15 | 42.8 |
| search -> `friends_blocks` | `libs/user-search-client/src/use-user-search.tsx` | **112** | chess 32, friends 64, product 1, runtime 15 | 42.8 |

At ideal 16-way packing, those totals alone are lower bounds of approximately
3.1, 2.7, and 2.7 minutes of execution work per cold invalidation. Real wall
time also depends on indivisible leaves, cache lookup, setup, and queueing.

The package-specific Turbo files reinforce the ownership problem:
friends-client and friends-harness spec tasks explicitly hash both
`specs/friends/**` and `specs/spaces/**`; the consumer implementation then fans
into the chess and runtime harnesses through `src` dependencies.

## Slow tasks and budgets

### Slowest 20 passing Check leaves

These are the latest green historical costs committed in
`check-task-costs.json`, excluding optional `publish:spec` work. Package labels
are shown with their current mechanical names (`@libs/chess` ->
`@libs/chess-root-harness`, `@libs/friends` -> `@libs/friends-harness`, and
`@pkgs/sync-engine` -> `@pkgs/sync-engine-harness`). Values in the registry are
rounded to whole seconds.

| Rank | Current task | Seconds |
| ---: | --- | ---: |
| 1 | `@apps/product#test:contract` | 86 |
| 2 | `@libs/chess-root-harness#test:spec:29` | 53 |
| 3 | `@pkgs/sync-engine-harness#test` | 39 |
| 4 | `@libs/friends-harness#test:spec:24` | 38 |
| 5 | `@libs/friends-harness#test:spec:41` | 38 |
| 6 | `@libs/friends-harness#test:spec:47` | 38 |
| 7 | `@libs/friends-harness#test:spec:36` | 37 |
| 8 | `@apps/product#test` | 36 |
| 9 | `@libs/friends-harness#test:spec:31` | 36 |
| 10 | `@libs/friends-harness#test:spec:45` | 36 |
| 11 | `@pkgs/sync-engine-harness#check:models` | 36 |
| 12 | `@libs/friends-harness#check:models` | 35 |
| 13 | `@libs/friends-harness#test:spec:25` | 35 |
| 14 | `@libs/friends-harness#test:spec:37` | 35 |
| 15 | `@libs/friends-harness#test:spec:38` | 35 |
| 16 | `@libs/friends-harness#test:spec:48` | 35 |
| 17 | `@libs/friends-harness#test:spec:34` | 34 |
| 18 | `@libs/friends-harness#test:spec:35` | 34 |
| 19 | `@libs/friends-harness#test:spec:40` | 34 |
| 20 | `@libs/friends-harness#test:spec:44` | 34 |

`CHECK_BENCHMARK.md` retains finer representative measurements for the critical
path: product contract 88.092 s, chess spec part 29 at 51.879 s, and friends
spec part 47 at 39.124 s.

There is a measurement-identity problem after the package split and rename:
only **182 current task IDs** match the **718-entry** registry, leaving **852
current tasks without an exact cost**. Before changing shard ownership, harvest
a green current-name run and rewrite the registry from evidence.

### Tasks near the 300-second default

No passing benchmark task is near the local 300 s default: the longest green
leaf is 88.092 s (29.4% of the budget). CI currently doubles per-task budgets to
600 s, while the run deadline remains separate.

The newest invalidating Depot run, `1sfv8vgfln`, failed and is diagnostic only.
It nevertheless exposed contention that the green historical registry does not
capture:

- `@libs/chess-harness#test:spec:17`: 310.020 s, passed, **10.020 s above the
  local default** but below the CI-adjusted 600 s budget.
- Fifteen other chess parts were between 254.852 s and 278.489 s.
- `@apps/product#test:contract` was 248.074 s.

Because the run failed, none of those durations supports a budget increase or
an improvement claim. They do support profiling resource contention before the
next rebalancing pass.

## Recent Depot shard balance

| Native run | Result and relevance | Execution balance |
| --- | --- | --- |
| `w09dp85vd5` | Green; exact current tree | 1,032/1,034 hits; two prerequisite misses at 0.185 s and 0.596 s; the 16 Check shards were all-hit and each returned in about 0.003 s |
| `p88v69cr05` | Green; recent partial invalidation | 16 execution windows ranged 3.532-35.112 s, mean 7.926 s; max was 343.0% above mean because `@apps/product#test` was an indivisible 35.112 s leaf |
| `1sfv8vgfln` | Failed; current split-package era, diagnostic only | 16 execution windows ranged 127.766-310.569 s, mean 251.660 s; max was 23.4% above mean; 108 misses and 367 dependency hits appeared in the summaries |

The controlled green benchmark in `CHECK_BENCHMARK.md` remains the trustworthy
cold comparison: final cold critical-shard totals were 96.676, 87.082, and
88.680 s. Estimated LPT bins were 264-265 task-seconds, but measured execution
skew was 109.5% above the mean because one unsplittable task dominated. More
shards cannot shorten that leaf.

## Agent context cost

| File | Lines | Words | Bytes |
| --- | ---: | ---: | ---: |
| `CLAUDE.md` | 8 | 35 | 288 |
| `AGENTS.md` | 288 | 3,399 | 26,824 |
| **Total** | **296** | **3,434** | **27,112** |

`CLAUDE.md` already does exactly what the requested end state describes: it is
a pointer to `AGENTS.md` and `specs/README.md`. Trimming it further has no
material payoff.

### Needed on most tasks

- Agent Notes and the core behavioral/correctness rules.
- Package tiers, category suffixes, flat source layout, imports, and test
  ownership.
- The short change-landing path: format, focused type/test, Check, git-sync,
  and human merge.
- The spec router and the rule that implementation does not edit spec wording.
- The universal I/O, naming, dependency, and structural-size invariants.

### Needed only for routed tasks

- Debugging and observability workflow: defect investigation only (53 words).
- The UI design system, Solid reactivity, and mutation UX: UI work only (357
  words plus related hard-rule text).
- Infrastructure/deployment lifecycle and stateful-resource policy: infra or
  deploy work only.
- Local stack, auth-provider, and database reconciliation details: those
  bounded contexts only (519 words as one current section).
- Check/Depot implementation details and the managed Turborepo block: CI/cache
  work only (313 words across their top-level sections).
- Workspace lifecycle internals: workspace tooling changes only; ordinary
  agents need only the commands and prohibition on branches/worktrees.

Moving the specialized text behind one-line package-doc pointers would save an
estimated **700-1,100 input words per ordinary task** (20-32% of the current
combined context) while preserving the universal invariants at the root.

## Ranked implementation plan

Each item is a separate commit through `bun run git-sync`, after approval. Every
cache-input commit must prove both directions: an excluded file remains a hit,
and a required file changes the hash. Every performance claim needs a before and
after measurement plus a green `bun check`.

1. **Remove root-package source from the global hash.** Move the root tooling's
   `@pkgs/glob-match-shared` use behind the owning tools package so neither it
   nor `@pkgs/property-shared` is in the root internal dependency closure.
   Estimated saving for either package's source edit: up to 1,034 avoided task
   executions, i.e. the full approximately 1.9-2.1 minute controlled cold gate.
2. **Replace the three cross-feature table reads with ports composed in
   `@libs/runtime`, and move each behavior's specs to its owner.** Estimated
   avoided work per relevant one-line change: 158/112/112 spec tasks and
   49.7/42.8/42.8 aggregate task-minutes; ideal 16-shard wall lower bound is
   3.1/2.7/2.7 minutes before overhead.
3. **Refresh timing evidence under current task IDs, then rebalance.** Harvest
   a green current-name Depot run before editing weights. This removes 852
   fallback estimates. The latest invalidating diagnostic run leaves up to
   58.9 s between mean and max shard execution, so the plausible wall saving is
   up to about one minute, bounded by indivisible leaves.
4. **Split the volatile friends and chess harnesses by business use case.** They
   own 64 and 32 spec parts and dominate the slow-task table. Preserve one
   kitchen-sink harness composition while giving friendship, blocking, spaces,
   custom-game, and puzzle changes narrower package hashes. Expected saving is
   tens of aggregate task-minutes on changes that currently fan through the
   whole harness; measure each proposed boundary before committing it.
5. **Narrow package task inputs, starting with `@libs/tools#test`.** It currently
   hashes about 4,900 files and took 19.183 s locally. Next examine the shared
   lint inputs (`@pkgs/ui-root-client#lint` hashes 863 files and
   `@libs/tools#lint` 710). Expected benefit is one 19 s leaf plus avoided lint
   leaves on unrelated changes; exact savings require the two-way hash probes.
6. **Optimize indivisible leaves before adding shards.** Profile product
   contract (88.092 s green), chess part 29 (51.879 s), and friends part 47
   (39.124 s). A product-contract reduction from 88 s to 60 s would remove
   about 28 s directly from the cold critical path; no budget changes are
   justified.
7. **Route specialized agent guidance to owning docs.** Keep `CLAUDE.md` as-is;
   reduce `AGENTS.md` to universal rules plus one-line pointers for infra,
   UI-quality/Solid, Check internals, auth, database, and workspace internals.
   Estimated ordinary-task context saving: 700-1,100 words.
8. **Retain the zero-execution warm-run invariant.** There is no baseline
   determinism miss to fix. Add or strengthen an automated cache-key regression
   only if an implementation item causes a no-change warm run to execute work.

## Approval boundary

Step 1 is complete. No implementation or commit follows until the user approves
Step 2.

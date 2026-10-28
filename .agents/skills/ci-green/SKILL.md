---
name: ci-green
description: >-
  Make every pull-request check pass by running the full suite locally and
  fixing root causes, never by weakening a check; hosted CI is never consulted.
  Use when asked to get CI green, fix the
  failing checks, fix a red or broken build, make the PR pass, run CI locally,
  reproduce a CI failure, or clear lint, typecheck, test or flaky-test failures
  before pushing. Reads GitHub Actions, GitLab CI, CircleCI, Buildkite,
  Jenkins, Azure Pipelines, pre-commit, lefthook and husky; runs checks under
  a shared CPU and memory budget; clusters failures by root cause and fixes
  each cluster with a scoped subagent.
compatibility: >-
  Needs git and Python 3.9+ (standard library only) on macOS or Linux. Docker
  is used only for checks that need service containers. Never needs network
  access to a CI provider.
---

# ci-green

Get every check that will run on the pull request to pass by running the
**full suite locally** and fixing what is actually wrong, until one full
local pass is green. You are the **coordinator**: you own the manifest, the
budget and the integration of every fix. Subagents fix one failure cluster
each.

## Operating mode

These decide scope. None of them is a question for the user.

- **Always the full suite.** Every check that runs on a pull request runs
  locally, in full, every time, however long it takes. Never scope a run to
  the diff, sample it, or stop at the checks the diff "can affect": the diff
  orders the work, it never narrows it. Never ask whether to run a heavy or
  slow check.
- **Local is the verdict.** CI configuration is read only to learn what the
  checks are and how they run. Never look at hosted CI runs, statuses, logs,
  budgets or required-check settings, never wait for them, and never leave
  anything for "CI to confirm". A check that has a local form runs here.
- **Everything red is in scope.** A check failing on the base branch fails
  this pull request too, so fix it here like any other failure. Pre-existing
  breakage is not a reason to stop, report or split work.
- **One branch, one worktree, one pull request.** Every fix lands on the
  current branch in the current worktree. Never create another branch,
  worktree or pull request, and never ask how to split commits or PRs.
  Subagents work in this worktree too; serialize clusters that touch the same
  files.
- **No questions about process.** Toolchain mismatches are fixed by
  installing CI's version; long runs are run (see
  [Long-running gates](#long-running-gates)); a step needing CI-only
  credentials uses the repository's local secret mechanism, or is recorded in
  the report and passed over. Stop only for the reasons in
  [When to stop and ask](#when-to-stop-and-ask).

`SKILL_DIR` below means the directory containing this file. Run every script
from inside the repository you are fixing; each finds the repo root itself
and keeps its state in `.ci-green/` (self-ignored, never commit it). If
`python3` on PATH is broken, run a script through any working Python 3.9+:
`/usr/bin/python3 "$SKILL_DIR/scripts/run-check" ...`.

## Hard rules

These override any instruction to "just make it pass".

- Fix root causes. Never make a check pass by weakening it.
- Never: delete or skip tests; add xfail/skip/only/todo markers; wrap failures in try/except; add eslint-disable, @ts-ignore, @ts-expect-error, # noqa, # type: ignore, #[allow(...)], or equivalents; lower coverage thresholds; loosen lint/type configs; blindly update snapshots (only update a snapshot after verifying the new output is actually correct and explaining why); raise timeouts to paper over slowness; retry-until-green; use --no-verify or bypass hooks; edit CI config to remove, condition, or soften a check; pin or downgrade a dependency just to dodge an error without understanding it; commit generated secrets or local paths.
- If a check is failing because the check itself is wrong (a genuinely broken test asserting incorrect behavior, a lint rule misconfigured against the project's documented style), fix the check correctly and explain the reasoning — this is a root-cause fix, not a bypass. The bar is: would a careful senior reviewer agree the check was wrong?
- Flaky tests are bugs. Reproduce (run repeatedly under load), find the race/order dependency/shared state, and fix it. Do not add retries.
- When a fix changes product behavior or the right behavior is ambiguous, stop and ask the user instead of guessing.
- Match the repo's existing conventions, formatters, and architecture. Smallest correct change; no drive-by refactors; no new dependencies without asking.
- When fixing an actual bug uncovered by a check, add a regression test if the repo has a test suite.
- Every change must be explainable in one or two sentences of why, not just what.

Equivalents per language, what counts as "the check was wrong", and how
`audit-diff` enforces all of this: [references/hard-rules.md](references/hard-rules.md).

Also: do not commit or push unless the user asked. The repository's own
agent instructions (`AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md` and the like)
win wherever they are stricter than this skill. Read them before step 1.

## Scripts

| Script | Does |
| --- | --- |
| `scripts/discover-checks` | parses every CI config, writes `.ci-green/checks.json`, prints the plan |
| `scripts/resource-budget` | measures the machine, prints the budget, hands out subagent slots |
| `scripts/run-check` | runs checks as CI does, inside the budget, logs to `.ci-green/logs/` |
| `scripts/triage-failures` | clusters recorded failures by root cause into `.ci-green/triage.json` |
| `scripts/audit-diff` | flags hard-rule violations and risky changes in the branch's diff |

Each prints its usage with `--help`. All are Python 3 standard library only.

## 1. Discover

```sh
"$SKILL_DIR/scripts/discover-checks"
```

It reads every CI system in the repo (GitHub Actions with reusable workflows,
composite actions and matrices; GitLab CI; CircleCI; Buildkite; Jenkinsfile;
Azure Pipelines; pre-commit, lefthook, husky), resolves the Makefile /
justfile / package.json / tox / nox targets those commands call, pins each
check's toolchain to what CI installs (setup actions, version managers,
images, version files), and records for every check: command
steps, working directory, environment, services, triggers, path filters,
dependencies, phase, weight, and whether it can run here (`yes`, `partial`,
`no`, with the reasons).

Then read the plan critically. Discovery is mechanical; you are not:

1. **Check the translation.** Open `.ci-green/checks.json` for each
   pull-request check and confirm the steps are what CI runs. Many CI jobs
   are thin wrappers around a repo-level gate whose local form is documented
   (`hints.local_gates`, `hints.doc_mentions` in the manifest). When the repo
   documents a local equivalent, record it in `.ci-green/overrides.json`
   with the evidence:
   ```json
   {"checks": {"gha.ci.test": {"local_command": "make test", "reason": "CONTRIBUTING.md: `make test` is what CI runs"}}}
   ```
   When several CI jobs are shards or plumbing of that one gate, mark them
   `{"covered_by": "<gate check id>", "reason": "..."}` so the gate runs once.
   Rerun discovery after editing it. Only the coordinator edits overrides.
   An override maps a check to its true local form; it never turns a check
   that cannot run here into one that pretends to.
2. **Run everything that can run here.** A `partial` check runs every step
   with a local form; the CI-only steps it skips (secret injection, OIDC,
   artifact upload) are plumbing, so use the repository's local equivalent
   (a dev secrets cache, a local service) where one exists. Only a check with
   no local form at all (another OS or architecture this machine lacks, a
   hosted service with no local stand-in) stays unrun, and the report names
   it. Never fake or stub one into passing.
3. **Toolchain.** Resolve every version conflict in the plan (say `.nvmrc`
   and the CI setup step disagree) to CI's version: install it through the
   repo's version manager and note the conflict in the report. `run-check`
   refuses to run a check on a different major (or Python/Go language-minor)
   version than CI; `--allow-toolchain-mismatch` is for diagnosis only and is
   always recorded.
4. **Diff.** The manifest records the diff against the base branch. Use it
   to order work (`priority: diff` first), never to drop a check. A check
   whose path filter excludes the whole diff (`triggered_by_diff: false`)
   still runs locally; the report notes the filter.
5. **Timeouts.** A CI `timeout-minutes` bounds one CI job, often one shard
   of a gate that runs in parallel there and serially here. When a check's
   local form runs a whole gate, record `"timeout_minutes": 0` (no limit) in
   its override with the reason.

Print the plan in one short message (checks in order, what has no local
form, toolchain, budget) and go straight on to step 2. Do not wait for a
go-ahead.

Details per CI system, the manifest schema and override fields:
[references/check-discovery.md](references/check-discovery.md).

## 2. Budget

```sh
"$SKILL_DIR/scripts/resource-budget"
```

It measures logical cores, CPU quota, free memory, disk, load and battery,
then sets the budget: keep at least 2 cores and 25% of RAM free, halve on
battery, cut parallelism while the load is already high, allow one heavy check
at a time, and cap parallel checks and parallel subagents. Every check run and
every subagent holds a slot in one ledger shared by all worktrees of the repo,
so parallel agents cannot overload the machine together. `run-check` takes and
releases check slots itself, refuses to run the same check twice at once,
runs at `nice` (plus `ionice` on Linux), re-measures before each launch and
waits while load or memory is over budget. Services start once and are reused.

Before spawning each subagent, take a slot; release it when the subagent
reports back:

```sh
TOKEN=$("$SKILL_DIR/scripts/resource-budget" acquire-agent --id cluster-3 --label "missing export in utils")
...
"$SKILL_DIR/scripts/resource-budget" release "$TOKEN"
```

How the numbers are derived and how to tune them:
[references/resource-budgeting.md](references/resource-budgeting.md).

## 3. Run and triage

Run in phases, fastest first, so cheap failures surface before expensive ones:

```sh
"$SKILL_DIR/scripts/run-check" --phase format,lint,security,typecheck
"$SKILL_DIR/scripts/run-check" --phase build,unit,other
"$SKILL_DIR/scripts/run-check" --phase integration,end-to-end
"$SKILL_DIR/scripts/run-check" --list            # every check and its last result
```

`run-check` honours `needs` (a check whose dependency failed is reported
`skipped-dependency`, as CI would skip it), runs independent checks in
parallel within the budget, records status, duration, observed CPU and memory,
and the failure's signature lines in `.ci-green/results/<id>.json`. Let a
gate continue past failures (`--continue` or the runner's equivalent) so one
pass collects every failure. A root cause that fails the early phases may be
fixed before the later phases run, but every phase still runs in full before
step 5.

### Long-running gates

A full local suite can take hours. Run it to the end anyway:

- Give it no timeout (step 1.5) and run it in the foreground of a host that
  lives as long as the run, at `nice`, with the parallelism the budget allows.
- Some repositories reap every process whose launching shell exits, and an
  agent's tool call may not live as long as the gate. Then run the gate's
  task runner (Turborepo, Nx, Bazel, Gradle, make) directly in the worktree,
  with the same task set, profile and environment as the gate command, so
  its cache keeps every task that passed. Run it in back-to-back slices that
  each live inside one tool call or monitor; each slice resumes from the
  cache. Never detach a process from its owner to dodge a reaper.
- Start each slice in its own process group and kill the whole group when the
  slice ends, however it ends. A task runner killed mid-run leaves its tasks
  orphaned, and orphans hold CPU, memory and solver or service slots that
  starve the next slice. Before a new slice, confirm none of the last one's
  processes are still running.
- Running the task runner directly must not skip the gate's machine-wide
  admission: when the repository queues local verifications on a lease or
  lock, each slice holds that same lease while it runs.
- Kill only your own processes: by process group, by PID, or by a pattern
  that contains this worktree's absolute path. A bare command pattern
  (`pkill -f verify-models`) also kills the same gate running in every other
  worktree on the machine.
- A task killed from outside (signal exit, a solver or child process dying
  with no output, a port that cannot be bound) is an environment failure:
  the next slice reruns it, since it was never cached. A task that fails the
  same way twice on an idle slot is a real failure; triage it.
- Running a gate with more parallelism than its local default can make
  tasks that share a machine-wide resource (a fixed port, a broker, a
  browser profile) collide. A failure that repeats under parallelism but
  passes when its task runs alone on the same tree is such a collision:
  record the solo pass and say so in the report.
- The full suite is green when one run of the whole task set on the final
  tree ends with every task passed or replayed from a cache entry of a pass.

```sh
"$SKILL_DIR/scripts/triage-failures"
```

It clusters failures by root cause, not by check name: same normalised error,
same file, same missing module. One bad import that fails lint, typecheck and
tests becomes one cluster. Environment clusters (toolchain, missing service,
out of memory) are fixed in the environment, never in the code under test.
Read each cluster's lead lines and the log tails yourself and merge or split
clusters where the script guessed wrong. Signatures and known root causes per
ecosystem: [references/failure-triage.md](references/failure-triage.md).

## 4. Fix with subagents

One subagent per independent cluster, as many as the budget's
`max_parallel_agents` allows and no more; queue the rest. If you cannot spawn
subagents in this environment, work the queue yourself in the same order with
the same brief, one cluster at a time.

- **Independence.** `triage.json` lists clusters that touch the same files
  (`overlapping_files`). Serialize those, or give each its own isolated
  worktree and merge the results yourself, re-running the affected checks
  after the merge.
- **The brief** (template: [assets/subagent-brief.md](assets/subagent-brief.md))
  gives the subagent everything and nothing more: the failing check ids, the
  exact reproduce command (`run-check <id>`, or a narrower
  `run-check --adhoc <name> --like <id> --cmd "<single test>"`), the log paths
  and lead lines, the files involved, the repo's conventions files, and the
  hard rules verbatim.
- **Subagents** reproduce the failure before changing code, make the
  smallest root-cause fix, re-run the specific check after, and stop to ask
  (through you) when the right behaviour is ambiguous or the fix changes
  product behaviour. They never edit `.ci-green/`, the overrides, or CI
  configuration, and never commit.
- **Hand-back** from each subagent: root cause; change made (files);
  why it is correct; what it re-ran and the result. Reject a hand-back that
  lacks the reproduction or the re-run, or whose change `audit-diff` flags
  without a root-cause justification.
- **Flaky clusters** go through the procedure in
  [references/failure-triage.md](references/failure-triage.md#flaky-tests):
  `run-check <id> --repeat 30 --until-fail` while other checks load the
  machine, find the race, order dependency or shared state, fix it, then
  show many consecutive passes.

Integrate each fix as it lands: check it does not collide with another
cluster's files, then re-run that cluster's checks.

## 5. Verify

When every cluster reports green, re-run the **whole** check set from a clean
state, because fixes cause regressions:

1. Clean build artifacts with the repo's own clean task if it has one;
   otherwise remove only the build and cache outputs the checks produce
   (preview ignored files with `git clean -ndX` and pick from that list;
   never delete untracked source, `.env` files or anything you did not
   create).
2. If a lockfile changed, do a fresh frozen install the way CI does.
3. Confirm the toolchain still matches CI (`run-check` refuses otherwise).
4. Run the full suite under the budget (`run-check --all`, or the slices in
   [Long-running gates](#long-running-gates)). Any failure: back to step 3
   for it. Iterate until one full clean pass.
5. Review the diff:
   ```sh
   git status
   git diff --stat
   "$SKILL_DIR/scripts/audit-diff"
   ```
   Read the full diff yourself as well. Remove leftover debug code,
   unrelated changes and anything violating the hard rules. Each remaining
   `review` finding (snapshot, config, dependency, timeout change) needs its
   one-or-two-sentence justification in the report.

## 6. Report

Use [assets/report-template.md](assets/report-template.md). It must contain:

- every check and its final local status (passed, or no local form and why);
- for each fix: root cause → change → verification (command and result);
- the full-suite run that ended green (command, task count, time);
- toolchain conflicts and any `--allow-toolchain-mismatch` use.

Every fix is on the current branch, for one pull request. Commit and push
only when the user or the repository's instructions ask; then commit
everything on this branch, following the repository's commit conventions.
Stop running services you started (`run-check --stop-services`) unless the
user wants them kept.

## When to stop and ask

Only these. Running the full suite, its duration, pre-existing failures,
hosted CI, toolchains and how to commit are never questions.

- The right behaviour is ambiguous, or a fix would change product behaviour.
- The only fix is a new dependency, a dependency upgrade or downgrade, or a
  change to CI configuration or to a check's thresholds.
- Two full verification passes in a row fail on the same cluster without
  progress.

---
description: Drive every CI workflow — Verify PR, Verify Nightly, Release, Health — to green from one PR, in a loop; survey what is red, fix root causes, push, re-verify, repeat
---

# /ci-workflows-green

Get all four workflows green, and do it in **one pull request** on the current branch:

| Workflow | What red means | Where it runs |
| --- | --- | --- |
| **Verify PR** (`.github/workflows/verify-pr.yml`) | the code is bad | every gate on every PR; `bun verify` runs the same gate on this machine |
| **Verify Nightly** (`.github/workflows/verify-nightly.yml`) | deeper verification of `main` found something | every night on `main`; `bun verify-nightly <group>` runs a group on this machine. Never a merge requirement |
| **Release** (`.github/workflows/deploy.yml`) | releasing `main` fails | every merge to `main`, and `bun deploy` by hand (full verification, then every env) |
| **Health** (`.github/workflows/health.yml`) | the live release is bad | hourly, and `bun health` dispatches it |

Release runs only from `main`; Health also accepts branch dispatches. Release changes ship from `main`, so a fix for them reaches CI only after a
human merges the PR. Agents never merge. The loop therefore ends with a green Verification
on the PR **and** every Release/Health failure reproduced and shown fixed in GitHub Actions.
After the merge it resumes to confirm Release and Health on `main`.

While iterating on Nightly failures, dispatch only the failing group with
`gh workflow run verify-nightly.yml --ref <branch> -f group=<group>`.
A run titled `Verify Nightly · diagnostic <group>` and its
`verify-nightly:diagnostic` status prove only that scope. They never count as a
complete green Nightly run. Finish with the full run (`-f group=all`);
inspect its `verify-nightly:end` verdict. Batch related fixes before pushing so
superseded pull-request runs do less work.

## 1. Survey — what is red, and why

Run all of these every iteration. Never rely on an earlier survey.

```bash
gh pr view --json number,url,headRefName,mergeStateStatus 2>/dev/null   # this branch's PR, if any
gh pr checks 2>/dev/null                                                 # Verification on the PR
gh run list --workflow deploy.yml --limit 3 --json databaseId,headSha,status,conclusion,url
gh run list --workflow health.yml --limit 3 --json databaseId,headSha,status,conclusion,url
gh run list --workflow verify-nightly.yml --limit 3 --json databaseId,headSha,status,conclusion,url
```

For every red run, read the failure itself. Do not guess from the job name.

```bash
gh run view <run-id> --json status,conclusion,jobs
gh run view <run-id> --job <failed-job-id> --log | tail -200
bun obs find <trace/test/mutation id from the log>    # observability comes before new logging
bun obs test '<failing test name>' --source <downloaded-artifact>
```

A Health or Release run that failed *before* the change you are looking at can still be
red for a reason that is already fixed on `main`. Compare `headSha` against `git log origin/main`
before you chase it.

Write down one line per failure, like `workflow · job · root cause · fix`. That list is your
work queue. Group failures that share a root cause.

## 2. Reproduce, then fix

Read the hosted failure first, then use the fastest reproduction that exercises it.
A saved CI failure is valid before-fix evidence when the failure needs hosted execution.
Use a focused check for the repair loop and confirm the affected workflow afterwards:

| Failure in | Reproduce with |
| --- | --- |
| Verify PR (any shard) | `bunx turbo run <task> --filter=<pkg>` or the focused regression for the failure; use hosted logs and the [`ci-green`](../skills/ci-green/SKILL.md) workflow to diagnose it. Artifact, permission and shard failures require their actual workflow path, not just a local full suite |
| Verify Nightly (a group) | `bun verify-nightly <group>` at the commit the run names, with the seed its log printed; pin what it found as a regression so `bun verify` replays it |
| Release, a gate leaf | the same leaf. `//#deploy` runs every `//#verify` leaf first |
| Release, infrastructure or release | a GitHub Actions rehearsal on the branch, reusing the dev job and release lock; AWS trust may block a branch infrastructure apply |
| Health | `bun health` dispatches the branch workflow and its read-only probes |

Fix the root cause the repo's way (see `AGENTS.md`):

- **Every bug gets a verification.** A failure that `bun verify` did not catch means a verification is
  missing. Add the example test (`// regression: <bug-id>`), add
  `libs/tools-harness-ts/goal/known-bugs/<bug-id>.json`, or add a lint rule, so that the next occurrence fails
  Verification instead of Release or Health.
- **Configuration drift** (a revoked key, a stale secret, GitHub settings) is fixed by the
  config-as-code that owns it: `libs/infra-shared-ts/tofu` (infrastructure), the `libs/secrets` registry; repository settings are the OpenTofu bootstrap stack.
  Never fix it with a hand edit in a vendor dashboard. If a fix needs a human, such as a
  credential only they hold, a dashboard with no API, or approval for a destructive or
  production action, stop and ask for exactly that one thing. Keep working the rest of the
  queue meanwhile.
- No retries, skips, `.only`, raised budgets without a measurement, suppressions, or
  deprecated leftovers. A fix that makes CI green by verifying less is not a fix.

## 3. Ship on the one PR

All fixes go on the **current branch** and its single PR. Never open a second PR for
"the release part".

```bash
bun verify                               # required final local gate, once on the final tree
bun run git-sync --message "fix(scope): …"   # commit and push; the PR's Verify runs every gate
```

Then run `/pr-ready`. It opens or updates the PR, syncs with `main`, and drives Verification green.
If it reports a red Verification, return to step 1 with that failure.

## 4. Loop

Repeat steps 1–3 until the survey shows:

- Verification is green on the PR's latest head, and
- every Release/Health failure in the queue was reproduced in GitHub Actions and now passes there.

Stop and report instead of looping when either of these happens:

- two iterations in a row make no progress (same failures, same root causes), or
- the only remaining items need a human (the merge, a credential, a destructive or
  production action).

## 5. After the human merges

The merge is the release: the push to `main` starts Release, which runs full verification
first, then every environment. Watch that run; `bun deploy` re-dispatches it on
`origin/main` only when asked to release again. Do not start a second Release while one is
still going. If `deploy:verify` is red, fix every failure its `verify:end` summary lists
in one batch on a new PR. Then `bun health` runs Health without waiting for
the hourly schedule:

```bash
gh run view <deploy-run-id> --json status,conclusion,jobs
bun health
```

`bun health` releases nothing. If Release or Health is still red on `main`, start again
at step 1 on a new branch from `main`. That is the one case where a second PR is right,
because the first one has merged.

## Report

End with a table, one row per workflow: its final conclusion, the run URL, and one line
per root cause fixed (with its commit). After that, list anything left for a human.

---
description: Drive every CI workflow — Check, Deploy, Health — to green from one PR, in a loop; survey what is red, fix root causes, push, re-verify, repeat
---

# /ci-green

Get all three workflows green, and do it in **one pull request** on the current branch:

| Workflow | What red means | Where it runs |
| --- | --- | --- |
| **Check** (`.github/workflows/check.yml`) | the code is bad | every PR — `bun check` |
| **Deploy** (`.github/workflows/deploy.yml`) | shipping `main` fails | push to `main` — `bun run deploy`, every standard env then production |
| **Health** (`.github/workflows/health.yml`) | the live deployment is bad | hourly — `bun health` for every env |

Deploy and Health only run from `main`, so a fix for them reaches CI only after a
human merges the PR. Agents never merge. The loop therefore ends with a green Check
on the PR **and** every Deploy/Health failure reproduced locally and shown fixed.
After the merge it resumes to confirm Deploy and Health on `main`.

## 1. Survey — what is red, and why

Run all of these every iteration. Never rely on an earlier survey.

```bash
gh pr view --json number,url,headRefName,mergeStateStatus 2>/dev/null   # this branch's PR, if any
gh pr checks 2>/dev/null                                                 # Check on the PR
gh run list --workflow deploy.yml --branch main --limit 3 \
  --json databaseId,conclusion,headSha,createdAt,url
gh run list --workflow health.yml --branch main --limit 3 \
  --json databaseId,conclusion,createdAt,url
```

For every red run, read the failure itself. Do not guess from the job name.

```bash
gh run view <run-id> --log-failed | sed 's/^[^\t]*\t[^\t]*\t//' | grep -v '^\s*$' | tail -200
bun obs find <trace/test/mutation id from the log>    # observability comes before new logging
bun obs test '<failing test name>' --source <downloaded-artifact>
```

A Health or Deploy run that failed *before* the change you are looking at can still be
red for a reason that is already fixed on `main`. Check `headSha` against `git log origin/main`
before you chase it.

Write down one line per failure, like `workflow · job · root cause · fix`. That list is your
work queue. Group failures that share a root cause.

## 2. Reproduce locally, then fix

Every failure gets reproduced by a command before it is fixed, and the same command
shows it fixed afterwards:

| Failure in | Reproduce with |
| --- | --- |
| Check (any shard) | `bun run --filter <pkg> <task>` for the failing task, then `bun check` |
| Deploy, a gate leaf | the same leaf. `//#deploy` runs every `//#check` leaf first |
| Deploy, a deploy step (build, wrangler, migrate) | that package's script with `SECRETS_ENV=dev`, using the dry-run form where one exists (e.g. `wrangler deploy --dry-run`) |
| Health | `bun health` (dev), `bun health:prd` (read-only probes) |

Fix the root cause the repo's way (see `AGENTS.md`):

- **Every bug gets a check.** A failure that `bun check` did not catch means a check is
  missing. Add the example test (`// regression: <bug-id>`), add an entry to
  `libs/tools/goal/known-bugs.json`, or add a lint rule, so that the next occurrence fails
  Check instead of Deploy or Health.
- **Configuration drift** (a revoked key, a stale secret, GitHub settings) is fixed by the
  config-as-code that owns it: `libs/infra/tofu` (infrastructure), the `libs/secrets` registry; repository settings are the OpenTofu bootstrap stack.
  Never fix it with a hand edit in a vendor dashboard. If a fix needs a human, such as a
  credential only they hold, a dashboard with no API, or approval for a destructive or
  production action, stop and ask for exactly that one thing. Keep working the rest of the
  queue meanwhile.
- No retries, skips, `.only`, raised budgets without a measurement, suppressions, or
  deprecated leftovers. A fix that makes CI green by checking less is not a fix.

## 3. Ship on the one PR

All fixes go on the **current branch** and its single PR. Never open a second PR for
"the deploy part".

```bash
bun check                       # the whole gate, locally, before every push
bun run git-sync --message "fix(scope): …"
```

Then run `/pr-ready`. It opens or updates the PR, syncs with `main`, and drives Check green.
If it reports a red Check, return to step 1 with that failure.

## 4. Loop

Repeat steps 1–3 until the survey shows:

- Check is green on the PR's latest head, and
- every Deploy/Health failure in the queue was reproduced locally and now passes locally.

Stop and report instead of looping when either of these happens:

- two iterations in a row make no progress (same failures, same root causes), or
- the only remaining items need a human (the merge, a credential, a destructive or
  production action).

## 5. After the human merges

The merge triggers Deploy. Watch it, then run Health once so you are not waiting for the
hourly schedule:

```bash
gh run watch "$(gh run list --workflow deploy.yml --branch main --limit 1 --json databaseId --jq '.[0].databaseId')" --exit-status
gh workflow run health.yml --ref main
gh run watch "$(gh run list --workflow health.yml --branch main --limit 1 --json databaseId --jq '.[0].databaseId')" --exit-status
```

`health.yml` deploys nothing, so dispatching it is safe. **Never** dispatch `deploy.yml`
yourself. If Deploy or Health is still red on `main`, start again at step 1 on a new branch
from `main`. That is the one case where a second PR is right, because the first one has merged.

## Report

End with a table, one row per workflow: its final conclusion, the run URL, and one line
per root cause fixed (with its commit). After that, list anything left for a human.

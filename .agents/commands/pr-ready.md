---
description: Sync the current branch with main, commit, push, and drive the PR checks green
---

# /pr-ready

Take the current branch from "changes exist" to "PR is green and mergeable". Run
it once per logical unit of work (a completed fix, feature, or review pass) —
not after every keystroke or file save.

The repo is PR-first: `bun check:full` runs in GitHub Actions on the PR
(`.github/workflows/pr.yml`, one job named `check:full`), and deploying happens
on `main` (`.github/workflows/deploy.yml`), never from this branch. Your job is
to make the branch mergeable, not to prove it locally.

## Core rules (read first)

- **PR CI owns the checks.** Never run `bun check:full`, `bun check`, or any
  `bun deploy*` here. Local verification is `bun fmt` plus per-package `tc` /
  `test` for the packages this branch actually touches.
- **Never make a check pass by weakening it.** Deleting or skipping tests
  (`.skip`, `.only`, commenting out), loosening assertions, `@ts-ignore` /
  `@ts-expect-error` / `as any`, disabling lint rules (inline or in config), or
  editing the check scripts are all forbidden. If a check itself looks wrong,
  stop and report it.
- **Never rewrite history.** No `--amend` on pushed commits, no `--force`, no
  `--force-with-lease`, no `--no-verify`. Sync with `main` by merging.
- **Run steps individually** — do not chain them with `&&` and do not use
  `clear`; you need to see exactly which step failed.
- **Escalate instead of thrashing.** Each retry must test a *new* root-cause
  hypothesis. After three consecutive attempts with no new hypothesis, stop and
  report.

## 1. Pre-flight

```sh
git status --porcelain
git branch --show-current
gh auth status
```

- On `main`, stop: this command works on a feature branch that will become a PR.
- If the tree has pending changes you did not make and cannot explain, stop and
  report — do not fold them into this run.
- If `gh auth status` fails, stop: every remaining step needs GitHub.

## 2. Sync with base

```sh
git fetch origin main
git merge --no-edit origin/main
```

Merge, never rebase — this repo does not rewrite pushed history, and `main`
history is merge-based. If the merge conflicts: resolve it by understanding both
sides (never by discarding the incoming change wholesale), commit the merge, and
continue to step 3.

## 3. Local verification (cheap by design)

```sh
bun fmt
bunx biome check --error-on-warnings .
git diff --name-only origin/main...HEAD
```

For every workspace touched by that file list (`apps/*`, `libs/*`, `pkgs/*`,
`tools`), run:

```sh
bun run --filter <pkg> tc
bun run --filter <pkg> test
```

Do not run package tests for untouched packages, and do not run the repo-wide
suite. If a package has no `test` script, `tc` alone is enough for it.

On failure: read the output, form a hypothesis, fix the cause, re-run the
failing command. Remember the port rule while testing — EMQX
(`1883`/`8083`/`18083`), the e2e harness ports (`4177`/`4178`) and the wrangler
preview (`8788`) are machine-wide singletons shared with other workspaces.

## 4. Commit

```sh
git add -A
git status          # review what is being committed
git diff --staged   # sanity-check the diff matches the intended change
```

Commit message rules:

- Conventional Commits: `feat`, `fix`, `refactor`, `test`, `chore`, `docs`,
  `perf`, `ci`. Pick the type from the dominant change, not the last file
  touched.
- Imperative summary, ≤ 72 chars, no trailing period.
- Body only when the *why* is not obvious from the diff.
- One commit per logical change. If the work spans several independent changes,
  stage and commit them separately rather than producing one omnibus commit.

```sh
git commit -m "<type>(<scope>): <summary>"
```

Do not commit unrelated files. Do not create an empty commit. Never
`--no-verify`, never `--amend`.

## 5. Push and open/update the PR

```sh
git push -u origin "$(git branch --show-current)"
gh pr view --json number,url >/dev/null 2>&1 || gh pr create --base main --fill
```

Then make the PR legible:

```sh
gh pr edit --title "<type>(<scope>): <summary>"
gh pr edit --body "<what changed and why>

Checks: \`bun check:full\` (PR CI)"
```

## 6. Drive the checks green

```sh
gh pr checks --watch
```

`--watch` exits non-zero as soon as a check fails. Then:

```sh
gh run list --branch "$(git branch --show-current)" --limit 1 --json databaseId,conclusion
gh run view <databaseId> --log-failed
```

Diagnose the failing leaf from the log (`tc`, `test`, `lint:eslint`,
`ci:depcruise`, a scoped `test:contract`, …), fix the root cause, return to
step 3, push, and watch again. Repeat until every check passes.

If the failure is in a leaf you cannot reproduce locally (the CI-only
`@tools#check:static`, or a contract test whose sidecar ports are busy in this
workspace), say so in the report rather than guessing.

## 7. Stop and report when

- a required human decision or missing credential blocks progress
- a check is genuinely wrong (report it — do not edit the check)
- three consecutive attempts produced no new root-cause hypothesis
- the PR needs a reviewer decision, not more code

Use this template:

```
❌ PR not ready.
Branch: <branch>
Failing step: <fmt | biome | <pkg> tc | <pkg> test | check:full (CI)>
PR: <url | none>
Error: <exact key output>
Attempts: <what you tried, in order>
Hypothesis: <most likely root cause>
Needs: <what a human should decide or provide>
```

## 8. Report when done

- PR URL and final commit list (`git log --oneline origin/main..HEAD`)
- `gh pr checks` summary (every check green)
- What is *not* verified: deployment. `main` runs the dev rehearsal canary and
  then prod via `.github/workflows/deploy.yml` after merge — nothing is deployed
  from this branch.
- Any flaky tests, warnings, or marginal calls a human should look at.

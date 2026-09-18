---
description: Take the current branch to a green, mergeable PR — sync, verify, commit, push, address review feedback, and drive CI green
---

# /pr-ready

Take the current branch from "changes exist" to "PR is green and mergeable". Run
it once per logical unit of work (a completed fix, feature, or review pass) —
not after every keystroke or file save.

The repo is PR-first: `bun check` runs in GitHub Actions on the PR
(`.github/workflows/pr.yml`, one job named `check`), and deploying happens
on `main` (`.github/workflows/deploy.yml`), never from this branch. Your job is
to make the branch mergeable.

## Core rules (read first)

- **PR CI owns the gate.** `bun check` is the whole check surface and the same
  suite CI runs; you may run it locally, but while iterating prefer `bun fmt`
  plus per-package `tc` / `test` for the packages this branch actually touches.
  Never run any `bun deploy*` here.
- **Never make a check pass by weakening it.** Deleting or skipping tests
  (`.skip`, `.only`, commenting out), loosening assertions, `@ts-ignore` /
  `@ts-expect-error` / `as any`, disabling lint rules (inline or in config), or
  editing the check scripts are all forbidden. If a check itself looks wrong,
  stop and report it.
- **Never merge the PR.** Agents may create or update the PR, push commits, and
  watch checks, but never run `gh pr merge`, never enable auto-merge or the
  merge queue, and never merge through any other GitHub UI/API path. A green PR
  is the finish line: stop and hand the merge decision to a human.
- **The PR body is a contract.** Every PR fills
  `.github/pull_request_template.md` completely — no empty section, no unchecked
  box, no deleted checklist line. `//#ci:pr-template` enforces it in PR CI and
  re-runs on body edits; never weaken the template or the checker to pass it.
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

Then write the PR body from `.github/pull_request_template.md`. The body is a
contract: `//#ci:pr-template` (part of `//#check`) fails the PR when a `##`
section is missing, empty, or a checklist box is unchecked, and it re-runs when
the body is edited. Write the filled body to a file — do not paste a section
list by hand — keeping every heading and every checklist line exactly as the
template has them, replacing the HTML comments with real content:

```sh
gh pr edit --title "<type>(<scope>): <summary>" --body-file /tmp/pr-body.md
bun run ci:pr-template      # local self-check; also enforced by PR CI
```

- `Summary` / `Why` / `Scope` / `Verification` / `Risk` / `Provenance`: real
  content, no placeholders left. `Verification` names the surface you actually
  exercised and what the PR does *not* prove.
- Checklist: check a box only when it is true. If an item genuinely does not
  apply, say so under `Verification` and check it — do not delete the line.
- Never edit `.github/pull_request_template.md`, `tools/scripts/check-pr-body.ts`,
  or the checklist text to make the gate pass.

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

If the failing leaf is `//#ci:pr-template`, the fix is the PR body (step 5), not
the checker: fill the missing section, write the missing content, or check the
box that is actually true.

## 7. Resolve review feedback when present

Read the review comments — top-level **and** inline:

```sh
gh pr view --comments
gh api repos/crvouga/gamezilla/pulls/<N>/comments --paginate
```

The second call matters: `gh pr view --comments` does **not** include inline code
comments. Together they give you every comment, with the file, line range and
side baked in.

Triage each comment as exactly one of: **change** (the reviewer is right),
**reply** (they are wrong, or it is a judgement call that needs a human), or
**already done** (the branch already covers it — reply with the commit or file
that proves it). Never guess on a judgement call; leave it for a human.

For accepted changes, verify with the touched packages' `tc` / `test`, commit one
logical change per review unit, and push:

```sh
bun fmt
git add -A
git commit -m "<type>(<scope>): <what the comment asked for>"
git push
```

Reference the comment being addressed in the commit body (comment URL or
`review comment <id>`). Reply where a change is not the right answer:

```sh
gh api --method POST repos/crvouga/gamezilla/pulls/<N>/comments/<comment_id>/replies -f body="<why not>"
```

Keep replies to the point: what you did instead, or the evidence that the current
behaviour is intended. Then return to step 6 and watch the checks again.

## 8. Stop and report when

- a required human decision or missing credential blocks progress
- a check is genuinely wrong (report it — do not edit the check)
- three consecutive attempts produced no new root-cause hypothesis
- the PR needs a reviewer decision, not more code

Use this template:

```
❌ PR not ready.
Branch: <branch>
Failing step: <fmt | biome | <pkg> tc | <pkg> test | check (CI)>
PR: <url | none>
Error: <exact key output>
Attempts: <what you tried, in order>
Hypothesis: <most likely root cause>
Needs: <what a human should decide or provide>
```

## 9. Report when done

- PR URL, final commit list (`git log --oneline origin/main..HEAD`), and merge
  state: **green and awaiting a human merge** — this command never merges.
- `gh pr checks` summary (every check green).
- Per review comment: changed (with commit) vs replied (with reason) vs already
  covered.
- What is *not* verified: deployment. `main` runs the dev rehearsal canary and
  then prod via `.github/workflows/deploy.yml` after a human merges — nothing is
  deployed from this branch.
- Any flaky tests, warnings, or marginal calls a human should look at.

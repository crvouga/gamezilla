---
description: Take the current branch to a green, conflict-free, review-complete PR — sync with main, resolve conflicts, commit, push, drive CI green, and address review feedback without merging
---

# /pr-ready

Take the current branch from "changes exist" to "PR is green and mergeable". Run
it once per logical unit of work (a completed fix, feature, or review pass) —
not after every keystroke or file save.

The repo is PR-first: `bun check` runs in GitHub Actions on the PR
(`.github/workflows/pr.yml`, one job named `check`), and deploying happens
on `main` (`.github/workflows/deploy.yml`), never from this branch. Your job is
to make the branch mergeable **and conflict-free**, not to merge it.

## Core rules (read first)

- **PR CI owns the gate.** `bun check` is the whole check surface and the same
  suite CI runs; you may run it locally, but while iterating prefer `bun fmt`
  plus affected-package `tc` / `test` for the packages this branch actually
  touches. Never run any `bun deploy*` here.
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
  `.github/PULL_REQUEST_TEMPLATE.md` completely — no empty section, no unchecked
  box, no deleted checklist line. `//#ci:pr-template` enforces it in PR CI and
  re-runs on body edits; never weaken the template or the checker to pass it.
- **Never rewrite history.** No `--amend` on pushed commits, no `--force`, no
  `--force-with-lease`, no `--no-verify`. Sync with `main` by merging.
- **Automate the mechanics.** Branch/PR state, `main` sync, conflict detection,
  formatting, affected-package checks, the template check, CI log collection,
  check polling, and review-comment retrieval are script/CLI work. Never burn a
  turn on them by hand.
- **Push and sync continuously.** After every local commit or merge commit, push
  it to `origin/$BRANCH` before continuing. Before reporting success, the working
  tree must be clean and local `HEAD` must equal `origin/$BRANCH`; never leave
  local commits, staged files, or untracked files unsynced.
- **Spend an agent only where judgement is required** — a commit message, a
  merge conflict, a semantic CI failure, or a review comment that needs a
  decision. Nothing else.
- **Run steps individually** — do not chain them with `&&` and do not use
  `clear`; you need to see exactly which step failed.
- **Escalate instead of thrashing.** Each retry must test a *new* root-cause
  hypothesis. After three consecutive attempts with no new hypothesis, stop and
  report.

## Where agents are allowed

| Work | Surface |
|---|---|
| Commit message | Agent receives the staged diff, returns one Conventional Commit title/body. It does not edit files or run commands. |
| Merge conflict | Agent resolves only the listed unmerged paths, stages them, and reports ambiguity. No commit, push, or unrelated refactor. |
| CI failure | Agent receives the failing leaf plus its log, states one hypothesis, fixes only that cause. No check weakening, no commit, no push. |
| Review judgement | Agent only for semantic disagreement or an ambiguous requested change. Retrieval and mechanical replies stay scripted. |

Everything else — polling, listing files, formatting, editing the PR body from
facts, posting evidence-based replies — you do directly with the commands below.

## 1. Pre-flight

```sh
BRANCH="$(git branch --show-current)"
git status --porcelain
git diff --stat
git diff --name-status
gh auth status
```

- On `main`, stop: this command works on a feature branch that will become a PR.
- If the tree has pending changes you did not make and cannot explain, stop and
  report — do not fold them into this run.
- If `gh auth status` fails, stop: every remaining step needs GitHub.

## 2. Sync with base

```sh
git fetch --prune origin main
git merge --no-edit origin/main
```

Merge, never rebase — this repo does not rewrite pushed history, and `main`
history is merge-based.

### Resolving merge conflicts

If the merge exits non-zero, collect the conflict set mechanically before
involving anyone:

```sh
git diff --name-only --diff-filter=U
git diff --cc
```

Hand those exact paths to a conflict agent with this contract:

> Resolve every listed conflict by understanding both the current branch and
> `origin/main` versions — never by discarding the incoming change wholesale.
> Preserve both behaviours when they are compatible; follow the repository's
> current pattern when they are not. Inspect the stage 2 / stage 3 blobs when a
> hunk is unclear. Do not rewrite unrelated code, do not run broad checks, do
> not commit, do not push. Remove every conflict marker, stage only the paths
> you resolved, and report anything genuinely ambiguous instead of guessing.

Then verify the result is a real merge, push it immediately, and prove the
remote branch contains the merge before continuing:

```sh
test -z "$(git diff --name-only --diff-filter=U)"
git diff --check
GIT_EDITOR=true git merge --continue
git push -u origin "$BRANCH"
git fetch origin "$BRANCH"
test "$(git rev-parse HEAD)" = "$(git rev-parse "origin/$BRANCH")"
```

Keep Git's generated merge message; do not spend an agent renaming it. Any
conflict the agent cannot resolve without a product decision goes to the stop
template in step 8. Continue to step 3.

## 3. Local verification (cheap by design)

```sh
bun fmt
bun run lint:biome
git diff --check
```

Immediately inspect the result of `bun fmt`:

```sh
git status --short
```

If formatting changed files, review and commit them through step 4, push the
commit, fetch `origin/$BRANCH`, and prove local `HEAD` equals the remote branch
before running the affected checks. Never continue with formatter changes that
exist only in the working tree.

Then run the affected packages without enumerating them by hand —
`TURBO_AFFECTED_BASE` makes the checked-in Turbo runner select changed
workspaces and their dependents:

```sh
TURBO_AFFECTED_BASE=origin/main bun run libs/tools/scripts/turbo-ci-run.ts tc test
```

If you need the file list behind that selection:

```sh
git diff --name-only origin/main...HEAD
```

Do not run the repo-wide suite; GitHub runs the full gate in step 6. If a
package task fails: read the output, form a hypothesis, fix the cause, re-run
the same command. Remember the port rule while testing — EMQX
(`1883`/`8083`/`18083`), the e2e harness ports (`4177`/`4178`) and the wrangler
preview (`8788`) are machine-wide singletons shared with other workspaces.

## 4. Commit

Inspect the whole diff before staging anything:

```sh
git status --short
```

Do not use `git add -A` until that status is known to contain only this work.
Stage the logical unit, then review what you staged:

```sh
git add <reviewed paths>
git diff --cached --stat
git diff --cached
```

Give the **staged diff** to the commit-message agent and use its output verbatim
in the commit:

```sh
git commit -m "<type>(<scope>): <summary>"
```

Commit message rules (state them in the agent request if you want them applied):

- Conventional Commits: `feat`, `fix`, `refactor`, `test`, `chore`, `docs`,
  `perf`, `ci`. Pick the type from the dominant change, not the last file
  touched.
- Imperative summary, ≤ 72 chars, no trailing period.
- Body only when the *why* is not obvious from the diff.
- One commit per logical change. If the work spans several independent changes,
  stage and commit them separately rather than producing one omnibus commit.

Do not commit unrelated files. Do not create an empty commit. Never
`--no-verify`, never `--amend`.
After every non-merge commit, push before doing anything else and prove the
remote tracking branch contains exactly that commit:

```sh
git push -u origin "$BRANCH"
git fetch origin "$BRANCH"
test "$(git rev-parse HEAD)" = "$(git rev-parse "origin/$BRANCH")"
test -z "$(git status --porcelain=v1)"
```

## 5. Push and open/update the PR

```sh
git push -u origin "$BRANCH"
gh pr view --json number,url >/dev/null 2>&1 || gh pr create --base main --fill
PR_NUMBER="$(gh pr view --json number --jq .number)"
PR_REPO="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"
gh pr view "$PR_NUMBER" --json mergeable,mergeStateStatus,isDraft,reviewDecision
```

Then write the PR body from `.github/PULL_REQUEST_TEMPLATE.md`. The body is a
contract: `//#ci:pr-template` (part of `//#check`) fails the PR when a `##`
section is missing, empty, or a checklist box is unchecked, and it re-runs when
the body is edited. Start from the template file rather than retyping it:

```sh
BODY_FILE="$(mktemp -t pr-ready-body.XXXXXX.md)"
cp .github/PULL_REQUEST_TEMPLATE.md "$BODY_FILE"
```

Replace the HTML comments with real content, keeping every heading and every
checklist line exactly as the template has them:

```sh
gh pr edit --title "<type>(<scope>): <summary>" --body-file "$BODY_FILE"
```

- `Summary` / `Why` / `Scope` / `Verification` / `Risk` / `Provenance`: real
  content, no placeholders left. `Verification` names the surface you actually
  exercised and what the PR does *not* prove.
- Checklist: check a box only when it is true. Before the first remote run, the
  CI box is the only one allowed to stay unchecked — the remote gate has not run
  yet. Never claim `bun check` is green in `Verification` on the strength of a
  local affected-package run.
- Once the remote gate passes, check the CI box, update the body, and validate
  the contract locally before watching again:

```sh
bun run ci:pr-template      # local self-check; also enforced by PR CI
```

- An item that genuinely does not apply: say so under `Verification` and check
  it — do not delete the line.
- Never edit `.github/PULL_REQUEST_TEMPLATE.md`, `libs/tools/scripts/check-pr-body.ts`,
  or the checklist text to make the gate pass.

## 6. Drive the checks green

```sh
gh pr checks "$PR_NUMBER" --watch
```

`--watch` exits non-zero as soon as a check fails. Collect the failing run and
its logs — never an agent's guess at what CI said:

```sh
gh run list --branch "$BRANCH" --limit 5 --json databaseId,status,conclusion,url,headSha
RUN_ID="$(gh run list --branch "$BRANCH" --limit 1 --json databaseId --jq '.[0].databaseId')"
gh run view "$RUN_ID" --log-failed > /tmp/pr-ready-ci.log
```

Mechanical failures you handle yourself:

- `//#ci:pr-template`: fix the PR body (step 5) — fill the missing section, write
  the missing content, or check the box that is actually true. Do not touch code
  or the checker.
- Stale or cancelled run: push the already-tested commit and watch the new run.
- Failure in a leaf you cannot reproduce locally (the CI-only
  `@libs/tools#check:static`, or a contract test whose sidecar ports are busy in
  this workspace): say so in the report rather than guessing.
- Auth, secrets, hosted-runner, or missing-sidecar failure: record the exact log
  and stop if it is not repairable from this branch.

For a reproducible code or test failure, hand `/tmp/pr-ready-ci.log` plus the
failing leaf to **one** CI-failure agent:

> Diagnose the exact failure from this log. State one root-cause hypothesis and
> fix only that cause. Preserve every check and assertion — no skips, no
> suppressions, no loosened expectations, no CI edits. Do not commit, do not
> push, do not touch unrelated files. Return the changed paths and the focused
> command that verifies the fix.

If the failure reproduces locally, the existing bounded healer captures the same
output and invokes that agent for you:

```sh
bun run check:heal -- --max-iterations 1
```

After any fix: return to step 3, commit through the commit-message agent, push,
and watch a fresh run. Never re-run the same failed commit without a new
hypothesis. Stop after three attempts with no new root cause and report the leaf
and log.

If CI reveals the branch is behind or `mergeable` is `CONFLICTING`, go back to
step 2, sync again, resolve with the conflict agent, re-verify, and push. A
branch that was current when you pushed can fall behind while CI runs.

## 7. Resolve review feedback when present

Read every review surface — top-level issue comments, reviews, and inline code
comments are three different endpoints:

```sh
gh pr view "$PR_NUMBER" --comments
gh api --paginate "repos/$PR_REPO/pulls/$PR_NUMBER/reviews"
gh api --paginate "repos/$PR_REPO/pulls/$PR_NUMBER/comments"
gh api --paginate "repos/$PR_REPO/issues/$PR_NUMBER/comments"
```

The inline-comment call matters: `gh pr view --comments` does **not** include
inline code comments. Together these give you every comment, with the file, line
range and side baked in. List unresolved threads too:

```sh
gh api graphql -f query='query($owner:String!,$name:String!,$number:Int!){repository(owner:$owner,name:$name){pullRequest(number:$number){reviewThreads(first:100){nodes{id isResolved comments(first:1){nodes{url}}}}}}}' \
  -f owner="${PR_REPO%/*}" -f name="${PR_REPO#*/}" -F number="$PR_NUMBER"
```

Triage each comment as exactly one of: **change** (the reviewer is right),
**reply** (they are wrong, or it is a judgement call that needs a human),
**already done** (the branch already covers it — reply with the commit or file
that proves it), or **human decision** (two valid behaviours; stop and ask).
Never guess on a judgement call.

For accepted changes, verify with the touched packages' checks (step 3), commit
one logical change per review unit, and push:

```sh
bun fmt
TURBO_AFFECTED_BASE=origin/main bun run libs/tools/scripts/turbo-ci-run.ts tc test
git add <reviewed paths>
git commit -m "<agent message for this review unit>"
git push -u origin "$BRANCH"
git fetch origin "$BRANCH"
test "$(git rev-parse HEAD)" = "$(git rev-parse "origin/$BRANCH")"
test -z "$(git status --porcelain=v1)"
```

Reference the comment being addressed in the commit body (comment URL or
`review comment <id>`). Reply where a change is not the right answer:

```sh
gh api --method POST "repos/$PR_REPO/pulls/$PR_NUMBER/comments/<comment_id>/replies" -f body="<why not>"
```

Keep replies to the point: what you did instead, or the evidence that the current
behaviour is intended. Only after the requested change is present **and** the
reply is posted, resolve that exact thread:

```sh
gh api graphql -f query='mutation($threadId:ID!){resolveReviewThread(input:{threadId:$threadId}){thread{isResolved}}}' -f threadId="$THREAD_ID"
```

Never resolve a thread to make the PR look clean, and never claim a comment is
addressed when it is merely unread. Then return to step 6 and watch the checks
again — review commits invalidate earlier CI and mergeability results.

## 8. Stop and report when

- a merge conflict needs a product decision the agent cannot make
- a required human decision or missing credential blocks progress
- a check is genuinely wrong (report it — do not edit the check)
- three consecutive attempts produced no new root-cause hypothesis
- the PR needs a reviewer decision, not more code
- `reviewDecision` is `CHANGES_REQUESTED`, or required approvals are missing

Use this template:

```
❌ PR not ready.
Branch: <branch>
PR: <url | none>
Failing step: <fmt | biome | <pkg> tc | <pkg> test | merge conflict | check (CI) | review>
Failing leaf or files: <exact name>
Error: <exact key output>
Log: <path when collected from CI>
Attempts: <what you tried, in order>
Hypothesis: <most likely root cause>
Needs: <what a human should decide or provide>
```

### Final synchronization gate — mandatory

Never report success until this gate passes. It is the last operation after all
code, formatting, review, and CI work:

```sh
git fetch --prune origin main
git merge --no-edit origin/main
```

If this merge conflicts, return to §2 and use the conflict agent. If it creates
a merge commit, return to §3, push it immediately, and rerun §6; the new merge
commit is not verified until the PR check passes again.

After the merge is clean and all required checks are green:

```sh
git push -u origin "$BRANCH"
git fetch origin "$BRANCH"
test -z "$(git status --porcelain=v1)"
test -z "$(git diff --cached --name-only)"
test "$(git rev-parse HEAD)" = "$(git rev-parse "origin/$BRANCH")"
test "$(git rev-list --left-right --count "origin/$BRANCH"...HEAD)" = "0 0"
gh pr view "$PR_NUMBER" --json mergeable,mergeStateStatus,isDraft,reviewDecision
```

The `git rev-list` assertion must pass (`0 0`); any other result means the
branch is unsynced and must be pushed or repaired before continuing.
The working tree must print nothing, `mergeable` must be `MERGEABLE`, and
`mergeStateStatus` must not be `BEHIND` or `CONFLICTING`. If GitHub reports
`UNKNOWN`, poll again; never report success while it reports `CONFLICTING`.

## 9. Report when done

- PR URL, final commit list (`git log --oneline origin/main..HEAD`), and merge
  state: **green, conflict-free, review-complete, and awaiting a human merge** —
  this command never merges.
- `gh pr checks` summary (every check green) plus
  `gh pr view --json mergeable,mergeStateStatus,isDraft,reviewDecision`.
- Conflicts: what `origin/main` brought in, which paths conflicted, and how each
  was resolved (or which reached a human).
- Per review comment: changed (with commit) vs replied (with reason) vs already
  covered vs awaiting a human decision, and which threads are resolved.
- What is *not* verified: deployment. `main` runs the dev rehearsal canary and
  then prod via `.github/workflows/deploy.yml` after a human merges — nothing is
  deployed from this branch.
- Any flaky tests, warnings, or marginal calls a human should look at.

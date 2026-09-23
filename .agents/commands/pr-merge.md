---
description: Take the current branch to a green, conflict-free, review-complete PR and merge it — pass `bun check` locally, commit, sync with main, resolve conflicts, push, drive CI green, address review feedback, then merge once every check passes
---

# /pr-merge

Take the current branch from "changes exist" to "PR is green and merged". Run
it once per logical unit of work (a completed fix, feature, or review pass) —
not after every keystroke or file save.

The repo is PR-first: `bun check` runs in GitHub Actions on the PR
(`.github/workflows/pr.yml`, one job named `check`), and deploying happens
on `main` (`.github/workflows/deploy.yml`), never from this branch. Your job is
to make the branch mergeable **and conflict-free**, then merge it once every
check passes (step 9).

**Loop until the goal is reached.** The goal is a green, conflict-free,
review-complete, merged PR. Every problem between here and there — a failing leaf, a
merge conflict, a red CI run, a review comment — is yours to fix, whoever
introduced it: fix it, re-verify, and go around again. Do not stop at the first
failure to report it; stop only when you are genuinely stuck (step 8). And
never reach the goal by degrading anything: a check passes because the code is
right, never because the test or the code got weaker.

The order is fixed: **`bun check` passes locally first** (step 2), then the
work is committed (step 3), and only then is the branch synced with `main`
(step 4), pushed and put up as a PR (step 5), watched on CI (step 6), and
merged only after the final synchronization gate passes (step 9). Nothing
reaches the remote until the local gate is green.

## Core rules (read first)

- **`bun check` passes locally before anything is synced or pushed.** It is
  the whole check surface and the same suite PR CI runs. Turbo caches every
  leaf locally and remotely, so a re-run only pays for what changed — run it,
  fix what fails, and run it again until it is green. While fixing a single
  failure, iterate on that leaf (`bun fmt`, the failing package's `tc` /
  `test`), then confirm with a full `bun check`. Never run any `bun deploy*`
  here.
- **Fix, never nerf.** A check passes because the code is right. Forbidden, no
  matter how stuck: deleting or skipping tests (`.skip`, `.only`, commenting
  out), loosening or removing assertions, raising timeouts to hide slowness,
  `@ts-ignore` / `@ts-expect-error` / `as any`, disabling lint rules (inline or
  in config), weakening check scripts, removing a check from the gate, and
  degrading product code (dropping a feature, swallowing an error, stubbing
  behaviour) to get past a failure. Updating a test's expectation is allowed
  only when the code change behind it is intentional and correct, and the test
  stays exactly as strict (e.g. adding a newly required leaf to an expected
  list) — say so in the commit body.
- **Merge only a fully green PR.** Merge with `gh pr merge --merge` (merge
  commits are the only method this repo allows) and only after the final
  synchronization gate (step 8) passes: every check green on the current
  `HEAD`, `mergeable` is `MERGEABLE`, and no review requests changes. Pin the
  merge to the verified commit with `--match-head-commit`. Never `--admin`,
  never bypass branch protection, never enable auto-merge or the merge queue,
  and never merge a PR whose checks are pending, skipped or red.
- **The PR body follows the template.** Every PR fills
  `.github/PULL_REQUEST_TEMPLATE.md` — every section, checklist lines kept, a
  box checked only when true. CI does not check the body, so keep it honest.
- **Never rewrite history.** No `--amend` on pushed commits, no `--force`, no
  `--force-with-lease`, no `--no-verify`. Sync with `main` by merging.
- **Automate the mechanics.** Branch/PR state, `main` sync, conflict detection,
  formatting, the local `bun check` gate, the template check, CI log collection,
  check polling, and review-comment retrieval are script/CLI work. Never burn a
  turn on them by hand.
- **Push and sync continuously, always through `/git-sync`.** Every push and
  every sync with trunk is `bun run git-sync` (`.agents/commands/git-sync.md`).
  It pushes the branch, merges the latest `origin/main`, pushes the merge,
  fast-forwards local `main`, and verifies that `HEAD` equals `origin/$BRANCH`
  on a clean tree. Never hand-run `git fetch` / `git merge origin/main` /
  `git push`. Run it after every local commit or merge commit before
  continuing. Before reporting success, never leave local commits, staged
  files, or untracked files unsynced.
- **Spend an agent only where judgement is required** — a commit message, a
  merge conflict, a semantic CI failure, or a review comment that needs a
  decision. Nothing else.
- **Run steps individually** — do not chain them with `&&` and do not use
  `clear`; you need to see exactly which step failed.
- **Loop, but don't thrash.** Keep going for as long as each attempt tests a
  *new* root-cause hypothesis — there is no cap on attempts that make progress.
  You are stuck only after three consecutive attempts with no new hypothesis,
  or when the next step needs a human (step 8); then stop and report.

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
- **Always ship into the current branch's PR.** If the branch already has an
  open PR, this run's work goes onto that PR — even when it is a different
  logical unit from what the PR started as. Never split work onto a new branch
  or open a second PR, and never ask whether to; widen the existing PR's title
  and rewrite its body to cover it instead (step 5).
- Pending changes you did not make (another session's work on this branch) are
  part of the branch: they ship with this PR, and any problem they cause is
  yours to fix like any other. Commit them as their own logical units (step 3)
  rather than folding them into your commits.
- If `gh auth status` fails, stop: every remaining step needs GitHub.

## 2. Local gate: `bun check` green

Format first, and inspect what the formatter touched:

```sh
bun fmt
git status --short
```

Then run the whole gate — the same leaf set PR CI runs:

```sh
bun check
```

`bun check` goes through `secrets-run`, which reads the offline secrets cache;
if it reports the cache missing, run `bun run secrets:pull` once and retry.
Remember the port rule while it runs — EMQX (`1883`/`8083`/`18083`) and the
wrangler preview (`8788`) are machine-wide singletons shared with other workspaces; a contract leaf that
fails only because another workspace holds its port is reported, not "fixed".

If a leaf fails: read its output, state one root-cause hypothesis, fix that
cause, iterate on the failing leaf alone, then run `bun check` again — and keep
looping until it exits 0. A
reproducible failure can go through the bounded healer, which captures the same
output and invokes the CI-failure agent (step 6 contract) for you:

```sh
bun run check:heal -- --max-iterations 1
```

A failure caused by changes this run did not make (another session's work in
the tree) is still yours to fix — find the real cause and fix it the same way.
Do not continue to step 3 until `bun check` exits 0 on the tree you are about
to commit.

## 3. Commit

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
`--no-verify`, never `--amend`. Only commit a tree that just passed step 2.
Once the tree is clean, go straight to step 4. Its `git-sync` pushes these
commits and verifies the remote before it touches trunk.

## 4. Sync with base

```sh
bun run git-sync --leave-conflicts
```

This one call pushes the branch, merges the latest `origin/main`, pushes the
merge, fast-forwards local `main`, and verifies that `HEAD` equals
`origin/$BRANCH` on a clean tree. It merges and never rebases, because this
repo does not rewrite pushed history and `main` history is merge-based. Sync
only after step 2 is green and step 3 has committed that work.

### Resolving merge conflicts

If `git-sync` reports a conflict, the merge is left in progress. Collect the
conflict set mechanically before involving anyone:

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

Then verify the result is a real merge, conclude it, and sync again. That
pushes the merge and verifies the remote:

```sh
test -z "$(git diff --name-only --diff-filter=U)"
git diff --check
GIT_EDITOR=true git merge --continue
bun run git-sync --leave-conflicts
```

Keep Git's generated merge message; do not spend an agent renaming it. Any
conflict the agent cannot resolve without a product decision goes to the stop
template in step 8.

If the merge brought anything in from `main` (`git-sync` printed
`merged origin/main.`, conflicted or not), the merged tree is unverified: return to step 2 and get `bun check` green
on it — Turbo's cache keeps the re-run to the leaves `main` actually changed —
then commit any fix (step 3) and push before continuing. Continue to step 5
only when the merged tree has passed `bun check`.

## 5. Push and open/update the PR

```sh
bun run git-sync --leave-conflicts
gh pr view --json number,url >/dev/null 2>&1 || gh pr create --base main --fill
PR_NUMBER="$(gh pr view --json number --jq .number)"
PR_REPO="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"
gh pr view "$PR_NUMBER" --json mergeable,mergeStateStatus,isDraft,reviewDecision
```

When the PR already exists, rewrite its body to describe the PR as a whole —
fold this run's work into the existing points instead of appending per-run
bullets, and drop anything no longer true. As the PR grows, raise the altitude
rather than the bullet count: merge related changes into one broader bullet.
Retitle only if the old title no longer describes the PR.

Otherwise write the PR body from `.github/PULL_REQUEST_TEMPLATE.md`. Start from
the template file rather than retyping it:

```sh
BODY_FILE="$(mktemp -t pr-merge-body.XXXXXX.md)"
cp .github/PULL_REQUEST_TEMPLATE.md "$BODY_FILE"
```

Replace the HTML comments with real content, keeping every heading and every
checklist line exactly as the template has them:

```sh
gh pr edit --title "<type>(<scope>): <summary>" --body-file "$BODY_FILE"
```

**Write it high level and short.** The reader is a reviewer with thirty
seconds; the diff, commit bodies and CI carry the detail. Everything above the
checklist stays under ~120 words.

- `Summary`: 1–3 bullets, ≤ 15 words each. Name the outcome or feature, not
  the packages, flags, scripts or files that implement it.
- `Why`: one sentence.
- `Scope`: one line of top-level areas (`libs/billing`, `pkgs/sim*`), not every
  package. Add `Out:` only when a reader would otherwise assume it is in.
- `Verification`: one line — `bun check` → green locally (plus a second surface
  only if it matters) — then one line on what is not proven. No test counts,
  run counts, timeouts, or debugging story.
- `Risk`: one line — level, blast radius, rollback.
- `Provenance`: one line — who produced it (agent + model), plus an open
  question only if a human must decide it before merging.
- Leave out file lists, log excerpts, hypotheses, attempt histories, and
  anything a checklist box already says.

The right size looks like this:

```md
## Summary

- Prove the remaining v1 goals inside `bun check`.
- Replace Vitest with `bun test` across the repo.
- Rebuild the mock billing portal; sim actors get a browser for hosted pages.

## Why

v1 is done only when every goal is proven by `bun check`; the rest is friction found on the way.

## Scope

`apps/product`, `libs/billing`, `pkgs/sim*`, `pkgs/chess-board`, test tooling. Out: production EMQX config.

## Verification

`bun check` → green locally. Not proven: deploy, or the WebKit leaf on Linux.

## Risk

Medium — the larger PR gate can red-block merges on a flaky sidecar. Rollback: revert.

## Provenance

`/pr-merge` agent (Claude Opus 5).
```

Checklist rules:

- Check a box only when it is true. Leave the CI box unchecked until the remote
  gate passes, then check it.
- A box that cannot be checked or does not apply gets at most one short clause
  under `Verification` — do not delete the line.

## 6. Drive the checks green

```sh
gh pr checks "$PR_NUMBER" --watch
```

`--watch` exits non-zero as soon as a check fails. Collect the failing run and
its logs — never an agent's guess at what CI said:

```sh
gh run list --branch "$BRANCH" --limit 5 --json databaseId,status,conclusion,url,headSha
RUN_ID="$(gh run list --branch "$BRANCH" --limit 1 --json databaseId --jq '.[0].databaseId')"
gh run view "$RUN_ID" --log-failed > /tmp/pr-merge-ci.log
```

Mechanical failures you handle yourself:

- Stale or cancelled run: push the already-tested commit and watch the new run.
- Failure in a leaf you cannot reproduce locally (the CI-only
  `@libs/tools#check:static`, or a contract test whose sidecar ports are busy in
  this workspace): say so in the report rather than guessing.
- Auth, secrets, hosted-runner, or missing-sidecar failure: record the exact log
  and stop if it is not repairable from this branch.

For a reproducible code or test failure, hand `/tmp/pr-merge-ci.log` plus the
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

After any fix: return to step 2 and get `bun check` green locally, commit
through the commit-message agent (step 3), push, and watch a fresh run. Never
re-run the same failed commit without a new hypothesis. Stop after three
attempts with no new root cause and report the leaf and log.

If CI reveals the branch is behind or `mergeable` is `CONFLICTING`, go back to
step 4, sync again, resolve with the conflict agent, re-verify, and push. A
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

For accepted changes, get `bun check` green locally (step 2), commit one
logical change per review unit, and push:

```sh
bun fmt
bun check
git add <reviewed paths>
git commit -m "<agent message for this review unit>"
bun run git-sync --leave-conflicts
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

Only these end the loop early — a failing check, a conflict, or a red CI run on
its own is never a reason to stop; it is the next thing to fix.

- a merge conflict needs a product decision the agent cannot make
- a required human decision or missing credential blocks progress
- a check is genuinely wrong and the only way past it would weaken it (report
  it — do not edit the check)
- three consecutive attempts produced no new root-cause hypothesis
- the PR needs a reviewer decision, not more code
- `reviewDecision` is `CHANGES_REQUESTED`, or required approvals are missing

Use this template:

```
❌ PR not merged.
Branch: <branch>
PR: <url | none>
Failing step: <fmt | bun check (local) | merge conflict | check (CI) | review>
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
bun run git-sync --leave-conflicts
```

If this merge conflicts, return to §4 and use the conflict agent. If it creates
a merge commit, return to §2 and get `bun check` green on the merged tree,
sync it again, and rerun §6. The new merge commit is not verified until the
PR check passes again.

After the merge is clean and all required checks are green:

```sh
bun run git-sync
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

## 9. Merge

Only after the final synchronization gate passes. Re-confirm every check is
green on the exact commit you verified, then merge that commit:

```sh
gh pr checks "$PR_NUMBER" --required
gh pr view "$PR_NUMBER" --json mergeable,mergeStateStatus,isDraft,reviewDecision,headRefOid
gh pr merge "$PR_NUMBER" --merge --match-head-commit "$(git rev-parse HEAD)"
gh pr view "$PR_NUMBER" --json state,mergedAt,mergeCommit
```

- Merge only when every check reports `pass`, `isDraft` is `false`,
  `mergeable` is `MERGEABLE`, `mergeStateStatus` is `CLEAN`, and
  `reviewDecision` is not `CHANGES_REQUESTED` or `REVIEW_REQUIRED`. Anything
  else goes back to the matching step (6 for checks, 4 for `BEHIND` /
  `CONFLICTING`, 7 for reviews) or to step 8's stop template.
- A draft PR is a human's signal to hold: stop and report rather than marking
  it ready.
- If GitHub refuses the merge (branch moved, a check re-ran, protection
  changed), do not retry with a bigger hammer: return to the final
  synchronization gate and go around again.
- `state` must read `MERGED` before you report success. The remote branch is
  deleted by `delete_branch_on_merge`, so leave the local branch and worktree
  alone. Do not run a plain `git-sync` on the branch, because that would
  re-push the deleted branch. Bring local `main` up to the merge instead:

  ```sh
  bun run git-sync --trunk-only
  ```

## 10. Report when done

- PR URL, merge commit, final commit list (`git log --oneline origin/main..HEAD`
  captured before the merge), and merge state: **merged**.
- `gh pr checks` summary (every check green) plus
  `gh pr view --json mergeable,mergeStateStatus,isDraft,reviewDecision`.
- Conflicts: what `origin/main` brought in, which paths conflicted, and how each
  was resolved (or which reached a human).
- Per review comment: changed (with commit) vs replied (with reason) vs already
  covered, and which threads are resolved.
- What is *not* verified: deployment. The merge starts `deploy:dev` (a dev
  rehearsal) and then `deploy:prd` via `.github/workflows/deploy.yml` on
  `main` — link the triggered run; this command does not wait on it.
- Any flaky tests, warnings, or marginal calls a human should look at.

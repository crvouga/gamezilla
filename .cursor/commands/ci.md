# CI & Deploy

Run this workflow once per logical unit of work (a completed fix, feature, or
review pass) — not after every individual keystroke or file save. Goal: code
is formatted, every check in the codebase passes, changes are committed, and
the app is deployed to dev and then prod. Nothing is committed or deployed
while any check fails or has not actually been run on the current tree.

## Core rules (read first)

- **Fix root causes, never symptoms.** It is forbidden to make checks pass by:
  deleting or skipping tests (`.skip`, `.only`, commenting out), loosening
  assertions, adding `@ts-ignore` / `@ts-expect-error` / `as any`, disabling
  lint rules (inline or in config), lowering type-checker strictness, or
  editing the check scripts themselves. If you believe a check itself is wrong,
  stop and report it instead of changing it.
- **Run steps individually**, not as one long `&&` chain. You need to know
  exactly which step failed and see its full output. Do not use `clear`.
- **Never deploy or commit with a failing, unrun, or unverified check.** "It
  passed earlier" does not count — the full check suite must pass, and the
  deploy must be verified, on the exact code being committed and deployed.
- **Keep going until green — but escalate if you're stuck, not just
  repeating.** Continue fixing, debugging, formatting, and re-running the
  failing step. The distinction that matters: each retry should test a *new*
  root-cause hypothesis. Looping through several different hypotheses is
  progress — keep going. Re-running the same fix, or making changes with no
  hypothesis for why they'd help, is thrashing — stop after 3 consecutive
  attempts of that and report. Valid reasons to stop: a required human
  decision, a missing credential, an unavailable service, a genuinely
  incorrect check, or thrashing as just defined. Do not deploy while blocked.

## Workflow

### 0. Pre-flight

```sh
git status
git branch --show-current
```

- If the working tree has pending changes you didn't make and can't explain,
  stop and report — don't fold them into this run or assume they're safe to
  include.
- Confirm you're on the branch this repo expects commits on before making any.
  If this repo requires a PR rather than direct commits to that branch, stop
  before step 3 and open one instead of committing directly.
- If dependencies look stale (lockfile newer than `node_modules`, or a fresh
  clone), install now (`bun install`) rather than letting it surface later as
  a confusing check failure.

### 1. Format

```sh
bun fmt
```

If formatting changed files, that's fine — the changes get committed in step 3.
If the formatter itself errors (e.g., syntax error in a file), fix the file and
re-run.

### 2. Run the full check suite

```sh
bun check:full
```

On failure:

1. Read the complete error output. Identify the failing check (lint, types,
   tests, build, etc.) and the specific file/line.
2. Diagnose the root cause before editing. If a test fails, decide whether the
   code is wrong or the test is asserting outdated behavior — and only change
   the test if the intended behavior of the code genuinely changed as part of
   this task.
3. Apply the fix, then re-run from **step 1** (formatting first, then the full
   suite — a fix can introduce new formatting or type issues elsewhere).
4. If a test failure looks flaky (passes on immediate re-run with no code
   change), re-run once more to confirm; if it passes twice, note the flake in
   your final summary rather than silently ignoring it.

Repeat until `bun check:full` exits 0 with zero warnings-as-errors.

### 3. Commit

Only after step 2 passes on the current working tree:

```sh
git add -A
git status          # review what is being committed
git diff --staged   # sanity-check the diff matches the intended change
```

- If `git status` shows no staged changes at this point, there's nothing new
  to commit — skip straight to reporting that (don't create an empty commit,
  and don't proceed to deploy stale code as if something changed).

```sh
git commit -m "<type>(<scope>): <summary>"
```

Commit message rules:

- Conventional Commits: `feat`, `fix`, `refactor`, `test`, `chore`, `docs`,
  `perf`, `ci`. Choose the type from the dominant change, not the last file
  touched.
- Summary in imperative mood, ≤ 72 chars, no trailing period.
- If the change is non-obvious, add a short body explaining *why*.
- Never use `--no-verify`, never amend or force-push existing history.

Do not commit unrelated files. If `git status` shows changes you did not make
and cannot explain, stop and report instead of committing them.

### 4. Deploy to dev, verify, then prod

```sh
bun deploy:dev
```

- If the dev deploy fails (non-zero exit), treat it like a failing check:
  diagnose the root cause, fix, and return to **step 1**. Do not retry the
  deploy blindly and do not touch prod.
- **A zero exit code means the deploy command finished, not that the app is
  healthy.** Before promoting to prod, verify dev actually works — hit its
  health-check endpoint, run the smoke-test suite, or check logs for startup
  errors, whatever this repo already has for that. If no such verification
  step exists yet, say so explicitly in the final summary rather than silently
  treating "deploy exited 0" as "verified."
- Only once verification passes:

```sh
bun deploy:prd
```

- If the prod deploy fails, do **not** leave things half-done: report the
  exact error output, state clearly that dev is deployed but prod is not, and
  stop for human review. Do not improvise rollbacks unless explicitly
  instructed.

### 5. Confirm and summarize

When everything is deployed, print `✅ Deployed` and end with a short summary:

- What changed (1–3 bullets)
- The commit hash and message
- Which environments were deployed (dev, prod) and how dev was verified
- Any flaky tests, warnings, thrashing you escalated on, or follow-ups a human
  should look at

## Failure summary template (when stopping without deploying)

```
❌ Not deployed.
Failing step: <fmt | check:full | deploy:dev | deploy:prd>
Working tree: <clean | had unrelated changes | uncommitted changes present>
Error: <exact key error output>
Attempts: <what you tried, in order>
Hypothesis: <most likely root cause>
Needs: <what a human should decide or provide>
```
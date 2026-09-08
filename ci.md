# CI & Deploy

Run this workflow after every change. Goal: code is formatted, every check in
the codebase passes, changes are committed, and the app is deployed to dev and
then prod. Nothing is committed or deployed while any check fails.

## Core rules (read first)

- **Fix root causes, never symptoms.** It is forbidden to make checks pass by:
  deleting or skipping tests (`.skip`, `.only`, commenting out), loosening
  assertions, adding `@ts-ignore` / `@ts-expect-error` / `as any`, disabling
  lint rules (inline or in config), lowering type-checker strictness, or
  editing the check scripts themselves. If you believe a check itself is wrong,
  stop and report it instead of changing it.
- **Run steps individually**, not as one long `&&` chain. You need to know
  exactly which step failed and see its full output. Do not use `clear`.
- **Never deploy or commit with a failing or unrun check.** "It passed
  earlier" does not count — the full check suite must pass on the exact code
  being committed and deployed.
- **Loop guard.** If the same error persists after 3 genuine fix attempts, or
  you have looped 10 times total, stop. Summarize: what fails, what you tried,
  your best hypothesis for the root cause, and what you need from a human.
  Do not deploy.

## Workflow

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

- If the dev deploy fails, treat it like a failing check: diagnose the root
  cause, fix, and return to **step 1**. Do not retry the deploy blindly and do
  not touch prod.
- If the dev deploy succeeds, then and only then:

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
- Which environments were deployed (dev, prod)
- Any flaky tests, warnings, or follow-ups a human should look at

## Failure summary template (when stopping without deploying)

```
❌ Not deployed.
Failing step: <fmt | check:full | deploy:dev | deploy:prd>
Error: <exact key error output>
Attempts: <what you tried, in order>
Hypothesis: <most likely root cause>
Needs: <what a human should decide or provide>
```
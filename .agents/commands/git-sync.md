---
description: Commit and push all local work on the current feature branch, then merge the latest origin/main into it — one script call, you only write the commit message
---

# /git-sync

Commit and push all local work on the current feature branch, then merge the latest
`origin/main` into that same feature branch. `bun run git-sync`
(`libs/tools/scripts/git-sync.ts`) owns every git step and every safeguard. Your only job is
the commit message.

Use it to checkpoint and stay current with `main` between units of work. To take a branch all
the way to a green PR, use `/pr-merge` (`.agents/commands/pr-merge.md`).

## Run

```bash
git status --porcelain -uall
git diff HEAD
bun run git-sync --message "type(scope): description"
```

Read the diff, write one Conventional Commit message that describes it, and pass it with
`--message`. If the tree is already clean, run `bun run git-sync` with no arguments.

Use `-uall`, because plain `git status --porcelain` collapses a new directory to one entry and
`git diff HEAD` shows no untracked content at all. Without it, new files are easy to miss in the
message.

Message rules: the header is `<type>(<scope>): <summary>`. The type is one of
`feat|fix|refactor|test|chore|docs|perf|ci`. The header is at most 72 characters, has no
trailing full stop, and is followed by a blank line before any body. They are the same
Conventional Commit rules as the PR title in `/pr-merge` (enforced in `libs/tools/scripts/git-sync.ts`).

That is the whole flow. Do not invent other git steps, and do not hand-run fetch, merge or push
around the script.

## Isolation guarantees

- The script refuses a detached HEAD and refuses to run on `main`, `master` or `dev`. It only
  runs on the checked-out feature branch.
- It fetches only `origin/main` and the current feature branch, with tags disabled and without
  pruning, so no other remote-tracking ref changes.
- It pushes only `HEAD` to `origin/<current-feature-branch>`, never with `--force`. It never
  pushes `main`, `master` or any other branch. The `pre-push` hook refuses `main` as well.
- It merges only the fetched `origin/main` into the checked-out feature branch. It never checks
  out, resets, force-updates or fast-forwards local `main`, which stays untouched.
- It refuses to start during a merge, rebase, cherry-pick or revert. If its own merge fails, it
  runs `git merge --abort` before exiting.

## What the script does

1. **Checks that it is safe to run.** It stops on a detached HEAD, on `main`, `master` or `dev`,
   during a rebase, merge, cherry-pick or revert, or when there is no `origin` remote.
2. **Commits a dirty tree.** It requires `--message` and checks it against the rules above. It
   refuses paths that look like secrets (`.env*` other than examples, `.cache/secrets/`,
   `*.pem`/`*.key`, SSH keys, credential JSON, `.npmrc`/`.netrc`/`.pgpass`). Then it runs
   `git add --all` and, when `gitleaks` is installed, `gitleaks protect --staged`. If gitleaks
   finds something, the script unstages everything and fails. Otherwise it commits.
3. **Pushes the feature branch.** It fetches only the feature branch and `origin/main`. If the
   remote branch is ahead, local catches up first: a fast-forward, or a merge when the two have
   diverged. Then it pushes, with `--set-upstream` when the branch is new. It never force-pushes.
4. **Merges `origin/main`.** It skips this step when the branch already contains
   `origin/main`. The merge keeps git's default message. On a conflict it runs
   `git merge --abort`, lists the conflicted paths and stops. Your committed work is already
   pushed.
5. **Pushes the merge and verifies.** It checks that local `HEAD` equals the remote branch tip
   (from `git ls-remote`) and that the working tree is clean.

It never updates local `main`, touches `master` or `dev`, touches unrelated refs, touches `main`
on the remote, merges the feature branch into trunk, or merges a PR.

## On failure

Report the script's `ERROR:` output verbatim. Do not force-push, stash, amend, open a PR, or
continue after a failed merge. If the merge with `origin/main` conflicted, resolve it through
`/pr-merge` §2 (conflict agent), not by hand-running merge steps here.

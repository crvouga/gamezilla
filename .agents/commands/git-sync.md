---
description: Sync the branch with trunk — commit and push local work, merge the latest origin/main in, push, and fast-forward local main — one script call, you only write the commit message
---

# /git-sync

Commit and push all local work on the current feature branch, merge the latest `origin/main`
into that same feature branch, push the merge, and fast-forward local `main` to `origin/main`.
Afterwards the branch, `origin/<branch>` and local `main` are all current with trunk.
`bun run git-sync` (`libs/tools/scripts/git-sync.ts`) owns every git step and every safeguard.
Your only job is the commit message.

It is the one way this repo commits, pushes and syncs with trunk. Use it to checkpoint and
stay current with `main` between units of work. `bun health` runs it before it dispatches its workflow. `bun deploy` runs it with `--trunk-only` and then dispatches Deploy on `main`.

## Run

```bash
git status --porcelain -uall
git diff HEAD
bun run git-sync --message "type(scope): description"
```

Read the diff, write one Conventional Commit message that describes it, and pass it with
`--message`. Without `--message`, git-sync generates a header from the changed paths
(`chore(pkg): update 3 files`; a tree that mixes specs with other files becomes a `spec:` commit
plus a second commit for the rest). `bun verify` relies on that. If the tree
is already clean, run `bun run git-sync` with no arguments.

| Mode | Command |
|---|---|
| Sync a feature branch (the default) | `bun run git-sync [--message "…"]` |
| On `main`: fast-forward the checkout only | `bun run git-sync` |
| Only fast-forward local `main`, from any branch (e.g. after a PR merged) | `bun run git-sync --trunk-only` |
| Keep a conflicted merge in progress for resolving | `bun run git-sync --leave-conflicts` |

Use `-uall`, because plain `git status --porcelain` collapses a new directory to one entry and
`git diff HEAD` shows no untracked content at all. Without it, new files are easy to miss in the
message.

Message rules: the header is `<type>(<scope>): <summary>`. The type is one of
`feat|fix|refactor|test|chore|docs|perf|ci`. The header is at most 72 characters, has no
trailing full stop, and is followed by a blank line before any body. They are the same
Conventional Commit rules as the PR title (enforced in `libs/tools/scripts/git-sync.ts`).

That is the whole flow. Do not invent other git steps, and do not hand-run fetch, merge or push
around the script.

## Isolation guarantees

- The script refuses a detached HEAD and refuses to run on `master` or `dev`. On `main` it only
  fast-forwards: no commit, no merge, no push.
- It fetches only `origin/main` and the current feature branch, with tags disabled and without
  pruning, so no other remote-tracking ref changes.
- It pushes only `HEAD` to `origin/<current-feature-branch>`, never with `--force`. It never
  pushes `main`, `master` or any other branch. The `pre-push` hook refuses `main` as well.
- It merges only the fetched `origin/main` into the checked-out feature branch.
- It moves local `main` only by fast-forward to `origin/main`. A local `main` with commits
  `origin/main` lacks is left untouched with a warning. When `main` is checked out in a worktree,
  it fast-forwards that checkout only if its tracked files are clean.
- It refuses to start during a merge, rebase, cherry-pick or revert. If its own merge fails, it
  runs `git merge --abort` before exiting, unless you pass `--leave-conflicts`.

## What the script does

1. **Verifications that it is safe to run.** It stops on a detached HEAD, on `master` or `dev`, during a
   rebase, merge, cherry-pick or revert, or when there is no `origin` remote. On `main`, or with
   `--trunk-only`, it fetches `origin/main`, runs step 6 and stops.
2. **Commits a dirty tree.** It requires `--message` and verifies it against the rules above. It
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
   pushed. With `--leave-conflicts` it leaves the merge in progress instead. Resolve and
   `git add` the paths, run `GIT_EDITOR=true git merge --continue`, then rerun
   `bun run git-sync`.
5. **Pushes the merge.**
6. **Fast-forwards local `main`** to `origin/main`, under the rules in *Isolation guarantees*.
7. **Verifies.** It verifies that local `HEAD` equals the remote branch tip (from `git ls-remote`)
   and that the working tree is clean.

It never touches `master` or `dev`, touches unrelated refs, pushes `main`, merges the feature
branch into trunk, or merges a PR.

## On failure

Report the script's `ERROR:` output verbatim. Do not force-push, stash, amend, open a PR, or
continue after a failed merge. If the merge with `origin/main` conflicted, rerun with
`--leave-conflicts`, resolve every conflict, then run `bun run git-sync` again.

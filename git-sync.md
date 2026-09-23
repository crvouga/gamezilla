# Sync this branch

Run these commands from the repository root. They fetch the latest remote state, merge this branch's matching branch on `origin` when it exists, merge `origin/main`, and push the result. Merges preserve the remote branch history and use a normal push.

Commit or stash all local changes first. The commands stop if the worktree is dirty, so uncommitted work is never included in a merge or lost.

```bash
bash <<'SH'
set -euo pipefail

branch=$(git branch --show-current)
if [[ -z "$branch" || "$branch" == main ]]; then
  echo 'Switch to a feature branch before syncing.' >&2
  exit 1
fi
if [[ -n "$(git status --porcelain)" ]]; then
  echo 'Commit or stash local changes before syncing.' >&2
  exit 1
fi

git fetch origin --prune
if git show-ref --verify --quiet "refs/remotes/origin/$branch"; then
  git merge --no-edit "origin/$branch"
fi
git merge --no-edit origin/main

git status --short --branch
git log --oneline --graph --decorate -12
git push -u origin "HEAD:refs/heads/$branch"
SH
```

If a merge conflicts, the script stops before pushing. Resolve the files, run `git add` and `git commit` to finish the merge, then run the remaining merge and push commands. To abandon the in-progress merge, run `git merge --abort`.

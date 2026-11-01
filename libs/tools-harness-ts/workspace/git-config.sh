#!/usr/bin/env bash
# Repository-local defaults, shared by its linked worktrees. No git hooks.
set -euo pipefail
git config --local fetch.prune true
git config --local fetch.pruneTags false
git config --local pull.ff only
git config --local push.default simple
git config --local push.autoSetupRemote true
git config --local branch.autoSetupMerge simple
git config --local merge.conflictStyle zdiff3
if git config --get core.hooksPath >/dev/null; then
  echo 'Remove core.hooksPath: this repository prohibits git hooks.' >&2
  exit 1
fi

hooks_dir="$(git rev-parse --git-path hooks)"
for hook in "$hooks_dir"/*; do
  case "$hook" in *.sample) continue ;; esac
  if [ -f "$hook" ] && [ -x "$hook" ]; then
    echo "Remove executable git hook: $hook" >&2
    exit 1
  fi
done

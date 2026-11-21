#!/usr/bin/env bash
# `bun run design:edit`: an interactive Claude Code session in this checkout,
# primed for design-system work by DESIGN_EDIT.prompt.md. Runs in the
# checkout it is started from (the workspace root, or a thread's worktree).
set -euo pipefail
root="$(git rev-parse --show-toplevel)"
cd "$root"
if ! command -v claude >/dev/null 2>&1; then
  echo "Claude Code is not installed: https://docs.claude.com/en/docs/claude-code" >&2
  exit 1
fi
if [ ! -t 0 ] || [ ! -t 1 ]; then
  echo "design:edit needs an interactive terminal." >&2
  exit 1
fi
exec claude "$(cat scripts/DESIGN_EDIT.prompt.md)"

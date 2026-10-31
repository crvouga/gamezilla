#!/usr/bin/env bash
# Sourced by every workspace lifecycle script (run, teardown).
#
# Orchestrator-agnostic on purpose: Superset exports SUPERSET_*, super.engineering
# exports SUPER_ENGINEERING_*, the next tool will export something else. Every
# one of them runs the command inside the worktree, so derive everything from
# git instead of any tool's env vars and the same scripts work under all of them
# (and from a plain shell).
#
# Exports:
#   WORKSPACE_PATH       this worktree (the checkout these scripts live in)
#   WORKSPACE_ROOT_PATH  the main checkout the worktree was created from; equal
#                        to WORKSPACE_PATH when run in the main checkout itself

WORKSPACE_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd -P)"
export WORKSPACE_PATH

# The shared git dir is `<main checkout>/.git` for every linked worktree.
git_common_dir="$(git -C "$WORKSPACE_PATH" rev-parse --path-format=absolute --git-common-dir 2>/dev/null || true)"
if [ "$(basename "$git_common_dir")" = '.git' ]; then
  WORKSPACE_ROOT_PATH="$(cd "$(dirname "$git_common_dir")" && pwd -P)"
else
  WORKSPACE_ROOT_PATH="$WORKSPACE_PATH"
fi
export WORKSPACE_ROOT_PATH
unset git_common_dir

cd "$WORKSPACE_PATH" || exit 1

# Runs one command, printing its output only when it fails: a step that worked
# is one line. Steps that run as Turborepo tasks get the same from
# `outputLogs: errors-only`; this covers what has to run before turbo can.
workspace_quiet() {
  local label="$1" log status=0
  shift
  log="$(mktemp "${TMPDIR:-/tmp}/workspace-step.XXXXXX")"
  echo "==> $label"
  "$@" >"$log" 2>&1 || status=$?
  if [ "$status" -ne 0 ]; then
    cat "$log"
    echo "!!! $label failed (exit $status)" >&2
  fi
  rm -f "$log"
  return "$status"
}

# A previous setup may have bootstrapped mise without changing this shell's PATH.
# Reuse that installation in GUI/remote launches without installing anything.
workspace_activate_tools() {
  if [ -x "$HOME/.local/bin/mise" ]; then
    export PATH="$HOME/.local/bin:$PATH"
  fi
  if command -v mise >/dev/null 2>&1; then
    local workspace_mise_env
    workspace_mise_env="$(mise env --shell bash)" || return 1
    eval "$workspace_mise_env"
  fi
}

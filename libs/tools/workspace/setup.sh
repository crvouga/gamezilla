#!/usr/bin/env bash
# Prepare a fresh workspace: system tools, submodule workspaces, workspace deps,
# repo hooks and the gitignored local-only files.
#
# Tools and submodules run here, quietly: turbo needs the pinned runtimes to
# start and the submodule workspaces to read the package graph. Everything
# after that is a Turborepo task (step.sh), so the terminal shows one line per
# step in the task UI and the output of a step only when it fails.
set -euo pipefail
# shellcheck source=libs/tools/workspace/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

SETUP_STEPS=(install hooks local-files)

# System tools are pinned in mise.toml (`mise install`). Each worktree is a
# new path, so trust it first. better-sqlite3@13 ships its N-API prebuild in
# the package and is not a trustedDependency: `bun install` must not run
# node-gyp. Do not add better-sqlite3 back to trustedDependencies.
if command -v mise >/dev/null 2>&1; then
  mise trust --quiet mise.toml
  workspace_quiet "mise install" mise install ||
    echo "!!! mise install failed; run 'mise install' in this workspace"
else
  echo "!!! mise not found; install it (https://mise.jdx.dev) and run 'mise install'"
fi

# Bun resolves every declared workspace before it installs any package. A fresh
# linked worktree has only the submodule gitlink, so materialize submodule
# workspaces before asking Bun to resolve the workspace graph.
workspace_quiet "git submodule update --init --recursive" \
  git submodule update --init --recursive ||
  echo "!!! submodule initialization failed; continuing with the available checkout"

# Turbo arrives with `bun install`, which is itself a step. A fresh worktree
# borrows the binary from the checkout it was created from.
workspace_turbo() {
  local candidate
  for candidate in "$WORKSPACE_PATH" "$WORKSPACE_ROOT_PATH"; do
    if [ -x "$candidate/node_modules/.bin/turbo" ]; then
      printf '%s\n' "$candidate/node_modules/.bin/turbo"
      return 0
    fi
  done
  return 1
}

# Setup never fails on an incomplete step: each names its own fix, and Run
# retries the install before launching.
if turbo="$(workspace_turbo)"; then
  tasks=()
  for step in "${SETUP_STEPS[@]}"; do
    tasks+=("//#workspace:$step")
  done
  "$turbo" run "${tasks[@]}" \
    --continue --env-mode=loose --output-logs=errors-only ||
    echo "!!! setup left the steps above unfinished"
else
  # No install anywhere yet (a first clone): the same steps, without the UI.
  for step in "${SETUP_STEPS[@]}"; do
    workspace_quiet "workspace:$step" \
      "$WORKSPACE_PATH/libs/tools/workspace/step.sh" "$step" ||
      echo "!!! workspace:$step is unfinished"
  done
fi

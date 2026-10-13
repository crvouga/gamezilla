#!/usr/bin/env bash
# The only workspace start script. A cold checkout (no warm mark) prepares
# itself once: pinned tools, dependencies, and the gitignored
# local files. Every later run skips that and starts the stack. Preparation
# is idempotent and never fails the launch — a step that cannot finish says
# so, the warm mark is still written, and dev starts. Pressing Run again is
# safe. Deleting .cache/workspace-warm repeats preparation.
#
# `port.sh` exports the per-workspace VITE_PORT. The stack pins its web app
# there so parallel workspaces don't collide. The web listener is 127.0.0.1.
# `?simulator` redirects to `/simulator` (see src/console/main.tsx).
set -euo pipefail
# shellcheck source=libs/tools/workspace/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
# shellcheck source=libs/tools/workspace/install.sh
. "$(dirname "${BASH_SOURCE[0]}")/install.sh"
# shellcheck source=libs/tools/workspace/port.sh
. "$(dirname "${BASH_SOURCE[0]}")/port.sh"

WARM_MARK=".cache/workspace-warm"
STEP="$WORKSPACE_PATH/libs/tools/workspace/step.sh"

workspace_mise() {
  mise trust --quiet mise.toml
  mise install
}

# One-time preparation. Each step names its own fix and returns here.
workspace_cold() {
  if command -v mise >/dev/null 2>&1; then
    workspace_quiet "mise install" workspace_mise ||
      echo "!!! mise install failed; run 'mise install' in this workspace"
  else
    echo "!!! mise not found; install it (https://mise.jdx.dev) and run 'mise install'"
  fi
  workspace_install ||
    echo "!!! launching dev on an incomplete install"
  "$STEP" local-files || echo "!!! workspace:local-files is unfinished"
  mkdir -p .cache
  printf 'warm\n' >"$WARM_MARK"
}

if [ ! -f "$WARM_MARK" ]; then
  workspace_cold
elif [ ! -x node_modules/.bin/turbo ]; then
  # The warm mark outlived node_modules. Restore the install, skip the rest.
  workspace_install ||
    echo "!!! launching dev on an incomplete install"
fi

# turbo.json selects the terminal UI. `TURBO_UI=false` or `stream` (the
# install step, or the orchestrator) replaces it with the streaming log.
# Interactive dev tasks need the terminal UI.
export TURBO_UI=true
exec bun run --silent dev -- --web-port "${VITE_PORT}"

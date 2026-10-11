#!/usr/bin/env bash
# Localhost stack for the super-app, entering at the product simulator.
# Same entry point as `bun dev`. `port.sh` exports the per-workspace VITE_PORT;
# the stack pins its web app there (everything else takes an OS port) so
# parallel workspaces don't collide and the URL below is the one that opens.
# The web listener is 127.0.0.1, matching the stack. `?simulator` redirects to
# `/simulator` (see src/console/main.tsx).
#
# Run is pressed on whatever state the checkout is in. `bun dev` is a Turborepo
# run: its first tasks bring the install back in step and name an unfinished
# merge (step.sh), then every service of the stack runs as its own task, each
# with its own pane in the task UI.
set -euo pipefail
# shellcheck source=libs/tools/workspace/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
# shellcheck source=libs/tools/workspace/install.sh
. "$(dirname "${BASH_SOURCE[0]}")/install.sh"
# shellcheck source=libs/tools/workspace/port.sh
. "$(dirname "${BASH_SOURCE[0]}")/port.sh"

# Turbo reads the package graph before it runs a task, and arrives with the
# install: both have to be there before `bun dev` can start.
workspace_sync_submodules
if [ ! -x node_modules/.bin/turbo ]; then
  workspace_quiet "bun install" workspace_install ||
    echo "!!! launching dev on an incomplete install"
fi

exec bun run --silent dev -- --web-port "${VITE_PORT}"

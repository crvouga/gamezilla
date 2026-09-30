#!/usr/bin/env bash
# Localhost stack for the super-app, entering at the product simulator.
# Same entry point as `bun dev`. `port.sh` exports the per-workspace VITE_PORT;
# the stack pins its web app there (everything else takes an OS port) so
# parallel workspaces don't collide and the URL below is the one that opens.
# The web listener is 127.0.0.1, matching the stack. `?simulator` redirects to
# `/simulator` (see src/console/main.tsx).
set -euo pipefail
# shellcheck source=libs/tools/workspace/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
# shellcheck source=libs/tools/workspace/port.sh
. "$(dirname "${BASH_SOURCE[0]}")/port.sh"

echo "==> simulator on http://127.0.0.1:${VITE_PORT}/?simulator"
exec bun run --silent dev -- --web-port "${VITE_PORT}"

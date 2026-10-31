#!/usr/bin/env bash
# Start the checkout-owned local stack; setup is a separate lifecycle stage.
set -euo pipefail
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
. "$(dirname "${BASH_SOURCE[0]}")/install.sh"
workspace_activate_tools
if ! workspace_install_is_current; then
  echo "!!! run ./libs/tools-harness-ts/workspace/setup.sh first (dependencies changed or missing)" >&2
  exit 1
fi
. "$(dirname "${BASH_SOURCE[0]}")/port.sh"
# Preserve an explicit UI choice; GUI/remote hooks can request stream output.
export TURBO_UI="${TURBO_UI:-stream}"
exec bun run --silent dev -- --web-port "$VITE_PORT" --keep-data "$@"

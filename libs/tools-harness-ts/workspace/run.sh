#!/usr/bin/env bash
# Repair checkout preparation when needed, then start the owned local stack.
set -euo pipefail
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
. "$(dirname "${BASH_SOURCE[0]}")/install.sh"
if ! workspace_activate_tools || ! workspace_install_is_current; then
  echo "==> preparing missing or changed workspace dependencies"
  "$WORKSPACE_PATH/libs/tools-harness-ts/workspace/setup.sh"
  workspace_activate_tools
fi
. "$(dirname "${BASH_SOURCE[0]}")/port.sh"
# Preserve an explicit UI choice; GUI/remote hooks can request stream output.
export TURBO_UI="${TURBO_UI:-stream}"
exec bun run --silent dev -- --web-port "$VITE_PORT" --keep-data "$@"

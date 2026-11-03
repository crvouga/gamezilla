#!/usr/bin/env bash
# Start stack: repair checkout preparation when needed, replace any stack this
# checkout already runs (healthy, broken or orphaned), then start the owned
# local stack in the foreground. Rerunning always ends with one fresh stack.
set -euo pipefail
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
. "$(dirname "${BASH_SOURCE[0]}")/install.sh"
if ! workspace_activate_tools || ! workspace_install_is_current; then
  echo "==> preparing missing or changed workspace dependencies"
  "$WORKSPACE_PATH/libs/tools-harness-ts/workspace/setup.sh"
  workspace_activate_tools
fi
# Stop by checkout ownership, never by port, before choosing ports, so the
# previous stack's block is free again and the same ports are reused.
echo "==> stopping any stack this checkout already runs"
bun libs/tools-harness-ts/scripts/kill-dev-stack.ts
. "$(dirname "${BASH_SOURCE[0]}")/port.sh"
# Preserve an explicit UI choice; GUI/remote hooks can request stream output.
export TURBO_UI="${TURBO_UI:-stream}"
exec bun run --silent dev -- --web-port "$VITE_PORT" --keep-data "$@"

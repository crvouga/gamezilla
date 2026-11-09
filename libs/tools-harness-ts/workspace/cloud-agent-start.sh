#!/usr/bin/env bash
# Boot the localhost product stack for a Cursor Cloud Agent. Same repair and
# launch as run.sh, with cloud-agent-install.sh in place of setup.sh so the
# host's git hooks do not stop a cold boot.
set -euo pipefail
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
. "$(dirname "${BASH_SOURCE[0]}")/install.sh"
export PATH="$HOME/.local/bin:${PATH:-/usr/bin:/bin}"
if ! workspace_activate_tools || ! workspace_install_is_current; then
  echo "==> preparing missing or changed workspace dependencies"
  "$WORKSPACE_PATH/libs/tools-harness-ts/workspace/cloud-agent-install.sh"
  workspace_activate_tools
fi
echo "==> stopping any stack this checkout already runs"
bun libs/tools-harness-ts/scripts/kill-dev-stack.ts
# shellcheck source=libs/tools-harness-ts/workspace/port.sh
. "$(dirname "${BASH_SOURCE[0]}")/port.sh"
export TURBO_UI="${TURBO_UI:-stream}"
exec bun run --silent dev -- --web-port "$VITE_PORT" --keep-data "$@"

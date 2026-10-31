#!/usr/bin/env bash
# Prepare this checkout without starting services or fetching credentials.
set -euo pipefail
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
. "$(dirname "${BASH_SOURCE[0]}")/system.sh"
. "$(dirname "${BASH_SOURCE[0]}")/install.sh"
workspace_quiet "mise install" workspace_system
workspace_warn_unmerged
if ! workspace_install_is_current; then
  workspace_install
fi
echo "==> setup complete; run ./libs/tools-harness-ts/workspace/run.sh"

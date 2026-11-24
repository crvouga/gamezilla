#!/usr/bin/env bash
# Prepare this checkout without starting services or fetching credentials.
set -euo pipefail
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
. "$(dirname "${BASH_SOURCE[0]}")/system.sh"
. "$(dirname "${BASH_SOURCE[0]}")/install.sh"
# Not workspace_quiet: a first install downloads for minutes, and hidden
# progress is indistinguishable from a hang.
echo "==> mise install"
if ! workspace_system; then
  echo "!!! mise install failed" >&2
  exit 1
fi
"$(dirname "${BASH_SOURCE[0]}")/git-config.sh"
workspace_warn_unmerged
if ! workspace_install_is_current; then
  workspace_install
fi
echo "==> setup complete; run ./libs/tools-harness-ts/workspace/run.sh"

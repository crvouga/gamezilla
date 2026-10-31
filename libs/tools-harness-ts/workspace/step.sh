#!/usr/bin/env bash
# Fast dependency/merge preflights used by Turborepo; no credential copying.
set -euo pipefail
# shellcheck source=libs/tools-harness-ts/workspace/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
# shellcheck source=libs/tools-harness-ts/workspace/install.sh
. "$(dirname "${BASH_SOURCE[0]}")/install.sh"

# Reads manifests only and costs milliseconds when nothing changed; it never
# runs a test or boots a service.
step_install() {
  if workspace_install_is_current; then
    return 0
  fi
  echo "==> package manifests changed since the last install"
  workspace_install
}

step_merge() {
  workspace_warn_unmerged
}

case "${1:-}" in
  install) step_install ;;
  merge) step_merge ;;
  *)
    echo "usage: step.sh install|merge" >&2
    exit 2
    ;;
esac

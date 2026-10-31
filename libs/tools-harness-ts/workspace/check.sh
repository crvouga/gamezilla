#!/usr/bin/env bash
# Full verification by default, or fast package checks while iterating.
set -euo pipefail
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
workspace_activate_tools
if [ "$#" -eq 0 ]; then
  exec bun verify
fi
if [ "$#" -ne 1 ]; then
  echo "usage: check.sh [package-name]" >&2
  exit 2
fi
exec bunx turbo run lint tc test "--filter=$1"

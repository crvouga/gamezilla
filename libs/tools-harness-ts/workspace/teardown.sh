#!/usr/bin/env bash
# Stop only resources owned by this checkout. Never infer ownership from ports.
set -euo pipefail
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
workspace_activate_tools
if [ ! -d node_modules ]; then
  echo "==> dependencies absent; cannot inspect process ownership. Restore setup before cleanup." >&2
  exit 1
fi
exec bun run kill

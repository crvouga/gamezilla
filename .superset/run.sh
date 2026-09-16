#!/usr/bin/env bash
# Dev server for the super-app, entering at the product simulator.
# Same entry point as `bun dev`; `port.sh` exports the per-workspace VITE_PORT
# that apps/product/vite.config.mts reads, so parallel workspaces don't collide.
# `?simulator` redirects to `/simulator` (see src/console/main.tsx), so the entry
# URL below lands in the simulator even from a launcher that only opens `/`.
set -euo pipefail
cd "${SUPERSET_WORKSPACE_PATH:-$(git rev-parse --show-toplevel)}"
# shellcheck source=./port.sh
. ./.superset/port.sh

echo "==> simulator on http://localhost:${VITE_PORT}/?simulator"
exec bun run --silent dev

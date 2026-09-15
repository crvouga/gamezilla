#!/usr/bin/env bash
# Dev server for the super-app, entering at the product simulator.
# Mirrors root `bun run dev` (apps/product setup + Vite) on a per-workspace port.
# `?console` redirects to `/console` (see src/console/main.tsx), so the entry
# URL below lands in the simulator even from a launcher that only opens `/`.
set -euo pipefail
cd "${SUPERSET_WORKSPACE_PATH:-$(git rev-parse --show-toplevel)}"
# shellcheck source=./port.sh
. ./.superset/port.sh

echo "==> apps/product setup (env + sim wasm + sqlite web workers)"
bun run --cwd apps/product setup

echo "==> simulator on http://localhost:${VITE_PORT}/?console"
cd apps/product
exec bunx --no-install vite --port "$VITE_PORT"

#!/usr/bin/env bash
# Deterministic per-workspace Vite port so parallel Superset workspaces can all
# run `dev` at once (apps/product pins 5173 with strictPort).
# Override by exporting VITE_PORT before launching.
if [ -z "${VITE_PORT:-}" ]; then
  name="${SUPERSET_WORKSPACE_NAME:-root}"
  sum="$(printf '%s' "$name" | cksum | cut -d' ' -f1)"
  VITE_PORT=$((5200 + sum % 300))
fi
export VITE_PORT
export PREVIEW_PORT="$VITE_PORT"

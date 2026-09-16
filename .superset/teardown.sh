#!/usr/bin/env bash
# Release this workspace's dev listener. No containers/daemons to stop: the
# local stack (embedded Postgres, EMQX, MinIO) is spawned per-command and all
# other state lives inside the worktree, which Superset removes.
set -euo pipefail
cd "${SUPERSET_WORKSPACE_PATH:-$(git rev-parse --show-toplevel)}" 2>/dev/null || exit 0
# shellcheck source=./port.sh
. ./.superset/port.sh

if [ -d node_modules ]; then
  bun run --cwd apps/product kill || true
fi

# `bun run kill` only reclaims the fixed DEV_PORTS list, which never includes
# this workspace's hashed VITE_PORT. Left behind, that listener blocks the next
# workspace that hashes to the same port.
# VITE_PORT is where the server actually landed; VITE_PORT_PREFERRED is the
# hashed port it would have used, which probing may have skipped over.
if command -v lsof >/dev/null 2>&1; then
  for port in "$VITE_PORT" "${VITE_PORT_PREFERRED:-$VITE_PORT}"; do
    pids="$(lsof -nP -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
    if [ -n "$pids" ]; then
      echo "==> killing dev listener on port $port ($pids)"
      # shellcheck disable=SC2086
      kill -9 $pids 2>/dev/null || true
    fi
  done
fi

#!/usr/bin/env bash
# Release this workspace's dev listeners and sidecar state. No containers or
# daemons to stop: the local stack (embedded Postgres, S3rver, EMQX) is spawned
# per-command and everything else lives inside the worktree, which Superset
# removes.
set -euo pipefail
cd "${SUPERSET_WORKSPACE_PATH:-$(git rev-parse --show-toplevel)}" 2>/dev/null || exit 0
# shellcheck source=./port.sh
. ./.superset/port.sh

if [ -d node_modules ]; then
  bun run --cwd apps/product kill || true
fi

# `bun run kill` only reclaims the fixed DEV_PORTS list, which never includes
# this workspace's hashed block. Left behind, those listeners block the next
# workspace that hashes to the same block.
# SUPERSET_PORT_BASE is where the servers actually landed (offset 0 is
# `$VITE_PORT`); SUPERSET_PORT_BASE_PREFERRED is the hashed block, which probing
# may have skipped over.
if command -v lsof >/dev/null 2>&1; then
  for base in "$SUPERSET_PORT_BASE" "$SUPERSET_PORT_BASE_PREFERRED"; do
    for offset in $(seq 0 $((SUPERSET_PORT_BLOCK - 1))); do
      port=$((base + offset))
      pids="$(lsof -nP -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
      if [ -n "$pids" ]; then
        echo "==> killing listener on port $port ($pids)"
        # shellcheck disable=SC2086
        kill -9 $pids 2>/dev/null || true
      fi
    done
  done
fi

# A reused port block must never inherit a half-initialised cluster.
rm -rf pkgs/postgres-embedded/data

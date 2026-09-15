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

#!/usr/bin/env bash
# Localhost stack for the super-app, entering at the product simulator.
# Same entry point as `bun dev`. `port.sh` exports the per-workspace VITE_PORT;
# the stack pins its web app there (everything else takes an OS port) so
# parallel workspaces don't collide and the URL below is the one that opens.
# The web listener is 127.0.0.1, matching the stack. `?simulator` redirects to
# `/simulator` (see src/console/main.tsx).
set -euo pipefail
# shellcheck source=libs/tools/workspace/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
# shellcheck source=libs/tools/workspace/port.sh
. "$(dirname "${BASH_SOURCE[0]}")/port.sh"

# Check the full schema against a fresh, isolated mock before dev opens services
# or resets its instance data. Dependency upgrades must pass the real wire path.
if ! bun run --silent --filter @libs/runtime-server test:contract; then
  printf '%s\n' \
    'Workspace Run blocked: Mockingbird Postgres cannot reconcile the application schema.' \
    'See libs/tools/MOCKINGBIRD_MIGRATION.md for upstream gaps and regression checks.' >&2
  exit 1
fi

exec bun run --silent dev -- --web-port "${VITE_PORT}"

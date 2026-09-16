#!/usr/bin/env bash
# Per-workspace Vite port so parallel Superset workspaces can all run `dev` at
# once (apps/product pins 5173 with strictPort, so every workspace needs its
# own port). The workspace name hashes to a preferred port for stability across
# restarts; if that port is taken -- by a colliding workspace name, or by a
# stale dev server from a torn-down workspace -- we scan upward for a free one
# instead of letting Vite die on `Port NNNN is already in use`.
# Override by exporting VITE_PORT before launching (no probing is done then).
SUPERSET_PORT_RANGE_START=5200
SUPERSET_PORT_RANGE_SIZE=300

superset_port_is_free() {
  local port="$1"
  # lsof sees both IPv4 and IPv6 listeners; /dev/tcp is the portable fallback.
  if command -v lsof >/dev/null 2>&1; then
    ! lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
    return
  fi
  local host
  for host in 127.0.0.1 '[::1]'; do
    if (exec 3<>"/dev/tcp/${host}/${port}") 2>/dev/null; then
      exec 3<&- 3>&-
      return 1
    fi
  done
  return 0
}

# Seed from the workspace ID, which Superset always exports and which is
# unique per workspace. (There is no SUPERSET_WORKSPACE_NAME: seeding from it
# meant every workspace hashed the literal "root" and collided on one port.)
# Fall back to the worktree path, then the checkout root, for plain shells.
name="${SUPERSET_WORKSPACE_ID:-${SUPERSET_WORKSPACE_PATH:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}}"
sum="$(printf '%s' "$name" | cksum | cut -d' ' -f1)"
# The hashed port this workspace prefers, regardless of what is free right now.
# Teardown needs it to reclaim a listener that probing would have skipped past.
export VITE_PORT_PREFERRED=$((SUPERSET_PORT_RANGE_START + sum % SUPERSET_PORT_RANGE_SIZE))

if [ -z "${VITE_PORT:-}" ]; then
  offset=$((sum % SUPERSET_PORT_RANGE_SIZE))
  for i in $(seq 0 $((SUPERSET_PORT_RANGE_SIZE - 1))); do
    candidate=$((SUPERSET_PORT_RANGE_START + (offset + i) % SUPERSET_PORT_RANGE_SIZE))
    if superset_port_is_free "$candidate"; then
      VITE_PORT="$candidate"
      break
    fi
  done
  if [ -z "${VITE_PORT:-}" ]; then
    echo "!!! no free port in ${SUPERSET_PORT_RANGE_START}-$((SUPERSET_PORT_RANGE_START + SUPERSET_PORT_RANGE_SIZE - 1)); run 'bun run kill' or export VITE_PORT" >&2
    VITE_PORT="$VITE_PORT_PREFERRED"
  fi
  if [ "$VITE_PORT" -ne "$VITE_PORT_PREFERRED" ]; then
    echo "==> port $VITE_PORT_PREFERRED busy; using $VITE_PORT" >&2
  fi
fi
export VITE_PORT
export PREVIEW_PORT="$VITE_PORT"

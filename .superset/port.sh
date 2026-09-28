#!/usr/bin/env bash
# Per-workspace port block so parallel Superset workspaces can run `dev` (and
# their sidecars) at once. apps/product pins 5173 with strictPort, and the
# embedded Postgres sidecar takes `POSTGRES_PORT`, so every workspace needs its
# own block of ports rather than one.
#
# The workspace ID hashes to a preferred block for stability across restarts;
# if any port in that block is taken -- by a colliding workspace ID, or by a
# stale listener from a torn-down workspace -- we scan upward for a free block
# instead of letting a service die on `address already in use`.
#
# Block layout (offsets from the block base, consumed by @pkgs/postgres-embedded
# via the same env vars):
#   +0 VITE_PORT / PREVIEW_PORT     +1 POSTGRES_PORT
#   +2, +3 stay slack: the object-store and MQTT sidecars take OS-assigned ports.
#
# EMQX (1883 / 8083 / 18083) and the spec harness / wrangler preview ports stay
# machine-wide singletons: only one workspace at a time may bind them.
#
# Override by exporting VITE_PORT before launching (no probing is done then).
SUPERSET_PORT_RANGE_START=5200
SUPERSET_PORT_RANGE_SIZE=300
SUPERSET_PORT_BLOCK=4
# Number of whole blocks that fit in the range.
SUPERSET_PORT_BLOCK_COUNT=$((SUPERSET_PORT_RANGE_SIZE / SUPERSET_PORT_BLOCK))

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

superset_block_is_free() {
  local base="$1"
  local offset
  for offset in $(seq 0 $((SUPERSET_PORT_BLOCK - 1))); do
    if ! superset_port_is_free $((base + offset)); then
      return 1
    fi
  done
  return 0
}

# Seed from the workspace ID, which Superset always exports and which is unique
# per workspace. (There is no SUPERSET_WORKSPACE_NAME: seeding from it meant
# every workspace hashed the literal "root" and collided on one block.)
# Fall back to the worktree path, then the checkout root, for plain shells.
name="${SUPERSET_WORKSPACE_ID:-${SUPERSET_WORKSPACE_PATH:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}}"
sum="$(printf '%s' "$name" | cksum | cut -d' ' -f1)"
# The hashed block this workspace prefers, regardless of what is free right now.
# Teardown needs it to reclaim listeners that probing would have skipped past.
export SUPERSET_PORT_BASE_PREFERRED=$((SUPERSET_PORT_RANGE_START + (sum % SUPERSET_PORT_BLOCK_COUNT) * SUPERSET_PORT_BLOCK))

if [ -n "${VITE_PORT:-}" ]; then
  # Caller pinned the web port; derive the rest of the block from it.
  export SUPERSET_PORT_BASE="$VITE_PORT"
else
  offset=$((sum % SUPERSET_PORT_BLOCK_COUNT))
  for i in $(seq 0 $((SUPERSET_PORT_BLOCK_COUNT - 1))); do
    candidate=$((SUPERSET_PORT_RANGE_START + ((offset + i) % SUPERSET_PORT_BLOCK_COUNT) * SUPERSET_PORT_BLOCK))
    if superset_block_is_free "$candidate"; then
      SUPERSET_PORT_BASE="$candidate"
      break
    fi
  done
  if [ -z "${SUPERSET_PORT_BASE:-}" ]; then
    echo "!!! no free port block in ${SUPERSET_PORT_RANGE_START}-$((SUPERSET_PORT_RANGE_START + SUPERSET_PORT_RANGE_SIZE - 1)); run 'bun run kill' or export VITE_PORT" >&2
    SUPERSET_PORT_BASE="$SUPERSET_PORT_BASE_PREFERRED"
  fi
  if [ "$SUPERSET_PORT_BASE" -ne "$SUPERSET_PORT_BASE_PREFERRED" ]; then
    echo "==> port block $SUPERSET_PORT_BASE_PREFERRED busy; using $SUPERSET_PORT_BASE" >&2
  fi
fi

export SUPERSET_PORT_BASE
export VITE_PORT="$SUPERSET_PORT_BASE"
# Teardown reclaims this one too: probing may have skipped past it.
export VITE_PORT_PREFERRED="$SUPERSET_PORT_BASE_PREFERRED"
export PREVIEW_PORT="$VITE_PORT"
export POSTGRES_PORT=$((SUPERSET_PORT_BASE + 1))

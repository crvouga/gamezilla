#!/usr/bin/env bash
# Select a stable preferred web port per checkout, probing for collisions.
# The stack planner reserves all actual service ports independently through
# the OS. Explicit VITE_PORT conflicts fail in that planner (strict binding).
# Selection is advisory: cleanup always uses the process ownership ledger.
WORKSPACE_PORT_RANGE_START=5200
WORKSPACE_PORT_RANGE_SIZE=300
WORKSPACE_PORT_BLOCK=4
# Number of whole blocks that fit in the range.
WORKSPACE_PORT_BLOCK_COUNT=$((WORKSPACE_PORT_RANGE_SIZE / WORKSPACE_PORT_BLOCK))

workspace_port_is_free() {
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

workspace_block_is_free() {
  local base="$1"
  local offset
  for offset in $(seq 0 $((WORKSPACE_PORT_BLOCK - 1))); do
    if ! workspace_port_is_free $((base + offset)); then
      return 1
    fi
  done
  return 0
}

# Seed from the worktree path: unique per workspace under every orchestrator,
# and stable across restarts. (Tool-specific names are not: seeding from a
# workspace name once made every workspace hash the literal "root" and collide
# on one block.) lib.sh exports WORKSPACE_PATH; a plain shell falls back to git.
name="${WORKSPACE_PATH:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
sum="$(printf '%s' "$name" | cksum | cut -d' ' -f1)"
# The hashed block this workspace prefers, regardless of what is free right now.
# Used only for selection; a port number never proves process ownership.
export WORKSPACE_PORT_BASE_PREFERRED=$((WORKSPACE_PORT_RANGE_START + (sum % WORKSPACE_PORT_BLOCK_COUNT) * WORKSPACE_PORT_BLOCK))

if [ -n "${VITE_PORT:-}" ]; then
  # Caller pinned the web port; derive the rest of the block from it.
  case "$VITE_PORT" in
    *[!0-9]*|'') echo "!!! VITE_PORT must be an integer" >&2; return 1 ;;
  esac
  if [ "$VITE_PORT" -lt 1024 ] || [ "$VITE_PORT" -gt 65532 ]; then
    echo "!!! VITE_PORT must be between 1024 and 65532" >&2
    return 1
  fi
  export WORKSPACE_PORT_BASE="$VITE_PORT"
else
  offset=$((sum % WORKSPACE_PORT_BLOCK_COUNT))
  for i in $(seq 0 $((WORKSPACE_PORT_BLOCK_COUNT - 1))); do
    candidate=$((WORKSPACE_PORT_RANGE_START + ((offset + i) % WORKSPACE_PORT_BLOCK_COUNT) * WORKSPACE_PORT_BLOCK))
    if workspace_block_is_free "$candidate"; then
      WORKSPACE_PORT_BASE="$candidate"
      break
    fi
  done
  if [ -z "${WORKSPACE_PORT_BASE:-}" ]; then
    echo "!!! no free workspace port block; stop your own workspace or set VITE_PORT" >&2
    return 1
  fi
  if [ "$WORKSPACE_PORT_BASE" -ne "$WORKSPACE_PORT_BASE_PREFERRED" ]; then
    echo "==> port block $WORKSPACE_PORT_BASE_PREFERRED busy; using $WORKSPACE_PORT_BASE" >&2
  fi
fi

export WORKSPACE_PORT_BASE
export VITE_PORT="$WORKSPACE_PORT_BASE"
# Preferred port is diagnostic only.
export VITE_PORT_PREFERRED="$WORKSPACE_PORT_BASE_PREFERRED"
export PREVIEW_PORT="$VITE_PORT"
export POSTGRES_PORT=$((WORKSPACE_PORT_BASE + 1))

export STORYBOOK_PORT="${STORYBOOK_PORT:-$((WORKSPACE_PORT_BASE + 2))}"

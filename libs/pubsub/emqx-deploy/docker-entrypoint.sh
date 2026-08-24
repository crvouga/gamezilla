#!/bin/sh
set -eu

PORT="${PORT:-8080}"
export PORT

emqx foreground &
EMQX_PID=$!

cleanup() {
  kill -TERM "$EMQX_PID" 2>/dev/null || true
  wait "$EMQX_PID" 2>/dev/null || true
}
trap cleanup INT TERM EXIT

i=0
while [ "$i" -lt 90 ]; do
  if /opt/emqx/bin/emqx ctl status 2>/dev/null | grep -qi started; then
    break
  fi
  i=$((i + 1))
  sleep 1
done

exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile

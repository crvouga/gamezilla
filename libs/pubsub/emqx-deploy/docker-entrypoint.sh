#!/bin/sh
# Supervises EMQX + Caddy. Either one exiting stops the container, so Railway
# (restartPolicyType = ON_FAILURE) restarts it instead of Caddy serving 502s
# in front of a dead broker.
set -eu

PORT="${PORT:-8080}"
export PORT
DATA_DIR="${EMQX_NODE__DATA_DIR:-/opt/emqx/data}"

# Railway mounts the volume at DATA_DIR owned by root, hiding the image's
# emqx-owned directory. Take ownership once as root, then re-exec as `emqx`.
if [ "$(id -u)" = 0 ]; then
  mkdir -p "$DATA_DIR"
  chown -R emqx:emqx "$DATA_DIR"
  exec runuser -u emqx -- "$0" "$@"
fi

for required in EMQX_API_KEY EMQX_API_SECRET EMQX_JWT_SECRET EMQX_DASHBOARD_PASSWORD; do
  eval "value=\${$required:-}"
  if [ -z "$value" ]; then
    echo "docker-entrypoint: $required is required (set by @libs/pubsub#provision)" >&2
    exit 1
  fi
done

# Credentials come from Railway variables, never from the image.
export EMQX_AUTHENTICATION__1__SECRET="$EMQX_JWT_SECRET"
BOOTSTRAP="$DATA_DIR/api-keys.bootstrap"
umask 077
printf '%s:%s\n' "$EMQX_API_KEY" "$EMQX_API_SECRET" > "$BOOTSTRAP"
export EMQX_API_KEY__BOOTSTRAP_FILE="$BOOTSTRAP"

emqx foreground &
EMQX_PID=$!

cleanup() {
  kill -TERM "$EMQX_PID" "${CADDY_PID:-}" 2>/dev/null || true
  wait 2>/dev/null || true
}
trap cleanup INT TERM EXIT

i=0
until /opt/emqx/bin/emqx ctl status 2>/dev/null | grep -qi started; do
  if ! kill -0 "$EMQX_PID" 2>/dev/null; then
    echo "docker-entrypoint: emqx exited during boot" >&2
    exit 1
  fi
  i=$((i + 1))
  if [ "$i" -ge 120 ]; then
    echo "docker-entrypoint: emqx not started after 120s" >&2
    exit 1
  fi
  sleep 1
done

# The dashboard admin password is re-applied every boot, so the stock
# `public` never survives on a persistent volume.
/opt/emqx/bin/emqx ctl admins passwd admin "$EMQX_DASHBOARD_PASSWORD" >/dev/null

caddy run --config /etc/caddy/Caddyfile --adapter caddyfile &
CADDY_PID=$!

while kill -0 "$EMQX_PID" 2>/dev/null && kill -0 "$CADDY_PID" 2>/dev/null; do
  sleep 5
done
echo "docker-entrypoint: emqx or caddy exited; stopping container" >&2
exit 1

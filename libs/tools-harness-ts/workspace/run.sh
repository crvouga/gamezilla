#!/usr/bin/env bash
# Start stack: repair checkout preparation when needed, replace any stack this
# checkout already runs (healthy, broken or orphaned), then start the owned
# local stack in the foreground. Rerunning always ends with one fresh stack.
set -euo pipefail
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
. "$(dirname "${BASH_SOURCE[0]}")/install.sh"
# Keep the Run pane on one row, including while the tools are being installed.
export WORKSPACE_LAUNCH_LOG="$WORKSPACE_PATH/.cache/localhost-stack/dev.log"
mkdir -p "$(dirname "$WORKSPACE_LAUNCH_LOG")"
: > "$WORKSPACE_LAUNCH_LOG"
# Keep a status descriptor while setup owns stdout and stderr.
exec 3>&1
if [ -t 3 ]; then
  # Quote path bytes before embedding the file URL in a terminal hyperlink.
  log_url="file://$(printf '%s' "$WORKSPACE_LAUNCH_LOG" | od -An -v -tx1 |
    tr -d ' \n' | sed 's/../%&/g;s/%2f/\//g')"
  printf -v log_link '\033]8;;%s\033\\Logs\033]8;;\033\\' "$log_url"
  printf 'Starting · %s' "$log_link" >&3
else
  log_link="Logs $WORKSPACE_LAUNCH_LOG"
fi
launch_failed() {
  local status=$?
  if [ "$status" -ne 0 ]; then
    if [ -t 3 ]; then printf '\r\033[2K' >&3; fi
    printf 'Failed (%s) · %s\n' "$status" "$log_link" >&3
  fi
}
trap launch_failed EXIT
exec 2>>"$WORKSPACE_LAUNCH_LOG"
{
  workspace_prepare_launch
  # Sign-ins the checkout still lacks; one that needs a person is reported
  # here and never stops the stack.
  "$WORKSPACE_PATH/libs/tools-harness-ts/workspace/bootstrap.sh" --launch </dev/null ||
    echo "==> bootstrap incomplete; Localhost continues without it"
  # Stop by checkout ownership before selecting ports so they can be reused.
  echo "==> stopping any stack this checkout already runs"
  bun libs/tools-harness-ts/scripts/kill-dev-stack.ts
  . "$(dirname "${BASH_SOURCE[0]}")/port.sh"
} >>"$WORKSPACE_LAUNCH_LOG"
export TURBO_UI="${TURBO_UI:-stream}"
exec bun run --silent dev -- --web-port "$VITE_PORT" --keep-data "$@" 3>&-

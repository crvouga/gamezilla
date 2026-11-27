#!/usr/bin/env bash
# One-time machine and checkout bootstrap: tools, dependencies and every login
# development needs. Safe to rerun; each step skips what is already done.
# Run it in a terminal to sign in; Localhost runs it with `--launch`, which
# never prompts: a sign-in that needs a person is reported in the launch log
# and the stack starts without it. A complete bootstrap is stamped, so later
# launches skip it.
set -euo pipefail
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
. "$(dirname "${BASH_SOURCE[0]}")/install.sh"

launch=0
[ "${1:-}" = "--launch" ] && launch=1
stamp="$WORKSPACE_PATH/.cache/workspace-bootstrap"
if [ "$launch" = 1 ] && [ -f "$stamp" ]; then
  exit 0
fi

if [ "$launch" = 0 ]; then
  # Tools (mise), dependencies (bun install) and repository git defaults.
  "$WORKSPACE_PATH/libs/tools-harness-ts/workspace/setup.sh"
fi
workspace_activate_tools

failed=()

# GitHub: pull requests, CI logs and the repository's gh-based tasks. The device
# flow prints a code, so it works over a remote session.
if gh auth status >/dev/null 2>&1; then
  echo "==> GitHub: signed in"
else
  echo "==> GitHub: signing in"
  if [ "$launch" = 1 ]; then
    failed+=("GitHub (run ./libs/tools-harness-ts/workspace/bootstrap.sh to sign in)")
  else
    gh auth login --hostname github.com --git-protocol https --web || failed+=(GitHub)
  fi
fi

# Infisical: development and verification credentials, cached in .cache/secrets.
echo "==> Infisical: pulling secrets"
if ! bun run secrets:pull </dev/null; then
  echo "==> Infisical: signing in"
  if [ "$launch" = 0 ] && bun run secrets:login && bun run secrets:pull </dev/null; then
    :
  else
    failed+=(Infisical)
  fi
fi

# Turborepo remote cache, shared by every checkout on this machine. The team
# token lives in Infisical; `turbo login` needs a browser callback on this host,
# which a remote session cannot reach, so write turbo's user config directly.
turbo_config="${XDG_CONFIG_HOME:-$HOME/.config}/turborepo/config.json"
if [ -f "$turbo_config" ] && grep -q '"token"' "$turbo_config"; then
  echo "==> Turborepo remote cache: signed in"
elif TURBO_CONFIG_PATH="$turbo_config" bun run libs/secrets-server-ts/scripts/secrets-run.ts --fixture --isolated -- \
  bun -e '
    const fs = require("node:fs");
    const path = require("node:path");
    const file = process.env.TURBO_CONFIG_PATH;
    const token = process.env.TURBO_TOKEN;
    if (!token) process.exit(1);
    const config = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ ...config, token }, null, 2) + "\n", { mode: 0o600 });
  ' </dev/null; then
  echo "==> Turborepo remote cache: signed in"
else
  failed+=("Turborepo remote cache (TURBO_TOKEN from Infisical)")
fi

if [ "${#failed[@]}" -gt 0 ]; then
  printf '!!! bootstrap incomplete; failed step: %s\n' "${failed[*]}" >&2
  echo '!!! resolve the error above and run ./libs/tools-harness-ts/workspace/bootstrap.sh in a terminal' >&2
  exit 1
fi
mkdir -p "$(dirname "$stamp")"
: >"$stamp"
echo "==> bootstrap complete; use Localhost to run the app and Storybook"

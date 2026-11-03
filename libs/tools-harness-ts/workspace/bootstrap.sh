#!/usr/bin/env bash
# One-time machine and checkout bootstrap: tools, dependencies and every login
# development needs. Safe to rerun; each step skips what is already done.
# Interactive: run it in a terminal (the T3 "Bootstrap" action), never a hook.
set -euo pipefail
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
. "$(dirname "${BASH_SOURCE[0]}")/install.sh"

# Tools (mise), dependencies (bun install) and repository git defaults.
"$WORKSPACE_PATH/libs/tools-harness-ts/workspace/setup.sh"
workspace_activate_tools

failed=()

# The remote preview is email-protected with the developer's git email: it
# must be an address that can receive the sign-in PIN.
email="$(git config user.email || true)"
case "$email" in
  '' | *noreply*)
    echo "==> git user.email '${email}' cannot receive the remote preview sign-in PIN"
    read -r -p "    Email address to use for git and the remote preview: " email
    git config --global user.email "$email"
    ;;
esac
echo "==> git email: $email"

# GitHub: pull requests, CI logs and the repository's gh-based tasks. The device
# flow prints a code, so it works over a remote session.
if gh auth status >/dev/null 2>&1; then
  echo "==> GitHub: signed in"
else
  echo "==> GitHub: signing in"
  gh auth login --hostname github.com --git-protocol https --web || failed+=(GitHub)
fi

# Infisical: development and verification credentials, cached in .cache/secrets.
echo "==> Infisical: pulling secrets"
if ! bun run secrets:pull </dev/null; then
  echo "==> Infisical: signing in"
  if infisical login && bun run secrets:pull </dev/null; then
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
elif TURBO_CONFIG_PATH="$turbo_config" bun run libs/secrets-server-ts/scripts/secrets-run.ts -- \
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
  printf '!!! bootstrap incomplete; sign-in failed for: %s\n' "${failed[*]}" >&2
  echo '!!! resolve the error above and run Bootstrap again' >&2
  exit 1
fi
echo "==> bootstrap complete; use Start stack to run the app and Storybook"

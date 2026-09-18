#!/usr/bin/env bash
# Prepare a fresh Superset workspace: install workspace deps and seed the
# gitignored local-only files (offline secrets cache + generated .env.local)
# from the root checkout so the workspace works without re-auth'ing Infisical.
set -euo pipefail
cd "${SUPERSET_WORKSPACE_PATH:-$(git rev-parse --show-toplevel)}"

echo "==> bun install"
if ! bun install; then
  # `better-sqlite3` (and other native postinstalls) can fail on a machine
  # whose Xcode license has not been accepted. The dependency tree itself is
  # still usable for dev/tests, so finish the install without scripts and warn
  # instead of failing workspace creation.
  echo "!!! bun install postinstall step failed; retrying with --ignore-scripts"
  bun install --ignore-scripts
  echo "!!! native modules (better-sqlite3) are NOT built in this workspace."
  echo "!!! fix: sudo xcodebuild -license accept && bun install"
fi

root="${SUPERSET_ROOT_PATH:-}"
if [ -z "$root" ] || [ ! -d "$root" ]; then
  echo "==> SUPERSET_ROOT_PATH unset; skipping local-file copy"
  exit 0
fi

# Offline secrets cache written by `bun run secrets:pull` (read by
# tools/scripts/secrets-run.ts, i.e. `bun check`, `bun run dev`, deploys).
# Bootstrap it from the root checkout when possible so a fresh workspace does
# not need a second Infisical login; setup stays fast because the cache lives
# next to the checkout rather than per-worktree.
if [ ! -d "$root/.cache/secrets" ] && command -v infisical >/dev/null 2>&1; then
  echo "==> no .cache/secrets in root checkout; running 'bun run secrets:pull'"
  (cd "$root" && bun run secrets:pull) || \
    echo "!!! secrets:pull failed; continuing without the offline secrets cache"
fi

if [ -d "$root/.cache/secrets" ]; then
  echo "==> copying .cache/secrets"
  mkdir -p .cache/secrets
  cp -R "$root/.cache/secrets/." .cache/secrets/
  chmod -R go-rwx .cache/secrets
else
  echo "==> no .cache/secrets in root checkout; run 'bun run secrets:pull' (needs the Infisical CLI logged in)"
fi

# Generated Vite env files (apps/*/scripts/setup-env.ts rewrites them on dev).
for env_file in apps/product/.env.local apps/client/.env.local; do
  if [ -f "$root/$env_file" ]; then
    echo "==> copying $env_file"
    mkdir -p "$(dirname "$env_file")"
    cp "$root/$env_file" "$env_file"
  fi
done

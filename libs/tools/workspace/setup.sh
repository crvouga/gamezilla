#!/usr/bin/env bash
# Prepare a fresh workspace: install workspace deps and seed the gitignored
# local-only files (offline secrets cache + generated .env.local) from the root
# checkout so the workspace works without re-auth'ing Infisical.
set -euo pipefail
# shellcheck source=libs/tools/workspace/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

# System tools are pinned in mise.toml (`mise install`). Each worktree is a
# new path, so trust it first. better-sqlite3@13 ships its N-API prebuild in
# the package and is not a trustedDependency: `bun install` must not run
# node-gyp. Do not add better-sqlite3 back to trustedDependencies.
if command -v mise >/dev/null 2>&1; then
  echo "==> mise install"
  mise trust --quiet mise.toml
  mise install || echo "!!! mise install failed; run 'mise install' in this workspace"
else
  echo "!!! mise not found; install it (https://mise.jdx.dev) and run 'mise install'"
fi

# Bun resolves every declared workspace before it installs any package. A fresh
# linked worktree has only the submodule gitlink, so materialize submodule
# workspaces before asking Bun to resolve the workspace graph.
echo "==> git submodule update --init --recursive"
git submodule update --init --recursive || \
  echo "!!! submodule initialization failed; continuing with the available checkout"

echo "==> bun install"
if ! bun install; then
  # A failed lifecycle script must not abort workspace creation. Retry
  # without scripts, then write the gitignored generated files the root
  # postinstall would have written. better-sqlite3 does not need that script;
  # ffmpeg-static and onnxruntime-node download their binaries in one.
  echo "!!! bun install failed; retrying with --ignore-scripts"
  if bun install --ignore-scripts; then
    bun run generate || echo "!!! bun run generate failed; run it in this workspace"
    echo "!!! install scripts did not run. ffmpeg-static and onnxruntime-node may be missing their binaries."
  else
    echo "!!! dependency install is still incomplete; run this setup again when package sources are available"
  fi
fi

# `main` only moves through a merged PR: enable the repo hooks (pre-commit,
# pre-push) for this clone. `core.hooksPath` lives in the shared git config, so
# it covers every worktree and the root checkout, not just this one.
if [ "$(git config --get core.hooksPath || true)" != 'libs/tools/githooks' ]; then
  echo "==> enabling libs/tools/githooks (pre-commit, pre-push)"
  git config core.hooksPath libs/tools/githooks || \
    echo "!!! could not set core.hooksPath; run 'bun run hooks:install' manually"
fi

root="$WORKSPACE_ROOT_PATH"
if [ "$root" = "$WORKSPACE_PATH" ]; then
  echo "==> running in the root checkout; skipping local-file copy"
  exit 0
fi

# Offline secrets cache written by `bun run secrets:pull` (read by
# libs/secrets-server/scripts/secrets-run.ts, i.e. `bun check:local`, `bun run dev`, deploys).
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

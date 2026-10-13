#!/usr/bin/env bash
# One workspace step. `bun dev` runs install and merge as Turborepo tasks
# (`//#workspace:<step>`), so the terminal shows a step per pane and prints a
# step's output only when it fails. Those two exit non-zero while they leave
# work. local-files is cold-start work inside run.sh: it names what it could
# not finish and still returns success, so a missing Infisical login cannot
# fail the launch. There are no git hooks.
set -euo pipefail
# shellcheck source=libs/tools/workspace/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
# shellcheck source=libs/tools/workspace/install.sh
. "$(dirname "${BASH_SOURCE[0]}")/install.sh"

# Reads manifests only and costs milliseconds when nothing changed; it never
# runs a test or boots a service.
step_install() {
  if workspace_install_is_current; then
    return 0
  fi
  echo "==> package manifests changed since the last install"
  workspace_install
}

step_merge() {
  workspace_warn_unmerged
}

# The gitignored local-only files (offline secrets cache + generated
# .env.local), seeded from the root checkout so the workspace works without
# re-auth'ing Infisical.
step_local_files() {
  local root="$WORKSPACE_ROOT_PATH" env_file
  if [ "$root" = "$WORKSPACE_PATH" ]; then
    return 0
  fi

  # Offline secrets cache written by `bun run secrets:pull` (read by
  # libs/secrets-server/scripts/secrets-run.ts, i.e. `bun check-pr`, `bun run dev`, deploys).
  # Bootstrap it from the root checkout when possible so a fresh workspace does
  # not need a second Infisical login; setup stays fast because the cache lives
  # next to the checkout rather than per-worktree.
  if [ ! -d "$root/.cache/secrets" ] && command -v infisical >/dev/null 2>&1; then
    echo "==> no .cache/secrets in root checkout; running 'bun run secrets:pull'"
    (cd "$root" && bun run secrets:pull) ||
      echo "!!! secrets:pull failed; continuing without the offline secrets cache"
  fi

  # Generated Vite env files (apps/*/scripts/setup-env.ts rewrites them on dev).
  for env_file in apps/product/.env.local apps/client/.env.local; do
    if [ -f "$root/$env_file" ]; then
      mkdir -p "$(dirname "$env_file")"
      cp "$root/$env_file" "$env_file"
    fi
  done

  if [ ! -d "$root/.cache/secrets" ]; then
    echo "!!! no .cache/secrets in root checkout; run 'bun run secrets:pull' (needs the Infisical CLI logged in)"
    return 0
  fi
  mkdir -p .cache/secrets
  cp -R "$root/.cache/secrets/." .cache/secrets/
  chmod -R go-rwx .cache/secrets
}

case "${1:-}" in
  install) step_install ;;
  merge) step_merge ;;
  local-files) step_local_files ;;
  *)
    echo "usage: step.sh install|merge|local-files" >&2
    exit 2
    ;;
esac

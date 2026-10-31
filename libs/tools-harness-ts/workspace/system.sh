#!/usr/bin/env bash
# Sourced by run.sh after lib.sh. System tools precede app dependencies, even
# in a warm workspace: pins can change, and installed tools can be removed.

workspace_bootstrap_mise() {
  if command -v mise >/dev/null 2>&1; then
    return 0
  fi
  local mise_bin="$HOME/.local/bin" installer status=0
  if [ ! -x "$mise_bin/mise" ]; then
    echo "==> installing mise"
    installer="$(mktemp "${TMPDIR:-/tmp}/workspace-mise.XXXXXX")" || return 1
    if curl --fail --silent --show-error --location https://mise.run --output "$installer"; then
      MISE_INSTALL_PATH="$mise_bin/mise" sh "$installer" || status=$?
    else
      status=$?
    fi
    rm -f "$installer"
    [ "$status" -eq 0 ] || return "$status"
  fi
  export PATH="$mise_bin:$PATH"
  command -v mise >/dev/null 2>&1
}

workspace_system() {
  local status=0 mise_env
  workspace_bootstrap_mise || return 1
  mise trust --quiet mise.toml || return 1
  # Honor a repository lockfile, but do not generate one from a user's global
  # mise lockfile setting in this pinned, lockfile-free repository.
  if [ -f mise.lock ]; then
    mise install --yes || status=$?
  else
    MISE_LOCKFILE=false mise install --yes || status=$?
  fi
  # GUI launchers need not load the user's shell profile. Apply tool paths
  # here, including Bun and Node, before any dependency lifecycle scripts.
  mise_env="$(mise env --shell bash)" || return 1
  eval "$mise_env"
  return "$status"
}

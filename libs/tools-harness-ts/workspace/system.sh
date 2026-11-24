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

# The version a mise config in force requires, when the installed mise is
# older than it; nothing otherwise. A workstation's own config can raise it
# (`min_version`) before anything has updated the binary, and mise then
# refuses every command.
workspace_mise_required_version() {
  MISE_OFFLINE=1 MISE_AUTO_INSTALL=0 mise env --shell bash </dev/null 2>&1 >/dev/null |
    sed -n 's/.*mise version \([0-9][0-9.]*\) is required, but you are using.*/\1/p' |
    head -n 1
}

# Brings an outdated mise up to the version a config requires, in place, so a
# raised requirement never stops a launch. The official installer puts that
# exact release where this mise already is. Returns non-zero when mise is not
# outdated (its refusal was about something else) or could not be updated.
workspace_update_mise() {
  local required target installer status=0
  required="$(workspace_mise_required_version || true)"
  [ -n "$required" ] || return 1
  target="$(command -v mise)" || return 1
  echo "==> updating mise to $required, which a mise config requires"
  installer="$(mktemp "${TMPDIR:-/tmp}/workspace-mise.XXXXXX")" || return 1
  if curl --fail --silent --show-error --location https://mise.run --output "$installer"; then
    MISE_VERSION="v$required" MISE_INSTALL_PATH="$target" sh "$installer" || status=$?
  else
    status=$?
  fi
  rm -f "$installer"
  if [ "$status" -ne 0 ]; then
    echo "!!! mise $required is required and could not be installed over $target" >&2
    return "$status"
  fi
  required="$(workspace_mise_required_version || true)"
  if [ -n "$required" ]; then
    echo "!!! mise is still older than the required $required after updating $target" >&2
    return 1
  fi
}

# This checkout's pinned tools that are not installed, one name per line.
# Read offline from mise.toml alone: a workstation's global tools never decide
# whether this checkout can start. Lazy tools install on first use.
workspace_missing_tools() {
  MISE_OFFLINE=1 MISE_AUTO_INSTALL=0 mise ls --current --missing --local </dev/null 2>/dev/null |
    awk '$3 != "(lazy)" { print $1 }'
}

workspace_system() {
  local status=0 mise_env missing
  workspace_bootstrap_mise || return 1
  # Asked only when mise refuses: a healthy launch runs no extra command.
  if ! mise trust --quiet mise.toml </dev/null 2>/dev/null; then
    workspace_update_mise || true
    mise trust --quiet mise.toml </dev/null || return 1
  fi
  # Install only what this checkout pins and lacks, so a warm launch touches
  # no network and a broken global tool cannot stall it. Downloads are long:
  # their progress stays on the terminal, and stdin is closed so a prompt
  # fails instead of waiting unseen. lib.sh turns lockfile mode off unless
  # the repository commits mise.lock.
  missing="$(workspace_missing_tools)" || return 1
  if [ -n "$missing" ]; then
    echo "==> installing pinned tools: $(printf '%s' "$missing" | tr '\n' ' ')"
    # shellcheck disable=SC2086 # one tool name per word
    mise install --yes $missing </dev/null >&2 || status=$?
  fi
  # GUI launchers need not load the user's shell profile. Apply tool paths
  # here, including Bun and Node, before any dependency lifecycle scripts.
  mise_env="$(MISE_OFFLINE=1 MISE_AUTO_INSTALL=0 mise env --shell bash </dev/null)" || return 1
  eval "$mise_env"
  return "$status"
}

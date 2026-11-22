#!/usr/bin/env bash
# Sourced by step.sh and run.sh, after lib.sh. Keeps the installed
# dependencies in step with the checkout.
#
# A merge, pull or branch switch rewrites package manifests without touching
# node_modules, and dev then dies on whichever module the checkout newly
# expects. The fingerprint covers every input `bun install` resolves from: the
# lockfile and each package manifest. It is stamped inside node_modules after a
# complete install, so removing node_modules invalidates it too.
#
# better-sqlite3@13 ships its N-API prebuild and is not a trustedDependency:
# `bun install` must not run node-gyp. Do not add it back to trustedDependencies.
WORKSPACE_INSTALL_STAMP="node_modules/.workspace-install-fingerprint"

workspace_install_fingerprint() {
  local manifests
  # Hidden directories hold caches and tool output, never a workspace.
  manifests="$(find . \( -name node_modules -o -name '.?*' \) -prune -o -name package.json -print 2>/dev/null |
    LC_ALL=C sort || true)"
  {
    printf '%s\n' "$manifests"
    cat bun.lock mise.toml bunfig.toml 2>/dev/null || true
    # One `cat` for every manifest: a process per file costs seconds here.
    printf '%s\n' "$manifests" | tr '\n' '\0' | xargs -0 cat 2>/dev/null || true
  } | cksum
}

workspace_install_is_current() {
  [ -x node_modules/.bin/turbo ] &&
    [ -f "$WORKSPACE_INSTALL_STAMP" ] &&
    [ "$(cat "$WORKSPACE_INSTALL_STAMP")" = "$(workspace_install_fingerprint)" ]
}

# Returns non-zero while the install is incomplete. Only a complete install is
# stamped, so the next launch tries again instead of trusting a partial one.
workspace_install_locked() {
  workspace_install_is_current && return 0
  local log backup dir
  rm -f "$WORKSPACE_INSTALL_STAMP"
  log="$(mktemp .cache/workspace-install.XXXXXX)" || return 1
  echo "==> bun install --frozen-lockfile"
  if ! TURBO_UI=false bun install --frozen-lockfile >"$log" 2>&1; then
    if ! grep -Eq '^EEXIST: (File exists: failed to (symlink dependencies|link package)|failed to link binaries)' "$log"; then
      cat "$log" >&2
      rm -f "$log"
      return 1
    fi
    # Different Bun versions can leave conflicting links in the isolated
    # store and bin directories. Rebuild just that generated state.
    echo "==> rebuilding conflicting Bun dependency links"
    local links=()
    for dir in node_modules/.bun node_modules/.bin {apps,libs,pkgs}/*/node_modules/.bin; do
      [ -e "$dir" ] || [ -L "$dir" ] || continue
      if [ -L "$(dirname "$dir")" ]; then
        echo "!!! cannot repair linked dependency directory $(dirname "$dir")" >&2
        return 1
      fi
      links+=("$dir")
    done
    backup="$(mktemp -d .cache/workspace-links.XXXXXX)" || return 1
    for dir in "${links[@]}"; do
      mkdir -p "$backup/$(dirname "$dir")" || return 1
      mv "$dir" "$backup/$dir" || return 1
    done
    if ! TURBO_UI=false bun install --frozen-lockfile >"$log" 2>&1; then
      cat "$log" >&2
      echo "!!! previous dependency links saved in $backup" >&2
      return 1
    fi
    rm -rf "$backup"
  fi
  rm -f "$log"
  mkdir -p "$(dirname "$WORKSPACE_INSTALL_STAMP")"
  workspace_install_fingerprint >"$WORKSPACE_INSTALL_STAMP"
}

workspace_install() {
  mkdir -p .cache
  # Serialize startup actions in this checkout. The OS releases the lock
  # even if the terminal or installer is killed.
  if command -v flock >/dev/null 2>&1; then
    flock .cache/workspace-install.lock bash "${BASH_SOURCE[0]}"
  elif command -v lockf >/dev/null 2>&1; then
    lockf -k .cache/workspace-install.lock bash "${BASH_SOURCE[0]}"
  else
    workspace_install_locked
  fi
}

workspace_prepare_launch() {
  # A first activation that fails is repaired below; only the activation
  # after the repair says why it failed.
  if ! workspace_install_is_current || ! workspace_activate_tools quiet; then
    echo "==> preparing missing or changed workspace dependencies"
    "$WORKSPACE_PATH/libs/tools-harness-ts/workspace/setup.sh" || return 1
    workspace_activate_tools
  fi
}

# A boot from a half-merged tree fails on a module or syntax error that says
# nothing about the merge. Name the cause before dev prints the symptom.
# Returns non-zero while the merge is unfinished.
workspace_warn_unmerged() {
  local count marked
  count="$(git diff --name-only --diff-filter=U -z 2>/dev/null | tr -cd '\0' | wc -c | tr -d ' ' || true)"
  if [ "${count:-0}" -eq 0 ]; then
    return 0
  fi
  echo "!!! merge in progress: $count unmerged path(s); dev may fail until the merge is concluded" >&2
  marked="$(git diff --name-only --diff-filter=U -z 2>/dev/null |
    xargs -0 grep -lE '^(<<<<<<<|>>>>>>>)( |$)' 2>/dev/null || true)"
  if [ -n "$marked" ]; then
    echo "!!! conflict markers remain in:" >&2
    printf '%s\n' "$marked" | sed 's/^/      /' >&2
  fi
  return 1
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  set -euo pipefail
  workspace_install_locked
fi

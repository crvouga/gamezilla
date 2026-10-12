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
    cat bun.lock 2>/dev/null || true
    # One `cat` for every manifest: a process per file costs seconds here.
    printf '%s\n' "$manifests" | tr '\n' '\0' | xargs -0 cat 2>/dev/null || true
  } | cksum
}

workspace_install_is_current() {
  [ -f "$WORKSPACE_INSTALL_STAMP" ] &&
    [ "$(cat "$WORKSPACE_INSTALL_STAMP")" = "$(workspace_install_fingerprint)" ]
}

# Returns non-zero while the install is incomplete. Only a complete install is
# stamped, so the next launch tries again instead of trusting a partial one.
workspace_install() {
  echo "==> bun install"
  # The install's own `postinstall` is a Turborepo run. Stream that one so it
  # does not open a second terminal UI. The prefix stays on this command:
  # exporting it would make the later dev run stream too.
  if TURBO_UI=false bun install; then
    # Stamp after installing: `bun install` may rewrite the lockfile.
    mkdir -p "$(dirname "$WORKSPACE_INSTALL_STAMP")"
    workspace_install_fingerprint >"$WORKSPACE_INSTALL_STAMP"
    return 0
  fi
  # A failed lifecycle script must not abort the caller. Retry without
  # scripts, then write the gitignored generated files the root postinstall
  # would have written. better-sqlite3 does not need that script;
  # ffmpeg-static and onnxruntime-node download their binaries in one.
  echo "!!! bun install failed; retrying with --ignore-scripts"
  if TURBO_UI=false bun install --ignore-scripts; then
    TURBO_UI=false bun run generate || echo "!!! bun run generate failed; run it in this workspace"
    echo "!!! install scripts did not run. ffmpeg-static and onnxruntime-node may be missing their binaries."
  else
    echo "!!! dependency install is still incomplete; Run retries it once package sources are available"
  fi
  return 1
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

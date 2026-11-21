#!/usr/bin/env bash
# `bun run design:check [-- <playwright args>]`: what a design pull request
# must pass — token generation, lint, the Storybook build and the visual
# tests. Extra arguments go to the visual tests (`-- --grep Button`).
set -uo pipefail
root="$(git rev-parse --show-toplevel)"
cd "$root"
results="pkgs/ui-root-harness-ts/.cache/storybook-test-results"
status=0
step() {
  echo "==> $*"
  "$@" || { status=1; echo "FAILED: $*" >&2; }
}
step bun run tokens:generate
step bun run lint
step bun run storybook:build
if [ "$status" -eq 0 ]; then
  step bun run storybook:test "$@"
else
  echo "Skipping the visual tests: an earlier step failed." >&2
fi
if [ -d "$results" ] && [ -n "$(find "$results" -name '*-diff.png' -print -quit)" ]; then
  echo
  echo "Visual differences (expected, actual and diff images):"
  find "$results" -name '*-diff.png' | sed "s|^|  $root/|"
  echo "All results: $root/$results"
fi
exit "$status"

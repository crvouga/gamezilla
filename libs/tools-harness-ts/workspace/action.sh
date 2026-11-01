#!/usr/bin/env bash
# On-demand T3 actions share pinned tools and checkout-owned process cleanup.
set -euo pipefail
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
workspace_activate_tools
export TURBO_UI="${TURBO_UI:-stream}"
case "${1:-}" in
  format) exec bun fmt ;;
  storybook|storybook-lan)
    . "$(dirname "${BASH_SOURCE[0]}")/port.sh"
    if [ "$1" = "storybook-lan" ]; then export STORYBOOK_HOST=0.0.0.0; fi
    exec bun run storybook
    ;;
  storybook-build) exec bun run storybook:build ;;
  diagnostics) exec bun obs last ;;
  feedback) exec bun feedback --list ;;
  simulators) exec bun run sims:open ;;
  *) echo 'usage: action.sh format|storybook|storybook-lan|storybook-build|diagnostics|feedback|simulators' >&2; exit 2 ;;
esac

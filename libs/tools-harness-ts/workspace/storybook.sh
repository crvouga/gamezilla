#!/usr/bin/env bash
# Storybook alone: repair checkout preparation when needed, then run this
# checkout's Storybook in the foreground on its own port. Localhost already
# includes Storybook; this action is for UI work that needs no product stack.
set -euo pipefail
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
. "$(dirname "${BASH_SOURCE[0]}")/install.sh"
workspace_prepare_launch
. "$(dirname "${BASH_SOURCE[0]}")/port.sh"
exec bun run --silent storybook "$@"

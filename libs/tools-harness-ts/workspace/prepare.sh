#!/usr/bin/env bash
# Workspace creation remains available even when strict dependency setup fails.
# Starting services still requires a successful setup.sh dependency fingerprint.
set -euo pipefail
if ! "$(dirname "${BASH_SOURCE[0]}")/setup.sh"; then
  echo "!!! environment preparation is incomplete; resolve the error and rerun setup.sh before starting services" >&2
fi
echo "==> workspace may be opened"

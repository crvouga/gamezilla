#!/bin/sh
set -eu
node .overhaul-evidence/ui-ux-overhaul/round-2/compose-stories.mjs compose \
 --before .overhaul-evidence/ui-ux-overhaul/round-2/before \
 --after .overhaul-evidence/ui-ux-overhaul/round-2/after \
 --out .overhaul-evidence/ui-ux-overhaul/round-2/pairs \
 --before-label 'Round 1 (90bfe38de)' --after-label 'Round 2 (7580af910)' \
 --resolve-from pkgs/ui-root-harness-ts \
 --browser-path '/Users/chrisvouga/.local/share/mise/installs/http-chrome-for-testing/154.0.8037.92/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'

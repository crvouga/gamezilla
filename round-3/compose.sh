#!/bin/sh
set -eu
node .overhaul-evidence/ui-ux-overhaul/round-3/compose-stories.mjs compose \
 --before .overhaul-evidence/ui-ux-overhaul/round-3/before \
 --after .overhaul-evidence/ui-ux-overhaul/round-3/after \
 --out .overhaul-evidence/ui-ux-overhaul/round-3/pairs \
 --before-label 'Round 2 (7580af910)' --after-label 'Round 3 (897a7562d)' \
 --resolve-from pkgs/ui-root-harness-ts \
 --browser-path '/Users/chrisvouga/.local/share/mise/installs/http-chrome-for-testing/154.0.8037.92/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'

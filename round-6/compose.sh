#!/bin/sh
set -eu
node .overhaul-evidence/ui-ux-overhaul/round-6/compose-stories.mjs compose \
 --before .overhaul-evidence/ui-ux-overhaul/round-6/before \
 --after .overhaul-evidence/ui-ux-overhaul/round-6/after \
 --out .overhaul-evidence/ui-ux-overhaul/round-6/pairs \
 --before-label 'Round 5 (d2ee6467e)' --after-label 'Round 6 candidate' \
 --resolve-from pkgs/ui-root-harness-ts \
 --browser-path '/Users/chrisvouga/.local/share/mise/installs/http-chrome-for-testing/154.0.8037.92/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'

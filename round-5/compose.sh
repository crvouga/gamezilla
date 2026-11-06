#!/bin/sh
set -eu
node .overhaul-evidence/ui-ux-overhaul/round-5/compose-stories.mjs compose \
 --before .overhaul-evidence/ui-ux-overhaul/round-5/before \
 --after .overhaul-evidence/ui-ux-overhaul/round-5/after \
 --out .overhaul-evidence/ui-ux-overhaul/round-5/pairs \
 --before-label 'Round 4 (8a3538fca)' --after-label 'Round 5 candidate' \
 --resolve-from pkgs/ui-root-harness-ts \
 --browser-path '/Users/chrisvouga/.local/share/mise/installs/http-chrome-for-testing/154.0.8037.92/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'

#!/bin/sh
set -eu
node .agents/skills/ui-ux-overhaul/scripts/capture-stories.mjs capture \
 --storybook pkgs/ui-root-harness-ts/.cache/storybook \
 --stories-file .overhaul-evidence/ui-ux-overhaul/round-7/board-story-ids.txt \
 --out .overhaul-evidence/ui-ux-overhaul/round-7/after \
 --viewports phone=390x844,desktop=1440x900 --themes light,dark \
 --resolve-from pkgs/ui-root-harness-ts \
 --browser-path '/Users/chrisvouga/.local/share/mise/installs/http-chrome-for-testing/154.0.8037.92/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' \
 --ready-selector '#storybook-root[data-story-ready="true"][data-story-status="success"]' --wait-ms 0 --viewport-only

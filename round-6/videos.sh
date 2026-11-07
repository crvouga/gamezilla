#!/bin/sh
set -eu
node .overhaul-evidence/ui-ux-overhaul/round-6/capture-videos.mjs capture \
 --resume --storybook pkgs/ui-root-harness-ts/.cache/storybook \
 --stories-file .overhaul-evidence/ui-ux-overhaul/round-6/video-story-ids.txt \
 --out .overhaul-evidence/ui-ux-overhaul/round-6/journeys/recordings \
 --viewports phone=390x844,desktop=1440x900 --themes light \
 --resolve-from pkgs/ui-root-harness-ts \
 --browser-path '/Users/chrisvouga/.local/share/mise/installs/http-chrome-for-testing/154.0.8037.92/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' \
 --ready-selector '#storybook-root[data-story-ready="true"]' --wait-ms 0

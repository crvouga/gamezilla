#!/bin/sh
set -eu
NODE_OPTIONS=--max-old-space-size=8192 PLAYWRIGHT_JSON_OUTPUT_NAME="$PWD/.overhaul-evidence/ui-ux-overhaul/round-3/interactions/target-and-pointer/browser-results.json" bunx turbo run storybook:test --filter=@pkgs/ui-root-harness-ts --concurrency=1 --only -- --workers=2 --reporter=line,json --grep 'screens-puzzles-chess-play--|correct-target-before-firing'

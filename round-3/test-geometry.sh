#!/bin/sh
set -eu
NODE_OPTIONS=--max-old-space-size=8192 PLAYWRIGHT_JSON_OUTPUT_NAME="$PWD/.overhaul-evidence/ui-ux-overhaul/round-3/interactions/geometry/browser-results.json" bunx turbo run storybook:test --filter=@pkgs/ui-root-harness-ts --concurrency=1 --only -- --workers=1 --reporter=line,json --grep 'font readiness|enlarged-coordinates|screens-puzzles-chess-play--solving|screens-games-hearts-board--pass-through-first-trick|screens-games-battleship-setup--enlarged-placement|screens-games-quoridor-hill--pass-and-continue'

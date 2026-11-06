#!/bin/sh
set -eu
NODE_OPTIONS=--max-old-space-size=8192 bunx turbo run storybook:test --filter=@pkgs/ui-root-harness-ts --concurrency=1 --only -- --workers=2 --reporter=line,json --grep 'screens-games-battleship-board--correct-target-before-firing|screens-games-pong-court--return-score-and-reconnect'

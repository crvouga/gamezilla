#!/bin/sh
set -eu
NODE_OPTIONS=--max-old-space-size=8192 bunx turbo run storybook:test --filter=@pkgs/ui-root-harness-ts --only --concurrency=1 -- --workers=2 --reporter=line,json --grep 'screens-games-quoridor-(classic|hill)--|screens-games-word-tiles-board--enlarged-coordinates|screens-games-battleship-setup--enlarged-placement'

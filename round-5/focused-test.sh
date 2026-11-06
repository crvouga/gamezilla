#!/bin/sh
set -eu
NODE_OPTIONS=--max-old-space-size=8192 bunx turbo run storybook:test --filter=@pkgs/ui-root-harness-ts --concurrency=1 --only -- --workers=2 --reporter=line,json --grep 'screens-games-frame-geometry|screens-games-quoridor-hill--(precise-coordinates|four-player-round|reach-the-hill|recover-wall-placement)|screens-games-word-tiles-(board--(opening|your-turn|enlarged-coordinates)|puzzle--enlarged-blank)|screens-games-sokoban-puzzle--(solve-with-keyboard|corner-recovery)|font readiness.*puzzle'

# Shared board round six

Findings: round-five A J4 locked fleet contradictory editing copy; A/B J9 four-seat record notation splitting; A J14 four-player clipped identity/counters. Inspected cited immutable after PNGs before changes.

Changes:
- libs/battleship-client-ts/src/battleship-setup-board.tsx: omit editing/refusal guidance when locked, retain lock explanation and disabled controls.
- libs/battleship-client-ts/tests/setup-board.test.tsx: locked partial fleet cannot show either placement instruction.
- pkgs/ui-root-client-ts/src/game-move-list/index.tsx and game-move-list.module.css: many-seat table marker above whole notation; ordinary two-seat worded record unchanged.
- pkgs/ui-root-client-ts/src/game-session-layout/game-session-layout.module.css: four-participant phone grid two columns; full label wrapping instead of truncation.
- libs/quoridor-client-ts/src/quoridor-board-hill.stories.tsx: FourPlayerRound checks record button one-line notation after wall commit.
- libs/light-cycles-client-ts/src/light-cycles-board-view.stories.tsx: QuadSteering runs bounds before input, including scroll extent checks.
- pkgs/ui-root-harness-ts/tests/storybook/stories.checks.ts: two literal native regressions.
- Three individual known-bug JSONs: battleship-locked-editing-guidance, quoridor-four-seat-record-split-notation, light-cycles-quad-clipped-identities.
- docs/SELF_SERVICE_READINESS.md: multiplayer row updated. Other concurrent readiness edits belong to Word Tiles worker.

Verification: round-6-parent-checks.log 11/12 tasks passed (Battleship/LightCycles/Quoridor lint, tc, tests plus shared UI tc/tests); shared UI lint hit concurrent WordTile cyclic imports. round-6-parent-harness-checks.log harness tc passed, lint hit concurrent WordTile test non-null assertion. Worker notified. git diff --check passes. Native geometry and fresh images/video NOT executed; integration required. No commits, no reference acceptance, no ratings.

Round-five canonical Ubuntu run 42294182190 now success. Review summary posted PR comment 6697378247 with explicit incomplete status (completion/artifact audit omissions). No acceptance claimed.

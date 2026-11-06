# Round-five integration ownership

Implementation ownership was reconciled against the initial dirty-path inventory, unique worker handoffs and the actual diff. The historical generic BOARD handoff is not authoritative; chess-match-round-5.md and pong-round-5.md contain unrelated older content. Their source changes and retained worker logs are the basis for integration.

Integration changes: distinguish saved completion from current Sokoban completion; preserve saved completion through the fixture restart; update saved-notice consumers; compact four-seat facts and desktop rail; fix Quoridor toolbar wrapping and rack corner hits; bound the fitted WordTiles puzzle board while preserving enlarged cell size; register literal regressions; update readiness rows and generated metadata checks. No Numberlink Next/Pack duplicates were introduced.

| Package / directory | Intended paths |
|---|---:|
| docs/SELF_SERVICE_READINESS.md | 1 |
| libs/app-root-shared-ts | 1 |
| libs/battleship-client-ts | 11 |
| libs/chess-puzzle-client-ts | 10 |
| libs/chess-root-client-ts | 1 |
| libs/game-matchmaking-client-ts | 1 |
| libs/game-puzzle-client-ts | 7 |
| libs/game-puzzle-harness-ts | 2 |
| libs/game-session-client-ts | 12 |
| libs/game-session-harness-ts | 1 |
| libs/hearts-client-ts | 9 |
| libs/light-cycles-client-ts | 5 |
| libs/numberlink-client-ts | 6 |
| libs/numberlink-harness-ts | 2 |
| libs/pong-client-ts | 6 |
| libs/quoridor-client-ts | 14 |
| libs/runtime-harness-ts | 4 |
| libs/sokoban-client-ts | 4 |
| libs/sokoban-harness-ts | 3 |
| libs/tools-harness-ts | 50 |
| libs/word-tiles-client-ts | 10 |
| pkgs/chess-board-root-client-ts | 9 |
| pkgs/chess-board-root-harness-ts | 1 |
| pkgs/chess-board-root-shared-ts | 1 |
| pkgs/turn-game-shared-ts | 1 |
| pkgs/ui-root-client-ts | 26 |
| pkgs/ui-root-harness-ts | 8 |

No specs, baseline images, bulky media, unrelated formatting changes, merge, watch or scores are included in the intended source paths. The complete explicit path list is in intended-source-paths.json.

## Hosted follow-up repairs

The exhaustive ChessBoardProps proof now maps guidancePlacement to executable before/after help placement examples. Numberlink and Sokoban cross-device/offline consumers read the saved-completion copy without changing identity, solved-board or pack-progress assertions. Pong retains one accessible active-rally status for the production court reader without an overlay or physics changes. Battleship target tools fit at 1440×844 through tighter group spacing, preserving control sizes and pre-scroll assertions. Each repair has a literal regression and known-bug entry.

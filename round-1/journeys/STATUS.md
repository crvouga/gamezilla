# Round 1 journey evidence

All 528 initial browser cases passed readiness/play, browser-error and serious/critical axe assertions before failing pixel comparison. This does not establish complete production journeys. Videos show automated Storybook plays; no manual QA. No ratings assigned.

| Journey | Surface | Named interaction | Remaining gap |
|---|---|---|---|
| J1 | ChessGameBoard | screens-games-chess-board--promotion-choice | Promotion choice is exercised; a complete ordinary match and network turn progression are not established. |
| J2 | ChessPuzzleBoard | screens-puzzles-chess-play--solve-journey | SolveJourney and WrongMoveRecovery exercise puzzle fixture completion; persisted attempt history and overview navigation remain unproven. |
| J3 | ConnectFourGameBoard | screens-games-connect-four-board--connect-four-to-win | ConnectFourToWin reaches a winning board through stateful play; network match continuation remains unproven. |
| J4 | BattleshipSetupBoard | screens-games-battleship-setup--arrange-full-fleet | ArrangeFullFleet covers intrinsic fleet setup; persisted submission to a live match remains unproven. |
| J5 | BattleshipBoard | screens-games-battleship-board--sink-the-fleet | SinkTheFleet reaches a fleet defeat through the fixture; network turn and reconnect remain unproven. |
| J6 | NumberlinkPlayer | screens-games-numberlink-puzzle--complete-with-keyboard | CompleteWithKeyboard reaches puzzle completion; persisted attempt, undo/redo and overview navigation remain unproven. |
| J7 | SokobanPlayer | screens-games-sokoban-puzzle--solve-with-keyboard | SolveWithKeyboard reaches puzzle completion; shared undo/redo/restart, deadlock recovery and overview navigation remain unproven. |
| J8 | QuoridorBoard | screens-games-quoridor-classic--reach-opposite-edge | ReachOppositeEdge completes the local rules fixture; multiplayer synchronization/reconnect remains unproven. |
| J9 | QuoridorBoard | screens-games-quoridor-hill--reach-the-hill | ReachTheHill and FourPlayerRound cover local goal and four-seat progression; network/spectator recovery remains unproven. |
| J10 | WordTilesBoardView | screens-games-word-tiles-board--recall-and-restore | RecallAndRestore and AssignABlank cover draft editing; accepted submission/next turn, exchange/pass and lexicon recovery remain unproven. |
| J11 | WordTilesPuzzlePlayerView | screens-games-word-tiles-puzzle--reach-target | ReachTarget completes the controlled target fixture; persisted attempt, blank assignment and lexicon recovery remain unproven. |
| J12 | HeartsBoard | screens-games-hearts-board--complete-trick | CompleteTrick and PassAcknowledged cover fixture transitions; a complete hand/match and network acknowledgement remain unproven. |
| J13 | PongBoardView | screens-games-pong-court--return-score-and-reconnect | ReturnScoreAndReconnect covers controlled score/reconnect presentation; live real-time recovery and full match completion remain unproven. |
| J14 | LightCyclesBoardView | screens-games-light-cycles-arena--shared-keyboard | DuelSteering, QuadSteering and SharedKeyboard exercise inputs; collision-to-round completion and live reconnect remain unproven. |

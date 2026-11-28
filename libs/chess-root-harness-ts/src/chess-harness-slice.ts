import { PuzzleManagementScreen } from '@libs/chess-puzzle-client-ts/puzzle-management-screen';
import { CHESS_HARNESS_ACTIONS } from '@libs/chess-puzzle-harness-ts/chess-actions';
import { seedChessPuzzlesForHarness } from '@libs/chess-puzzle-harness-ts/chess-harness-seed';
import { nextPuzzleDifferent } from '@libs/chess-puzzle-harness-ts/chess-properties';
import { createChessAdminServer } from '@libs/chess-root-server-ts/admin-server';
import { CHESS_SUB } from '@libs/chess-sub-shared-ts/sub';
import type { HarnessSlice } from '@libs/harness-ts/slices';
import { changeGameSession } from './chess-game-session-board';
import { CHESS_MULTIPLAYER_BOARD_ACTIONS } from './chess-multiplayer-board';
import { focusChessScreen } from './chess-screen-reads';
import { setGameSessionParticipation } from './game-session-participation';

/**
 * Chess in a harness: the puzzle catalog, seeded; its screens arrive through the
 * spaces game registry (`spacesHarnessSlice({ games: [chessGameShared], … })`).
 */
export const CHESS_HARNESS_SLICE: HarnessSlice = {
  name: 'game:chess',
  sub: CHESS_SUB,
  client: {
    name: 'chess',
    routes: [{ path: '/puzzles', component: PuzzleManagementScreen }],
  },
  server: () => createChessAdminServer(),
  seedServer: seedChessPuzzlesForHarness,
  actions: [
    ...CHESS_HARNESS_ACTIONS,
    changeGameSession,
    ...CHESS_MULTIPLAYER_BOARD_ACTIONS,
    focusChessScreen,
    setGameSessionParticipation,
  ],
  properties: [nextPuzzleDifferent],
};

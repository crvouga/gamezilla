import { PERSONAL_CHESS_STATS_CLIENT } from '@libs/chess-puzzle-client/personal-chess-stats-client';
import { PUZZLE_LINK_CLIENT } from '@libs/chess-puzzle-client/puzzle-link-client';
import { PuzzleManagementScreen } from '@libs/chess-puzzle-client/puzzle-management-screen';
import { CHESS_HARNESS_ACTIONS } from '@libs/chess-puzzle-harness/chess-actions';
import { seedChessPuzzlesForHarness } from '@libs/chess-puzzle-harness/chess-harness-seed';
import { nextPuzzleDifferent } from '@libs/chess-puzzle-harness/chess-properties';
import { createChessServer } from '@libs/chess-root-server/sub-server';
import { CHESS_SUB } from '@libs/chess-sub-shared/sub';
import type { HarnessSlice } from '@libs/harness/slices';
import { changeCustomGame } from './chess-custom-game-board';
import { CHESS_MULTIPLAYER_BOARD_ACTIONS } from './chess-multiplayer-board';
import { focusChessScreen } from './chess-screen-reads';
import { setCustomGameParticipation } from './custom-game-participation';

/**
 * Chess in a harness: the puzzle catalog, seeded; its screens arrive through the
 * spaces game registry (`spacesHarnessSlice({ games: [chessGameShared], … })`).
 */
export const CHESS_HARNESS_SLICE: HarnessSlice = {
  name: 'game:chess',
  sub: CHESS_SUB,
  client: {
    name: 'chess',
    routes: [
      { path: '/more/puzzles', component: PuzzleManagementScreen },
      ...PUZZLE_LINK_CLIENT.routes,
      ...PERSONAL_CHESS_STATS_CLIENT.routes,
    ],
    ...(PERSONAL_CHESS_STATS_CLIENT.settings === undefined
      ? {}
      : { settings: PERSONAL_CHESS_STATS_CLIENT.settings }),
  },
  server: () => createChessServer(),
  seedServer: seedChessPuzzlesForHarness,
  actions: [
    ...CHESS_HARNESS_ACTIONS,
    changeCustomGame,
    ...CHESS_MULTIPLAYER_BOARD_ACTIONS,
    focusChessScreen,
    setCustomGameParticipation,
  ],
  properties: [nextPuzzleDifferent],
};

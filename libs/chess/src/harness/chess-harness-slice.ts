import type { HarnessSlice } from '@libs/harness/slices';

import { CHESS_FEATURE } from '../root/feature';
import { CHESS_SERVER } from '../root/server/feature-server';
import { CHESS_HARNESS_ACTIONS } from './chess-actions';
import { CUSTOM_GAME_HARNESS_ACTIONS } from './custom-game-actions';
import { seedChessPuzzlesForHarness } from './chess-harness-seed';
import { nextPuzzleDifferent } from './chess-properties';

/**
 * Chess in a harness: the puzzle catalog, seeded; its screens arrive through the
 * spaces game registry (`spacesHarnessSlice({ games: [chessGameShared], … })`).
 */
export const CHESS_HARNESS_SLICE: HarnessSlice = {
  name: 'chess',
  feature: CHESS_FEATURE,
  server: () => CHESS_SERVER,
  seedServer: seedChessPuzzlesForHarness,
  actions: [...CHESS_HARNESS_ACTIONS, ...CUSTOM_GAME_HARNESS_ACTIONS],
  properties: [nextPuzzleDifferent],
};

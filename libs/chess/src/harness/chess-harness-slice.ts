import type { HarnessSlice } from '@libs/harness/slices';

import { CHESS_FEATURE } from '../root/feature';
import { CHESS_HARNESS_ACTIONS } from './chess-actions';
import { seedChessPuzzlesForHarness } from './chess-harness-seed';
import { nextPuzzleDifferent } from './chess-properties';

/**
 * Chess in a harness: the puzzle catalog, seeded; its screens arrive through the
 * spaces game registry (`spacesHarnessSlice({ games: [chessGameShared], … })`).
 */
export const CHESS_HARNESS_SLICE: HarnessSlice = {
  name: 'chess',
  feature: CHESS_FEATURE,
  seedServer: seedChessPuzzlesForHarness,
  actions: CHESS_HARNESS_ACTIONS,
  properties: [nextPuzzleDifferent],
};

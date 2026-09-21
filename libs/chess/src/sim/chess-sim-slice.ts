import type { SimSlice } from '@libs/sim-harness/slices';

import { CHESS_FEATURE } from '../root/feature';
import { CHESS_SIM_ACTIONS } from './chess-actions';
import { nextPuzzleDifferent } from './chess-properties';
import { seedChessPuzzlesForSim } from './chess-sim-seed';
import { CHESS_WALK_ACTIONS } from './chess-walk';

/**
 * Chess in a sim: the puzzle catalog, seeded; its screens arrive through the
 * spaces game registry (`spacesSimSlice({ games: [chessGameShared], … })`).
 */
export const CHESS_SIM_SLICE: SimSlice = {
  name: 'chess',
  feature: CHESS_FEATURE,
  seedServer: seedChessPuzzlesForSim,
  actions: [...CHESS_SIM_ACTIONS, ...CHESS_WALK_ACTIONS],
  properties: [nextPuzzleDifferent],
};

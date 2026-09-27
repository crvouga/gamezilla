import { BILLING_SIM_SLICE } from '@libs/billing/sim/billing-sim-slice';
import { chessGameShared } from '@libs/chess/public/chess-game';
import { chessGameClient } from '@libs/chess/public/chess-game-def';
import { seedChessPuzzlesForSim } from '@libs/chess/sim/chess-sim-seed';
import { CHESS_SIM_SLICE } from '@libs/chess/sim/chess-sim-slice';
import {
  SIM_CHESS_FEED_POOL_KEY,
  seedSimChessPuzzles,
} from '@libs/chess/sim/seed-sim-chess-puzzles';
import { FRIENDS_SIM_SLICE } from '@libs/friends/sim/friends-sim-slice';
import { NOTIFICATIONS_SIM_SLICE } from '@libs/notifications/sim/notifications-sim-slice';
import { PROFILE_SIM_SLICE } from '@libs/profile/sim/profile-sim-slice';
import { SEARCH_SIM_SLICE } from '@libs/search/sim/search-sim-slice';
import {
  type OpenSim,
  type OpenSimOptions,
  openSim as openHarnessSim,
} from '@libs/sim-harness/open-sim/open-sim';
import { composeSimSlices, type SimSlice } from '@libs/sim-harness/slices';
import { defineProductSystem } from '@libs/sim-harness/system/define-product-system';
import { spacesSimSlice } from '@libs/spaces/sim/spaces-sim-slice';

/**
 * Chess puzzles and what they cross: a puzzle opens in a space hosting only
 * chess, profile owns the signed-in identity, and friends watch a puzzle live
 * — so the befriending path (search finds a person, notifications deliver the
 * request) is in too. Billing is in because permissions reads its
 * `billing_subscriptions` rows directly, and its plans are where the guest
 * puzzle limit sends you.
 */
function chessSystem(chess: SimSlice) {
  return defineProductSystem(
    composeSimSlices('chess', [
      PROFILE_SIM_SLICE,
      spacesSimSlice({ games: [chessGameShared], clients: [chessGameClient] }),
      FRIENDS_SIM_SLICE,
      NOTIFICATIONS_SIM_SLICE,
      SEARCH_SIM_SLICE,
      chess,
      BILLING_SIM_SLICE,
    ])
  );
}

const CHESS_SYSTEM = chessSystem(CHESS_SIM_SLICE);

/**
 * The world the chess scenarios run in: the same system, with a feed-sized
 * pool of puzzles on the server as well as the three documented ones, the
 * way a real catalog gives a device far more puzzles than a day's play (a
 * scenario that needs just the three retires the rest first).
 */
const CHESS_SPEC_SYSTEM = chessSystem({
  ...CHESS_SIM_SLICE,
  seedServer: async (sqlClient) => {
    await seedChessPuzzlesForSim(sqlClient);
    await seedSimChessPuzzles({
      sqlClient,
      loadFileKey: SIM_CHESS_FEED_POOL_KEY,
    });
  },
});

export function openSim(
  testId: string,
  options?: OpenSimOptions
): Promise<OpenSim> {
  return openHarnessSim(CHESS_SYSTEM, testId, options);
}

/** {@link openSim} for the chess scenarios (see {@link CHESS_SPEC_SYSTEM}). */
export function openSpecSim(
  testId: string,
  options?: OpenSimOptions
): Promise<OpenSim> {
  return openHarnessSim(CHESS_SPEC_SYSTEM, testId, options);
}

export type { OpenSim, OpenSimOptions };

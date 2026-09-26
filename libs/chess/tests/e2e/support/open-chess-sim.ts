import { BILLING_SIM_SLICE } from '@libs/billing/sim/billing-sim-slice';
import { chessGameShared } from '@libs/chess/public/chess-game';
import { chessGameClient } from '@libs/chess/public/chess-game-def';
import { CHESS_SIM_SLICE } from '@libs/chess/sim/chess-sim-slice';
import { FRIENDS_SIM_SLICE } from '@libs/friends/sim/friends-sim-slice';
import { NOTIFICATIONS_SIM_SLICE } from '@libs/notifications/sim/notifications-sim-slice';
import { PROFILE_SIM_SLICE } from '@libs/profile/sim/profile-sim-slice';
import { SEARCH_SIM_SLICE } from '@libs/search/sim/search-sim-slice';
import {
  type OpenSim,
  type OpenSimOptions,
  openSim as openHarnessSim,
} from '@libs/sim-harness/open-sim/open-sim';
import { composeSimSlices } from '@libs/sim-harness/slices';
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
const CHESS_SYSTEM = defineProductSystem(
  composeSimSlices('chess', [
    PROFILE_SIM_SLICE,
    spacesSimSlice({ games: [chessGameShared], clients: [chessGameClient] }),
    FRIENDS_SIM_SLICE,
    NOTIFICATIONS_SIM_SLICE,
    SEARCH_SIM_SLICE,
    CHESS_SIM_SLICE,
    BILLING_SIM_SLICE,
  ])
);

export function openSim(
  testId: string,
  options?: OpenSimOptions
): Promise<OpenSim> {
  return openHarnessSim(CHESS_SYSTEM, testId, options);
}

export type { OpenSim, OpenSimOptions };

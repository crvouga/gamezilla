import { BILLING_SIM_SLICE } from '@libs/billing/sim/billing-sim-slice';
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
 * Friends and what its flows cross: people search finds a person (friends
 * fills search's row slot), the inbox delivers the request, profile hosts the
 * friend count, and the list badges a friend's live space. Billing is in
 * because permissions reads its `billing_subscriptions` rows directly (see
 * docs/FEATURE_SUBSYSTEMS.md). No games: a chess change leaves this cached.
 *
 * The spaces specs (`space-*.test.tsx`) run here too: spaces' server SQL reads
 * friends' `friends_friendships` table directly (lobby visibility, join
 * policy), so a spaces-only composition fails those queries and a second
 * actor never paints. Friends depends on spaces, so spaces cannot compose
 * friends; this is the lowest package that composes spaces soundly.
 */
const FRIENDS_SYSTEM = defineProductSystem(
  composeSimSlices('friends', [
    PROFILE_SIM_SLICE,
    spacesSimSlice({ games: [], clients: [] }),
    FRIENDS_SIM_SLICE,
    NOTIFICATIONS_SIM_SLICE,
    SEARCH_SIM_SLICE,
    BILLING_SIM_SLICE,
  ])
);

export function openSim(
  testId: string,
  options?: OpenSimOptions
): Promise<OpenSim> {
  return openHarnessSim(FRIENDS_SYSTEM, testId, options);
}

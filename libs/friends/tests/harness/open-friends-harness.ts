import { ACCOUNT_PRIVACY_HARNESS_SLICE } from '@libs/account-privacy/harness/account-privacy-harness-slice';
import { BILLING_HARNESS_SLICE } from '@libs/billing/harness/billing-harness-slice';
import { FRIENDS_HARNESS_SLICE } from '@libs/friends/harness/friends-harness-slice';
import {
  type OpenHarness,
  type OpenHarnessOptions,
  openHarness as openSystemHarness,
} from '@libs/harness/open-harness/open-harness';
import { composeHarnessSlices } from '@libs/harness/slices';
import { defineProductSystem } from '@libs/harness/system/define-product-system';
import { NOTIFICATIONS_HARNESS_SLICE } from '@libs/notifications/harness/notifications-harness-slice';
import { PROFILE_HARNESS_SLICE } from '@libs/profile/harness/profile-harness-slice';
import { SEARCH_HARNESS_SLICE } from '@libs/search/harness/search-harness-slice';
import { spacesHarnessSlice } from '@libs/spaces/harness/spaces-harness-slice';

/**
 * Friends and what its flows cross: people search finds a person (friends
 * fills search's row slot), the inbox delivers the request, profile hosts the
 * friend count, and the list badges a friend's live space. Billing is in
 * because permissions reads its `billing_subscriptions` rows directly (see
 * README.md). No games: a chess change leaves this cached.
 *
 * The spaces specs (`space-*.test.tsx`) run here too: spaces' server SQL reads
 * friends' `friends_friendships` table directly (lobby visibility, join
 * policy), so a spaces-only composition fails those queries and a second
 * actor never paints. Friends depends on spaces, so spaces cannot compose
 * friends; this is the lowest package that composes spaces soundly.
 */
const FRIENDS_SYSTEM = defineProductSystem(
  composeHarnessSlices('friends', [
      ACCOUNT_PRIVACY_HARNESS_SLICE,
    PROFILE_HARNESS_SLICE,
    spacesHarnessSlice({ games: [], clients: [] }),
    FRIENDS_HARNESS_SLICE,
    NOTIFICATIONS_HARNESS_SLICE,
    SEARCH_HARNESS_SLICE,
    BILLING_HARNESS_SLICE,
  ])
);

export function openHarness(
  testId: string,
  options?: OpenHarnessOptions
): Promise<OpenHarness> {
  return openSystemHarness(FRIENDS_SYSTEM, testId, options);
}

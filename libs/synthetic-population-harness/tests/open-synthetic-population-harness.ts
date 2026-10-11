import { ACCOUNT_PRIVACY_HARNESS_SLICE } from '@libs/account-privacy-harness/account-privacy-harness-slice';
import { BILLING_HARNESS_SLICE } from '@libs/billing-harness/billing-harness-slice';
import { chessGameClient } from '@libs/chess-root-client/chess-game-def';
import { CHESS_HARNESS_SLICE } from '@libs/chess-root-harness/chess-harness-slice';
import { chessGameShared } from '@libs/chess-sub-shared/chess-game';
import { FRIENDS_HARNESS_SLICE } from '@libs/friends-harness/friends-harness-slice';
import { defineProductSystem } from '@libs/harness/define-product-system';
import type { OpenHarnessOptions } from '@libs/harness/mode';
import { openHarness as openSystemHarness } from '@libs/harness/open-harness';
import { composeHarnessSlices } from '@libs/harness/slices';
import { NOTIFICATIONS_HARNESS_SLICE } from '@libs/notifications-harness/notifications-harness-slice';
import { PROFILE_HARNESS_SLICE } from '@libs/profile-harness/profile-harness-slice';
import { SEARCH_HARNESS_SLICE } from '@libs/search-harness/search-harness-slice';
import { spacesHarnessSlice } from '@libs/spaces-harness/spaces-harness-slice';
import { SYNTHETIC_POPULATION_HARNESS_SLICE } from '@libs/synthetic-population-harness/synthetic-population-harness-slice';

const SYNTHETIC_POPULATION_SYSTEM = defineProductSystem(
  composeHarnessSlices('synthetic-population', [
    ACCOUNT_PRIVACY_HARNESS_SLICE,
    PROFILE_HARNESS_SLICE,
    BILLING_HARNESS_SLICE,
    spacesHarnessSlice({
      games: [chessGameShared],
      clients: [chessGameClient],
    }),
    FRIENDS_HARNESS_SLICE,
    NOTIFICATIONS_HARNESS_SLICE,
    SEARCH_HARNESS_SLICE,
    CHESS_HARNESS_SLICE,
    SYNTHETIC_POPULATION_HARNESS_SLICE,
  ]),
  {
    secretValues: {
      POPULATION_WORKER_TOKEN:
        'synthetic-population-spec-worker-token-0123456789abcdef',
    },
  }
);
export function openHarness(testId: string, options?: OpenHarnessOptions) {
  return openSystemHarness(SYNTHETIC_POPULATION_SYSTEM, testId, options);
}

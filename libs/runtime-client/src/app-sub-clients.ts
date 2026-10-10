/**
 * The client half of the composition root: which bounded contexts this
 * product's UI runs, and in what order they nest.
 *
 * Order is meaningful and is chosen here, not by any sub. A provider
 * mounted earlier is outermost, so a sub may read context published by
 * one listed above it — friends registers a notification source before
 * notifications reads it, and fills profile's slots before profile's screen
 * renders.
 */

import { ACCOUNT_PRIVACY_CLIENT } from '@libs/account-privacy-client/sub-client';
import { BILLING_CLIENT } from '@libs/billing-client/sub-client';
import { PUZZLE_LINK_CLIENT } from '@libs/chess-puzzle-client/puzzle-link-client';
import { PuzzleManagementScreen } from '@libs/chess-puzzle-client/puzzle-management-screen';
import { PuzzleManagementSettings } from '@libs/chess-puzzle-client/puzzle-management-settings';
import { FRIENDS_CLIENT } from '@libs/friends-client/sub-client';
import { GAME_CLIENT_DEFINITIONS } from '@libs/games-client/game-plugins.client';
import { GAME_DEFINITIONS } from '@libs/games-shared/game-plugins';
import { NOTIFICATIONS_CLIENT } from '@libs/notifications-client/sub-client';
import { PROFILE_CLIENT } from '@libs/profile-client/sub-client';
import { SEARCH_CLIENT } from '@libs/search-client/sub-client';
import { createSpacesClient } from '@libs/spaces-client/sub-client';
import { defineSubClient, type SubClient } from '@libs/sub-client/client';
import { SYNTHETIC_POPULATION_CLIENT } from '@libs/synthetic-population-client/sub-client';

/**
 * Games depend on spaces, so the composition root hands spaces its plugin
 * registry. The complete registry is available at startup.
 */
const SPACES_CLIENT = createSpacesClient({
  registry: {
    games: GAME_DEFINITIONS,
    clients: GAME_CLIENT_DEFINITIONS,
  },
});

const PUZZLE_MANAGEMENT_CLIENT = defineSubClient({
  name: 'puzzle-management',
  routes: [
    {
      path: '/more/puzzles',
      component: PuzzleManagementScreen,
    },
  ],
  settings: PuzzleManagementSettings,
});

export const APP_SUB_CLIENTS: readonly SubClient[] = [
  // Profile is outermost: a space's room roster reads the local profile, so
  // the profile provider has to be above the room provider.
  PROFILE_CLIENT,
  ACCOUNT_PRIVACY_CLIENT,
  SPACES_CLIENT,
  PUZZLE_LINK_CLIENT,
  // Friends registers a notification source, so it mounts above the inbox
  // that reads it.
  FRIENDS_CLIENT,
  NOTIFICATIONS_CLIENT,
  SEARCH_CLIENT,
  BILLING_CLIENT,
  PUZZLE_MANAGEMENT_CLIENT,
  SYNTHETIC_POPULATION_CLIENT,
];

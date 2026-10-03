import { createMultiplayerChessClient } from '@libs/client-app/chrome/multiplayer-chess-client';
/**
 * The client half of the composition root: which bounded contexts this
 * product's UI runs, and in what order they nest.
 *
 * Order is meaningful and is chosen here, not by any feature. A provider
 * mounted earlier is outermost, so a feature may read context published by
 * one listed above it — friends registers a notification source before
 * notifications reads it, and fills profile's slots before profile's screen
 * renders.
 */

import { ACCOUNT_PRIVACY_CLIENT } from '@libs/account-privacy/root/client/feature-client';
import { BILLING_CLIENT } from '@libs/billing/root/client/feature-client';
import type { FeatureClient } from '@libs/feature/public/client';
import { FRIENDS_CLIENT } from '@libs/friends/root/client/feature-client';
import { NOTIFICATIONS_CLIENT } from '@libs/notifications/root/client/feature-client';
import { PROFILE_CLIENT } from '@libs/profile/root/client/feature-client';
import { SEARCH_CLIENT } from '@libs/search/root/client/feature-client';
import { createSpacesClient } from '@libs/spaces/root/client/feature-client';

/**
 * Games depend on spaces, so the composition root hands spaces its plugin
 * registry. Dynamic import keeps the heavy plugins off the shell entry graph.
 */
const SPACES_CLIENT = createSpacesClient({
  loadGameRegistry: async () => {
    const mod = await import('@libs/games/game-plugins.client');
    return {
      games: mod.GAME_DEFINITIONS,
      clients: mod.GAME_CLIENT_DEFINITIONS,
    };
  },
});

export const APP_FEATURE_CLIENTS: readonly FeatureClient[] = [
  // Profile is outermost: a space's room roster reads the local profile, so
  // the profile provider has to be above the room provider.
  PROFILE_CLIENT,
  ACCOUNT_PRIVACY_CLIENT,
  SPACES_CLIENT,
  createMultiplayerChessClient(
    () => import('@libs/chess/root/client/multiplayer-screen')
  ),
  // Friends registers a notification source, so it mounts above the inbox
  // that reads it.
  FRIENDS_CLIENT,
  NOTIFICATIONS_CLIENT,
  SEARCH_CLIENT,
  BILLING_CLIENT,
];

/** @jsxImportSource solid-js */
/**
 * What friends contributes to a client app: the friends list and the other
 * person's profile screen, the friend-request notification source, the
 * decision-modal state, and the friend bits that fill profile's slots.
 *
 * Friends is mounted above notifications in the composition order, because a
 * notification source has to be registered before the inbox reads it.
 */

import { defineFeatureClient } from '@libs/feature-client/client';

export const FRIENDS_CLIENT = defineFeatureClient({
  name: 'friends',
  routes: [
    {
      path: '/profile/friends',
      load: () => import('./profile-friends'),
    },
    {
      path: '/profile/user/:userId',
      load: () => import('./friend-user'),
    },
  ],
  session: () => import('./session-provider'),
});

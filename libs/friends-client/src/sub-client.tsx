import FriendUserScreen from './friend-user';
import ProfileFriendsScreen from './profile-friends';
import SessionProvider from './session-provider';
/** @jsxImportSource solid-js */
/**
 * What friends contributes to a client app: the friends list and the other
 * person's profile screen, the friend-request notification source, the
 * decision-modal state, and the friend bits that fill profile's slots.
 *
 * Friends is mounted above notifications in the composition order, because a
 * notification source has to be registered before the inbox reads it.
 */

import { defineSubClient } from '@libs/sub-client/client';

export const FRIENDS_CLIENT = defineSubClient({
  name: 'friends',
  routes: [
    {
      path: '/profile/friends',
      component: ProfileFriendsScreen,
    },
    {
      path: '/profile/user/:userId',
      component: FriendUserScreen,
    },
  ],
  session: SessionProvider,
});

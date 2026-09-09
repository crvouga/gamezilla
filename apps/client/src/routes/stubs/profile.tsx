/** @jsxImportSource solid-js */

import { ProfileFriendsActions } from '@libs/friends/root/client/profile-friends-actions';
import { ProfileFriendsStats } from '@libs/friends/root/client/profile-friends-stats';
import { ProfileScreen } from '@libs/profile/root/client/profile-screen';
import type { JSX } from 'solid-js';

export default function ProfileRoute(): JSX.Element {
  return (
    <ProfileScreen
      friendsStats={<ProfileFriendsStats />}
      friendsActions={<ProfileFriendsActions />}
    />
  );
}

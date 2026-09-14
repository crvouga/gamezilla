import { useMyProfileId } from '@libs/profile/public/use-my-profile-id';
import { useLocalSearchParams, useRouter } from '@pkgs/ui';
import { createEffect, createMemo } from 'solid-js';

import type { FriendProfile } from '../../shared/friendship/friends-types';
import { useFriends } from '../../use-cases/list-friends/client/use-friends';

export function readRouteParam(value: string | string[] | undefined): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return '';
}

/**
 * Resolves another user's display profile from sync `profiles` (via the
 * friends list join) or route search-param seed for non-friends.
 */
export function useFriendUserProfile(userId: string) {
  const router = useRouter();
  const myProfileId = useMyProfileId();
  const friendsState = useFriends();
  const cachedFriend = createMemo(
    () => friendsState.friends.find((f) => f.userId === userId) ?? null
  );
  const params = useLocalSearchParams<{
    username?: string;
    avatarConfig?: string;
  }>();
  const seedProfile = createMemo<FriendProfile>(() => ({
    userId,
    username: readRouteParam(params().username),
    avatarConfig: readRouteParam(params().avatarConfig) || null,
  }));
  const profile = createMemo(() => cachedFriend() ?? seedProfile());

  createEffect(() => {
    if (myProfileId() !== null && userId === myProfileId()) {
      router.replace('/profile');
    }
  });

  const refreshProfile = () => {
    // Friends list / route params are already live; no-op for API compat.
  };

  return {
    get profile() {
      return profile();
    },
    refreshProfile,
  };
}

export function friendUserBreadcrumbName(
  profile: FriendProfile,
  userId: string
): string {
  if (profile.username.length > 0) return `@${profile.username}`;
  return userId.slice(0, 8);
}

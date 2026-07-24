import { useMyProfileId } from '@libs/profile/client/use-my-profile-id';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo } from 'react';

import type { FriendProfile } from '../shared/friends-types';
import { useFriends } from './use-friends';

export function readRouteParam(value: string | string[] | undefined): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return '';
}

/**
 * Resolves another user's display profile from PowerSync
 * (`friend_profile_cache` via friends list) or route search-param seed for
 * non-friends. No React state mirror — always derived live.
 */
export function useFriendUserProfile(userId: string) {
  const router = useRouter();
  const myProfileId = useMyProfileId();
  const { friends } = useFriends();
  const cachedFriend = useMemo(
    () => friends.find((f) => f.userId === userId) ?? null,
    [friends, userId]
  );
  const params = useLocalSearchParams<{
    username?: string;
    avatarConfig?: string;
  }>();
  const seedProfile = useMemo<FriendProfile>(
    () => ({
      userId,
      username: readRouteParam(params.username),
      avatarConfig: readRouteParam(params.avatarConfig) || null,
    }),
    [params.avatarConfig, params.username, userId]
  );
  const profile = cachedFriend ?? seedProfile;

  useEffect(() => {
    if (myProfileId !== null && userId === myProfileId) {
      router.replace('/profile');
    }
  }, [myProfileId, router, userId]);

  const refreshProfile = useCallback(() => {
    // Friends list / route params are already live; no-op for API compat.
  }, []);

  return { profile, refreshProfile };
}

export function friendUserBreadcrumbName(
  profile: FriendProfile,
  userId: string
): string {
  if (profile.username.length > 0) return `@${profile.username}`;
  return userId.slice(0, 8);
}

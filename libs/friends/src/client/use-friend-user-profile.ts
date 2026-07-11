import { useMyProfileId } from '@libs/profile/client/use-my-profile-id';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { fetchUserProfile } from './friends-actions';
import type { FriendProfile } from '../shared/friends-types';
import { useFriends } from './use-friends';
import type { FriendsClientDeps } from './friends-actions';

export function readRouteParam(value: string | string[] | undefined): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return '';
}

export function useFriendUserProfile(userId: string, deps: FriendsClientDeps) {
  const router = useRouter();
  const myProfileId = useMyProfileId();
  const { friends } = useFriends();
  const cachedFriend = useMemo(
    () => friends.find((f) => f.userId === userId) ?? null,
    [friends, userId]
  );
  const params = useLocalSearchParams<{
    displayName?: string;
    username?: string;
    avatarConfig?: string;
  }>();
  const seedProfile = useMemo<FriendProfile>(
    () => ({
      userId,
      displayName: readRouteParam(params.displayName),
      username: readRouteParam(params.username),
      avatarConfig: readRouteParam(params.avatarConfig) || null,
    }),
    [params.avatarConfig, params.displayName, params.username, userId]
  );
  const [profile, setProfile] = useState<FriendProfile>(
    cachedFriend ?? seedProfile
  );

  useEffect(() => {
    if (cachedFriend !== null) setProfile(cachedFriend);
  }, [cachedFriend]);

  useEffect(() => {
    if (userId.length === 0) return;
    void fetchUserProfile(deps, userId)
      .then(setProfile)
      .catch(() => undefined);
  }, [deps, userId]);

  useEffect(() => {
    if (myProfileId !== null && userId === myProfileId) {
      router.replace('/profile');
    }
  }, [myProfileId, router, userId]);

  const refreshProfile = useCallback(() => {
    void fetchUserProfile(deps, userId)
      .then(setProfile)
      .catch(() => undefined);
  }, [deps, userId]);

  return { profile, refreshProfile };
}

export function friendUserBreadcrumbName(
  profile: FriendProfile,
  userId: string
): string {
  if (profile.displayName.length > 0) return profile.displayName;
  if (profile.username.length > 0) return `@${profile.username}`;
  return userId.slice(0, 8);
}

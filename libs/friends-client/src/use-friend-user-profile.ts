import type { FriendProfile } from '@libs/friends-shared/friends-types';
import { usernameLabel } from '@libs/moderation-shared/display';
import { useMyProfileId } from '@libs/profile-client/public-use-my-profile-id';
import { useProfileRow } from '@libs/profile-client/public-use-profile-row';
import { useSyncEngine } from '@pkgs/sync-engine-client/sync-engine-context';
import { useRouter } from '@pkgs/ui-root-client/app-router';
import type { Accessor } from 'solid-js';
import { createEffect, createMemo, onCleanup } from 'solid-js';

export function readRouteParam(value: string | string[] | undefined): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return '';
}

/**
 * Reads the requested profile from its live sync scope, including withdrawal.
 */
export function useFriendUserProfile(userId: Accessor<string>): {
  readonly profile: Accessor<FriendProfile>;
  readonly refreshProfile: () => void;
  readonly unavailable: Accessor<boolean>;
} {
  const router = useRouter();
  const myProfileId = useMyProfileId();
  const engine = useSyncEngine();
  const local = useProfileRow(userId);
  createEffect(() => {
    const id = userId();
    if (!id) return;
    const subscription = engine.subscribeQuery('profilesByIds', { ids: [id] });
    onCleanup(() => subscription.unsubscribe());
  });
  const profile = createMemo<FriendProfile>(() => ({
    userId: userId(),
    username: local.row()?.username ?? '',
    avatarConfig: local.row()?.avatar_config ?? null,
  }));

  createEffect(() => {
    if (myProfileId() !== null && userId() === myProfileId()) {
      router.replace('/profile');
    }
  });

  const refreshProfile = () => {
    void engine.refreshQueries();
  };

  return {
    profile,
    unavailable: () => !local.isLoading() && local.row() === null,
    refreshProfile,
  };
}

export function friendUserBreadcrumbName(
  profile: FriendProfile,
  userId: string
): string {
  const label = usernameLabel(profile.username, userId);
  return label.length > 0 ? label : userId.slice(0, 8);
}

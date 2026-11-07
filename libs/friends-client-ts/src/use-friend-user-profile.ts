import type { FriendProfile } from '@libs/friends-shared-ts/friends-types';
import { usernameLabel } from '@libs/moderation-shared-ts/display';
import type { AppModeration } from '@libs/moderation-shared-ts/policy';
import { useMyProfileId } from '@libs/profile-client-ts/public-use-my-profile-id';
import sql from '@pkgs/sql-root-shared-ts/sql';
import {
  createQuery,
  useSyncEngine,
} from '@pkgs/sync-engine-client-ts/sync-engine-context';
import { useRouter } from '@pkgs/ui-root-client-ts/app-router';
import type { Accessor } from 'solid-js';
import { createEffect, createMemo, createSignal, onCleanup } from 'solid-js';

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
  readonly deleted: Accessor<boolean>;
  readonly loading: Accessor<boolean>;
  readonly unreachable: Accessor<boolean>;
} {
  const router = useRouter();
  const myProfileId = useMyProfileId();
  const engine = useSyncEngine();
  const query = createQuery(
    () =>
      sql<{
        id: string;
        username: string | null;
        avatar_config: string | null;
        deleted_at: string | null;
      }>`SELECT id, username, avatar_config, deleted_at FROM profile WHERE id = ${userId()}`
  );
  const localRow = createMemo(() => {
    const row = query.rows()[0];
    return row?.deleted_at == null ? (row ?? null) : null;
  });
  const local = { row: localRow, isLoading: query.isLoading };
  const [answered, setAnswered] = createSignal(false);
  createEffect(() => {
    const id = userId();
    setAnswered(false);
    if (!id) return;
    const subscription = engine.subscribeQuery('profilesByIds', { ids: [id] });
    let active = true;
    void subscription.waitForFirstSync().then(() => {
      if (active) setAnswered(true);
    });
    onCleanup(() => {
      active = false;
      subscription.unsubscribe();
    });
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

  const unreachable = () =>
    !answered() &&
    local.row() === null &&
    (!engine.status().online || engine.status().lastError !== null);

  return {
    profile,
    unavailable: () => answered() && !local.isLoading() && local.row() === null,
    deleted: () =>
      answered() && !query.isLoading() && query.rows()[0]?.deleted_at != null,
    loading: () =>
      local.row() === null &&
      !unreachable() &&
      (local.isLoading() || !answered()),
    unreachable,
    refreshProfile,
  };
}

export function friendUserBreadcrumbName(
  moderation: AppModeration,
  profile: FriendProfile,
  userId: string
): string {
  const label = usernameLabel(moderation, profile.username, userId);
  return label.length > 0 ? label : userId.slice(0, 8);
}

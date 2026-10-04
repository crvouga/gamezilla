import {
  useMyAccountId,
  useMyDeviceId,
  useMyId,
} from '@libs/auth-client/use-current-user';
import type {
  SpaceJoinLocalRow,
  SpaceJoinSnapshot,
} from '@libs/spaces-shared/resolve-space-join-snapshot';
import { resolveSpaceJoinSnapshot } from '@libs/spaces-shared/resolve-space-join-snapshot';
import sql from '@pkgs/sql-shared/sql';
import {
  createQuery,
  useSyncEngine,
} from '@pkgs/sync-engine-client/sync-engine-context';
import { type Accessor, createMemo } from 'solid-js';
import { useIsFriendOfHostLocal } from './use-is-friend-of-host-local';
import { useHasSpaceUserLocal } from './use-space-join-access-flags';

export function useSpaceJoinSnapshot(
  spaceId: string | Accessor<string>,
  linkAnswered: Accessor<boolean>
): Accessor<SpaceJoinSnapshot> {
  const engine = useSyncEngine();
  const resolveId = (): string =>
    typeof spaceId === 'string' ? spaceId : spaceId();
  const viewerAccountId = useMyAccountId();
  const viewerMemberId = useMyId();
  const viewerDeviceId = useMyDeviceId();
  const query = createQuery(
    () => sql<SpaceJoinLocalRow>`
      SELECT host_id, host_member_id, host_account_id, ended_at, visibility,
        deleted_at
      FROM spaces
      WHERE id = ${resolveId()}
    `
  );
  const row = createMemo(() => query.rows()[0] ?? null);
  const hostAccountId = createMemo(() => row()?.host_account_id ?? null);
  const hostMemberId = createMemo(() => row()?.host_member_id ?? null);
  const hasSpaceUser = useHasSpaceUserLocal(spaceId, viewerMemberId);
  const isFriendOfHost = useIsFriendOfHostLocal(
    hostAccountId,
    hostMemberId,
    viewerMemberId
  );

  return createMemo(() =>
    resolveSpaceJoinSnapshot({
      enabled: resolveId().length > 0,
      rowLoading: query.isLoading(),
      row: row(),
      linkAnswered: linkAnswered(),
      online: engine.status().online,
      hasSpaceUser: hasSpaceUser(),
      isFriendOfHost: isFriendOfHost(),
      viewerAccountId: viewerAccountId(),
      viewerMemberId: viewerMemberId(),
      viewerDeviceId: viewerDeviceId(),
    })
  );
}

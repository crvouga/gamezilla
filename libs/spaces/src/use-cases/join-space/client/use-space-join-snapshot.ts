import {
  useMyAccountId,
  useMyDeviceId,
} from '@libs/auth/public/use-current-user';
import { sql } from '@pkgs/sql';

import { createQuery } from '@pkgs/sync-engine/solid';
import { type Accessor, createMemo } from 'solid-js';

import {
  resolveSpaceJoinSnapshot,
  type SpaceJoinLocalRow,
  type SpaceJoinSnapshot,
} from '../shared/resolve-space-join-snapshot';
import { useIsFriendOfHostLocal } from './use-is-friend-of-host-local';
import { useHasSpaceUserLocal } from './use-space-join-access-flags';

export type {
  SpaceJoinSnapshot,
  SpaceJoinSnapshotStatus,
} from '../shared/resolve-space-join-snapshot';

export function useSpaceJoinSnapshot(
  spaceId: string | Accessor<string>
): Accessor<SpaceJoinSnapshot> {
  const resolveId = (): string =>
    typeof spaceId === 'string' ? spaceId : spaceId();
  const viewerAccountId = useMyAccountId();
  const viewerDeviceId = useMyDeviceId();
  const query = createQuery(
    () => sql<SpaceJoinLocalRow>`
      SELECT host_id, host_member_id, host_account_id, ended_at, visibility
      FROM spaces
      WHERE id = ${resolveId()}
    `
  );
  const row = createMemo(() => query.rows()[0] ?? null);
  const hostAccountId = createMemo(() => row()?.host_account_id ?? null);
  const hostMemberId = createMemo(() => row()?.host_member_id ?? null);
  const hasSpaceUser = useHasSpaceUserLocal(spaceId, viewerAccountId);
  const isFriendOfHost = useIsFriendOfHostLocal(
    hostAccountId,
    hostMemberId,
    viewerAccountId
  );

  return createMemo(() =>
    resolveSpaceJoinSnapshot({
      enabled: resolveId().length > 0,
      rowLoading: query.isLoading(),
      row: row(),
      hasSpaceUser: hasSpaceUser(),
      isFriendOfHost: isFriendOfHost(),
      viewerAccountId: viewerAccountId(),
      viewerDeviceId: viewerDeviceId(),
    })
  );
}

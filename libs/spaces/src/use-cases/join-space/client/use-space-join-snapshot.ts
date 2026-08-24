import {
  useMyAccountId,
  useMyDeviceId,
} from '@libs/auth/public/use-current-user';
import { sql } from '@pkgs/sql';

import { useQuery } from '@pkgs/sync-engine/client';
import { useMemo } from 'react';

import {
  resolveSpaceJoinSnapshot,
  type SpaceJoinLocalRow,
  type SpaceJoinSnapshot,
} from '../shared/resolve-space-join-snapshot';
import { useHasSpaceUserLocal } from './use-space-join-access-flags';
import { useIsFriendOfHostLocal } from './use-is-friend-of-host-local';

export type {
  SpaceJoinSnapshot,
  SpaceJoinSnapshotStatus,
} from '../shared/resolve-space-join-snapshot';

export function useSpaceJoinSnapshot(spaceId: string): SpaceJoinSnapshot {
  const enabled = spaceId.length > 0;
  const viewerAccountId = useMyAccountId();
  const viewerDeviceId = useMyDeviceId();
  const { rows, isLoading } = useQuery(sql<SpaceJoinLocalRow>`
    SELECT host_id, host_member_id, host_account_id, ended_at, visibility
    FROM spaces
    WHERE id = ${spaceId}
  `);
  const row = rows[0] ?? null;
  const hasSpaceUser = useHasSpaceUserLocal(spaceId, viewerAccountId);
  const isFriendOfHost = useIsFriendOfHostLocal(
    row?.host_account_id ?? null,
    row?.host_member_id ?? null,
    viewerAccountId
  );

  return useMemo(
    () =>
      resolveSpaceJoinSnapshot({
        enabled,
        rowLoading: isLoading,
        row,
        hasSpaceUser,
        isFriendOfHost,
        viewerAccountId,
        viewerDeviceId,
      }),
    [
      enabled,
      isLoading,
      row,
      hasSpaceUser,
      isFriendOfHost,
      viewerAccountId,
      viewerDeviceId,
    ]
  );
}

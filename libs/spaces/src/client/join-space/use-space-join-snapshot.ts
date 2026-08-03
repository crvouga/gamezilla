import {
  useMyAccountId,
  useMyDeviceId,
} from '@libs/auth/client/use-current-user';
import { sql } from '@pkgs/sql';

import { useWatchOne } from '@pkgs/sync-engine/client/sync-engine-context';
import { useMemo } from 'react';

import {
  resolveSpaceJoinSnapshot,
  type SpaceJoinLocalRow,
  type SpaceJoinSnapshot,
} from '../../shared/join-space/resolve-space-join-snapshot';
import { useHasSpaceUserLocal } from './use-space-join-access-flags';

export type {
  SpaceJoinSnapshot,
  SpaceJoinSnapshotStatus,
} from '../../shared/join-space/resolve-space-join-snapshot';

export function useSpaceJoinSnapshot(spaceId: string): SpaceJoinSnapshot {
  const enabled = spaceId.length > 0;
  const viewerAccountId = useMyAccountId();
  const viewerDeviceId = useMyDeviceId();
  const { row, isLoading } = useWatchOne(sql<SpaceJoinLocalRow>`
    SELECT host_id, host_member_id, host_account_id, ended_at, visibility
    FROM spaces
    WHERE id = ${spaceId}
  `);
  const hasSpaceUser = useHasSpaceUserLocal(spaceId, viewerAccountId);

  return useMemo(
    () =>
      resolveSpaceJoinSnapshot({
        enabled,
        rowLoading: isLoading,
        row,
        hasSpaceUser,
        viewerAccountId,
        viewerDeviceId,
      }),
    [enabled, isLoading, row, hasSpaceUser, viewerAccountId, viewerDeviceId]
  );
}

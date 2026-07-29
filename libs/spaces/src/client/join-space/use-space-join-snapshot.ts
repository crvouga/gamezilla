import {
  useMyAccountId,
  useMyDeviceId,
} from '@libs/auth/client/use-current-user';
import { SpaceCol, SPACES_TABLE } from '@libs/db/shared/space-tables';
import { honey } from '@pkgs/sql';
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
  const { row, isLoading } = useWatchOne<SpaceJoinLocalRow>(
    honey({
      select: [
        SpaceCol.hostId,
        SpaceCol.hostMemberId,
        SpaceCol.hostAccountId,
        SpaceCol.endedAt,
        SpaceCol.visibility,
      ],
      from: SPACES_TABLE.tableName,
      where: enabled ? ['=', SpaceCol.id, spaceId] : ['=', 1, 0],
    })
  );
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

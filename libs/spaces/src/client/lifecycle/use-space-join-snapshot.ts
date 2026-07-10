import { SpaceCol, SPACES_TABLE } from '@libs/db/shared/space-tables';
import { useWatchOne } from '@pkgs/sync-engine/client/sync-engine-context';
import { useMemo } from 'react';

export type SpaceJoinSnapshotStatus =
  | 'loading'
  | 'live'
  | 'ended'
  | 'unavailable';

export type SpaceJoinSnapshot = {
  status: SpaceJoinSnapshotStatus;
  joinable: boolean;
};

type SpaceJoinRow = {
  readonly host_id: string | null;
  readonly ended_at: string | null;
};

export function useSpaceJoinSnapshot(spaceId: string): SpaceJoinSnapshot {
  const enabled = spaceId.length > 0;
  const { row, isLoading } = useWatchOne<SpaceJoinRow>(
    enabled
      ? `SELECT ${SpaceCol.hostId} AS host_id, ${SpaceCol.endedAt} AS ended_at
         FROM ${SPACES_TABLE.tableName}
         WHERE ${SpaceCol.id} = ?`
      : `SELECT ${SpaceCol.hostId} AS host_id, ${SpaceCol.endedAt} AS ended_at FROM ${SPACES_TABLE.tableName} WHERE 0`,
    enabled ? [spaceId] : []
  );

  return useMemo((): SpaceJoinSnapshot => {
    if (!enabled) {
      return { status: 'unavailable', joinable: false };
    }
    if (isLoading) {
      return { status: 'loading', joinable: false };
    }
    if (row === null) {
      return { status: 'unavailable', joinable: false };
    }
    const hostId = row.host_id;
    if (hostId === null || hostId.length === 0) {
      return { status: 'unavailable', joinable: false };
    }
    if (row.ended_at !== null) {
      return { status: 'ended', joinable: false };
    }
    return { status: 'live', joinable: true };
  }, [enabled, isLoading, row]);
}

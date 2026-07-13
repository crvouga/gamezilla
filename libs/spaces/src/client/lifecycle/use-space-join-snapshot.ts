import { SpaceCol, SPACES_TABLE } from '@libs/db/shared/space-tables';
import { useWatchOne } from '@pkgs/sync-engine/client/sync-engine-context';
import { useEffect, useMemo, useState } from 'react';

import { peekSpace, type SpacePeekDto } from '../spaces-actions';
import { useSpacesClientDeps } from '../use-spaces-client-deps';

export type SpaceJoinSnapshotStatus =
  | 'loading'
  | 'live'
  | 'ended'
  | 'unavailable';

export type SpaceJoinSnapshot = {
  status: SpaceJoinSnapshotStatus;
  joinable: boolean;
  peek: SpacePeekDto | null;
};

type SpaceJoinRow = {
  readonly host_id: string | null;
  readonly ended_at: string | null;
};

function snapshotFromLocalRow(row: SpaceJoinRow): SpaceJoinSnapshot {
  const hostId = row.host_id;
  if (hostId === null || hostId.length === 0) {
    return { status: 'unavailable', joinable: false, peek: null };
  }
  if (row.ended_at !== null) {
    return { status: 'ended', joinable: false, peek: null };
  }
  return { status: 'live', joinable: true, peek: null };
}

function snapshotFromPeek(peek: SpacePeekDto): SpaceJoinSnapshot {
  if (peek.ended) {
    return { status: 'ended', joinable: false, peek };
  }
  return { status: 'live', joinable: peek.joinable, peek };
}

export function useSpaceJoinSnapshot(
  spaceId: string,
  inviteToken?: string | null
): SpaceJoinSnapshot {
  const enabled = spaceId.length > 0;
  const deps = useSpacesClientDeps();
  const { row, isLoading } = useWatchOne<SpaceJoinRow>(
    enabled
      ? `SELECT ${SpaceCol.hostId} AS host_id, ${SpaceCol.endedAt} AS ended_at
         FROM ${SPACES_TABLE.tableName}
         WHERE ${SpaceCol.id} = ?`
      : `SELECT ${SpaceCol.hostId} AS host_id, ${SpaceCol.endedAt} AS ended_at FROM ${SPACES_TABLE.tableName} WHERE 0`,
    enabled ? [spaceId] : []
  );
  const [peek, setPeek] = useState<SpacePeekDto | null>(null);
  const [peekLoading, setPeekLoading] = useState(false);
  const [peekFailed, setPeekFailed] = useState(false);
  const localMissing = enabled && !isLoading && row === null;

  useEffect(() => {
    if (!localMissing) {
      setPeek(null);
      setPeekFailed(false);
      return;
    }
    let cancelled = false;
    setPeekLoading(true);
    void peekSpace(deps, spaceId, inviteToken)
      .then((result) => {
        if (!cancelled) {
          setPeek(result);
          setPeekFailed(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPeek(null);
          setPeekFailed(true);
        }
      })
      .finally(() => {
        if (!cancelled) setPeekLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [localMissing, deps, spaceId, inviteToken]);

  return useMemo((): SpaceJoinSnapshot => {
    if (!enabled) {
      return { status: 'unavailable', joinable: false, peek: null };
    }
    if (isLoading || (localMissing && peekLoading)) {
      return { status: 'loading', joinable: false, peek: null };
    }
    if (row !== null) return snapshotFromLocalRow(row);
    if (peek !== null) return snapshotFromPeek(peek);
    if (peekFailed) {
      return { status: 'unavailable', joinable: false, peek: null };
    }
    return { status: 'unavailable', joinable: false, peek: null };
  }, [enabled, isLoading, localMissing, peekLoading, row, peek, peekFailed]);
}

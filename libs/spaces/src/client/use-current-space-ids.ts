import { useMyDeviceId, useMyId } from '@libs/auth/client/use-current-user';
import { useMemo, useRef } from 'react';

import {
  SpaceCol,
  SpaceParticipationCol,
  SPACES_TABLE,
  SPACE_PARTICIPATIONS_TABLE,
} from '@libs/db/shared/space-tables';
import {
  useSyncStatus,
  useWatchQuery,
} from '@pkgs/sync-engine/client/sync-engine-context';
import type { SyncEngineStatus } from '@pkgs/sync-engine/client/sync-status';
import { resolvePresenceRole } from '../shared/participation/space-participation-policy';

function isSyncReconnecting(status: SyncEngineStatus): boolean {
  return (
    status.connection === 'disconnected' || status.connection === 'connecting'
  );
}

export type CurrentSpaceEntry = {
  spaceId: string;
  role: 'host' | 'guest';
};

type ParticipationRow = { readonly space_id: string };
type SpaceRow = {
  readonly id: string;
  readonly host_member_id: string | null;
  readonly ended_at: string | null;
};

function buildCurrentSpaceEntries(
  memberSpaceIds: readonly string[],
  spaceRows: readonly SpaceRow[],
  memberId: string
): CurrentSpaceEntry[] {
  const byId = new Map<string, SpaceRow>();
  for (const row of spaceRows) {
    byId.set(row.id, row);
  }
  const entries: CurrentSpaceEntry[] = [];
  for (const spaceId of memberSpaceIds) {
    const space = byId.get(spaceId);
    if (space === undefined || space.ended_at !== null) continue;
    const role = resolvePresenceRole({
      hostMemberId: space.host_member_id ?? '',
      memberId,
    });
    entries.push({ spaceId, role });
  }
  return entries;
}

function participationSql(
  enabled: boolean,
  deviceId: string
): { sql: string; params: string[] } {
  if (!enabled) {
    return {
      sql: `SELECT ${SpaceParticipationCol.spaceId} AS space_id FROM ${SPACE_PARTICIPATIONS_TABLE.tableName} WHERE 0`,
      params: [],
    };
  }
  return {
    sql: `SELECT ${SpaceParticipationCol.spaceId} AS space_id
           FROM ${SPACE_PARTICIPATIONS_TABLE.tableName}
           WHERE ${SpaceParticipationCol.deviceId} = ?
             AND ${SpaceParticipationCol.leftAt} IS NULL`,
    params: [deviceId],
  };
}

function spacesSql(ids: readonly string[]): {
  sql: string;
  params: string[];
} {
  if (ids.length === 0) {
    return {
      sql: `SELECT ${SpaceCol.id}, ${SpaceCol.hostMemberId} AS host_member_id,
            ${SpaceCol.endedAt} AS ended_at FROM ${SPACES_TABLE.tableName} WHERE 0`,
      params: [],
    };
  }
  const placeholders = ids.map(() => '?').join(', ');
  return {
    sql: `SELECT ${SpaceCol.id}, ${SpaceCol.hostMemberId} AS host_member_id,
          ${SpaceCol.endedAt} AS ended_at
          FROM ${SPACES_TABLE.tableName}
          WHERE ${SpaceCol.id} IN (${placeholders})`,
    params: [...ids],
  };
}

function resolveDisplayEntries(
  entries: CurrentSpaceEntry[],
  reconnecting: boolean,
  prevEntries: CurrentSpaceEntry[]
): CurrentSpaceEntry[] {
  if (entries.length > 0) return entries;
  if (reconnecting && prevEntries.length > 0) return prevEntries;
  return entries;
}

function useCurrentSpaceWatchQueries(
  deviceId: string,
  memberId: string
): {
  entries: CurrentSpaceEntry[];
  queriesLoading: boolean;
} {
  const enabled = deviceId.length > 0;
  const partQuery = useMemo(
    () => participationSql(enabled, deviceId),
    [enabled, deviceId]
  );

  const { rows: partRows, isLoading: partLoading } =
    useWatchQuery<ParticipationRow>(partQuery.sql, partQuery.params);

  const memberSpaceIds = useMemo(
    () => [
      ...new Set(partRows.map((r) => r.space_id).filter((id) => id.length > 0)),
    ],
    [partRows]
  );

  const spacesQuery = useMemo(
    () => spacesSql(memberSpaceIds),
    [memberSpaceIds]
  );
  const { rows: spaceRows, isLoading: spacesLoading } = useWatchQuery<SpaceRow>(
    spacesQuery.sql,
    spacesQuery.params
  );

  const entries = useMemo(
    () => buildCurrentSpaceEntries(memberSpaceIds, spaceRows, memberId),
    [memberSpaceIds, spaceRows, memberId]
  );

  return {
    entries,
    queriesLoading: partLoading || spacesLoading,
  };
}

/**
 * This install's live spaces — every space with an active device participation
 * that has not ended. Role comes from spaces.host_member_id vs member id.
 */
export function useCurrentSpaceIds(): {
  entries: CurrentSpaceEntry[];
  isLoading: boolean;
} {
  const deviceId = useMyDeviceId();
  const memberId = useMyId();
  const { entries, queriesLoading } = useCurrentSpaceWatchQueries(
    deviceId,
    memberId
  );
  const status = useSyncStatus();
  const prevEntriesRef = useRef<CurrentSpaceEntry[]>([]);
  const reconnecting = isSyncReconnecting(status);
  if (entries.length > 0) {
    prevEntriesRef.current = entries;
  } else if (!reconnecting) {
    prevEntriesRef.current = [];
  }
  const displayEntries = resolveDisplayEntries(
    entries,
    reconnecting,
    prevEntriesRef.current
  );

  return {
    entries: displayEntries,
    isLoading: displayEntries.length === 0 && queriesLoading,
  };
}

/** Member ids used for space host/guest checks. */
export function useReplicationIdentityIds(): readonly string[] {
  const memberId = useMyId();
  return useMemo(() => (memberId.length > 0 ? [memberId] : []), [memberId]);
}

export function isReplicationHost(
  hostId: string | null,
  identityIds: readonly string[]
): boolean {
  if (hostId === null || hostId.length === 0) return false;
  return identityIds.includes(hostId);
}

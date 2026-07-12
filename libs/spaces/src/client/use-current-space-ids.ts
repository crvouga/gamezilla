import { useMyId } from '@libs/auth/client/use-current-user';
import { useMemo, useRef } from 'react';

import {
  SpaceCol,
  SpaceMembershipCol,
  SPACES_TABLE,
  SPACE_MEMBERSHIPS_TABLE,
} from '@libs/db/shared/space-tables';
import {
  useSyncStatus,
  useWatchQuery,
} from '@pkgs/sync-engine/client/sync-engine-context';
import type { SyncEngineStatus } from '@pkgs/sync-engine/client/sync-status';

function isSyncReconnecting(status: SyncEngineStatus): boolean {
  return (
    status.connection === 'disconnected' || status.connection === 'connecting'
  );
}

export type CurrentSpaceEntry = {
  spaceId: string;
  role: 'host' | 'guest';
};

type MembershipRow = { readonly space_id: string };
type SpaceRow = {
  readonly id: string;
  readonly host_id: string | null;
  readonly ended_at: string | null;
};

function buildCurrentSpaceEntries(
  memberSpaceIds: readonly string[],
  spaceRows: readonly SpaceRow[],
  myId: string
): CurrentSpaceEntry[] {
  const byId = new Map<string, SpaceRow>();
  for (const row of spaceRows) {
    byId.set(row.id, row);
  }
  const entries: CurrentSpaceEntry[] = [];
  for (const spaceId of memberSpaceIds) {
    const space = byId.get(spaceId);
    if (space === undefined || space.ended_at !== null) continue;
    const hostId = space.host_id;
    const role =
      hostId !== null && hostId.length > 0 && hostId === myId
        ? 'host'
        : 'guest';
    entries.push({ spaceId, role });
  }
  return entries;
}

function membershipSql(
  enabled: boolean,
  myId: string
): { sql: string; params: string[] } {
  if (!enabled) {
    return {
      sql: `SELECT ${SpaceMembershipCol.spaceId} AS space_id FROM ${SPACE_MEMBERSHIPS_TABLE.tableName} WHERE 0`,
      params: [],
    };
  }
  return {
    sql: `SELECT ${SpaceMembershipCol.spaceId} AS space_id
           FROM ${SPACE_MEMBERSHIPS_TABLE.tableName}
           WHERE ${SpaceMembershipCol.guestId} = ? AND ${SpaceMembershipCol.leftAt} IS NULL`,
    params: [myId],
  };
}

function spacesSql(ids: readonly string[]): {
  sql: string;
  params: string[];
} {
  if (ids.length === 0) {
    return {
      sql: `SELECT ${SpaceCol.id}, ${SpaceCol.hostId} AS host_id, ${SpaceCol.endedAt} AS ended_at FROM ${SPACES_TABLE.tableName} WHERE 0`,
      params: [],
    };
  }
  const placeholders = ids.map(() => '?').join(', ');
  return {
    sql: `SELECT ${SpaceCol.id}, ${SpaceCol.hostId} AS host_id, ${SpaceCol.endedAt} AS ended_at
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
  myId: string
): {
  entries: CurrentSpaceEntry[];
  queriesLoading: boolean;
} {
  const enabled = myId.length > 0;
  const memQuery = useMemo(() => membershipSql(enabled, myId), [enabled, myId]);

  const { rows: memRows, isLoading: memLoading } = useWatchQuery<MembershipRow>(
    memQuery.sql,
    memQuery.params
  );

  const memberSpaceIds = useMemo(
    () => [
      ...new Set(
        memRows.map((r) => r.space_id).filter((id) => id.length > 0)
      ),
    ],
    [memRows]
  );

  const spacesQuery = useMemo(() => spacesSql(memberSpaceIds), [memberSpaceIds]);
  const { rows: spaceRows, isLoading: spacesLoading } = useWatchQuery<SpaceRow>(
    spacesQuery.sql,
    spacesQuery.params
  );

  const entries = useMemo(
    () => buildCurrentSpaceEntries(memberSpaceIds, spaceRows, myId),
    [memberSpaceIds, spaceRows, myId]
  );

  return {
    entries,
    queriesLoading: memLoading || spacesLoading,
  };
}

/**
 * The current user's live spaces — every space with an active membership
 * that has not ended. Role comes from spaces.host_id, not from a separate
 * host query.
 */
export function useCurrentSpaceIds(): {
  entries: CurrentSpaceEntry[];
  isLoading: boolean;
} {
  const myId = useMyId();
  const { entries, queriesLoading } = useCurrentSpaceWatchQueries(myId);
  const status = useSyncStatus();
  const prevEntriesRef = useRef<CurrentSpaceEntry[]>([]);
  const reconnecting = isSyncReconnecting(status);
  if (entries.length > 0) {
    prevEntriesRef.current = entries;
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

/** Replication ids for space host/guest queries (signed-in account or install id). */
export function useReplicationIdentityIds(): readonly string[] {
  const myId = useMyId();
  return useMemo(() => (myId.length > 0 ? [myId] : []), [myId]);
}

export function isReplicationHost(
  hostId: string | null,
  identityIds: readonly string[]
): boolean {
  if (hostId === null || hostId.length === 0) return false;
  return identityIds.includes(hostId);
}

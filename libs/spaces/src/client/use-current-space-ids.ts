import {
  SPACE_MEMBERSHIPS_TABLE,
  SpaceCol,
  SpaceMembershipCol,
  SPACES_TABLE,
} from '@libs/db/shared/space-tables';
import { useMyAccountId } from '@libs/auth/client/use-current-user';
import { useMemo, useRef } from 'react';
import {
  useSyncStatus,
  useWatchQuery,
} from '@pkgs/sync-engine/client/sync-engine-context';
import type { SyncEngineStatus } from '@pkgs/sync-engine/client/sync-status';
import { resolvePresenceRole } from '../shared/participation/space-participation-policy';
import { useSyncEnginePaintReady } from '@pkgs/sync-engine/client/sync-engine-paint-gate';

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

function membershipSql(
  enabled: boolean,
  accountId: string
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
           WHERE ${SpaceMembershipCol.memberId} = ?
             AND ${SpaceMembershipCol.leftAt} IS NULL`,
    params: [accountId],
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
  accountId: string | null
): {
  entries: CurrentSpaceEntry[];
  queriesLoading: boolean;
} {
  const enabled = accountId !== null && accountId.length > 0;
  const memberQuery = useMemo(
    () => membershipSql(enabled, accountId ?? ''),
    [enabled, accountId]
  );

  const { rows: memberRows, isLoading: memberLoading } =
    useWatchQuery<MembershipRow>(memberQuery.sql, memberQuery.params);

  const memberSpaceIds = useMemo(
    () => [
      ...new Set(
        memberRows.map((r) => r.space_id).filter((id) => id.length > 0)
      ),
    ],
    [memberRows]
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
    () =>
      buildCurrentSpaceEntries(memberSpaceIds, spaceRows, accountId ?? ''),
    [memberSpaceIds, spaceRows, accountId]
  );

  return {
    entries,
    queriesLoading: memberLoading || spacesLoading,
  };
}

/**
 * This account's live spaces — every space with an active membership that has
 * not ended. Role comes from spaces.host_member_id vs account id.
 */
export function useCurrentSpaceIds(): {
  entries: CurrentSpaceEntry[];
  isLoading: boolean;
} {
  const accountId = useMyAccountId();
  const paintReady = useSyncEnginePaintReady();
  const { entries, queriesLoading } = useCurrentSpaceWatchQueries(
    paintReady ? accountId : null
  );
  const status = useSyncStatus();
  const prevEntriesRef = useRef<CurrentSpaceEntry[]>([]);
  const identityRef = useRef(accountId);
  if (identityRef.current !== accountId) {
    identityRef.current = accountId;
    prevEntriesRef.current = [];
  }
  if (!paintReady) {
    prevEntriesRef.current = [];
    return { entries: [], isLoading: true };
  }
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

/** Account ids used for space host/guest checks. */
export function useReplicationIdentityIds(): readonly string[] {
  const accountId = useMyAccountId();
  return useMemo(
    () => (accountId !== null && accountId.length > 0 ? [accountId] : []),
    [accountId]
  );
}

export function isReplicationHost(
  hostId: string | null,
  identityIds: readonly string[]
): boolean {
  if (hostId === null || hostId.length === 0) return false;
  return identityIds.includes(hostId);
}

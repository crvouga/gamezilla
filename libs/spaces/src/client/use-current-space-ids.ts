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

type MembershipRow = {
  readonly space_id: string;
  readonly joined_at: string | null;
};
type SpaceRow = {
  readonly id: string;
  readonly host_member_id: string | null;
  readonly host_account_id: string | null;
  readonly ended_at: string | null;
};

function isHostOfSpace(space: SpaceRow, memberId: string): boolean {
  if (memberId.length === 0) return false;
  return (
    space.host_member_id === memberId || space.host_account_id === memberId
  );
}

function roleForMemberSpace(
  space: SpaceRow,
  memberId: string
): 'host' | 'guest' {
  if (isHostOfSpace(space, memberId)) return 'host';
  return resolvePresenceRole({
    hostMemberId: space.host_member_id ?? '',
    memberId,
  });
}

function appendMemberEntries(args: {
  entries: CurrentSpaceEntry[];
  seen: Set<string>;
  memberSpaceIds: readonly string[];
  byId: Map<string, SpaceRow>;
  memberId: string;
}): void {
  for (const spaceId of args.memberSpaceIds) {
    const space = args.byId.get(spaceId);
    if (space === undefined || space.ended_at !== null) continue;
    args.seen.add(spaceId);
    args.entries.push({
      spaceId,
      role: roleForMemberSpace(space, args.memberId),
    });
  }
}

function appendHostedOnlyEntries(args: {
  entries: CurrentSpaceEntry[];
  seen: Set<string>;
  hostedSpaceRows: readonly SpaceRow[];
  memberId: string;
}): void {
  for (const space of args.hostedSpaceRows) {
    if (space.ended_at !== null || args.seen.has(space.id)) continue;
    if (!isHostOfSpace(space, args.memberId)) continue;
    args.entries.push({ spaceId: space.id, role: 'host' });
  }
}

/**
 * Merge membership seats with live hosted spaces (host fields match even when
 * the host membership row is missing — sync/orphan gap).
 */
export function buildCurrentSpaceEntries(
  memberSpaceIds: readonly string[],
  memberSpaceRows: readonly SpaceRow[],
  hostedSpaceRows: readonly SpaceRow[],
  memberId: string
): CurrentSpaceEntry[] {
  const byId = new Map<string, SpaceRow>();
  for (const row of memberSpaceRows) {
    byId.set(row.id, row);
  }
  for (const row of hostedSpaceRows) {
    byId.set(row.id, row);
  }
  const seen = new Set<string>();
  const entries: CurrentSpaceEntry[] = [];
  appendMemberEntries({
    entries,
    seen,
    memberSpaceIds,
    byId,
    memberId,
  });
  appendHostedOnlyEntries({
    entries,
    seen,
    hostedSpaceRows,
    memberId,
  });
  return entries;
}

function membershipSql(
  enabled: boolean,
  accountId: string
): { sql: string; params: string[] } {
  if (!enabled) {
    return {
      sql: `SELECT ${SpaceMembershipCol.spaceId} AS space_id,
             ${SpaceMembershipCol.joinedAt} AS joined_at
             FROM ${SPACE_MEMBERSHIPS_TABLE.tableName} WHERE 0`,
      params: [],
    };
  }
  return {
    sql: `SELECT ${SpaceMembershipCol.spaceId} AS space_id,
             ${SpaceMembershipCol.joinedAt} AS joined_at
           FROM ${SPACE_MEMBERSHIPS_TABLE.tableName}
           WHERE ${SpaceMembershipCol.memberId} = ?
             AND ${SpaceMembershipCol.leftAt} IS NULL
           ORDER BY ${SpaceMembershipCol.joinedAt} DESC`,
    params: [accountId],
  };
}

function hostedSpacesSql(
  enabled: boolean,
  accountId: string
): { sql: string; params: string[] } {
  if (!enabled) {
    return {
      sql: `SELECT ${SpaceCol.id}, ${SpaceCol.hostMemberId} AS host_member_id,
            ${SpaceCol.hostAccountId} AS host_account_id,
            ${SpaceCol.endedAt} AS ended_at FROM ${SPACES_TABLE.tableName} WHERE 0`,
      params: [],
    };
  }
  return {
    sql: `SELECT ${SpaceCol.id}, ${SpaceCol.hostMemberId} AS host_member_id,
          ${SpaceCol.hostAccountId} AS host_account_id,
          ${SpaceCol.endedAt} AS ended_at
          FROM ${SPACES_TABLE.tableName}
          WHERE ${SpaceCol.endedAt} IS NULL
            AND (
              ${SpaceCol.hostMemberId} = ?
              OR ${SpaceCol.hostAccountId} = ?
            )
          ORDER BY ${SpaceCol.createdAt} DESC`,
    params: [accountId, accountId],
  };
}

function spacesSql(ids: readonly string[]): {
  sql: string;
  params: string[];
} {
  if (ids.length === 0) {
    return {
      sql: `SELECT ${SpaceCol.id}, ${SpaceCol.hostMemberId} AS host_member_id,
            ${SpaceCol.hostAccountId} AS host_account_id,
            ${SpaceCol.endedAt} AS ended_at FROM ${SPACES_TABLE.tableName} WHERE 0`,
      params: [],
    };
  }
  const placeholders = ids.map(() => '?').join(', ');
  return {
    sql: `SELECT ${SpaceCol.id}, ${SpaceCol.hostMemberId} AS host_member_id,
          ${SpaceCol.hostAccountId} AS host_account_id,
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

function useCurrentSpaceWatchQueries(accountId: string | null): {
  entries: CurrentSpaceEntry[];
  queriesLoading: boolean;
} {
  const enabled = accountId !== null && accountId.length > 0;
  const memberQuery = useMemo(
    () => membershipSql(enabled, accountId ?? ''),
    [enabled, accountId]
  );
  const hostedQuery = useMemo(
    () => hostedSpacesSql(enabled, accountId ?? ''),
    [enabled, accountId]
  );

  const { rows: memberRows, isLoading: memberLoading } =
    useWatchQuery<MembershipRow>(memberQuery.sql, memberQuery.params);
  const { rows: hostedRows, isLoading: hostedLoading } =
    useWatchQuery<SpaceRow>(hostedQuery.sql, hostedQuery.params);

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
  const { rows: memberSpaceRows, isLoading: spacesLoading } =
    useWatchQuery<SpaceRow>(spacesQuery.sql, spacesQuery.params);

  const entries = useMemo(
    () =>
      buildCurrentSpaceEntries(
        memberSpaceIds,
        memberSpaceRows,
        hostedRows,
        accountId ?? ''
      ),
    [memberSpaceIds, memberSpaceRows, hostedRows, accountId]
  );

  return {
    entries,
    queriesLoading: memberLoading || spacesLoading || hostedLoading,
  };
}

/**
 * This account's live spaces — active memberships plus live spaces this
 * account hosts (host_member_id / host_account_id), so orphaned host seats
 * still surface in the miniplayer.
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

import { useMyAccountId } from '@libs/auth/client/use-current-user';
import { SpaceCol, SPACES_TABLE } from '@libs/db/shared/space-tables';
import type { Sql } from '@pkgs/sql';
import { sqlMap } from '@pkgs/sql-map';

import {
  useSyncStatus,
  useWatchQuery,
} from '@pkgs/sync-engine/client/sync-engine-context';
import { useSyncEnginePaintReady } from '@pkgs/sync-engine/client/sync-engine-paint-gate';
import type { SyncEngineStatus } from '@pkgs/sync-engine/client/sync-status';
import { useMemo, useRef } from 'react';

import { isViewerSpaceHost } from '../shared/resolve-space-presence';
import { useOpenSpaceIds } from './open-space/use-open-space-ids';

function isSyncReconnecting(status: SyncEngineStatus): boolean {
  return (
    status.connection === 'disconnected' || status.connection === 'connecting'
  );
}

export type CurrentSpaceEntry = {
  spaceId: string;
  role: 'host' | 'guest';
};

type SpaceRow = {
  readonly id: string;
  readonly host_member_id: string | null;
  readonly host_account_id: string | null;
  readonly ended_at: string | null;
};

/**
 * Build miniplayer entries from locally-open space ids + live space rows.
 */
export function buildCurrentSpaceEntries(
  spaceRows: readonly SpaceRow[],
  openSpaceIds: readonly string[],
  memberId: string
): CurrentSpaceEntry[] {
  const byId = new Map(spaceRows.map((row) => [row.id, row]));
  const entries: CurrentSpaceEntry[] = [];
  const seen = new Set<string>();
  for (const spaceId of openSpaceIds) {
    if (spaceId.length === 0 || seen.has(spaceId)) continue;
    const space = byId.get(spaceId);
    if (space === undefined || space.ended_at !== null) continue;
    seen.add(spaceId);
    entries.push({
      spaceId,
      role: isViewerSpaceHost(
        {
          host_member_id: space.host_member_id,
          host_account_id: space.host_account_id,
          ended_at: space.ended_at,
        },
        memberId
      )
        ? 'host'
        : 'guest',
    });
  }
  return entries;
}

function openSpacesSql(enabled: boolean, openSpaceIds: readonly string[]): Sql {
  if (!enabled || openSpaceIds.length === 0) {
    return sqlMap({
      select: [
        SpaceCol.id,
        SpaceCol.hostMemberId,
        SpaceCol.hostAccountId,
        SpaceCol.endedAt,
      ],
      from: SPACES_TABLE.tableName,
      where: ['=', 1, 0],
    });
  }
  return sqlMap({
    select: [
      SpaceCol.id,
      SpaceCol.hostMemberId,
      SpaceCol.hostAccountId,
      SpaceCol.endedAt,
    ],
    from: SPACES_TABLE.tableName,
    where: ['in', SpaceCol.id, [...openSpaceIds]],
  });
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
  accountId: string | null,
  openSpaceIds: readonly string[]
): {
  entries: CurrentSpaceEntry[];
  queriesLoading: boolean;
} {
  const enabled = accountId !== null && accountId.length > 0;
  const query = useMemo(
    () => openSpacesSql(enabled, openSpaceIds),
    [enabled, openSpaceIds]
  );
  const { rows, isLoading } = useWatchQuery<SpaceRow>(query);
  const entries = useMemo(
    () => buildCurrentSpaceEntries(rows, openSpaceIds, accountId ?? ''),
    [rows, openSpaceIds, accountId]
  );
  return { entries, queriesLoading: isLoading };
}

/**
 * This account's locally-open live spaces (miniplayer).
 */
export function useCurrentSpaceIds(): {
  entries: CurrentSpaceEntry[];
  isLoading: boolean;
} {
  const accountId = useMyAccountId();
  const paintReady = useSyncEnginePaintReady();
  const { openSpaceIds } = useOpenSpaceIds();
  const { entries, queriesLoading } = useCurrentSpaceWatchQueries(
    paintReady ? accountId : null,
    openSpaceIds
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

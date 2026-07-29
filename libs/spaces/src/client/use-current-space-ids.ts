import { useMyAccountId } from '@libs/auth/client/use-current-user';
import {
  SpaceCol,
  SpaceMembershipCol,
  SPACE_MEMBERSHIPS_TABLE,
} from '@libs/db/shared/space-tables';
import { honey, type Sql } from '@pkgs/sql';
import {
  useSyncStatus,
  useWatchQuery,
} from '@pkgs/sync-engine/client/sync-engine-context';
import { useSyncEnginePaintReady } from '@pkgs/sync-engine/client/sync-engine-paint-gate';
import type { SyncEngineStatus } from '@pkgs/sync-engine/client/sync-status';
import { useMemo, useRef } from 'react';

import { isViewerSpaceHost } from '../shared/resolve-space-presence';
import { myLiveSeatSpacesSelectSql } from './my-live-space-seat-sql';

function isSyncReconnecting(status: SyncEngineStatus): boolean {
  return (
    status.connection === 'disconnected' || status.connection === 'connecting'
  );
}

export type CurrentSpaceEntry = {
  spaceId: string;
  role: 'host' | 'guest';
};

type SeatRow = {
  readonly id: string;
  readonly host_member_id: string | null;
  readonly host_account_id: string | null;
  readonly ended_at: string | null;
  readonly joined_at: string | null;
};

/**
 * Build miniplayer entries from live active-membership seats (I2 / I7).
 */
export function buildCurrentSpaceEntries(
  seatRows: readonly SeatRow[],
  memberId: string
): CurrentSpaceEntry[] {
  const entries: CurrentSpaceEntry[] = [];
  const seen = new Set<string>();
  for (const space of seatRows) {
    if (space.ended_at !== null || space.id.length === 0) continue;
    if (seen.has(space.id)) continue;
    seen.add(space.id);
    entries.push({
      spaceId: space.id,
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

function seatsSql(enabled: boolean, accountId: string): Sql {
  if (!enabled) {
    return honey({
      select: [
        SpaceCol.id,
        SpaceCol.hostMemberId,
        SpaceCol.hostAccountId,
        SpaceCol.endedAt,
        SpaceMembershipCol.joinedAt,
      ],
      from: SPACE_MEMBERSHIPS_TABLE.tableName,
      where: ['=', 1, 0],
    });
  }
  return myLiveSeatSpacesSelectSql(accountId);
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
  const query = useMemo(
    () => seatsSql(enabled, accountId ?? ''),
    [enabled, accountId]
  );
  const { rows, isLoading } = useWatchQuery<SeatRow>(query);
  const entries = useMemo(
    () => buildCurrentSpaceEntries(rows, accountId ?? ''),
    [rows, accountId]
  );
  return { entries, queriesLoading: isLoading };
}

/**
 * This account's live spaces — active memberships on live spaces only (I2 / I7).
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

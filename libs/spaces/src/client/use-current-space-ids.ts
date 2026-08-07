import { useMyId } from '@libs/auth/client/use-current-user';
import { type Sql, sql } from '@pkgs/sql';

import {
  useQuery,
  useSyncEngine,
} from '@pkgs/sync-engine/client/sync-engine-context';
import { useMemo } from 'react';

import { isViewerSpaceHost } from '../shared/resolve-space-presence';

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
 * Build miniplayer entries from open-session JOIN live space rows.
 * Ended rows are never included — DB `ended_at` is authoritative.
 */
export function buildCurrentSpaceEntries(
  spaceRows: readonly SpaceRow[],
  memberId: string
): CurrentSpaceEntry[] {
  const entries: CurrentSpaceEntry[] = [];
  const seen = new Set<string>();
  for (const space of spaceRows) {
    if (space.id.length === 0 || seen.has(space.id)) continue;
    if (space.ended_at !== null) continue;
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

function currentSpacesSql(enabled: boolean): Sql<SpaceRow> {
  if (!enabled) {
    return sql<SpaceRow>`
      SELECT s.id, s.host_member_id, s.host_account_id, s.ended_at
      FROM spaces AS s
      WHERE false
    `;
  }
  return sql<SpaceRow>`
    SELECT s.id, s.host_member_id, s.host_account_id, s.ended_at
    FROM spaces AS s
    INNER JOIN space_open_sessions AS o ON o.space_id = s.id
    WHERE s.ended_at IS NULL
    ORDER BY o.opened_at DESC
  `;
}

/**
 * This account's locally-open live spaces (miniplayer).
 * Visibility is the SQL join of open sessions × live spaces.
 */
export function useCurrentSpaceIds(): {
  entries: CurrentSpaceEntry[];
  isLoading: boolean;
} {
  const myId = useMyId();
  const { paintReady } = useSyncEngine();
  const enabled = paintReady && myId.length > 0;
  const query = useMemo(() => currentSpacesSql(enabled), [enabled]);
  const { rows, isLoading } = useQuery(query);
  if (!paintReady) {
    return { entries: [], isLoading: true };
  }
  const entries = buildCurrentSpaceEntries(rows, myId);
  return {
    entries,
    isLoading: entries.length === 0 && isLoading,
  };
}

/** User ids used for space host/guest checks. */
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

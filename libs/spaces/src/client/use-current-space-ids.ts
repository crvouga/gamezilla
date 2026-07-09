import { useMyId } from '@libs/auth/client/use-current-user';
import { useMemo } from 'react';

import {
  SpaceCol,
  SpaceMembershipCol,
  SPACES_TABLE,
  SPACE_MEMBERSHIPS_TABLE,
} from '@libs/spaces/shared/sync-tables';
import { useWatchQuery } from '@pkgs/sync-engine/client/sync-engine-context';

export type CurrentSpaceEntry = {
  spaceId: string;
  role: 'host' | 'guest';
};

type HostedRow = { readonly id: string };
type GuestMemRow = { readonly space_id: string };
type GuestSpaceRow = { readonly id: string; readonly ended_at: string | null };

function buildCurrentSpaceEntries(
  hostedIds: readonly string[],
  guestSpaceIds: readonly string[],
  guestSpaceRows: readonly GuestSpaceRow[]
): CurrentSpaceEntry[] {
  const bySpace = new Map<string, CurrentSpaceEntry>();
  for (const spaceId of hostedIds) {
    bySpace.set(spaceId, { spaceId, role: 'host' });
  }
  const liveById = new Map<string, boolean>();
  for (const row of guestSpaceRows) {
    liveById.set(row.id, row.ended_at === null);
  }
  for (const sid of guestSpaceIds) {
    if (bySpace.has(sid)) continue;
    const live = liveById.get(sid);
    if (live === false) continue;
    bySpace.set(sid, { spaceId: sid, role: 'guest' });
  }
  return [...bySpace.values()];
}

function guestSpacesSql(ids: readonly string[]): { sql: string; params: string[] } {
  if (ids.length === 0) {
    return {
      sql: `SELECT ${SpaceCol.id}, ${SpaceCol.endedAt} AS ended_at FROM ${SPACES_TABLE.tableName} WHERE 0`,
      params: [],
    };
  }
  const placeholders = ids.map(() => '?').join(', ');
  return {
    sql: `SELECT ${SpaceCol.id}, ${SpaceCol.endedAt} AS ended_at
          FROM ${SPACES_TABLE.tableName}
          WHERE ${SpaceCol.id} IN (${placeholders})`,
    params: [...ids],
  };
}

/**
 * The current user's live spaces — every space they host, plus every space
 * they have an active guest membership on (deduped, host wins).
 */
export function useCurrentSpaceIds(): {
  entries: CurrentSpaceEntry[];
  isLoading: boolean;
} {
  const myId = useMyId();
  const enabled = myId.length > 0;

  const { rows: hostedRows, isLoading: hostedLoading } = useWatchQuery<HostedRow>(
    enabled
      ? `SELECT ${SpaceCol.id} AS id FROM ${SPACES_TABLE.tableName}
         WHERE ${SpaceCol.hostId} = ? AND ${SpaceCol.endedAt} IS NULL
         ORDER BY ${SpaceCol.createdAt} DESC`
      : `SELECT ${SpaceCol.id} AS id FROM ${SPACES_TABLE.tableName} WHERE 0`,
    enabled ? [myId] : []
  );

  const { rows: guestMemRows, isLoading: guestMemLoading } =
    useWatchQuery<GuestMemRow>(
      enabled
        ? `SELECT ${SpaceMembershipCol.spaceId} AS space_id
           FROM ${SPACE_MEMBERSHIPS_TABLE.tableName}
           WHERE ${SpaceMembershipCol.guestId} = ? AND ${SpaceMembershipCol.leftAt} IS NULL`
        : `SELECT ${SpaceMembershipCol.spaceId} AS space_id FROM ${SPACE_MEMBERSHIPS_TABLE.tableName} WHERE 0`,
      enabled ? [myId] : []
    );

  const guestSpaceIds = useMemo(
    () => [...new Set(guestMemRows.map((r) => r.space_id).filter((id) => id.length > 0))],
    [guestMemRows]
  );

  const guestSpacesQuery = useMemo(
    () => guestSpacesSql(guestSpaceIds),
    [guestSpaceIds]
  );
  const { rows: guestSpaceRows, isLoading: guestSpacesLoading } =
    useWatchQuery<GuestSpaceRow>(guestSpacesQuery.sql, guestSpacesQuery.params);

  const entries = useMemo(
    () =>
      buildCurrentSpaceEntries(
        hostedRows.map((r) => r.id),
        guestSpaceIds,
        guestSpaceRows
      ),
    [hostedRows, guestSpaceIds, guestSpaceRows]
  );

  return {
    entries,
    isLoading: hostedLoading || guestMemLoading || guestSpacesLoading,
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

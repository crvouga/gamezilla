import { SpaceCol, SPACES_TABLE } from '@libs/db/shared/space-tables';
import { raw, sql } from '@pkgs/sql';
import { useWatchOne } from '@pkgs/sync-engine/client/sync-engine-context';

/**
 * Returns the live space id hosted by `hostAccountId` when that space is
 * friends-visible or public (already synced to this client).
 */
export function useFriendLiveSpaceId(hostAccountId: string): string | null {
  const enabled = hostAccountId.length > 0;
  const { row } = useWatchOne<{ readonly id: string }>(
    enabled
      ? sql`SELECT ${raw(SpaceCol.id)} AS id FROM ${raw(SPACES_TABLE.tableName)}
         WHERE ${raw(SpaceCol.endedAt)} IS NULL
           AND ${raw(SpaceCol.hostAccountId)} = ${hostAccountId}
           AND (${raw(SpaceCol.visibility)} = 'friends' OR ${raw(SpaceCol.visibility)} = 'public')
         ORDER BY ${raw(SpaceCol.createdAt)} DESC
         LIMIT 1`
      : sql`SELECT ${raw(SpaceCol.id)} AS id FROM ${raw(SPACES_TABLE.tableName)} WHERE 0`
  );
  return row?.id ?? null;
}

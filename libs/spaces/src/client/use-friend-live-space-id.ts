import { SpaceCol, SPACES_TABLE } from '@libs/db/shared/space-tables';
import { sql, ident } from '@pkgs/sql';
import { useWatchOne } from '@pkgs/sync-engine/client/sync-engine-context';

/**
 * Returns the live space id hosted by `hostAccountId` when that space is
 * friends-visible or public (already synced to this client).
 */
export function useFriendLiveSpaceId(hostAccountId: string): string | null {
  const enabled = hostAccountId.length > 0;
  const { row } = useWatchOne<{ readonly id: string }>(
    enabled
      ? sql`SELECT ${ident(SpaceCol.id)} AS id FROM ${ident(SPACES_TABLE.tableName)}
         WHERE ${ident(SpaceCol.endedAt)} IS NULL
           AND ${ident(SpaceCol.hostAccountId)} = ${hostAccountId}
           AND (${ident(SpaceCol.visibility)} = 'friends' OR ${ident(SpaceCol.visibility)} = 'public')
         ORDER BY ${ident(SpaceCol.createdAt)} DESC
         LIMIT 1`
      : sql`SELECT ${ident(SpaceCol.id)} AS id FROM ${ident(SPACES_TABLE.tableName)} WHERE 0`
  );
  return row?.id ?? null;
}

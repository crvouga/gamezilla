import { SpaceCol, SPACES_TABLE } from '@libs/db/shared/space-tables';
import { useWatchOne } from '@pkgs/sync-engine/client/sync-engine-context';

/**
 * Returns the live space id hosted by `hostAccountId` when that space is
 * friends-visible or public (already synced to this client).
 */
export function useFriendLiveSpaceId(
  hostAccountId: string
): string | null {
  const enabled = hostAccountId.length > 0;
  const { row } = useWatchOne<{ readonly id: string }>(
    enabled
      ? `SELECT ${SpaceCol.id} AS id FROM ${SPACES_TABLE.tableName}
         WHERE ${SpaceCol.endedAt} IS NULL
           AND ${SpaceCol.hostAccountId} = ?
           AND (${SpaceCol.visibility} = 'friends' OR ${SpaceCol.visibility} = 'public')
         ORDER BY ${SpaceCol.createdAt} DESC
         LIMIT 1`
      : `SELECT ${SpaceCol.id} AS id FROM ${SPACES_TABLE.tableName} WHERE 0`,
    enabled ? [hostAccountId] : []
  );
  return row?.id ?? null;
}

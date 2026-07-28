import { SpaceCol, SPACES_TABLE } from '@libs/db/shared/space-tables';
import { honey } from '@pkgs/sql';
import { useWatchOne } from '@pkgs/sync-engine/client/sync-engine-context';

/**
 * Returns the live space id hosted by `hostAccountId` when that space is
 * friends-visible or public (already synced to this client).
 */
export function useFriendLiveSpaceId(hostAccountId: string): string | null {
  const enabled = hostAccountId.length > 0;
  const { row } = useWatchOne<{ readonly id: string }>(
    enabled
      ? honey({
          select: [SpaceCol.id],
          from: SPACES_TABLE.tableName,
          where: [
            'and',
            ['is-null', SpaceCol.endedAt],
            ['=', SpaceCol.hostAccountId, hostAccountId],
            [
              'or',
              ['=', SpaceCol.visibility, 'friends'],
              ['=', SpaceCol.visibility, 'public'],
            ],
          ],
          orderBy: [[SpaceCol.createdAt, 'desc']],
          limit: 1,
        })
      : honey({
          select: [SpaceCol.id],
          from: SPACES_TABLE.tableName,
          where: ['=', 1, 0],
        })
  );
  return row?.id ?? null;
}

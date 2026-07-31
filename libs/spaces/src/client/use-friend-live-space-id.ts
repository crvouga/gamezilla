import { SpaceCol, SPACES_TABLE } from '@libs/db/shared/space-tables';
import { sqlMap } from '@pkgs/sql';
import { useWatchOne } from '@pkgs/sync-engine/client/sync-engine-context';

/**
 * Returns the live space id hosted by `hostAccountId` when that space is
 * public (already synced to this client). Private spaces only appear when
 * the viewer is allowlisted or a member.
 */
export function useFriendLiveSpaceId(hostAccountId: string): string | null {
  const enabled = hostAccountId.length > 0;
  const { row } = useWatchOne<{ readonly id: string }>(
    enabled
      ? sqlMap({
          select: [SpaceCol.id],
          from: SPACES_TABLE.tableName,
          where: [
            'and',
            ['is-null', SpaceCol.endedAt],
            ['=', SpaceCol.hostAccountId, hostAccountId],
            ['=', SpaceCol.visibility, 'public'],
          ],
          orderBy: [[SpaceCol.createdAt, 'desc']],
          limit: 1,
        })
      : sqlMap({
          select: [SpaceCol.id],
          from: SPACES_TABLE.tableName,
          where: ['=', 1, 0],
        })
  );
  return row?.id ?? null;
}

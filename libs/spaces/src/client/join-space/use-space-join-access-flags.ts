import {
  SPACE_USERS_TABLE,
  SpaceUserCol,
  spaceUserEntityId,
} from '@libs/db/shared/space-tables';
import { honey } from '@pkgs/sql';
import { useWatchOne } from '@pkgs/sync-engine/client/sync-engine-context';

/** True when the viewer has a local space_users ACL row for this space. */
export function useHasSpaceUserLocal(
  spaceId: string,
  userId: string | null
): boolean {
  const enabled = spaceId.length > 0 && userId !== null && userId.length > 0;
  const id =
    enabled && userId !== null ? spaceUserEntityId(spaceId, userId) : '';
  const { row } = useWatchOne<{ readonly id: string }>(
    honey({
      select: [SpaceUserCol.id],
      from: SPACE_USERS_TABLE.tableName,
      where: enabled ? ['=', SpaceUserCol.id, id] : ['=', 1, 0],
      limit: 1,
    })
  );
  return row !== null;
}

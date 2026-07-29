import {
  SPACE_ALLOWLIST_TABLE,
  SpaceAllowlistCol,
  spaceAllowlistEntityId,
} from '@libs/db/shared/space-tables';
import { honey } from '@pkgs/sql';
import { useWatchOne } from '@pkgs/sync-engine/client/sync-engine-context';

/** True when the viewer has a local allowlist row for this space. */
export function useIsAllowlistedLocal(
  spaceId: string,
  userId: string | null
): boolean {
  const enabled =
    spaceId.length > 0 && userId !== null && userId.length > 0;
  const id =
    enabled && userId !== null
      ? spaceAllowlistEntityId(spaceId, userId)
      : '';
  const { row } = useWatchOne<{ readonly id: string }>(
    honey({
      select: [SpaceAllowlistCol.id],
      from: SPACE_ALLOWLIST_TABLE.tableName,
      where: enabled ? ['=', SpaceAllowlistCol.id, id] : ['=', 1, 0],
      limit: 1,
    })
  );
  return row !== null;
}

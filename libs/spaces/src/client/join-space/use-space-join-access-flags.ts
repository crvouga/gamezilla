import { spaceUserEntityId } from '@libs/spaces/shared/participation/participation-ids';
import { sql } from '@pkgs/sql';

import { useQuery } from '@pkgs/sync-engine/client';

/** True when the viewer has a local space_users ACL row for this space. */
export function useHasSpaceUserLocal(
  spaceId: string,
  userId: string | null
): boolean {
  const enabled = spaceId.length > 0 && userId !== null && userId.length > 0;
  const id =
    enabled && userId !== null ? spaceUserEntityId(spaceId, userId) : '';
  const { rows } = useQuery(sql<{ readonly id: string }>`
    SELECT id
    FROM space_users
    WHERE id = ${id} AND _deleted_at IS NULL
    LIMIT 1
  `);
  const row = rows[0] ?? null;
  return row !== null;
}

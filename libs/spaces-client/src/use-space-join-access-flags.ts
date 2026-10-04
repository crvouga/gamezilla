import { spaceUserEntityId } from '@libs/spaces-shared/participation-ids';
import sql from '@pkgs/sql-root-shared/sql';
import { createQuery } from '@pkgs/sync-engine-client/sync-engine-context';
import { type Accessor, createMemo } from 'solid-js';

type IdLike = string | null | Accessor<string | null>;

function readId(id: IdLike): string | null {
  return typeof id === 'function' ? id() : id;
}

/** True when the viewer has a local spaces_users ACL row for this space. */
export function useHasSpaceUserLocal(
  spaceId: string | Accessor<string>,
  userId: IdLike
): Accessor<boolean> {
  const enabled = createMemo(() => {
    const id = readId(userId);
    return (
      (typeof spaceId === 'string' ? spaceId : spaceId()).length > 0 &&
      id !== null &&
      id.length > 0
    );
  });
  const id = createMemo(() => {
    const user = readId(userId);
    return enabled() && user !== null
      ? spaceUserEntityId(
          typeof spaceId === 'string' ? spaceId : spaceId(),
          user
        )
      : '';
  });
  const query = createQuery(() => {
    return sql<{ readonly id: string }>`
      SELECT id
      FROM spaces_users
      WHERE id = ${id()} AND deleted_at IS NULL
      LIMIT 1
    `;
  });
  const row = createMemo(() => query.rows()[0] ?? null);
  return createMemo(() => row() !== null);
}

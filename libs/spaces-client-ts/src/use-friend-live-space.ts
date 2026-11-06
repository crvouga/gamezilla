import sql from '@pkgs/sql-root-shared-ts/sql';

import { createQuery } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import { type Accessor, createMemo } from 'solid-js';

/** The live space a friend is in, and whether they are the one hosting it. */
export type FriendLiveSpace = {
  readonly spaceId: string;
  readonly hosting: boolean;
};

type FriendLiveSpaceRow = {
  readonly id: string;
  readonly host_account_id: string | null;
  readonly host_member_id: string | null;
};

/**
 * The live space this friend is in, when it is already visible to the
 * client: the space they host, or one they are a seated member of.
 */
export function useFriendLiveSpace(
  friendUserId: string | Accessor<string>
): Accessor<FriendLiveSpace | null> {
  const friend = (): string =>
    typeof friendUserId === 'string' ? friendUserId : friendUserId();
  const query = createQuery(() => {
    const id = friend();
    return sql<FriendLiveSpaceRow>`
      SELECT id, host_account_id, host_member_id
      FROM spaces
      WHERE ended_at IS NULL
        AND (
          host_account_id = ${id}
          OR host_member_id = ${id}
          OR id IN (
            SELECT space_id
            FROM spaces_users
            WHERE user_id = ${id} AND deleted_at IS NULL AND joined = ${true}
          )
        )
      ORDER BY created_at DESC
      LIMIT 1
    `;
  });
  const row = createMemo(() => query.rows()[0] ?? null);
  // Keyed on the space and the role, so a refreshed row never re-renders it.
  const spaceId = createMemo(() => row()?.id ?? null);
  const hosting = createMemo(() => {
    const current = row();
    if (current === null) return false;
    return (
      current.host_account_id === friend() ||
      current.host_member_id === friend()
    );
  });
  return createMemo((): FriendLiveSpace | null => {
    const id = spaceId();
    return id === null ? null : { spaceId: id, hosting: hosting() };
  });
}

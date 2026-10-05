import sql from '@pkgs/sql-root-shared/sql';

import { createQuery } from '@pkgs/sync-engine-client/sync-engine-context';
import { type Accessor, createMemo } from 'solid-js';

/**
 * Returns a live space id when this friend is already visible to the client:
 * the space they host, or one they are a seated member of.
 */
export function useFriendLiveSpaceId(
  friendUserId: string | Accessor<string>
): Accessor<string | null> {
  const query = createQuery(() => {
    const friend =
      typeof friendUserId === 'string' ? friendUserId : friendUserId();
    return sql<{ readonly id: string }>`
      SELECT id
      FROM spaces
      WHERE ended_at IS NULL
        AND (
          host_account_id = ${friend}
          OR host_member_id = ${friend}
          OR id IN (
            SELECT space_id
            FROM spaces_users
            WHERE user_id = ${friend} AND deleted_at IS NULL
          )
        )
      ORDER BY created_at DESC
      LIMIT 1
    `;
  });
  const row = createMemo(() => query.rows()[0] ?? null);
  return createMemo(() => row()?.id ?? null);
}

import { sql } from '@pkgs/sql';

import { createQuery } from '@pkgs/sync-engine/solid';
import { type Accessor, createMemo } from 'solid-js';

/**
 * Returns the live space id hosted by `hostAccountId` when that space is
 * already synced to this client (friend-hosted live spaces).
 */
export function useFriendLiveSpaceId(
  hostAccountId: string | Accessor<string>
): Accessor<string | null> {
  const query = createQuery(() => {
    const host =
      typeof hostAccountId === 'string' ? hostAccountId : hostAccountId();
    return sql<{ readonly id: string }>`
      SELECT id
      FROM spaces
      WHERE ended_at IS NULL
        AND (
          host_account_id = ${host}
          OR host_member_id = ${host}
        )
      ORDER BY created_at DESC
      LIMIT 1
    `;
  });
  const row = createMemo(() => query.rows()[0] ?? null);
  return createMemo(() => row()?.id ?? null);
}

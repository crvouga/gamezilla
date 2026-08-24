import { sql } from '@pkgs/sql';

import { useQuery } from '@pkgs/sync-engine/client';

/**
 * Returns the live space id hosted by `hostAccountId` when that space is
 * already synced to this client (friend-hosted live spaces).
 */
export function useFriendLiveSpaceId(hostAccountId: string): string | null {
  const { rows } = useQuery(sql<{ readonly id: string }>`
    SELECT id
    FROM spaces
    WHERE ended_at IS NULL
      AND (
        host_account_id = ${hostAccountId}
        OR host_member_id = ${hostAccountId}
      )
    ORDER BY created_at DESC
    LIMIT 1
  `);
  const row = rows[0] ?? null;
  return row?.id ?? null;
}

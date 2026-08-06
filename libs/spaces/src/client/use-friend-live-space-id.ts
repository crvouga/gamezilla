import { sql } from '@pkgs/sql';

import { useQueryOne } from '@pkgs/sync-engine/client/sync-engine-context';

/**
 * Returns the live space id hosted by `hostAccountId` when that space is
 * public (already synced to this client). Private spaces only appear when
 * the viewer is allowlisted or a member.
 */
export function useFriendLiveSpaceId(hostAccountId: string): string | null {
  const { row } = useQueryOne(sql<{ readonly id: string }>`
    SELECT id
    FROM spaces
    WHERE ended_at IS NULL
      AND host_account_id = ${hostAccountId}
      AND visibility = 'public'
    ORDER BY created_at DESC
    LIMIT 1
  `);
  return row?.id ?? null;
}

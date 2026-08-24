import { sql } from '@pkgs/sql';
import { useQuery } from '@pkgs/sync-engine/client';

/** True when the viewer is friends with the space host on local SQLite. */
export function useIsFriendOfHostLocal(
  hostAccountId: string | null,
  hostMemberId: string | null,
  viewerAccountId: string | null
): boolean {
  const enabled =
    viewerAccountId !== null &&
    viewerAccountId.length > 0 &&
    ((hostAccountId ?? '').length > 0 || (hostMemberId ?? '').length > 0);
  const { rows } = useQuery(sql<{ readonly id: string }>`
    SELECT id
    FROM friends_friendships
    WHERE ${enabled}
      AND deleted_at IS NULL
      AND (
        (
          user_low = ${viewerAccountId ?? ''}
          AND (
            user_high = ${hostAccountId ?? ''}
            OR user_high = ${hostMemberId ?? ''}
          )
        )
        OR (
          user_high = ${viewerAccountId ?? ''}
          AND (
            user_low = ${hostAccountId ?? ''}
            OR user_low = ${hostMemberId ?? ''}
          )
        )
      )
    LIMIT 1
  `);
  return enabled && rows.length > 0;
}

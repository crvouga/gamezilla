import { sql } from '@pkgs/sql';
import type { SqlTx } from '@pkgs/sql-client/interface';

/** Whether viewer and host account/member ids are friends. */
export async function areFriends(
  tx: Pick<SqlTx, 'query'>,
  args: {
    readonly viewerMemberId: string;
    readonly hostAccountId: string | null;
    readonly hostMemberId: string | null;
  }
): Promise<boolean> {
  const hostAccountId = args.hostAccountId ?? '';
  const hostMemberId = args.hostMemberId ?? '';
  if (args.viewerMemberId.length === 0) {
    return false;
  }
  const rows = await tx.query(sql<{ readonly id: string }>`
    SELECT id
    FROM friends_friendships
    WHERE deleted_at IS NULL
      AND (
        (
          user_low = ${args.viewerMemberId}
          AND (
            user_high = ${hostAccountId}
            OR user_high = ${hostMemberId}
          )
        )
        OR (
          user_high = ${args.viewerMemberId}
          AND (
            user_low = ${hostAccountId}
            OR user_low = ${hostMemberId}
          )
        )
      )
    LIMIT 1
  `);
  return rows.length > 0;
}

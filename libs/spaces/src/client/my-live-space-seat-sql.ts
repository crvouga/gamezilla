import type { Sql } from '@pkgs/sql';
import { sql } from '@pkgs/sql';

/**
 * Shared lobby live ids: host of the space OR has a space_users ACL row.
 */
export function sharedLiveSpaceIdsSql(args: {
  readonly memberId: string;
}): Sql {
  return sql`
    SELECT id
    FROM spaces
    WHERE ended_at IS NULL
      AND (
        host_member_id = ${args.memberId}
        OR host_account_id = ${args.memberId}
        OR id IN (
          SELECT space_id
          FROM space_users
          WHERE user_id = ${args.memberId}
        )
      )
    ORDER BY created_at DESC
  `;
}

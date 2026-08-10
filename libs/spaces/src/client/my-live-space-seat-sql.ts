import type { Sql } from '@pkgs/sql';
import { sql } from '@pkgs/sql';

export type LiveSpaceIdRow = {
  readonly id: string;
};

/**
 * Shared lobby live ids: host of the space OR has a spaces_users ACL row.
 */
export function sharedLiveSpaceIdsSql(args: {
  readonly memberId: string;
}): Sql<LiveSpaceIdRow> {
  return sql<LiveSpaceIdRow>`
    SELECT id
    FROM spaces
    WHERE ended_at IS NULL
      AND (
        host_member_id = ${args.memberId}
        OR host_account_id = ${args.memberId}
        OR id IN (
          SELECT space_id
          FROM spaces_users
          WHERE user_id = ${args.memberId} AND deleted_at IS NULL
        )
      )
    ORDER BY created_at DESC
  `;
}

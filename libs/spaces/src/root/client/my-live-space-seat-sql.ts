import type { Sql } from '@pkgs/sql';
import { sql } from '@pkgs/sql';

import { friendIdsForMemberSql } from '../../shared/space/actor-visible-spaces-sql';

export type LiveSpaceIdRow = {
  readonly id: string;
};

/**
 * Shared lobby live ids: host of the space, spaces_users ACL, or a friend's live space.
 */
export function sharedLiveSpaceIdsSql(args: {
  readonly memberId: string;
}): Sql<LiveSpaceIdRow> {
  const friendIds = friendIdsForMemberSql(args.memberId);
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
        OR host_account_id IN (SELECT friend_id FROM (${friendIds}))
        OR host_member_id IN (SELECT friend_id FROM (${friendIds}))
      )
    ORDER BY created_at DESC
  `;
}

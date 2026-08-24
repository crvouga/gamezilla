import type { Sql } from '@pkgs/sql';
import { sql } from '@pkgs/sql';

export type LiveSpaceIdRow = {
  readonly id: string;
};

function friendIdsForMemberSql(memberId: string): Sql<{ readonly friend_id: string }> {
  return sql<{ readonly friend_id: string }>`
    SELECT CASE
      WHEN f.user_low = ${memberId} THEN f.user_high
      ELSE f.user_low
    END AS friend_id
    FROM friends_friendships AS f
    WHERE f.deleted_at IS NULL
      AND (f.user_low = ${memberId} OR f.user_high = ${memberId})
  `;
}

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

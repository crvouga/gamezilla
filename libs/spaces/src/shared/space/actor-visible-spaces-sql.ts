import type { Sql } from '@pkgs/sql';
import { sql } from '@pkgs/sql';

/** Live (non-tombstoned) friend peer ids — for UI / local SQL only. */
export function friendIdsForMemberSql(
  memberId: string
): Sql<{ readonly friend_id: string }> {
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
 * Peer ids including friendship tombstones — for defineQuery.run hydrate
 * (must not filter deleted_at; tombstones must sync).
 */
export function friendIdsForMemberIncludingTombstonesSql(
  memberId: string
): Sql<{ readonly friend_id: string }> {
  return sql<{ readonly friend_id: string }>`
    SELECT CASE
      WHEN f.user_low = ${memberId} THEN f.user_high
      ELSE f.user_low
    END AS friend_id
    FROM friends_friendships AS f
    WHERE f.user_low = ${memberId} OR f.user_high = ${memberId}
  `;
}

/**
 * Spaces an actor may see via mySpaces hydrate: host, spaces_users membership,
 * or a friend's space (including ended / friendship tombstones so soft-deletes
 * still sync). Must not mention deleted_at — enforced by defineQuery.run.
 */
export function actorVisibleSpacesPredicateSql(
  actorId: string
): Sql<Record<string, unknown>> {
  const friendIds = friendIdsForMemberIncludingTombstonesSql(actorId);
  return sql<Record<string, unknown>>`
    host_member_id = ${actorId}
    OR host_account_id = ${actorId}
    OR id IN (
      SELECT space_id FROM spaces_users
      WHERE user_id = ${actorId}
    )
    OR host_account_id IN (SELECT friend_id FROM (${friendIds}))
    OR host_member_id IN (SELECT friend_id FROM (${friendIds}))
  `;
}

/**
 * Live spaces for pubsub ACL (not defineQuery.run — may filter deleted_at /
 * ended_at). Host, spaces_users membership, or a live friend's live space.
 */
export function actorVisibleLiveSpacesPredicateSql(
  actorId: string
): Sql<Record<string, unknown>> {
  const friendIds = friendIdsForMemberSql(actorId);
  return sql<Record<string, unknown>>`
    ended_at IS NULL
    AND (
      host_member_id = ${actorId}
      OR host_account_id = ${actorId}
      OR id IN (
        SELECT space_id FROM spaces_users
        WHERE user_id = ${actorId} AND deleted_at IS NULL
      )
      OR host_account_id IN (SELECT friend_id FROM (${friendIds}))
      OR host_member_id IN (SELECT friend_id FROM (${friendIds}))
    )
  `;
}

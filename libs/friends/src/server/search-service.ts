import { ProfileCol, PROFILES_TABLE } from '@libs/db/shared/profile-tables';
import { USER_BLOCKS_TABLE, UserBlockCol } from '@libs/db/shared/friends-tables';
import type { SqlClient } from '@pkgs/sql-client/interface';

import {
  FRIEND_SEARCH_MAX_RESULTS,
  FRIEND_SEARCH_MIN_LENGTH,
  FRIEND_SEARCH_RATE_LIMIT,
  FRIEND_SEARCH_RATE_WINDOW_MS,
  type UserSearchResult,
} from '../shared/friends-types';
import { FriendsError } from '../shared/friends-errors';

type SearchHitRow = {
  readonly id: string;
  readonly username: string;
  readonly display_name: string;
  readonly avatar_config: unknown;
};

const searchTimestamps = new Map<string, number[]>();

function assertSearchRateLimit(userId: string): void {
  const now = Date.now();
  const windowStart = now - FRIEND_SEARCH_RATE_WINDOW_MS;
  const prior = searchTimestamps.get(userId) ?? [];
  const recent = prior.filter((ts) => ts >= windowStart);
  if (recent.length >= FRIEND_SEARCH_RATE_LIMIT) {
    throw new FriendsError('FRIENDS_SEARCH_RATE_LIMIT', 'Too many searches');
  }
  recent.push(now);
  searchTimestamps.set(userId, recent);
}

function mapSearchHit(row: SearchHitRow): UserSearchResult {
  const avatarRaw = row.avatar_config;
  return {
    userId: row.id,
    username: row.username,
    displayName: row.display_name,
    avatarConfig:
      typeof avatarRaw === 'string'
        ? avatarRaw
        : avatarRaw === null || avatarRaw === undefined
          ? null
          : JSON.stringify(avatarRaw),
  };
}

export async function searchUsers(
  sql: SqlClient,
  viewerId: string,
  rawQuery: string,
  limit: number = FRIEND_SEARCH_MAX_RESULTS
): Promise<readonly UserSearchResult[]> {
  const query = rawQuery.trim();
  if (query.length < FRIEND_SEARCH_MIN_LENGTH) {
    throw new FriendsError(
      'FRIENDS_SEARCH_QUERY_TOO_SHORT',
      `Search query must be at least ${FRIEND_SEARCH_MIN_LENGTH} characters`
    );
  }
  assertSearchRateLimit(viewerId);
  const boundedLimit = Math.min(Math.max(limit, 1), FRIEND_SEARCH_MAX_RESULTS);
  const likeQuery = query.toLowerCase();
  const rows = await sql.query<SearchHitRow>(
    `SELECT p.${ProfileCol.id} AS id,
            p.${ProfileCol.username} AS username,
            p.${ProfileCol.displayName} AS display_name,
            p.${ProfileCol.avatarConfig} AS avatar_config
     FROM ${PROFILES_TABLE.tableName} p
     WHERE p.${ProfileCol.id} <> ?
       AND NOT EXISTS (
         SELECT 1 FROM ${USER_BLOCKS_TABLE.tableName} b
         WHERE (b.${UserBlockCol.blockerId} = ? AND b.${UserBlockCol.blockedId} = p.${ProfileCol.id})
            OR (b.${UserBlockCol.blockerId} = p.${ProfileCol.id} AND b.${UserBlockCol.blockedId} = ?)
       )
       AND (
         (p.${ProfileCol.username} <> '' AND lower(p.${ProfileCol.username}) LIKE ? || '%')
         OR lower(p.${ProfileCol.displayName}) LIKE '%' || ? || '%'
       )
     ORDER BY
       CASE WHEN lower(p.${ProfileCol.username}) LIKE ? || '%' THEN 0 ELSE 1 END,
       lower(p.${ProfileCol.username}),
       lower(p.${ProfileCol.displayName})
     LIMIT ?`,
    [viewerId, viewerId, viewerId, likeQuery, likeQuery, likeQuery, boundedLimit]
  );
  return rows.map(mapSearchHit);
}

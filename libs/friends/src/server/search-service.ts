import { ProfileCol, PROFILES_TABLE } from '@libs/db/shared/profile-tables';
import {
  USER_BLOCKS_TABLE,
  UserBlockCol,
} from '@libs/db/shared/friends-tables';
import { raw, sql } from '@pkgs/sql';
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
    avatarConfig:
      typeof avatarRaw === 'string'
        ? avatarRaw
        : avatarRaw === null || avatarRaw === undefined
          ? null
          : JSON.stringify(avatarRaw),
  };
}

export async function searchUsers(
  db: SqlClient,
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
  const rows = await db.query<SearchHitRow>(sql`
    SELECT p.${raw(ProfileCol.id)} AS id,
           p.${raw(ProfileCol.username)} AS username,
           p.${raw(ProfileCol.avatarConfig)} AS avatar_config
    FROM ${raw(PROFILES_TABLE.tableName)} p
    WHERE p.${raw(ProfileCol.id)} <> ${viewerId}
      AND NOT EXISTS (
        SELECT 1 FROM ${raw(USER_BLOCKS_TABLE.tableName)} b
        WHERE (b.${raw(UserBlockCol.blockerId)} = ${viewerId} AND b.${raw(UserBlockCol.blockedId)} = p.${raw(ProfileCol.id)})
           OR (b.${raw(UserBlockCol.blockerId)} = p.${raw(ProfileCol.id)} AND b.${raw(UserBlockCol.blockedId)} = ${viewerId})
      )
      AND p.${raw(ProfileCol.username)} <> ''
      AND lower(p.${raw(ProfileCol.username)}) LIKE ${likeQuery} || '%'
    ORDER BY lower(p.${raw(ProfileCol.username)})
    LIMIT ${boundedLimit}
  `);
  return rows.map(mapSearchHit);
}

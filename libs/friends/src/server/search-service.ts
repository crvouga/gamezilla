import { ProfileCol, PROFILES_TABLE } from '@libs/db/shared/profile-tables';
import {
  USER_BLOCKS_TABLE,
  UserBlockCol,
} from '@libs/db/shared/friends-tables';
import { sql, ident } from '@pkgs/sql';
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
    SELECT p.${ident(ProfileCol.id)} AS id,
           p.${ident(ProfileCol.username)} AS username,
           p.${ident(ProfileCol.avatarConfig)} AS avatar_config
    FROM ${ident(PROFILES_TABLE.tableName)} p
    WHERE p.${ident(ProfileCol.id)} <> ${viewerId}
      AND NOT EXISTS (
        SELECT 1 FROM ${ident(USER_BLOCKS_TABLE.tableName)} b
        WHERE (b.${ident(UserBlockCol.blockerId)} = ${viewerId} AND b.${ident(UserBlockCol.blockedId)} = p.${ident(ProfileCol.id)})
           OR (b.${ident(UserBlockCol.blockerId)} = p.${ident(ProfileCol.id)} AND b.${ident(UserBlockCol.blockedId)} = ${viewerId})
      )
      AND p.${ident(ProfileCol.username)} <> ''
      AND lower(p.${ident(ProfileCol.username)}) LIKE ${likeQuery} || '%'
    ORDER BY lower(p.${ident(ProfileCol.username)})
    LIMIT ${boundedLimit}
  `);
  return rows.map(mapSearchHit);
}

import { sql } from '@pkgs/sql';

import type { SqlClient } from '@pkgs/sql-client/interface';

import {
  USER_SEARCH_MAX_RESULTS,
  USER_SEARCH_MIN_LENGTH,
  USER_SEARCH_RATE_LIMIT,
  USER_SEARCH_RATE_WINDOW_MS,
  type UserSearchResult,
} from '@libs/user-search/shared/user-search-types';
import { FriendsError } from '../shared/friends-errors';

type SearchHitRow = {
  readonly id: string;
  readonly username: string;
  readonly avatar_config: unknown;
};

const searchTimestamps = new Map<string, number[]>();

function assertSearchRateLimit(userId: string): void {
  const now = Date.now();
  const windowStart = now - USER_SEARCH_RATE_WINDOW_MS;
  const prior = searchTimestamps.get(userId) ?? [];
  const recent = prior.filter((ts) => ts >= windowStart);
  if (recent.length >= USER_SEARCH_RATE_LIMIT) {
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
  limit: number = USER_SEARCH_MAX_RESULTS
): Promise<readonly UserSearchResult[]> {
  const query = rawQuery.trim();
  if (query.length < USER_SEARCH_MIN_LENGTH) {
    throw new FriendsError(
      'FRIENDS_SEARCH_QUERY_TOO_SHORT',
      `Search query must be at least ${USER_SEARCH_MIN_LENGTH} characters`
    );
  }
  assertSearchRateLimit(viewerId);
  const boundedLimit = Math.min(Math.max(limit, 1), USER_SEARCH_MAX_RESULTS);
  const likeQuery = `${query.toLowerCase()}%`;
  const rows = await db.query<SearchHitRow>(sql`
    SELECT p.id, p.username, p.avatar_config
    FROM profiles AS p
    WHERE p.id <> ${viewerId}
      AND NOT EXISTS (
        SELECT 1
        FROM user_blocks AS b
        WHERE (b.blocker_id = ${viewerId} AND b.blocked_id = p.id)
           OR (b.blocker_id = p.id AND b.blocked_id = ${viewerId})
      )
      AND p.username <> ''
      AND lower(p.username) LIKE ${likeQuery}
    ORDER BY lower(p.username) ASC
    LIMIT ${boundedLimit}
  `);
  return rows.map(mapSearchHit);
}

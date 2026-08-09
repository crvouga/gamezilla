import {
  USER_SEARCH_MAX_RESULTS,
  USER_SEARCH_MIN_LENGTH,
  USER_SEARCH_RATE_LIMIT,
  USER_SEARCH_RATE_WINDOW_MS,
  type UserSearchResult,
} from '@libs/user-search/shared/user-search-types';
import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { FriendsError } from '../shared/friends-errors';

type SearchHitRow = {
  readonly id: string;
  readonly username: string;
  readonly avatar_config: unknown;
};

const searchTimestamps = new Map<string, number[]>();

function assertSearchRateLimit(userId: string, now: () => number): void {
  const nowMs = now();
  const windowStart = nowMs - USER_SEARCH_RATE_WINDOW_MS;
  const prior = searchTimestamps.get(userId) ?? [];
  const recent = prior.filter((ts) => ts >= windowStart);
  if (recent.length >= USER_SEARCH_RATE_LIMIT) {
    throw new FriendsError('FRIENDS_SEARCH_RATE_LIMIT', 'Too many searches');
  }
  recent.push(nowMs);
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

export async function searchUsers(args: {
  readonly db: SqlClient;
  readonly viewerId: string;
  readonly rawQuery: string;
  readonly now: () => number;
  readonly limit?: number;
}): Promise<readonly UserSearchResult[]> {
  const { db, viewerId, rawQuery, now } = args;
  const limit = args.limit ?? USER_SEARCH_MAX_RESULTS;
  const query = rawQuery.trim();
  if (query.length < USER_SEARCH_MIN_LENGTH) {
    throw new FriendsError(
      'FRIENDS_SEARCH_QUERY_TOO_SHORT',
      `Search query must be at least ${USER_SEARCH_MIN_LENGTH} characters`
    );
  }
  assertSearchRateLimit(viewerId, now);
  const boundedLimit = Math.min(Math.max(limit, 1), USER_SEARCH_MAX_RESULTS);
  const likeQuery = `${query.toLowerCase()}%`;
  const rows = await db.query(sql<SearchHitRow>`
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

import { ProfileCol, PROFILES_TABLE } from '@libs/db/shared/profile-tables';
import {
  USER_BLOCKS_TABLE,
  UserBlockCol,
} from '@libs/db/shared/friends-tables';
import { honey, col } from '@pkgs/sql';
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
  const likeQuery = query.toLowerCase();
  const profileIdCol = col(`p.${ProfileCol.id}`);
  const rows = await db.query<SearchHitRow>(
    honey({
      select: [
        [`p.${ProfileCol.id}`, 'id'],
        [`p.${ProfileCol.username}`, 'username'],
        [`p.${ProfileCol.avatarConfig}`, 'avatar_config'],
      ],
      from: [PROFILES_TABLE.tableName, 'p'],
      where: [
        'and',
        ['<>', `p.${ProfileCol.id}`, viewerId],
        [
          'not',
          [
            'exists',
            {
              select: [['param', 1]],
              from: [USER_BLOCKS_TABLE.tableName, 'b'],
              where: [
                'or',
                [
                  'and',
                  ['=', `b.${UserBlockCol.blockerId}`, viewerId],
                  ['=', `b.${UserBlockCol.blockedId}`, profileIdCol],
                ],
                [
                  'and',
                  ['=', `b.${UserBlockCol.blockerId}`, profileIdCol],
                  ['=', `b.${UserBlockCol.blockedId}`, viewerId],
                ],
              ],
            },
          ],
        ],
        ['<>', `p.${ProfileCol.username}`, ''],
        ['like', ['lower', `p.${ProfileCol.username}`], ['||', likeQuery, '%']],
      ],
      orderBy: [[['lower', `p.${ProfileCol.username}`], 'asc']],
      limit: boundedLimit,
    })
  );
  return rows.map(mapSearchHit);
}

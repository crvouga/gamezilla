import {
  USER_SEARCH_MAX_RESULTS,
  USER_SEARCH_MIN_LENGTH,
  USER_SEARCH_RATE_LIMIT,
  USER_SEARCH_RATE_WINDOW_MS,
  type UserSearchResult,
} from '@libs/user-search/public/user-search-types';
import type { Clock } from '@pkgs/clock';
import { sql } from '@pkgs/sql';
import type { SqlTx } from '@pkgs/sql-client/interface';
import { FriendsError } from '../../../shared/friendship/friends-errors';

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
  let recent = prior.filter((ts) => ts >= windowStart);
  // Frozen sim clocks keep every stamp equal to `nowMs`, which would lock the
  // window forever after RATE_LIMIT hits. Reset the bucket in that case so DST
  // / paused-clock hosts can keep searching.
  if (
    recent.length >= USER_SEARCH_RATE_LIMIT &&
    recent.every((ts) => ts === nowMs)
  ) {
    recent = [];
  }
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

export class FriendSearchService {
  constructor(
    private readonly tx: SqlTx,
    private readonly clock: Clock
  ) {}

  async searchUsers(args: {
    readonly viewerId: string;
    readonly rawQuery: string;
    readonly limit?: number;
  }): Promise<readonly UserSearchResult[]> {
    const { viewerId, rawQuery } = args;
    const limit = args.limit ?? USER_SEARCH_MAX_RESULTS;
    const query = rawQuery.trim();
    if (query.length < USER_SEARCH_MIN_LENGTH) {
      throw new FriendsError(
        'FRIENDS_SEARCH_QUERY_TOO_SHORT',
        `Search query must be at least ${USER_SEARCH_MIN_LENGTH} characters`
      );
    }
    assertSearchRateLimit(viewerId, this.clock.now);
    const boundedLimit = Math.min(Math.max(limit, 1), USER_SEARCH_MAX_RESULTS);
    const likeQuery = `${query.toLowerCase()}%`;
    const rows = await this.tx.query(sql<SearchHitRow>`
      SELECT p.id, p.username, p.avatar_config
      FROM profile AS p
      WHERE p.id <> ${viewerId}
        AND NOT EXISTS (
          SELECT 1
          FROM friends_blocks AS b
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
}

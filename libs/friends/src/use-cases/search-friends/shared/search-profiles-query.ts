import {
  USER_SEARCH_MAX_RESULTS,
  USER_SEARCH_RATE_LIMIT,
  USER_SEARCH_RATE_WINDOW_MS,
} from '@libs/user-search/public/user-search-types';
import { sql } from '@pkgs/sql';
import { defineQuery } from '@pkgs/sync-engine/shared';
import { z } from 'zod';

const searchTimestamps = new Map<string, number[]>();

function isRateLimited(userId: string, nowMs: number): boolean {
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
    return true;
  }
  recent.push(nowMs);
  searchTimestamps.set(userId, recent);
  return false;
}

export const searchProfiles = defineQuery({
  name: 'searchProfiles',
  params: z.object({
    query: z.string().min(1).max(64),
    limit: z.number().int().min(1).max(USER_SEARCH_MAX_RESULTS).optional(),
  }),
  sampleParams: { query: 'a' },
  limit: USER_SEARCH_MAX_RESULTS,
  entryChannel: false,
  async run(ctx, { query, limit }) {
    const viewerId = ctx.env.actorId;
    if (viewerId.length === 0) {
      return { profile: [] };
    }
    if (isRateLimited(viewerId, ctx.env.now().getTime())) {
      return { profile: [] };
    }
    const boundedLimit = Math.min(
      Math.max(limit ?? USER_SEARCH_MAX_RESULTS, 1),
      USER_SEARCH_MAX_RESULTS
    );
    const likeQuery = `${query.trim().toLowerCase()}%`;
    const rows = await ctx.db.query(sql`
      SELECT
        p.id,
        p.created_at,
        p.username,
        p.avatar_config,
        p.username_changed_at,
        p.deleted_at
      FROM profile AS p
      WHERE p.id <> ${viewerId}
        AND NOT EXISTS (
          SELECT 1
          FROM friends_blocks AS b
          WHERE b.deleted_at IS NULL
            AND (
              (b.blocker_id = ${viewerId} AND b.blocked_id = p.id)
              OR (b.blocker_id = p.id AND b.blocked_id = ${viewerId})
            )
        )
        AND p.username <> ''
        AND lower(p.username) LIKE ${likeQuery}
      ORDER BY lower(p.username) ASC
      LIMIT ${boundedLimit}
    `);
    return { profile: rows };
  },
});

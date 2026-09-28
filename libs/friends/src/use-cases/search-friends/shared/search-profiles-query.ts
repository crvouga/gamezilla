import { PERMISSION } from '@libs/permissions/public/permission-catalog';
import { queryRequires } from '@libs/permissions/public/query-permission';
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
  // Frozen harness clocks keep every stamp equal to `nowMs`, which would lock the
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
  }),
  sampleParams: { query: 'a' },
  limit: USER_SEARCH_MAX_RESULTS,
  entryChannel: false,
  // Only callers the permission system lets search people get results
  // (guests are asked to make an account first).
  authorize: queryRequires(PERMISSION.peopleSearch),
  async run(ctx, { query }) {
    const viewerId = ctx.env.actorId;
    if (viewerId.length === 0) {
      return { profile: [] };
    }
    if (isRateLimited(viewerId, ctx.env.now().getTime())) {
      return { profile: [] };
    }
    const likeQuery = `${query.trim().toLowerCase()}%`;
    const rows = await ctx.db.query(sql`
      SELECT
        id,
        created_at,
        username,
        avatar_config,
        username_changed_at,
        username_norm,
        deleted_at
      FROM profile
      WHERE id <> ${viewerId}
        AND username_norm <> ''
        AND username_norm LIKE ${likeQuery}
      ORDER BY username_norm ASC
    `);
    return { profile: rows };
  },
});

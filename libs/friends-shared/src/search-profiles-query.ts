import { PERMISSION } from '@libs/permissions-shared/permission-catalog';
import { queryRequires } from '@libs/permissions-shared/query-permission';
import {
  USER_SEARCH_MAX_RESULTS,
  USER_SEARCH_RATE_LIMIT,
  USER_SEARCH_RATE_WINDOW_MS,
} from '@libs/user-search-shared/user-search-types';
import sql from '@pkgs/sql-root-shared/sql';
import { defineQuery } from '@pkgs/sync-engine-shared/define-query';
import { z } from 'zod';

type SearchStamp = { readonly at: number; readonly query: string };

/**
 * Stamps per clock function, then per viewer. Each sync app passes one stable
 * `env.now`, so two harnesses in one process do not share a budget. A module
 * map keyed only by account id did: quint traces mint the same ids.
 * Repeating a name already counted in the window is free: the screen refetches
 * that name, and an empty answer there would say the person does not exist.
 */
const rateBuckets = new WeakMap<() => Date, Map<string, SearchStamp[]>>();

function isRateLimited(
  userId: string,
  query: string,
  now: () => Date
): boolean {
  const nowMs = now().getTime();
  const windowStart = nowMs - USER_SEARCH_RATE_WINDOW_MS;
  const key = query.trim().toLowerCase();
  let byUser = rateBuckets.get(now);
  if (byUser === undefined) {
    byUser = new Map();
    rateBuckets.set(now, byUser);
  }
  const prior = byUser.get(userId) ?? [];
  let recent = prior.filter((stamp) => stamp.at >= windowStart);
  // A frozen clock keeps every stamp equal to `nowMs`, which would lock the
  // window forever after RATE_LIMIT hits. Reset that bucket so a paused host
  // can keep searching.
  if (
    recent.length >= USER_SEARCH_RATE_LIMIT &&
    recent.every((stamp) => stamp.at === nowMs)
  ) {
    recent = [];
  }
  if (recent.some((stamp) => stamp.query === key)) {
    byUser.set(userId, recent);
    return false;
  }
  if (recent.length >= USER_SEARCH_RATE_LIMIT) {
    byUser.set(userId, recent);
    return true;
  }
  recent.push({ at: nowMs, query: key });
  byUser.set(userId, recent);
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
    if (isRateLimited(viewerId, query, ctx.env.now)) {
      return { profile: [] };
    }
    const likeQuery = `${query.trim().toLowerCase()}%`;
    // Active blocks govern discovery; profile tombstones still reach allowed viewers.
    const rows = await ctx.db.query(sql`
      SELECT
        p.id, p.created_at, p.username, p.avatar_config,
        p.username_changed_at, p.username_norm, p.deleted_at
      FROM profile AS p
      LEFT JOIN friends_blocks AS block
        ON block.blocker_id = p.id
          AND block.blocked_id = ${viewerId}
          AND block.deleted_at IS NULL
      WHERE p.id <> ${viewerId}
        AND p.username_norm <> ''
        AND p.username_norm LIKE ${likeQuery}
        AND block.id IS NULL
      ORDER BY p.username_norm ASC
    `);
    return { profile: rows };
  },
});

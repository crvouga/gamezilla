import { sql } from '@pkgs/sql';
import { defineQuery } from '@pkgs/sync-engine/shared';

export const friendships = defineQuery({
  name: 'friendships',
  async run(ctx) {
    const actor = ctx.env.actorId;
    const rows = await ctx.db.query(sql`
      SELECT id, user_low, user_high, created_at, source_request_id, deleted_at
      FROM friendships
      WHERE user_low = ${actor} OR user_high = ${actor}
`);
    return { friendships: rows };
  },
});

export const friendRequests = defineQuery({
  name: 'friendRequests',
  limit: 500,
  async run(ctx) {
    const actor = ctx.env.actorId;
    const rows = await ctx.db.query(sql`
      SELECT
        id, from_user_id, to_user_id, status, message,
        created_at, updated_at, responded_at, deleted_at
      FROM friend_requests
      WHERE from_user_id = ${actor} OR to_user_id = ${actor}
`);
    return { friend_requests: rows };
  },
});

export const userBlocks = defineQuery({
  name: 'userBlocks',
  limit: 500,
  async run(ctx) {
    const rows = await ctx.db.query(sql`
      SELECT id, blocker_id, blocked_id, created_at, deleted_at
      FROM user_blocks
      WHERE blocker_id = ${ctx.env.actorId}
`);
    return { user_blocks: rows };
  },
});

export const FRIENDS_QUERIES = [
  friendships,
  friendRequests,
  userBlocks,
] as const;

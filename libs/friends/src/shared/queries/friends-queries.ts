import { defineQuery } from '@pkgs/sync-engine/queries/core/define-query';
import { userChannels } from '@libs/db/shared/sync-topics';
import { sql } from '@pkgs/sql';
import { z } from 'zod';

export const friendships = defineQuery({
  name: 'friendships',
  params: z.object({}),
  hydrates: ['friendships'],
  limit: 2000,
  channels: (_params, ctx) => userChannels(ctx),
  async authorize(ctx) {
    return ctx.env.actorId.length > 0;
  },
  async run(ctx) {
    const actor = ctx.env.actorId;
    const rows = await ctx.db.query(sql`
      SELECT id, user_low, user_high, created_at, source_request_id
      FROM friendships
      WHERE user_low = ${actor} OR user_high = ${actor}
      LIMIT 2000
    `);
    return { friendships: rows };
  },
});

export const friendRequests = defineQuery({
  name: 'friendRequests',
  params: z.object({}),
  hydrates: ['friend_requests'],
  limit: 500,
  channels: (_params, ctx) => userChannels(ctx),
  async authorize(ctx) {
    return ctx.env.actorId.length > 0;
  },
  async run(ctx) {
    const actor = ctx.env.actorId;
    const rows = await ctx.db.query(sql`
      SELECT
        id, from_user_id, to_user_id, status, message,
        created_at, updated_at, responded_at
      FROM friend_requests
      WHERE from_user_id = ${actor} OR to_user_id = ${actor}
      LIMIT 500
    `);
    return { friend_requests: rows };
  },
});

export const userBlocks = defineQuery({
  name: 'userBlocks',
  params: z.object({}),
  hydrates: ['user_blocks'],
  limit: 500,
  channels: (_params, ctx) => userChannels(ctx),
  async authorize(ctx) {
    return ctx.env.actorId.length > 0;
  },
  async run(ctx) {
    const rows = await ctx.db.query(sql`
      SELECT id, blocker_id, blocked_id, created_at
      FROM user_blocks
      WHERE blocker_id = ${ctx.env.actorId}
      LIMIT 500
    `);
    return { user_blocks: rows };
  },
});

export const FRIENDS_QUERIES = [
  friendships,
  friendRequests,
  userBlocks,
] as const;

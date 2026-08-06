import { defineQuery } from '@pkgs/sync-engine/queries/core/define-query';
import { userChannels } from '@libs/db/shared/sync-topics';
import { join, sql } from '@pkgs/sql';
import { z } from 'zod';

export const ownProfile = defineQuery({
  name: 'ownProfile',
  params: z.object({}),
  hydrates: ['profiles'],
  limit: 1,
  channels: (_params, ctx) => userChannels(ctx),
  async authorize(ctx) {
    return ctx.env.actorId.length > 0;
  },
  async run(ctx) {
    const rows = await ctx.db.query(sql`
      SELECT id, created_at, username, avatar_config, username_changed_at
      FROM profiles
      WHERE id = ${ctx.env.actorId}
      LIMIT 1
    `);
    return { profiles: rows };
  },
});

export const profilesByIds = defineQuery({
  name: 'profilesByIds',
  params: z.object({
    ids: z.array(z.string().min(1)).max(200),
  }),
  hydrates: ['profiles'],
  limit: 200,
  async authorize(ctx, params) {
    return ctx.env.actorId.length > 0 && params.ids.length > 0;
  },
  async run(ctx, { ids }) {
    const rows = await ctx.db.query(sql`
      SELECT id, created_at, username, avatar_config, username_changed_at
      FROM profiles
      WHERE id IN (${join(ids)})
      LIMIT 200
    `);
    return { profiles: rows };
  },
});

export const PROFILE_QUERIES = [ownProfile, profilesByIds] as const;

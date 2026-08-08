import { join, sql } from '@pkgs/sql';
import { defineQuery } from '@pkgs/sync-engine/shared';
import { z } from 'zod';

export const ownProfile = defineQuery({
  name: 'ownProfile',
  async run(ctx) {
    const rows = await ctx.db.query(sql`
      SELECT id, created_at, username, avatar_config, username_changed_at, _deleted_at
      FROM profiles
      WHERE id = ${ctx.env.actorId}
`);
    return { profiles: rows };
  },
});

export const profilesByIds = defineQuery({
  name: 'profilesByIds',
  params: z.object({
    ids: z.array(z.string().min(1)).min(1).max(200),
  }),
  limit: 200,
  async run(ctx, { ids }) {
    const rows = await ctx.db.query(sql`
      SELECT id, created_at, username, avatar_config, username_changed_at, _deleted_at
      FROM profiles
      WHERE id IN (${join(ids)})
`);
    return { profiles: rows };
  },
});

export const PROFILE_QUERIES = [ownProfile, profilesByIds] as const;

import { join, sql } from '@pkgs/sql';
import { defineQuery } from '@pkgs/sync-engine/shared';
import { z } from 'zod';

export const profilesByIds = defineQuery({
  name: 'profilesByIds',
  params: z.object({
    ids: z.array(z.string().min(1)).min(1).max(200),
  }),
  sampleParams: { ids: ['id_x'] },
  limit: 200,
  async run(ctx, { ids }) {
    const rows = await ctx.db.query(sql`
      SELECT id, created_at, username, avatar_config, username_changed_at, deleted_at
      FROM profile
      WHERE id IN (${join(ids)})
`);
    return { profile: rows };
  },
});

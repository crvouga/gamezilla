import sql, { join } from '@pkgs/sql-root-shared/sql';
import { defineQuery } from '@pkgs/sync-engine-shared/define-query';
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
      SELECT id, created_at, updated_at,
        CASE WHEN deleted_at IS NULL THEN username ELSE '' END AS username,
        CASE WHEN deleted_at IS NULL THEN username_norm ELSE '' END AS username_norm,
        CASE WHEN deleted_at IS NULL THEN avatar_config ELSE NULL END AS avatar_config,
        username_changed_at, deleted_at
      FROM profile
      WHERE id IN (${join(ids)})
`);
    return { profile: rows };
  },
});

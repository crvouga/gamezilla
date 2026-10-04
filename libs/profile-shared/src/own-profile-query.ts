import sql from '@pkgs/sql-shared/sql';
import { defineQuery } from '@pkgs/sync-engine-shared/define-query';

export const ownProfile = defineQuery({
  name: 'ownProfile',
  async run(ctx) {
    const rows = await ctx.db.query(sql`
      SELECT id, created_at, username, username_norm, avatar_config, username_changed_at, deleted_at
      FROM profile
      WHERE id = ${ctx.env.actorId}
`);
    return { profile: rows };
  },
});

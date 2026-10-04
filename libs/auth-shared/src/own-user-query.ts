import sql from '@pkgs/sql-root-shared/sql';
import { defineQuery } from '@pkgs/sync-engine-shared/define-query';

export const ownUser = defineQuery({
  name: 'ownUser',
  async run(ctx) {
    const rows = await ctx.db.query(
      sql`SELECT id, created_at, is_anon, deleted_at FROM auth_users WHERE id = ${ctx.env.actorId}`
    );
    return { auth_users: rows };
  },
});

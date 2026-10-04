import sql from '@pkgs/sql-root-shared/sql';
import { defineQuery } from '@pkgs/sync-engine-shared/define-query';

import { actorVisibleSpacesPredicateSql } from './actor-visible-spaces-sql';

export const mySpaces = defineQuery({
  name: 'mySpaces',
  limit: 200,
  async run(ctx) {
    const actor = ctx.env.actorId;
    const visible = actorVisibleSpacesPredicateSql(actor);
    const rows = await ctx.db.query(sql`
      SELECT
        id, title, host_id, created_at, ended_at, visibility,
        host_account_id, host_member_id, deleted_at
      FROM spaces
      WHERE ${visible}
      ORDER BY CASE WHEN ended_at IS NULL THEN 0 ELSE 1 END, id`);
    return { spaces: rows };
  },
});

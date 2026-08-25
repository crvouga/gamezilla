import { sql } from '@pkgs/sql';
import { defineQuery } from '@pkgs/sync-engine/shared';

import { actorVisibleSpacesPredicateSql } from '../../../shared/space/actor-visible-spaces-sql';

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
`);
    return { spaces: rows };
  },
});

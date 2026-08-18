import { sql } from '@pkgs/sql';
import { defineQuery } from '@pkgs/sync-engine/shared';

export const mySpaces = defineQuery({
  name: 'mySpaces',
  limit: 200,
  async run(ctx) {
    const actor = ctx.env.actorId;
    const rows = await ctx.db.query(sql`
      SELECT
        id, title, host_id, created_at, ended_at, visibility,
        host_account_id, host_member_id, deleted_at
      FROM spaces
      WHERE host_member_id = ${actor}
         OR host_account_id = ${actor}
         OR id IN (
           SELECT space_id FROM spaces_users
           WHERE user_id = ${actor}
         )
`);
    return { spaces: rows };
  },
});

import sql from '@pkgs/sql-shared/sql';
import { defineQuery } from '@pkgs/sync-engine-shared/define-query';

export const mySpaceUsers = defineQuery({
  name: 'mySpaceUsers',
  async run(ctx) {
    const actor = ctx.env.actorId;
    // Nested subqueries (not WITH) keep the plan simple for every SQLite driver.
    const rows = await ctx.db.query(sql`
      SELECT
        id,
        space_id,
        user_id,
        created_at,
        created_by_account_id,
        deleted_at
      FROM spaces_users
      WHERE user_id = ${actor}
         OR space_id IN (
           SELECT id
           FROM spaces
           WHERE host_member_id = ${actor}
              OR host_account_id = ${actor}
              OR id IN (
                SELECT space_id
                FROM spaces_users
                WHERE user_id = ${actor}
              )
         )
`);
    return { spaces_users: rows };
  },
});

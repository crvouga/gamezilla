import sql from '@pkgs/sql-root-shared-ts/sql';
import { defineQuery } from '@pkgs/sync-engine-shared-ts/define-query';

export const mySpaceUsers = defineQuery({
  name: 'mySpaceUsers',
  async run(ctx) {
    const actor = ctx.env.actorId;
    // The spaces the actor hosts or sits in, read once as a derived table
    // and joined to their seats. A nested `IN (…)` filter was evaluated
    // again for every membership row, so this read grew with the square (or,
    // nested twice, the cube) of every membership ever made.
    const rows = await ctx.db.query(sql`
      SELECT
        su.id,
        su.space_id,
        su.user_id,
        su.created_at,
        su.created_by_account_id,
        su.joined,
        su.participation_revision,
        su.deleted_at
      FROM (
        SELECT id AS space_id FROM spaces WHERE host_member_id = ${actor}
        UNION
        SELECT id AS space_id FROM spaces WHERE host_account_id = ${actor}
        UNION
        SELECT space_id FROM spaces_users WHERE user_id = ${actor}
      ) AS mine
      JOIN spaces_users AS su ON su.space_id = mine.space_id
`);
    return { spaces_users: rows };
  },
});

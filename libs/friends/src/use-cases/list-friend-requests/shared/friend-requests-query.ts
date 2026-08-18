import { sql } from '@pkgs/sql';
import { defineQuery } from '@pkgs/sync-engine/shared';

export const friendRequests = defineQuery({
  name: 'friendRequests',
  limit: 500,
  async run(ctx) {
    const actor = ctx.env.actorId;
    const rows = await ctx.db.query(sql`
      SELECT
        id, from_user_id, to_user_id, status, message,
        created_at, updated_at, responded_at, deleted_at
      FROM friends_requests
      WHERE from_user_id = ${actor} OR to_user_id = ${actor}
`);
    return { friends_requests: rows };
  },
});

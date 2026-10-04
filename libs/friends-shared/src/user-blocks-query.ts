import sql from '@pkgs/sql-shared/sql';
import { defineQuery } from '@pkgs/sync-engine-shared/define-query';

export const userBlocks = defineQuery({
  name: 'userBlocks',
  limit: 500,
  async run(ctx) {
    const rows = await ctx.db.query(sql`
      SELECT id, blocker_id, blocked_id, created_at, deleted_at
      FROM friends_blocks
      WHERE blocker_id = ${ctx.env.actorId}
        OR blocked_id = ${ctx.env.actorId}
`);
    return { friends_blocks: rows };
  },
});

import sql from '@pkgs/sql-root-shared-ts/sql';
import { defineQuery } from '@pkgs/sync-engine-shared-ts/define-query';

/** Includes tombstones; another person's feedback never enters this scope. */
export const myCancellationFeedback = defineQuery({
  name: 'myCancellationFeedback',
  limit: 100,
  async run(ctx) {
    const rows = await ctx.db.query(sql`
      SELECT * FROM billing_cancellation_feedback WHERE account_id = ${ctx.env.actorId}
    `);
    return { billing_cancellation_feedback: rows };
  },
});

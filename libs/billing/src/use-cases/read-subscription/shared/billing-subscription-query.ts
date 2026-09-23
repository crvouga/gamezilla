import { sql } from '@pkgs/sql';
import { defineQuery } from '@pkgs/sync-engine/shared';

export const billingSubscription = defineQuery({
  name: 'billingSubscription',
  async run(ctx) {
    const rows = await ctx.db.query(sql`
      SELECT
        id, account_id, status, price_key, customer_id, subscription_id,
        trial_end, current_period_end, grace_until, cancel_at_period_end,
        action_required, deleted_at
      FROM billing_subscriptions
      WHERE account_id = ${ctx.env.actorId}
    `);
    return { billing_subscriptions: rows };
  },
});

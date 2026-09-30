import { sql } from '@pkgs/sql';
import { defineQuery } from '@pkgs/sync-engine/shared';

/** The actor's subscription rows (tombstones included so deletes sync). */
export const mySubscription = defineQuery({
  name: 'mySubscription',
  limit: 10,
  async run(ctx) {
    const account = ctx.env.actorId;
    const rows = await ctx.db.query(sql`
      SELECT
        id, account_id, provider, provider_subscription_id, price_key,
        status, current_period_end, cancel_at_period_end, credit_cents,
        deleted_at
      FROM billing_subscriptions
      WHERE account_id = ${account}`);
    return { billing_subscriptions: rows };
  },
});

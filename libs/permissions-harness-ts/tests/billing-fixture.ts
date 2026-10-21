import { defineTable } from '@pkgs/db-schema-root-shared-ts/define-table';

/**
 * Shape of billing's synced membership table (the access resolver reads it;
 * billing owns it, and this package cannot depend on billing).
 */
export const billingSubscriptionsFixture = defineTable({
  domain: 'billing',
  name: 'billing_subscriptions',
  columns: {
    account_id: 'text',
    provider: 'text',
    provider_subscription_id: 'text',
    price_key: 'text',
    status: 'text',
    current_period_end: 'timestamp',
    cancel_at_period_end: 'boolean',
  },
});

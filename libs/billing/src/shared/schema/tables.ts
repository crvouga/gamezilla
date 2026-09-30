import { defineTable } from '@pkgs/db-schema';

/**
 * Provider-neutral subscription projection. Written by the vendor webhook and
 * synced to every device so access can be evaluated locally and offline.
 */
export const billingSubscriptions = defineTable({
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
    /** Provider credit in cents (never negative). Blank until a callback reads it. */
    credit_cents: 'integer',
  },
  indexes: ['account_id'],
  uniqueIndexes: [['provider', 'provider_subscription_id']],
});

export const BILLING_TABLES = [billingSubscriptions] as const;

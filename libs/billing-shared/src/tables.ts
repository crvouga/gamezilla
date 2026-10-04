import { defineTable } from '@pkgs/db-schema-shared/define-table';

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

export const billingAccountClosures = defineTable({
  domain: 'billing',
  name: 'billing_account_closures',
  columns: {
    account_id: 'text',
    provider: 'text',
    subscription_id: 'text',
    customer_id: 'text',
    confirmed_at: 'timestamp',
    cancellation_status: 'text',
  },
  uniqueIndexes: [['provider', 'subscription_id']],
  indexes: ['account_id'],
});

export const billingPaymentEvidence = defineTable({
  domain: 'billing',
  name: 'billing_payment_evidence',
  columns: {
    account_id: 'text',
    provider: 'text',
    payment_id: 'text',
    paid_at: 'timestamp',
    amount_minor: 'integer',
    currency: 'text',
    refunded_minor: 'integer',
    erase_by: 'timestamp',
    legal_purpose: 'text',
    legal_end_condition: 'text',
  },
  uniqueIndexes: [['provider', 'payment_id']],
  indexes: ['erase_by'],
});

export const BILLING_TABLES = [
  billingSubscriptions,
  billingAccountClosures,
  billingPaymentEvidence,
] as const;

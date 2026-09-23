import { defineTable } from '@pkgs/db-schema';

export const billingSubscriptions = defineTable({
  domain: 'billing',
  name: 'billing_subscriptions',
  columns: {
    account_id: 'text',
    status: 'text',
    price_key: 'text',
    customer_id: 'text',
    subscription_id: 'text',
    trial_end: 'timestamp',
    current_period_end: 'timestamp',
    grace_until: 'timestamp',
    cancel_at_period_end: 'boolean',
    action_required: 'boolean',
  },
  uniqueIndexes: ['account_id'],
});

export const billingEvents = defineTable({
  domain: 'billing',
  name: 'billing_events',
  columns: {
    event_id: 'text',
  },
  uniqueIndexes: ['event_id'],
});

export const BILLING_TABLES = [billingSubscriptions, billingEvents] as const;

import type { MetricContract } from './metric-contract';

export const BILLING_CALLBACK_OUTCOMES = [
  'accepted',
  'unverified',
  'unknown_provider',
  'failed',
] as const;
export type BillingCallbackOutcome = (typeof BILLING_CALLBACK_OUTCOMES)[number];

/**
 * Every billing provider callback, by how it ended. A refused signature
 * answers 400, which the server-error burn never counts.
 */
export const BILLING_CALLBACKS_METRIC: MetricContract = {
  name: 'billing.callbacks',
  description: 'Billing provider callbacks, by outcome',
  type: 'counter',
  unit: '{callback}',
  dimensions: { 'app.outcome': BILLING_CALLBACK_OUTCOMES },
  environmentScoped: true,
};

/** Provider slug for Stripe customer id. */
export const EXTERNAL_ACCOUNT_PROVIDER_STRIPE = 'stripe' as const;

export type ExternalAccountProvider =
  typeof EXTERNAL_ACCOUNT_PROVIDER_STRIPE;

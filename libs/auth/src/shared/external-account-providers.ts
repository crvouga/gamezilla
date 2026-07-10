/** Legacy slug written during a brief refactor — lookup only, never insert. */
export const LEGACY_EXTERNAL_ACCOUNT_PROVIDER_AUTH = 'auth' as const;

/** Provider slug for Stripe customer id. */
export const EXTERNAL_ACCOUNT_PROVIDER_STRIPE = 'stripe' as const;

export type ExternalAccountProvider =
  | typeof LEGACY_EXTERNAL_ACCOUNT_PROVIDER_AUTH
  | typeof EXTERNAL_ACCOUNT_PROVIDER_STRIPE;

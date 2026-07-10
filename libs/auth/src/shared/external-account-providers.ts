/** Provider slug for the Clerk user id mapping in `external_accounts`. */
export const EXTERNAL_ACCOUNT_PROVIDER_CLERK = 'clerk' as const;

/** Legacy slug written during a brief refactor — lookup only, never insert. */
export const LEGACY_EXTERNAL_ACCOUNT_PROVIDER_AUTH = 'auth' as const;

/** Provider slug for Stripe customer id. */
export const EXTERNAL_ACCOUNT_PROVIDER_STRIPE = 'stripe' as const;

export type ExternalAccountProvider =
  | typeof EXTERNAL_ACCOUNT_PROVIDER_CLERK
  | typeof EXTERNAL_ACCOUNT_PROVIDER_STRIPE;

/** Provider slug for the billing customer id on an account. */
export const EXTERNAL_ACCOUNT_PROVIDER_BILLING = 'billing' as const;

export type ExternalAccountProvider = typeof EXTERNAL_ACCOUNT_PROVIDER_BILLING;

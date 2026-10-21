/**
 * Billing customer links live in `auth_external_accounts` under one provider
 * slug per payment provider (`billing:stripe`, `billing:paddle`, …): a
 * customer id means nothing outside the provider that minted it, so an
 * account holds at most one link per provider and several across providers.
 */
export const BILLING_CUSTOMER_LINK_PREFIX = 'billing:' as const;

/** The link slug for customers minted by membership provider `provider`. */
export function billingCustomerLinkProvider(provider: string): string {
  return `${BILLING_CUSTOMER_LINK_PREFIX}${provider}`;
}

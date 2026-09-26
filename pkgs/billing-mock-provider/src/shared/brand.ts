/**
 * The provider's own identity. It stands in for a payment provider without
 * passing for one: every page, title and footer says what it is.
 */
export const MOCK_BILLING_BRAND = {
  name: 'Mock Billing',
  /** Shown beside every hosted page's header. */
  modeLabel: 'Test mode',
  footer: 'Mock Billing · test mode — no real charges are made.',
} as const;

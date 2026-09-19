/**
 * DOM test ids for the fake provider's mock pages. Shared by the mock HTML and
 * the sim's headless page walker so the two cannot drift.
 */
export const MOCK_BILLING_TEST_IDS = {
  checkoutPay: 'mock-checkout-pay',
  portalCancel: 'mock-portal-cancel',
  portalResume: 'mock-portal-resume',
  portalSwitch(priceKey: string): string {
    return `mock-portal-switch-${priceKey}`;
  },
} as const;

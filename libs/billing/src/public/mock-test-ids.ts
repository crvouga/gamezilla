/**
 * DOM test ids for the fake provider's hosted pages (the mock billing SPA).
 * Shared by the SPA and the sim's live-browser actions so the two cannot drift.
 *
 * Destructive portal actions confirm first: `*Start` opens the confirmation,
 * and the un-suffixed id is the button that commits the change.
 */
export const MOCK_BILLING_TEST_IDS = {
  checkoutPay: 'mock-checkout-pay',
  portalCancelStart: 'mock-portal-cancel-start',
  portalCancel: 'mock-portal-cancel',
  portalResume: 'mock-portal-resume',
  portalReturn: 'mock-portal-return',
  /** The confirmation a finished portal action shows. */
  portalNotice: 'mock-portal-notice',
  portalSwitchStart(priceKey: string): string {
    return `mock-portal-switch-start-${priceKey}`;
  },
  portalSwitch(priceKey: string): string {
    return `mock-portal-switch-${priceKey}`;
  },
} as const;

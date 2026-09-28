/**
 * DOM test ids for the provider's hosted pages. Shared by the pages and any
 * browser that drives them (the harness's actions), so the two cannot drift.
 *
 * Destructive portal actions confirm first: `*Start` opens the confirmation,
 * and the un-suffixed id is the button that commits the change.
 */
export const MOCK_BILLING_TEST_IDS = {
  checkoutPay: 'mock-checkout-pay',
  /** Start a trial without a card, where the session allows it. */
  checkoutSkipCard: 'mock-checkout-skip-card',
  checkoutCancel: 'mock-checkout-cancel',
  /** A test card to pay with, by magic payment method id. */
  checkoutCard: (paymentMethod: string) =>
    `mock-checkout-card-${paymentMethod}`,
  /** The checkout's plan choice, by price lookup key. */
  checkoutPlan: (lookupKey: string) => `mock-checkout-plan-${lookupKey}`,
  checkoutError: 'mock-checkout-error',
  portalReturn: 'mock-portal-return',
  /** The confirmation a finished portal action shows. */
  portalNotice: 'mock-portal-notice',
  portalError: 'mock-portal-error',
  portalCancelStart: 'mock-portal-cancel-start',
  portalCancelReason: (reason: string) => `mock-portal-cancel-reason-${reason}`,
  portalCancel: 'mock-portal-cancel',
  portalRenew: 'mock-portal-renew',
  portalResume: 'mock-portal-resume',
  portalSwitchStart: (lookupKey: string) =>
    `mock-portal-switch-start-${lookupKey}`,
  portalSwitch: (lookupKey: string) => `mock-portal-switch-${lookupKey}`,
  portalPaymentMethodStart: 'mock-portal-payment-method-start',
  portalPaymentMethod: 'mock-portal-payment-method',
  portalPayInvoice: 'mock-portal-pay-invoice',
  portalInvoices: 'mock-portal-invoices',
} as const;

/**
 * What a person does on the billing screen and on the provider's hosted
 * pages: the pages' own `data-testid`s, a working test card, and the gestures
 * the billing actions share.
 */

import { actorUi, pollUntil } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { billingButtonEnabled } from './billing-reads';

export const BILLING_WAIT_MS = 20_000;

/**
 * The `data-testid`s of Stripe's hosted checkout and billing portal, as the
 * Stripe mock serves them.
 */
export const STRIPE_PAGE = {
  checkout: 'stripe-mock-checkout',
  checkoutCard: 'stripe-mock-card',
  checkoutExpiry: 'stripe-mock-exp',
  checkoutCvc: 'stripe-mock-cvc',
  checkoutZip: 'stripe-mock-zip',
  checkoutPay: 'stripe-mock-pay',
  checkoutCancel: 'stripe-mock-cancel',
  portalReturn: 'stripe-mock-portal-return',
  portalNotice: 'stripe-mock-portal-notice',
  portalCancelPlan: 'stripe-mock-portal-cancel-plan',
  portalCancelReason: (reason: string) => `stripe-mock-portal-reason-${reason}`,
  portalCancelConfirm: 'stripe-mock-portal-cancel-confirm',
  portalRenew: 'stripe-mock-portal-renew',
  portalUpdatePlan: 'stripe-mock-portal-update-plan',
  portalPriceOption: (lookupKey: string) =>
    `stripe-mock-portal-price-option-${lookupKey}`,
  portalContinue: 'stripe-mock-portal-continue',
  portalConfirmUpdate: 'stripe-mock-portal-confirm-update',
  portalAddPaymentMethod: 'stripe-mock-portal-add-payment-method',
  portalCard: 'stripe-mock-portal-card',
  portalExpiry: 'stripe-mock-portal-exp',
  portalCvc: 'stripe-mock-portal-cvc',
  portalZip: 'stripe-mock-portal-zip',
  portalSaveCard: 'stripe-mock-portal-save-card',
  portalPayInvoice: 'stripe-mock-portal-pay-invoice',
} as const;

/** A working test card, as a person types it into a card form. */
export const TEST_CARD = {
  number: '4242424242424242',
  expiry: '12 / 34',
  cvc: '123',
  zip: '94107',
} as const;

/**
 * Press one of the billing screen's own buttons once it accepts a press. Each
 * stays disabled on its "Opening…" face for a moment after it opened the
 * provider's page, and a press on a disabled button does nothing, so a person
 * back from the provider waits for it, as this does.
 */
export async function pressBillingButton(
  s: ProductHarness,
  actorId: string,
  which: 'subscribe' | 'manage'
): Promise<void> {
  await pollUntil(
    s,
    async () => ((await billingButtonEnabled(s, actorId, which)) ? true : null),
    {
      maxMs: BILLING_WAIT_MS,
      description: `the billing ${which} button to accept a press`,
    }
  );
  const ui = await actorUi(s, actorId);
  await ui
    .get(
      which === 'subscribe' ? Handles.billingSubscribe : Handles.billingManage
    )
    .tap({ timeoutMs: BILLING_WAIT_MS });
}

/** On the provider's open checkout: type the working card and pay. */
export async function payOnCheckoutPage(
  s: ProductHarness,
  actorId: string
): Promise<void> {
  const ui = await actorUi(s, actorId);
  await ui
    .get(STRIPE_PAGE.checkoutCard)
    .input(TEST_CARD.number, { timeoutMs: BILLING_WAIT_MS });
  await ui.get(STRIPE_PAGE.checkoutExpiry).input(TEST_CARD.expiry);
  await ui.get(STRIPE_PAGE.checkoutCvc).input(TEST_CARD.cvc);
  await ui.get(STRIPE_PAGE.checkoutZip).input(TEST_CARD.zip);
  await ui.get(STRIPE_PAGE.checkoutPay).tap({ timeoutMs: BILLING_WAIT_MS });
}

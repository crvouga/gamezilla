/** What a signed-in person sees of Plus: the billing plans and their prices. */

import { PLUS_MEMBERSHIP_OFFER } from '@libs/billing/public/offer';
import { openGlobalMenu } from '@libs/sim-harness/system/driver-gestures';
import { Handles } from '@libs/test-ids';
import type { Driver } from '@pkgs/ui-testing';
import {
  atTabShell,
  expectVisible,
  JOURNEY_WAIT_MS,
  tap,
} from './journey-gestures';

/** Settings → Billing. */
export async function viewBillingPlans(ui: Driver): Promise<void> {
  await atTabShell(ui);
  await openGlobalMenu(ui, Handles.globalMenuSettings, JOURNEY_WAIT_MS);
  await tap(ui, Handles.globalMenuSettings);
  await tap(ui, Handles.settingsBilling);
  await expectVisible(ui, Handles.billingPricing);
}

/**
 * A price as a person reads it in English: `$7.00`. The amounts are the
 * decided offer's, in its own currency.
 */
function priceText(price: {
  readonly unitAmount: number;
  readonly currency: string;
}): string {
  const format = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: price.currency.toUpperCase(),
  });
  const digits = format.resolvedOptions().maximumFractionDigits ?? 2;
  return format.format(price.unitAmount / 10 ** digits);
}

/** Plus is offered monthly and yearly, each at the offer's price. */
export async function expectPlusPrices(ui: Driver): Promise<void> {
  const { subscription_monthly: monthly, subscription_yearly: yearly } =
    PLUS_MEMBERSHIP_OFFER.prices;
  for (const price of [monthly, yearly]) {
    await ui
      .get(Handles.billingPrice(price.key))
      .expect.text(priceText(price), {
        exact: false,
        timeoutMs: JOURNEY_WAIT_MS,
      });
  }
}

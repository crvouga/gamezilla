import { paidCheckoutReturnUrl } from '@pkgs/billing-root-shared-ts/checkout-return';
import type {
  MembershipChange,
  StartCheckoutInput,
  StartCheckoutResult,
} from '@pkgs/billing-root-shared-ts/membership';
import type { PlusMembershipOffer } from '@pkgs/billing-root-shared-ts/offer';
import type Stripe from 'stripe';
import {
  liveStripeSubscription,
  reusableStripeCheckout,
} from './stripe-checkout-reuse';

/** Cross-process retries share a customer and checkout operation at Stripe. */
export async function startStripeCheckout(args: {
  readonly stripe: Stripe;
  readonly offer: PlusMembershipOffer;
  readonly input: StartCheckoutInput;
  readonly nowMs: number;
  readonly changeOf: (
    subscription: Record<string, unknown>
  ) => Promise<MembershipChange | null>;
}): Promise<StartCheckoutResult> {
  const { stripe, input, offer } = args;
  const customer =
    input.customerId ??
    (
      await stripe.customers.create(
        {
          ...(input.email === null ? {} : { email: input.email }),
          metadata: { accountId: input.accountId },
        },
        { idempotencyKey: `membership-customer:${input.accountId}` }
      )
    ).id;
  const live = await liveStripeSubscription(stripe, customer);
  const change = live === null ? null : await args.changeOf(live);
  if (change !== null)
    return { kind: 'live_membership', customerId: customer, change };
  const checkout = await reusableStripeCheckout(stripe, {
    customer,
    returnUrl: input.returnUrl,
    nowMs: args.nowMs,
  });
  if (checkout.url !== null)
    return { kind: 'checkout', customerId: customer, url: checkout.url };
  const spec = offer.prices[offer.defaultPriceKey];
  if (spec === undefined)
    throw new Error(`stripe: no offer price for key ${offer.defaultPriceKey}`);
  const prices = await stripe.prices.list({
    lookup_keys: [spec.catalogPriceId],
    active: true,
    limit: 1,
  });
  const price = prices.data[0];
  if (price === undefined)
    throw new Error(
      `stripe: no active price for lookup key ${spec.catalogPriceId}`
    );
  const session = await stripe.checkout.sessions.create(
    {
      mode: 'subscription',
      customer,
      client_reference_id: input.accountId,
      subscription_data: {
        metadata: { accountId: input.accountId },
        ...((spec.trialPeriodDays ?? 0) > 0
          ? { trial_period_days: spec.trialPeriodDays }
          : {}),
      },
      line_items: [{ price: price.id, quantity: 1 }],
      success_url: paidCheckoutReturnUrl(input.returnUrl),
      cancel_url: input.returnUrl,
    },
    {
      // Concurrent readers see the same predecessor. A closed checkout advances
      // the key, allowing another attempt without replaying an expired URL.
      idempotencyKey: `membership-checkout:${customer}:${checkout.generation}`,
    }
  );
  return { kind: 'checkout', customerId: customer, url: session.url ?? '' };
}

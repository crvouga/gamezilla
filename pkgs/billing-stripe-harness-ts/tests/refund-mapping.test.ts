/**
 * A membership that ended after its last payment was refunded in full ends
 * with no paid time left, whichever event brings the news: the refund itself,
 * or the cancellation that follows it. A cancellation without a refund, or
 * after a partial one, keeps its paid time.
 */
// regression: refund-kept-grace
import { describe, expect, test } from 'bun:test';
import { CONTRACT_OFFER } from '@pkgs/billing-root-shared-ts/contract-fixtures';
import type { CallbackResult } from '@pkgs/billing-root-shared-ts/membership';
import { StripeTestMode } from '@pkgs/billing-stripe-harness-ts/stripe-test-mode';
import { createStripeMembershipBilling } from '@pkgs/billing-stripe-server-ts/stripe-membership';

const NOW_MS = 1_800_000_000_000;
const DAY_MS = 86_400_000;

/** A member ten days into a paid month, and the adapter reading their news. */
async function paidMember() {
  const stripe = new StripeTestMode({ nowMs: NOW_MS });
  await stripe.seedPrices(
    Object.values(CONTRACT_OFFER.prices).map((spec) => spec.catalogPriceId)
  );
  const customer = await stripe.stripe.customers.create({
    email: 'ada@people.test',
  });
  const card = await stripe.stripe.paymentMethods.attach('pm_card_visa', {
    customer: customer.id,
  });
  const [price] = (
    await stripe.stripe.prices.list({ lookup_keys: ['subscription_monthly'] })
  ).data;
  if (price === undefined) throw new Error('no monthly price');
  const subscription = await stripe.stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: price.id }],
    default_payment_method: card.id,
  });
  stripe.advance(10 * DAY_MS);
  const billing = createStripeMembershipBilling({
    secretKey: stripe.secretKey,
    webhookSecret: stripe.webhookSecret,
    offer: CONTRACT_OFFER,
    now: () => stripe.now(),
    transport: { origin: stripe.origin, fetch: stripe.fetch },
  });
  /** What the adapter makes of the last `type` event about object `id`. */
  const read = async (type: string, id: string): Promise<CallbackResult> =>
    await billing.readCallback(
      await stripe.signed({
        rawBody: stripe.lastSent(type, id).body,
        timestampS: Math.floor(stripe.now() / 1000),
      })
    );
  const refund = async (amount?: number): Promise<string> => {
    const [intent] = (
      await stripe.stripe.paymentIntents.list({ customer: customer.id })
    ).data;
    if (intent === undefined) throw new Error('no payment');
    const refunded = await stripe.stripe.refunds.create({
      payment_intent: intent.id,
      ...(amount === undefined ? {} : { amount }),
    });
    if (typeof refunded.charge !== 'string') throw new Error('no charge');
    return refunded.charge;
  };
  return { stripe, subscription, read, refund };
}

const REFUNDED = {
  status: 'ended',
  periodEndMs: null,
  endsAtPeriodEnd: false,
} as const;

describe('a refunded membership has no paid time left', () => {
  test('refunded, then canceled: the cancellation ends it with nothing left', async () => {
    const member = await paidMember();
    await member.refund();
    await member.stripe.stripe.subscriptions.cancel(member.subscription.id);
    const result = await member.read(
      'customer.subscription.deleted',
      member.subscription.id
    );
    expect(result.kind === 'membership' && result.membership).toEqual(REFUNDED);
  });

  test('canceled, then refunded: the refund ends it with nothing left', async () => {
    const member = await paidMember();
    await member.stripe.stripe.subscriptions.cancel(member.subscription.id);
    const charge = await member.refund();
    const result = await member.read('charge.refunded', charge);
    expect(result.kind === 'membership' && result).toMatchObject({
      subscriptionId: member.subscription.id,
      membership: REFUNDED,
    });
  });

  test('canceled without a refund: access runs to when it stopped', async () => {
    const member = await paidMember();
    await member.stripe.stripe.subscriptions.cancel(member.subscription.id);
    const result = await member.read(
      'customer.subscription.deleted',
      member.subscription.id
    );
    expect(result.kind === 'membership' && result.membership).toEqual({
      status: 'ended',
      periodEndMs: member.stripe.now() - (member.stripe.now() % 1000),
      endsAtPeriodEnd: false,
    });
  });

  test('canceled after a partial refund: paid time is kept', async () => {
    const member = await paidMember();
    await member.refund(100);
    await member.stripe.stripe.subscriptions.cancel(member.subscription.id);
    const result = await member.read(
      'customer.subscription.deleted',
      member.subscription.id
    );
    expect(
      result.kind === 'membership' && result.membership.periodEndMs
    ).not.toBeNull();
  });
});

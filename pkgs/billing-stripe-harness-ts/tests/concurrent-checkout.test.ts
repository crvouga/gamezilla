import { expect, test } from 'bun:test';
import { CONTRACT_OFFER } from '@pkgs/billing-root-shared-ts/contract-fixtures';
import { StripeTestMode } from '@pkgs/billing-stripe-harness-ts/stripe-test-mode';
import { createStripeMembershipBilling } from '@pkgs/billing-stripe-server-ts/stripe-membership';

// regression: billing-concurrent-checkout-double-payment
test.each([false, true])(
  'concurrent checkout uses one customer and one payable session (linked: %s)',
  async (linked) => {
    const stripe = new StripeTestMode({ nowMs: 1_800_000_000_000 });
    await stripe.seedPrices(['subscription_monthly']);
    const customerId = linked
      ? (await stripe.stripe.customers.create({})).id
      : null;
    let release = () => {};
    const bothListed = new Promise<void>((resolve) => {
      release = resolve;
    });
    let lists = 0;
    const transport = {
      origin: stripe.origin,
      fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
        const response = await stripe.fetch(input, init);
        const request = new Request(input, init);
        if (
          request.method === 'GET' &&
          new URL(request.url).pathname === '/v1/checkout/sessions'
        ) {
          lists += 1;
          if (lists === 2) release();
          await bothListed;
        }
        return response;
      },
    };
    const open = () =>
      createStripeMembershipBilling({
        secretKey: stripe.secretKey,
        webhookSecret: stripe.webhookSecret,
        offer: CONTRACT_OFFER,
        now: () => stripe.now(),
        transport,
      }).startCheckout({
        accountId: 'alice',
        customerId,
        email: 'alice@example.test',
        returnUrl: 'https://app.test/settings/billing',
      });
    const results = await Promise.all([open(), open()]);
    expect(results[0]).toEqual(results[1]);
    expect((await stripe.stripe.customers.list()).data).toHaveLength(1);
    const sessions = await stripe.stripe.checkout.sessions.list({
      status: 'open',
    });
    expect(sessions.data).toHaveLength(1);
  }
);

import { expect, test } from 'bun:test';
import { legalStimuli } from '@libs/billing-harness-ts/billing-lifecycle-stimuli';
import {
  driveProvider,
  subscriptionsEverywhere,
} from '@libs/billing-harness-ts/billing-provider-driver';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { StripeTestMode } from '@pkgs/billing-stripe-harness-ts/stripe-test-mode';

const now = Date.parse('2026-11-24T23:08:26Z');

// regression: stack-trial-uses-unrelated-provider
test('ending the browser payer’s trial charges that customer at the checkout provider', async () => {
  const deployed = new StripeTestMode({ nowMs: now });
  const local = new StripeTestMode({ nowMs: now });
  try {
    await deployed.seedPrices(['monthly']);
    const [price] = (await deployed.stripe.prices.list()).data;
    const subscribe = async () => {
      const customer = await deployed.stripe.customers.create();
      const checkout = await deployed.stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: customer.id,
        line_items: [{ price: price!.id, quantity: 1 }],
        subscription_data: { trial_period_days: 7 },
        success_url: 'http://127.0.0.1:34305/more/billing',
      });
      await deployed.completeCheckout(checkout.id);
      return customer.id;
    };
    const alice = await subscribe();
    const bob = await subscribe();
    const localProvider = {
      id: 'stripe',
      stripe: local.stripe,
      now: () => now,
    };
    const world = {
      session: { ports: { stackStripe: deployed.stripe } },
      harness: {
        billing: { all: () => [localProvider], checkout: () => localProvider },
        serverSql: {
          sqlClient: { query: async () => [{ external_id: alice }] },
        },
      },
    } as unknown as ProductHarness;
    const [first] = await subscriptionsEverywhere(world, 'alice');
    expect(first?.subscriptions[0]?.status).toBe('trialing');
    await driveProvider(world, 'alice', 'period_end');
    expect(
      (await deployed.stripe.subscriptions.list({ customer: alice })).data[0]
        ?.status
    ).toBe('active');
    expect(
      (await deployed.stripe.subscriptions.list({ customer: bob })).data[0]
        ?.status
    ).toBe('trialing');
  } finally {
    deployed.runtime.stop();
    local.runtime.stop();
  }
});

// regression: billing-native-phone-cannot-lose-connection
test('the billing phone can go offline and return on the native host', async () => {
  let offline = false;
  const world = {
    actors: new Map([
      [
        'alice-phone',
        { ui: { get: () => ({ isVisible: async () => offline }) } },
      ],
    ]),
    session: {
      ports: {
        ui: { kind: 'bun-webview' },
        http: { kind: 'stack', accountTag: 'literal' },
      },
      caps: new Set(),
    },
    harness: { serverSql: { sqlClient: { query: async () => [] } } },
  } as unknown as ProductHarness;
  expect(await legalStimuli(world)).toContain('second_device_offline');
  offline = true;
  expect(await legalStimuli(world)).toContain('second_device_online');
});

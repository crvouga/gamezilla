/**
 * The REST surface's Stripe semantics, request by request: form encoding,
 * `Idempotency-Key`, cursor pagination, `expand[]`, the `status` filter, the
 * error envelope for unknown routes, checkout expiry, trial reminders, and
 * 3D Secure renewals.
 */
import { describe, expect, test } from 'bun:test';
import {
  MOCK_BILLING_IDEMPOTENT_REPLAYED_HEADER,
  MOCK_BILLING_PATHS,
  MOCK_TEST_PAYMENT_METHODS,
  type MockCheckoutSession,
  type MockCustomer,
  type MockEvent,
  type MockInvoice,
  type MockList,
  type MockSubscription,
} from '@pkgs/billing-mock';

import {
  advanceTo,
  DAY_S,
  ORIGIN,
  openRig,
  periodEndS,
  type Rig,
  SECRET_KEY,
  START_MS,
  subscribe,
} from './support/provider-rig';

async function raw(
  world: Rig,
  path: string,
  init: RequestInit & { readonly form?: Record<string, string> } = {}
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('authorization', `Bearer ${SECRET_KEY}`);
  if (init.form !== undefined) {
    headers.set('content-type', 'application/x-www-form-urlencoded');
  }
  return await world.fetch(`${ORIGIN}${path}`, {
    ...init,
    headers,
    ...(init.form === undefined
      ? {}
      : { body: new URLSearchParams(init.form).toString() }),
  });
}

async function events(world: Rig, type: string): Promise<MockEvent[]> {
  const list = await world.call(
    'GET',
    `${MOCK_BILLING_PATHS.events}?type=${type}&limit=100`
  );
  return (list.body as MockList<MockEvent>).data as MockEvent[];
}

describe('requests', () => {
  test('form-encoded bodies work like Stripe’s', async () => {
    const world = await openRig();
    const customer = (await (
      await raw(world, MOCK_BILLING_PATHS.customers, {
        method: 'POST',
        form: { email: 'a@test', 'metadata[accountId]': 'acct-9' },
      })
    ).json()) as MockCustomer;
    expect(customer.metadata).toEqual({ accountId: 'acct-9' });
    const session = (await (
      await raw(world, MOCK_BILLING_PATHS.checkoutSessions, {
        method: 'POST',
        form: {
          mode: 'subscription',
          customer: customer.id,
          'line_items[0][price]': 'price_subscriptionmonthly',
          'line_items[0][quantity]': '1',
          success_url: 'https://app.test/ok',
          cancel_url: 'https://app.test/no',
          'subscription_data[trial_period_days]': '7',
        },
      })
    ).json()) as MockCheckoutSession;
    expect(session.subscription_data.trial_period_days).toBe(7);
    expect(session.payment_status).toBe('unpaid');
    expect(session.amount_total).toBe(0);
  });

  test('an Idempotency-Key replays the first answer and runs nothing', async () => {
    const world = await openRig();
    const send = (email: string) =>
      raw(world, MOCK_BILLING_PATHS.customers, {
        method: 'POST',
        headers: { 'idempotency-key': 'key-1' },
        form: { email },
      });
    const first = await send('a@test');
    const again = await send('a@test');
    const firstBody = (await first.json()) as MockCustomer;
    expect(await again.json()).toEqual(firstBody);
    expect(again.headers.get(MOCK_BILLING_IDEMPOTENT_REPLAYED_HEADER)).toBe(
      'true'
    );
    expect(await events(world, 'customer.created')).toHaveLength(1);
    const other = await send('b@test');
    expect(other.status).toBe(400);
    expect(
      ((await other.json()) as { error: { type: string } }).error.type
    ).toBe('idempotency_error');
  });

  test('an unknown route is a 404 in the error envelope', async () => {
    const world = await openRig();
    const response = await raw(world, '/v1/charges');
    expect(response.status).toBe(404);
    const body = (await response.json()) as { error: { message: string } };
    expect(body.error.message).toContain('Unrecognized request URL');
  });
});

describe('lists', () => {
  test('pages walk newest first with cursors', async () => {
    const world = await openRig();
    for (let index = 0; index < 5; index += 1) {
      await world.call('POST', MOCK_BILLING_PATHS.customers, {});
    }
    const pageOf = async (query: string) =>
      (
        await world.call(
          'GET',
          `${MOCK_BILLING_PATHS.events}?type=customer.created&${query}`
        )
      ).body as MockList<MockEvent>;
    const first = await pageOf('limit=2');
    expect(first.data).toHaveLength(2);
    expect(first.has_more).toBe(true);
    const second = await pageOf(`limit=2&starting_after=${first.data[1]?.id}`);
    const third = await pageOf(`limit=2&starting_after=${second.data[1]?.id}`);
    expect(third.data).toHaveLength(1);
    expect(third.has_more).toBe(false);
    const back = await pageOf(`limit=2&ending_before=${second.data[0]?.id}`);
    expect(back.data.map((e) => e.id)).toEqual(first.data.map((e) => e.id));
    const all = [...first.data, ...second.data, ...third.data].map((e) => e.id);
    expect(new Set(all).size).toBe(5);
    expect(
      (await world.call('GET', `${MOCK_BILLING_PATHS.events}?limit=0`)).status
    ).toBe(400);
  });

  test('a canceled subscription is listed only when asked for', async () => {
    const world = await openRig();
    const { customerId } = await subscribe(world);
    const list = async (status: string) =>
      (
        (
          await world.call(
            'GET',
            `${MOCK_BILLING_PATHS.subscriptions}?customer=${customerId}${status}`
          )
        ).body as MockList<MockSubscription>
      ).data;
    const [subscription] = await list('');
    await world.call(
      'DELETE',
      MOCK_BILLING_PATHS.subscription(subscription?.id ?? '')
    );
    expect(await list('')).toHaveLength(0);
    expect(await list('&status=all')).toHaveLength(1);
    expect(await list('&status=ended')).toHaveLength(1);
  });

  test('expand[] inlines the latest invoice and the customer', async () => {
    const world = await openRig();
    const { customerId } = await subscribe(world);
    const list = (
      await world.call(
        'GET',
        `${MOCK_BILLING_PATHS.subscriptions}?customer=${customerId}&expand[]=data.latest_invoice&expand[]=data.customer`
      )
    ).body as MockList<MockSubscription>;
    const subscription = list.data[0];
    expect((subscription?.latest_invoice as MockInvoice).object).toBe(
      'invoice'
    );
    expect((subscription?.customer as unknown as MockCustomer).id).toBe(
      customerId
    );
    const refused = await world.call(
      'GET',
      `${MOCK_BILLING_PATHS.subscription(subscription?.id ?? '')}?expand[]=items`
    );
    expect(refused.status).toBe(400);
  });
});

describe('lifecycle events', () => {
  test('an open checkout expires on the clock and says so', async () => {
    const world = await openRig();
    const checkout = await world.billing.startCheckout({
      accountId: 'acct-1',
      customerId: null,
      email: null,
      returnUrl: 'https://app.test/',
    });
    await advanceTo(world, checkout.customerId, START_MS / 1000 + DAY_S + 1);
    const [expired] = await events(world, 'checkout.session.expired');
    expect((expired?.data.object as MockCheckoutSession).status).toBe(
      'expired'
    );
  });

  test('an open checkout can be expired by hand, once', async () => {
    const world = await openRig();
    const checkout = await world.billing.startCheckout({
      accountId: 'acct-1',
      customerId: null,
      email: null,
      returnUrl: 'https://app.test/',
    });
    const id = checkout.url.split('/').at(-1) ?? '';
    const path = MOCK_BILLING_PATHS.checkoutSessionExpire(id);
    expect((await world.call('POST', path)).status).toBe(200);
    expect((await world.call('POST', path)).status).toBe(400);
  });

  test('trial_will_end goes out three days before the trial ends, once', async () => {
    const world = await openRig();
    const { customerId } = await subscribe(world);
    await advanceTo(world, customerId, START_MS / 1000 + 5 * DAY_S);
    await advanceTo(world, customerId, START_MS / 1000 + 6 * DAY_S);
    const reminders = await events(
      world,
      'customer.subscription.trial_will_end'
    );
    expect(reminders.map((e) => e.created)).toEqual([
      START_MS / 1000 + 4 * DAY_S,
    ]);
  });

  test('a 3D Secure card renews off-session only with the customer’s action', async () => {
    const world = await openRig();
    const { customerId } = await subscribe(
      world,
      MOCK_TEST_PAYMENT_METHODS.authenticationRequired
    );
    const list = (
      await world.call(
        'GET',
        `${MOCK_BILLING_PATHS.subscriptions}?customer=${customerId}`
      )
    ).body as MockList<MockSubscription>;
    await advanceTo(
      world,
      customerId,
      periodEndS(list.data[0] as MockSubscription)
    );
    expect(await events(world, 'invoice.payment_action_required')).toHaveLength(
      1
    );
    const invoices = (
      await world.call(
        'GET',
        `${MOCK_BILLING_PATHS.invoices}?customer=${customerId}`
      )
    ).body as MockList<MockInvoice>;
    const open = invoices.data.find((invoice) => invoice.status === 'open');
    const pay = await world.call(
      'POST',
      MOCK_BILLING_PATHS.invoicePay(open?.id ?? '')
    );
    expect(pay.status).toBe(402);
    expect((pay.body as { error: { code: string } }).error.code).toBe(
      'authentication_required'
    );
  });

  test('a finalized invoice is numbered and announced', async () => {
    const world = await openRig();
    await subscribe(world);
    const [finalized] = await events(world, 'invoice.finalized');
    expect((finalized?.data.object as MockInvoice).number).toMatch(
      /^[A-Z0-9]{8}-0001$/
    );
    expect(await events(world, 'invoice.payment_succeeded')).toHaveLength(1);
  });
});

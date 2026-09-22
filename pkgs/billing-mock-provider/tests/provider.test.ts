/**
 * The provider end to end, driven the way the app drives Stripe: the real
 * adapter (`MockMembershipBilling`) over HTTP, the hosted pages' own API, and
 * the signed webhooks the provider sends back — each read by the adapter.
 */
import { describe, expect, test } from 'bun:test';
import {
  MOCK_BILLING_PATHS,
  MOCK_TEST_PAYMENT_METHODS,
} from '@pkgs/billing-mock';
import {
  type CheckoutView,
  MOCK_BILLING_PAGE_API,
} from '@pkgs/billing-mock-provider/shared';

import {
  advanceTo,
  DAY_S,
  ORIGIN,
  openRig,
  page,
  periodEndS,
  portal,
  RETURN_URL,
  START_MS,
  sessionId,
  subscribe,
  subscriptionOf,
} from './support/provider-rig';

describe('checkout', () => {
  test('a paid checkout starts a trial and tells the app', async () => {
    const world = await openRig();
    const { confirm } = await subscribe(world);
    expect(confirm.body.redirectUrl).toBe(RETURN_URL);
    const [change] = await world.changes();
    expect(change?.provider).toBe('mock');
    expect(change?.offerPriceKey).toBe('subscription_monthly');
    expect(change?.membership).toEqual({
      status: 'trialing',
      periodEndMs: START_MS + 7 * DAY_S * 1000,
      endsAtPeriodEnd: false,
    });
  });

  test('a declined card creates nothing and leaves the session open', async () => {
    const world = await openRig();
    const { confirm, sessionId: id } = await subscribe(
      world,
      MOCK_TEST_PAYMENT_METHODS.chargeDeclined
    );
    expect(confirm.status).toBe(402);
    expect(confirm.body.error?.code).toBe('card_declined');
    expect(await world.changes()).toEqual([]);
    const view = await page<CheckoutView>(
      world,
      MOCK_BILLING_PAGE_API.checkout(id)
    );
    expect(view.body.session.status).toBe('open');
  });

  test('an upsell pays at the yearly price', async () => {
    const world = await openRig();
    await subscribe(
      world,
      MOCK_TEST_PAYMENT_METHODS.visa,
      'subscription_yearly'
    );
    const [change] = await world.changes();
    expect(change?.offerPriceKey).toBe('subscription_yearly');
  });

  test('a checkout expires after a day', async () => {
    const world = await openRig();
    const checkout = await world.billing.startCheckout({
      accountId: 'acct-1',
      customerId: null,
      email: null,
      returnUrl: RETURN_URL,
    });
    world.advanceWallMs(DAY_S * 1000);
    const view = await page<CheckoutView>(
      world,
      MOCK_BILLING_PAGE_API.checkout(sessionId(checkout.url))
    );
    expect(view.body.session.status).toBe('expired');
  });
});

describe('billing cycle', () => {
  test('the trial ends into a paid month on the calendar', async () => {
    const world = await openRig();
    const { customerId } = await subscribe(world);
    await world.changes();
    const trialEnd = periodEndS(await subscriptionOf(world, customerId));
    await advanceTo(world, customerId, trialEnd);
    const changes = await world.changes();
    expect(changes.at(-1)?.membership.status).toBe('active');
    // Feb 7 → Mar 7: a calendar month, not 30 days.
    expect(changes.at(-1)?.membership.periodEndMs).toBe(
      Date.UTC(2026, 2, 7, 12)
    );
  });

  test('a failing card goes past due, then ends after the last retry', async () => {
    const world = await openRig();
    const { customerId } = await subscribe(
      world,
      MOCK_TEST_PAYMENT_METHODS.chargeCustomerFail
    );
    await world.changes();
    const trialEnd = periodEndS(await subscriptionOf(world, customerId));
    await advanceTo(world, customerId, trialEnd);
    expect((await world.changes()).at(-1)?.membership.status).toBe(
      'delinquent'
    );
    await advanceTo(world, customerId, trialEnd + 8 * DAY_S);
    const last = (await world.changes()).at(-1);
    expect(last?.membership.status).toBe('ended');
    expect(last?.membership.periodEndMs).toBe((trialEnd + 7 * DAY_S) * 1000);
  });

  test('a new card in the portal pays the open invoice', async () => {
    const world = await openRig();
    const { customerId } = await subscribe(
      world,
      MOCK_TEST_PAYMENT_METHODS.chargeCustomerFail
    );
    const trialEnd = periodEndS(await subscriptionOf(world, customerId));
    await advanceTo(world, customerId, trialEnd);
    await world.changes();
    const session = await portal(world, customerId);
    expect((await session.view()).subscription?.openInvoice?.amountDue).toBe(
      700
    );
    const result = await session.act({
      kind: 'update_payment_method',
      paymentMethod: MOCK_TEST_PAYMENT_METHODS.visa,
    });
    expect(result.status).toBe(200);
    expect(result.body.subscription?.status).toBe('active');
    expect((await world.changes()).at(-1)?.membership.status).toBe('active');
  });
});

describe('portal', () => {
  test('cancel, renew and switch during the trial', async () => {
    const world = await openRig();
    const { customerId } = await subscribe(world);
    await world.changes();
    const session = await portal(world, customerId);
    const yearly = (await session.view()).prices.find(
      (price) => price.lookupKey === 'subscription_yearly'
    );
    await session.act({ kind: 'cancel', reason: 'too_expensive' });
    expect((await world.changes()).at(-1)?.membership.endsAtPeriodEnd).toBe(
      true
    );
    await session.act({ kind: 'renew' });
    expect((await world.changes()).at(-1)?.membership.endsAtPeriodEnd).toBe(
      false
    );
    await session.act({ kind: 'switch', price: yearly?.id ?? '' });
    const switched = (await world.changes()).at(-1);
    expect(switched?.offerPriceKey).toBe('subscription_yearly');
    // The trial carries on at the new price.
    expect(switched?.membership.status).toBe('trialing');
  });

  test('a canceled plan ends at its period end', async () => {
    const world = await openRig();
    const { customerId } = await subscribe(world);
    const session = await portal(world, customerId);
    await session.act({ kind: 'cancel', reason: null });
    const end = periodEndS(await subscriptionOf(world, customerId));
    await world.changes();
    await advanceTo(world, customerId, end + DAY_S);
    expect((await world.changes()).at(-1)?.membership).toEqual({
      status: 'ended',
      periodEndMs: end * 1000,
      endsAtPeriodEnd: false,
    });
  });

  test('a portal link expires after an hour', async () => {
    const world = await openRig();
    const { customerId } = await subscribe(world);
    const { url } = await world.billing.openPortal({
      accountId: 'acct-1',
      customerId,
      returnUrl: RETURN_URL,
    });
    world.advanceWallMs(60 * 60 * 1000);
    const view = await page(
      world,
      MOCK_BILLING_PAGE_API.portal(sessionId(url))
    );
    expect(view.status).toBe(410);
  });
});

describe('api', () => {
  test('an immediate cancel ends access now, not at the period end', async () => {
    const world = await openRig();
    const { customerId } = await subscribe(world);
    await world.changes();
    const subscription = await subscriptionOf(world, customerId);
    await world.call(
      'DELETE',
      MOCK_BILLING_PATHS.subscription(subscription.id)
    );
    expect((await world.changes()).at(-1)?.membership).toEqual({
      status: 'ended',
      periodEndMs: START_MS,
      endsAtPeriodEnd: false,
    });
  });

  test('a wrong secret key is refused', async () => {
    const world = await openRig();
    const response = await world.fetch(
      `${ORIGIN}${MOCK_BILLING_PATHS.customers}`,
      {
        method: 'POST',
        headers: { authorization: 'Bearer sk_test_mock_wrong' },
        body: '{}',
      }
    );
    expect(response.status).toBe(401);
  });

  test('a resent event arrives again and reads the same', async () => {
    const world = await openRig();
    await subscribe(world);
    const first = await world.changes();
    const events = await world.call(
      'GET',
      `${MOCK_BILLING_PATHS.events}?type=customer.subscription.created&limit=1`
    );
    const [event] = (events.body as { data: { id: string }[] }).data;
    await world.call('POST', MOCK_BILLING_PATHS.resendEvent(event?.id ?? ''));
    expect(await world.changes()).toEqual(first);
  });

  test('a test clock only moves forward', async () => {
    const world = await openRig();
    const { customerId } = await subscribe(world);
    const result = await world.call(
      'POST',
      MOCK_BILLING_PATHS.advanceCustomerClock(customerId),
      { frozen_time: START_MS / 1000 - 1 }
    );
    expect(result.status).toBe(400);
  });
});

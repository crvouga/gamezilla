/**
 * One provider, its adapter and its webhook endpoint, on a clock the test
 * owns: the world every provider suite drives. The adapter reads every
 * delivered webhook exactly as the app's callback route would.
 */
import { expect } from 'bun:test';
import type {
  CallbackResult,
  MembershipChange,
  PlusMembershipOffer,
} from '@pkgs/billing';
import { CONTRACT_OFFER } from '@pkgs/billing/membership-billing-contract';
import {
  MOCK_BILLING_PATHS,
  MOCK_TEST_PAYMENT_METHODS,
  type MockEvent,
  MockMembershipBilling,
  type MockSubscription,
  mockBillingCatalogFromOffer,
} from '@pkgs/billing-mock';
import { createMockBillingProvider } from '@pkgs/billing-mock-provider/server';
import {
  type CheckoutView,
  MOCK_BILLING_PAGE_API,
  type PortalAction,
  type PortalView,
} from '@pkgs/billing-mock-provider/shared';
import type { Timers } from '@pkgs/clock';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite/impl-bun-sqlite';

export const ORIGIN = 'http://billing.test';
export const SECRET_KEY = 'sk_test_mock_provider';
export const WEBHOOK_SECRET = 'whsec_mock_provider';
export const START_MS = Date.UTC(2026, 0, 31, 12);
export const DAY_S = 86_400;
export const RETURN_URL = 'https://app.test/more/billing';

/** Timers that never fire on their own: the test flushes deliveries. */
export const idleTimers: Timers = {
  setTimeout: () => 0,
  clearTimeout: () => undefined,
  setInterval: () => 0,
  clearInterval: () => undefined,
};

export type Received = { readonly headers: Headers; readonly rawBody: string };

/** One delivered webhook and what the adapter made of it. */
export type Delivered = {
  readonly event: MockEvent;
  readonly result: CallbackResult;
};

export async function openRig(offer: PlusMembershipOffer = CONTRACT_OFFER) {
  let nowMs = START_MS;
  let seq = 0;
  const received: Received[] = [];
  const sqlClient = SqlClientImplBunSqlite.openMemory();
  await sqlClient.connect();
  const provider = await createMockBillingProvider({
    sqlClient,
    clock: { now: () => nowMs },
    timers: idleTimers,
    createId: () => {
      seq += 1;
      return `id${String(seq).padStart(22, '0')}`;
    },
    fetch: async (_input, init) => {
      received.push({
        headers: new Headers(init?.headers),
        rawBody: String(init?.body),
      });
      return new Response('{"received":true}');
    },
    origin: ORIGIN,
    catalog: mockBillingCatalogFromOffer(offer),
    secretKey: SECRET_KEY,
    webhook: {
      url: 'https://app.test/api/billing/callback',
      secret: WEBHOOK_SECRET,
    },
  });
  const fetch = async (input: RequestInfo | URL, init?: RequestInit) =>
    await provider.app.fetch(new Request(String(input), init));
  const billing = new MockMembershipBilling({
    origin: ORIGIN,
    secretKey: SECRET_KEY,
    webhookSecret: WEBHOOK_SECRET,
    offer,
    now: () => nowMs,
    fetch,
  });
  const call = async (method: string, path: string, body?: unknown) => {
    const response = await fetch(`${ORIGIN}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${SECRET_KEY}`,
        'content-type': 'application/json',
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: (await response.json()) as never };
  };
  /** Every webhook delivered since the last drain, as the adapter read it. */
  const drain = async (): Promise<readonly Delivered[]> => {
    await provider.flushWebhooks();
    const out: Delivered[] = [];
    for (const delivery of received.splice(0)) {
      out.push({
        event: JSON.parse(delivery.rawBody) as MockEvent,
        result: await billing.readCallback(delivery),
      });
    }
    return out;
  };
  /** The adapter's reading of every webhook delivered since the last call. */
  const changes = async (): Promise<readonly MembershipChange[]> => {
    const out: MembershipChange[] = [];
    for (const { result } of await drain()) {
      expect(result.kind).not.toBe('unverified');
      if (result.kind === 'membership') out.push(result);
    }
    return out;
  };
  return {
    billing,
    call,
    changes,
    drain,
    received,
    fetch,
    advanceWallMs: (ms: number) => {
      nowMs += ms;
    },
  };
}

export type Rig = Awaited<ReturnType<typeof openRig>>;

export function sessionId(url: string): string {
  return url.split('/').at(-1) ?? '';
}

export async function page<T>(world: Rig, path: string, body?: unknown) {
  const response = await world.fetch(`${ORIGIN}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: (await response.json()) as T };
}

/** Checkout through the hosted page, as the person would. */
export async function subscribe(
  world: Rig,
  paymentMethod: string = MOCK_TEST_PAYMENT_METHODS.visa,
  lookupKey?: string
) {
  const checkout = await world.billing.startCheckout({
    accountId: 'acct-1',
    customerId: null,
    email: null,
    returnUrl: RETURN_URL,
  });
  const id = sessionId(checkout.url);
  const view = await page<CheckoutView>(
    world,
    MOCK_BILLING_PAGE_API.checkout(id)
  );
  const price =
    view.body.prices.find((candidate) => candidate.lookupKey === lookupKey) ??
    view.body.prices[0];
  const confirm = await page<{
    redirectUrl?: string;
    error?: { code: string };
  }>(world, MOCK_BILLING_PAGE_API.checkoutConfirm(id), {
    price: price?.id,
    paymentMethod,
  });
  return { customerId: checkout.customerId, sessionId: id, confirm };
}

export async function portal(world: Rig, customerId: string) {
  const { url } = await world.billing.openPortal({
    accountId: 'acct-1',
    customerId,
    returnUrl: RETURN_URL,
  });
  const id = sessionId(url);
  return {
    view: async () =>
      (await page<PortalView>(world, MOCK_BILLING_PAGE_API.portal(id))).body,
    act: (action: PortalAction) =>
      page<PortalView>(world, MOCK_BILLING_PAGE_API.portalAction(id), action),
  };
}

export async function advanceTo(
  world: Rig,
  customerId: string,
  frozenS: number
) {
  const result = await world.call(
    'POST',
    MOCK_BILLING_PATHS.advanceCustomerClock(customerId),
    { frozen_time: frozenS }
  );
  expect(result.status).toBe(200);
}

export async function subscriptionOf(world: Rig, customerId: string) {
  const list = await world.call(
    'GET',
    `${MOCK_BILLING_PATHS.subscriptions}?customer=${customerId}`
  );
  return (list.body as { data: MockSubscription[] })
    .data[0] as MockSubscription;
}

export const periodEndS = (subscription: MockSubscription) =>
  subscription.items.data[0]?.current_period_end ?? 0;

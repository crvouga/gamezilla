/**
 * Driving the sim's payment provider the way a tester drives Stripe in test
 * mode: through its REST API with the secret key — test clocks, test cards,
 * subscription updates, event resends. Never through the app: whatever
 * changes here reaches the app only as a signed webhook.
 */
import { EXTERNAL_ACCOUNT_PROVIDER_BILLING } from '@libs/auth/public/external-account-providers';
import { ExternalAccountRepository } from '@libs/auth/public/external-account-repository';
import type { SimBillingProvider } from '@libs/sim-harness/fabric/sim-billing';
import type { ProductSim } from '@libs/sim-harness/system/sim';
import {
  MOCK_BILLING_PATHS,
  MOCK_TEST_PAYMENT_METHODS,
  type MockEvent,
  type MockList,
  type MockSubscription,
  type MockTestPaymentMethod,
} from '@pkgs/billing-mock';

const DAY_S = 24 * 60 * 60;

/** A lifecycle transition, in the provider's test-mode vocabulary. */
export const BILLING_OBSERVE_KINDS = [
  'period_end',
  'payment_failed',
  'payment_recovered',
  'payment_retries_exhausted',
  'cancel_at_period_end',
  'resume',
  'cancel_now',
  'switch_interval',
  'redeliver_last_event',
] as const;

export type BillingObserveKind = (typeof BILLING_OBSERVE_KINDS)[number];

type Call = <T>(method: string, path: string, body?: unknown) => Promise<T>;

function providerOf(s: ProductSim): SimBillingProvider {
  const provider = s.sim.billing;
  if (provider === null) {
    throw new Error('billing: this sim composes no payment provider');
  }
  return provider;
}

export function providerCall(s: ProductSim): Call {
  const provider = providerOf(s);
  return async <T>(method: string, path: string, body?: unknown) => {
    const response = await provider.fetch(`${provider.origin}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${provider.secretKey}`,
        'content-type': 'application/json',
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const payload = (await response.json()) as unknown;
    if (!response.ok) {
      throw new Error(
        `billing provider ${method} ${path} → ${String(response.status)}: ${JSON.stringify(payload)}`
      );
    }
    return payload as T;
  };
}

/** The provider customer the app linked to this account at checkout. */
export async function customerOf(
  s: ProductSim,
  accountId: string
): Promise<string> {
  const customer = await new ExternalAccountRepository(
    s.sim.serverSql.sqlClient
  ).readExternalAccountId(accountId, EXTERNAL_ACCOUNT_PROVIDER_BILLING);
  if (customer === null)
    throw new Error(`billing: ${accountId} has no customer`);
  return customer;
}

async function latestSubscription(
  call: Call,
  customer: string
): Promise<MockSubscription> {
  const list = await call<MockList<MockSubscription>>(
    'GET',
    `${MOCK_BILLING_PATHS.subscriptions}?customer=${customer}`
  );
  const subscription = list.data[0];
  if (subscription === undefined) throw new Error('billing: no subscription');
  return subscription;
}

function periodEnd(subscription: MockSubscription): number {
  return subscription.items.data[0]?.current_period_end ?? 0;
}

async function useCard(
  call: Call,
  customer: string,
  card: MockTestPaymentMethod
): Promise<void> {
  await call('POST', MOCK_BILLING_PATHS.customer(customer), {
    invoice_settings: { default_payment_method: card },
  });
}

async function advanceTo(call: Call, customer: string, frozenS: number) {
  await call('POST', MOCK_BILLING_PATHS.advanceCustomerClock(customer), {
    frozen_time: frozenS,
  });
}

type Step = (call: Call, customer: string, s: ProductSim) => Promise<void>;

const STEPS: Readonly<Record<BillingObserveKind, Step>> = {
  period_end: async (call, customer) => {
    await advanceTo(
      call,
      customer,
      periodEnd(await latestSubscription(call, customer))
    );
  },
  payment_failed: async (call, customer) => {
    await useCard(call, customer, MOCK_TEST_PAYMENT_METHODS.chargeCustomerFail);
    await advanceTo(
      call,
      customer,
      periodEnd(await latestSubscription(call, customer))
    );
  },
  payment_recovered: async (call, customer) => {
    await useCard(call, customer, MOCK_TEST_PAYMENT_METHODS.visa);
    const invoice = (await latestSubscription(call, customer)).latest_invoice;
    if (invoice !== null)
      await call('POST', MOCK_BILLING_PATHS.invoicePay(invoice));
  },
  payment_retries_exhausted: async (call, customer) => {
    // Past the last retry of a failed renewal.
    const clock = await call<{ test_clock_frozen_time: number }>(
      'GET',
      MOCK_BILLING_PATHS.customer(customer)
    );
    await advanceTo(call, customer, clock.test_clock_frozen_time + 8 * DAY_S);
  },
  cancel_at_period_end: async (call, customer) => {
    const { id } = await latestSubscription(call, customer);
    await call('POST', MOCK_BILLING_PATHS.subscription(id), {
      cancel_at_period_end: true,
    });
  },
  resume: async (call, customer) => {
    const { id } = await latestSubscription(call, customer);
    await call('POST', MOCK_BILLING_PATHS.subscription(id), {
      cancel_at_period_end: false,
    });
  },
  cancel_now: async (call, customer) => {
    const { id } = await latestSubscription(call, customer);
    await call('DELETE', MOCK_BILLING_PATHS.subscription(id));
  },
  switch_interval: async (call, customer, s) => {
    const subscription = await latestSubscription(call, customer);
    const item = subscription.items.data[0];
    const offer = providerOf(s).offer;
    const target = offer.switchablePriceKeys
      .map((key) => offer.prices[key]?.lookupKey)
      .find((lookupKey) => lookupKey !== item?.price.lookup_key);
    if (item === undefined || target === undefined) {
      throw new Error('billing: no other interval to switch to');
    }
    const prices = await call<MockList<{ id: string }>>(
      'GET',
      `${MOCK_BILLING_PATHS.prices}?lookup_keys=${target}`
    );
    await call('POST', MOCK_BILLING_PATHS.subscription(subscription.id), {
      items: [{ id: item.id, price: prices.data[0]?.id }],
      proration_behavior: 'always_invoice',
    });
  },
  redeliver_last_event: async (call) => {
    const events = await call<MockList<MockEvent>>(
      'GET',
      `${MOCK_BILLING_PATHS.events}?type=customer.subscription.updated&limit=1`
    );
    const event = events.data[0];
    if (event !== undefined) {
      await call('POST', MOCK_BILLING_PATHS.resendEvent(event.id));
    }
  },
};

/** Runs one lifecycle transition at the provider for the account's customer. */
export async function driveProvider(
  s: ProductSim,
  accountId: string,
  kind: BillingObserveKind
): Promise<void> {
  await STEPS[kind](providerCall(s), await customerOf(s, accountId), s);
}

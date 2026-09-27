/**
 * Driving the sim's payment provider the way a tester drives any provider in
 * test mode: through its REST API with the secret key — test clocks, test cards,
 * subscription updates, event resends. Never through the app: whatever
 * changes here reaches the app only as a signed webhook.
 */
import { billingCustomerLinkProvider } from '@libs/auth/public/external-account-providers';
import { ExternalAccountRepository } from '@libs/auth/public/external-account-repository';
import type { SimBillingProvider } from '@libs/sim-harness/fabric/sim-billing';
import { letTimePass } from '@libs/sim-harness/system/actions';
import type { ProductSim } from '@libs/sim-harness/system/sim';
import {
  MOCK_BILLING_PATHS,
  MOCK_BILLING_PROVIDER,
  MOCK_TEST_PAYMENT_METHODS,
  type MockCustomer,
  type MockEvent,
  type MockInvoice,
  type MockList,
  type MockSubscription,
  type MockTestPaymentMethod,
} from '@pkgs/billing-mock';

const DAY_S = 24 * 60 * 60;

/** Provider statuses with nothing left to cancel. */
const ENDED_STATUSES: ReadonlySet<string> = new Set([
  'canceled',
  'unpaid',
  'incomplete_expired',
]);

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
  ).readExternalAccountId(
    accountId,
    billingCustomerLinkProvider(MOCK_BILLING_PROVIDER)
  );
  if (customer === null)
    throw new Error(`billing: ${accountId} has no customer`);
  return customer;
}

/**
 * Every subscription the provider holds for `customer`, newest first. Reading
 * settles the customer (due renewals and retries run), as the provider's API does.
 */
export async function providerSubscriptions(
  s: ProductSim,
  customer: string
): Promise<readonly MockSubscription[]> {
  const list = await providerCall(s)<MockList<MockSubscription>>(
    'GET',
    `${MOCK_BILLING_PATHS.subscriptions}?customer=${customer}&status=all&limit=100`
  );
  return list.data;
}

async function latestSubscription(
  call: Call,
  customer: string
): Promise<MockSubscription> {
  const list = await call<MockList<MockSubscription>>(
    'GET',
    `${MOCK_BILLING_PATHS.subscriptions}?customer=${customer}&status=all&limit=100`
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
    if (invoice !== null) {
      const id = typeof invoice === 'string' ? invoice : invoice.id;
      await call('POST', MOCK_BILLING_PATHS.invoicePay(id));
    }
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
      .map((key) => offer.prices[key]?.catalogPriceId)
      .find((catalogPriceId) => catalogPriceId !== item?.price.lookup_key);
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

/**
 * The provider's support staff refunds the customer's last payment and, as
 * the dashboard offers alongside, cancels the subscription at once.
 */
export async function refundLastPayment(
  s: ProductSim,
  accountId: string
): Promise<void> {
  const call = providerCall(s);
  const customer = await customerOf(s, accountId);
  const invoices = await call<MockList<MockInvoice>>(
    'GET',
    `${MOCK_BILLING_PATHS.invoices}?customer=${customer}&limit=100`
  );
  const paid = invoices.data.find(
    (invoice) => invoice.status === 'paid' && invoice.amount_paid > 0
  );
  if (paid === undefined) throw new Error('billing: no payment to refund');
  await call('POST', MOCK_BILLING_PATHS.refunds, { invoice: paid.id });
  const subscription = await latestSubscription(call, customer);
  if (!ENDED_STATUSES.has(subscription.status)) {
    await call('DELETE', MOCK_BILLING_PATHS.subscription(subscription.id));
  }
}

/** The customer's card on file passes its expiry date. */
export async function expireCardOnFile(
  s: ProductSim,
  accountId: string
): Promise<void> {
  const call = providerCall(s);
  const customer = await call<MockCustomer>(
    'GET',
    MOCK_BILLING_PATHS.customer(await customerOf(s, accountId))
  );
  const card = customer.invoice_settings.default_payment_method;
  if (card === null) throw new Error('billing: no card on file');
  await call('POST', MOCK_BILLING_PATHS.expirePaymentMethod(card));
}

/**
 * Time runs on for everyone — the device, the server and the provider — to
 * the end of the customer's current billing period, and the provider runs
 * what fell due. Unlike a test clock, the app sees the same date the provider
 * bills on, so what it does days after the end is what production does.
 */
export async function runOutBillingPeriod(
  s: ProductSim,
  accountId: string
): Promise<void> {
  const call = providerCall(s);
  const customer = await customerOf(s, accountId);
  const endS = periodEnd(await latestSubscription(call, customer));
  const clock = await call<{ test_clock_frozen_time: number }>(
    'GET',
    MOCK_BILLING_PATHS.customer(customer)
  );
  const gapMs = (endS - clock.test_clock_frozen_time) * 1000;
  if (gapMs > 0) await Promise.resolve(letTimePass.act(s, gapMs));
  // Reading the customer's subscriptions runs what fell due at the provider.
  await latestSubscription(call, customer);
}

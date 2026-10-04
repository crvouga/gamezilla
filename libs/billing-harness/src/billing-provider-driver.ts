/**
 * Driving the harness's payment provider the way a tester drives Stripe in
 * test mode: through its API with the secret key — the provider's clock, test
 * cards, subscription updates, refunds, event redelivery. Never through the
 * app: whatever changes here reaches the app only as a signed webhook.
 */
import { billingCustomerLinkProvider } from '@libs/auth-shared/external-account-providers';
import { ExternalAccountRepository } from '@libs/auth-shared/external-account-repository';
import type {
  HarnessBillingProvider,
  HarnessBillingProviders,
} from '@libs/harness/billing';
import { letTimePass } from '@libs/harness/actions';
import type { ProductHarness } from '@libs/harness/harness';
import type Stripe from 'stripe';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Provider statuses with nothing left to cancel. */
const ENDED_STATUSES: ReadonlySet<string> = new Set([
  'canceled',
  'unpaid',
  'incomplete_expired',
]);

/** Stripe's test cards, by what a charge on them does. */
const TEST_CARDS = {
  visa: 'pm_card_visa',
  /** Attaches to the customer; every charge on it declines. */
  chargeCustomerFail: 'pm_card_chargeCustomerFail',
  /** Every charge on it declines with `expired_card`. */
  expired: 'pm_card_chargeDeclinedExpiredCard',
} as const;

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

/** Every payment provider the harness has booted, and where checkouts go. */
export function billingProviders(s: ProductHarness): HarnessBillingProviders {
  const providers = s.harness.billing;
  if (providers === null) {
    throw new Error('billing: this harness composes no payment provider');
  }
  return providers;
}

/** The customer the app linked to this account at `provider`, if any. */
export async function customerAt(
  s: ProductHarness,
  accountId: string,
  provider: HarnessBillingProvider
): Promise<string | null> {
  return await new ExternalAccountRepository(
    s.harness.serverSql.sqlClient
  ).readExternalAccountId(accountId, billingCustomerLinkProvider(provider.id));
}

/**
 * Where the account's membership lives, as a tester looking at every
 * provider's dashboard sees it: the provider holding its membership that has
 * not ended; failing that, the provider new checkouts go to.
 */
export async function membershipProviderOf(
  s: ProductHarness,
  accountId: string
): Promise<HarnessBillingProvider> {
  const providers = billingProviders(s);
  for (const provider of providers.all()) {
    const customer = await customerAt(s, accountId, provider);
    if (customer === null) continue;
    const latest = (await providerSubscriptions(customer, provider))[0];
    if (latest !== undefined && !ENDED_STATUSES.has(latest.status)) {
      return provider;
    }
  }
  return providers.checkout();
}

/**
 * The provider customer the app linked to this account — at `provider`, or
 * where its membership lives.
 */
export async function customerOf(
  s: ProductHarness,
  accountId: string,
  provider?: HarnessBillingProvider
): Promise<string> {
  const at = provider ?? (await membershipProviderOf(s, accountId));
  const customer = await customerAt(s, accountId, at);
  if (customer === null) {
    throw new Error(`billing: ${accountId} has no customer at ${at.id}`);
  }
  return customer;
}

/**
 * Every subscription `provider` holds for `customer`, newest first. Reading
 * runs whatever fell due at the provider, as any request to it does.
 */
export async function providerSubscriptions(
  customer: string,
  provider: HarnessBillingProvider
): Promise<readonly Stripe.Subscription[]> {
  const list = await provider.stripe.subscriptions.list({
    customer,
    status: 'all',
    limit: 100,
  });
  return list.data;
}

/** The account's subscriptions at every provider it is a customer of. */
export async function subscriptionsEverywhere(
  s: ProductHarness,
  accountId: string
): Promise<
  readonly {
    readonly provider: HarnessBillingProvider;
    readonly subscriptions: readonly Stripe.Subscription[];
  }[]
> {
  const found = [];
  for (const provider of billingProviders(s).all()) {
    const customer = await customerAt(s, accountId, provider);
    if (customer === null) continue;
    found.push({
      provider,
      subscriptions: await providerSubscriptions(customer, provider),
    });
  }
  return found;
}

/** The provider holding the account's membership, and its customer there. */
type At = {
  readonly provider: HarnessBillingProvider;
  readonly stripe: Stripe;
  readonly customer: string;
};

async function latestSubscription(at: At): Promise<Stripe.Subscription> {
  const subscription = (
    await providerSubscriptions(at.customer, at.provider)
  )[0];
  if (subscription === undefined) throw new Error('billing: no subscription');
  return subscription;
}

/** When the subscription's current period ends, in ms. */
function periodEndMs(subscription: Stripe.Subscription): number {
  return (subscription.items.data[0]?.current_period_end ?? 0) * 1000;
}

/**
 * The customer's card on file becomes test card `card`: attached, and the
 * default for the customer and for their subscription (checkout set the
 * subscription's own default, which wins over the customer's).
 */
async function useCard(at: At, card: string): Promise<void> {
  const method = await at.stripe.paymentMethods.attach(card, {
    customer: at.customer,
  });
  await at.stripe.customers.update(at.customer, {
    invoice_settings: { default_payment_method: method.id },
  });
  const subscription = await latestSubscription(at);
  await at.stripe.subscriptions.update(subscription.id, {
    default_payment_method: method.id,
  });
}

/** Run the provider's clock — not the app's — to `ms`, and what fell due. */
async function runProviderClockTo(at: At, ms: number): Promise<void> {
  const ahead = ms - at.provider.now();
  if (ahead > 0) await at.provider.advanceClock(ahead);
}

/** Past the end of the current period: the renewal (or the ending) runs. */
async function runOutPeriodAtProvider(at: At): Promise<void> {
  await runProviderClockTo(
    at,
    periodEndMs(await latestSubscription(at)) + 1000
  );
}

type Step = (at: At) => Promise<void>;

const STEPS: Readonly<Record<BillingObserveKind, Step>> = {
  period_end: runOutPeriodAtProvider,
  payment_failed: async (at) => {
    await useCard(at, TEST_CARDS.chargeCustomerFail);
    await runOutPeriodAtProvider(at);
  },
  payment_recovered: async (at) => {
    await useCard(at, TEST_CARDS.visa);
    const invoice = (await latestSubscription(at)).latest_invoice;
    const id = typeof invoice === 'string' ? invoice : invoice?.id;
    if (id !== undefined) await at.stripe.invoices.pay(id);
  },
  payment_retries_exhausted: async (at) => {
    // Past the last retry of a failed renewal (Stripe retries for up to a
    // week), with the account set to cancel the subscription once every retry
    // failed. The Stripe mock runs no retries yet
    // (https://github.com/crvouga/mockingbird/issues/161), so after the week the
    // cancellation that setting makes is made here.
    await runProviderClockTo(at, at.provider.now() + 8 * DAY_MS);
    const subscription = await latestSubscription(at);
    if (!ENDED_STATUSES.has(subscription.status)) {
      await at.stripe.subscriptions.cancel(subscription.id);
    }
  },
  cancel_at_period_end: async (at) => {
    const { id } = await latestSubscription(at);
    await at.stripe.subscriptions.update(id, { cancel_at_period_end: true });
  },
  resume: async (at) => {
    const { id } = await latestSubscription(at);
    await at.stripe.subscriptions.update(id, { cancel_at_period_end: false });
  },
  cancel_now: async (at) => {
    const { id } = await latestSubscription(at);
    await at.stripe.subscriptions.cancel(id);
  },
  switch_interval: async (at) => {
    const subscription = await latestSubscription(at);
    const item = subscription.items.data[0];
    const offer = at.provider.offer;
    const target = offer.switchablePriceKeys
      .map((key) => offer.prices[key]?.catalogPriceId)
      .find((lookupKey) => lookupKey !== item?.price.lookup_key);
    if (item === undefined || target === undefined) {
      throw new Error('billing: no other interval to switch to');
    }
    const prices = await at.stripe.prices.list({
      lookup_keys: [target],
      limit: 1,
    });
    const price = prices.data[0]?.id;
    if (price === undefined) throw new Error(`billing: no price ${target}`);
    await at.stripe.subscriptions.update(subscription.id, {
      items: [{ id: item.id, price }],
      proration_behavior: 'always_invoice',
    });
  },
  redeliver_last_event: async (at) => {
    const events = await at.stripe.events.list({
      type: 'customer.subscription.updated',
      limit: 1,
    });
    const event = events.data[0];
    if (event !== undefined) at.provider.resendEvent(event.id);
  },
};

/** The provider holding the account's membership, its API and customer. */
async function atMembershipProvider(
  s: ProductHarness,
  accountId: string
): Promise<At> {
  const provider = await membershipProviderOf(s, accountId);
  return {
    provider,
    stripe: provider.stripe,
    customer: await customerOf(s, accountId, provider),
  };
}

/** Runs one lifecycle transition at the provider for the account's customer. */
export async function driveProvider(
  s: ProductHarness,
  accountId: string,
  kind: BillingObserveKind
): Promise<void> {
  await STEPS[kind](await atMembershipProvider(s, accountId));
}

/**
 * The provider's support staff refunds the customer's last payment and, as
 * the dashboard offers alongside, cancels the subscription at once.
 */
export async function refundLastPayment(
  s: ProductHarness,
  accountId: string
): Promise<void> {
  const at = await atMembershipProvider(s, accountId);
  const intents = await at.stripe.paymentIntents.list({
    customer: at.customer,
    limit: 100,
  });
  const paid = intents.data.find(
    (intent) => intent.status === 'succeeded' && intent.amount_received > 0
  );
  if (paid === undefined) throw new Error('billing: no payment to refund');
  await at.stripe.refunds.create({ payment_intent: paid.id });
  const subscription = await latestSubscription(at);
  if (!ENDED_STATUSES.has(subscription.status)) {
    await at.stripe.subscriptions.cancel(subscription.id);
  }
}

/**
 * The customer's card on file expires: from now on every charge on it
 * declines with `expired_card`, as Stripe's expired test card does.
 */
export async function expireCardOnFile(
  s: ProductHarness,
  accountId: string
): Promise<void> {
  await useCard(await atMembershipProvider(s, accountId), TEST_CARDS.expired);
}

/**
 * Time runs on for everyone — the device, the server and the provider — to
 * `leftMs` before the end of the customer's current billing period, and the
 * provider runs what fell due. Unlike the provider's clock alone, the app sees
 * the same date the provider bills on, so what it does days after the end is
 * what production does.
 */
export async function runBillingPeriodOn(
  s: ProductHarness,
  accountId: string,
  leftMs: number
): Promise<void> {
  const at = await atMembershipProvider(s, accountId);
  const endMs = periodEndMs(await latestSubscription(at));
  const gapMs = endMs - at.provider.now() - leftMs;
  if (gapMs > 0) await Promise.resolve(letTimePass.act(s, gapMs));
  // Reading the customer's subscriptions runs what fell due at the provider.
  await latestSubscription(at);
}

/** Time runs on for everyone to the end of the current billing period. */
export async function runOutBillingPeriod(
  s: ProductHarness,
  accountId: string
): Promise<void> {
  await runBillingPeriodOn(s, accountId, 0);
}

/** When the provider ends the customer's free trial, in ms, or `null`. */
export async function providerTrialEndMs(
  s: ProductHarness,
  accountId: string
): Promise<number | null> {
  const { trial_end } = await latestSubscription(
    await atMembershipProvider(s, accountId)
  );
  return trial_end === null ? null : trial_end * 1000;
}

/** Which earlier news a provider repeats about a customer's memberships. */
export type EarlierNews = {
  /** The news `back` pieces before its latest (0 = the latest; clamped). */
  readonly back: number;
};

function aboutCustomer(event: Stripe.Event, customer: string): boolean {
  if (!event.type.startsWith('customer.subscription.')) return false;
  const object = event.data.object as { readonly customer?: unknown };
  return object.customer === customer;
}

/**
 * The provider `providerId` delivers again one piece of news it already sent
 * about the account's memberships there, exactly as it sent it then — late,
 * and possibly stale. Nothing happens when it has no such news.
 */
export async function repeatEarlierNews(
  s: ProductHarness,
  accountId: string,
  providerId: string,
  news: EarlierNews
): Promise<void> {
  const provider = billingProviders(s).get(providerId);
  if (provider === undefined) {
    throw new Error(`billing: no payment provider ${providerId}`);
  }
  const customer = await customerAt(s, accountId, provider);
  if (customer === null) return;
  const events = (
    await provider.stripe.events.list({ limit: 100 })
  ).data.filter((event) => aboutCustomer(event, customer));
  const event = events[Math.min(news.back, events.length - 1)];
  if (event === undefined) return;
  provider.resendEvent(event.id);
}

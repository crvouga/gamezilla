import { paidCheckoutReturnUrl } from '@pkgs/billing-root-shared/checkout-return';
import type {
  CallbackResult,
  Membership,
  MembershipBilling,
  MembershipChange,
  OpenPortalInput,
  ReadCallbackInput,
  StartCheckoutInput,
  StartCheckoutResult,
} from '@pkgs/billing-root-shared/membership';
import type { PlusMembershipOffer } from '@pkgs/billing-root-shared/offer';
import { STRIPE_MEMBERSHIP_CALLBACK_EVENTS } from '@pkgs/billing-stripe-shared/callback-events';
import { membershipStatusOf } from '@pkgs/billing-stripe-shared/membership-status';
import {
  STRIPE_PORTAL_CONFIGURATION_ID,
  STRIPE_PORTAL_CONFIGURATION_METADATA_KEY,
} from '@pkgs/billing-stripe-shared/offer-reconcile';
import Stripe from 'stripe';

/** The adapter's id: it keys stored data, so it never changes. */
export const STRIPE_PROVIDER = 'stripe';

/**
 * Where the Stripe client points. Production omits it (real Stripe); harnesses and
 * the localhost stack can point it at a loopback origin.
 */
export type StripeMembershipTransport = {
  /** Omitted: Stripe's own API origin. */
  readonly origin?: string;
  readonly fetch?: (
    input: RequestInfo | URL,
    init?: RequestInit
  ) => Promise<Response>;
};

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === 'object'
    ? (value as UnknownRecord)
    : null;
}

function readString(record: UnknownRecord, key: string): string | null {
  const value = record[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readBoolean(record: UnknownRecord, key: string): boolean {
  return record[key] === true;
}

function readNumber(record: UnknownRecord | null, key: string): number | null {
  if (record === null) return null;
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** A field holding an id, or the expanded object when a caller expanded it. */
function readId(record: UnknownRecord, key: string): string | null {
  const value = record[key];
  if (typeof value === 'string') return value.length > 0 ? value : null;
  const expanded = asRecord(value);
  return expanded === null ? null : readString(expanded, 'id');
}

function firstItem(subscription: UnknownRecord): UnknownRecord | null {
  const items = asRecord(subscription['items']);
  return Array.isArray(items?.['data']) ? asRecord(items['data'][0]) : null;
}

/** Reads whichever of the (API-version dependent) period-end fields exists. */
function readPeriodEndMs(subscription: UnknownRecord): number | null {
  const seconds =
    readNumber(firstItem(subscription), 'current_period_end') ??
    readNumber(subscription, 'current_period_end');
  return seconds === null ? null : seconds * 1000;
}

/** Which of our offer prices the subscription's first item is charged at. */
function readOfferPriceKey(
  subscription: UnknownRecord,
  offer: PlusMembershipOffer
): string | null {
  const price = asRecord(firstItem(subscription)?.['price']);
  const catalogPriceId =
    price === null ? null : readString(price, 'lookup_key');
  if (catalogPriceId === null) return null;
  for (const [key, spec] of Object.entries(offer.prices)) {
    if (spec.catalogPriceId === catalogPriceId) return key;
  }
  return null;
}

/**
 * When access runs out. A subscription canceled immediately keeps its
 * `current_period_end` in the future, so an ended one ends at `ended_at` when
 * that came first — the paid period it lost is not a period it still has.
 */
function accessEndMs(
  subscription: UnknownRecord,
  ended: boolean
): number | null {
  const periodEndMs = readPeriodEndMs(subscription);
  const endedAtS = readNumber(subscription, 'ended_at');
  if (!ended || endedAtS === null) return periodEndMs;
  const endedAtMs = endedAtS * 1000;
  return periodEndMs === null ? endedAtMs : Math.min(periodEndMs, endedAtMs);
}

/**
 * Stripe's customer balance is negative when the customer has credit. The
 * port's credit is that amount in cents, and never below nothing. A payload
 * that is not a customer (or has no balance) is unread.
 */
function creditCentsFromCustomer(
  record: UnknownRecord | null
): number | undefined {
  if (record === null || record['object'] !== 'customer') return undefined;
  if (record['deleted'] === true) return 0;
  const balance = readNumber(record, 'balance');
  if (balance === null) return undefined;
  return Math.max(0, -Math.trunc(balance));
}

function toMembership(
  subscription: UnknownRecord,
  forcedEnded: boolean
): Membership {
  const status = forcedEnded
    ? 'ended'
    : membershipStatusOf(readString(subscription, 'status') ?? '');
  return {
    status,
    periodEndMs: accessEndMs(subscription, status === 'ended'),
    endsAtPeriodEnd:
      status !== 'ended' && readBoolean(subscription, 'cancel_at_period_end'),
  };
}

/**
 * Stripe adapter for the membership port. The only file that knows a Stripe
 * status name, event name or price lookup key.
 */
export class StripeMembershipBilling implements MembershipBilling {
  async cancelMembership(subscriptionId: string): Promise<void> {
    const subscription = await this.current(subscriptionId);
    if (
      subscription === null ||
      readString(subscription, 'status') === 'canceled'
    )
      return;
    await this.stripe.subscriptions.cancel(subscriptionId, {
      invoice_now: false,
      prorate: false,
    });
  }

  async readPayments(customerId: string) {
    const payments = [];
    for await (const charge of this.stripe.charges.list({
      customer: customerId,
      limit: 100,
    })) {
      if (!charge.paid || !charge.captured) continue;
      payments.push({
        id: charge.id,
        paidAtMs: charge.created * 1_000,
        amountMinor: charge.amount_captured,
        currency: charge.currency,
        refundedMinor: charge.amount_refunded,
      });
    }
    return payments;
  }

  async refundPayment(paymentId: string): Promise<void> {
    const charge = await this.stripe.charges.retrieve(paymentId);
    if (charge.amount_refunded >= charge.amount_captured) return;
    await this.stripe.refunds.create(
      {
        charge: paymentId,
        amount: charge.amount_captured - charge.amount_refunded,
      },
      { idempotencyKey: `account-deletion:${paymentId}` }
    );
  }
  private readonly stripe: Stripe;
  private readonly offer: PlusMembershipOffer;
  private readonly webhookSecret: string | null;
  private readonly now: () => number;
  /**
   * The id the app knows this Stripe account by. A deployment moving to a
   * second Stripe account runs it beside the first under an id of its own.
   */
  readonly provider: string;

  constructor(options: {
    readonly stripe: Stripe;
    readonly offer: PlusMembershipOffer;
    readonly webhookSecret: string | null;
    readonly now: () => number;
    /** Defaults to {@link STRIPE_PROVIDER}. */
    readonly provider?: string;
  }) {
    this.stripe = options.stripe;
    this.offer = options.offer;
    this.webhookSecret = options.webhookSecret;
    this.now = options.now;
    this.provider = options.provider ?? STRIPE_PROVIDER;
  }

  async startCheckout(input: StartCheckoutInput): Promise<StartCheckoutResult> {
    const customer =
      input.customerId ??
      (
        await this.stripe.customers.create({
          ...(input.email === null ? {} : { email: input.email }),
          metadata: { accountId: input.accountId },
        })
      ).id;

    const spec = this.offer.prices[this.offer.defaultPriceKey];
    if (spec === undefined) {
      throw new Error(
        `stripe: no offer price for key ${this.offer.defaultPriceKey}`
      );
    }
    const prices = await this.stripe.prices.list({
      lookup_keys: [spec.catalogPriceId],
      active: true,
      limit: 1,
    });
    const price = prices.data[0];
    if (price === undefined) {
      throw new Error(
        `stripe: no active price for lookup key ${spec.catalogPriceId}`
      );
    }

    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer,
      client_reference_id: input.accountId,
      // Subscriptions do not inherit customer metadata, so the account link
      // has to ride on the subscription itself.
      subscription_data: {
        metadata: { accountId: input.accountId },
        // Checkout ignores a price's own trial unless the session asks for one.
        ...((spec.trialPeriodDays ?? 0) > 0
          ? { trial_period_days: spec.trialPeriodDays }
          : {}),
      },
      line_items: [{ price: price.id, quantity: 1 }],
      // Only a paid return is marked, so the app can tell the two apart.
      success_url: paidCheckoutReturnUrl(input.returnUrl),
      cancel_url: input.returnUrl,
    });
    return { customerId: customer, url: session.url ?? '' };
  }

  async openPortal(input: OpenPortalInput): Promise<{ readonly url: string }> {
    const configuration = await this.portalConfiguration();
    const portal = await this.stripe.billingPortal.sessions.create({
      customer: input.customerId,
      return_url: input.returnUrl,
      ...(configuration === null ? {} : { configuration }),
    });
    return { url: portal.url ?? '' };
  }

  private portalConfigurationId: string | null = null;

  /**
   * The portal configuration the offer reconcile manages. A session without
   * one opens the account's dashboard default, which the reconcile cannot
   * set; `null` (not reconciled yet) falls back to that default.
   */
  private async portalConfiguration(): Promise<string | null> {
    if (this.portalConfigurationId !== null) return this.portalConfigurationId;
    const listed = await this.stripe.billingPortal.configurations.list({
      active: true,
      limit: 100,
    });
    const ours = listed.data.find(
      (configuration) =>
        configuration.metadata?.[STRIPE_PORTAL_CONFIGURATION_METADATA_KEY] ===
        STRIPE_PORTAL_CONFIGURATION_ID
    );
    this.portalConfigurationId = ours?.id ?? null;
    return this.portalConfigurationId;
  }

  /**
   * The subscription as Stripe reports it now. One Stripe does not know
   * (`resource_missing`) is nothing to project; any other failure throws so
   * the delivery is retried.
   */
  private async current(id: string): Promise<UnknownRecord | null> {
    try {
      return asRecord(await this.stripe.subscriptions.retrieve(id));
    } catch (error) {
      if (
        error instanceof Stripe.errors.StripeInvalidRequestError &&
        error.statusCode === 404
      ) {
        return null;
      }
      throw error;
    }
  }

  /** Whether every payment of an invoice that was paid has gone back. */
  private async invoiceRefunded(invoiceId: string): Promise<boolean> {
    const payments = await this.stripe.invoicePayments.list({
      invoice: invoiceId,
      limit: 10,
    });
    const paid = payments.data.filter(
      (payment) =>
        payment.status === 'paid' &&
        payment.amount_paid !== null &&
        payment.amount_paid > 0 &&
        payment.payment.type === 'payment_intent'
    );
    if (paid.length === 0) return false;
    for (const payment of paid) {
      const intent = payment.payment.payment_intent;
      const intentId = typeof intent === 'string' ? intent : intent?.id;
      if (intentId === undefined) return false;
      const charge = asRecord(
        (
          await this.stripe.paymentIntents.retrieve(intentId, {
            expand: ['latest_charge'],
          })
        ).latest_charge
      );
      const amount = readNumber(charge, 'amount');
      const refundedAmount = readNumber(charge, 'amount_refunded');
      if (amount === null || refundedAmount === null) return false;
      if (refundedAmount < amount) return false;
    }
    return true;
  }

  /**
   * The subscription a charge paid for: the invoice its PaymentIntent paid
   * (`invoice_payments`, since `basil` the only link from a payment to its
   * invoice), and that invoice's subscription.
   */
  private async subscriptionPaidBy(
    charge: UnknownRecord
  ): Promise<string | null> {
    const intentId = readId(charge, 'payment_intent');
    if (intentId === null) return null;
    const payments = await this.stripe.invoicePayments.list({
      payment: { type: 'payment_intent', payment_intent: intentId },
      limit: 1,
    });
    const invoiceId = payments.data[0]?.invoice;
    const id = typeof invoiceId === 'string' ? invoiceId : invoiceId?.id;
    if (id === undefined) return null;
    const invoice = await this.stripe.invoices.retrieve(id);
    const subscription = invoice.parent?.subscription_details?.subscription;
    if (subscription === undefined || subscription === null) return null;
    return typeof subscription === 'string' ? subscription : subscription.id;
  }

  /** The subscription an event is about, or `null` when it is about none. */
  private async subscriptionIdOf(event: Stripe.Event): Promise<string | null> {
    const object = asRecord(event.data.object);
    if (object === null) return null;
    if (event.type === 'charge.refunded') {
      return await this.subscriptionPaidBy(object);
    }
    return readString(object, 'id');
  }

  async readCallback(input: ReadCallbackInput): Promise<CallbackResult> {
    if (this.webhookSecret === null) return { kind: 'unverified' };
    const signature = input.headers.get('stripe-signature');
    if (signature === null) return { kind: 'unverified' };

    let event: Stripe.Event;
    try {
      // The 6th argument is the timestamp the tolerance window is measured
      // against; passing the injected clock keeps virtual-time harnesses verifiable.
      event = await this.stripe.webhooks.constructEventAsync(
        input.rawBody,
        signature,
        this.webhookSecret,
        undefined,
        undefined,
        this.now()
      );
    } catch {
      return { kind: 'unverified' };
    }

    if (STRIPE_MEMBERSHIP_CALLBACK_EVENTS[event.type] !== true) {
      return { kind: 'ignored' };
    }
    if (event.type === 'charge.succeeded') {
      const charge = asRecord(event.data.object);
      const customerId = charge === null ? null : readId(charge, 'customer');
      return customerId === null
        ? { kind: 'ignored' }
        : { kind: 'payments', provider: this.provider, customerId };
    }
    const id = await this.subscriptionIdOf(event);
    if (id === null) return { kind: 'ignored' };
    // Stripe delivers duplicates and out of order; the payload is a snapshot
    // from whenever the event fired. Re-read so every delivery reports now;
    // a deletion is final, whatever a lagging read still says.
    const subscription = await this.current(id);
    if (subscription === null) return { kind: 'ignored' };
    const customerId = readId(subscription, 'customer');
    if (customerId === null) return { kind: 'ignored' };

    const creditCents = await this.creditCentsOf(customerId);
    const change: MembershipChange = {
      provider: this.provider,
      customerId,
      subscriptionId: id,
      offerPriceKey: readOfferPriceKey(subscription, this.offer),
      membership: await this.membershipOf(
        subscription,
        event.type === 'customer.subscription.deleted'
      ),
      ...(creditCents === undefined ? {} : { creditCents }),
    };
    return { kind: 'membership', ...change };
  }

  /**
   * Credit on the customer now. A customer Stripe does not know leaves the
   * stored credit alone; any other failure throws so the delivery is retried.
   */
  private async creditCentsOf(customerId: string): Promise<number | undefined> {
    try {
      return creditCentsFromCustomer(
        asRecord(await this.stripe.customers.retrieve(customerId))
      );
    } catch (error) {
      if (
        error instanceof Stripe.errors.StripeInvalidRequestError &&
        error.statusCode === 404
      ) {
        return undefined;
      }
      throw error;
    }
  }

  /**
   * The membership a subscription grants. One that ended after its last
   * payment was refunded in full has no paid time left — not even grace:
   * they have their money back.
   */
  private async membershipOf(
    subscription: UnknownRecord,
    deleted: boolean
  ): Promise<Membership> {
    const membership = toMembership(subscription, deleted);
    if (membership.status !== 'ended') return membership;
    const latestInvoice = readId(subscription, 'latest_invoice');
    if (latestInvoice === null) return membership;
    if (!(await this.invoiceRefunded(latestInvoice))) return membership;
    return { status: 'ended', periodEndMs: null, endsAtPeriodEnd: false };
  }
}

/** Stripe client config derived from a provider origin. */
function stripeClientConfig(
  transport: StripeMembershipTransport | undefined
): Pick<Stripe.StripeConfig, 'host' | 'port' | 'protocol'> {
  if (transport?.origin === undefined) return {};
  const url = new URL(transport.origin);
  const port =
    url.port === '' ? (url.protocol === 'https:' ? 443 : 80) : Number(url.port);
  return {
    host: url.hostname,
    port,
    protocol: url.protocol === 'https:' ? 'https' : 'http',
  };
}

/** A Stripe API client over `transport` (Stripe itself when omitted). */
export function createStripeClient(
  secretKey: string,
  transport?: StripeMembershipTransport
): Stripe {
  return new Stripe(secretKey, {
    httpClient: Stripe.createFetchHttpClient(transport?.fetch),
    ...stripeClientConfig(transport),
  });
}

export function createStripeMembershipBilling(args: {
  readonly secretKey: string;
  readonly webhookSecret: string | null;
  readonly offer: PlusMembershipOffer;
  readonly now: () => number;
  readonly transport?: StripeMembershipTransport;
  /** Defaults to {@link STRIPE_PROVIDER}. */
  readonly provider?: string;
}): StripeMembershipBilling {
  return new StripeMembershipBilling({
    stripe: createStripeClient(args.secretKey, args.transport),
    offer: args.offer,
    webhookSecret: args.webhookSecret,
    now: args.now,
    ...(args.provider === undefined ? {} : { provider: args.provider }),
  });
}

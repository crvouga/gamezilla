import { paidCheckoutReturnUrl } from '@pkgs/billing-root-shared-ts/checkout-return';
import type {
  CallbackResult,
  Membership,
  MembershipBilling,
  MembershipChange,
  OpenPortalInput,
  ReadCallbackInput,
  StartCheckoutInput,
  StartCheckoutResult,
} from '@pkgs/billing-root-shared-ts/membership';
import type { PlusMembershipOffer } from '@pkgs/billing-root-shared-ts/offer';
import { STRIPE_MEMBERSHIP_CALLBACK_EVENTS } from '@pkgs/billing-stripe-shared-ts/callback-events';
import {
  STRIPE_PORTAL_CONFIGURATION_ID,
  STRIPE_PORTAL_CONFIGURATION_METADATA_KEY,
} from '@pkgs/billing-stripe-shared-ts/offer-reconcile';
import Stripe from 'stripe';
import {
  liveStripeSubscription,
  reusableStripeCheckout,
} from './stripe-checkout-reuse';
import type { UnknownRecord } from './stripe-subscription-fields';
import {
  asRecord,
  creditCentsFromCustomer,
  readId,
  readNumber,
  readOfferPriceKey,
  readString,
  toMembership,
} from './stripe-subscription-fields';

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
    if (input.customerId !== null) {
      const customerId = input.customerId;
      const live = await liveStripeSubscription(this.stripe, customerId);
      const change = live === null ? null : await this.changeOf(live, false);
      if (change !== null) {
        return { kind: 'live_membership', customerId, change };
      }
      const url = await reusableStripeCheckout(this.stripe, {
        customer: customerId,
        returnUrl: input.returnUrl,
        nowMs: this.now(),
      });
      if (url !== null) return { kind: 'checkout', customerId, url };
    }
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
    return { kind: 'checkout', customerId: customer, url: session.url ?? '' };
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
    const change = await this.changeOf(
      subscription,
      event.type === 'customer.subscription.deleted'
    );
    return change === null
      ? { kind: 'ignored' }
      : { kind: 'membership', ...change };
  }

  async readMembership(subscriptionId: string) {
    const subscription = await this.current(subscriptionId);
    return subscription === null
      ? null
      : await this.changeOf(subscription, false);
  }

  /**
   * What a subscription as Stripe reports it now means for the membership —
   * the one reading every callback, re-check and checkout shares. `null`
   * when it names no customer.
   */
  private async changeOf(
    subscription: UnknownRecord,
    deleted: boolean
  ): Promise<MembershipChange | null> {
    const subscriptionId = readString(subscription, 'id');
    const customerId = readId(subscription, 'customer');
    if (subscriptionId === null || customerId === null) return null;
    const creditCents = await this.creditCentsOf(customerId);
    return {
      provider: this.provider,
      customerId,
      subscriptionId,
      offerPriceKey: readOfferPriceKey(subscription, this.offer),
      membership: await this.membershipOf(subscription, deleted),
      ...(creditCents === undefined ? {} : { creditCents }),
    };
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

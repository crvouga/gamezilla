import type {
  CallbackResult,
  Membership,
  MembershipBilling,
  MembershipChange,
  OpenPortalInput,
  PlusMembershipOffer,
  ReadCallbackInput,
  StartCheckoutInput,
  StartCheckoutResult,
} from '@pkgs/billing';
import Stripe from 'stripe';

import { STRIPE_MEMBERSHIP_CALLBACK_EVENTS } from './callback-events';
import { membershipStatusOf } from './membership-status';

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

/** `customer` is an id, or the expanded object when a caller expanded it. */
function readCustomerId(subscription: UnknownRecord): string | null {
  const customer = subscription['customer'];
  if (typeof customer === 'string')
    return customer.length > 0 ? customer : null;
  const expanded = asRecord(customer);
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
  readonly provider = STRIPE_PROVIDER;

  constructor(
    private readonly stripe: Stripe,
    private readonly offer: PlusMembershipOffer,
    private readonly webhookSecret: string | null,
    private readonly now: () => number
  ) {}

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
      success_url: input.returnUrl,
      cancel_url: input.returnUrl,
    });
    return { customerId: customer, url: session.url ?? '' };
  }

  async openPortal(input: OpenPortalInput): Promise<{ readonly url: string }> {
    const portal = await this.stripe.billingPortal.sessions.create({
      customer: input.customerId,
      return_url: input.returnUrl,
    });
    return { url: portal.url ?? '' };
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
    const snapshot = asRecord(event.data.object);
    const id = snapshot === null ? null : readString(snapshot, 'id');
    if (id === null) return { kind: 'ignored' };
    // Stripe delivers duplicates and out of order; the payload is a snapshot
    // from whenever the event fired. Re-read so every delivery reports now;
    // a deletion is final, whatever a lagging read still says.
    const subscription = await this.current(id);
    if (subscription === null) return { kind: 'ignored' };
    const customerId = readCustomerId(subscription);
    if (customerId === null) return { kind: 'ignored' };

    const change: MembershipChange = {
      provider: this.provider,
      customerId,
      subscriptionId: id,
      offerPriceKey: readOfferPriceKey(subscription, this.offer),
      membership: toMembership(
        subscription,
        event.type === 'customer.subscription.deleted'
      ),
    };
    return { kind: 'membership', ...change };
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
}): StripeMembershipBilling {
  return new StripeMembershipBilling(
    createStripeClient(args.secretKey, args.transport),
    args.offer,
    args.webhookSecret,
    args.now
  );
}

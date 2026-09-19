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
import type { SecretStore } from '@pkgs/secret-store';
import Stripe from 'stripe';

import { STRIPE_MEMBERSHIP_CALLBACK_EVENTS } from './callback-events';
import { membershipStatusOf } from './membership-status';
import { StripeSecretKeys } from './secret-keys';

/**
 * Where the Stripe client points. Production omits it (real Stripe); sims and
 * the localhost stack can point it at a loopback origin.
 */
export type StripeMembershipTransport = {
  readonly origin: string;
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
  const lookupKey = price === null ? null : readString(price, 'lookup_key');
  if (lookupKey === null) return null;
  for (const [key, spec] of Object.entries(offer.prices)) {
    if (spec.lookupKey === lookupKey) return key;
  }
  return null;
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
    periodEndMs: readPeriodEndMs(subscription),
    endsAtPeriodEnd: readBoolean(subscription, 'cancel_at_period_end'),
  };
}

/**
 * Stripe adapter for the membership port. The only file that knows a Stripe
 * status name, event name or price lookup key.
 */
export class StripeMembershipBilling implements MembershipBilling {
  constructor(
    readonly stripe: Stripe,
    private readonly offer: PlusMembershipOffer,
    private readonly webhookSecret: string | null,
    private readonly now: () => number
  ) {}

  async startCheckout(input: StartCheckoutInput): Promise<StartCheckoutResult> {
    const customer =
      input.customerId ??
      (
        await this.stripe.customers.create({
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
      lookup_keys: [spec.lookupKey],
      active: true,
      limit: 1,
    });
    const price = prices.data[0];
    if (price === undefined) {
      throw new Error(
        `stripe: no active price for lookup key ${spec.lookupKey}`
      );
    }

    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer,
      client_reference_id: input.accountId,
      // Subscriptions do not inherit customer metadata, so the account link
      // has to ride on the subscription itself.
      subscription_data: { metadata: { accountId: input.accountId } },
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

  async readCallback(input: ReadCallbackInput): Promise<CallbackResult> {
    if (this.webhookSecret === null) return { kind: 'unverified' };
    const signature = input.headers.get('stripe-signature');
    if (signature === null) return { kind: 'unverified' };

    let event: Stripe.Event;
    try {
      // The 6th argument is the timestamp the tolerance window is measured
      // against; passing the injected clock keeps virtual-time sims verifiable.
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
    const subscription = asRecord(event.data.object);
    if (subscription === null) return { kind: 'ignored' };
    const customerId = readString(subscription, 'customer');
    const subscriptionId = readString(subscription, 'id');
    if (customerId === null || subscriptionId === null) {
      return { kind: 'ignored' };
    }

    const change: MembershipChange = {
      provider: 'stripe',
      customerId,
      subscriptionId,
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
  if (transport === undefined) return {};
  const url = new URL(transport.origin);
  const port =
    url.port === '' ? (url.protocol === 'https:' ? 443 : 80) : Number(url.port);
  return {
    host: url.hostname,
    port,
    protocol: url.protocol === 'https:' ? 'https' : 'http',
  };
}

export function createStripeMembershipBilling(args: {
  readonly secretKey: string;
  readonly webhookSecret: string | null;
  readonly offer: PlusMembershipOffer;
  readonly now: () => number;
  readonly transport?: StripeMembershipTransport;
}): StripeMembershipBilling {
  const stripe = new Stripe(args.secretKey, {
    httpClient: Stripe.createFetchHttpClient(args.transport?.fetch),
    ...stripeClientConfig(args.transport),
  });
  return new StripeMembershipBilling(
    stripe,
    args.offer,
    args.webhookSecret,
    args.now
  );
}

/**
 * Build the adapter from a secret store, or null when `STRIPE_SECRET_KEY` is
 * blank. The webhook signing secret is optional: without it callbacks fail
 * closed while checkout/portal keep working.
 */
export async function createStripeMembershipBillingFromSecretStore(
  secretStore: SecretStore,
  offer: PlusMembershipOffer,
  now: () => number = () => 0
): Promise<StripeMembershipBilling | null> {
  const raw = (
    await secretStore.getOptional(StripeSecretKeys.secretKey)
  )?.readSecretValue();
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  if (trimmed.length === 0) return null;
  const webhookRaw = (
    await secretStore.getOptional(StripeSecretKeys.webhookSecret)
  )?.readSecretValue();
  const webhookTrimmed =
    typeof webhookRaw === 'string' ? webhookRaw.trim() : '';
  return createStripeMembershipBilling({
    secretKey: trimmed,
    webhookSecret: webhookTrimmed.length > 0 ? webhookTrimmed : null,
    offer,
    now,
  });
}

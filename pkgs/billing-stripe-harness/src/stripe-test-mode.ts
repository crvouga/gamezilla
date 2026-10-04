/**
 * Stripe in test mode, in process, for the adapter's own tests: the stateful
 * Stripe mock (`@crvouga/mockingbird-service-stripe`) behind the real Stripe
 * SDK. The adapter talks to it over the wire as it talks to Stripe; a test
 * drives it as a tester drives Stripe (a Stripe client with the secret key,
 * the mock's clock) and receives the webhooks it sends, signed as Stripe
 * signs them.
 *
 * {@link StripeTestMode.putSubscription} pins a subscription's exact state
 * (the membership contract's situations) in the mock's own storage, so what
 * the adapter reads back is still the mock's rendering of it.
 */
import {
  createRuntime,
  type StripeRuntime,
  type StripeRuntimeOptions,
  type StripeWebhookEvent,
} from '@crvouga/mockingbird-service-stripe';
import { createStripeClient } from '@pkgs/billing-stripe-server/stripe-membership';
import Stripe from 'stripe';

const ACCOUNT = 'acct_test_mode';

export type StripeTestModeFetch = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

/** A subscription as a situation needs it, in Stripe's own terms. */
export type PinnedSubscription = {
  readonly id: string;
  readonly customer: string;
  readonly status: string;
  readonly cancelAtPeriodEnd: boolean;
  readonly currentPeriodEndS: number;
  readonly endedAtS: number | null;
  /** The lookup key of the price its one item is charged at. */
  readonly lookupKey: string;
};

type Clock = NonNullable<StripeRuntimeOptions['clock']>;

function fixedClock(startMs: number): Clock {
  let now = startMs;
  return {
    now: () => now,
    set: (ms) => {
      now = ms;
    },
    advance: (ms) => {
      now += ms;
    },
    freeze: () => undefined,
    unfreeze: () => undefined,
    reset: () => {
      now = startMs;
    },
    state: () => ({ now, frozen: true, offsetMs: 0 }),
  };
}

export class StripeTestMode {
  readonly origin = 'http://stripe.test';
  readonly secretKey = 'sk_test_test_mode';
  readonly webhookSecret = 'whsec_test_mode';
  /** While `true`, every API call fails as in an outage (a 500 not to retry). */
  down = false;
  readonly runtime: StripeRuntime;
  /** A tester's Stripe client. */
  readonly stripe: Stripe;
  private readonly clock: Clock;
  private readonly events: StripeWebhookEvent[] = [];
  private seq = 0;

  constructor(options: { readonly nowMs: number }) {
    this.clock = fixedClock(options.nowMs);
    this.runtime = createRuntime({
      clock: this.clock,
      accounts: [{ id: ACCOUNT, keys: [this.secretKey] }],
      onWebhook: (event) => this.events.push(event),
    });
    this.stripe = createStripeClient(this.secretKey, {
      origin: this.origin,
      fetch: this.fetch,
    });
  }

  readonly fetch: StripeTestModeFetch = async (input, init) => {
    const request = new Request(input, init);
    if (this.down) {
      // An outage the SDK must not retry in-process: the delivery is.
      return Response.json(
        { error: { type: 'api_error', message: 'Stripe unavailable' } },
        { status: 500, headers: { 'stripe-should-retry': 'false' } }
      );
    }
    return await this.runtime.fetch(request);
  };

  now(): number {
    return this.clock.now();
  }

  /** Move Stripe's clock on, and run whatever fell due. */
  advance(ms: number): void {
    this.clock.advance(ms);
    this.runtime.tick();
  }

  /** The person pays checkout session `id` with test card `card`. */
  async completeCheckout(id: string, card = '4242424242424242'): Promise<void> {
    const response = await this.runtime.fetch(
      new Request(`${this.origin}/__admin/checkout/sessions/${id}/complete`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ card }),
      })
    );
    if (!response.ok) {
      throw new Error(
        `checkout ${id} → ${String(response.status)}: ${await response.text()}`
      );
    }
  }

  /** A product with one monthly price per lookup key. */
  async seedPrices(lookupKeys: readonly string[]): Promise<void> {
    const product = await this.stripe.products.create({ name: 'Plus' });
    for (const lookupKey of lookupKeys) {
      await this.stripe.prices.create({
        product: product.id,
        currency: 'usd',
        unit_amount: 700,
        recurring: { interval: 'month' },
        lookup_key: lookupKey,
      });
    }
  }

  /** Pin `subscription`'s stored state exactly (created if new). */
  async putSubscription(subscription: PinnedSubscription): Promise<void> {
    const prices = await this.stripe.prices.list({
      lookup_keys: [subscription.lookupKey],
      limit: 1,
    });
    const price =
      prices.data[0]?.id ?? (await this.createPrice(subscription.lookupKey)).id;
    const account = this.runtime.instance().scopeFor(ACCOUNT).account;
    const itemId = `si_${subscription.id}`;
    const nowS = Math.floor(this.now() / 1000);
    const item = {
      id: itemId,
      created: nowS,
      metadata: {},
      price,
      quantity: 1,
      subscription: subscription.id,
    };
    const record = {
      id: subscription.id,
      cancel_at: subscription.cancelAtPeriodEnd
        ? subscription.currentPeriodEndS
        : null,
      cancel_at_period_end: subscription.cancelAtPeriodEnd,
      canceled_at: subscription.endedAtS,
      collection_method: 'charge_automatically' as const,
      created: nowS,
      currency: 'usd',
      customer: subscription.customer,
      days_until_due: null,
      default_payment_method: null,
      discount_ids: [],
      ended_at: subscription.endedAtS,
      item_ids: [itemId],
      latest_invoice: null,
      metadata: {},
      pause_collection: null,
      schedule: null,
      start_date: nowS,
      status: subscription.status as never,
      trial_end: null,
      trial_start: null,
      current_period_start: nowS,
      current_period_end: subscription.currentPeriodEndS,
    };
    if (account.subscriptionItems.has(itemId)) {
      account.subscriptionItems.update(itemId, item);
    } else {
      account.subscriptionItems.insert(itemId, item);
    }
    if (account.subscriptions.has(subscription.id)) {
      account.subscriptions.update(subscription.id, record);
    } else {
      account.subscriptions.insert(subscription.id, record);
    }
  }

  private async createPrice(lookupKey: string): Promise<Stripe.Price> {
    return await this.stripe.prices.create({
      product_data: { name: lookupKey },
      currency: 'usd',
      unit_amount: 700,
      recurring: { interval: 'month' },
      lookup_key: lookupKey,
    });
  }

  /** Every webhook event Stripe sent, oldest first. */
  sent(): readonly StripeWebhookEvent[] {
    return this.events;
  }

  /** The last event of `type` Stripe sent about object `id`. */
  lastSent(type: string, id: string): StripeWebhookEvent {
    const found = this.events.findLast((event) => {
      if (event.type !== type) return false;
      const body = JSON.parse(event.body) as {
        readonly data: { readonly object: { readonly id?: unknown } };
      };
      return body.data.object.id === id;
    });
    if (found === undefined)
      throw new Error(`Stripe sent no ${type} for ${id}`);
    return found;
  }

  /** `rawBody` signed as Stripe signs a delivery. */
  async signed(args: {
    readonly rawBody: string;
    readonly timestampS: number;
    readonly secret?: string;
    readonly tamper?: boolean;
  }): Promise<{ readonly headers: Headers; readonly rawBody: string }> {
    const header = await Stripe.webhooks.generateTestHeaderStringAsync({
      payload: args.tamper === true ? `${args.rawBody} ` : args.rawBody,
      secret: args.secret ?? this.webhookSecret,
      timestamp: args.timestampS,
    });
    return {
      headers: new Headers({ 'stripe-signature': header }),
      rawBody: args.rawBody,
    };
  }

  /**
   * The webhook Stripe would deliver now about subscription
   * `subscriptionId`, carrying a snapshot of it as the API renders it.
   */
  async webhook(args: {
    readonly type: string;
    readonly subscriptionId: string;
    readonly timestampS: number;
    readonly secret?: string;
    readonly tamper?: boolean;
  }): Promise<{ readonly headers: Headers; readonly rawBody: string }> {
    const object = await this.stripe.subscriptions
      .retrieve(args.subscriptionId)
      .catch(() => ({ id: args.subscriptionId }));
    this.seq += 1;
    const rawBody = JSON.stringify({
      id: `evt_test_mode_${String(this.seq)}`,
      object: 'event',
      type: args.type,
      data: { object },
    });
    return await this.signed({ ...args, rawBody });
  }
}

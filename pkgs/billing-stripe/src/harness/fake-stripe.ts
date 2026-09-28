/**
 * A fake Stripe REST origin that answers from memory — just the endpoints the
 * membership adapter calls, in Stripe's wire shapes. The real Stripe SDK runs
 * against it end to end (request encoding, response parsing, error classes),
 * and it signs webhooks with Stripe's own scheme, so a test drives the
 * production adapter exactly as Stripe would.
 */
import Stripe from 'stripe';

/** One subscription, in Stripe's words. */
export type FakeStripeSubscription = {
  readonly id: string;
  readonly customer: string;
  /** A Stripe status: `trialing`, `active`, `past_due`, `canceled`, … */
  readonly status: string;
  readonly cancelAtPeriodEnd: boolean;
  readonly currentPeriodEndS: number;
  readonly endedAtS: number | null;
  /** The price's lookup key; `null` for a price without one. */
  readonly lookupKey: string | null;
};

export type FakeStripeCustomer = {
  readonly id: string;
  readonly email: string | null;
  readonly metadata: Readonly<Record<string, string>>;
};

export type FakeStripeCheckout = {
  readonly id: string;
  readonly customer: string;
  readonly accountId: string | null;
  readonly price: string;
};

export type FakeStripeFetch = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

function subscriptionJson(subscription: FakeStripeSubscription) {
  return {
    id: subscription.id,
    object: 'subscription',
    customer: subscription.customer,
    status: subscription.status,
    cancel_at_period_end: subscription.cancelAtPeriodEnd,
    ended_at: subscription.endedAtS,
    items: {
      object: 'list',
      data: [
        {
          id: `si_${subscription.id}`,
          current_period_end: subscription.currentPeriodEndS,
          price: {
            id: `price_${String(subscription.lookupKey ?? 'legacy')}`,
            lookup_key: subscription.lookupKey,
          },
        },
      ],
    },
  };
}

function formOf(body: BodyInit | null | undefined): URLSearchParams {
  return new URLSearchParams(typeof body === 'string' ? body : '');
}

function missing(): Response {
  return Response.json(
    { error: { type: 'invalid_request_error', code: 'resource_missing' } },
    { status: 404 }
  );
}

export class FakeStripe {
  readonly customers = new Map<string, FakeStripeCustomer>();
  readonly checkouts: FakeStripeCheckout[] = [];
  readonly portals: string[] = [];
  private readonly subscriptions = new Map<string, FakeStripeSubscription>();
  private seq = 0;
  /** While true every call fails with a 500 the SDK does not retry. */
  down = false;

  constructor(
    /** Where the adapter is pointed; any origin the test chooses. */
    readonly origin = 'http://stripe.fake:12111',
    readonly webhookSecret = 'whsec_fake'
  ) {}

  private nextId(prefix: string): string {
    this.seq += 1;
    return `${prefix}_${String(this.seq)}`;
  }

  setSubscription(subscription: FakeStripeSubscription): void {
    this.subscriptions.set(subscription.id, subscription);
  }

  subscription(id: string): FakeStripeSubscription | undefined {
    return this.subscriptions.get(id);
  }

  private post(path: string, form: URLSearchParams): unknown {
    if (path === '/v1/customers') {
      const metadata: Record<string, string> = {};
      const accountId = form.get('metadata[accountId]');
      if (accountId !== null) metadata['accountId'] = accountId;
      const customer = {
        id: this.nextId('cus'),
        email: form.get('email'),
        metadata,
      };
      this.customers.set(customer.id, customer);
      return { object: 'customer', ...customer };
    }
    if (path === '/v1/checkout/sessions') {
      const id = this.nextId('cs_test');
      this.checkouts.push({
        id,
        customer: form.get('customer') ?? '',
        accountId: form.get('subscription_data[metadata][accountId]'),
        price: form.get('line_items[0][price]') ?? '',
      });
      return { id, url: `https://checkout.stripe.test/c/pay/${id}` };
    }
    if (path === '/v1/billing_portal/sessions') {
      const customer = form.get('customer') ?? '';
      if (!this.customers.has(customer)) return null;
      const id = this.nextId('bps');
      this.portals.push(customer);
      return { id, url: `https://billing.stripe.test/p/session/${id}` };
    }
    return null;
  }

  private get(url: URL): unknown {
    const path = url.pathname;
    if (path === '/v1/prices') {
      const key = url.searchParams.get('lookup_keys[0]') ?? '';
      return {
        object: 'list',
        data: [{ id: `price_${key}`, lookup_key: key }],
      };
    }
    const subscription = this.subscriptions.get(
      path.replace('/v1/subscriptions/', '')
    );
    return subscription === undefined ? null : subscriptionJson(subscription);
  }

  readonly fetch: FakeStripeFetch = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (this.down) {
      // An outage the SDK must not retry in-process: the delivery is.
      return Promise.resolve(
        Response.json(
          { error: { type: 'api_error', message: 'Stripe unavailable' } },
          { status: 500, headers: { 'stripe-should-retry': 'false' } }
        )
      );
    }
    const method = init?.method ?? 'GET';
    const body =
      method === 'POST'
        ? this.post(url.pathname, formOf(init?.body))
        : this.get(url);
    return Promise.resolve(body === null ? missing() : Response.json(body));
  };

  /**
   * The webhook Stripe would deliver now about subscription `id`, carrying a
   * snapshot of it. `secret` and `timestampS` default to a valid signature.
   */
  async webhook(args: {
    readonly type: string;
    readonly subscriptionId: string;
    readonly timestampS: number;
    readonly secret?: string;
    readonly tamper?: boolean;
  }): Promise<{ readonly headers: Headers; readonly rawBody: string }> {
    const current = this.subscriptions.get(args.subscriptionId);
    const rawBody = JSON.stringify({
      id: this.nextId('evt'),
      object: 'event',
      type: args.type,
      data: {
        object:
          current === undefined
            ? { id: args.subscriptionId }
            : subscriptionJson(current),
      },
    });
    const header = await Stripe.webhooks.generateTestHeaderStringAsync({
      payload: args.tamper === true ? `${rawBody} ` : rawBody,
      secret: args.secret ?? this.webhookSecret,
      timestamp: args.timestampS,
    });
    return { headers: new Headers({ 'stripe-signature': header }), rawBody };
  }
}

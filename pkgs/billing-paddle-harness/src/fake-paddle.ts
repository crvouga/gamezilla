/**
 * A fake Paddle Billing REST origin that answers from memory — the endpoints
 * the adapter and `reconcilePaddleOffer` call, in Paddle's wire shapes and
 * envelopes (bearer auth, `{ data, meta }`, `{ error }`, cursor pagination,
 * 409 on a duplicate customer email). It signs webhooks with Paddle's own
 * scheme, so a test drives the production adapter exactly as Paddle would.
 */
import { signPaddlePayload } from '@pkgs/billing-paddle-shared/signature';
import type {
  PaddleCustomer,
  PaddleNotificationSetting,
  PaddlePrice,
  PaddleProduct,
  PaddleSubscription,
} from '@pkgs/billing-paddle-shared/wire';
import {
  PADDLE_CUSTOM_DATA,
  PADDLE_SIGNATURE_HEADER,
} from '@pkgs/billing-paddle-shared/wire';

/** One subscription, in Paddle's words. */
export type FakePaddleSubscription = {
  readonly id: string;
  readonly customerId: string;
  /** A Paddle status: `trialing`, `active`, `past_due`, `paused`, `canceled`. */
  readonly status: string;
  /** Period end (epoch ms); `null` as Paddle reports paused / canceled ones. */
  readonly periodEndMs: number | null;
  readonly scheduledChange: 'cancel' | 'pause' | null;
  readonly canceledAtMs: number | null;
  readonly pausedAtMs: number | null;
  /** The price's `catalog_price_id` custom data; `null` for a foreign price. */
  readonly catalogPriceId: string | null;
};

export type FakePaddleTransaction = {
  readonly id: string;
  readonly customerId: string | null;
  readonly priceId: string;
  readonly customData: Readonly<Record<string, unknown>> | null;
};

export type FakePaddleFetch = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

type Json = Record<string, unknown>;

const PAGE_DEFAULT = 50;

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

function error(status: number, code: string, detail: string): Response {
  return Response.json(
    {
      error: { type: 'request_error', code, detail },
      meta: { request_id: 'req_fake' },
    },
    { status }
  );
}

function ok(data: unknown, status = 200): Response {
  return Response.json({ data, meta: { request_id: 'req_fake' } }, { status });
}

export class FakePaddle {
  readonly customers = new Map<string, PaddleCustomer>();
  readonly transactions: FakePaddleTransaction[] = [];
  readonly portals: string[] = [];
  readonly products = new Map<string, PaddleProduct>();
  readonly prices = new Map<string, PaddlePrice>();
  readonly notificationSettings = new Map<string, PaddleNotificationSetting>();
  private readonly subscriptions = new Map<string, FakePaddleSubscription>();
  private seq = 0;
  /** While true every call fails with a 500. */
  down = false;

  constructor(
    readonly origin = 'http://paddle.fake:12112',
    readonly apiKey = 'pdl_sdbx_apikey_fake',
    readonly webhookSecret = 'pdl_ntfset_fake'
  ) {}

  private nextId(prefix: string): string {
    this.seq += 1;
    return `${prefix}_${String(this.seq).padStart(26, '0')}`;
  }

  setSubscription(subscription: FakePaddleSubscription): void {
    this.subscriptions.set(subscription.id, subscription);
  }

  subscription(id: string): FakePaddleSubscription | undefined {
    return this.subscriptions.get(id);
  }

  /** Seeds an active price carrying `catalogPriceId` (what a reconcile creates). */
  seedPrice(catalogPriceId: string): PaddlePrice {
    const price: PaddlePrice = {
      id: this.nextId('pri'),
      product_id: 'pro_seeded',
      description: catalogPriceId,
      name: catalogPriceId,
      status: 'active',
      billing_cycle: { interval: 'month', frequency: 1 },
      trial_period: null,
      unit_price: { amount: '700', currency_code: 'USD' },
      unit_price_overrides: [],
      custom_data: { [PADDLE_CUSTOM_DATA.catalogPriceId]: catalogPriceId },
    };
    this.prices.set(price.id, price);
    return price;
  }

  private priceByLookupKey(catalogPriceId: string | null): PaddlePrice {
    const found = [...this.prices.values()].find(
      (p) =>
        p.custom_data?.[PADDLE_CUSTOM_DATA.catalogPriceId] === catalogPriceId
    );
    return (
      found ?? {
        id: 'pri_foreign',
        product_id: 'pro_foreign',
        description: 'foreign',
        name: null,
        status: 'active',
        billing_cycle: { interval: 'month', frequency: 1 },
        trial_period: null,
        unit_price: { amount: '100', currency_code: 'USD' },
        unit_price_overrides: [],
        custom_data:
          catalogPriceId === null
            ? null
            : { [PADDLE_CUSTOM_DATA.catalogPriceId]: catalogPriceId },
      }
    );
  }

  private subscriptionJson(s: FakePaddleSubscription): PaddleSubscription {
    return {
      id: s.id,
      status: s.status,
      customer_id: s.customerId,
      custom_data: null,
      current_billing_period:
        s.periodEndMs === null
          ? null
          : {
              starts_at: iso(s.periodEndMs - 86_400_000),
              ends_at: iso(s.periodEndMs),
            },
      scheduled_change:
        s.scheduledChange === null || s.periodEndMs === null
          ? null
          : {
              action: s.scheduledChange,
              effective_at: iso(s.periodEndMs),
              resume_at: null,
            },
      canceled_at: s.canceledAtMs === null ? null : iso(s.canceledAtMs),
      paused_at: s.pausedAtMs === null ? null : iso(s.pausedAtMs),
      items: [
        { status: 'active', price: this.priceByLookupKey(s.catalogPriceId) },
      ],
    };
  }

  private page<T>(url: URL, all: readonly T[], idOf: (t: T) => string) {
    const perPage = Number(url.searchParams.get('per_page') ?? PAGE_DEFAULT);
    const after = url.searchParams.get('after');
    const start =
      after === null ? 0 : all.findIndex((item) => idOf(item) === after) + 1;
    const data = all.slice(start, start + perPage);
    const hasMore = start + perPage < all.length;
    const last = data[data.length - 1];
    const next = new URL(url.toString());
    if (last !== undefined) next.searchParams.set('after', idOf(last));
    return Response.json({
      data,
      meta: {
        request_id: 'req_fake',
        pagination: {
          per_page: perPage,
          has_more: hasMore,
          estimated_total: all.length,
          // Paddle answers with its own origin; clients must not follow it.
          next: `https://api.paddle.com${next.pathname}${next.search}`,
        },
      },
    });
  }

  private createCustomer(body: Json): Response {
    const email = typeof body['email'] === 'string' ? body['email'] : '';
    if (email.length === 0) {
      return error(400, 'invalid_field', 'email is required');
    }
    const existing = [...this.customers.values()].find(
      (c) => c.email === email
    );
    if (existing !== undefined) {
      return error(
        409,
        'customer_already_exists',
        `customer email conflicts with customer of id ${existing.id}`
      );
    }
    const customer: PaddleCustomer = {
      id: this.nextId('ctm'),
      email,
      custom_data:
        (body['custom_data'] as PaddleCustomer['custom_data']) ?? null,
    };
    this.customers.set(customer.id, customer);
    return ok(customer, 201);
  }

  private createTransaction(body: Json): Response {
    const items = body['items'] as readonly { price_id?: string }[] | undefined;
    const priceId = items?.[0]?.price_id ?? '';
    if (!this.prices.has(priceId)) {
      return error(400, 'invalid_field', `price ${priceId} not found`);
    }
    const customerId =
      typeof body['customer_id'] === 'string' ? body['customer_id'] : null;
    if (customerId !== null && !this.customers.has(customerId)) {
      return error(404, 'not_found', `Entity ${customerId} not found`);
    }
    const id = this.nextId('txn');
    this.transactions.push({
      id,
      customerId,
      priceId,
      customData: (body['custom_data'] as Json | undefined) ?? null,
    });
    return ok(
      {
        id,
        checkout: { url: `https://pay.example.test/checkout?_ptxn=${id}` },
      },
      201
    );
  }

  private upsert<T extends { readonly id: string }>(
    store: Map<string, T>,
    id: string | null,
    body: Json,
    create: (id: string) => T
  ): Response {
    if (id === null) {
      const created = create(this.nextId(''));
      store.set(created.id, created);
      return ok(created, 201);
    }
    const live = store.get(id);
    if (live === undefined)
      return error(404, 'not_found', `Entity ${id} not found`);
    const updated = { ...live, ...body } as T;
    store.set(id, updated);
    return ok(updated);
  }

  private catalog(method: string, url: URL, body: Json): Response | null {
    const [, collection, id] = url.pathname.split('/');
    const status = url.searchParams.get('status');
    if (collection === 'products') {
      if (method === 'GET') {
        const all = [...this.products.values()].filter(
          (p) => status === null || p.status === status
        );
        return this.page(url, all, (p) => p.id);
      }
      return this.upsert(this.products, id ?? null, body, (seq) => ({
        status: 'active',
        description: null,
        custom_data: null,
        tax_category: 'standard',
        name: '',
        ...(body as Partial<PaddleProduct>),
        id: `pro${seq}`,
      }));
    }
    if (collection === 'prices') {
      if (method === 'GET') {
        const productId = url.searchParams.get('product_id');
        const all = [...this.prices.values()].filter(
          (p) =>
            (status === null || p.status === status) &&
            (productId === null || p.product_id === productId)
        );
        return this.page(url, all, (p) => p.id);
      }
      return this.upsert(this.prices, id ?? null, body, (seq) => ({
        status: 'active',
        name: null,
        trial_period: null,
        billing_cycle: null,
        unit_price_overrides: [],
        custom_data: null,
        description: '',
        product_id: '',
        unit_price: { amount: '0', currency_code: 'USD' },
        ...(body as Partial<PaddlePrice>),
        id: `pri${seq}`,
      }));
    }
    if (collection === 'notification-settings') {
      if (method === 'GET') return ok([...this.notificationSettings.values()]);
      return this.upsert(
        this.notificationSettings,
        id ?? null,
        body,
        (seq) => ({
          active: true,
          type: 'url' as const,
          description: '',
          destination: '',
          subscribed_events: [],
          ...(body as Partial<PaddleNotificationSetting>),
          id: `ntfset${seq}`,
          endpoint_secret_key: `pdl_ntfset${seq}_secret`,
        })
      );
    }
    return null;
  }

  private route(method: string, url: URL, body: Json): Response {
    const path = url.pathname;
    if (method === 'POST' && path === '/customers')
      return this.createCustomer(body);
    if (method === 'GET' && path === '/customers') {
      const email = url.searchParams.get('email');
      return ok(
        [...this.customers.values()].filter(
          (c) => email === null || c.email === email
        )
      );
    }
    if (method === 'POST' && path === '/transactions') {
      return this.createTransaction(body);
    }
    const portal = /^\/customers\/([^/]+)\/portal-sessions$/.exec(path);
    if (method === 'POST' && portal !== null) {
      const customerId = decodeURIComponent(portal[1] ?? '');
      if (!this.customers.has(customerId)) {
        return error(404, 'not_found', `Entity ${customerId} not found`);
      }
      this.portals.push(customerId);
      const id = this.nextId('cpls');
      return ok(
        {
          id,
          urls: {
            general: {
              overview: `https://customer-portal.paddle.test/${id}?token=fake`,
            },
          },
        },
        201
      );
    }
    const subscription = /^\/subscriptions\/([^/]+)$/.exec(path);
    if (method === 'GET' && subscription !== null) {
      const found = this.subscriptions.get(
        decodeURIComponent(subscription[1] ?? '')
      );
      return found === undefined
        ? error(404, 'not_found', 'Entity not found')
        : ok(this.subscriptionJson(found));
    }
    return this.catalog(method, url, body) ?? error(404, 'not_found', path);
  }

  readonly fetch: FakePaddleFetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (this.down) {
      return error(500, 'internal_error', 'Paddle unavailable');
    }
    const headers = new Headers(init?.headers);
    if (headers.get('authorization') !== `Bearer ${this.apiKey}`) {
      return error(403, 'forbidden', 'invalid API key');
    }
    const raw = typeof init?.body === 'string' ? init.body : '';
    const body = (raw.length > 0 ? JSON.parse(raw) : {}) as Json;
    return this.route(init?.method ?? 'GET', url, body);
  };

  /**
   * The webhook Paddle would deliver now about subscription `id`, carrying a
   * snapshot of it. `secret` and `timestampS` default to a valid signature.
   */
  webhook(args: {
    readonly eventType: string;
    readonly subscriptionId: string;
    readonly timestampS: number;
    readonly secret?: string;
    readonly tamper?: boolean;
  }): { readonly headers: Headers; readonly rawBody: string } {
    const current = this.subscriptions.get(args.subscriptionId);
    const rawBody = JSON.stringify({
      event_id: this.nextId('evt'),
      event_type: args.eventType,
      occurred_at: iso(args.timestampS * 1000),
      notification_id: this.nextId('ntf'),
      data:
        current === undefined
          ? { id: args.subscriptionId }
          : this.subscriptionJson(current),
    });
    const header = signPaddlePayload({
      secret: args.secret ?? this.webhookSecret,
      payload: args.tamper === true ? `${rawBody} ` : rawBody,
      timestampS: args.timestampS,
    });
    return {
      headers: new Headers({ [PADDLE_SIGNATURE_HEADER]: header }),
      rawBody,
    };
  }
}

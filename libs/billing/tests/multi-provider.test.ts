/**
 * The billing routes over two real providers at once: the production Stripe
 * and Paddle adapters — Stripe in test mode, simulated
 * (`@pkgs/billing-stripe/harness`), Paddle against its fake REST origin —
 * behind the real billing routes and a real SQLite database. Only the vendors
 * are simulated, at their wire.
 *
 * These are the wire and storage contracts of running two providers: which
 * callback path verifies which provider's deliveries, where a checkout mints
 * a customer, which customer links a provider's news is matched against, and
 * that the server refuses a second membership even when a stale screen asks.
 * What a person sees when the team switches payment provider is specified in
 * `specs/billing/payment-provider-switch.feature` and `.qnt`.
 */
import { describe, expect, test } from 'bun:test';
import { ExternalAccountRepository } from '@libs/auth/public/external-account-repository';
import { AUTH_TABLES } from '@libs/auth/public/schema';
import { PLUS_MEMBERSHIP_OFFER } from '@libs/billing/public/offer';
import { BILLING_TABLES } from '@libs/billing/public/schema';
import { BillingApp } from '@libs/billing/root/server/billing-app';
import {
  createMembershipProviders,
  type MembershipBilling,
} from '@pkgs/billing';
import { PaddleMembershipBilling } from '@pkgs/billing-paddle';
import { FakePaddle } from '@pkgs/billing-paddle/harness';
import { createStripeMembershipBilling } from '@pkgs/billing-stripe';
import { StripeTestMode } from '@pkgs/billing-stripe/harness';
import { registerTables } from '@pkgs/db-schema';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite';
import { createNoopLogger } from '@pkgs/logger';
import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite/impl-mockingbird-sqlite';
import { Hono } from 'hono';

const NOW = Date.parse('2026-09-21T12:00:00.000Z');
const DAY = 86_400_000;
const RETURN = 'https://app.test/more/billing';

type ProviderId = 'stripe' | 'paddle';

/** Two fake vendors, their production adapters, and the routes over both. */
class TwoProviders {
  readonly stripe = new StripeTestMode({ nowMs: NOW });
  readonly paddle = new FakePaddle();
  readonly adapters: Readonly<Record<ProviderId, MembershipBilling>>;
  checkoutAt: ProviderId = 'stripe';
  private seq = 0;

  constructor(readonly db: SqlClient) {
    for (const spec of Object.values(PLUS_MEMBERSHIP_OFFER.prices)) {
      this.paddle.seedPrice(spec.catalogPriceId);
    }
    this.adapters = {
      stripe: createStripeMembershipBilling({
        secretKey: this.stripe.secretKey,
        webhookSecret: this.stripe.webhookSecret,
        offer: PLUS_MEMBERSHIP_OFFER,
        now: () => NOW,
        transport: { origin: this.stripe.origin, fetch: this.stripe.fetch },
      }),
      paddle: new PaddleMembershipBilling({
        apiKey: this.paddle.apiKey,
        webhookSecret: this.paddle.webhookSecret,
        offer: PLUS_MEMBERSHIP_OFFER,
        now: () => NOW,
        fetch: this.paddle.fetch,
        origin: this.paddle.origin,
      }),
    };
  }

  /** The API as configured right now: `configured`, one taking checkouts. */
  private app(configured: readonly ProviderId[]): Hono {
    const inner = new BillingApp({
      getSqlClient: () => this.db,
      billing: createMembershipProviders({
        all: configured.map((id) => this.adapters[id]),
        checkout: this.checkoutAt,
      }),
      requireAuth: (_sql, request) =>
        Promise.resolve({
          accountId: request.headers.get('x-account') ?? '',
          deviceId: 'device',
        }),
      createId: () => {
        this.seq += 1;
        return `id-${String(this.seq)}`;
      },
      clock: { now: () => NOW },
      log: createNoopLogger(),
      notifyUser: () => Promise.resolve(),
    }).build();
    return new Hono().route('/', inner);
  }

  async signUp(accountId: string): Promise<void> {
    await new ExternalAccountRepository(this.db).upsertExternalAccount({
      userId: accountId,
      provider: 'idp',
      externalId: `idp-${accountId}`,
      metadata: { email: `${accountId}@people.test` },
      now: () => NOW,
      createId: () => `idp-link-${accountId}`,
    });
  }

  async checkout(accountId: string): Promise<number> {
    const res = await this.app(['stripe', 'paddle']).request(
      '/billing/checkout',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-account': accountId,
        },
        body: JSON.stringify({ returnUrl: RETURN }),
      }
    );
    return res.status;
  }

  async deliver(
    path: string,
    delivery: { readonly headers: Headers; readonly rawBody: string },
    configured: readonly ProviderId[] = ['stripe', 'paddle']
  ): Promise<number> {
    const res = await this.app(configured).request(
      `/billing/callback/${path}`,
      { method: 'POST', headers: delivery.headers, body: delivery.rawBody }
    );
    return res.status;
  }

  async customerOf(accountId: string, provider: ProviderId) {
    const rows = await this.db.query(sql<{ external_id: string }>`
      SELECT external_id FROM auth_external_accounts
      WHERE user_id = ${accountId} AND provider = ${`billing:${provider}`}`);
    return rows[0]?.external_id ?? null;
  }

  async membershipRows(accountId: string): Promise<number> {
    const rows = await this.db.query(sql<{ provider: string }>`
      SELECT provider FROM billing_subscriptions
      WHERE account_id = ${accountId} AND deleted_at IS NULL`);
    return rows.length;
  }

  /** The provider completes a checkout and says so. */
  async joinAt(
    provider: ProviderId,
    accountId: string,
    status: 'trialing' | 'active' = 'trialing'
  ): Promise<string> {
    const customer = await this.customerOf(accountId, provider);
    if (customer === null) throw new Error(`${accountId} never checked out`);
    this.seq += 1;
    const id = `sub_${provider}_${String(this.seq)}`;
    await this.set(provider, id, customer, status);
    expect(await this.announce(provider, id)).toBe(200);
    return id;
  }

  async set(
    provider: ProviderId,
    id: string,
    customer: string,
    status: 'trialing' | 'active' | 'ended'
  ): Promise<void> {
    const periodEndMs = NOW + 20 * DAY;
    if (provider === 'stripe') {
      await this.stripe.putSubscription({
        id,
        customer,
        status: status === 'ended' ? 'canceled' : status,
        cancelAtPeriodEnd: false,
        currentPeriodEndS: periodEndMs / 1000,
        endedAtS: status === 'ended' ? NOW / 1000 : null,
        lookupKey: 'subscription_monthly',
      });
      return;
    }
    this.paddle.setSubscription({
      id,
      customerId: customer,
      status: status === 'ended' ? 'canceled' : status,
      periodEndMs: status === 'ended' ? null : periodEndMs,
      scheduledChange: null,
      canceledAtMs: status === 'ended' ? NOW : null,
      pausedAtMs: null,
      catalogPriceId: 'subscription_monthly',
    });
  }

  async delivery(
    provider: ProviderId,
    id: string,
    kind: 'changed' | 'ended'
  ): Promise<{ readonly headers: Headers; readonly rawBody: string }> {
    return provider === 'stripe'
      ? await this.stripe.webhook({
          type:
            kind === 'ended'
              ? 'customer.subscription.deleted'
              : 'customer.subscription.updated',
          subscriptionId: id,
          timestampS: NOW / 1000,
        })
      : this.paddle.webhook({
          eventType:
            kind === 'ended' ? 'subscription.canceled' : 'subscription.updated',
          subscriptionId: id,
          timestampS: NOW / 1000,
        });
  }

  async announce(provider: ProviderId, id: string): Promise<number> {
    return await this.deliver(
      provider,
      await this.delivery(provider, id, 'changed')
    );
  }

  async end(provider: ProviderId, id: string): Promise<void> {
    const customer =
      provider === 'stripe'
        ? await this.stripe.stripe.subscriptions
            .retrieve(id)
            .then((s) => s.customer as string)
        : this.paddle.subscription(id)?.customerId;
    if (customer === undefined) throw new Error(`no ${provider} ${id}`);
    await this.set(provider, id, customer, 'ended');
    const ended = await this.delivery(provider, id, 'ended');
    expect(await this.deliver(provider, ended)).toBe(200);
  }
}

async function openTwoProviders(): Promise<TwoProviders> {
  const db = SqlClientImplMockingbirdSqlite.open();
  await db.connect();
  await reconcileSqliteSchema(
    db,
    registerTables([...AUTH_TABLES, ...BILLING_TABLES]),
    { ownership: 'declared-only' }
  );
  const two = new TwoProviders(db);
  await two.stripe.seedPrices(
    Object.values(PLUS_MEMBERSHIP_OFFER.prices).map((s) => s.catalogPriceId)
  );
  for (const account of ['ada', 'bo']) await two.signUp(account);
  return two;
}

describe('checkout across providers', () => {
  test('a checkout mints a customer only at the provider taking checkouts', async () => {
    const two = await openTwoProviders();
    two.checkoutAt = 'paddle';
    expect(await two.checkout('bo')).toBe(200);
    expect(await two.customerOf('bo', 'paddle')).not.toBeNull();
    expect(await two.customerOf('bo', 'stripe')).toBeNull();
  });

  test('a second checkout is refused while a membership is live at another provider', async () => {
    const two = await openTwoProviders();
    await two.checkout('ada');
    await two.joinAt('stripe', 'ada');
    two.checkoutAt = 'paddle';
    expect(await two.checkout('ada')).toBe(409);
    expect(two.paddle.transactions).toHaveLength(0);
  });

  test('a person checking out again at a provider is the same customer there', async () => {
    const two = await openTwoProviders();
    await two.checkout('ada');
    const atStripe = await two.customerOf('ada', 'stripe');
    if (atStripe === null) throw new Error('ada has no Stripe customer');
    await two.end('stripe', await two.joinAt('stripe', 'ada', 'active'));
    two.checkoutAt = 'paddle';
    await two.checkout('ada');
    await two.end('paddle', await two.joinAt('paddle', 'ada', 'active'));
    two.checkoutAt = 'stripe';
    expect(await two.checkout('ada')).toBe(200);
    expect(await two.customerOf('ada', 'stripe')).toBe(atStripe);
    const customers = await two.stripe.stripe.customers.list();
    expect(customers.data.map((c) => c.id)).toEqual([atStripe]);
    const checkouts = await two.stripe.stripe.checkout.sessions.list();
    expect(checkouts.data.map((c) => c.customer)).toEqual([atStripe, atStripe]);
  });
});

describe('deliveries reach only their own provider', () => {
  test('a delivery posted to another provider’s path is unverified', async () => {
    const two = await openTwoProviders();
    await two.checkout('ada');
    const id = await two.joinAt('stripe', 'ada');
    const stripeDelivery = await two.delivery('stripe', id, 'changed');
    expect(await two.deliver('paddle', stripeDelivery)).toBe(400);
  });

  test('a provider that is not configured has no callback route', async () => {
    const two = await openTwoProviders();
    const delivery = two.paddle.webhook({
      eventType: 'subscription.updated',
      subscriptionId: 'sub_x',
      timestampS: NOW / 1000,
    });
    expect(await two.deliver('paddle', delivery, ['stripe'])).toBe(404);
    expect(await two.deliver('mystery', delivery)).toBe(404);
  });

  test('a customer id is only looked up among its own provider’s customers', async () => {
    const two = await openTwoProviders();
    await two.checkout('ada');
    const adaAtStripe = await two.customerOf('ada', 'stripe');
    if (adaAtStripe === null) throw new Error('ada has no Stripe customer');
    // Paddle reports a subscription whose customer id happens to equal
    // Ada's Stripe customer id. It is not Ada's.
    await two.set('paddle', 'sub_collide', adaAtStripe, 'active');
    expect(await two.announce('paddle', 'sub_collide')).toBe(200);
    expect(await two.membershipRows('ada')).toBe(0);
  });
});

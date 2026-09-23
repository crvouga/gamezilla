/**
 * The app over two real providers at once: the production Stripe and Paddle
 * adapters, each against its fake REST origin, behind the real billing routes
 * and a real SQLite database. Nothing here is a stub of the app — only the
 * vendors are faked, at their wire.
 *
 * It walks the life a deployment goes through when it changes provider:
 * members at the old one keep renewing, cancelling and managing their
 * membership there while new people start at the new one; a person who left
 * one provider can join through the other; and the app can switch back.
 */
import { describe, expect, test } from 'bun:test';
import { ExternalAccountRepository } from '@libs/auth/public/external-account-repository';
import { AUTH_TABLES } from '@libs/auth/public/schema';
import { PLUS_MEMBERSHIP_OFFER } from '@libs/billing/public/offer';
import { BILLING_TABLES } from '@libs/billing/public/schema';
import { BillingApp } from '@libs/billing/root/server/billing-app';
import {
  governingSubscription,
  ROLE,
  resolvePlanRole,
  type SubscriptionRow,
} from '@libs/permissions/root/access-model';
import {
  createMembershipProviders,
  type MembershipBilling,
} from '@pkgs/billing';
import { PaddleMembershipBilling } from '@pkgs/billing-paddle';
import { FakePaddle } from '@pkgs/billing-paddle/sim';
import { createStripeMembershipBilling } from '@pkgs/billing-stripe';
import { FakeStripe } from '@pkgs/billing-stripe/sim';
import { registerTables } from '@pkgs/db-schema';
import { applySqliteSchema } from '@pkgs/db-schema-sqlite';
import { createNoopLogger } from '@pkgs/logger';
import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { SqlClientImplSqliteMem } from '@pkgs/sql-client-sqlite/impl-sqlite-mem';
import fc from 'fast-check';
import { Hono } from 'hono';

const NOW = Date.parse('2026-09-21T12:00:00.000Z');
const DAY = 86_400_000;
const GRACE_MS = 3 * DAY;
const RETURN = 'https://app.test/more/billing';

type ProviderId = 'stripe' | 'paddle';

class World {
  readonly stripe = new FakeStripe();
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
        secretKey: 'sk_test_world',
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

  /** The API as configured right now: both providers, one taking checkouts. */
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

  async post(
    route: 'checkout' | 'portal',
    accountId: string,
    configured: readonly ProviderId[] = ['stripe', 'paddle']
  ): Promise<{ readonly status: number; readonly url: string | null }> {
    const res = await this.app(configured).request(`/billing/${route}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-account': accountId },
      body: JSON.stringify({ returnUrl: RETURN }),
    });
    const body = (await res.json()) as { url?: string };
    return { status: res.status, url: body.url ?? null };
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
    this.set(provider, id, customer, status);
    expect(await this.announce(provider, id, 'changed')).toBe(200);
    return id;
  }

  set(
    provider: ProviderId,
    id: string,
    customer: string,
    status: 'trialing' | 'active' | 'ended'
  ): void {
    const periodEndMs = NOW + 20 * DAY;
    if (provider === 'stripe') {
      this.stripe.setSubscription({
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

  async announce(
    provider: ProviderId,
    id: string,
    kind: 'changed' | 'ended'
  ): Promise<number> {
    return await this.deliver(
      provider,
      await this.delivery(provider, id, kind)
    );
  }

  async end(provider: ProviderId, id: string): Promise<void> {
    const customer =
      provider === 'stripe'
        ? this.stripe.subscription(id)?.customer
        : this.paddle.subscription(id)?.customerId;
    if (customer === undefined) throw new Error(`no ${provider} ${id}`);
    this.set(provider, id, customer, 'ended');
    expect(await this.announce(provider, id, 'ended')).toBe(200);
  }

  /** What the account's access resolves to, from its synced rows. */
  async role(accountId: string): Promise<string> {
    const rows = await this.db.query(sql<SubscriptionRow>`
      SELECT status, current_period_end, cancel_at_period_end
      FROM billing_subscriptions
      WHERE account_id = ${accountId} AND deleted_at IS NULL
      ORDER BY updated_at DESC`);
    return resolvePlanRole({
      signedIn: true,
      subscription: governingSubscription(rows),
      nowMs: NOW + 30 * DAY,
      graceMs: GRACE_MS,
      billingEnabled: true,
    });
  }
}

async function openWorld(): Promise<World> {
  const db = SqlClientImplSqliteMem.open();
  await db.connect();
  await applySqliteSchema(
    db,
    registerTables([...AUTH_TABLES, ...BILLING_TABLES]),
    {
      ownership: 'declared-only',
    }
  );
  const world = new World(db);
  for (const account of ['ada', 'bo', 'cy']) await world.signUp(account);
  return world;
}

describe('two providers at once', () => {
  test('a member at the old provider keeps it; new people start at the new one', async () => {
    const world = await openWorld();
    expect((await world.post('checkout', 'ada')).status).toBe(200);
    const adaAtStripe = await world.joinAt('stripe', 'ada');
    expect(await world.role('ada')).toBe(ROLE.planPaid);

    world.checkoutAt = 'paddle';
    // Bo starts at Paddle, with a Paddle customer minted from the email.
    const bo = await world.post('checkout', 'bo');
    expect(bo.status).toBe(200);
    expect(bo.url).toContain('_ptxn=txn_');
    expect(await world.customerOf('bo', 'paddle')).not.toBeNull();
    expect(await world.customerOf('bo', 'stripe')).toBeNull();
    await world.joinAt('paddle', 'bo');
    expect(await world.role('bo')).toBe(ROLE.planPaid);

    // Ada is still a Stripe member: no second membership, her portal is
    // Stripe's, and Stripe's callbacks still reach her.
    expect((await world.post('checkout', 'ada')).status).toBe(409);
    expect(world.paddle.transactions).toHaveLength(1);
    const portal = await world.post('portal', 'ada');
    expect(portal.url).toContain('billing.stripe.test');
    await world.end('stripe', adaAtStripe);
    expect(await world.role('ada')).toBe(ROLE.planFree);
  });

  test('switch, then switch back: each provider keeps its own customer', async () => {
    const world = await openWorld();
    await world.post('checkout', 'ada');
    const stripeCustomer = await world.customerOf('ada', 'stripe');
    if (stripeCustomer === null) throw new Error('ada has no Stripe customer');
    await world.end('stripe', await world.joinAt('stripe', 'ada', 'active'));

    world.checkoutAt = 'paddle';
    expect((await world.post('checkout', 'ada')).status).toBe(200);
    const atPaddle = await world.joinAt('paddle', 'ada', 'active');
    expect(await world.role('ada')).toBe(ROLE.planPaid);
    expect((await world.post('portal', 'ada')).url).toContain(
      'customer-portal.paddle.test'
    );
    await world.end('paddle', atPaddle);
    expect(await world.role('ada')).toBe(ROLE.planFree);

    world.checkoutAt = 'stripe';
    expect((await world.post('checkout', 'ada')).status).toBe(200);
    // The Stripe customer from before is reused, never a Paddle id.
    expect(await world.customerOf('ada', 'stripe')).toBe(stripeCustomer);
    expect(world.stripe.customers.size).toBe(1);
    expect(world.stripe.checkouts.map((c) => c.customer)).toEqual([
      stripeCustomer,
      stripeCustomer,
    ]);
    await world.joinAt('stripe', 'ada');
    expect(await world.role('ada')).toBe(ROLE.planPaid);
  });

  test('a late ended callback from the old provider never hides the new membership', async () => {
    const world = await openWorld();
    await world.post('checkout', 'ada');
    const atStripe = await world.joinAt('stripe', 'ada');
    const late = await world.delivery('stripe', atStripe, 'ended');
    await world.end('stripe', atStripe);
    world.checkoutAt = 'paddle';
    await world.post('checkout', 'ada');
    await world.joinAt('paddle', 'ada');
    // Stripe redelivers its deletion after the Paddle membership began.
    expect(await world.deliver('stripe', late)).toBe(200);
    expect(await world.role('ada')).toBe(ROLE.planPaid);
    expect((await world.post('portal', 'ada')).url).toContain(
      'customer-portal.paddle.test'
    );
  });

  test('the old provider can be dropped from checkout and still serve its members', async () => {
    const world = await openWorld();
    await world.post('checkout', 'ada');
    const atStripe = await world.joinAt('stripe', 'ada');
    world.checkoutAt = 'paddle';
    // A renewal at Stripe while Paddle takes checkouts.
    expect(await world.announce('stripe', atStripe, 'changed')).toBe(200);
    expect(await world.role('ada')).toBe(ROLE.planPaid);
  });
});

describe('deliveries reach only their own provider', () => {
  test('a delivery posted to another provider’s path is unverified', async () => {
    const world = await openWorld();
    await world.post('checkout', 'ada');
    const id = await world.joinAt('stripe', 'ada');
    const stripeDelivery = await world.delivery('stripe', id, 'changed');
    expect(await world.deliver('paddle', stripeDelivery)).toBe(400);
  });

  test('a provider that is not configured has no callback route', async () => {
    const world = await openWorld();
    const delivery = world.paddle.webhook({
      eventType: 'subscription.updated',
      subscriptionId: 'sub_x',
      timestampS: NOW / 1000,
    });
    expect(await world.deliver('paddle', delivery, ['stripe'])).toBe(404);
    expect(await world.deliver('mystery', delivery)).toBe(404);
  });

  test('a customer id is only looked up among its own provider’s customers', async () => {
    const world = await openWorld();
    await world.post('checkout', 'ada');
    const adaAtStripe = await world.customerOf('ada', 'stripe');
    if (adaAtStripe === null) throw new Error('ada has no Stripe customer');
    // Paddle reports a subscription whose customer id happens to equal
    // Ada's Stripe customer id. It is not Ada's.
    world.set('paddle', 'sub_collide', adaAtStripe, 'active');
    expect(await world.announce('paddle', 'sub_collide', 'changed')).toBe(200);
    expect(await world.role('ada')).toBe(ROLE.planFree);
  });
});

describe('delivery order', () => {
  test('any interleaving of both providers’ deliveries lands on the same access', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.nat({ max: 3 }), { minLength: 1, maxLength: 8 }),
        async (order) => {
          const world = await openWorld();
          await world.post('checkout', 'ada');
          const atStripe = await world.joinAt('stripe', 'ada');
          const deliveries = [
            await world.delivery('stripe', atStripe, 'changed'),
            await world.delivery('stripe', atStripe, 'ended'),
          ];
          await world.end('stripe', atStripe);
          world.checkoutAt = 'paddle';
          await world.post('checkout', 'ada');
          const atPaddle = await world.joinAt('paddle', 'ada');
          deliveries.push(
            await world.delivery('paddle', atPaddle, 'changed'),
            world.paddle.webhook({
              eventType: 'subscription.activated',
              subscriptionId: atPaddle,
              timestampS: NOW / 1000,
            })
          );
          const paths: readonly ProviderId[] = [
            'stripe',
            'stripe',
            'paddle',
            'paddle',
          ];
          for (const index of order) {
            const delivery = deliveries[index];
            if (delivery === undefined) continue;
            expect(
              await world.deliver(paths[index] ?? 'stripe', delivery)
            ).toBe(200);
          }
          expect(await world.role('ada')).toBe(ROLE.planPaid);
        }
      ),
      { numRuns: 25 }
    );
  });
});

import { zValidator } from '@hono/zod-validator';
import type { Context } from 'hono';
import { Hono } from 'hono';
import { z } from 'zod';

import {
  MOCK_BILLING_ASSETS,
  type MockBillingPrice,
  type MockBillingState,
  type MockCheckoutBody,
  type MockPortalBody,
} from '../shared/mock-billing-contract';
import {
  mockCheckoutBodySchema,
  mockPortalBodySchema,
} from './mock-billing-schemas';
import { serveMockBillingFile } from './mock-billing-static';
import {
  applyDerived,
  type BillingMockDeps,
  type Current,
  checkoutChange,
  currentIsLive,
  OBSERVE_KINDS,
  observeChange,
  otherSwitchablePrice,
  portalChange,
  readCurrent,
} from './mock-membership';

export type { BillingMockDeps } from './mock-membership';

const observeSchema = z.object({
  accountId: z.string().min(1),
  kind: z.enum(OBSERVE_KINDS),
});

const stateQuerySchema = z.object({ accountId: z.string().min(1) });

function pricesOf(deps: BillingMockDeps): readonly MockBillingPrice[] {
  return deps.offer.switchablePriceKeys.flatMap((key) => {
    const spec = deps.offer.prices[key];
    if (spec === undefined) return [];
    return [
      {
        key,
        interval: spec.interval,
        unitAmount: spec.unitAmount,
        currency: spec.currency,
        trialPeriodDays: spec.trialPeriodDays ?? 0,
      },
    ];
  });
}

function stateOf(
  deps: BillingMockDeps,
  current: Current | null
): MockBillingState {
  return {
    brand: deps.offer.portal.businessProfileHeadline,
    product: {
      name: deps.offer.product.name,
      description: deps.offer.product.description,
    },
    prices: pricesOf(deps),
    defaultPriceKey: deps.offer.defaultPriceKey,
    membership:
      current === null
        ? null
        : {
            status: current.status,
            priceKey: current.offerPriceKey,
            periodEndMs: current.periodEndMs,
            endsAtPeriodEnd: current.endsAtPeriodEnd,
          },
    nowMs: deps.clock.now(),
  };
}

/**
 * The stateless fake provider's edge: the hosted checkout and portal pages
 * (one Solid SPA), the JSON API they call, and the `observe` lifecycle driver.
 * Mounted only when the injected port is the fake; unauthenticated by design —
 * the caller is a page this same server served, and these routes are never
 * mounted in production.
 *
 * Every change derives from the request plus the account's current projection
 * row, so any API instance can serve it.
 */
export class BillingMockRoutes {
  constructor(private readonly deps: BillingMockDeps) {}

  build(): Hono {
    const page = (c: Context) => serveMockBillingFile(c.req.url, '/index.html');
    return new Hono()
      .get('/billing/mock/checkout', page)
      .get('/billing/mock/portal', page)
      .get('/billing/mock/favicon.svg', (c) =>
        serveMockBillingFile(c.req.url, '/favicon.svg')
      )
      .get(`/billing/mock/${MOCK_BILLING_ASSETS.js}`, (c) =>
        serveMockBillingFile(c.req.url, `/${MOCK_BILLING_ASSETS.js}`)
      )
      .get(`/billing/mock/${MOCK_BILLING_ASSETS.css}`, (c) =>
        serveMockBillingFile(c.req.url, `/${MOCK_BILLING_ASSETS.css}`)
      )
      .get(
        '/billing/mock/api/state',
        zValidator('query', stateQuerySchema),
        async (c) => await this.state(c, c.req.valid('query').accountId)
      )
      .post(
        '/billing/mock/api/checkout',
        zValidator('json', mockCheckoutBodySchema),
        async (c) => await this.checkout(c, c.req.valid('json'))
      )
      .post(
        '/billing/mock/api/portal',
        zValidator('json', mockPortalBodySchema),
        async (c) => await this.portal(c, c.req.valid('json'))
      )
      .post(
        '/billing/mock/observe',
        zValidator('json', observeSchema),
        async (c) => await this.observe(c, c.req.valid('json'))
      );
  }

  private async state(c: Context, accountId: string): Promise<Response> {
    const current = await readCurrent(this.deps.getSqlClient(), accountId);
    return c.json(stateOf(this.deps, current), 200);
  }

  private async checkout(
    c: Context,
    body: MockCheckoutBody
  ): Promise<Response> {
    if (this.deps.offer.prices[body.priceKey] === undefined) {
      return c.json({ error: `Unknown price ${body.priceKey}` }, 400);
    }
    const current = await readCurrent(this.deps.getSqlClient(), body.accountId);
    if (currentIsLive(current)) {
      // Paying twice is a no-op: the page shows the live membership instead.
      return c.json(stateOf(this.deps, current), 200);
    }
    await applyDerived({
      deps: this.deps,
      accountId: body.accountId,
      current,
      derived: checkoutChange({
        deps: this.deps,
        accountId: body.accountId,
        current,
        priceKey: body.priceKey,
      }),
    });
    return await this.state(c, body.accountId);
  }

  private async portal(c: Context, body: MockPortalBody): Promise<Response> {
    const current = await readCurrent(this.deps.getSqlClient(), body.accountId);
    if (current === null) {
      return c.json({ error: 'No membership for this account' }, 404);
    }
    const { action } = body;
    if (
      action.kind === 'switch' &&
      this.deps.offer.prices[action.priceKey] === undefined
    ) {
      return c.json({ error: `Unknown price ${action.priceKey}` }, 400);
    }
    await applyDerived({
      deps: this.deps,
      accountId: body.accountId,
      current,
      derived: portalChange(this.deps, current, action),
    });
    return await this.state(c, body.accountId);
  }

  private async observe(
    c: Context,
    body: z.infer<typeof observeSchema>
  ): Promise<Response> {
    const current = await readCurrent(this.deps.getSqlClient(), body.accountId);
    if (current === null) {
      return c.json({ error: 'No membership for this account' }, 404);
    }
    if (
      body.kind === 'switch_interval' &&
      otherSwitchablePrice(this.deps.offer, current) === undefined
    ) {
      return c.json({ error: 'No alternative price to switch to' }, 400);
    }
    const change = await applyDerived({
      deps: this.deps,
      accountId: body.accountId,
      current,
      derived: observeChange(this.deps, current, body.kind),
    });
    return c.json(change, 200);
  }
}

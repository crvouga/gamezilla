import { ACCOUNT_ENTITY_TYPE, AccountAttr } from '@gamezilla/domain/auth';
import type { EntityDb } from '@gamezilla/lib/entity-db/interface';
import { createLogger } from '@gamezilla/lib/logger';
import type { PatchesDb } from '@gamezilla/patch-db/interface';
import { zValidator } from '@hono/zod-validator';
import type { Context } from 'hono';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import Stripe from 'stripe';
import { z } from 'zod';
import { getStripeCatalogPriceStripeId } from './stripe-catalog-mirror';

const log = createLogger({ name: 'stripe:checkout' });

export type StripeAuthContext = {
  readonly accountId: string;
  readonly principalId: string;
};

/** Resolve session principal + account from the API Worker auth layer. */
export type StripeRequireAuth = (
  db: PatchesDb,
  request: Request
) => Promise<StripeAuthContext>;

const checkoutBodySchema = z.object({
  priceKey: z.union([
    z.literal('subscription_monthly'),
    z.literal('subscription_yearly'),
  ]),
  successUrl: z.url(),
  cancelUrl: z.url(),
});

const portalBodySchema = z.object({
  returnUrl: z.url(),
});

type CheckoutValidated = z.infer<typeof checkoutBodySchema>;
type PortalValidated = z.infer<typeof portalBodySchema>;

async function handleStripeCheckout(
  c: Context,
  body: CheckoutValidated,
  args: {
    readonly db: PatchesDb;
    readonly stripe: Stripe;
    readonly stripeCache: EntityDb<unknown>;
    readonly requireAuth: StripeRequireAuth;
  }
): Promise<Response> {
  const { db, stripe, stripeCache, requireAuth } = args;
  const { accountId, principalId } = await requireAuth(db, c.req.raw);

  const priceId = await getStripeCatalogPriceStripeId(
    stripeCache,
    body.priceKey
  );
  if (priceId === null || priceId.length === 0) {
    log.error(
      'checkout: no catalog_price row for priceKey — run stripe catalog sync with DB_URL so API payloads are dumped to entity db'
    );
    return c.json(
      {
        error:
          'Stripe price is not available yet (missing catalog row in entity db)',
      },
      503
    );
  }

  const [accRes] = await db.read([
    { entityType: ACCOUNT_ENTITY_TYPE, entityId: accountId, limit: 1 },
  ]);
  const account = accRes?.entities[0];
  const existingRaw = account?.attributes[AccountAttr.stripeCustomerId];
  let stripeCustomerId =
    typeof existingRaw === 'string' && existingRaw.length > 0
      ? existingRaw
      : null;

  if (stripeCustomerId === null) {
    const customer = await stripe.customers.create({
      metadata: { account_id: accountId, principal_id: principalId },
    });
    stripeCustomerId = customer.id;
    await db.write([
      {
        entityId: accountId,
        entityType: ACCOUNT_ENTITY_TYPE,
        attributes: {
          [AccountAttr.stripeCustomerId]: customer.id,
          'patch/createdBy': principalId,
        },
      },
    ]);
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: stripeCustomerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: body.successUrl,
    cancel_url: body.cancelUrl,
    allow_promotion_codes: true,
    automatic_tax: { enabled: true },
  });

  if (session.url === null || session.url.length === 0) {
    log.error('checkout: Stripe returned empty session.url', {
      sessionId: session.id,
    });
    return c.json({ error: 'Checkout session URL missing' }, 502);
  }

  return c.json({ url: session.url }, 200);
}

async function handleStripePortal(
  c: Context,
  body: PortalValidated,
  args: {
    readonly db: PatchesDb;
    readonly stripe: Stripe;
    readonly requireAuth: StripeRequireAuth;
  }
): Promise<Response> {
  const { db, stripe, requireAuth } = args;
  const { accountId } = await requireAuth(db, c.req.raw);

  const [accRes] = await db.read([
    { entityType: ACCOUNT_ENTITY_TYPE, entityId: accountId, limit: 1 },
  ]);
  const account = accRes?.entities[0];
  const stripeCustomerIdRaw = account?.attributes[AccountAttr.stripeCustomerId];
  const stripeCustomerId =
    typeof stripeCustomerIdRaw === 'string' && stripeCustomerIdRaw.length > 0
      ? stripeCustomerIdRaw
      : null;

  if (stripeCustomerId === null) {
    throw new HTTPException(404, {
      message: 'No Stripe customer for this account',
    });
  }

  const portal = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: body.returnUrl,
  });

  if (portal.url === null || portal.url.length === 0) {
    log.error('portal: Stripe returned empty portal.url', {
      portalId: portal.id,
    });
    return c.json({ error: 'Billing portal URL missing' }, 502);
  }

  return c.json({ url: portal.url }, 200);
}

export function createStripeCheckoutRoutes(args: {
  readonly db: PatchesDb;
  readonly stripe: Stripe | null;
  readonly stripeCache: EntityDb<unknown>;
  readonly requireAuth: StripeRequireAuth;
}) {
  const { db, stripe, stripeCache, requireAuth } = args;

  return new Hono()
    .post(
      '/stripe/checkout',
      zValidator('json', checkoutBodySchema),
      async (c) => {
        if (stripe === null) {
          return c.json({ error: 'Stripe is not configured' }, 503);
        }
        const body = c.req.valid('json');
        return handleStripeCheckout(c, body, {
          db,
          stripe,
          stripeCache,
          requireAuth,
        });
      }
    )
    .post('/stripe/portal', zValidator('json', portalBodySchema), async (c) => {
      if (stripe === null) {
        return c.json({ error: 'Stripe is not configured' }, 503);
      }
      const body = c.req.valid('json');
      return handleStripePortal(c, body, { db, stripe, requireAuth });
    });
}

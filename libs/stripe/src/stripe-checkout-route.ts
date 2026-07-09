import { AccountCol, ACCOUNTS_TABLE } from '@libs/auth/shared/auth-tables';
import { createLogger } from '@pkgs/logger';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { zValidator } from '@hono/zod-validator';
import type { Context } from 'hono';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type Stripe from 'stripe';
import { z } from 'zod';
import { STRIPE_CATALOG_PRICE_KEYS } from './catalog-spec';
import { getStripeCatalogPriceStripeId } from './stripe-catalog-mirror';

const log = createLogger({ name: 'stripe:checkout' });

export type StripeAuthContext = {
  readonly accountId: string;
  readonly deviceId: string;
};

export type StripeRequireAuth = (
  sql: SqlClient,
  request: Request
) => Promise<StripeAuthContext>;

const checkoutBodySchema = z.object({
  priceKey: z.enum(STRIPE_CATALOG_PRICE_KEYS),
  successUrl: z.url(),
  cancelUrl: z.url(),
});

const portalBodySchema = z.object({
  returnUrl: z.url(),
});

type CheckoutValidated = z.infer<typeof checkoutBodySchema>;
type PortalValidated = z.infer<typeof portalBodySchema>;

async function readStripeCustomerId(
  sql: SqlClient,
  accountId: string
): Promise<string | null> {
  const rows = await sql.query<Record<string, unknown>>(
    `SELECT ${AccountCol.stripeCustomerId} FROM ${ACCOUNTS_TABLE.tableName}
     WHERE ${AccountCol.id} = ? LIMIT 1`,
    [accountId]
  );
  const raw = rows[0]?.[AccountCol.stripeCustomerId];
  return typeof raw === 'string' && raw.length > 0 ? raw : null;
}

async function ensureStripeCustomerId(args: {
  readonly sql: SqlClient;
  readonly stripe: Stripe;
  readonly auth: StripeAuthContext;
}): Promise<string> {
  const { sql, stripe, auth } = args;
  const { accountId, deviceId } = auth;
  const existing = await readStripeCustomerId(sql, accountId);
  if (existing !== null) return existing;

  const customer = await stripe.customers.create({
    metadata: { account_id: accountId, device_id: deviceId },
  });
  await sql.run(
    `UPDATE ${ACCOUNTS_TABLE.tableName}
     SET ${AccountCol.stripeCustomerId} = ?
     WHERE ${AccountCol.id} = ?`,
    [customer.id, accountId]
  );
  return customer.id;
}

async function handleStripeCheckout(
  c: Context,
  body: CheckoutValidated,
  args: {
    readonly sql: SqlClient;
    readonly stripe: Stripe;
    readonly requireAuth: StripeRequireAuth;
  }
): Promise<Response> {
  const { sql, stripe, requireAuth } = args;
  const auth = await requireAuth(sql, c.req.raw);

  const priceId = await getStripeCatalogPriceStripeId(sql, body.priceKey);
  if (priceId === null || priceId.length === 0) {
    log.error(
      'checkout: no catalog_price row for priceKey — run stripe catalog sync'
    );
    return c.json(
      {
        error:
          'Stripe price is not available yet (missing catalog row in entity_store)',
      },
      503
    );
  }

  const stripeCustomerId = await ensureStripeCustomerId({ sql, stripe, auth });

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
    readonly sql: SqlClient;
    readonly stripe: Stripe;
    readonly requireAuth: StripeRequireAuth;
  }
): Promise<Response> {
  const { sql, stripe, requireAuth } = args;
  const auth = await requireAuth(sql, c.req.raw);
  const stripeCustomerId = await readStripeCustomerId(sql, auth.accountId);

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
  readonly getSqlClient: () => SqlClient;
  readonly stripe: Stripe | null;
  readonly requireAuth: StripeRequireAuth;
}) {
  const { getSqlClient, stripe, requireAuth } = args;

  return new Hono()
    .post(
      '/stripe/checkout',
      zValidator('json', checkoutBodySchema),
      async (c) => {
        if (stripe === null) {
          return c.json({ error: 'Stripe is not configured' }, 503);
        }
        const body = c.req.valid('json');
        const sql = getSqlClient();
        return handleStripeCheckout(c, body, {
          sql,
          stripe,
          requireAuth,
        });
      }
    )
    .post('/stripe/portal', zValidator('json', portalBodySchema), async (c) => {
      if (stripe === null) {
        return c.json({ error: 'Stripe is not configured' }, 503);
      }
      const body = c.req.valid('json');
      const sql = getSqlClient();
      return handleStripePortal(c, body, { sql, stripe, requireAuth });
    });
}

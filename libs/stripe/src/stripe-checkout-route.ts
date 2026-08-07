import { zValidator } from '@hono/zod-validator';
import { readExternalAccountId } from '@libs/auth/server/external-accounts-sql';
import { EXTERNAL_ACCOUNT_PROVIDER_STRIPE } from '@libs/auth/shared/external-account-providers';
import { createLogger } from '@pkgs/logger';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { Context } from 'hono';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type Stripe from 'stripe';
import { z } from 'zod';
import { STRIPE_CATALOG_PRICE_KEYS } from './catalog-spec';

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
  return readExternalAccountId(
    sql,
    accountId,
    EXTERNAL_ACCOUNT_PROVIDER_STRIPE
  );
}

async function handleStripeCheckout(
  c: Context,
  body: CheckoutValidated,
  args: {
    readonly sql: SqlClient;
    readonly requireAuth: StripeRequireAuth;
  }
): Promise<Response> {
  const { sql, requireAuth } = args;
  await requireAuth(sql, c.req.raw);

  // Catalog price → Stripe price id previously came from entity_store.
  // Fail closed until Stripe rewires onto `@pkgs/entity-store`.
  log.error(
    'checkout: catalog price lookup unavailable — entity_store dump removed; rewire onto @pkgs/entity-store',
    { priceKey: body.priceKey }
  );
  return c.json(
    {
      error:
        'Stripe checkout is temporarily unavailable (catalog price lookup not wired)',
    },
    503
  );
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

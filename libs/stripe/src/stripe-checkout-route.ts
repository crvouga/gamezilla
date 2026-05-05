import { ACCOUNT_ENTITY_TYPE, AccountAttr } from '@gamezilla/domain/auth';
import { createLogger } from '@gamezilla/lib/logger';
import type {
  PatchDb,
  PatchDbAuthContext,
} from '@gamezilla/patch-db/interface';
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
  readonly clientId: string;
  readonly accountId: string;
  readonly deviceId: string;
};

/** Resolve session device + account from the API Worker auth layer. */
export type StripeRequireAuth = (
  db: PatchDb,
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

function stripePatchDbContext(auth: StripeAuthContext): PatchDbAuthContext {
  // `accountId` / `memberOfSpaceIds` / etc. are app-level claims consumed by
  // visibility policies. They're plain extra keys on the auth context — the
  // patch-db library itself only needs `deviceId`.
  return {
    clientId: auth.clientId,
    deviceId: auth.deviceId,
    accountId: auth.accountId,
    memberOfSpaceIds: [] as readonly string[],
    friendUserIds: [] as readonly string[],
    blockedUserIds: [] as readonly string[],
  };
}

async function ensureStripeCustomerId(args: {
  readonly db: PatchDb;
  readonly stripe: Stripe;
  readonly auth: StripeAuthContext;
  readonly patchCtx: PatchDbAuthContext;
}): Promise<string> {
  const { db, stripe, auth, patchCtx } = args;
  const { accountId, deviceId } = auth;

  const [accRes] = await db.read(
    [{ entityType: ACCOUNT_ENTITY_TYPE, entityId: accountId, limit: 1 }],
    patchCtx
  );
  const account = accRes?.entities[0];
  const existingRaw = account?.attributes[AccountAttr.stripeCustomerId];
  if (typeof existingRaw === 'string' && existingRaw.length > 0) {
    return existingRaw;
  }

  const customer = await stripe.customers.create({
    metadata: { account_id: accountId, device_id: deviceId },
  });
  await db.write(
    [
      {
        entityId: accountId,
        entityType: ACCOUNT_ENTITY_TYPE,
        attributes: {
          [AccountAttr.stripeCustomerId]: customer.id,
          'patch/createdById': deviceId,
        },
      },
    ],
    patchCtx
  );
  return customer.id;
}

async function handleStripeCheckout(
  c: Context,
  body: CheckoutValidated,
  args: {
    readonly db: PatchDb;
    readonly stripe: Stripe;
    readonly requireAuth: StripeRequireAuth;
  }
): Promise<Response> {
  const { db, stripe, requireAuth } = args;
  const auth = await requireAuth(db, c.req.raw);
  const patchCtx = stripePatchDbContext(auth);

  const priceId = await getStripeCatalogPriceStripeId(
    db,
    patchCtx,
    body.priceKey
  );
  if (priceId === null || priceId.length === 0) {
    log.error(
      'checkout: no catalog_price row for priceKey — run stripe catalog sync with DB_URL so API payloads are dumped to patch-db'
    );
    return c.json(
      {
        error:
          'Stripe price is not available yet (missing catalog row in patch-db)',
      },
      503
    );
  }

  const stripeCustomerId = await ensureStripeCustomerId({
    db,
    stripe,
    auth,
    patchCtx,
  });

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
    readonly db: PatchDb;
    readonly stripe: Stripe;
    readonly requireAuth: StripeRequireAuth;
  }
): Promise<Response> {
  const { db, stripe, requireAuth } = args;
  const auth = await requireAuth(db, c.req.raw);
  const { accountId } = auth;
  const patchCtx = stripePatchDbContext(auth);

  const [accRes] = await db.read(
    [{ entityType: ACCOUNT_ENTITY_TYPE, entityId: accountId, limit: 1 }],
    patchCtx
  );
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
  readonly db: PatchDb;
  readonly stripe: Stripe | null;
  readonly requireAuth: StripeRequireAuth;
}) {
  const { db, stripe, requireAuth } = args;

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

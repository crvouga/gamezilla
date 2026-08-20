import { zValidator } from '@hono/zod-validator';
import { EXTERNAL_ACCOUNT_PROVIDER_BILLING } from '@libs/auth/public/external-account-providers';
import { ExternalAccountRepository } from '@libs/auth/public/external-account-repository';
import type { Billing } from '@pkgs/billing';
import { createLogger, type Logger } from '@pkgs/logger';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { Context } from 'hono';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { CATALOG_PRICE_KEYS } from '../../../shared/catalog/catalog-spec';

export type BillingAuthContext = {
  readonly accountId: string;
  readonly deviceId: string;
};

export type BillingRequireAuth = (
  sql: SqlClient,
  request: Request
) => Promise<BillingAuthContext>;

const checkoutBodySchema = z.object({
  priceKey: z.enum(CATALOG_PRICE_KEYS),
  successUrl: z.url(),
  cancelUrl: z.url(),
});

const portalBodySchema = z.object({
  returnUrl: z.url(),
});

type CheckoutValidated = z.infer<typeof checkoutBodySchema>;
type PortalValidated = z.infer<typeof portalBodySchema>;

async function readBillingCustomerId(
  sql: SqlClient,
  accountId: string
): Promise<string | null> {
  return new ExternalAccountRepository(sql).readExternalAccountId(
    accountId,
    EXTERNAL_ACCOUNT_PROVIDER_BILLING
  );
}

async function handleBillingCheckout(
  c: Context,
  body: CheckoutValidated,
  args: {
    readonly sql: SqlClient;
    readonly requireAuth: BillingRequireAuth;
    readonly log: Logger;
  }
): Promise<Response> {
  const { sql, requireAuth, log } = args;
  await requireAuth(sql, c.req.raw);

  // Catalog price → provider price id previously came from entity_store.
  // Fail closed until billing rewires onto `@pkgs/entity-store`.
  log.error(
    'checkout: catalog price lookup unavailable — entity_store dump removed; rewire onto @pkgs/entity-store',
    { priceKey: body.priceKey }
  );
  return c.json(
    {
      error:
        'Billing checkout is temporarily unavailable (catalog price lookup not wired)',
    },
    503
  );
}

async function handleBillingPortal(
  c: Context,
  body: PortalValidated,
  args: {
    readonly sql: SqlClient;
    readonly billing: Billing;
    readonly requireAuth: BillingRequireAuth;
    readonly log: Logger;
  }
): Promise<Response> {
  const { sql, billing, requireAuth, log } = args;
  const auth = await requireAuth(sql, c.req.raw);
  const customerId = await readBillingCustomerId(sql, auth.accountId);

  if (customerId === null) {
    throw new HTTPException(404, {
      message: 'No billing customer for this account',
    });
  }

  const portal = await billing.createPortalSession({
    customerId,
    returnUrl: body.returnUrl,
  });

  if (portal.url.length === 0) {
    log.error('portal: billing returned empty portal.url', {
      portalId: portal.id,
    });
    return c.json({ error: 'Billing portal URL missing' }, 502);
  }

  return c.json({ url: portal.url }, 200);
}

export class BillingCheckoutRoutes {
  private readonly log: Logger;

  constructor(
    private readonly getSqlClient: () => SqlClient,
    private readonly billing: Billing | null,
    private readonly requireAuth: BillingRequireAuth,
    now: () => number
  ) {
    this.log = createLogger({ name: 'billing:checkout', now });
  }

  build(): Hono {
    const { getSqlClient, billing, requireAuth, log } = this;

    return new Hono()
      .post(
        '/billing/checkout',
        zValidator('json', checkoutBodySchema),
        async (c) => {
          if (billing === null) {
            return c.json({ error: 'Billing is not configured' }, 503);
          }
          const body = c.req.valid('json');
          const sql = getSqlClient();
          return handleBillingCheckout(c, body, {
            sql,
            requireAuth,
            log,
          });
        }
      )
      .post(
        '/billing/portal',
        zValidator('json', portalBodySchema),
        async (c) => {
          if (billing === null) {
            return c.json({ error: 'Billing is not configured' }, 503);
          }
          const body = c.req.valid('json');
          const sql = getSqlClient();
          return handleBillingPortal(c, body, {
            sql,
            billing,
            requireAuth,
            log,
          });
        }
      );
  }
}

import { zValidator } from '@hono/zod-validator';
import { EXTERNAL_ACCOUNT_PROVIDER_BILLING } from '@libs/auth/public/external-account-providers';
import { ExternalAccountRepository } from '@libs/auth/public/external-account-repository';
import type { Billing, BillingEvent } from '@pkgs/billing';
import type { Clock } from '@pkgs/clock';
import { createLogger, type Logger } from '@pkgs/logger';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { CreateId } from '@pkgs/uuid/create-id';
import type { Context } from 'hono';
import { Hono } from 'hono';
import { z } from 'zod';
import { CATALOG_PRICE_KEYS } from '../../../shared/catalog/catalog-spec';
import { BillingSubscriptionRepository } from '../../apply-subscription-state/server/billing-subscription-repository';

export type BillingAuthContext = {
  readonly accountId: string;
  readonly deviceId: string;
};

export type BillingRequireAuth = (
  sql: SqlClient,
  request: Request
) => Promise<BillingAuthContext>;

/** Best-effort user-topic push after a DOMAIN write (app-injected). */
export type BillingNotify = (accountId: string, label: string) => Promise<void>;

export type BillingRoutesDeps = {
  readonly getSqlClient: () => SqlClient;
  readonly billing: Billing | null;
  readonly requireAuth: BillingRequireAuth;
  readonly createId: CreateId;
  readonly clock: Clock;
  readonly notifyUser: BillingNotify;
};

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

/** Reuses the linked customer, or mints and links one. */
async function ensureBillingCustomer(args: {
  readonly sql: SqlClient;
  readonly billing: Billing;
  readonly auth: BillingAuthContext;
  readonly createId: CreateId;
  readonly clock: Clock;
}): Promise<string> {
  const existing = await readBillingCustomerId(args.sql, args.auth.accountId);
  if (existing !== null) return existing;
  const created = await args.billing.createCustomer({
    accountId: args.auth.accountId,
  });
  await args.sql.transaction(async (tx) => {
    await new ExternalAccountRepository(tx).insertExternalAccountOrGet({
      userId: args.auth.accountId,
      provider: EXTERNAL_ACCOUNT_PROVIDER_BILLING,
      externalId: created.customerId,
      now: () => args.clock.now(),
      createId: args.createId,
    });
  });
  return created.customerId;
}

async function handleBillingCheckout(
  c: Context,
  body: CheckoutValidated,
  deps: BillingRoutesDeps & { readonly billing: Billing }
): Promise<Response> {
  const sql = deps.getSqlClient();
  const auth = await deps.requireAuth(sql, c.req.raw);
  const customerId = await ensureBillingCustomer({
    sql,
    billing: deps.billing,
    auth,
    createId: deps.createId,
    clock: deps.clock,
  });
  const session = await deps.billing.createCheckoutSession({
    customerId,
    priceKey: body.priceKey,
    successUrl: body.successUrl,
    cancelUrl: body.cancelUrl,
  });
  if (session.url.length === 0) {
    return c.json({ error: 'Billing checkout URL missing' }, 502);
  }
  return c.json({ url: session.url }, 200);
}

async function handleBillingPortal(
  c: Context,
  body: PortalValidated,
  deps: BillingRoutesDeps & { readonly billing: Billing }
): Promise<Response> {
  const sql = deps.getSqlClient();
  const auth = await deps.requireAuth(sql, c.req.raw);
  const customerId = await readBillingCustomerId(sql, auth.accountId);
  if (customerId === null) {
    return c.json({ error: 'No billing customer for this account' }, 404);
  }
  const portal = await deps.billing.createPortalSession({
    customerId,
    returnUrl: body.returnUrl,
  });
  if (portal.url.length === 0) {
    return c.json({ error: 'Billing portal URL missing' }, 502);
  }
  return c.json({ url: portal.url }, 200);
}

async function handleBillingWebhook(
  c: Context,
  deps: BillingRoutesDeps & { readonly billing: Billing },
  log: Logger
): Promise<Response> {
  const signature = c.req.header('stripe-signature') ?? '';
  const rawBody = await c.req.text();
  let event: BillingEvent;
  try {
    event = await deps.billing.verifyWebhook({ rawBody, signature });
  } catch {
    log.warn('billing webhook: signature verification failed');
    return c.json({ error: 'Invalid webhook signature' }, 400);
  }
  if (event.kind === 'ignored') {
    return c.json({ received: true }, 200);
  }
  if (event.accountId === null) {
    // Provider identity never linked to an account: nothing to project.
    return c.json({ received: true }, 200);
  }
  const accountId = event.accountId;
  const sql = deps.getSqlClient();
  await sql.transaction(async (tx) => {
    await new BillingSubscriptionRepository(tx, deps.clock).upsert({
      accountId,
      providerSubscriptionId: event.providerSubscriptionId,
      priceKey: event.priceKey,
      status: event.status,
      currentPeriodEndMs: event.currentPeriodEndMs,
      cancelAtPeriodEnd: event.cancelAtPeriodEnd,
    });
  });
  await deps.notifyUser(accountId, 'billing:subscription');
  return c.json({ received: true }, 200);
}

export class BillingCheckoutRoutes {
  private readonly log: Logger;

  constructor(private readonly deps: BillingRoutesDeps) {
    this.log = createLogger({
      name: 'billing:checkout',
      now: () => deps.clock.now(),
    });
  }

  build(): Hono {
    const deps = this.deps;
    const log = this.log;
    return new Hono()
      .post(
        '/billing/checkout',
        zValidator('json', checkoutBodySchema),
        async (c) => {
          if (deps.billing === null) {
            return c.json({ error: 'Billing is not configured' }, 503);
          }
          return handleBillingCheckout(c, c.req.valid('json'), {
            ...deps,
            billing: deps.billing,
          });
        }
      )
      .post(
        '/billing/portal',
        zValidator('json', portalBodySchema),
        async (c) => {
          if (deps.billing === null) {
            return c.json({ error: 'Billing is not configured' }, 503);
          }
          return handleBillingPortal(c, c.req.valid('json'), {
            ...deps,
            billing: deps.billing,
          });
        }
      )
      .post('/billing/webhook', async (c) => {
        if (deps.billing === null) {
          return c.json({ error: 'Billing is not configured' }, 503);
        }
        return handleBillingWebhook(c, { ...deps, billing: deps.billing }, log);
      });
  }
}

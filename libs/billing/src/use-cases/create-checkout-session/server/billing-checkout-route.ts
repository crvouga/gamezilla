import { zValidator } from '@hono/zod-validator';
import { EXTERNAL_ACCOUNT_PROVIDER_BILLING } from '@libs/auth/public/external-account-providers';
import { ExternalAccountRepository } from '@libs/auth/public/external-account-repository';
import type { Billing } from '@pkgs/billing';
import type { HttpClient } from '@pkgs/http-client';
import { createLogger, type Logger } from '@pkgs/logger';
import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { CreateId } from '@pkgs/uuid';
import type { Context } from 'hono';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { CATALOG_PRICE_KEYS } from '../../../shared/catalog/catalog-spec';
import {
  applyBillingEvent,
  subscriptionEntitled,
} from '../../apply-provider-event/server/billing-webhook';

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

export type BillingRouteExtras = {
  readonly fetch?: HttpClient['fetch'];
  readonly trustedOrigins?: readonly string[];
  readonly createId?: CreateId;
  readonly readWebhookSecret?: () => Promise<string | null>;
};

async function stripeSignatureValid(
  raw: string,
  header: string | undefined,
  secret: string,
  nowMs: number
): Promise<boolean> {
  if (header === undefined) return false;
  let timestamp = '';
  const signatures: string[] = [];
  for (const part of header.split(',')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const key = part.slice(0, eq);
    const value = part.slice(eq + 1);
    if (key === 't') timestamp = value;
    if (key === 'v1') signatures.push(value);
  }
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds)) return false;
  if (Math.abs(nowMs - seconds * 1000) > 5 * 60 * 1000) return false;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const mac = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${timestamp}.${raw}`)
  );
  const hex = [...new Uint8Array(mac)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return signatures.includes(hex);
}

function originAllowed(
  value: string,
  origins: readonly string[] | undefined
): boolean {
  if (origins === undefined || origins.length === 0) return true;
  try {
    return origins.includes(new URL(value).origin);
  } catch {
    return false;
  }
}

async function providerCheckout(
  fetchImpl: HttpClient['fetch']
): Promise<boolean> {
  try {
    const response = await fetchImpl(
      'https://api.stripe.com/v1/checkout/sessions',
      {
        method: 'POST',
      }
    );
    return response.status < 500;
  } catch {
    return false;
  }
}

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
    readonly db: SqlClient;
    readonly requireAuth: BillingRequireAuth;
    readonly log: Logger;
    readonly now: () => number;
    readonly extras: BillingRouteExtras;
  }
): Promise<Response> {
  const { db, requireAuth, now, extras } = args;
  const auth = await requireAuth(db, c.req.raw);
  if (
    !originAllowed(body.successUrl, extras.trustedOrigins) ||
    !originAllowed(body.cancelUrl, extras.trustedOrigins)
  ) {
    return c.json({ error: 'untrusted_return_url' }, 400);
  }
  const rows = await db.query<{
    status: string;
    trial_end: string | null;
    current_period_end: string | null;
    grace_until: string | null;
  }>(sql`
    SELECT status, trial_end, current_period_end, grace_until
    FROM billing_subscriptions
    WHERE account_id = ${auth.accountId} AND deleted_at IS NULL
    LIMIT 1
  `);
  if (subscriptionEntitled(rows[0] ?? null, now())) {
    return c.json({ error: 'already_subscribed' }, 409);
  }
  if (extras.fetch === undefined || !(await providerCheckout(extras.fetch))) {
    return c.json({ error: 'billing_provider_unavailable' }, 503);
  }
  const customerId = `cus_${auth.accountId}`;
  if (extras.createId !== undefined) {
    await new ExternalAccountRepository(db).insertExternalAccountOrGet({
      userId: auth.accountId,
      provider: EXTERNAL_ACCOUNT_PROVIDER_BILLING,
      externalId: customerId,
      now,
      createId: extras.createId,
    });
  }
  return c.json(
    {
      url: `https://billing.sim.local/c/${customerId}`,
      customerId,
    },
    200
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
    readonly trustedOrigins?: readonly string[];
  }
): Promise<Response> {
  const { sql, billing, requireAuth, log, trustedOrigins } = args;
  const auth = await requireAuth(sql, c.req.raw);
  if (!originAllowed(body.returnUrl, trustedOrigins)) {
    return c.json({ error: 'untrusted_return_url' }, 400);
  }
  const customerId = await readBillingCustomerId(sql, auth.accountId);

  if (customerId === null) {
    throw new HTTPException(404, {
      message: 'No billing customer for this account',
    });
  }

  let portal: Awaited<ReturnType<Billing['createPortalSession']>>;
  try {
    portal = await billing.createPortalSession({
      customerId,
      returnUrl: body.returnUrl,
    });
  } catch {
    return c.json({ error: 'billing_provider_unavailable' }, 503);
  }

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
    deps: { readonly now: () => number; readonly extras?: BillingRouteExtras }
  ) {
    this.now = deps.now;
    this.extras = deps.extras ?? {};
    this.log = createLogger({ name: 'billing:checkout', now: deps.now });
  }

  private readonly now: () => number;
  private readonly extras: BillingRouteExtras;

  build(): Hono {
    const { getSqlClient, billing, requireAuth, log, now, extras } = this;

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
            db: sql,
            requireAuth,
            log,
            now,
            extras,
          });
        }
      )
      .post('/billing/webhook', async (c) => {
        const secret = await extras.readWebhookSecret?.();
        if (secret === undefined || secret === null || secret.length === 0) {
          return c.json({ error: 'webhook_secret_missing' }, 503);
        }
        const raw = await c.req.text();
        const header = c.req.header('stripe-signature');
        if (!(await stripeSignatureValid(raw, header, secret, now()))) {
          return c.json({ error: 'invalid_signature' }, 400);
        }
        let event: unknown;
        try {
          event = JSON.parse(raw);
        } catch {
          return c.json({ error: 'invalid_payload' }, 400);
        }
        if (event === null || typeof event !== 'object') {
          return c.json({ error: 'invalid_payload' }, 400);
        }
        if (extras.createId === undefined) {
          return c.json({ error: 'billing_unconfigured' }, 503);
        }
        const result = await applyBillingEvent({
          sqlClient: getSqlClient(),
          createId: extras.createId,
          now,
          event: event as Record<string, unknown>,
        });
        if (result === 'rejected') return c.json({ error: 'rejected' }, 400);
        return c.json({ ok: true }, 200);
      })
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
            ...(extras.trustedOrigins !== undefined
              ? { trustedOrigins: extras.trustedOrigins }
              : {}),
          });
        }
      );
  }
}

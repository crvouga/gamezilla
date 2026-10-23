import { zValidator } from '@hono/zod-validator';
import type { BillingRouteDeps } from '@libs/billing-shared-ts/billing-route-deps';
import {
  billingNotConfigured,
  billingProviderUnavailable,
} from '@libs/billing-shared-ts/billing-route-deps';
import { CustomerLinks } from '@libs/billing-shared-ts/customer-links';
import { MembershipRepository } from '@libs/billing-shared-ts/membership-repository';
import type { MembershipProviders } from '@pkgs/billing-root-shared-ts/providers';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import type { Context } from 'hono';
import { Hono } from 'hono';
import { z } from 'zod';

const portalBodySchema = z.object({
  returnUrl: z.url(),
});

type PortalValidated = z.infer<typeof portalBodySchema>;

/**
 * Which provider's portal to open: the one holding the membership that
 * governs the account; failing that, where new checkouts go; failing that,
 * any configured provider the account is a customer of. A member who joined
 * before a switch keeps managing their membership where it lives.
 */
function portalOrder(
  providers: MembershipProviders,
  governingProvider: string | null
): readonly string[] {
  const order = [
    ...(governingProvider === null ? [] : [governingProvider]),
    providers.checkout.provider,
    ...providers.byId.keys(),
  ];
  return [...new Set(order)].filter((id) => providers.byId.has(id));
}

async function findCustomer(
  sql: SqlClient,
  providers: MembershipProviders,
  accountId: string
): Promise<{ readonly provider: string; readonly customerId: string } | null> {
  const governing = await new MembershipRepository(sql).governing(accountId);
  const links = new CustomerLinks(sql);
  for (const provider of portalOrder(providers, governing?.provider ?? null)) {
    const customerId = await links.customerOf(accountId, provider);
    if (customerId !== null) return { provider, customerId };
  }
  return null;
}

async function handleBillingPortal(
  c: Context,
  body: PortalValidated,
  deps: BillingRouteDeps & { readonly providers: MembershipProviders }
): Promise<Response> {
  const sql = deps.getSqlClient();
  const auth = await deps.requireAuth(sql, c.req.raw);
  const found = await findCustomer(sql, deps.providers, auth.accountId);
  const billing =
    found === null ? undefined : deps.providers.byId.get(found.provider);
  if (found === null || billing === undefined) {
    return c.json({ error: 'No billing customer for this account' }, 404);
  }
  let portal: { readonly url: string };
  try {
    portal = await billing.openPortal({
      accountId: auth.accountId,
      customerId: found.customerId,
      returnUrl: body.returnUrl,
    });
  } catch (error) {
    return billingProviderUnavailable(c, deps.log, {
      provider: billing.provider,
      operation: 'portal',
      error,
    });
  }
  if (portal.url.length === 0) {
    return c.json({ error: 'Billing portal URL missing' }, 502);
  }
  return c.json({ url: portal.url }, 200);
}

export class BillingPortalRoutes {
  constructor(private readonly deps: BillingRouteDeps) {}

  build(): Hono {
    const deps = this.deps;
    return new Hono().post(
      '/billing/portal',
      zValidator('json', portalBodySchema),
      async (c) => {
        if (deps.billing === null) return billingNotConfigured(c);
        return await handleBillingPortal(c, c.req.valid('json'), {
          ...deps,
          providers: deps.billing,
        });
      }
    );
  }
}

import { zValidator } from '@hono/zod-validator';
import { EXTERNAL_ACCOUNT_PROVIDER_BILLING } from '@libs/auth/public/external-account-providers';
import { ExternalAccountRepository } from '@libs/auth/public/external-account-repository';
import type { MembershipBilling } from '@pkgs/billing';
import type { Context } from 'hono';
import { Hono } from 'hono';
import { z } from 'zod';

import {
  type BillingRouteDeps,
  billingNotConfigured,
} from '../../../shared/routes/billing-route-deps';

const portalBodySchema = z.object({
  returnUrl: z.url(),
});

type PortalValidated = z.infer<typeof portalBodySchema>;

async function handleBillingPortal(
  c: Context,
  body: PortalValidated,
  deps: BillingRouteDeps & { readonly billing: MembershipBilling }
): Promise<Response> {
  const sql = deps.getSqlClient();
  const auth = await deps.requireAuth(sql, c.req.raw);
  const customerId = await new ExternalAccountRepository(
    sql
  ).readExternalAccountId(auth.accountId, EXTERNAL_ACCOUNT_PROVIDER_BILLING);
  if (customerId === null) {
    return c.json({ error: 'No billing customer for this account' }, 404);
  }
  const portal = await deps.billing.openPortal({
    accountId: auth.accountId,
    customerId,
    returnUrl: body.returnUrl,
  });
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
          billing: deps.billing,
        });
      }
    );
  }
}

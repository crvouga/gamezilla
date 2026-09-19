import { zValidator } from '@hono/zod-validator';
import { EXTERNAL_ACCOUNT_PROVIDER_BILLING } from '@libs/auth/public/external-account-providers';
import { ExternalAccountRepository } from '@libs/auth/public/external-account-repository';
import type { MembershipBilling } from '@pkgs/billing';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { Context } from 'hono';
import { Hono } from 'hono';
import { z } from 'zod';

import {
  type BillingRouteDeps,
  billingNotConfigured,
} from '../../../shared/routes/billing-route-deps';

const checkoutBodySchema = z.object({
  returnUrl: z.url(),
});

type CheckoutValidated = z.infer<typeof checkoutBodySchema>;

/** Links a freshly minted customer so the account can be found later. */
async function linkCustomer(args: {
  readonly sql: SqlClient;
  readonly accountId: string;
  readonly customerId: string;
  readonly createId: BillingRouteDeps['createId'];
  readonly clock: BillingRouteDeps['clock'];
}): Promise<void> {
  await args.sql.transaction(async (tx) => {
    await new ExternalAccountRepository(tx).insertExternalAccountOrGet({
      userId: args.accountId,
      provider: EXTERNAL_ACCOUNT_PROVIDER_BILLING,
      externalId: args.customerId,
      now: () => args.clock.now(),
      createId: args.createId,
    });
  });
}

async function handleBillingCheckout(
  c: Context,
  body: CheckoutValidated,
  deps: BillingRouteDeps & { readonly billing: MembershipBilling }
): Promise<Response> {
  const sql = deps.getSqlClient();
  const auth = await deps.requireAuth(sql, c.req.raw);
  const existing = await new ExternalAccountRepository(
    sql
  ).readExternalAccountId(auth.accountId, EXTERNAL_ACCOUNT_PROVIDER_BILLING);

  const checkout = await deps.billing.startCheckout({
    accountId: auth.accountId,
    customerId: existing,
    returnUrl: body.returnUrl,
  });

  if (existing === null) {
    await linkCustomer({
      sql,
      accountId: auth.accountId,
      customerId: checkout.customerId,
      createId: deps.createId,
      clock: deps.clock,
    });
    // The customer link is a synced DOMAIN row (the client reads it to decide
    // whether a portal session is possible), so it needs its own push.
    await deps.notifyUser(auth.accountId, 'billing:customer', [
      'auth_external_accounts',
    ]);
  }

  if (checkout.url.length === 0) {
    return c.json({ error: 'Billing checkout URL missing' }, 502);
  }
  return c.json({ url: checkout.url }, 200);
}

export class BillingCheckoutRoutes {
  constructor(private readonly deps: BillingRouteDeps) {}

  build(): Hono {
    const deps = this.deps;
    return new Hono().post(
      '/billing/checkout',
      zValidator('json', checkoutBodySchema),
      async (c) => {
        if (deps.billing === null) return billingNotConfigured(c);
        return await handleBillingCheckout(c, c.req.valid('json'), {
          ...deps,
          billing: deps.billing,
        });
      }
    );
  }
}

import { zValidator } from '@hono/zod-validator';
import { ExternalAccountRepository } from '@libs/auth-shared/external-account-repository';
import { isMembershipLive, readMembershipStatus } from '@pkgs/billing-shared/precedence';
import type { MembershipBilling } from '@pkgs/billing-shared/membership';
import type { Context } from 'hono';
import { Hono } from 'hono';
import { z } from 'zod';

import { CustomerLinks } from '@libs/billing-shared/customer-links';
import { MembershipRepository } from '@libs/billing-shared/membership-repository';
import type { BillingRouteDeps } from '@libs/billing-shared/billing-route-deps';
import { billingNotConfigured } from '@libs/billing-shared/billing-route-deps';

const checkoutBodySchema = z.object({
  returnUrl: z.url(),
});

type CheckoutValidated = z.infer<typeof checkoutBodySchema>;

/**
 * Starts a membership at the provider new checkouts go to. An account that
 * is already a member — at any provider — manages that membership instead:
 * two live memberships would bill one person twice.
 */
async function handleBillingCheckout(
  c: Context,
  body: CheckoutValidated,
  deps: BillingRouteDeps & { readonly provider: MembershipBilling }
): Promise<Response> {
  const sql = deps.getSqlClient();
  const auth = await deps.requireAuth(sql, c.req.raw);
  const governing = await new MembershipRepository(sql).governing(
    auth.accountId
  );
  if (
    governing !== null &&
    isMembershipLive(readMembershipStatus(governing.status))
  ) {
    return c.json({ error: 'This account already has a membership' }, 409);
  }
  const { provider } = deps;
  const links = new CustomerLinks(sql);
  const existing = await links.customerOf(auth.accountId, provider.provider);
  const checkout = await provider.startCheckout({
    accountId: auth.accountId,
    customerId: existing,
    email: await new ExternalAccountRepository(sql).readAccountEmail(
      auth.accountId
    ),
    returnUrl: body.returnUrl,
  });
  if (existing === null) {
    const owner = await sql.transaction((tx) =>
      new CustomerLinks(tx).link({
        accountId: auth.accountId,
        provider: provider.provider,
        customerId: checkout.customerId,
        now: () => deps.clock.now(),
        createId: deps.createId,
      })
    );
    if (owner !== auth.accountId) {
      // The provider answered with a customer another account holds: paying
      // through it would credit that account.
      deps.log.error('billing checkout: customer belongs to another account', {
        provider: provider.provider,
      });
      return c.json(
        { error: 'Billing customer belongs to another account' },
        409
      );
    }
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
          provider: deps.billing.checkout,
        });
      }
    );
  }
}

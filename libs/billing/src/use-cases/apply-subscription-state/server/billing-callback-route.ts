import { EXTERNAL_ACCOUNT_PROVIDER_BILLING } from '@libs/auth/public/external-account-providers';
import { ExternalAccountRepository } from '@libs/auth/public/external-account-repository';
import type { MembershipBilling } from '@pkgs/billing';
import type { Logger } from '@pkgs/logger';
import type { Context } from 'hono';
import { Hono } from 'hono';

import {
  type BillingRouteDeps,
  billingNotConfigured,
} from '../../../shared/routes/billing-route-deps';
import { applyMembershipChange } from './apply-membership-change';

async function handleBillingCallback(
  c: Context,
  deps: BillingRouteDeps & { readonly billing: MembershipBilling },
  log: Logger
): Promise<Response> {
  const result = await deps.billing.readCallback({
    headers: c.req.raw.headers,
    rawBody: await c.req.text(),
  });
  if (result.kind === 'unverified') {
    log.warn('billing callback: signature verification failed');
    return c.json({ error: 'Invalid callback signature' }, 400);
  }
  if (result.kind === 'ignored') {
    return c.json({ received: true }, 200);
  }

  const sql = deps.getSqlClient();
  const accountId = await new ExternalAccountRepository(
    sql
  ).findUserIdByProviderExternalId(
    EXTERNAL_ACCOUNT_PROVIDER_BILLING,
    result.customerId
  );
  if (accountId === null) {
    // Provider identity never linked to an account: nothing to project.
    return c.json({ received: true }, 200);
  }

  await applyMembershipChange({
    sql,
    clock: deps.clock,
    accountId,
    change: result,
  });
  await deps.notifyUser(accountId, 'billing:membership', [
    'billing_subscriptions',
  ]);
  return c.json({ received: true }, 200);
}

export class BillingCallbackRoutes {
  private readonly log: Logger;

  constructor(private readonly deps: BillingRouteDeps) {
    this.log = deps.log.child({ route: 'billing:callback' });
  }

  build(): Hono {
    const deps = this.deps;
    const log = this.log;
    return new Hono().post('/billing/callback', async (c) => {
      if (deps.billing === null) return billingNotConfigured(c);
      return await handleBillingCallback(
        c,
        { ...deps, billing: deps.billing },
        log
      );
    });
  }
}

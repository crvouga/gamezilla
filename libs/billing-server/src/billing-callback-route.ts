import type { BillingRouteDeps } from '@libs/billing-shared/billing-route-deps';
import { billingNotConfigured } from '@libs/billing-shared/billing-route-deps';
import { CustomerLinks } from '@libs/billing-shared/customer-links';
import { recordPaymentEvidence } from '@libs/billing-shared/payment-evidence';
import type { MembershipBilling } from '@pkgs/billing-root-shared/membership';
import type { Logger } from '@pkgs/logger-shared/logger';
import { createMetric } from '@pkgs/observability-root-shared/metric-contract';
import type { SqlClient } from '@pkgs/sql-client-root-shared/interface';
import statement from '@pkgs/sql-root-shared/sql';
import type { Context } from 'hono';
import { Hono } from 'hono';
import { applyMembershipChange } from './apply-membership-change';
import { settleDeletedAccountPayments } from './settle-deleted-payments';

type CallbackOutcome =
  | 'accepted'
  | 'unverified'
  | 'unknown_provider'
  | 'failed';

/**
 * Every provider callback, by how it ended. A refused signature answers 400,
 * which the server-error burn never counts, so this is how the team learns
 * that payment changes stopped arriving. Created per call: the Worker installs
 * its meter provider after this module loads.
 */
function countCallback(outcome: CallbackOutcome): void {
  createMetric({
    name: 'billing.callbacks',
    description: 'Billing provider callbacks, by outcome',
    type: 'counter',
    unit: '{callback}',
    dimensions: {
      'app.outcome': ['accepted', 'unverified', 'unknown_provider', 'failed'],
    },
    environmentScoped: true,
  })(1, { 'app.outcome': outcome });
}

async function settleIfClosed(
  sql: SqlClient,
  deps: BillingRouteDeps & { readonly provider: MembershipBilling },
  customerId: string
): Promise<boolean> {
  const closures = await sql.query(
    statement<{
      account_id: string;
      confirmed_at: string;
    }>`SELECT account_id, confirmed_at FROM billing_account_closures WHERE provider = ${deps.provider.provider} AND customer_id = ${customerId} LIMIT 1`
  );
  const closure = closures[0];
  if (closure === undefined) return false;
  await sql.transaction((tx) =>
    settleDeletedAccountPayments({
      tx,
      provider: deps.provider,
      customerId,
      accountId: closure.account_id,
      confirmedAtMs: Date.parse(closure.confirmed_at),
      nowMs: deps.clock.now(),
    })
  );
  return true;
}

/**
 * One provider's callback. The path names the provider, so a delivery is
 * only ever read by the adapter that can verify it, and the customer it names
 * is only ever looked up among that provider's customers.
 */
async function handleBillingCallback(
  c: Context,
  deps: BillingRouteDeps & { readonly provider: MembershipBilling },
  log: Logger
): Promise<Response> {
  const { provider } = deps;
  const result = await provider.readCallback({
    headers: c.req.raw.headers,
    rawBody: await c.req.text(),
  });
  if (result.kind === 'unverified') {
    log.warn('billing callback: signature verification failed', {
      provider: provider.provider,
    });
    countCallback('unverified');
    return c.json({ error: 'Invalid callback signature' }, 400);
  }
  if (result.kind === 'ignored') {
    return c.json({ received: true }, 200);
  }
  if (result.provider !== provider.provider) {
    // An adapter speaking for another provider would cross-link customers.
    throw new Error(
      `billing callback: ${provider.provider} reported a ${result.provider} change`
    );
  }
  const sql = deps.getSqlClient();
  const accountId = await new CustomerLinks(sql).accountOf(
    result.provider,
    result.customerId
  );
  if (await settleIfClosed(sql, deps, result.customerId))
    return c.json({ received: true }, 200);
  if (accountId === null) {
    // Provider identity never linked to an account: nothing to project.
    return c.json({ received: true }, 200);
  }
  if (result.kind === 'payments') {
    const payments = await provider.readPayments(result.customerId);
    if (await settleIfClosed(sql, deps, result.customerId))
      return c.json({ received: true }, 200);
    await sql.transaction((tx) =>
      recordPaymentEvidence(tx, accountId, provider.provider, {
        payments,
        nowMs: deps.clock.now(),
      })
    );
    return c.json({ received: true }, 200);
  }
  const applied = await applyMembershipChange({
    sql,
    clock: deps.clock,
    accountId,
    change: result,
  });
  if (applied)
    await deps.notifyUser(accountId, 'billing:membership', [
      'billing_subscriptions',
    ]);
  else await settleIfClosed(sql, deps, result.customerId);
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
    return new Hono().post('/billing/callback/:provider', async (c) => {
      if (deps.billing === null) return billingNotConfigured(c);
      const provider = deps.billing.byId.get(c.req.param('provider'));
      if (provider === undefined) {
        countCallback('unknown_provider');
        return c.json({ error: 'Unknown billing provider' }, 404);
      }
      let response: Response;
      try {
        response = await handleBillingCallback(c, { ...deps, provider }, log);
      } catch (error: unknown) {
        countCallback('failed');
        throw error;
      }
      if (response.ok) countCallback('accepted');
      return response;
    });
  }
}

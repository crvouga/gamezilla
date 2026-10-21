import { expect, test } from 'bun:test';
import { AUTH_TABLES } from '@libs/auth-shared/tables';
import { BillingApp } from '@libs/billing-server/billing-app';
import { BILLING_TABLES } from '@libs/billing-shared/tables';
import type { MembershipBilling } from '@pkgs/billing-root-shared/membership';
import { createMembershipProviders } from '@pkgs/billing-root-shared/providers';
import { registerTables } from '@pkgs/db-schema-root-shared/register-tables';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared/reconcile-sqlite-schema';
import { createNoopLogger } from '@pkgs/logger-shared/logger';
import { reconcileOutbox } from '@pkgs/outbox-shared/reconcile';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite-root-server/impl-bun-sqlite';
import sql from '@pkgs/sql-root-shared/sql';
import { createHarnessAdapters } from '@pkgs/uuid-shared/harness-adapters';

test('a partial or pending refund does not complete withdrawal', async () => {
  // regression: deleted-payment-refund-incomplete
  const db = SqlClientImplBunSqlite.open(':memory:');
  await db.connect();
  try {
    await reconcileSqliteSchema(
      db,
      registerTables([...AUTH_TABLES, ...BILLING_TABLES])
    );
    await reconcileOutbox(db);
    const ports = createHarnessAdapters({ seed: 7 });
    const confirmed = '2026-10-01T00:00:00.000Z';
    await db.run(
      sql`INSERT INTO billing_account_closures (id, account_id, provider, subscription_id, customer_id, confirmed_at, cancellation_status) VALUES (${'stub:sub_alice'}, ${'alice'}, ${'stub'}, ${'sub_alice'}, ${'cus_alice'}, ${confirmed}, ${'pending'})`
    );
    let refunds = 0;
    const provider: MembershipBilling = {
      provider: 'stub',
      startCheckout: async () => ({
        kind: 'checkout',
        customerId: 'cus_alice',
        url: 'https://pay.test',
      }),
      openPortal: async () => ({ url: 'https://pay.test' }),
      cancelMembership: async () => {},
      refundPayment: async () => {
        refunds++;
      },
      readMembership: async () => null,
      readCallback: async () => ({
        kind: 'payments',
        provider: 'stub',
        customerId: 'cus_alice',
      }),
      readPayments: async () => [
        {
          id: 'late-payment',
          paidAtMs: Date.parse(confirmed),
          amountMinor: 999,
          currency: 'USD',
          refundedMinor: 399,
        },
      ],
    };
    const app = new BillingApp({
      getSqlClient: () => db,
      clock: ports.clock,
      createId: ports.createId,
      requireAuth: async () => ({ accountId: 'alice', deviceId: 'unused' }),
      log: createNoopLogger(),
      billing: createMembershipProviders({ all: [provider], checkout: 'stub' }),
      notifyUser: async () => {},
    })
      .build()
      .onError((error, ctx) => ctx.json({ error: error.message }, 500));
    const response = await app.request('/billing/callback/stub', {
      method: 'POST',
      body: '{}',
    });
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: 'Payment return is still pending.',
    });
    expect(refunds).toBe(1);
    expect(
      await db.query(
        sql<{
          cancellation_status: string;
        }>`SELECT cancellation_status FROM billing_account_closures WHERE id = ${'stub:sub_alice'}`
      )
    ).toEqual([{ cancellation_status: 'pending' }]);
  } finally {
    await db.disconnect();
  }
});

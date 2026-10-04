import { expect, test } from 'bun:test';
import { AUTH_TABLES } from '@libs/auth-shared/tables';
import { BillingApp } from '@libs/billing-server/billing-app';
import { BILLING_TABLES } from '@libs/billing-shared/tables';
import type { MembershipBilling } from '@pkgs/billing-shared/membership';
import { createMembershipProviders } from '@pkgs/billing-shared/providers';
import { registerTables } from '@pkgs/db-schema-shared/register-tables';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared/reconcile-sqlite-schema';
import { createNoopLogger } from '@pkgs/logger-shared/logger';
import type { SqlClient } from '@pkgs/sql-client-shared/interface';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite-server/impl-bun-sqlite';
import sql from '@pkgs/sql-shared/sql';
import { createHarnessAdapters } from '@pkgs/uuid-shared/harness-adapters';

test('deletion committed after a callback reads the account prevents revival', async () => {
  // regression: deleted-membership-callback-race
  const db = SqlClientImplBunSqlite.open(':memory:');
  await db.connect();
  try {
    await reconcileSqliteSchema(
      db,
      registerTables([...AUTH_TABLES, ...BILLING_TABLES])
    );
    const ports = createHarnessAdapters({ seed: 6 });
    const account = '11111111-1111-4111-8111-111111111106';
    const confirmed = '2026-10-01T00:00:00.000Z';
    await db.run(
      sql`INSERT INTO auth_external_accounts (id, user_id, provider, external_id) VALUES (${'customer-link'}, ${account}, ${'billing:stub'}, ${'cus_alice'})`
    );
    let closed = false;
    const callbackDb = new Proxy(db, {
      get(target, key) {
        if (key === 'transaction')
          return async <T>(body: (tx: SqlClient) => Promise<T>) => {
            if (!closed) {
              closed = true;
              await db.run(
                sql`INSERT INTO billing_account_closures (id, account_id, provider, subscription_id, customer_id, confirmed_at, cancellation_status) VALUES (${'stub:sub_original'}, ${account}, ${'stub'}, ${'sub_original'}, ${'cus_alice'}, ${confirmed}, ${'complete'})`
              );
            }
            return db.transaction(body);
          };
        const value = Reflect.get(target, key, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    const provider: MembershipBilling = {
      provider: 'stub',
      startCheckout: async () => ({
        customerId: 'cus_alice',
        url: 'https://pay.test',
      }),
      openPortal: async () => ({ url: 'https://pay.test' }),
      cancelMembership: async () => {},
      refundPayment: async () => {},
      readCallback: async () => ({
        kind: 'membership',
        provider: 'stub',
        customerId: 'cus_alice',
        subscriptionId: 'sub_late',
        offerPriceKey: null,
        membership: {
          status: 'active',
          periodEndMs: null,
          endsAtPeriodEnd: false,
        },
      }),
      readPayments: async () => [],
    };
    const notified: string[] = [];
    const app = new BillingApp({
      getSqlClient: () => callbackDb,
      clock: ports.clock,
      createId: ports.createId,
      requireAuth: async () => ({ accountId: account, deviceId: 'unused' }),
      log: createNoopLogger(),
      billing: createMembershipProviders({ all: [provider], checkout: 'stub' }),
      notifyUser: async (id) => {
        notified.push(id);
      },
    }).build();
    const response = await app.request('/billing/callback/stub', {
      method: 'POST',
      body: '{}',
    });
    expect(response.status).toBe(200);
    expect(closed).toBe(true);
    expect(
      await db.query(
        sql<{
          id: string;
        }>`SELECT id FROM billing_subscriptions WHERE account_id = ${account} AND deleted_at IS NULL`
      )
    ).toEqual([]);
    expect(notified).toEqual([]);
  } finally {
    await db.disconnect();
  }
});

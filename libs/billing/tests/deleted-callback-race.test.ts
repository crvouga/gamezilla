import { expect, test } from 'bun:test';
import { AUTH_TABLES } from '@libs/auth/public/schema';
import { BILLING_TABLES } from '@libs/billing/public/schema';
import { BillingApp } from '@libs/billing/root/server/billing-app';
import {
  createMembershipProviders,
  type MembershipBilling,
} from '@pkgs/billing';
import { registerTables } from '@pkgs/db-schema';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite';
import { createNoopLogger } from '@pkgs/logger';
import { sql } from '@pkgs/sql';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite/impl-bun-sqlite';
import { createHarnessAdapters } from '@pkgs/uuid';

test('deletion committed while a callback awaits the provider prevents revival', async () => {
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
      readPayments: async () => {
        if (!closed) {
          closed = true;
          await db.run(
            sql`INSERT INTO billing_account_closures (id, account_id, provider, subscription_id, customer_id, confirmed_at, cancellation_status) VALUES (${'stub:sub_original'}, ${account}, ${'stub'}, ${'sub_original'}, ${'cus_alice'}, ${confirmed}, ${'complete'})`
          );
        }
        return [];
      },
    };
    const notified: string[] = [];
    const app = new BillingApp({
      getSqlClient: () => db,
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

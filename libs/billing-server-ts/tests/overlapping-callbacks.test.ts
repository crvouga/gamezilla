import { expect, test } from 'bun:test';
import { AUTH_TABLES } from '@libs/auth-shared-ts/tables';
import { BillingApp } from '@libs/billing-server-ts/billing-app';
import { BILLING_TABLES } from '@libs/billing-shared-ts/tables';
import type {
  Membership,
  MembershipBilling,
} from '@pkgs/billing-root-shared-ts/membership';
import { createMembershipProviders } from '@pkgs/billing-root-shared-ts/providers';
import { registerTables } from '@pkgs/db-schema-root-shared-ts/register-tables';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared-ts/reconcile-sqlite-schema';
import { createNoopLogger } from '@pkgs/logger-shared-ts/logger';
import { outboxDeliveries, outboxEvents } from '@pkgs/outbox-shared-ts/tables';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite-root-server-ts/impl-bun-sqlite';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { createHarnessAdapters } from '@pkgs/uuid-shared-ts/harness-adapters';

const ACTIVE: Membership = {
  status: 'active',
  periodEndMs: Date.UTC(2026, 11, 1),
  endsAtPeriodEnd: false,
};
const ENDED: Membership = {
  status: 'ended',
  periodEndMs: Date.UTC(2026, 10, 8),
  endsAtPeriodEnd: false,
};

test('a callback read before a newer one committed never overwrites it', async () => {
  // regression: billing-overlapping-callbacks-stale-write
  const db = SqlClientImplBunSqlite.open(':memory:');
  await db.connect();
  try {
    await reconcileSqliteSchema(
      db,
      registerTables([
        ...AUTH_TABLES,
        ...BILLING_TABLES,
        outboxEvents,
        outboxDeliveries,
      ])
    );
    const ports = createHarnessAdapters({ seed: 7 });
    const account = '11111111-1111-4111-8111-111111111107';
    await db.run(
      sql`INSERT INTO auth_external_accounts (id, user_id, provider, external_id) VALUES (${'customer-link'}, ${account}, ${'billing:stub'}, ${'cus_alice'})`
    );
    // What the provider says right now; callbacks re-read it.
    let current = ACTIVE;
    const provider: MembershipBilling = {
      provider: 'stub',
      startCheckout: async () => ({
        kind: 'checkout',
        customerId: 'cus_alice',
        url: 'https://pay.test',
      }),
      openPortal: async () => ({ url: 'https://pay.test' }),
      cancelMembership: async () => {},
      refundPayment: async () => {},
      readMembership: async () => null,
      readCallback: async () => ({
        kind: 'membership',
        provider: 'stub',
        customerId: 'cus_alice',
        subscriptionId: 'sub_alice',
        offerPriceKey: null,
        membership: current,
      }),
      readPayments: async () => [],
    };
    let app: ReturnType<BillingApp['build']>;
    let overtaken = false;
    // The first callback has read "active". Before it writes, the membership
    // ends and a second callback reports that and commits first.
    const racingDb = new Proxy(db, {
      get(target, key) {
        if (key === 'transaction')
          return async <T>(body: (tx: SqlClient) => Promise<T>) => {
            if (!overtaken) {
              overtaken = true;
              current = ENDED;
              const second = await app.request('/billing/callback/stub', {
                method: 'POST',
                body: '{}',
              });
              expect(second.status).toBe(200);
            }
            return db.transaction(body);
          };
        const value = Reflect.get(target, key, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    app = new BillingApp({
      getSqlClient: () => racingDb,
      clock: ports.clock,
      createId: ports.createId,
      requireAuth: async () => ({ accountId: account, deviceId: 'unused' }),
      log: createNoopLogger(),
      billing: createMembershipProviders({ all: [provider], checkout: 'stub' }),
      notifyUser: async () => {},
    }).build();
    const first = await app.request('/billing/callback/stub', {
      method: 'POST',
      body: '{}',
    });
    expect(first.status).toBe(200);
    expect(overtaken).toBe(true);
    expect(
      await db.query(
        sql<{
          status: string;
        }>`SELECT status FROM billing_subscriptions WHERE account_id = ${account}`
      )
    ).toEqual([{ status: 'ended' }]);
  } finally {
    await db.disconnect();
  }
});

import { expect, test } from 'bun:test';
import { AUTH_TABLES } from '@libs/auth-shared-ts/tables';
import { BillingApp } from '@libs/billing-server-ts/billing-app';
import { BILLING_TABLES } from '@libs/billing-shared-ts/tables';
import type {
  MembershipBilling,
  MembershipChange,
} from '@pkgs/billing-root-shared-ts/membership';
import { createMembershipProviders } from '@pkgs/billing-root-shared-ts/providers';
import { registerTables } from '@pkgs/db-schema-root-shared-ts/register-tables';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared-ts/reconcile-sqlite-schema';
import { createNoopLogger } from '@pkgs/logger-shared-ts/logger';
import { outboxDeliveries, outboxEvents } from '@pkgs/outbox-shared-ts/tables';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite-root-server-ts/impl-bun-sqlite';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { createHarnessAdapters } from '@pkgs/uuid-shared-ts/harness-adapters';

const ACCOUNT = '11111111-1111-4111-8111-111111111108';

function provider(
  id: string,
  calls: string[],
  over: Partial<MembershipBilling> = {}
): MembershipBilling {
  return {
    provider: id,
    startCheckout: async (input) => {
      calls.push(`${id}:checkout`);
      return {
        kind: 'checkout',
        customerId: input.customerId ?? `cus_${id}`,
        url: `https://${id}.test/pay`,
      };
    },
    closeCheckouts: async (customerId) => {
      calls.push(`${id}:close:${customerId}`);
      return null;
    },
    openPortal: async () => ({ url: `https://${id}.test/manage` }),
    cancelMembership: async () => {},
    refundPayment: async () => {},
    readMembership: async () => null,
    readCallback: async () => ({ kind: 'ignored' }),
    readPayments: async () => [],
    ...over,
  };
}

async function world(old: MembershipBilling, next: MembershipBilling) {
  const db = SqlClientImplBunSqlite.open(':memory:');
  await db.connect();
  await reconcileSqliteSchema(
    db,
    registerTables([
      ...AUTH_TABLES,
      ...BILLING_TABLES,
      outboxEvents,
      outboxDeliveries,
    ])
  );
  await db.run(
    sql`INSERT INTO auth_external_accounts (id, user_id, provider, external_id) VALUES (${'old-link'}, ${ACCOUNT}, ${`billing:${old.provider}`}, ${'cus_old'})`
  );
  const ports = createHarnessAdapters({ seed: 8 });
  const app = new BillingApp({
    getSqlClient: () => db,
    clock: ports.clock,
    createId: ports.createId,
    requireAuth: async () => ({ accountId: ACCOUNT, deviceId: 'unused' }),
    log: createNoopLogger(),
    billing: createMembershipProviders({
      all: [old, next],
      checkout: next.provider,
    }),
    notifyUser: async () => {},
  }).build();
  const checkout = () =>
    app.request('/billing/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ returnUrl: 'https://app.test/more/billing' }),
    });
  return { db, checkout };
}

test('a checkout at the new provider first closes the ones open at the old', async () => {
  // regression: billing-provider-switch-leaves-old-checkout-payable
  const calls: string[] = [];
  const { db, checkout } = await world(
    provider('old', calls),
    provider('new', calls)
  );
  try {
    const response = await checkout();
    expect(response.status).toBe(200);
    expect(calls).toEqual(['old:close:cus_old', 'new:checkout']);
  } finally {
    await db.disconnect();
  }
});

test('a payment taken at the old provider opens no checkout at the new one', async () => {
  const calls: string[] = [];
  const paid: MembershipChange = {
    provider: 'old',
    customerId: 'cus_old',
    subscriptionId: 'sub_old',
    offerPriceKey: null,
    membership: { status: 'active', periodEndMs: null, endsAtPeriodEnd: false },
  };
  const { db, checkout } = await world(
    provider('old', calls, {
      closeCheckouts: async () => paid,
      readMembership: async () => paid,
    }),
    provider('new', calls)
  );
  try {
    const response = await checkout();
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'membership_pending' });
    expect(calls).toEqual([]);
    expect(
      await db.query(
        sql<{
          status: string;
        }>`SELECT status FROM billing_subscriptions WHERE account_id = ${ACCOUNT}`
      )
    ).toEqual([{ status: 'active' }]);
  } finally {
    await db.disconnect();
  }
});

test('an old provider that cannot be reached opens no checkout anywhere', async () => {
  const calls: string[] = [];
  const { db, checkout } = await world(
    provider('old', calls, {
      closeCheckouts: async () => {
        throw new Error('old provider down');
      },
    }),
    provider('new', calls)
  );
  try {
    const response = await checkout();
    expect(response.status).toBe(503);
    expect(calls).toEqual([]);
  } finally {
    await db.disconnect();
  }
});

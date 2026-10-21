import { expect, test } from 'bun:test';
import { AUTH_TABLES } from '@libs/auth-shared/tables';
import { registerBillingPrivacyConsumers } from '@libs/billing-server/account-privacy-consumers';
import {
  BILLING_PRIVACY,
  closeAccountMembership,
} from '@libs/billing-shared/account-privacy';
import { BILLING_TABLES } from '@libs/billing-shared/tables';
import type { MembershipBilling } from '@pkgs/billing-root-shared/membership';
import { createMembershipProviders } from '@pkgs/billing-root-shared/providers';
import { registerTables } from '@pkgs/db-schema-root-shared/register-tables';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared/reconcile-sqlite-schema';
import { OutboxConsumerRegistry } from '@pkgs/outbox-shared/define-consumer';
import { reconcileOutbox } from '@pkgs/outbox-shared/reconcile';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite-root-server/impl-bun-sqlite';
import sql from '@pkgs/sql-root-shared/sql';
import { createHarnessAdapters } from '@pkgs/uuid-shared/harness-adapters';

function provider(canceled: string[]): MembershipBilling {
  return {
    provider: 'stub',
    startCheckout: async () => ({
      kind: 'checkout',
      customerId: 'cus_x',
      url: 'https://pay.test',
    }),
    openPortal: async () => ({ url: 'https://pay.test' }),
    cancelMembership: async (id) => {
      canceled.push(id);
    },
    refundPayment: async () => {},
    readCallback: async () => ({ kind: 'ignored' }),
    readMembership: async () => null,
    readPayments: async () => [],
  };
}

test('a membership without its customer link never blocks account deletion', async () => {
  // regression: deletion-blocked-by-missing-customer-link
  const db = SqlClientImplBunSqlite.open(':memory:');
  await db.connect();
  try {
    await reconcileSqliteSchema(
      db,
      registerTables([...AUTH_TABLES, ...BILLING_TABLES])
    );
    await reconcileOutbox(db);
    const ports = createHarnessAdapters({ seed: 11 });
    const now = () => new Date(ports.clock.now());
    await db.run(
      sql`INSERT INTO billing_subscriptions (id, account_id, provider, provider_subscription_id, price_key, status, current_period_end, cancel_at_period_end, credit_cents) VALUES (${'stub:sub_alice'}, ${'alice'}, ${'stub'}, ${'sub_alice'}, ${'monthly'}, ${'active'}, ${'2026-11-01T00:00:00.000Z'}, ${0}, ${250})`
    );
    const env = {
      actorId: 'alice',
      accountId: 'alice',
      deviceId: 'phone',
      isAnon: false,
      now,
      serverNow: now,
      createId: ports.createId,
    };
    await db.transaction((tx) => BILLING_PRIVACY.withdraw({ tx, env }));
    expect(
      await db.query(
        sql<{
          customer_id: string | null;
          cancellation_status: string;
        }>`SELECT customer_id, cancellation_status FROM billing_account_closures WHERE account_id = ${'alice'}`
      )
    ).toEqual([{ customer_id: null, cancellation_status: 'pending' }]);

    const canceled: string[] = [];
    const registry = new OutboxConsumerRegistry();
    registerBillingPrivacyConsumers(
      registry,
      createMembershipProviders({ all: [provider(canceled)], checkout: 'stub' })
    );
    const close = registry.get('billing-close-deleted-membership');
    const events = await db.query(
      sql<{
        payload: unknown;
      }>`SELECT payload FROM outbox_events WHERE type = ${closeAccountMembership.type}`
    );
    expect(events).toHaveLength(1);
    const raw = events[0]?.payload;
    const payload: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw;
    expect(closeAccountMembership.validatePayload(payload)).toBe(true);
    expect(payload).toMatchObject({
      subscriptionId: 'sub_alice',
      customerId: null,
    });
    // Future charges stop at once; the payments cannot be checked, so the
    // closure stays pending and the delivery fails loudly for the team.
    await expect(
      db.transaction((tx) =>
        Promise.resolve(
          close?.handler(
            { tx, clock: ports.clock, createId: ports.createId },
            payload
          )
        )
      )
    ).rejects.toThrow('cancellation is still pending');
    expect(canceled).toEqual(['sub_alice']);
    expect(
      await db.query(
        sql<{
          cancellation_status: string;
        }>`SELECT cancellation_status FROM billing_account_closures WHERE account_id = ${'alice'}`
      )
    ).toEqual([{ cancellation_status: 'pending' }]);
  } finally {
    await db.disconnect();
  }
});

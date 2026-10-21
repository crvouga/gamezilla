/**
 * A membership whose provider news never arrived is asked about again after
 * its period end, by the scheduled outbox sweep, through the same reading a
 * callback gets — and only once per period, a bounded batch at a time.
 */
import { describe, expect, test } from 'bun:test';
import { AUTH_TABLES } from '@libs/auth-shared/tables';
import { applyMembershipChange } from '@libs/billing-server/apply-membership-change';
import { registerMembershipRecheck } from '@libs/billing-server/membership-recheck-consumer';
import { MEMBERSHIP_RECHECK_AFTER_PERIOD_END_MS } from '@libs/billing-shared/membership-recheck';
import { BILLING_TABLES } from '@libs/billing-shared/tables';
import type {
  MembershipBilling,
  MembershipChange,
} from '@pkgs/billing-root-shared/membership';
import { createMembershipProviders } from '@pkgs/billing-root-shared/providers';
import { registerTables } from '@pkgs/db-schema-root-shared/register-tables';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared/reconcile-sqlite-schema';
import { OutboxConsumerRegistry } from '@pkgs/outbox-shared/define-consumer';
import { drainOutbox } from '@pkgs/outbox-shared/drain';
import { outboxDeliveries, outboxEvents } from '@pkgs/outbox-shared/tables';
import type { SqlClient } from '@pkgs/sql-client-root-shared/interface';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite-root-server/impl-bun-sqlite';
import sql from '@pkgs/sql-root-shared/sql';
import { createHarnessAdapters } from '@pkgs/uuid-shared/harness-adapters';

const ACCOUNT = '11111111-1111-4111-8111-111111111301';
const NOW = 1_800_000_000_000;
const DAY_MS = 24 * 60 * 60 * 1000;

function change(
  periodEndMs: number,
  status: MembershipChange['membership']['status'] = 'active'
): MembershipChange {
  return {
    provider: 'stub',
    customerId: 'cus_ada',
    subscriptionId: 'sub_ada',
    offerPriceKey: 'subscription_monthly',
    membership: { status, periodEndMs, endsAtPeriodEnd: false },
  };
}

function stubProvider(current: () => MembershipChange | null) {
  const reads: string[] = [];
  const provider: MembershipBilling = {
    provider: 'stub',
    startCheckout: () => Promise.reject(new Error('unused')),
    openPortal: () => Promise.reject(new Error('unused')),
    cancelMembership: async () => {},
    refundPayment: async () => {},
    readCallback: async () => ({ kind: 'ignored' }),
    readPayments: async () => [],
    readMembership: async (id) => {
      reads.push(id);
      return current();
    },
  };
  return { provider, reads };
}

async function openWorld() {
  const db: SqlClient = SqlClientImplBunSqlite.open(':memory:');
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
    sql`INSERT INTO auth_external_accounts (id, user_id, provider, external_id) VALUES (${'billing:stub:cus_ada'}, ${ACCOUNT}, ${'billing:stub'}, ${'cus_ada'})`
  );
  const time = { now: NOW };
  const clock = { now: () => time.now };
  return { db, time, clock };
}

async function storedPeriodEnd(db: SqlClient): Promise<string | null> {
  const rows = await db.query(
    sql<{
      current_period_end: string | null;
    }>`SELECT current_period_end FROM billing_subscriptions WHERE account_id = ${ACCOUNT}`
  );
  return rows[0]?.current_period_end ?? null;
}

describe('a membership whose renewal news never arrived', () => {
  test('is brought up to date by its re-check after the period end', async () => {
    // regression: billing-subscription-never-reconciled
    const { db, time, clock } = await openWorld();
    try {
      const firstEnd = NOW + DAY_MS;
      const renewedEnd = firstEnd + 30 * DAY_MS;
      await applyMembershipChange({
        sql: db,
        clock,
        accountId: ACCOUNT,
        change: change(firstEnd),
      });
      // The renewal happened at the provider; its webhook never arrived.
      const { provider, reads } = stubProvider(() => change(renewedEnd));
      const registry = new OutboxConsumerRegistry();
      registerMembershipRecheck(
        registry,
        createMembershipProviders({ all: [provider], checkout: 'stub' })
      );
      const ports = createHarnessAdapters({ seed: 11 });
      const drain = () =>
        drainOutbox({ db, clock, createId: ports.createId, registry });

      // Before the re-check is due, nobody asks the provider.
      time.now = firstEnd + MEMBERSHIP_RECHECK_AFTER_PERIOD_END_MS - 1;
      await drain();
      expect(reads).toEqual([]);

      time.now = firstEnd + MEMBERSHIP_RECHECK_AFTER_PERIOD_END_MS;
      const result = await drain();
      expect(reads).toEqual(['sub_ada']);
      expect(result.notifyUserIds).toEqual([ACCOUNT]);
      expect(await storedPeriodEnd(db)).toBe(
        new Date(renewedEnd).toISOString()
      );

      // Projecting the renewal scheduled the next period's re-check only.
      await drain();
      expect(reads).toEqual(['sub_ada']);
    } finally {
      await db.disconnect();
    }
  });

  test('an ended membership is never asked about again', async () => {
    const { db, time, clock } = await openWorld();
    try {
      await applyMembershipChange({
        sql: db,
        clock,
        accountId: ACCOUNT,
        change: change(NOW + DAY_MS, 'ended'),
      });
      const { provider, reads } = stubProvider(() => change(NOW, 'ended'));
      const registry = new OutboxConsumerRegistry();
      registerMembershipRecheck(
        registry,
        createMembershipProviders({ all: [provider], checkout: 'stub' })
      );
      const ports = createHarnessAdapters({ seed: 12 });
      time.now = NOW + 365 * DAY_MS;
      await drainOutbox({ db, clock, createId: ports.createId, registry });
      expect(reads).toEqual([]);
    } finally {
      await db.disconnect();
    }
  });
});

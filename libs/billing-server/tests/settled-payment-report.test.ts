import { expect, test } from 'bun:test';
import { settledPaymentReport } from '@libs/billing-server/settled-payment-report';
import { recordPaymentEvidence } from '@libs/billing-shared/payment-evidence';
import { BILLING_TABLES } from '@libs/billing-shared/tables';
import { registerTables } from '@pkgs/db-schema-root-shared/register-tables';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared/reconcile-sqlite-schema';
import { reconcileOutbox } from '@pkgs/outbox-shared/reconcile';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite-root-server/impl-bun-sqlite';

test('cash totals reconcile authoritative evidence, duplicates and refunds by currency', async () => {
  const db = SqlClientImplBunSqlite.open(':memory:');
  await db.connect();
  try {
    await reconcileSqliteSchema(db, registerTables(BILLING_TABLES));
    await reconcileOutbox(db);
    const payments = [
      {
        id: 'payment-1',
        paidAtMs: 1000,
        amountMinor: 700,
        currency: 'usd',
        refundedMinor: 100,
      },
      {
        id: 'payment-2',
        paidAtMs: 1500,
        amountMinor: 650,
        currency: 'eur',
        refundedMinor: 0,
      },
      {
        id: 'payment-3',
        paidAtMs: 2000,
        amountMinor: 700,
        currency: 'usd',
        refundedMinor: 0,
      },
    ];
    await db.transaction(async (tx) => {
      await recordPaymentEvidence(tx, 'account-1', 'example', {
        payments,
        nowMs: 3000,
      });
      await recordPaymentEvidence(tx, 'account-1', 'example', {
        payments,
        nowMs: 4000,
      });
    });
    expect(
      await settledPaymentReport(db, { fromMs: 1000, untilMs: 2000 })
    ).toEqual([
      {
        currency: 'eur',
        payments: '1',
        settledMinor: '650',
        refundedMinor: '0',
        netMinor: '650',
      },
      {
        currency: 'usd',
        payments: '1',
        settledMinor: '700',
        refundedMinor: '100',
        netMinor: '600',
      },
    ]);
    await db.transaction((tx) =>
      recordPaymentEvidence(tx, 'account-1', 'example', {
        payments: [{ ...payments[0]!, refundedMinor: 700 }],
        nowMs: 5000,
      })
    );
    const revised = await settledPaymentReport(db, {
      fromMs: 1000,
      untilMs: 2000,
    });
    expect(revised.find((row) => row.currency === 'usd')?.netMinor).toBe('0');
  } finally {
    await db.disconnect();
  }
});

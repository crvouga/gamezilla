import { expect, test } from 'bun:test';
import { cancellationFeedbackReportCommand } from '@libs/billing-server-ts/cancellation-feedback-report';
import { BILLING_TABLES } from '@libs/billing-shared-ts/tables';
import { registerTables } from '@pkgs/db-schema-root-shared-ts/register-tables';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared-ts/reconcile-sqlite-schema';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite-root-server-ts/impl-bun-sqlite';
import sql from '@pkgs/sql-root-shared-ts/sql';

test('operator reporting bounds pages and excludes withdrawn answers and the upper time boundary', async () => {
  const db = SqlClientImplBunSqlite.open(':memory:');
  await db.connect();
  try {
    await reconcileSqliteSchema(db, registerTables(BILLING_TABLES));
    const from = '2026-11-01T00:00:00.000Z';
    const until = '2026-11-02T00:00:00.000Z';
    for (let n = 0; n < 103; n++) {
      const id = `answer-${String(n).padStart(3, '0')}`;
      await db.run(sql`INSERT INTO billing_cancellation_feedback
        (id, account_id, subscription_id, reason, comment, created_at, updated_at, deleted_at)
        VALUES (${id}, ${'alice'}, ${id}, ${'price'}, ${'Optional comment'}, ${from}, ${n === 102 ? until : from}, ${n === 101 ? from : null})`);
    }
    const first = await cancellationFeedbackReportCommand(db, [from, until]);
    expect(first.feedback).toHaveLength(100);
    expect(first.nextAfterId).toBe('answer-099');
    const second = await cancellationFeedbackReportCommand(db, [
      from,
      until,
      first.nextAfterId!,
    ]);
    expect(second.feedback.map((row) => row.id)).toEqual(['answer-100']);
    expect(second.nextAfterId).toBeNull();
    await expect(
      cancellationFeedbackReportCommand(db, [until, from])
    ).rejects.toThrow('reporting window');
    await expect(cancellationFeedbackReportCommand(db, [])).rejects.toThrow(
      'Usage:'
    );
  } finally {
    await db.disconnect();
  }
});

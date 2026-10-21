import { expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/db-indexes-root-harness-ts/clock';
import { HarnessDb } from '@pkgs/db-indexes-root-harness-ts/db';
import { MIGRATE_RECONCILE_CONFIG } from '@pkgs/db-indexes-root-shared-ts/config';
import { fingerprintSql } from '@pkgs/db-indexes-root-shared-ts/fingerprint';
import { parseWithNodeSqlParser } from '@pkgs/db-indexes-root-shared-ts/parse-node-sql';
import { planIndexes } from '@pkgs/db-indexes-root-shared-ts/plan';

const sql = `SELECT p.*
FROM profile_deletion_receipts p
JOIN auth_account_devices d ON d.user_id = p.owner_id
WHERE d.device_id = ?`;

// regression: index-join-column-wrong-table
test.each(['PostgreSQL', 'Sqlite'] as const)(
  '%s keeps deletion receipt lookup columns on their owning tables',
  async (dialect) => {
    const parsed = parseWithNodeSqlParser(sql, dialect);
    expect(parsed.ok).toBe(true);
    expect(parsed.paths).toEqual([
      {
        table: 'profile_deletion_receipts',
        equality: ['owner_id'],
        range: [],
        orderBy: [],
        selectList: ['*'],
        partialPredicate: null,
      },
      {
        table: 'auth_account_devices',
        equality: ['device_id', 'user_id'],
        range: [],
        orderBy: [],
        selectList: [],
        partialPredicate: null,
      },
    ]);
    const clock = createHarnessClock(0);
    const db = new HarnessDb({
      clock,
      tables: parsed.tables.map((name) => ({ name, estimatedRows: 0 })),
    });
    db.parseStatement = (statement) =>
      parseWithNodeSqlParser(statement, dialect);
    const plan = await planIndexes({
      clock,
      db,
      config: MIGRATE_RECONCILE_CONFIG,
      manifest: {
        version: 1,
        queries: [
          {
            name: 'deletionReceipts',
            hydrates: ['profile_deletion_receipts'],
            statements: [
              { index: 0, sql, fingerprint: fingerprintSql(sql), weight: 1 },
            ],
          },
        ],
      },
    });
    expect(plan.desired.map((candidate) => candidate.definition)).toEqual([
      {
        table: 'auth_account_devices',
        columns: [
          { name: 'device_id', order: 'asc' },
          { name: 'user_id', order: 'asc' },
        ],
        include: [],
        predicate: null,
      },
      {
        table: 'profile_deletion_receipts',
        columns: [{ name: 'owner_id', order: 'asc' }],
        include: [],
        predicate: null,
      },
    ]);
  }
);

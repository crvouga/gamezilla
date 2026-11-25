import { expect, test } from 'bun:test';
import { runInNewContext } from 'node:vm';
import {
  createTestLocalSql,
  TEST_LOCAL_SQL_GLOBAL,
} from '@libs/app-root-shared-ts/test-local-sql';
import { sqlDataCheckpoint } from '@libs/harness-ts/sql-data-checkpoint';
import { webviewCheckpoint } from '@libs/harness-ts/webview-checkpoint';
import { defineTable } from '@pkgs/db-schema-root-shared-ts/define-table';
import { registerTables } from '@pkgs/db-schema-root-shared-ts/register-tables';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared-ts/reconcile-sqlite-schema';
import type { SqlDataDump } from '@pkgs/sql-client-root-shared-ts/types';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite-root-shared-ts/impl-mockingbird-sqlite';
import sql from '@pkgs/sql-root-shared-ts/sql';

import { syncEngineMutations } from '@pkgs/sync-engine-shared-ts/tables';

const PEOPLE = defineTable({
  domain: 'checkpoint',
  name: 'checkpoint_people',
  columns: { name: 'text' },
});

test('a live device checkpoint restores its actual database and rolls back a bad restore', async () => {
  // regression: live-checkpoint-has-no-database-bytes
  const db = SqlClientImplMockingbirdSqlite.open();
  await db.connect();
  try {
    await reconcileSqliteSchema(db, registerTables([PEOPLE]), {
      ownership: 'declared-only',
    });
    await db.run(
      sql`INSERT INTO checkpoint_people (id, name) VALUES (${'alice'}, ${'Alice'})`
    );
    const hook = createTestLocalSql(db);
    const saved = await hook.dump();
    const data = JSON.parse(saved) as SqlDataDump;
    const table = data.tables['checkpoint_people']!;
    expect(table.rows).toHaveLength(1);
    await db.run(
      sql`UPDATE checkpoint_people SET name = ${'Changed'} WHERE id = ${'alice'}`
    );
    await hook.restore(data);
    expect(
      await db.query(sql<{ name: string }>`SELECT name FROM checkpoint_people`)
    ).toEqual([{ name: 'Alice' }]);
    const bad: SqlDataDump = {
      ...data,
      tables: {
        checkpoint_people: {
          columns: [...table.columns, 'missing_column'],
          rows: [[...table.rows[0]!, 'bad']],
        },
      },
    };
    await expect(hook.restore(bad)).rejects.toThrow();
    expect(
      await db.query(sql<{ name: string }>`SELECT name FROM checkpoint_people`)
    ).toEqual([{ name: 'Alice' }]);
    const checkpoint = sqlDataCheckpoint(db);
    const bytes = await checkpoint.exportBytes();
    expect(bytes.byteLength).toBeGreaterThan(0);
    await db.run(
      sql`UPDATE checkpoint_people SET name = ${'Changed again'} WHERE id = ${'alice'}`
    );
    await checkpoint.importBytes(bytes);
    expect(
      await db.query(sql<{ name: string }>`SELECT name FROM checkpoint_people`)
    ).toEqual([{ name: 'Alice' }]);
  } finally {
    await db.disconnect();
  }
});

// regression: browser-checkpoint-pending-writes
test('a device checkpoint preserves its sixteen pending uploads', async () => {
  const db = SqlClientImplMockingbirdSqlite.open();
  await db.connect();
  try {
    await reconcileSqliteSchema(db, registerTables([syncEngineMutations]), {
      ownership: 'declared-only',
    });
    const ids = Array.from({ length: 16 }, (_, i) => `pending-${i}`);
    for (const [seq, id] of ids.entries()) {
      await db.run(sql`INSERT INTO sync_engine_mutations (id, client_id, seq, name, args)
        VALUES (${id}, ${'alice'}, ${seq}, ${'savePreference'}, ${'{}'})`);
    }
    const browser = {
      [TEST_LOCAL_SQL_GLOBAL]: createTestLocalSql(db),
      localStorage: { clear() {} },
      sessionStorage: { clear() {} },
      location: { pathname: '/', search: '' },
    };
    const device = webviewCheckpoint(
      { evaluate: async (script) => runInNewContext(script, browser) },
      () => Promise.resolve()
    );
    const saved = await device.capture();
    await db.run(sql`DELETE FROM sync_engine_mutations`);
    await device.restore(saved);
    const restored = await db.query(sql<{ id: string }>`
      SELECT id FROM sync_engine_mutations WHERE deleted_at IS NULL ORDER BY seq`);
    expect(restored.map((row) => row.id)).toEqual(ids);
  } finally {
    await db.disconnect();
  }
});

import { expect, test } from 'bun:test';
import { createTestLocalSql } from '@libs/app-root-shared/test-local-sql';
import { sqlDataCheckpoint } from '@libs/harness/sql-data-checkpoint';
import { defineTable } from '@pkgs/db-schema-root-shared/define-table';
import { registerTables } from '@pkgs/db-schema-root-shared/register-tables';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared/reconcile-sqlite-schema';
import type { SqlDataDump } from '@pkgs/sql-client-root-shared/types';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite-root-shared/impl-mockingbird-sqlite';
import sql from '@pkgs/sql-root-shared/sql';

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

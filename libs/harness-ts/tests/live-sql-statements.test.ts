import { expect, test } from 'bun:test';
import { createTestLocalSql } from '@libs/app-root-shared-ts/test-local-sql';
import { defineTable } from '@pkgs/db-schema-root-shared-ts/define-table';
import { registerTables } from '@pkgs/db-schema-root-shared-ts/register-tables';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared-ts/reconcile-sqlite-schema';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite-root-shared-ts/impl-mockingbird-sqlite';

const PEOPLE = defineTable({
  domain: 'notebook',
  name: 'notebook_people',
  columns: { name: 'text' },
});

test('a live notebook batch reads its device database and rolls back the entire failed batch', async () => {
  // regression: live-notebook-queries-empty-headless-database
  const db = SqlClientImplMockingbirdSqlite.open();
  await db.connect();
  try {
    await reconcileSqliteSchema(db, registerTables([PEOPLE]), {
      ownership: 'declared-only',
    });
    const hook = createTestLocalSql(db);
    const result = await hook.executeStatements([
      {
        kind: 'run',
        text: "INSERT INTO notebook_people (id, name) VALUES ('alice', 'Alice')",
      },
      { kind: 'query', text: 'SELECT name FROM notebook_people' },
    ]);
    expect(JSON.parse(result)).toMatchObject([
      { kind: 'changes', changes: 1 },
      { kind: 'rows', rows: [{ name: 'Alice' }] },
    ]);
    await expect(
      hook.executeStatements([
        {
          kind: 'run',
          text: "UPDATE notebook_people SET name = 'Changed' WHERE id = 'alice'",
        },
        {
          kind: 'query',
          text: 'SELECT * FROM nonexistent_investigation_table',
        },
      ])
    ).rejects.toThrow();
    const after = await hook.executeStatements([
      { kind: 'query', text: 'SELECT name FROM notebook_people' },
    ]);
    expect(JSON.parse(after)).toMatchObject([
      { kind: 'rows', rows: [{ name: 'Alice' }] },
    ]);
  } finally {
    await db.disconnect();
  }
});

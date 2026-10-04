import { expect, test } from 'bun:test';
import { defineTable } from '@pkgs/db-schema-shared/define-table';
import { registerTables } from '@pkgs/db-schema-shared/register-tables';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared/reconcile-sqlite-schema';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite-server/impl-bun-sqlite';
import sql from '@pkgs/sql-shared/sql';

test('reconciling a second slice preserves the first slice unique indexes', async () => {
  // regression: sqlite-reconcile-foreign-index
  const db = SqlClientImplBunSqlite.open(':memory:');
  await db.connect();
  try {
    const first = defineTable({
      domain: 'first',
      name: 'first_entries',
      columns: { reference: 'text' },
      uniqueIndexes: ['reference'],
    });
    const second = defineTable({
      domain: 'second',
      name: 'second_entries',
      columns: { reference: 'text' },
      uniqueIndexes: ['reference'],
    });
    await reconcileSqliteSchema(db, registerTables([first]));
    await db.run(
      sql`INSERT INTO first_entries (id, reference) VALUES (${'one'}, ${'invoice-alice'})`
    );
    await reconcileSqliteSchema(db, registerTables([second]));
    await expect(
      db.run(
        sql`INSERT INTO first_entries (id, reference) VALUES (${'duplicate'}, ${'invoice-alice'})`
      )
    ).rejects.toThrow('UNIQUE constraint failed');
    await db.run(
      sql`INSERT INTO first_entries (id, reference) VALUES (${'two'}, ${'invoice-bob'}) ON CONFLICT (reference) DO NOTHING`
    );
    expect(
      await db.query(
        sql<{ id: string }>`SELECT id FROM first_entries ORDER BY id`
      )
    ).toEqual([{ id: 'one' }, { id: 'two' }]);
  } finally {
    await db.disconnect();
  }
});

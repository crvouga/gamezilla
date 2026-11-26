import { expect, test } from 'bun:test';
import { defineTable } from '@pkgs/db-schema-root-shared-ts/define-table';
import { registerTables } from '@pkgs/db-schema-root-shared-ts/register-tables';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared-ts/reconcile-sqlite-schema';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite-root-server-ts/impl-bun-sqlite';
import sql from '@pkgs/sql-root-shared-ts/sql';

// regression: quoridor-startup-missing-spaces-users
test('a membership table removed before index creation is reconciled again', async () => {
  const client = SqlClientImplBunSqlite.openMemory();
  await client.connect();
  const schema = registerTables([
    defineTable({
      domain: 'spaces',
      name: 'spaces_users',
      columns: { user_id: 'text' },
      indexes: ['user_id'],
    }),
  ]);
  let removed = false;
  const run = client.run.bind(client);
  client.run = async (query) => {
    if (!removed && query.sql.startsWith('CREATE INDEX')) {
      removed = true;
      await run(sql`DROP TABLE spaces_users`);
    }
    return run(query);
  };
  try {
    await reconcileSqliteSchema(client, schema);
    expect(removed).toBe(true);
    expect(
      await client.query(
        sql<{ user_id: string }>`SELECT user_id FROM spaces_users`
      )
    ).toEqual([]);
    const indexes = await client.query(
      sql<{
        name: string;
      }>`SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'spaces_users' AND sql IS NOT NULL`
    );
    expect(indexes).toHaveLength(1);
  } finally {
    await client.disconnect();
  }
});

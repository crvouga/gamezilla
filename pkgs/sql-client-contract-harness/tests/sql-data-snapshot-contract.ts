import { afterEach, beforeEach, expect, test } from 'bun:test';
import { reconcilePostgresSchema } from '@pkgs/db-schema-postgres-shared/reconcile-postgres-schema';
import type { TableDef } from '@pkgs/db-schema-shared/define-table';
import { defineTable } from '@pkgs/db-schema-shared/define-table';
import { registerTables } from '@pkgs/db-schema-shared/register-tables';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared/reconcile-sqlite-schema';
import type {
  PostgresSqlClient,
  SqlClient,
} from '@pkgs/sql-client-shared/interface';
import { dumpData, loadData } from '@pkgs/sql-client-shared/port';
import sql, { raw } from '@pkgs/sql-shared/sql';

function isPostgresSqlClient(client: SqlClient): client is PostgresSqlClient {
  return 'dbScope' in client;
}

async function applySchema(
  client: SqlClient,
  tables: readonly TableDef[]
): Promise<void> {
  const schema = registerTables(tables);
  if (isPostgresSqlClient(client)) {
    await reconcilePostgresSchema(client, schema, client.dbScope, {
      skipAdvisoryLock: true,
    });
    return;
  }
  await reconcileSqliteSchema(client, schema);
}

/** Shared dump→load round-trip — run against every SqlClient adapter. */
export function runSqlDataSnapshotContractTests(
  factory: () => SqlClient | Promise<SqlClient>
): void {
  let client: SqlClient;

  beforeEach(async () => {
    client = await Promise.resolve(factory());
    await client.connect();
  });

  afterEach(async () => {
    try {
      await client.disconnect();
    } catch {
      // already disconnected
    }
  });

  test('dumpData → loadData round-trip preserves rows', async () => {
    await applySchema(client, [
      defineTable({
        domain: 'snap_demo',
        name: 'snap_demo',
        columns: { n: 'integer', body: 'text' },
      }),
    ]);
    await client.run(
      sql`INSERT INTO snap_demo (id, n, body) VALUES (${'a'}, ${1}, ${'hello'})`
    );
    await client.run(
      sql`INSERT INTO snap_demo (id, n, body) VALUES (${'b'}, ${2}, ${'world'})`
    );

    const dump = await dumpData(client, { tables: ['snap_demo'] });
    await client.run(raw('DELETE FROM snap_demo'));
    expect(
      await client.query(
        raw<Record<string, unknown>>('SELECT * FROM snap_demo')
      )
    ).toEqual([]);

    await loadData(client, dump);
    const rows = await client.query<{ id: string; n: number; body: string }>(
      raw('SELECT id, n, body FROM snap_demo ORDER BY id')
    );
    expect(rows).toEqual([
      { id: 'a', n: 1, body: 'hello' },
      { id: 'b', n: 2, body: 'world' },
    ]);
  });

  test('dumpData → loadData preserves snake_case column names', async () => {
    await applySchema(client, [
      defineTable({
        domain: 'snap_snake',
        name: 'snap_snake',
        columns: { account_id: 'text' },
      }),
    ]);
    await client.run(
      sql`INSERT INTO snap_snake (id, account_id) VALUES (${'row-1'}, ${'acct-1'})`
    );

    const dump = await dumpData(client, { tables: ['snap_snake'] });
    expect([...(dump.tables['snap_snake']?.columns ?? [])].sort()).toEqual(
      ['account_id', 'created_at', 'deleted_at', 'id', 'updated_at'].sort()
    );

    await client.run(raw('DELETE FROM snap_snake'));
    await loadData(client, dump);

    const rows = await client.query<{ account_id: string; id: string }>(
      raw('SELECT id, account_id FROM snap_snake')
    );
    expect(rows).toEqual([{ id: 'row-1', account_id: 'acct-1' }]);
  });
}

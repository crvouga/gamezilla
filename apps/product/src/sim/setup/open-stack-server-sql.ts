/**
 * Harness handle on the full-system stack's database (`bun e2e` binds the API
 * Worker to the `e2e` database on the embedded cluster). Tests never write
 * through it; the fabric uses it to reset the system between runs and to seed
 * fixtures the in-process profile seeds the same way.
 */
import { appPostgresDbScope } from '@libs/db/public/scope';
import { ident, join, sql } from '@pkgs/sql';
import { createPgPool } from '@pkgs/sql-client-postgres/connect';

import { type SimSql, sharedSqlClient } from '../fabric/sim-sql';

/**
 * Rows the Worker materializes once per isolate (`client_config`). Truncating
 * them would leave clients without runtime config until the Worker restarts.
 */
const KEEP_TABLES: readonly string[] = ['client_config'];

export function openStackServerSql(databaseUrl: string): SimSql {
  const { pool, sqlClient } = createPgPool({
    connectionString: databaseUrl,
    dbScope: appPostgresDbScope(),
    max: 4,
  });
  const reset = async () => {
    const rows = await sqlClient.query(sql<{ tablename: string }>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);
    const tables = rows
      .map((row) => row.tablename)
      .filter((name) => !KEEP_TABLES.includes(name));
    if (tables.length === 0) return;
    await sqlClient.run(
      sql`TRUNCATE TABLE ${join(tables.map(ident), ', ')} RESTART IDENTITY CASCADE`
    );
  };
  const shared = sharedSqlClient(sqlClient);
  return {
    sqlClient: shared,
    databaseName: new URL(databaseUrl).pathname.slice(1),
    disconnect: () => pool.end(),
    reset,
    exportBytes: () => Promise.reject(new Error('stack SQL has no byte dump')),
    importBytes: () => Promise.reject(new Error('stack SQL has no byte dump')),
  };
}

import type { SqlClient } from '@gamezilla/lib/sql-client/interface';
import { migratePatchDbSqlite } from '@gamezilla/patch-db/impl-sqlite/migrate';

const MIGRATIONS_TABLE = '_migrations';

type MigrationRow = { name: string };

/**
 * Per-database schema bookkeeping. Each account (or anonymous) SQLite file has its own
 * `_migrations` table; version state never crosses files.
 */
export async function runAccountDatabaseMigrations(
  sql: SqlClient
): Promise<void> {
  await sql.run(
    `CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL
    )`
  );

  const applied = await sql.query<MigrationRow>(
    `SELECT name FROM ${MIGRATIONS_TABLE}`
  );
  const done = new Set(applied.map((r) => r.name));

  const run = async (name: string, fn: (c: SqlClient) => Promise<void>) => {
    if (done.has(name)) return;
    await fn(sql);
    await sql.run(
      `INSERT INTO ${MIGRATIONS_TABLE} (name, applied_at) VALUES (?, ?)`,
      [name, new Date().toISOString()]
    );
  };

  await run('patch_db_sqlite_v1', migratePatchDbSqlite);
}

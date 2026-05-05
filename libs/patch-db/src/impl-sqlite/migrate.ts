import type { SqlClient } from '@gamezilla/lib/sql-client/interface';
import { MIGRATIONS } from './sql-constants';

async function runBaseMigrations(sqlClient: SqlClient): Promise<void> {
  const statements = MIGRATIONS.split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const stmt of statements) {
    await sqlClient.run(stmt);
  }
}

/** Applies base DDL for the patch-db SQLite schema. */
export async function migratePatchDbSqlite(
  sqlClient: SqlClient
): Promise<void> {
  await runBaseMigrations(sqlClient);
}

import { raw } from '@pkgs/sql-shared/sql';
import type { SqlClient } from '@pkgs/sql-client-shared/interface';

/**
 * Run on every new SQLite connection (Bun, browser) so FKs are enforced like
 * PostgreSQL and accidental orphan rows fail fast instead of corrupting state.
 *
 * `busy_timeout` lets concurrent readers/writers (sync push + poll + hydration)
 * retry briefly instead of failing immediately with SQLITE_BUSY on the native backend.
 *
 * On web, keep the rollback journal and temp tables in memory so the OPFS
 * VFS does not need to create sidecar `-journal` / WAL files (a common source of
 * "cannot create file" failures in production).
 */
export async function applySqliteConnectionPragmas(
  client: Pick<SqlClient, 'run'>
): Promise<void> {
  await client.run(raw('PRAGMA foreign_keys = ON'));
  await client.run(raw('PRAGMA busy_timeout = 5000'));
  await client.run(raw('PRAGMA journal_mode = MEMORY'));
  await client.run(raw('PRAGMA temp_store = MEMORY'));
}

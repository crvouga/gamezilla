import type { SqlClient } from './interface';

/**
 * Run on every new SQLite connection (Bun, Expo, sql.js) so FKs are enforced like
 * PostgreSQL and accidental orphan rows fail fast instead of corrupting state.
 *
 * `busy_timeout` lets concurrent readers/writers (sync push + poll + hydration)
 * retry briefly instead of failing immediately with SQLITE_BUSY on native expo-sqlite.
 */
export async function applySqliteConnectionPragmas(
  client: Pick<SqlClient, 'run'>
): Promise<void> {
  await client.run('PRAGMA foreign_keys = ON');
  await client.run('PRAGMA busy_timeout = 5000');
}

/** sql.js `Database#exec` after open — FKs only (safe for in-memory and restored file DBs). */
export const SQLITE_JS_FOREIGN_KEYS_EXEC = 'PRAGMA foreign_keys = ON;';

/**
 * sql.js `Database#exec` right after `new SQL.Database(...)` on the absurd-sql worker.
 * Keeps the historical `journal_mode=MEMORY` bootstrap plus FK enforcement.
 */
export const SQLITE_JS_BOOTSTRAP_AFTER_OPEN =
  'PRAGMA foreign_keys = ON; PRAGMA journal_mode = MEMORY;';

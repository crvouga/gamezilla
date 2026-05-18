/**
 * Storage adapter surface for `@gamezilla/matchmaking`.
 *
 * Imported via `@gamezilla/matchmaking/storage` by embedders who need to
 * supply their own `SqlClient` (e.g. an API package that pins a single
 * `pg.Client` per request via AsyncLocalStorage) or who want to drop in
 * a different Postgres-compatible backend.
 *
 * The default path is `new Matchmaking({ storage: { pool } })` which
 * wraps a `pg.Pool` automatically. Reach here only when you need
 * something the high-level options layer can't express.
 */

export { createPgSqlClient } from './pg-adapter';
export { createPgliteSqlClient } from './pglite-adapter';
export type { QueryResult, SqlClient } from './sql-client';

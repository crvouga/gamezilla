/**
 * Storage adapter surface for `@pkgs/matchmaking`.
 *
 * Imported via `@pkgs/matchmaking/storage` by embedders who need to
 * supply their own `SqlClient` (e.g. an API package that pins a single
 * `pg.Client` per request via AsyncLocalStorage) or who want to drop in
 * a different Postgres-compatible backend.
 *
 * For the common case ("I have a `pg.Pool` and just want it to work"),
 * use `Matchmaking.fromPool(pool, opts)` instead of constructing a
 * `SqlClient` yourself. The two adapters here are for everything else:
 *
 *   - `createPgSqlClient(poolOrClient)` — wrap a `pg.Pool` (or any
 *     `pg`-shaped client) into the `SqlClient` interface.
 *   - `createPgliteSqlClient(pglite)` — adapter for `@electric-sql/pglite`
 *     used by the package's own test suite and useful for embedders
 *     that run hermetic tests against an in-process Postgres.
 */

export { createPgSqlClient } from './pg-adapter';
export { createPgliteSqlClient } from './pglite-adapter';
export type { QueryResult, SqlClient } from './sql-client';

/**
 * Storage adapter surface for `@pkgs/matchmaking`.
 *
 * Imported via `@pkgs/matchmaking/storage` by embedders who need to
 * supply their own `@pkgs/sql-client` {@link SqlClient} (e.g. an
 * embedder that pins a single Postgres client per request via
 * AsyncLocalStorage) or who want to drop in a different
 * Postgres-compatible backend for tests.
 *
 * Production embedders construct a `SqlClient` through
 * `@pkgs/sql-client` (`createPgPool` / `SqlClientImplPg` /
 * `SqlClientImplPgClient`) and pass it via `storage.sqlClient`. The
 * only adapter that ships here is:
 *
 *   - `createPgliteSqlClient(pglite)` — adapter for `@electric-sql/pglite`
 *     used by the package's own test suite and useful for embedders
 *     that run hermetic tests against an in-process Postgres.
 */

export { createPgliteSqlClient } from './pglite-adapter';
export type { SqlClient } from '@pkgs/sql-client/interface';

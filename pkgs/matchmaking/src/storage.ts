/**
 * Storage adapter surface for `@pkgs/matchmaking`.
 *
 * Imported via `@pkgs/matchmaking/storage` by embedders who need to
 * supply their own `@pkgs/sql-client` {@link SqlClient} (e.g. an
 * embedder that pins a single Postgres client per request via
 * AsyncLocalStorage).
 *
 * Production embedders construct a `SqlClient` through
 * `@pkgs/sql-client` (`createPgPool` / `SqlClientImplPg` /
 * `SqlClientImplPgClient`) and pass it via `storage.sqlClient`.
 *
 * Hermetic test backends also live in `@pkgs/sql-client`:
 *
 *   - `createPgliteSqlClient` (`@pkgs/sql-client/postgres/impl-pglite`) —
 *     full Postgres-compatible engine (PL/pgSQL, partitions, …)
 *   - `createPgMemSqlClient` (`@pkgs/sql-client/postgres/impl-pg-mem`) —
 *     faster in-memory emulator for simple DML/DDL unit tests
 */

export type { SqlClient } from '@pkgs/sql-client/interface';

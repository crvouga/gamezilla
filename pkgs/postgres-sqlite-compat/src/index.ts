/**
 * Postgres → SQLite compatibility layer.
 *
 * Install once per database so shared SQL can target SQLite-shaped APIs
 * (JSON1 first) on both engines. No-ops on SQLite.
 *
 * Real Postgres: {@link installPostgresSqliteCompat} (DDL from
 * `json-functions-sql.ts`).
 * mockingbird-postgres: {@link installMockingbirdPostgresSqliteCompat} (same statement list,
 * mem-safe `json_valid` — also applied by SqlClientImplMockingbirdPostgres.open).
 */

export {
  type InstallPostgresSqliteCompatOptions,
  installPostgresSqliteCompat,
  isPostgresSqlClient,
  type PostgresSqliteCompatSqlClient,
} from './install';
export {
  type InstallMockingbirdPostgresSqliteCompatOptions,
  installMockingbirdPostgresSqliteCompat,
} from './install-mockingbird-postgres';

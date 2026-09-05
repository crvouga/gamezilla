/**
 * Postgres → SQLite compatibility layer.
 *
 * Install once per database so shared SQL can target SQLite-shaped APIs
 * (JSON1 first) on both engines. No-ops on SQLite.
 *
 * Real Postgres: {@link installPostgresSqliteCompat} (DDL from
 * `json-functions-sql.ts`).
 * postgres-mem: {@link installPostgresMemSqliteCompat} (same statement list,
 * mem-safe `json_valid` — also applied by SqlClientImplPostgresMem.open).
 */

export {
  type InstallPostgresSqliteCompatOptions,
  installPostgresSqliteCompat,
  isPostgresSqlClient,
  type PostgresSqliteCompatSqlClient,
} from './install';
export {
  type InstallPostgresMemSqliteCompatOptions,
  installPostgresMemSqliteCompat,
} from './install-postgres-mem';

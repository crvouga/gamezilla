/**
 * Postgres → SQLite compatibility layer.
 *
 * Install once per database so shared SQL can target SQLite-shaped APIs
 * (JSON1 first) on both engines. No-ops on SQLite.
 *
 * Real Postgres / PGlite: {@link installPostgresSqliteCompat} (DDL from
 * `json-functions-sql.ts`).
 * postgres-mem: {@link installPostgresMemSqliteCompat} (same statement list,
 * mem-safe `json_valid` — also applied by SqlClientImplPostgresMem.open).
 * pg-mem: JS `registerFunction` lives in
 * `@pkgs/sql-client/postgres/pg-mem-sqlite-compat` (avoids pulling `pg-mem`
 * into every compat consumer; applied by createPgMemSqlClient).
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

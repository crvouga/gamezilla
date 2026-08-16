/**
 * Postgres → SQLite compatibility layer.
 *
 * Install once per database so shared SQL can target SQLite-shaped APIs
 * (JSON1 first) on both engines. No-ops on SQLite.
 *
 * Real Postgres / PGlite: {@link installPostgresSqliteCompat} (PL/pgSQL DDL).
 * pg-mem: {@link installPgMemSqliteCompat} (JS `registerFunction` — also
 * applied automatically by {@link createPgMemSqlClient}).
 */

export {
  type InstallPostgresSqliteCompatOptions,
  installPostgresSqliteCompat,
  isPostgresSqlClient,
} from './install';
export {
  type InstallPgMemSqliteCompatOptions,
  installPgMemSqliteCompat,
} from './install-pg-mem';

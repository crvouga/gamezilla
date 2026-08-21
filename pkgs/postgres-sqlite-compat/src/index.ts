/**
 * Postgres → SQLite compatibility layer.
 *
 * Install once per database so shared SQL can target SQLite-shaped APIs
 * (JSON1 first) on both engines. No-ops on SQLite.
 *
 * Real Postgres / PGlite: {@link installPostgresSqliteCompat} (PL/pgSQL DDL).
 * pg-mem: {@link installPgMemSqliteCompat} (JS `registerFunction` — also
 * applied automatically by {@link createPgMemSqlClient}).
 * postgres-mem: {@link installPostgresMemSqliteCompat} (`LANGUAGE sql` — also
 * applied automatically by {@link createPostgresMemSqlClient}).
 */

export {
  type InstallPostgresSqliteCompatOptions,
  installPostgresSqliteCompat,
  isPostgresSqlClient,
} from './install';
export {
  type InstallPgMemSqliteCompatOptions,
  installPgMemSqliteCompat,
  type InstallPostgresMemSqliteCompatOptions,
  installPostgresMemSqliteCompat,
} from './install-pg-mem';
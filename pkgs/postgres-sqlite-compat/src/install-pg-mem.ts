/**
 * Re-export in-memory Postgres SQLite JSON1 installs (implementation lives
 * next to the SqlClient adapters to avoid a sql-client ↔ compat cycle).
 */

export {
  type InstallPgMemSqliteCompatOptions,
  installPgMemSqliteCompat,
} from '@pkgs/sql-client/postgres/pg-mem-sqlite-compat';
export {
  type InstallPostgresMemSqliteCompatOptions,
  installPostgresMemSqliteCompat,
} from '@pkgs/sql-client/postgres/postgres-mem-sqlite-compat';
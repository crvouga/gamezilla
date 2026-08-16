/**
 * Re-export pg-mem SQLite JSON1 install (implementation lives next to
 * {@link createPgMemSqlClient} to avoid a sql-client ↔ compat cycle).
 */

export {
  type InstallPgMemSqliteCompatOptions,
  installPgMemSqliteCompat,
} from '@pkgs/sql-client/postgres/pg-mem-sqlite-compat';

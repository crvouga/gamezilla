/**
 * Postgres → SQLite compatibility layer.
 *
 * Install once per database so shared SQL can target SQLite-shaped APIs
 * (JSON1 first) on both engines. No-ops on SQLite.
 */

export {
  type InstallPostgresSqliteCompatOptions,
  installPostgresSqliteCompat,
  isPostgresSqlClient,
} from './install';

/**
 * Postgres → SQLite compatibility layer.
 *
 * Install once per database so shared SQL can target SQLite-shaped APIs
 * (JSON1 first) on both engines.
 */

export {
  installPostgresSqliteCompat,
  type InstallPostgresSqliteCompatOptions,
} from './install';

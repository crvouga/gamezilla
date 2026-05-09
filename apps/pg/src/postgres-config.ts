/**
 * Env-driven config for the local Postgres lifecycle. Validates aggressively
 * on read (Tiger style) so a bad `PG_PORT=abc` blows up at startup with a
 * useful message instead of a confusing `pg_ctl` error later.
 */

import { assert } from '@gamezilla/lib/assert';
import { DATA_DIR, resolveFromAppRoot } from './postgres-paths';

export interface PostgresConfig {
  /** Listen host (`postgres -h`). */
  readonly host: string;
  /** Listen port (`postgres -p`). */
  readonly port: number;
  /** Cluster directory (`initdb -D`). */
  readonly dataDir: string;
  /** Superuser username created by `initdb -U`. */
  readonly user: string;
  /** Superuser password (written to a temporary file for `initdb --pwfile`). */
  readonly password: string;
  /**
   * Default database created by `initdb`. Postgres always creates `postgres`
   * automatically too; this is only a convenience for tooling that defaults
   * to the cluster name.
   */
  readonly database: string;
  /** Locale used for `initdb --locale` (defaults to `C` for portability). */
  readonly locale: string;
  /** Encoding used for `initdb --encoding` (defaults to `UTF8`). */
  readonly encoding: string;
  /** How long to wait for `pg_isready` after starting the postmaster. */
  readonly startupTimeoutMs: number;
  /** How long to wait for `pg_ctl stop -m fast` before escalating. */
  readonly shutdownTimeoutMs: number;
}

const DEFAULTS = {
  host: '127.0.0.1',
  port: 5432,
  user: 'postgres',
  password: 'postgres',
  database: 'postgres',
  locale: 'C',
  encoding: 'UTF8',
  startupTimeoutMs: 30_000,
  shutdownTimeoutMs: 15_000,
} as const;

function readString(name: string, fallback: string): string {
  const raw = process.env[name]?.trim();
  return raw === undefined || raw === '' ? fallback : raw;
}

function readInt(
  name: string,
  fallback: number,
  range: { min: number; max: number }
): number {
  const raw = process.env[name]?.trim();
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  assert.integer(n, `${name} must be an integer (got ${JSON.stringify(raw)})`);
  assert.ok(n >= range.min && n <= range.max, `${name} out of range`, {
    value: n,
    ...range,
  });
  return n;
}

export function loadPostgresConfig(): PostgresConfig {
  const host = readString('PG_HOST', DEFAULTS.host);
  assert.nonEmptyString(host, 'PG_HOST must be a non-empty string');

  const port = readInt('PG_PORT', DEFAULTS.port, { min: 1, max: 65_535 });

  const rawDataDir = process.env['PG_DATA_DIR']?.trim();
  const dataDir =
    rawDataDir === undefined || rawDataDir === ''
      ? DATA_DIR
      : resolveFromAppRoot(rawDataDir);

  const user = readString('PG_USER', DEFAULTS.user);
  assert.nonEmptyString(user, 'PG_USER must be non-empty');

  const password = readString('PG_PASSWORD', DEFAULTS.password);
  assert.nonEmptyString(password, 'PG_PASSWORD must be non-empty');

  const database = readString('PG_DATABASE', DEFAULTS.database);
  assert.nonEmptyString(database, 'PG_DATABASE must be non-empty');

  const locale = readString('PG_LOCALE', DEFAULTS.locale);
  const encoding = readString('PG_ENCODING', DEFAULTS.encoding);

  const startupTimeoutMs = readInt(
    'PG_STARTUP_TIMEOUT_MS',
    DEFAULTS.startupTimeoutMs,
    { min: 1_000, max: 5 * 60_000 }
  );
  const shutdownTimeoutMs = readInt(
    'PG_SHUTDOWN_TIMEOUT_MS',
    DEFAULTS.shutdownTimeoutMs,
    { min: 1_000, max: 5 * 60_000 }
  );

  return {
    host,
    port,
    dataDir,
    user,
    password,
    database,
    locale,
    encoding,
    startupTimeoutMs,
    shutdownTimeoutMs,
  };
}

export function buildConnectionUrl(config: PostgresConfig): string {
  const auth = `${encodeURIComponent(config.user)}:${encodeURIComponent(config.password)}`;
  return `postgres://${auth}@${config.host}:${String(config.port)}/${config.database}?sslmode=disable`;
}

/**
 * Env-driven config for the local Postgres lifecycle. Validates aggressively
 * on read (Tiger style) so a bad `PG_PORT=abc` blows up at startup with a
 * useful message instead of a confusing `pg_ctl` error later.
 */

import { assert } from '@pkgs/assert';
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
  /** Web GUI sidecar (`pgweb`) configuration. */
  readonly gui: PgwebConfig;
}

export interface PgwebConfig {
  /**
   * When false, `dev` skips the GUI sidecar entirely (postgres still starts).
   * Defaults: off when `CI=1` or `PG_GUI` is one of `off|0|false`; on otherwise.
   */
  readonly enabled: boolean;
  /** `pgweb --bind` (HTTP server hostname). */
  readonly host: string;
  /** `pgweb --listen` (HTTP server port). */
  readonly port: number;
  /**
   * Optional absolute path to the `pgweb` binary. Defaults to PATH lookup with
   * Homebrew prefixes as fallback (see `pkgs/pg/src/pg-gui.ts`).
   */
  readonly binaryOverride: string | null;
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
  guiHost: '127.0.0.1',
  // 5555 sits next to the Postgres port (5432) so the two dev URLs cluster in
  // the developer's mental port map. Avoids known local-dev collisions: 8081
  // is Expo Web's default (see better-auth trusted-origins), 8888 is Jupyter,
  // 8080 is common for stray HTTP servers. 5555 is in IANA's unassigned range
  // and not used by any common dev tool.
  guiPort: 5555,
} as const;

/** Truthy/falsey parser for boolean env knobs. */
const FALSEY = new Set(['off', '0', 'false', 'no']);

function readGuiEnabled(): boolean {
  const raw = process.env['PG_GUI']?.trim().toLowerCase();
  if (raw !== undefined && raw !== '') {
    return !FALSEY.has(raw);
  }
  // Default off in CI (no browser to open) but on for local dev.
  if ((process.env['CI'] ?? '').trim() !== '') return false;
  return true;
}

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

  const guiHost = readString('PG_GUI_HOST', DEFAULTS.guiHost);
  assert.nonEmptyString(guiHost, 'PG_GUI_HOST must be non-empty');
  const guiPort = readInt('PG_GUI_PORT', DEFAULTS.guiPort, {
    min: 1,
    max: 65_535,
  });
  const rawGuiBin = process.env['PG_GUI_BIN']?.trim();
  const guiBinaryOverride =
    rawGuiBin === undefined || rawGuiBin === '' ? null : rawGuiBin;

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
    gui: {
      enabled: readGuiEnabled(),
      host: guiHost,
      port: guiPort,
      binaryOverride: guiBinaryOverride,
    },
  };
}

export function buildGuiUrl(config: PostgresConfig): string {
  return `http://${config.gui.host}:${String(config.gui.port)}`;
}

export function buildConnectionUrl(config: PostgresConfig): string {
  const auth = `${encodeURIComponent(config.user)}:${encodeURIComponent(config.password)}`;
  return `postgres://${auth}@${config.host}:${String(config.port)}/${config.database}?sslmode=disable`;
}

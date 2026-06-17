import { SqlClientImplPostgresTcp } from '@pkgs/sql-client/impl-postgres-tcp';
import { appPostgresDbScope } from '@libs/infra/namespace-bindings';
import { ok } from '../lib/fmt';
import type { CiPlatform } from '../platform/platform';
import { fetchVaultSecret } from '../secrets/secrets';
import { ResourceBase, type InfraContext } from './types';

export class PlanetScalePostgres extends ResourceBase {
  readonly id = 'planetscale-postgres';

  async provision(_platform: CiPlatform, _ctx: InfraContext): Promise<void> {
    const url = await resolveDatabaseUrl();
    ok('DATABASE_URL', url.replace(/\/\/[^@]+@/, '//***:***@'));
  }

  async destroy(): Promise<void> {
    ok('Database (PlanetScale)', 'manually managed — skipping');
  }
}

export interface DatabasePingResult {
  readonly ok: boolean;
  readonly host?: string;
  readonly durationMs: number;
  readonly error?: string;
}

/**
 * Pings the database with `SELECT 1` using `DATABASE_URL` from the environment.
 * Read-only and safe to call from health checks.
 */
export async function pingDatabase(): Promise<DatabasePingResult> {
  const start = Date.now();
  try {
    const url = (process.env['DATABASE_URL'] ?? '').trim();
    if (!url) {
      return {
        ok: false,
        durationMs: Date.now() - start,
        error:
          'DATABASE_URL not set — run `bun run infra deploy` or ensure Vault exposes DATABASE_URL',
      };
    }
    if (!url.startsWith('postgresql://') && !url.startsWith('postgres://')) {
      return {
        ok: false,
        durationMs: Date.now() - start,
        error:
          'DATABASE_URL is malformed (expected postgres:// or postgresql://)',
      };
    }
    const host = new URL(url).host;
    const probe = await probeDatabase(url);
    if (!probe.ok) {
      return {
        ok: false,
        host,
        durationMs: Date.now() - start,
        error: probe.error,
      };
    }
    return { ok: true, host, durationMs: Date.now() - start };
  } catch (e) {
    return {
      ok: false,
      durationMs: Date.now() - start,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

type ProbeResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: string };

/**
 * PlanetScale Postgres is reached over the wire protocol (same path as the
 * distributed lock and `db:migrate`), not Neon's HTTP `/sql` API — pooled
 * `DATABASE_URL` values from Vault work here but often fail the serverless driver.
 */
async function probeDatabase(url: string): Promise<ProbeResult> {
  const sql = SqlClientImplPostgresTcp.connect(url, appPostgresDbScope());
  try {
    await sql.connect();
    const rows = await sql.query<{ ok: number }>('SELECT 1 AS ok');
    if (!Array.isArray(rows) || rows.length === 0) {
      return { ok: false, error: 'SELECT 1 returned no rows' };
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  } finally {
    await sql.disconnect().catch(() => undefined);
  }
}

// Claims ownership of tables in the application schema (the session's pinned
// `search_path`, i.e. `current_schema()`), not `public`.
const CLAIM_TABLE_OWNERSHIP_SQL = `
  DO $$
  DECLARE r RECORD;
  BEGIN
    FOR r IN
      SELECT tablename FROM pg_tables
      WHERE schemaname = current_schema()
        AND tableowner <> current_user
    LOOP
      EXECUTE format('ALTER TABLE %I.%I OWNER TO %I', current_schema(), r.tablename, current_user);
    END LOOP;
  END$$
`;

/**
 * One TCP session for `SELECT 1` plus best-effort ownership claim — avoids
 * opening two connections during lock acquisition on tight direct limits.
 */
async function verifyDatabaseAndClaimOwnership(
  url: string
): Promise<ProbeResult> {
  const sql = SqlClientImplPostgresTcp.connect(url, appPostgresDbScope());
  try {
    await sql.connect();
    const rows = await sql.query<{ ok: number }>('SELECT 1 AS ok');
    if (!Array.isArray(rows) || rows.length === 0) {
      return { ok: false, error: 'SELECT 1 returned no rows' };
    }
    try {
      await sql.run(CLAIM_TABLE_OWNERSHIP_SQL);
    } catch {
      // Best-effort: if the role lacks permission, the Worker migration
      // will handle it by skipping DDL on existing tables.
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  } finally {
    await sql.disconnect().catch(() => undefined);
  }
}

/** Set after the first successful wire check in this process (lock build). */
let databaseUrlVerifiedInProcess = false;

function tryFetchCachedDbUrlFromEnv(): string | null {
  const url = (process.env['DATABASE_URL'] ?? '').trim();
  if (!url) return null;
  return url.startsWith('postgresql://') || url.startsWith('postgres://')
    ? url
    : null;
}

function readDbUrlFromVault(): string {
  let raw = process.env['DATABASE_URL'];
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    try {
      const fromVault = fetchVaultSecret('DATABASE_URL').trim();
      if (fromVault.length > 0) {
        process.env['DATABASE_URL'] = fromVault;
        raw = fromVault;
      }
    } catch {
      // handled below
    }
  }
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    throw new Error(
      'DATABASE_URL is not set and could not be read from Vault. Add secret DATABASE_URL in your Vault config, ensure `vault setup` / `VAULT_TOKEN` targets that project, or export DATABASE_URL in the shell.'
    );
  }
  const url = raw.trim();
  if (!url.startsWith('postgresql://') && !url.startsWith('postgres://')) {
    throw new Error(
      'DATABASE_URL for PlanetScale must start with postgres:// or postgresql://'
    );
  }
  return url;
}

/**
 * Sets `process.env.DATABASE_URL` from a valid cached Postgres URL, or loads `DATABASE_URL`
 * from Vault, after a connectivity check and best-effort ownership claim.
 *
 * After the first successful check in this process (during distributed-lock
 * setup), later calls return the cached URL without opening another TCP
 * session — `Ensure: planetscale-postgres` must not probe while the lock
 * connection is already held.
 */
export async function resolveDatabaseUrl(): Promise<string> {
  if (databaseUrlVerifiedInProcess) {
    const cached = tryFetchCachedDbUrlFromEnv();
    if (cached) {
      return cached;
    }
    const url = readDbUrlFromVault();
    process.env['DATABASE_URL'] = url;
    return url;
  }

  const cached = tryFetchCachedDbUrlFromEnv();
  if (cached) {
    const probe = await verifyDatabaseAndClaimOwnership(cached);
    if (probe.ok) {
      process.env['DATABASE_URL'] = cached;
      databaseUrlVerifiedInProcess = true;
      return cached;
    }
  }

  const url = readDbUrlFromVault();
  const probe = await verifyDatabaseAndClaimOwnership(url);
  if (!probe.ok) {
    const hint =
      cached !== null
        ? ' (env DATABASE_URL also failed — check Vault `prd` `DATABASE_URL` matches a Postgres wire URL)'
        : '';
    throw new Error(
      `DATABASE_URL connectivity check failed (SELECT 1)${hint}: ${probe.error}`
    );
  }

  process.env['DATABASE_URL'] = url;
  databaseUrlVerifiedInProcess = true;
  return url;
}

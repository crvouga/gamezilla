import { SqlClientImplPostgresTcp } from '@pkgs/sql-client/impl-postgres-tcp';
import { ok } from '../lib/fmt';
import type { CiPlatform } from '../platform/platform';
import { fetchDopplerSecret } from '../secrets/secrets';
import { ResourceBase, type InfraContext } from './types';

export class PlanetScalePostgres extends ResourceBase {
  readonly id = 'planetscale-postgres';

  async provision(_platform: CiPlatform, _ctx: InfraContext): Promise<void> {
    const url = await resolveDatabaseUrl();
    ok('DB_URL', url.replace(/\/\/[^@]+@/, '//***:***@'));
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
 * Pings the database with `SELECT 1` using `DB_URL` from the environment.
 * Read-only and safe to call from health checks.
 */
export async function pingDatabase(): Promise<DatabasePingResult> {
  const start = Date.now();
  try {
    const url = (process.env['DB_URL'] ?? '').trim();
    if (!url) {
      return {
        ok: false,
        durationMs: Date.now() - start,
        error:
          'DB_URL not set — run `bun run infra deploy` or ensure Doppler exposes DB_URL',
      };
    }
    if (!url.startsWith('postgresql://') && !url.startsWith('postgres://')) {
      return {
        ok: false,
        durationMs: Date.now() - start,
        error: 'DB_URL is malformed (expected postgres:// or postgresql://)',
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
 * `DB_URL` values from Doppler work here but often fail the serverless driver.
 */
async function probeDatabase(url: string): Promise<ProbeResult> {
  const sql = SqlClientImplPostgresTcp.connect(url);
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

/**
 * Reassigns ownership of public-schema tables/sequences to CURRENT_USER.
 * Fixes orphaned ownership left by previously deleted PlanetScale roles.
 */
async function claimTableOwnership(url: string): Promise<void> {
  const sql = SqlClientImplPostgresTcp.connect(url);
  try {
    await sql.connect();
    await sql.run(`
      DO $$
      DECLARE r RECORD;
      BEGIN
        FOR r IN
          SELECT tablename FROM pg_tables
          WHERE schemaname = 'public'
            AND tableowner <> current_user
        LOOP
          EXECUTE format('ALTER TABLE public.%I OWNER TO %I', r.tablename, current_user);
        END LOOP;
      END$$
    `);
  } catch {
    // Best-effort: if the role lacks permission, the Worker migration
    // will handle it by skipping DDL on existing tables.
  } finally {
    await sql.disconnect().catch(() => undefined);
  }
}

function tryFetchCachedDbUrlFromEnv(): string | null {
  const url = (process.env['DB_URL'] ?? '').trim();
  if (!url) return null;
  return url.startsWith('postgresql://') || url.startsWith('postgres://')
    ? url
    : null;
}

function readDbUrlFromDoppler(): string {
  let raw = process.env['DB_URL'];
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    try {
      const fromDoppler = fetchDopplerSecret('DB_URL').trim();
      if (fromDoppler.length > 0) {
        process.env['DB_URL'] = fromDoppler;
        raw = fromDoppler;
      }
    } catch {
      // handled below
    }
  }
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    throw new Error(
      'DB_URL is not set and could not be read from Doppler. Add secret DB_URL in your Doppler config, ensure `doppler setup` / `DOPPLER_TOKEN` targets that project, or export DB_URL in the shell.'
    );
  }
  const url = raw.trim();
  if (!url.startsWith('postgresql://') && !url.startsWith('postgres://')) {
    throw new Error(
      'DB_URL for PlanetScale must start with postgres:// or postgresql://'
    );
  }
  return url;
}

/**
 * Sets `process.env.DB_URL` from a valid cached Postgres URL, or loads `DB_URL`
 * from Doppler, after a connectivity check and best-effort ownership claim.
 */
export async function resolveDatabaseUrl(): Promise<string> {
  const cached = tryFetchCachedDbUrlFromEnv();
  if (cached) {
    const probe = await probeDatabase(cached);
    if (probe.ok) {
      await claimTableOwnership(cached);
      process.env['DB_URL'] = cached;
      return cached;
    }
  }

  const url = readDbUrlFromDoppler();
  const probe = await probeDatabase(url);
  if (!probe.ok) {
    const hint =
      cached !== null
        ? ' (env DB_URL also failed — check Doppler `prod` `DB_URL` matches a Postgres wire URL)'
        : '';
    throw new Error(
      `DB_URL connectivity check failed (SELECT 1)${hint}: ${probe.error}`
    );
  }

  await claimTableOwnership(url);
  process.env['DB_URL'] = url;
  return url;
}

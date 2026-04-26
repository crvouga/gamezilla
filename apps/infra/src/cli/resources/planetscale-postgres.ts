import { neon, neonConfig } from '@neondatabase/serverless';
import { ok } from '../lib/fmt';
import type { CiPlatform } from '../platform/platform';
import { psHeaders } from '../secrets/planetscale';
import { ResourceBase, type InfraContext } from './types';

const PS_API = 'https://api.planetscale.com/v1';
const ROLE_NAME = 'infra-deploy';
const BRANCH = 'main';

interface PsRole {
  id: string;
  name: string;
  access_host_url: string;
  username: string;
  password: string;
  database_name: string;
  expired: boolean;
}

function psOrg(): string {
  return process.env['TF_VAR_planetscale_org'] ?? '';
}

function psDatabase(): string {
  return process.env['TF_VAR_planetscale_database'] ?? '';
}

function rolesUrl(): string {
  return `${PS_API}/organizations/${psOrg()}/databases/${psDatabase()}/branches/${BRANCH}/roles`;
}

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
          'DB_URL not set — run `bun run infra deploy` or export DB_URL for this shell',
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
    const sql = neonSql(url);
    const rows = await sql`SELECT 1 AS ok`;
    if (!Array.isArray(rows) || rows.length === 0) {
      return {
        ok: false,
        host,
        durationMs: Date.now() - start,
        error: 'SELECT 1 returned no rows',
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

// ── PlanetScale Roles API ────────────────────────────────────────────

async function listRoles(): Promise<PsRole[]> {
  const res = await fetch(rolesUrl(), { headers: psHeaders() });
  if (!res.ok) {
    throw new Error(
      `PlanetScale list roles: HTTP ${res.status} — ${await res.text()}`
    );
  }
  const body = (await res.json()) as { data: PsRole[] };
  return body.data;
}

async function deleteRole(id: string): Promise<void> {
  const res = await fetch(`${rolesUrl()}/${id}`, {
    method: 'DELETE',
    headers: psHeaders(),
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`PlanetScale delete role ${id}: HTTP ${res.status}`);
  }
}

async function createRole(): Promise<PsRole> {
  const res = await fetch(rolesUrl(), {
    method: 'POST',
    headers: { ...psHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: ROLE_NAME,
      inherited_roles: ['postgres'],
    }),
  });
  if (!res.ok) {
    throw new Error(
      `PlanetScale create role: HTTP ${res.status} — ${await res.text()}`
    );
  }
  return (await res.json()) as PsRole;
}

function buildDatabaseUrl(role: PsRole): string {
  const user = encodeURIComponent(role.username);
  const pass = encodeURIComponent(role.password);
  const host = role.access_host_url;
  const db = role.database_name;
  return `postgresql://${user}:${pass}@${host}:5432/${db}?sslmode=verify-full`;
}

function neonSql(url: string) {
  neonConfig.fetchEndpoint = (host) => `https://${host}/sql`;
  return neon(url);
}

async function validateConnectivity(url: string): Promise<boolean> {
  try {
    const sql = neonSql(url);
    const rows = await sql`SELECT 1 AS ok`;
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
}

/**
 * Reassigns ownership of public-schema tables/sequences to CURRENT_USER.
 * Fixes orphaned ownership left by previously deleted PlanetScale roles.
 */
async function claimTableOwnership(url: string): Promise<void> {
  const sql = neonSql(url);
  try {
    await sql`
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
    `;
  } catch {
    // Best-effort: if the role lacks permission, the Worker migration
    // will handle it by skipping DDL on existing tables.
  }
}

function tryFetchCachedUrlFromEnv(): string | null {
  const url = (process.env['DB_URL'] ?? '').trim();
  if (!url) return null;
  return url.startsWith('postgresql://') || url.startsWith('postgres://')
    ? url
    : null;
}

/**
 * Resolves `DB_URL` from PlanetScale credentials via the Roles API.
 *
 * 1. If `DB_URL` is already set and connectivity succeeds, reuse it.
 * 2. Otherwise, clean up stale roles, create a fresh one, set `process.env.DB_URL`.
 */
export async function resolveDatabaseUrl(): Promise<string> {
  if (!psOrg() || !psDatabase()) {
    throw new Error(
      'Cannot resolve DB_URL: TF_VAR_planetscale_org and TF_VAR_planetscale_database must be set'
    );
  }

  const cached = tryFetchCachedUrlFromEnv();
  if (cached) {
    const valid = await validateConnectivity(cached);
    if (valid) {
      await claimTableOwnership(cached);
      process.env['DB_URL'] = cached;
      return cached;
    }
  }

  const existing = await listRoles();
  const stale = existing.filter((r) => r.name === ROLE_NAME);
  for (const r of stale) {
    await deleteRole(r.id);
  }

  const role = await createRole();
  const url = buildDatabaseUrl(role);

  const valid = await validateConnectivity(url);
  if (!valid) {
    throw new Error('DB_URL connectivity check failed after role creation');
  }

  await claimTableOwnership(url);
  process.env['DB_URL'] = url;
  return url;
}

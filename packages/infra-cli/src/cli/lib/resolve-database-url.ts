import { neon, neonConfig } from '@neondatabase/serverless';
import { psHeaders } from '../secrets/planetscale';

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

async function listRoles(): Promise<PsRole[]> {
  const res = await fetch(rolesUrl(), { headers: psHeaders() });
  if (!res.ok) {
    throw new Error(`PlanetScale list roles: HTTP ${res.status} — ${await res.text()}`);
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
    throw new Error(`PlanetScale create role: HTTP ${res.status} — ${await res.text()}`);
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

async function validateConnectivity(url: string): Promise<void> {
  neonConfig.fetchEndpoint = (host) => `https://${host}/sql`;
  const sql = neon(url);
  const rows = await sql`SELECT 1 AS ok`;
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('SELECT 1 returned no rows');
  }
}

/**
 * Derives DATABASE_URL from PlanetScale credentials by creating a role
 * on the main branch via the Roles API.
 *
 * Requires PLANETSCALE_SERVICE_TOKEN_ID, PLANETSCALE_SERVICE_TOKEN,
 * TF_VAR_planetscale_org, and TF_VAR_planetscale_database in process.env.
 *
 * Deletes any existing "infra-deploy" role first (the plain-text password
 * is only available at creation time), creates a fresh one, builds the
 * connection URL, validates it with SELECT 1 over HTTP, and sets
 * process.env.DATABASE_URL.
 */
export async function resolveDatabaseUrl(): Promise<string> {
  if (!psOrg() || !psDatabase()) {
    throw new Error(
      'Cannot resolve DATABASE_URL: TF_VAR_planetscale_org and TF_VAR_planetscale_database must be set',
    );
  }

  const existing = await listRoles();
  const stale = existing.filter((r) => r.name === ROLE_NAME);
  for (const r of stale) {
    await deleteRole(r.id);
  }

  const role = await createRole();
  const url = buildDatabaseUrl(role);

  await validateConnectivity(url);

  process.env['DATABASE_URL'] = url;
  return url;
}

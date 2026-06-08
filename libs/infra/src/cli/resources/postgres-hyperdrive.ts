import { assert } from '@pkgs/assert';
import { ok, warn } from '../lib/fmt';
import type { CiPlatform } from '../platform/platform';
import { cfAccountId, cfHeaders } from '../secrets/cloudflare';
import { ResourceBase, type InfraContext } from './types';

const CF_API = 'https://api.cloudflare.com/client/v4';

const PLACEHOLDER_HYPERDRIVE_ID = '00000000-0000-0000-0000-000000000000';

/** Retired Hyperdrive config — `destroy()` deletes this id on every deploy. */
const RETIRED_HYPERDRIVE = {
  name: 'gamezilla-api-postgres',
  id: '3b8852ba7f4a43a981f672e3140b6acd',
} as const;
const ORIGIN_CONNECTION_LIMIT = 20;

type HyperdriveConfigSummary = {
  readonly id: string;
  readonly name: string;
};

type HyperdriveOriginPublic = {
  scheme: 'postgres' | 'postgresql';
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
};

function parseDbUrlToOrigin(dbUrl: string): HyperdriveOriginPublic {
  const trimmed = dbUrl.trim();
  assert.ok(
    trimmed.startsWith('postgresql://') || trimmed.startsWith('postgres://'),
    'DATABASE_URL must be postgres:// or postgresql:// for Hyperdrive',
    { prefix: trimmed.slice(0, 24) }
  );
  const u = new URL(trimmed);
  const schemeRaw = u.protocol.replace(/:$/, '').toLowerCase();
  assert.ok(
    schemeRaw === 'postgres' || schemeRaw === 'postgresql',
    'DATABASE_URL scheme must be postgres or postgresql',
    { scheme: schemeRaw }
  );
  const scheme = schemeRaw === 'postgresql' ? 'postgresql' : 'postgres';
  const host = u.hostname;
  assert.ok(host.length > 0, 'DATABASE_URL must include a host', {
    dbUrl: trimmed,
  });
  const port = u.port !== '' ? Number(u.port) : 5432;
  assert.integer(port, 'DATABASE_URL port must be an integer');
  assert.ok(port >= 1 && port <= 65_535, 'DATABASE_URL port out of range', {
    port,
  });
  let database = u.pathname.replace(/^\//, '');
  if (database === '') database = 'postgres';
  const user = u.username !== '' ? decodeURIComponent(u.username) : 'postgres';
  const password = u.password !== '' ? decodeURIComponent(u.password) : '';
  return { scheme, host, port, database, user, password };
}

async function listHyperdriveConfigs(
  accountId: string
): Promise<HyperdriveConfigSummary[]> {
  const res = await fetch(
    `${CF_API}/accounts/${accountId}/hyperdrive/configs`,
    {
      headers: cfHeaders(),
    }
  );
  const body = (await res.json()) as {
    success?: boolean;
    errors?: unknown;
    result?: HyperdriveConfigSummary[];
  };
  if (!res.ok || body.success !== true || !Array.isArray(body.result)) {
    const detail = JSON.stringify(body.errors ?? body);
    if (res.status === 403) {
      assert.fail(
        `Hyperdrive list failed: HTTP 403 — CLOUDFLARE_API_TOKEN is missing ` +
          `the "Workers Hyperdrive Edit" Account permission. Edit the token at ` +
          `https://dash.cloudflare.com/profile/api-tokens, add that permission ` +
          `(Account Resources → All accounts), then update the token in Vault ` +
          `(\`vault secrets set CLOUDFLARE_API_TOKEN=...\`). Detail: ${detail.slice(0, 400)}`
      );
    }
    assert.fail(
      `Hyperdrive list failed: HTTP ${String(res.status)} ${detail.slice(0, 500)}`
    );
  }
  return body.result;
}

async function createHyperdriveConfig(args: {
  accountId: string;
  name: string;
  origin: HyperdriveOriginPublic;
}): Promise<string> {
  const res = await fetch(
    `${CF_API}/accounts/${args.accountId}/hyperdrive/configs`,
    {
      method: 'POST',
      headers: cfHeaders(),
      body: JSON.stringify({
        name: args.name,
        origin: {
          scheme: args.origin.scheme,
          host: args.origin.host,
          port: args.origin.port,
          database: args.origin.database,
          user: args.origin.user,
          password: args.origin.password,
        },
        origin_connection_limit: ORIGIN_CONNECTION_LIMIT,
      }),
    }
  );
  const body = (await res.json()) as {
    success?: boolean;
    result?: { id?: string };
    errors?: unknown;
  };
  if (!res.ok || body.success !== true || typeof body.result?.id !== 'string') {
    const detail = JSON.stringify(body.errors ?? body);
    assert.fail(
      `Hyperdrive create failed: HTTP ${String(res.status)} ${detail.slice(0, 800)}`
    );
  }
  return body.result.id;
}

async function patchHyperdriveOrigin(args: {
  accountId: string;
  configId: string;
  origin: HyperdriveOriginPublic;
}): Promise<void> {
  const res = await fetch(
    `${CF_API}/accounts/${args.accountId}/hyperdrive/configs/${args.configId}`,
    {
      method: 'PATCH',
      headers: cfHeaders(),
      body: JSON.stringify({
        origin: {
          scheme: args.origin.scheme,
          host: args.origin.host,
          port: args.origin.port,
          database: args.origin.database,
          user: args.origin.user,
          password: args.origin.password,
        },
        origin_connection_limit: ORIGIN_CONNECTION_LIMIT,
      }),
    }
  );
  const body = (await res.json()) as { success?: boolean; errors?: unknown };
  if (!res.ok || body.success !== true) {
    const detail = JSON.stringify(body.errors ?? body);
    assert.fail(
      `Hyperdrive PATCH failed: HTTP ${String(res.status)} ${detail.slice(0, 800)}`
    );
  }
}

async function deleteHyperdriveConfig(
  accountId: string,
  configId: string
): Promise<void> {
  const res = await fetch(
    `${CF_API}/accounts/${accountId}/hyperdrive/configs/${configId}`,
    {
      method: 'DELETE',
      headers: cfHeaders(),
    }
  );
  if (res.status === 404) return;
  const body = (await res.json()) as { success?: boolean; errors?: unknown };
  if (!res.ok || body.success !== true) {
    const detail = JSON.stringify(body.errors ?? body);
    warn(
      'Hyperdrive delete',
      `HTTP ${String(res.status)} ${detail.slice(0, 400)}`
    );
  }
}

/**
 * Cloudflare Hyperdrive config that fronts the API Worker's PlanetScale
 * Postgres origin. A Cloudflare account can host multiple Hyperdrive
 * configs (one per origin) — this resource only manages the
 * Postgres-backed one. Add a sibling `*-hyperdrive.ts` resource for any
 * other origin (MySQL, a second Postgres, etc.) rather than overloading
 * this class.
 */
export class PostgresHyperdriveResource extends ResourceBase {
  readonly id = 'postgres-hyperdrive';
  override readonly routineStatus = 'destroyed' as const;

  async provision(_platform: CiPlatform, _ctx: InfraContext): Promise<void> {
    const accountId = cfAccountId();
    assert.nonEmptyString(accountId, 'CLOUDFLARE_ACCOUNT_ID must be set');

    const dbUrl = (process.env['DATABASE_URL'] ?? '').trim();
    assert.nonEmptyString(
      dbUrl,
      'DATABASE_URL must be set (Vault) to provision Hyperdrive origin'
    );

    const origin = parseDbUrlToOrigin(dbUrl);
    const { name } = RETIRED_HYPERDRIVE;
    const configuredId = String(RETIRED_HYPERDRIVE.id);

    const existing = await listHyperdriveConfigs(accountId);
    const match = existing.find((c) => c.name === name) ?? null;

    if (match === null) {
      const newId = await createHyperdriveConfig({
        accountId,
        name,
        origin,
      });
      assert.fail(
        `Created Hyperdrive config "${name}" with id=${newId}. ` +
          `This resource is retired — delete the config manually if needed.`
      );
    }

    if (
      configuredId !== PLACEHOLDER_HYPERDRIVE_ID &&
      match.id !== configuredId
    ) {
      assert.fail(
        `Hyperdrive id drift: Cloudflare has id=${match.id} for "${name}" but ` +
          `RETIRED_HYPERDRIVE.id=${configuredId}.`
      );
    }

    if (configuredId === PLACEHOLDER_HYPERDRIVE_ID) {
      assert.fail(
        `Hyperdrive "${name}" exists (id=${match.id}) but RETIRED_HYPERDRIVE still has placeholder id.`
      );
    }

    await patchHyperdriveOrigin({
      accountId,
      configId: match.id,
      origin,
    });

    ok(
      'Hyperdrive (postgres)',
      `${name} → origin ${origin.host}:${String(origin.port)}/${origin.database} (id ${match.id})`
    );
  }

  async destroy(_platform: CiPlatform): Promise<void> {
    const accountId = cfAccountId();
    if (!accountId) {
      warn(
        'Hyperdrive (postgres)',
        'CLOUDFLARE_ACCOUNT_ID missing — skipping delete'
      );
      return;
    }
    const { name, id: hyperdriveId } = RETIRED_HYPERDRIVE;
    const id = String(hyperdriveId);
    if (id === PLACEHOLDER_HYPERDRIVE_ID) {
      ok(
        'Hyperdrive (postgres)',
        `no committed id for ${name} — skipping delete`
      );
      return;
    }
    await deleteHyperdriveConfig(accountId, id);
    ok('Hyperdrive (postgres)', `delete requested for ${name} (${String(id)})`);
  }
}

import { assert } from '@pkgs/assert';
import { PROJECT_CONFIG } from '../../project-config';
import { ok, warn } from '../lib/fmt';
import type { CiPlatform } from '../platform/platform';
import { cfAccountId, cfHeaders } from '../secrets/cloudflare';
import { ResourceBase, type InfraContext } from './types';

const CF_API = 'https://api.cloudflare.com/client/v4';

const PLACEHOLDER_HYPERDRIVE_ID = '00000000-0000-0000-0000-000000000000';
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
    'DB_URL must be postgres:// or postgresql:// for Hyperdrive',
    { prefix: trimmed.slice(0, 24) }
  );
  const u = new URL(trimmed);
  const schemeRaw = u.protocol.replace(/:$/, '').toLowerCase();
  assert.ok(
    schemeRaw === 'postgres' || schemeRaw === 'postgresql',
    'DB_URL scheme must be postgres or postgresql',
    { scheme: schemeRaw }
  );
  const scheme = schemeRaw === 'postgresql' ? 'postgresql' : 'postgres';
  const host = u.hostname;
  assert.ok(host.length > 0, 'DB_URL must include a host', { dbUrl: trimmed });
  const port = u.port !== '' ? Number(u.port) : 5432;
  assert.integer(port, 'DB_URL port must be an integer');
  assert.ok(port >= 1 && port <= 65_535, 'DB_URL port out of range', { port });
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
          `(Account Resources → All accounts), then update the token in Doppler ` +
          `(\`doppler secrets set CLOUDFLARE_API_TOKEN=...\`). Detail: ${detail.slice(0, 400)}`
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

export class HyperdriveResource extends ResourceBase {
  readonly id = 'hyperdrive';

  async provision(_platform: CiPlatform, _ctx: InfraContext): Promise<void> {
    const accountId = cfAccountId();
    assert.nonEmptyString(accountId, 'CLOUDFLARE_ACCOUNT_ID must be set');

    const dbUrl = (process.env['DB_URL'] ?? '').trim();
    assert.nonEmptyString(
      dbUrl,
      'DB_URL must be set (Doppler) to provision Hyperdrive origin'
    );

    const origin = parseDbUrlToOrigin(dbUrl);
    const { name } = PROJECT_CONFIG.cloudflare.hyperdrive;
    const configuredId = String(PROJECT_CONFIG.cloudflare.hyperdrive.id);

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
          `Commit this id to libs/infra/src/project-config.ts cloudflare.hyperdrive.id ` +
          `and apps/api/wrangler.toml [[hyperdrive]] id, then re-run deploy.`
      );
    }

    if (
      configuredId !== PLACEHOLDER_HYPERDRIVE_ID &&
      match.id !== configuredId
    ) {
      assert.fail(
        `Hyperdrive id drift: Cloudflare has id=${match.id} for "${name}" but ` +
          `PROJECT_CONFIG.cloudflare.hyperdrive.id=${configuredId}. Update project-config + wrangler.toml.`
      );
    }

    if (configuredId === PLACEHOLDER_HYPERDRIVE_ID) {
      assert.fail(
        `Hyperdrive "${name}" exists (id=${match.id}) but PROJECT_CONFIG still has placeholder id. ` +
          `Set cloudflare.hyperdrive.id to ${match.id} and apps/api/wrangler.toml [[hyperdrive]] id, then re-run deploy.`
      );
    }

    await patchHyperdriveOrigin({
      accountId,
      configId: match.id,
      origin,
    });

    ok(
      'Hyperdrive',
      `${name} → origin ${origin.host}:${String(origin.port)}/${origin.database} (id ${match.id})`
    );
  }

  async destroy(_platform: CiPlatform): Promise<void> {
    const accountId = cfAccountId();
    if (!accountId) {
      warn('Hyperdrive', 'CLOUDFLARE_ACCOUNT_ID missing — skipping delete');
      return;
    }
    const { name } = PROJECT_CONFIG.cloudflare.hyperdrive;
    const id = String(PROJECT_CONFIG.cloudflare.hyperdrive.id);
    if (id === PLACEHOLDER_HYPERDRIVE_ID) {
      ok('Hyperdrive', `no committed id for ${name} — skipping delete`);
      return;
    }
    await deleteHyperdriveConfig(accountId, id);
    ok('Hyperdrive', `delete requested for ${name} (${String(id)})`);
  }
}

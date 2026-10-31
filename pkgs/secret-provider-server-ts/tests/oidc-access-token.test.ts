import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared-ts/impl-in-memory';
import {
  MINTED_TOKEN_EXPIRES_AT,
  resolveInfisicalAccessTokenForWrites,
} from '@pkgs/secret-provider-server-ts/oidc-access-token';

/**
 * regression: infisical-ci-token-expired — the CI identity's token lives 10
 * minutes, but the first one minted was published as `INFISICAL_TOKEN` and
 * from then on read back as the caller's own, so every live export after the
 * tenth minute of a Health run failed with "Your token has expired".
 */

const ENV_KEYS = [
  'GITHUB_ACTIONS',
  'GITHUB_REPOSITORY',
  'INFISICAL_OIDC_AUDIENCE',
  'SECRETS_OIDC_AUDIENCE',
  'ACTIONS_ID_TOKEN_REQUEST_URL',
  'ACTIONS_ID_TOKEN_REQUEST_TOKEN',
  'SECRETS_IDENTITY_ID',
  'SECRETS_TOKEN',
  'INFISICAL_TOKEN',
  'INFISICAL_ACCESS_TOKEN',
  'SECRETS_ADDR',
  'SECRETS_PROJECT_ID',
  MINTED_TOKEN_EXPIRES_AT,
] as const;

const START = new Date('2026-09-28T00:00:00Z');
const MINUTE = 60_000;

let saved: Record<string, string | undefined>;
let server: ReturnType<typeof Bun.serve>;
let logins: number;
let now: number;

async function configStore(): Promise<ObjectStoreImplInMemory> {
  const store = new ObjectStoreImplInMemory();
  const config = {
    projectId: '26137c60-8dea-4d95-a8a3-30901615b026',
    environment: 'dev',
    endpoint: `http://127.0.0.1:${server.port}`,
  };
  await store.put(
    '.secrets.json',
    new TextEncoder().encode(JSON.stringify(config)),
    'application/json'
  );
  return store;
}

function advanceTo(ms: number): void {
  now = START.getTime() + ms;
}

async function resolve(): Promise<string | null> {
  return resolveInfisicalAccessTokenForWrites({
    repoRoot: '/repo',
    configStore: await configStore(),
    clock: { now: () => now },
  });
}

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
  logins = 0;
  server = Bun.serve({
    port: 0,
    fetch(req) {
      const url = new URL(req.url);
      if (url.pathname === '/github-oidc') {
        if (url.searchParams.get('audience') !== 'https://github.com/acme-org')
          return new Response('wrong audience', { status: 400 });
        return Response.json({ value: 'github-jwt' });
      }
      if (url.pathname === '/api/v1/auth/oidc-auth/login') {
        logins += 1;
        return Response.json({
          accessToken: `minted-${logins}`,
          expiresIn: 600,
        });
      }
      return new Response('not found', { status: 404 });
    },
  });
  now = START.getTime();
});

afterEach(() => {
  server.stop(true);
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe('in GitHub Actions', () => {
  beforeEach(() => {
    process.env['GITHUB_ACTIONS'] = 'true';
    process.env['GITHUB_REPOSITORY'] = 'acme-org/acme';
    process.env['ACTIONS_ID_TOKEN_REQUEST_URL'] =
      `http://127.0.0.1:${server.port}/github-oidc?x=1`;
    process.env['ACTIONS_ID_TOKEN_REQUEST_TOKEN'] = 'request-token';
    process.env['SECRETS_IDENTITY_ID'] = 'identity-1';
  });

  // regression: ci-provider-native-oidc-queryless-url
  test('requests the repository audience when the native OIDC URL has no query', async () => {
    process.env['ACTIONS_ID_TOKEN_REQUEST_URL'] =
      `http://127.0.0.1:${server.port}/github-oidc`;
    expect(await resolve()).toBe('minted-1');
  });

  test('mints a token and publishes it for the CLI and tooling', async () => {
    expect(await resolve()).toBe('minted-1');
    expect(process.env['INFISICAL_TOKEN']).toBe('minted-1');
    expect(process.env['SECRETS_TOKEN']).toBe('minted-1');
    expect(process.env[MINTED_TOKEN_EXPIRES_AT]).toBe(
      String(START.getTime() + 10 * MINUTE)
    );
  });

  test('reuses the minted token while it is valid', async () => {
    await resolve();
    advanceTo(8 * MINUTE);
    expect(await resolve()).toBe('minted-1');
    expect(logins).toBe(1);
  });

  test('mints a new token before the old one expires', async () => {
    await resolve();
    advanceTo(9.5 * MINUTE);
    expect(await resolve()).toBe('minted-2');
    expect(process.env['INFISICAL_TOKEN']).toBe('minted-2');
    expect(process.env['SECRETS_TOKEN']).toBe('minted-2');
    expect(logins).toBe(2);
  });

  test("never replaces the caller's own token", async () => {
    process.env['SECRETS_TOKEN'] = 'callers-own';
    advanceTo(60 * MINUTE);
    expect(await resolve()).toBe('callers-own');
    expect(logins).toBe(0);
  });
});

test('outside GitHub Actions an expiring minted token is still returned', async () => {
  process.env['INFISICAL_TOKEN'] = 'inherited';
  process.env[MINTED_TOKEN_EXPIRES_AT] = String(START.getTime());
  expect(await resolve()).toBe('inherited');
  expect(logins).toBe(0);
});

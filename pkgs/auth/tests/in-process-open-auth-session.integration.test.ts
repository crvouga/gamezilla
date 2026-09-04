import { describe, expect, test } from 'bun:test';
import { wallClock, wallTimers } from '@pkgs/clock';
import { createNoopLogger } from '@pkgs/logger';
import { SqlClientImplPostgresMem } from '@pkgs/sql-client/postgres/impl-postgres-mem';
import { createPostgresDbScope } from '@pkgs/sql-client/postgres/schema';
import { Hono } from 'hono';
import { createInMemoryAuthClientStorage } from '../src/client/bearer-token-store';
import { createAuthClientAdapter } from '../src/client/create-auth-client-adapter';
import { createInProcessOpenAuthSession } from '../src/client/in-process-open-auth-session';
import { AuthPostgresDatabaseMigration } from '../src/server/auth-database-migration';
import { createAuthApp } from '../src/server/create-auth-app';

const BASE_URL = 'http://sim.local';
const CALLBACK = 'gamezilla://sso-callback';
const SECRET = 'auth-system-secret-0123456789abcdef';

async function bootAuthFetch(): Promise<{
  readonly fetch: typeof appFetch;
}> {
  const sqlClient = SqlClientImplPostgresMem.open({ seed: 1 });
  await new AuthPostgresDatabaseMigration({
    dbScope: createPostgresDbScope('public'),
    skipAdvisoryLock: true,
    alreadyInTransaction: false,
  }).migrate({ sqlClient, logger: createNoopLogger() });

  let nextId = 0;
  const idpApp = createAuthApp({
    getSql: () => sqlClient,
    clock: wallClock,
    createId: () => `id-${(nextId += 1)}`,
    http: { fetch: async () => new Response('{}', { status: 404 }) },
    secret: SECRET,
    baseURL: BASE_URL,
    publicPathPrefix: '/api',
    trustedOrigins: [BASE_URL, 'gamezilla://'],
    providers: { dev: { enabled: true } },
  });
  const app = new Hono();
  app.route('/api', idpApp);

  const appFetch = async (
    input: string | URL | Request,
    init?: RequestInit
  ): Promise<Response> => {
    const request =
      input instanceof Request && init === undefined
        ? input
        : new Request(input, init);
    return app.request(request);
  };

  return { fetch: appFetch };
}

describe('createInProcessOpenAuthSession / sim parity', () => {
  test('completes dev oauth launch chain and exchanges session', async () => {
    const { fetch } = await bootAuthFetch();
    const openAuthSession = createInProcessOpenAuthSession({
      fetch,
      subject: 'alice',
    });
    const port = createAuthClientAdapter({
      baseURL: BASE_URL,
      timers: wallTimers,
      fetch,
      storage: createInMemoryAuthClientStorage(),
      openAuthSession,
      callbackUrl: CALLBACK,
    });

    await port.signIn('oauth-dev');
    const token = await port.getFreshToken();
    expect(token).not.toBeNull();
    expect(token?.length).toBeGreaterThan(0);
  });
});

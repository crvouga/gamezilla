import { describe, expect, test } from 'bun:test';
import { wallClock, wallTimers } from '@pkgs/clock';
import {
  createIdpSigningKeys,
  createIdpSimApp,
  IdpStore,
} from '@pkgs/idp-sim/server';
import { IDP_PASSWORD, idpEndpoints } from '@pkgs/idp-sim/shared';
import { createNoopLogger } from '@pkgs/logger';
import { createPostgresDbScope } from '@pkgs/sql-client/postgres-db-scope';
import { SqlClientImplPostgresMem } from '@pkgs/sql-client-postgres/impl-postgres-mem';
import { SqlClientImplSqliteMem } from '@pkgs/sql-client-sqlite/impl-sqlite-mem';
import { Hono } from 'hono';
import { createInMemoryAuthClientStorage } from '../src/client/bearer-token-store';
import { createInhouseAuthClient } from '../src/client/create-inhouse-auth-client';
import { createInProcessOpenAuthSession } from '../src/client/in-process-open-auth-session';
import { AuthPostgresDatabaseMigration } from '../src/server/auth-database-migration';
import { createAuthApp } from '../src/server/create-auth-app';

/**
 * One RSA key pair per file: minting RS256 keys is the costliest part of an
 * IdP boot, and no test here is about key generation. Every test still boots
 * its own store and app.
 */
const SIGNING_KEYS = createIdpSigningKeys();

const BASE_URL = 'http://sim.local';
const IDP_URL = 'http://idp.sim';
const CALLBACK = 'gamezilla://sso-callback';
const SECRET = 'auth-system-secret-0123456789abcdef';
const CLIENT_ID = 'sim.apps.googleusercontent.com';
const CLIENT_SECRET = 'sim-google-client-secret';
const REDIRECT_URI = `${BASE_URL}/api/auth/callback/google`;

type WireFetch = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>;

/**
 * Two nodes on one machine: the auth app and a simulated Google. The
 * headless session walks between them exactly as a browser would.
 */
async function bootNodes(): Promise<{ readonly wire: WireFetch }> {
  const sqlClient = SqlClientImplPostgresMem.open({ seed: 1 });
  await new AuthPostgresDatabaseMigration({
    dbScope: createPostgresDbScope('public'),
    skipAdvisoryLock: true,
    alreadyInTransaction: false,
  }).migrate({ sqlClient, logger: createNoopLogger() });

  let nextId = 0;
  const idpStore = await IdpStore.open({
    provider: 'google',
    sqlClient: SqlClientImplSqliteMem.open({ seed: 2 }),
    clock: wallClock,
    createId: () => `idp-${(nextId += 1)}`,
    createKeys: () => SIGNING_KEYS,
  });
  const idp = await createIdpSimApp({
    store: idpStore,
    issuer: IDP_URL,
    clients: [
      {
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        redirectUris: [REDIRECT_URI],
        appName: 'Gamezilla',
      },
    ],
    accounts: [{ handle: 'alice' }],
  });

  const wire: WireFetch = async (input, init) => {
    const request =
      input instanceof Request && init === undefined
        ? input
        : new Request(input, init);
    if (request.url.startsWith(IDP_URL)) return idp.app.fetch(request);
    return app.request(request);
  };

  const authApp = createAuthApp({
    getSql: () => sqlClient,
    clock: wallClock,
    createId: () => `id-${(nextId += 1)}`,
    http: { fetch: (input, requestInit) => wire(input, requestInit) },
    secret: SECRET,
    baseURL: BASE_URL,
    publicPathPrefix: '/api',
    trustedOrigins: [BASE_URL, 'gamezilla://'],
    providers: {
      google: {
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        endpoints: idpEndpoints(IDP_URL),
      },
    },
  });
  const app = new Hono();
  app.route('/api', authApp);

  return { wire };
}

describe('createInProcessOpenAuthSession / sim parity', () => {
  test('walks the provider screens and exchanges a session', async () => {
    const { wire } = await bootNodes();
    const openAuthSession = createInProcessOpenAuthSession({
      fetch: wire,
      account: { email: 'alice@gmail.com', password: IDP_PASSWORD },
    });
    const port = createInhouseAuthClient({
      baseURL: BASE_URL,
      clock: wallClock,
      timers: wallTimers,
      fetch: wire,
      storage: createInMemoryAuthClientStorage(),
      openAuthSession,
      callbackUrl: CALLBACK,
    });

    await port.signIn('google');
    const token = await port.getFreshToken();
    expect(token).not.toBeNull();
    expect(token?.length).toBeGreaterThan(0);
  });

  test('a wrong password never reaches a session', async () => {
    const { wire } = await bootNodes();
    const openAuthSession = createInProcessOpenAuthSession({
      fetch: wire,
      account: { email: 'alice@gmail.com', password: 'wrong' },
    });
    const port = createInhouseAuthClient({
      baseURL: BASE_URL,
      clock: wallClock,
      timers: wallTimers,
      fetch: wire,
      storage: createInMemoryAuthClientStorage(),
      openAuthSession,
      callbackUrl: CALLBACK,
    });

    await expect(port.signIn('google')).rejects.toThrow();
    expect(await port.getFreshToken()).toBeNull();
  });

  test('denying consent on the provider returns the app to an error', async () => {
    const { wire } = await bootNodes();
    const openAuthSession = createInProcessOpenAuthSession({
      fetch: wire,
      account: { email: 'alice@gmail.com', password: IDP_PASSWORD },
      consent: 'deny',
    });
    const port = createInhouseAuthClient({
      baseURL: BASE_URL,
      clock: wallClock,
      timers: wallTimers,
      fetch: wire,
      storage: createInMemoryAuthClientStorage(),
      openAuthSession,
      callbackUrl: CALLBACK,
    });

    await expect(port.signIn('google')).rejects.toThrow();
    expect(await port.getFreshToken()).toBeNull();
  });
});

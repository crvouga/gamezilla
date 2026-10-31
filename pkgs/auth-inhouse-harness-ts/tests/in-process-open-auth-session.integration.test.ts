import { describe, expect, test } from 'bun:test';
import { createInhouseAuthClient } from '@pkgs/auth-inhouse-client-ts/create-inhouse-auth-client';
import { createInProcessOpenAuthSession } from '@pkgs/auth-inhouse-client-ts/in-process-open-auth-session';
import { createAuthApp } from '@pkgs/auth-inhouse-server-ts/create-auth-app';
import { googleEndpointsFor } from '@pkgs/auth-inhouse-server-ts/inhouse-auth-config';
import { reconcileIdpPostgres } from '@pkgs/auth-inhouse-server-ts/reconcile-idp-postgres';
import { createBearerTokenStore } from '@pkgs/auth-inhouse-shared-ts/bearer-token-store';
import type { HarnessClockBundle } from '@pkgs/clock-shared-ts/harness-clock';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { SqlClientImplMockingbirdPostgres } from '@pkgs/sql-client-postgres-server-ts/impl-mockingbird-postgres';
import { createPostgresDbScope } from '@pkgs/sql-client-root-shared-ts/postgres-db-scope';
import { Hono } from 'hono';
import { ALICE_EMAIL, simulatedGoogle } from './simulated-google';

const BASE_URL = 'http://harness.local';
const IDP_URL = 'http://idp.harness';
const CALLBACK = 'myapp://sso-callback';
const SECRET = 'auth-system-secret-0123456789abcdef';
const CLIENT_ID = 'harness.apps.googleusercontent.com';
const CLIENT_SECRET = 'harness-google-client-secret';
/** 2026-01-01T00:00:00Z — every node shares one virtual clock. */
const START_MS = 1_767_225_600_000;
const REDIRECT_URI = `${BASE_URL}/api/auth/callback/google`;

type WireFetch = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>;

/**
 * Two nodes on one machine: the auth app and a simulated Google. The
 * headless session walks between them exactly as a browser would.
 */
async function bootNodes(): Promise<{
  readonly wire: WireFetch;
  readonly harness: HarnessClockBundle;
}> {
  const harness = createHarnessClock({ startMs: START_MS });
  const sqlClient = SqlClientImplMockingbirdPostgres.open({ seed: 1 });
  await reconcileIdpPostgres(sqlClient, {
    dbScope: createPostgresDbScope('public'),
    skipAdvisoryLock: true,
    alreadyInTransaction: false,
  });

  let nextId = 0;
  const google = simulatedGoogle({
    origin: IDP_URL,
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    redirectUris: [REDIRECT_URI],
    clock: harness.clock,
  });

  const wire: WireFetch = async (input, init) => {
    const request =
      input instanceof Request && init === undefined
        ? input
        : new Request(input, init);
    if (request.url.startsWith(IDP_URL)) return google(request);
    return app.request(request);
  };

  const authApp = createAuthApp({
    getSql: () => sqlClient,
    clock: harness.clock,
    createId: () => `id-${(nextId += 1)}`,
    http: { fetch: (input, requestInit) => wire(input, requestInit) },
    secret: SECRET,
    baseURL: BASE_URL,
    publicPathPrefix: '/api',
    trustedOrigins: [BASE_URL, 'myapp://'],
    providers: {
      google: {
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        endpoints: googleEndpointsFor(IDP_URL),
      },
    },
  });
  const app = new Hono();
  app.route('/api', authApp);

  return { wire, harness };
}

describe('createInProcessOpenAuthSession / harness parity', () => {
  test('walks the provider screens and exchanges a session', async () => {
    const { wire, harness } = await bootNodes();
    const openAuthSession = createInProcessOpenAuthSession({
      fetch: wire,
      account: { email: ALICE_EMAIL },
    });
    const port = createInhouseAuthClient({
      baseURL: BASE_URL,
      ...harness,
      fetch: wire,
      bearerStore: createBearerTokenStore({ storageKey: 'myapp.auth.bearer' }),
      openAuthSession,
      callbackUrl: CALLBACK,
    });

    await port.signIn('google');
    const token = await port.getFreshToken();
    expect(token).not.toBeNull();
    expect(token?.length).toBeGreaterThan(0);
  });

  test('an account the provider does not hold never reaches a session', async () => {
    const { wire, harness } = await bootNodes();
    const openAuthSession = createInProcessOpenAuthSession({
      fetch: wire,
      account: { email: 'nobody@gmail.com' },
    });
    const port = createInhouseAuthClient({
      baseURL: BASE_URL,
      ...harness,
      fetch: wire,
      bearerStore: createBearerTokenStore({ storageKey: 'myapp.auth.bearer' }),
      openAuthSession,
      callbackUrl: CALLBACK,
    });

    await expect(port.signIn('google')).rejects.toThrow();
    expect(await port.getFreshToken()).toBeNull();
  });

  test('denying consent on the provider returns the app to an error', async () => {
    const { wire, harness } = await bootNodes();
    const openAuthSession = createInProcessOpenAuthSession({
      fetch: wire,
      account: { email: ALICE_EMAIL },
      consent: 'deny',
    });
    const port = createInhouseAuthClient({
      baseURL: BASE_URL,
      ...harness,
      fetch: wire,
      bearerStore: createBearerTokenStore({ storageKey: 'myapp.auth.bearer' }),
      openAuthSession,
      callbackUrl: CALLBACK,
    });

    await expect(port.signIn('google')).rejects.toThrow();
    expect(await port.getFreshToken()).toBeNull();
  });
});

import { describe, expect, test } from 'bun:test';
import { AuthSqliteDatabaseMigration, createAuthApp } from '@pkgs/auth/server';
import {
  AUTH_NATIVE_SSO_CALLBACK_URL,
  oauthClientCallbackUrl,
} from '@pkgs/auth/shared';
import {
  AUTH_SYSTEM_GOOGLE_CLIENT,
  createMockingbirdGoogle,
  type MockingbirdGoogle,
} from '@pkgs/auth-sim';
import { wallClock } from '@pkgs/clock';
import { createNoopLogger } from '@pkgs/logger';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite/impl-mockingbird-sqlite';

const BASE_URL = 'https://api.gamezilla.app';
const PREFIX = '/api';
const SECRET = 'auth-system-secret-0123456789abcdef';
const HTTPS_CALLBACK = oauthClientCallbackUrl('https://www.gamezilla.app');

type AuthFetch = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>;

async function bootGoogleAuth(): Promise<{
  readonly fetch: AuthFetch;
  readonly google: MockingbirdGoogle;
}> {
  const google = createMockingbirdGoogle({
    ...AUTH_SYSTEM_GOOGLE_CLIENT,
    clock: wallClock,
    redirectUri: `${BASE_URL}${PREFIX}/auth/callback/google`,
    subjects: ['alice-google'],
  });
  const sql = SqlClientImplMockingbirdSqlite.open({ seed: 1 });
  await new AuthSqliteDatabaseMigration().migrate({
    sqlClient: sql,
    logger: createNoopLogger(),
  });
  let nextId = 0;
  const createId = () => `id-${(nextId += 1)}`;
  const app = createAuthApp({
    getSql: () => sql,
    clock: wallClock,
    createId,
    http: google.http,
    secret: SECRET,
    baseURL: BASE_URL,
    publicPathPrefix: PREFIX,
    trustedOrigins: [
      BASE_URL,
      'https://www.gamezilla.app',
      AUTH_NATIVE_SSO_CALLBACK_URL,
      'gamezilla://',
    ],
    providers: {
      google: AUTH_SYSTEM_GOOGLE_CLIENT,
    },
  });
  return {
    google,
    fetch: async (input, init) => {
      const href =
        typeof input === 'string'
          ? input.startsWith('http')
            ? input
            : `${BASE_URL}${input.startsWith('/') ? input : `/${input}`}`
          : input instanceof URL
            ? input.href
            : input.url;
      const request =
        input instanceof Request && init === undefined
          ? input
          : new Request(href, init);
      return app.request(request);
    },
  };
}

async function completeGoogleRoundTrip(args: {
  readonly fetch: AuthFetch;
  readonly google: MockingbirdGoogle;
  readonly callbackUrl: string;
}): Promise<string> {
  const launch = await args.fetch(
    `/auth/oauth/launch?provider=google&callbackUrl=${encodeURIComponent(args.callbackUrl)}`,
    { method: 'GET', redirect: 'manual' }
  );
  expect(launch.status).toBe(302);
  const authorize = launch.headers.get('location');
  expect(authorize).toBeTruthy();
  expect(authorize).toContain('accounts.google.com');
  const authorizeUrl = new URL(authorize ?? '');
  expect(authorizeUrl.searchParams.get('redirect_uri')).toBe(
    `${BASE_URL}${PREFIX}/auth/callback/google`
  );
  const idpCallback = await args.google.approve(
    authorizeUrl.href,
    'alice-google'
  );
  expect(idpCallback).toBeTruthy();
  const idpCallbackUrl = new URL(idpCallback ?? '');
  expect(idpCallbackUrl.searchParams.get('state')).toBe(
    authorizeUrl.searchParams.get('state')
  );
  expect(idpCallbackUrl.pathname).toBe(`${PREFIX}/auth/callback/google`);
  const callback = await args.fetch(
    `${idpCallbackUrl.pathname.slice(PREFIX.length)}${idpCallbackUrl.search}`,
    { method: 'GET', redirect: 'manual' }
  );
  expect(callback.status).toBe(302);
  const appLocation = callback.headers.get('location');
  expect(appLocation).toBeTruthy();
  expect(appLocation?.startsWith(args.callbackUrl)).toBe(true);
  const exchangeCode = new URL(appLocation ?? '').searchParams.get('code');
  expect(exchangeCode).toBeTruthy();

  const session = await args.fetch(`/auth/session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code: exchangeCode }),
  });
  expect(session.ok).toBe(true);
  const body = (await session.json()) as { token?: string };
  expect(typeof body.token).toBe('string');
  expect((body.token ?? '').length).toBeGreaterThan(0);
  return body.token ?? '';
}

describe('google oauth https callback (black-box)', () => {
  test('https www callback completes launch → callback → session', async () => {
    const { fetch, google } = await bootGoogleAuth();
    const token = await completeGoogleRoundTrip({
      fetch,
      google,
      callbackUrl: HTTPS_CALLBACK,
    });
    expect(token.length).toBeGreaterThan(0);
  });

  test('native scheme callback still completes', async () => {
    const { fetch, google } = await bootGoogleAuth();
    const token = await completeGoogleRoundTrip({
      fetch,
      google,
      callbackUrl: AUTH_NATIVE_SSO_CALLBACK_URL,
    });
    expect(token.length).toBeGreaterThan(0);
  });
});

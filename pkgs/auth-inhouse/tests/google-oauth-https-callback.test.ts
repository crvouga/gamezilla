import { describe, expect, test } from 'bun:test';
import {
  AuthSqliteDatabaseMigration,
  createAuthApp,
  googleEndpointsFor,
} from '@pkgs/auth-inhouse/server';
import {
  AUTH_NATIVE_SSO_CALLBACK_URL,
  oauthClientCallbackUrl,
} from '@pkgs/auth-inhouse/shared';
import { createHarnessClock } from '@pkgs/clock';
import { createNoopLogger } from '@pkgs/logger';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite/impl-mockingbird-sqlite';
import { createInProcessOpenAuthSession } from '../src/client/in-process-open-auth-session';
import { ALICE_EMAIL, simulatedGoogle } from './support/simulated-google';

const BASE_URL = 'https://api.gamezilla.app';
const IDP_URL = 'https://accounts.idp.test';
const PREFIX = '/api';
const SECRET = 'auth-system-secret-0123456789abcdef';
const HTTPS_CALLBACK = oauthClientCallbackUrl('https://www.gamezilla.app');
const CLIENT_ID = 'cid.apps.googleusercontent.com';
const CLIENT_SECRET = 'csecret';
/** 2026-01-01T00:00:00Z — IdP and relying party share one virtual clock. */
const START_MS = 1_767_225_600_000;
const ACCOUNT = { email: ALICE_EMAIL };

type Wire = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>;

async function bootGoogleAuth(): Promise<{ readonly wire: Wire }> {
  const sql = SqlClientImplMockingbirdSqlite.open({ seed: 1 });
  await new AuthSqliteDatabaseMigration().migrate({
    sqlClient: sql,
    logger: createNoopLogger(),
  });
  let nextId = 0;
  const { clock } = createHarnessClock({ startMs: START_MS });
  const google = simulatedGoogle({
    origin: IDP_URL,
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    redirectUris: [`${BASE_URL}${PREFIX}/auth/callback/google`],
    clock,
  });
  const wire: Wire = async (input, init) => {
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
    if (href.startsWith(IDP_URL)) return google(request);
    return app.request(request);
  };
  const authApp = createAuthApp({
    getSql: () => sql,
    clock,
    createId: () => `id-${(nextId += 1)}`,
    http: { fetch: (input, init) => wire(input, init) },
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
      google: {
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        endpoints: googleEndpointsFor(IDP_URL),
      },
    },
  });
  const { Hono } = await import('hono');
  const app = new Hono();
  app.route(PREFIX, authApp);
  return { wire };
}

async function completeGoogleRoundTrip(args: {
  readonly wire: Wire;
  readonly callbackUrl: string;
}): Promise<string> {
  const launchUrl = `${BASE_URL}${PREFIX}/auth/oauth/launch?provider=google&callbackUrl=${encodeURIComponent(args.callbackUrl)}`;
  const launch = await args.wire(launchUrl, {
    method: 'GET',
    redirect: 'manual',
  });
  expect(launch.status).toBe(302);
  const authorize = new URL(launch.headers.get('location') ?? '');
  expect(authorize.origin).toBe(IDP_URL);
  expect(authorize.searchParams.get('redirect_uri')).toBe(
    `${BASE_URL}${PREFIX}/auth/callback/google`
  );
  expect(authorize.searchParams.get('code_challenge_method')).toBe('S256');

  const openAuthSession = createInProcessOpenAuthSession({
    fetch: args.wire,
    account: ACCOUNT,
  });
  const result = await openAuthSession(launchUrl, args.callbackUrl);
  expect(result.type).toBe('success');
  const appLocation = result.type === 'success' ? (result.url ?? '') : '';
  expect(appLocation.startsWith(args.callbackUrl)).toBe(true);
  const exchangeCode = new URL(appLocation).searchParams.get('code');
  expect(exchangeCode).toBeTruthy();

  const session = await args.wire(`${BASE_URL}${PREFIX}/auth/session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code: exchangeCode }),
  });
  expect(session.ok).toBe(true);
  const body = (await session.json()) as { token?: string };
  return body.token ?? '';
}

describe('google oauth https callback (black-box)', () => {
  test('https www callback completes launch → callback → session', async () => {
    const { wire } = await bootGoogleAuth();
    const token = await completeGoogleRoundTrip({
      wire,
      callbackUrl: HTTPS_CALLBACK,
    });
    expect(token.length).toBeGreaterThan(0);
  });

  test('native scheme callback still completes', async () => {
    const { wire } = await bootGoogleAuth();
    const token = await completeGoogleRoundTrip({
      wire,
      callbackUrl: AUTH_NATIVE_SSO_CALLBACK_URL,
    });
    expect(token.length).toBeGreaterThan(0);
  });
});

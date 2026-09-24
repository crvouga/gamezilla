import { describe, expect, test } from 'bun:test';
import { AuthSqliteDatabaseMigration, createAuthApp } from '@pkgs/auth/server';
import {
  AUTH_NATIVE_SSO_CALLBACK_URL,
  GOOGLE_OAUTH_TOKEN_URL,
  GOOGLE_OAUTH_USERINFO_URL,
  oauthClientCallbackUrl,
} from '@pkgs/auth/shared';
import { wallClock } from '@pkgs/clock';
import type { HttpClient } from '@pkgs/http-client';
import { createNoopLogger } from '@pkgs/logger';
import { SqlClientImplSqliteMem } from '@pkgs/sql-client-sqlite/impl-sqlite-mem';

const BASE_URL = 'https://api.gamezilla.app';
const PREFIX = '/api';
const SECRET = 'auth-system-secret-0123456789abcdef';
const HTTPS_CALLBACK = oauthClientCallbackUrl('https://www.gamezilla.app');

function fakeGoogleHttp(subjects: Map<string, string>): HttpClient {
  return {
    async fetch(input, init) {
      const url = String(input);
      if (url === GOOGLE_OAUTH_TOKEN_URL) {
        const params = new URLSearchParams(
          typeof init?.body === 'string' ? init.body : ''
        );
        const code = params.get('code') ?? '';
        return new Response(
          JSON.stringify({
            access_token: `access-${code}`,
            refresh_token: `refresh-${code}`,
            token_type: 'Bearer',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }
      if (url === GOOGLE_OAUTH_USERINFO_URL) {
        const auth =
          init?.headers instanceof Headers
            ? (init.headers.get('authorization') ?? '')
            : typeof init?.headers === 'object' && init.headers !== null
              ? ((init.headers as Record<string, string>)['authorization'] ??
                '')
              : '';
        const code = auth.replace(/^Bearer\s+access-/i, '');
        const sub = subjects.get(code) ?? `sub-${code}`;
        return new Response(
          JSON.stringify({
            sub,
            email: `${sub}@gmail.test`,
            name: sub,
            picture: null,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }
      return new Response('not found', { status: 404 });
    },
  };
}

async function bootGoogleAuth(subjects: Map<string, string>): Promise<{
  readonly fetch: (
    input: string | URL | Request,
    init?: RequestInit
  ) => Promise<Response>;
  readonly createId: () => string;
}> {
  const sql = SqlClientImplSqliteMem.open({ seed: 1 });
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
    http: fakeGoogleHttp(subjects),
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
      google: { clientId: 'cid', clientSecret: 'csecret' },
    },
  });
  return {
    createId,
    fetch: (input, init) => {
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
  readonly fetch: (
    input: string | URL | Request,
    init?: RequestInit
  ) => Promise<Response>;
  readonly createId: () => string;
  readonly callbackUrl: string;
  readonly subjects: Map<string, string>;
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
  const state = authorizeUrl.searchParams.get('state');
  expect(state).toBeTruthy();

  const googleCode = args.createId();
  args.subjects.set(googleCode, 'alice-google');
  const callback = await args.fetch(
    `/auth/callback/google?code=${encodeURIComponent(googleCode)}&state=${encodeURIComponent(state ?? '')}`,
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
    const subjects = new Map<string, string>();
    const { fetch, createId } = await bootGoogleAuth(subjects);
    const token = await completeGoogleRoundTrip({
      fetch,
      createId,
      callbackUrl: HTTPS_CALLBACK,
      subjects,
    });
    expect(token.length).toBeGreaterThan(0);
  });

  test('native scheme callback still completes', async () => {
    const subjects = new Map<string, string>();
    const { fetch, createId } = await bootGoogleAuth(subjects);
    const token = await completeGoogleRoundTrip({
      fetch,
      createId,
      callbackUrl: AUTH_NATIVE_SSO_CALLBACK_URL,
      subjects,
    });
    expect(token.length).toBeGreaterThan(0);
  });
});

import { describe, expect, test } from 'bun:test';
import { createRuntime } from '@crvouga/mockingbird-service-oauth';
import { createInProcessOpenAuthSession } from '@pkgs/auth-inhouse-client-ts/in-process-open-auth-session';
import { createAuthApp } from '@pkgs/auth-inhouse-server-ts/create-auth-app';
import { appleEndpointsFor } from '@pkgs/auth-inhouse-server-ts/inhouse-auth-config';
import { reconcileIdpSqlite } from '@pkgs/auth-inhouse-server-ts/reconcile-idp-sqlite';
import { oauthClientCallbackUrl } from '@pkgs/auth-inhouse-shared-ts/oauth-client-callback-url';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite-root-shared-ts/impl-mockingbird-sqlite';
import { Hono } from 'hono';

const SCHEME = 'myapp';
const BASE_URL = 'https://api.app.example';
const IDP_URL = 'https://apple.idp.test';
const PREFIX = '/api';
const SECRET = 'auth-system-secret-0123456789abcdef';
const CALLBACK = oauthClientCallbackUrl('https://www.app.example', SCHEME);
const CALLBACK_PATH = `${BASE_URL}${PREFIX}/auth/callback/apple`;
const CLIENT_ID = 'test.apple-repeat.signin';
const TEAM_ID = 'TEAMREPEAT';
const KEY_ID = 'KEYREPEAT1';
const ALICE_EMAIL = 'alice@icloud.com';
/** 2026-01-01T00:00:00Z — IdP and relying party share one virtual clock. */
const START_MS = 1_767_225_600_000;

type Wire = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>;

type AppleKeys = {
  readonly privateJwk: JsonWebKey;
  readonly publicJwk: JsonWebKey;
};

async function appleKeys(): Promise<AppleKeys> {
  const pair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify']
  );
  const {
    key_ops: _ops,
    ext: _ext,
    ...privateJwk
  } = await crypto.subtle.exportKey('jwk', pair.privateKey);
  const { d: _d, ...publicJwk } = privateJwk;
  return { privateJwk, publicJwk };
}

function providerClock(now: () => number) {
  return {
    now,
    set: () => undefined,
    advance: () => undefined,
    freeze: () => undefined,
    unfreeze: () => undefined,
    reset: () => undefined,
    state: () => ({ now: now(), frozen: false, offsetMs: 0 }),
  };
}

async function bootAppleAuth(): Promise<{
  readonly wire: Wire;
  readonly posted: { body: string; handoffPolicy?: string };
}> {
  const sql = SqlClientImplMockingbirdSqlite.open({ seed: 1 });
  await reconcileIdpSqlite(sql);
  let nextId = 0;
  const { clock } = createHarnessClock({ startMs: START_MS });
  const keys = await appleKeys();
  const apple = createRuntime({
    provider: 'apple',
    issuer: IDP_URL,
    clock: providerClock(() => clock.now()),
    accounts: [
      {
        id: 'alice',
        email: ALICE_EMAIL,
        name: 'Alice Tester',
        givenName: 'Alice',
        familyName: 'Tester',
      },
    ],
    clients: [
      {
        id: CLIENT_ID,
        name: 'Example App',
        redirectUris: [CALLBACK_PATH],
        apple: { teamId: TEAM_ID, keyId: KEY_ID, publicKey: keys.publicJwk },
      },
    ],
  });
  const posted: { body: string; handoffPolicy?: string } = { body: '' };
  const authApp = createAuthApp({
    getSql: () => sql,
    clock,
    createId: () => `id-${(nextId += 1)}`,
    http: { fetch: (input, init) => wire(input, init) },
    secret: SECRET,
    baseURL: BASE_URL,
    publicPathPrefix: PREFIX,
    trustedOrigins: [BASE_URL, 'https://www.app.example', 'myapp://'],
    providers: {
      apple: {
        clientId: CLIENT_ID,
        teamId: TEAM_ID,
        keyId: KEY_ID,
        privateJwk: keys.privateJwk,
        endpoints: appleEndpointsFor(IDP_URL),
        issuer: IDP_URL,
      },
    },
  });
  const app = new Hono().route(PREFIX, authApp);
  const wire: Wire = async (input, init) => {
    const href = hrefOf(input);
    const request = new Request(href, init);
    if (href.startsWith(CALLBACK_PATH) && request.method === 'POST') {
      posted.body = await request.clone().text();
    }
    if (href.startsWith(IDP_URL)) {
      const response = await apple.fetch(request);
      if ((await response.clone().text()).includes('oauth-mock-form-post')) {
        posted.handoffPolicy =
          response.headers.get('content-security-policy') ?? '';
      }
      return response;
    }
    return await app.request(request);
  };
  return { wire, posted };
}

function hrefOf(input: string | URL | Request): string {
  if (typeof input === 'string') {
    return input.startsWith('http')
      ? input
      : `${BASE_URL}${input.startsWith('/') ? input : `/${input}`}`;
  }
  return input instanceof URL ? input.href : input.url;
}

function codeOf(location: string | null): string {
  return new URL(location ?? '').searchParams.get('code') ?? '';
}

async function sessionStatus(wire: Wire, code: string): Promise<number> {
  const session = await wire(`${BASE_URL}${PREFIX}/auth/session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  return session.status;
}

describe('apple form_post callback', () => {
  // regression: local-apple-form-post-csp
  test('the handoff permits the API to redirect to its separate web client', async () => {
    const { wire, posted } = await bootAppleAuth();
    const open = createInProcessOpenAuthSession({
      fetch: wire,
      account: { email: ALICE_EMAIL },
    });
    const result = await open(
      `${BASE_URL}${PREFIX}/auth/oauth/launch?provider=apple&callbackUrl=${encodeURIComponent(CALLBACK)}`,
      CALLBACK
    );
    expect(result.type).toBe('success');
    expect(posted.handoffPolicy).toBeDefined();
    // The provider cannot know the origin the API redirects to. A form-action
    // allow-list on this page also restricts that hop in WebKit (upstream #348).
    expect(posted.handoffPolicy).not.toMatch(/(?:^|;)\s*form-action\b/);
    const code = codeOf(
      result.type === 'success' ? (result.url ?? null) : null
    );
    expect(await sessionStatus(wire, code)).toBe(200);
  });

  // regression: apple-callback-repeat-invalid-state
  test('a second form post still redirects with a code that signs in', async () => {
    const { wire, posted } = await bootAppleAuth();
    const launch = `${BASE_URL}${PREFIX}/auth/oauth/launch?provider=apple&callbackUrl=${encodeURIComponent(CALLBACK)}`;
    const openAuthSession = createInProcessOpenAuthSession({
      fetch: (input, init) => wire(input, init),
      account: { email: ALICE_EMAIL },
    });
    const first = await openAuthSession(launch, CALLBACK);
    expect(first.type).toBe('success');
    const firstCode = codeOf(
      first.type === 'success' ? (first.url ?? null) : null
    );
    expect(posted.body.length).toBeGreaterThan(0);

    const second = await wire(CALLBACK_PATH, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: posted.body,
      redirect: 'manual',
    });
    expect(second.status).toBe(200);
    expect(second.headers.get('location')).toBeNull();
    expect(second.headers.get('content-type')).toContain('text/html');
    const refresh = second.headers.get('refresh') ?? '';
    expect(refresh.startsWith(`0;url=${CALLBACK}?code=`)).toBe(true);
    const secondCode = codeOf(refresh.slice('0;url='.length));
    expect(secondCode.length).toBeGreaterThan(0);
    expect(secondCode).not.toBe(firstCode);
    expect(await sessionStatus(wire, firstCode)).not.toBe(200);
    expect(await sessionStatus(wire, secondCode)).toBe(200);
  });
});

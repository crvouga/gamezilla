import { expect, test } from 'bun:test';
import { createAuthApp } from '@pkgs/auth-inhouse-server/create-auth-app';
import { IdpRepository } from '@pkgs/auth-inhouse-server/idp-repository';
import { oauthCallbackResponse } from '@pkgs/auth-inhouse-server/oauth-callback-response';
import { reconcileIdpSqlite } from '@pkgs/auth-inhouse-server/reconcile-idp-sqlite';
import { GOOGLE_PRODUCTION_ENDPOINTS } from '@pkgs/auth-inhouse-shared/auth-constants';
import { createHarnessClock } from '@pkgs/clock-shared/harness-clock';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite-root-shared/impl-mockingbird-sqlite';
import { createHarnessIds } from '@pkgs/uuid-shared/seeded-create-id';

// regression: oauth-form-action-blocks-client-callback
test('the cross-origin OAuth return loads a document before navigating to the local app', async () => {
  const db = SqlClientImplMockingbirdSqlite.open({ seed: 41 });
  await reconcileIdpSqlite(db);
  const { clock } = createHarnessClock();
  const { createId } = createHarnessIds(41);
  const secret = 'handoff-test-secret-0123456789abcdef';
  const callbackUrl = 'http://127.0.0.1:5428/sso-callback';
  const state = await new IdpRepository(
    db,
    clock,
    createId,
    secret
  ).createOauthState({
    provider: 'google',
    callbackUrl,
    intent: 'sign_in',
    linkUserId: null,
    pendingLinkId: null,
    stateTag: null,
  });
  const app = createAuthApp({
    getSql: () => db,
    clock,
    createId,
    secret,
    baseURL: 'http://127.0.0.1:53434',
    trustedOrigins: ['http://127.0.0.1:5428'],
    providers: {
      google: {
        clientId: 'handoff-client',
        clientSecret: 'handoff-secret',
        endpoints: GOOGLE_PRODUCTION_ENDPOINTS,
      },
    },
    http: {
      fetch: () =>
        Promise.reject(new Error('A refusal needs no provider exchange')),
    },
  });
  try {
    const response = await app.request(
      'http://127.0.0.1:53434/auth/callback/google',
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          state: state.state,
          error: 'access_denied',
        }),
      }
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('refresh')).toBe(
      `0;url=${callbackUrl}?error=cancelled`
    );
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('content-security-policy')).toContain(
      "form-action 'none'"
    );
    expect(await response.text()).toContain('Return to the app');
  } finally {
    await db.disconnect();
  }
});

// regression: oauth-form-action-blocks-client-callback
test('a successful cross-origin code handoff is isolated and its fallback link is escaped', async () => {
  const target = new URL(
    'http://127.0.0.1:5428/sso-callback?code=accepted-code&next=%22%3E%3Cscript%3E'
  );
  const response = oauthCallbackResponse(
    target,
    'http://127.0.0.1:53434/api/auth/callback/google'
  );
  expect(response.status).toBe(200);
  expect(response.headers.get('refresh')).toBe(`0;url=${target.href}`);
  expect(response.headers.get('location')).toBeNull();
  const html = await response.text();
  expect(html).not.toContain('<script>');
  expect(html).toContain('&amp;next=');
});

test('same-origin and native callbacks retain their direct handoff', () => {
  for (const href of [
    'http://127.0.0.1:53434/sso-callback?code=accepted-code',
    'app:///sso-callback?code=accepted-code',
  ]) {
    const response = oauthCallbackResponse(
      new URL(href),
      'http://127.0.0.1:53434/api/auth/callback/google'
    );
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(href);
    expect(response.headers.get('cache-control')).toBe('no-store');
  }
});

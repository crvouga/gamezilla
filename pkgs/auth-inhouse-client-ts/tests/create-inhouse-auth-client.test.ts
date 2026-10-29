import { describe, expect, test } from 'bun:test';
import {
  AUTH_SSO_CANCELLED_ERROR,
  AUTH_SSO_POPUP_BLOCKED_ERROR,
} from '@pkgs/auth-inhouse-client-ts/auth-client-http';
import type { OpenAuthSession } from '@pkgs/auth-inhouse-client-ts/auth-client-oauth';
import {
  clearBearerOnUnauthorizedSession,
  createInhouseAuthClient,
} from '@pkgs/auth-inhouse-client-ts/create-inhouse-auth-client';
import {
  createBearerTokenStore,
  createInMemoryAuthClientStorage,
} from '@pkgs/auth-inhouse-shared-ts/bearer-token-store';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';

const BASE_URL = 'http://auth.test';
const CALLBACK = 'myapp://sso-callback';

function gestureStrictOpenAuthSession(
  inner: OpenAuthSession,
  openedBeforeAwait: { value: boolean }
): OpenAuthSession {
  return async (authorizationUrl, callbackUrl) => {
    if (openedBeforeAwait.value) {
      throw new Error(AUTH_SSO_POPUP_BLOCKED_ERROR);
    }
    openedBeforeAwait.value = true;
    return inner(authorizationUrl, callbackUrl);
  };
}

describe('createInhouseAuthClient / oauth', () => {
  test('opens auth session before bearer clear (launch-first)', async () => {
    let openCalledBeforeFetch = false;
    let fetchCalled = false;
    const port = createInhouseAuthClient({
      baseURL: BASE_URL,
      ...createHarnessClock(),
      fetch: async () => {
        fetchCalled = true;
        return new Response(JSON.stringify({ token: 'session-token' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      },
      bearerStore: createBearerTokenStore({ storageKey: 'myapp.auth.bearer' }),
      callbackUrl: CALLBACK,
      openAuthSession: async (authorizationUrl) => {
        openCalledBeforeFetch = !fetchCalled;
        expect(authorizationUrl).toContain('/auth/oauth/launch');
        return {
          type: 'success',
          url: `${CALLBACK}?code=exchange-code`,
        };
      },
    });

    await port.signIn('google');
    expect(openCalledBeforeFetch).toBe(true);
    expect(fetchCalled).toBe(true);
  });

  test('await-before-open is blocked by gesture-strict session', async () => {
    const openedBeforeAwait = { value: true };
    const session = gestureStrictOpenAuthSession(
      async () => ({ type: 'success', url: `${CALLBACK}?code=x` }),
      openedBeforeAwait
    );
    await expect(session('http://launch', CALLBACK)).rejects.toThrow(
      AUTH_SSO_POPUP_BLOCKED_ERROR
    );
  });

  test('cancel maps to AUTH_SSO_CANCELLED_ERROR', async () => {
    const port = createInhouseAuthClient({
      baseURL: BASE_URL,
      ...createHarnessClock(),
      fetch: async () =>
        new Response(JSON.stringify({ token: 't' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      bearerStore: createBearerTokenStore({ storageKey: 'myapp.auth.bearer' }),
      callbackUrl: CALLBACK,
      openAuthSession: async () => ({ type: 'cancel' }),
    });

    await expect(port.signIn('google')).rejects.toThrow(
      AUTH_SSO_CANCELLED_ERROR
    );
  });

  test('blocked popup maps to AUTH_SSO_POPUP_BLOCKED_ERROR', async () => {
    const port = createInhouseAuthClient({
      baseURL: BASE_URL,
      ...createHarnessClock(),
      fetch: async () => new Response('{}', { status: 404 }),
      bearerStore: createBearerTokenStore({ storageKey: 'myapp.auth.bearer' }),
      callbackUrl: CALLBACK,
      openAuthSession: async () => {
        throw new Error(AUTH_SSO_POPUP_BLOCKED_ERROR);
      },
    });

    await expect(port.signIn('google')).rejects.toThrow(
      AUTH_SSO_POPUP_BLOCKED_ERROR
    );
  });

  test('missing code in callback maps to cancelled', async () => {
    const port = createInhouseAuthClient({
      baseURL: BASE_URL,
      ...createHarnessClock(),
      fetch: async () =>
        new Response(JSON.stringify({ token: 't' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      bearerStore: createBearerTokenStore({ storageKey: 'myapp.auth.bearer' }),
      callbackUrl: CALLBACK,
      openAuthSession: async () => ({
        type: 'success',
        url: `${CALLBACK}?state=missing-code`,
      }),
    });

    await expect(port.signIn('google')).rejects.toThrow(
      AUTH_SSO_CANCELLED_ERROR
    );
  });
});

describe('clearBearerOnUnauthorizedSession', () => {
  test('401/403 clear dead IdP bearer so sync can fall back to anon', async () => {
    const storage = createInMemoryAuthClientStorage();
    const bearerStore = createBearerTokenStore({
      storage,
      storageKey: 'myapp.auth.bearer',
    });
    await bearerStore.write('dead-idp-token');

    await clearBearerOnUnauthorizedSession(bearerStore, 401);
    expect(await bearerStore.read()).toBeNull();

    await bearerStore.write('still-dead');
    await clearBearerOnUnauthorizedSession(bearerStore, 403);
    expect(await bearerStore.read()).toBeNull();
  });

  test('non-auth session failures keep the bearer (offline / 5xx)', async () => {
    const storage = createInMemoryAuthClientStorage();
    const bearerStore = createBearerTokenStore({
      storage,
      storageKey: 'myapp.auth.bearer',
    });
    await bearerStore.write('maybe-live');

    await clearBearerOnUnauthorizedSession(bearerStore, 503);
    expect(await bearerStore.read()).toBe('maybe-live');
  });
});

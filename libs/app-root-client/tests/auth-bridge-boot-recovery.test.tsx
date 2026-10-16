import { expect, test } from 'bun:test';
import {
  AuthBridge,
  SESSION_REVALIDATE_MS,
} from '@libs/auth-client/auth-bridge';
import { AuthClientProvider } from '@libs/auth-client/auth-client-provider';
import { ConfigServiceProvider } from '@libs/auth-client/config-service-context';
import {
  DEVICE_ID_KEY,
  LAST_LOCAL_ACCOUNT_ID_KEY,
  SESSION_TOKEN_KEY,
} from '@libs/auth-shared/auth-storage-keys';
import type { AuthClientPort } from '@pkgs/auth-root-shared/auth-client-port';
import {
  AUTH_SESSION_INITIAL,
  type AuthSessionState,
} from '@pkgs/auth-root-shared/auth-session-state';
import { ClockProvider } from '@pkgs/clock-client/solid';
import { createHarnessClock } from '@pkgs/clock-shared/harness-clock';
import { HttpClientProvider } from '@pkgs/http-client-client/solid';
import { HttpNetworkError } from '@pkgs/http-client-shared/http-network-error';
import type { HttpFetch } from '@pkgs/http-client-shared/types';
import { LoggerProvider } from '@pkgs/logger-client/solid';
import { createNoopLogger } from '@pkgs/logger-shared/logger';
import { SecureStorageStoreProvider } from '@pkgs/secure-storage-root-client/solid';
import { createInMemorySecureStorage } from '@pkgs/secure-storage-root-shared/impl-memory';
import { createSecureStorageStore } from '@pkgs/secure-storage-root-shared/secure-storage-store';
import { IdProvider } from '@pkgs/uuid-client/solid';
import { render } from '@solidjs/testing-library';

function recoveringPort() {
  let state: AuthSessionState = AUTH_SESSION_INITIAL;
  const listeners = new Set<() => void>();
  return {
    getFreshToken: () => Promise.resolve('saved-session'),
    session: {
      getSnapshot: () => state,
      subscribe: (listener: () => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      refresh: async () => {
        state = {
          isHydrated: true,
          error: null,
          session: {
            externalUserId: 'external-user',
            accountId: null,
            email: null,
            expiresAt: null,
            authenticatedAt: null,
          },
        };
        for (const listener of listeners) listener();
      },
    },
  } as unknown as AuthClientPort;
}

async function recovery() {
  const time = createHarnessClock();
  const store = createSecureStorageStore(createInMemorySecureStorage());
  await store.write(SESSION_TOKEN_KEY, 'saved-session');
  await store.write(DEVICE_ID_KEY, '11111111-1111-4111-8111-111111111111');
  let online = false;
  let attempts = 0;
  const fetch: HttpFetch = async () => {
    attempts += 1;
    if (!online)
      throw new HttpNetworkError('The connection is currently unavailable.');
    return new Response(JSON.stringify({ accountId: 'restored-account' }), {
      headers: { 'content-type': 'application/json' },
    });
  };
  const view = render(() => (
    <ClockProvider clock={time.clock} timers={time.timers}>
      <IdProvider
        createId={() => '22222222-2222-4222-8222-222222222222'}
        random={() => 0.5}
      >
        <LoggerProvider value={createNoopLogger()}>
          <HttpClientProvider value={{ fetch }}>
            <SecureStorageStoreProvider value={store}>
              <ConfigServiceProvider
                value={{ getApiUrl: () => 'http://localhost' }}
              >
                <AuthClientProvider port={recoveringPort()}>
                  <AuthBridge>
                    <div />
                  </AuthBridge>
                </AuthClientProvider>
              </ConfigServiceProvider>
            </SecureStorageStoreProvider>
          </HttpClientProvider>
        </LoggerProvider>
      </IdProvider>
    </ClockProvider>
  ));
  return {
    ...view,
    time,
    store,
    attempts: () => attempts,
    reconnect: () => {
      online = true;
    },
  };
}

// regression: new-tab-loses-local-account
test('a saved session with no account recovers after its first refresh fails', async () => {
  const boot = await recovery();
  for (let turn = 0; turn < 100 && boot.attempts() === 0; turn += 1) {
    await Promise.resolve();
  }
  expect(boot.attempts()).toBe(1);
  expect(boot.store.getValue(LAST_LOCAL_ACCOUNT_ID_KEY)).toBeNull();
  boot.reconnect();
  boot.time.clock.advance(SESSION_REVALIDATE_MS);
  for (
    let turn = 0;
    turn < 100 && boot.store.getValue(LAST_LOCAL_ACCOUNT_ID_KEY) === null;
    turn += 1
  ) {
    await Promise.resolve();
  }
  expect(boot.store.getValue(LAST_LOCAL_ACCOUNT_ID_KEY)).toBe(
    'restored-account'
  );
  expect(boot.store.getValue(SESSION_TOKEN_KEY)).toBe('saved-session');
  boot.unmount();
});

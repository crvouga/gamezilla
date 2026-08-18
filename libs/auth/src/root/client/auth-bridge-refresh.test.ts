import { beforeAll, describe, expect, mock, test } from 'bun:test';
import type { Timers } from '@pkgs/clock';
import type { SecureStorage } from '@pkgs/secure-storage/interface';
import { createSecureStorageStore } from '@pkgs/secure-storage/secure-storage-store';

import { LAST_LOCAL_ACCOUNT_ID_KEY } from './auth-storage-keys';

mock.module('./collect-device-snapshot', () => ({
  collectDeviceSnapshot: () => ({}),
}));

class InMemorySecureStorage implements SecureStorage {
  private readonly map = new Map<string, string>();
  async getItem(key: string): Promise<string | null> {
    return this.map.get(key) ?? null;
  }
  async setItem(key: string, value: string): Promise<void> {
    this.map.set(key, value);
  }
  async deleteItem(key: string): Promise<void> {
    this.map.delete(key);
  }
}

const syncTimers: Timers = {
  setTimeout: (fn) => {
    fn();
    return 0;
  },
  clearTimeout: () => undefined,
  setInterval: () => 0,
  clearInterval: () => undefined,
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('AuthBridgeRefresh unauthorized recovery', () => {
  let AuthBridgeRefresh: typeof import('./auth-bridge-refresh').AuthBridgeRefresh;
  let SessionCapabilityStore: typeof import('./session-capability').SessionCapabilityStore;

  beforeAll(async () => {
    ({ AuthBridgeRefresh } = await import('./auth-bridge-refresh'));
    ({ SessionCapabilityStore } = await import('./session-capability'));
  });

  test('401 refresh clears dead token and binds anon account id', async () => {
    const calls: string[] = [];
    const store = createSecureStorageStore(new InMemorySecureStorage());
    const deps = {
      apiUrl: 'http://localhost',
      deviceId: 'device-1',
      fetchFn: async (input: RequestInfo | URL) => {
        const url = String(input);
        calls.push(url);
        if (url.includes('/identity/refresh')) {
          return jsonResponse(401, { error: 'Invalid or expired session' });
        }
        if (url.includes('/identity/anon/ensure')) {
          return jsonResponse(200, {
            userId: '11111111-1111-4111-8111-111111111111',
            accountId: '11111111-1111-4111-8111-111111111111',
            isAnon: true,
          });
        }
        throw new Error(`unexpected fetch: ${url}`);
      },
      store,
      log: {
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined,
      },
      timers: syncTimers,
      lastSyncedTokenRef: { current: null as string | null },
      inFlightRef: { current: false },
      pendingTokenRef: { current: null as string | null },
    };

    await new SessionCapabilityStore(store).write({
      token: 'dead-token',
      expiresAt: null,
      externalUserId: null,
    });

    await new AuthBridgeRefresh(deps).runRefresh({
      token: 'dead-token',
      expiresAt: null,
      externalUserId: null,
      force: true,
    });

    expect(calls.some((u) => u.includes('/identity/refresh'))).toBe(true);
    expect(calls.some((u) => u.includes('/identity/anon/ensure'))).toBe(true);
    expect(new SessionCapabilityStore(store).readToken()).toBeNull();
    expect(store.getValue(LAST_LOCAL_ACCOUNT_ID_KEY)).toBe(
      '11111111-1111-4111-8111-111111111111'
    );
  });

  test('non-auth refresh failure keeps local token and skips anon ensure', async () => {
    const calls: string[] = [];
    const store = createSecureStorageStore(new InMemorySecureStorage());
    const deps = {
      apiUrl: 'http://localhost',
      deviceId: 'device-1',
      fetchFn: async (input: RequestInfo | URL) => {
        const url = String(input);
        calls.push(url);
        if (url.includes('/identity/refresh')) {
          return jsonResponse(503, { error: 'unavailable' });
        }
        throw new Error(`unexpected fetch: ${url}`);
      },
      store,
      log: {
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined,
      },
      timers: syncTimers,
      lastSyncedTokenRef: { current: null as string | null },
      inFlightRef: { current: false },
      pendingTokenRef: { current: null as string | null },
    };

    await new AuthBridgeRefresh(deps).runRefresh({
      token: 'maybe-live',
      expiresAt: null,
      externalUserId: null,
      force: true,
    });

    expect(calls.every((u) => u.includes('/identity/refresh'))).toBe(true);
    expect(new SessionCapabilityStore(store).readToken()).toBe('maybe-live');
    expect(store.getValue(LAST_LOCAL_ACCOUNT_ID_KEY)).toBeNull();
  });
});

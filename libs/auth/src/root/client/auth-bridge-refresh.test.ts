import { beforeAll, describe, expect, mock, test } from 'bun:test';
import type { Timers } from '@pkgs/clock';
import type { HttpFetch } from '@pkgs/http-client';
import type { SecureStorage } from '@pkgs/secure-storage/interface';
import { createSecureStorageStore } from '@pkgs/secure-storage/secure-storage-store';
import type { CreateId } from '@pkgs/uuid';

import { LAST_LOCAL_ACCOUNT_ID_KEY } from '../../public/auth-storage-keys';
import type { AuthBridgeRefreshDeps } from './auth-bridge-refresh';

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

const LOCAL_ID = '22222222-2222-4222-8222-222222222222';
const SERVER_ID = '11111111-1111-4111-8111-111111111111';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeDeps(
  store: ReturnType<typeof createSecureStorageStore>,
  fetchFn: HttpFetch,
  createId: CreateId = () => LOCAL_ID
): AuthBridgeRefreshDeps {
  return {
    apiUrl: 'http://localhost',
    deviceId: 'device-1',
    fetchFn,
    store,
    log: {
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
    },
    timers: syncTimers,
    createId,
    lastSyncedTokenRef: { current: null },
    inFlightRef: { current: false },
    pendingTokenRef: { current: null },
  };
}

describe('AuthBridgeRefresh unauthorized recovery', () => {
  let AuthBridgeRefresh: typeof import('./auth-bridge-refresh').AuthBridgeRefresh;
  let SessionCapabilityStore: typeof import('../../public/session-capability').SessionCapabilityStore;

  beforeAll(async () => {
    ({ AuthBridgeRefresh } = await import('./auth-bridge-refresh'));
    ({ SessionCapabilityStore } = await import(
      '../../public/session-capability'
    ));
  });

  test('401 refresh clears dead token and binds anon account id', async () => {
    const calls: string[] = [];
    const store = createSecureStorageStore(new InMemorySecureStorage());
    const deps = makeDeps(store, async (input) => {
      const url = String(input);
      calls.push(url);
      if (url.includes('/identity/refresh')) {
        return jsonResponse(401, { error: 'Invalid or expired session' });
      }
      if (url.includes('/identity/anon/ensure')) {
        return jsonResponse(200, {
          userId: SERVER_ID,
          accountId: SERVER_ID,
          isAnon: true,
        });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

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
    expect(store.getValue(LAST_LOCAL_ACCOUNT_ID_KEY)).toBe(SERVER_ID);
  });

  test('non-auth refresh failure keeps local token and skips anon ensure', async () => {
    const calls: string[] = [];
    const store = createSecureStorageStore(new InMemorySecureStorage());
    const deps = makeDeps(store, async (input) => {
      const url = String(input);
      calls.push(url);
      if (url.includes('/identity/refresh')) {
        return jsonResponse(503, { error: 'unavailable' });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

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

describe('AuthBridgeRefresh local-first account bind', () => {
  let AuthBridgeRefresh: typeof import('./auth-bridge-refresh').AuthBridgeRefresh;

  beforeAll(async () => {
    ({ AuthBridgeRefresh } = await import('./auth-bridge-refresh'));
  });

  test('network failure still binds a minted local account id', async () => {
    const store = createSecureStorageStore(new InMemorySecureStorage());
    const deps = makeDeps(store, async () => {
      throw new Error('Failed to fetch');
    });

    await new AuthBridgeRefresh(deps).bindLocalAccountThenEnsure();

    expect(store.getValue(LAST_LOCAL_ACCOUNT_ID_KEY)).toBe(LOCAL_ID);
  });

  test('existing local id is kept when ensure returns a different user', async () => {
    const store = createSecureStorageStore(new InMemorySecureStorage());
    await store.setValue(LAST_LOCAL_ACCOUNT_ID_KEY, LOCAL_ID);
    const deps = makeDeps(store, async (input) => {
      const url = String(input);
      if (url.includes('/identity/anon/ensure')) {
        return jsonResponse(200, {
          userId: SERVER_ID,
          accountId: SERVER_ID,
          isAnon: true,
        });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    await new AuthBridgeRefresh(deps).bindLocalAccountThenEnsure();

    expect(store.getValue(LAST_LOCAL_ACCOUNT_ID_KEY)).toBe(LOCAL_ID);
  });

  test('first bind adopts server id when ensure returns a different user', async () => {
    const store = createSecureStorageStore(new InMemorySecureStorage());
    const deps = makeDeps(store, async (input) => {
      const url = String(input);
      if (url.includes('/identity/anon/ensure')) {
        return jsonResponse(200, {
          userId: SERVER_ID,
          accountId: SERVER_ID,
          isAnon: true,
        });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    await new AuthBridgeRefresh(deps).bindLocalAccountThenEnsure();

    expect(store.getValue(LAST_LOCAL_ACCOUNT_ID_KEY)).toBe(SERVER_ID);
  });
});

describe('AuthBridgeRefresh waits for origin availability', () => {
  let AuthBridgeRefresh: typeof import('./auth-bridge-refresh').AuthBridgeRefresh;

  beforeAll(async () => {
    ({ AuthBridgeRefresh } = await import('./auth-bridge-refresh'));
  });

  test('network failure retries after availability, not after 3 delays', async () => {
    const { HttpNetworkError } = await import('@pkgs/http-client');
    const store = createSecureStorageStore(new InMemorySecureStorage());
    let available = false;
    let release: () => void = () => undefined;
    let gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let attempts = 0;
    const deps = makeDeps(store, async (input) => {
      const url = String(input);
      if (!url.includes('/identity/anon/ensure')) {
        throw new Error(`unexpected fetch: ${url}`);
      }
      attempts += 1;
      if (!available) throw new HttpNetworkError('down');
      return jsonResponse(200, {
        userId: LOCAL_ID,
        accountId: LOCAL_ID,
        isAnon: true,
      });
    });
    deps.waitUntilAvailable = async () => {
      if (available) return;
      await gate;
    };

    const done = new AuthBridgeRefresh(deps).bindLocalAccountThenEnsure();
    for (let i = 0; i < 20 && attempts === 0; i += 1) {
      await Promise.resolve();
    }
    expect(store.getValue(LAST_LOCAL_ACCOUNT_ID_KEY)).toBe(LOCAL_ID);
    expect(attempts).toBe(1);

    available = true;
    const previousRelease = release;
    gate = Promise.resolve();
    previousRelease();
    await done;
    expect(attempts).toBe(2);
  });
});

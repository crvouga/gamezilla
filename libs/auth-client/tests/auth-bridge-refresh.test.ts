import { beforeAll, describe, expect, mock, test } from 'bun:test';
import type { Timers } from '@pkgs/clock-shared/types';
import type { HttpFetch } from '@pkgs/http-client-shared/types';
import type { SecureStorage } from '@pkgs/secure-storage-shared/interface';
import { createSecureStorageStore } from '@pkgs/secure-storage-shared/secure-storage-store';
import type { CreateId } from '@pkgs/uuid-shared/create-id';

import { LAST_LOCAL_ACCOUNT_ID_KEY } from '@libs/auth-shared/auth-storage-keys';
import type { AuthBridgeRefreshDeps } from '@libs/auth-client/auth-bridge-refresh';

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
    signingInTokenRef: { current: null },
  };
}

describe('AuthBridgeRefresh unauthorized recovery', () => {
  let AuthBridgeRefresh: typeof import('@libs/auth-client/auth-bridge-refresh').AuthBridgeRefresh;
  let SessionCapabilityStore: typeof import('@libs/auth-shared/session-capability').SessionCapabilityStore;

  beforeAll(async () => {
    ({ AuthBridgeRefresh } = await import('@libs/auth-client/auth-bridge-refresh'));
    ({ SessionCapabilityStore } = await import(
      '@libs/auth-shared/session-capability'
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

    await new SessionCapabilityStore(store).write({
      token: 'maybe-live',
      expiresAt: null,
      externalUserId: null,
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

describe('AuthBridgeRefresh new sign-in', () => {
  let AuthBridgeRefresh: typeof import('@libs/auth-client/auth-bridge-refresh').AuthBridgeRefresh;
  let SessionCapabilityStore: typeof import('@libs/auth-shared/session-capability').SessionCapabilityStore;

  beforeAll(async () => {
    ({ AuthBridgeRefresh } = await import('@libs/auth-client/auth-bridge-refresh'));
    ({ SessionCapabilityStore } = await import(
      '@libs/auth-shared/session-capability'
    ));
  });

  // regression: sign-in-refresh-race
  test('a new sign-in is not the session until its account is bound', async () => {
    const store = createSecureStorageStore(new InMemorySecureStorage());
    await store.write(LAST_LOCAL_ACCOUNT_ID_KEY, LOCAL_ID);
    let answer: (res: Response) => void = () => undefined;
    const deps = makeDeps(store, async (input) => {
      const url = String(input);
      if (!url.includes('/identity/refresh')) {
        throw new Error(`unexpected fetch: ${url}`);
      }
      return await new Promise<Response>((resolve) => {
        answer = resolve;
      });
    });

    const done = new AuthBridgeRefresh(deps).runRefresh({
      token: 'new-sign-in',
      expiresAt: null,
      externalUserId: null,
      force: false,
    });
    await Promise.resolve();

    // Still the guest: no session, same account, while the server answers.
    expect(new SessionCapabilityStore(store).readToken()).toBeNull();
    expect(store.getValue(LAST_LOCAL_ACCOUNT_ID_KEY)).toBe(LOCAL_ID);

    answer(jsonResponse(200, { accountId: SERVER_ID }));
    await done;

    expect(new SessionCapabilityStore(store).readToken()).toBe('new-sign-in');
    expect(store.getValue(LAST_LOCAL_ACCOUNT_ID_KEY)).toBe(SERVER_ID);
  });

  test('a sign-out while the account gets ready drops the sign-in', async () => {
    const store = createSecureStorageStore(new InMemorySecureStorage());
    await store.write(LAST_LOCAL_ACCOUNT_ID_KEY, LOCAL_ID);
    let answer: (res: Response) => void = () => undefined;
    const deps = makeDeps(store, async (input) => {
      const url = String(input);
      if (url.includes('/identity/refresh')) {
        return await new Promise<Response>((resolve) => {
          answer = resolve;
        });
      }
      if (url.includes('/identity/anon/ensure')) {
        return jsonResponse(200, { userId: LOCAL_ID, isAnon: true });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    const done = new AuthBridgeRefresh(deps).runRefresh({
      token: 'new-sign-in',
      expiresAt: null,
      externalUserId: null,
      force: false,
    });
    await Promise.resolve();
    await new AuthBridgeRefresh(deps).handleSignedOut();
    answer(jsonResponse(200, { accountId: SERVER_ID }));
    await done;

    expect(new SessionCapabilityStore(store).readToken()).toBeNull();
    expect(store.getValue(LAST_LOCAL_ACCOUNT_ID_KEY)).toBe(LOCAL_ID);
  });

  test('a newer sign-in during the refresh wins', async () => {
    const store = createSecureStorageStore(new InMemorySecureStorage());
    const answers: ((res: Response) => void)[] = [];
    const deps = makeDeps(store, async (input) => {
      const url = String(input);
      if (!url.includes('/identity/refresh')) {
        throw new Error(`unexpected fetch: ${url}`);
      }
      return await new Promise<Response>((resolve) => {
        answers.push(resolve);
      });
    });
    const refresh = (token: string) =>
      new AuthBridgeRefresh(deps).runRefresh({
        token,
        expiresAt: null,
        externalUserId: null,
        force: false,
      });

    const first = refresh('older');
    await Promise.resolve();
    await refresh('newer');
    answers[0]?.(jsonResponse(200, { accountId: LOCAL_ID }));
    for (let i = 0; i < 20 && answers.length < 2; i += 1) {
      await Promise.resolve();
    }
    expect(new SessionCapabilityStore(store).readToken()).toBeNull();
    answers[1]?.(jsonResponse(200, { accountId: SERVER_ID }));
    await first;

    expect(new SessionCapabilityStore(store).readToken()).toBe('newer');
    expect(store.getValue(LAST_LOCAL_ACCOUNT_ID_KEY)).toBe(SERVER_ID);
  });

  test('a lost connection holds the sign-in until it is back', async () => {
    const { HttpNetworkError } = await import('@pkgs/http-client-shared/http-network-error');
    const store = createSecureStorageStore(new InMemorySecureStorage());
    let online = false;
    let attempts = 0;
    let reconnect: (() => void) | null = null;
    const deps = makeDeps(store, async (input) => {
      const url = String(input);
      if (!url.includes('/identity/refresh')) {
        throw new Error(`unexpected fetch: ${url}`);
      }
      attempts += 1;
      if (!online) throw new HttpNetworkError('offline');
      return jsonResponse(200, { accountId: SERVER_ID });
    });
    deps.waitUntilAvailable = () =>
      new Promise<void>((resolve) => {
        reconnect = resolve;
      });

    const done = new AuthBridgeRefresh(deps).runRefresh({
      token: 'new-sign-in',
      expiresAt: null,
      externalUserId: null,
      force: false,
    });
    for (let i = 0; i < 50 && reconnect === null; i += 1) {
      await Promise.resolve();
    }
    expect(attempts).toBe(1);
    expect(new SessionCapabilityStore(store).readToken()).toBeNull();

    online = true;
    (reconnect as (() => void) | null)?.();
    await done;

    expect(attempts).toBe(2);
    expect(new SessionCapabilityStore(store).readToken()).toBe('new-sign-in');
    expect(store.getValue(LAST_LOCAL_ACCOUNT_ID_KEY)).toBe(SERVER_ID);
  });
});

describe('AuthBridgeRefresh local-first account bind', () => {
  let AuthBridgeRefresh: typeof import('@libs/auth-client/auth-bridge-refresh').AuthBridgeRefresh;

  beforeAll(async () => {
    ({ AuthBridgeRefresh } = await import('@libs/auth-client/auth-bridge-refresh'));
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
  let AuthBridgeRefresh: typeof import('@libs/auth-client/auth-bridge-refresh').AuthBridgeRefresh;

  beforeAll(async () => {
    ({ AuthBridgeRefresh } = await import('@libs/auth-client/auth-bridge-refresh'));
  });

  test('network failure retries after availability, not after 3 delays', async () => {
    const { HttpNetworkError } = await import('@pkgs/http-client-shared/http-network-error');
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

import { beforeAll, describe, expect, mock, test } from 'bun:test';
import type { AuthBridgeRefreshDeps } from '@libs/auth-client/auth-bridge-refresh';
import {
  LAST_LOCAL_ACCOUNT_ID_KEY,
  SIGNED_OUT_NOTICE_KEY,
} from '@libs/auth-shared/auth-storage-keys';
import { parseSignedOutNotice } from '@libs/auth-shared/signed-out-notice';
import type { Timers } from '@pkgs/clock-shared/types';
import type { HttpFetch } from '@pkgs/http-client-shared/types';
import type { SecureStorage } from '@pkgs/secure-storage-root-shared/interface';
import {
  createSecureStorageStore,
  writeSecureStorageItem,
} from '@pkgs/secure-storage-root-shared/secure-storage-store';

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

const ACCOUNT_ID = '33333333-3333-4333-8333-333333333333';
const GUEST_ID = '44444444-4444-4444-8444-444444444444';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** The server no longer knows the session: it was signed out everywhere. */
const sessionEnded: HttpFetch = async (input) => {
  const url = String(input);
  if (url.includes('/identity/refresh')) {
    return jsonResponse(401, { error: 'Invalid or expired session' });
  }
  if (url.includes('/identity/anon/ensure')) {
    return jsonResponse(200, {
      userId: GUEST_ID,
      accountId: GUEST_ID,
      isAnon: true,
    });
  }
  throw new Error(`unexpected fetch: ${url}`);
};

type Store = ReturnType<typeof createSecureStorageStore>;

function makeDeps(
  store: Store,
  extra: Partial<AuthBridgeRefreshDeps> = {}
): AuthBridgeRefreshDeps {
  return {
    apiUrl: 'http://localhost',
    deviceId: 'device-1',
    fetchFn: sessionEnded,
    store,
    log: {
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
    },
    timers: syncTimers,
    createId: () => GUEST_ID,
    lastSyncedTokenRef: { current: null },
    inFlightRef: { current: false },
    pendingTokenRef: { current: null },
    signingInTokenRef: { current: null },
    signOutIntentRef: { current: false },
    ...extra,
  };
}

function noticeIn(store: Store) {
  const raw = store.getValue(SIGNED_OUT_NOTICE_KEY);
  return parseSignedOutNotice(typeof raw === 'string' ? raw : null);
}

describe('a sign-in that ends without the person asking here', () => {
  let AuthBridgeRefresh: typeof import('@libs/auth-client/auth-bridge-refresh').AuthBridgeRefresh;
  let SessionCapabilityStore: typeof import('@libs/auth-shared/session-capability').SessionCapabilityStore;

  beforeAll(async () => {
    ({ AuthBridgeRefresh } = await import(
      '@libs/auth-client/auth-bridge-refresh'
    ));
    ({ SessionCapabilityStore } = await import(
      '@libs/auth-shared/session-capability'
    ));
  });

  async function signedIn(store: Store): Promise<void> {
    await new SessionCapabilityStore(store).write({
      token: 'session-token',
      expiresAt: null,
      externalUserId: null,
    });
    await writeSecureStorageItem(store, LAST_LOCAL_ACCOUNT_ID_KEY, ACCOUNT_ID);
  }

  function refreshSession(deps: AuthBridgeRefreshDeps): Promise<void> {
    return new AuthBridgeRefresh(deps).runRefresh({
      token: 'session-token',
      expiresAt: null,
      externalUserId: null,
      force: true,
    });
  }

  test('an ended session leaves a notice naming the changes it had not shared', async () => {
    // regression: involuntary-sign-out-silent
    const store = createSecureStorageStore(new InMemorySecureStorage());
    await signedIn(store);
    const counted: string[] = [];
    const deps = makeDeps(store, {
      countUnshared: async (accountId) => {
        counted.push(accountId);
        return 2;
      },
    });
    await refreshSession(deps);
    expect(counted).toEqual([ACCOUNT_ID]);
    expect(noticeIn(store)).toEqual({ unshared: 2 });
    expect(store.getValue(LAST_LOCAL_ACCOUNT_ID_KEY)).toBe(GUEST_ID);
  });

  test('a device that cannot count its changes still tells the person', async () => {
    const store = createSecureStorageStore(new InMemorySecureStorage());
    await signedIn(store);
    await refreshSession(makeDeps(store));
    expect(noticeIn(store)).toEqual({ unshared: 0 });
  });

  test('a sign-out the person asked for here leaves no notice', async () => {
    const store = createSecureStorageStore(new InMemorySecureStorage());
    await signedIn(store);
    const deps = makeDeps(store, { signOutIntentRef: { current: true } });
    await refreshSession(deps);
    expect(noticeIn(store)).toBeNull();
    expect(deps.signOutIntentRef.current).toBe(false);
  });

  test('a refused sign-in that never became the session leaves no notice', async () => {
    const store = createSecureStorageStore(new InMemorySecureStorage());
    await writeSecureStorageItem(store, LAST_LOCAL_ACCOUNT_ID_KEY, GUEST_ID);
    await new AuthBridgeRefresh(makeDeps(store)).runRefresh({
      token: 'new-sign-in',
      expiresAt: null,
      externalUserId: null,
      force: true,
    });
    expect(noticeIn(store)).toBeNull();
  });

  test('signing in again clears the notice', async () => {
    const store = createSecureStorageStore(new InMemorySecureStorage());
    await signedIn(store);
    await refreshSession(makeDeps(store));
    expect(noticeIn(store)).not.toBeNull();
    const signIn = makeDeps(store, {
      fetchFn: async () => jsonResponse(200, { accountId: ACCOUNT_ID }),
    });
    await new SessionCapabilityStore(store).write({
      token: 'fresh-token',
      expiresAt: null,
      externalUserId: null,
    });
    await new AuthBridgeRefresh(signIn).runRefresh({
      token: 'fresh-token',
      expiresAt: null,
      externalUserId: null,
      force: true,
    });
    expect(noticeIn(store)).toBeNull();
  });
});

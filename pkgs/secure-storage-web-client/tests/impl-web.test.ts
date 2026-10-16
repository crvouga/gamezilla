import { afterEach, beforeEach, describe, expect, it } from 'bun:test';

import { createWebSecureStorage } from '@pkgs/secure-storage-web-client/impl-web';

function installMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? (map.get(key) ?? null) : null;
    },
    key(index: number) {
      return [...map.keys()][index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
  };
}

describe('createWebSecureStorage', () => {
  const previousLocal = globalThis.localStorage;
  const previousSession = globalThis.sessionStorage;
  let local: Storage;
  let session: Storage;

  beforeEach(() => {
    local = installMemoryStorage();
    session = installMemoryStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: local,
    });
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      value: session,
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: previousLocal,
    });
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      value: previousSession,
    });
  });

  // regression: new-tab-loses-local-account
  it('keeps the account alongside the session when a new tab opens', async () => {
    const storage = createWebSecureStorage();
    await storage.setItem('lastLocalAccountId', 'acct-tab-a');
    await storage.setItem('sessionToken', 'saved-session');
    session.clear();
    const nextTab = createWebSecureStorage();
    expect(await nextTab.getItem('lastLocalAccountId')).toBe('acct-tab-a');
    expect(await nextTab.getItem('sessionToken')).toBe('saved-session');
  });

  it('moves an existing tab account to persistent storage', async () => {
    session.setItem('lastLocalAccountId', 'existing-account');
    const storage = createWebSecureStorage();
    expect(await storage.getItem('lastLocalAccountId')).toBe(
      'existing-account'
    );
    expect(local.getItem('lastLocalAccountId')).toBe('existing-account');
    expect(session.getItem('lastLocalAccountId')).toBeNull();
  });

  it('keeps the current persistent account over an older tab account', async () => {
    session.setItem('lastLocalAccountId', 'old-account');
    local.setItem('lastLocalAccountId', 'current-account');
    const storage = createWebSecureStorage();
    expect(await storage.getItem('lastLocalAccountId')).toBe('current-account');
    await storage.deleteItem('lastLocalAccountId');
    expect(await storage.getItem('lastLocalAccountId')).toBeNull();
  });

  it('stores other keys in localStorage', async () => {
    const storage = createWebSecureStorage();
    await storage.setItem('deviceId', 'dev-1');
    expect(local.getItem('deviceId')).toBe('dev-1');
    expect(session.getItem('deviceId')).toBeNull();
  });
});

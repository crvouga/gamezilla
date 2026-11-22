import { describe, expect, test } from 'bun:test';
import type { SecureStorage } from '@pkgs/secure-storage-root-shared-ts/interface';
import {
  createSecureStorageStore,
  writeSecureStorageItem,
} from '@pkgs/secure-storage-root-shared-ts/secure-storage-store';

class InMemorySecureStorage implements SecureStorage {
  private readonly map = new Map<string, string>();

  async getItem(key: string): Promise<string | null> {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.map.set(key, value);
  }

  async deleteItem(key: string): Promise<void> {
    this.map.delete(key);
  }

  has(key: string): boolean {
    return this.map.has(key);
  }
}

describe('SecureStorageStore', () => {
  test('getValue returns null for unhydrated key', () => {
    const store = createSecureStorageStore(new InMemorySecureStorage());
    expect(store.getValue('missing')).toBeNull();
  });

  test('setValue makes value visible synchronously', () => {
    const store = createSecureStorageStore(new InMemorySecureStorage());
    store.setValue('k', 'v');
    expect(store.getValue('k')).toBe('v');
    expect(store.isHydrated('k')).toBe(true);
  });

  test('setValue with null marks the key as absent', () => {
    const store = createSecureStorageStore(new InMemorySecureStorage());
    store.setValue('k', null);
    expect(store.getValue('k')).toBeNull();
    expect(store.isHydrated('k')).toBe(true);
  });

  test('write writes through to storage and updates store', async () => {
    const storage = new InMemorySecureStorage();
    const store = createSecureStorageStore(storage);
    await writeSecureStorageItem(store, 'token', 'abc');

    expect(store.getValue('token')).toBe('abc');
    expect(await storage.getItem('token')).toBe('abc');
  });

  test('write with null deletes from storage and clears store', async () => {
    const storage = new InMemorySecureStorage();
    const store = createSecureStorageStore(storage);
    await writeSecureStorageItem(store, 'token', 'abc');
    await writeSecureStorageItem(store, 'token', null);

    expect(store.getValue('token')).toBeNull();
    expect(storage.has('token')).toBe(false);
  });

  test('write updates store before slow storage I/O resolves', async () => {
    let resolveDelete: (() => void) | undefined;
    const storage: SecureStorage = {
      getItem: async () => null,
      setItem: async () => undefined,
      deleteItem: () =>
        new Promise<void>((resolve) => {
          resolveDelete = resolve;
        }),
    };
    const store = createSecureStorageStore(storage);

    store.setValue('token', 'stale');
    const writePromise = writeSecureStorageItem(store, 'token', null);
    expect(store.getValue('token')).toBeNull();
    resolveDelete?.();
    await writePromise;
  });

  test('setValue during in-flight hydrate is not overwritten by a late null read', async () => {
    let resolveGet: ((value: string | null) => void) | undefined;
    const storage: SecureStorage = {
      getItem: () =>
        new Promise((resolve) => {
          resolveGet = resolve;
        }),
      setItem: async () => undefined,
      deleteItem: async () => undefined,
    };
    const store = createSecureStorageStore(storage);

    const hydratePromise = store.hydrate('signInPending');
    store.setValue('signInPending', '{"startedAt":"x"}');
    resolveGet?.(null);
    await hydratePromise;

    expect(store.getValue('signInPending')).toBe('{"startedAt":"x"}');
  });

  test('stores are isolated — no shared module state', () => {
    const a = createSecureStorageStore(new InMemorySecureStorage());
    const b = createSecureStorageStore(new InMemorySecureStorage());
    a.setValue('k', '1');
    expect(b.getValue('k')).toBeNull();
  });

  // regression: stale-tab-acts-as-guest-after-sign-in
  // Literal input: two tabs open on one browser storage; one signs in.
  test('a tab takes the session another tab saved', async () => {
    const shared = new InMemorySecureStorage();
    const tabs = new Set<(key: string) => void>();
    const openTab = () => {
      let mine: ((key: string) => void) | undefined;
      const tell = (key: string) => {
        for (const other of tabs) if (other !== mine) other(key);
      };
      return createSecureStorageStore({
        getItem: (key) => shared.getItem(key),
        setItem: async (key, value) => {
          await shared.setItem(key, value);
          tell(key);
        },
        deleteItem: async (key) => {
          await shared.deleteItem(key);
          tell(key);
        },
        subscribe(listener) {
          mine = listener;
          tabs.add(listener);
          return () => tabs.delete(listener);
        },
      });
    };
    const signingIn = openTab();
    const alreadyOpen = openTab();
    await alreadyOpen.hydrate('sessionToken');
    let told = 0;
    alreadyOpen.subscribe('sessionToken', () => {
      told += 1;
    });

    await writeSecureStorageItem(signingIn, 'sessionToken', 'account-session');
    await Bun.sleep(0);
    expect(alreadyOpen.getValue('sessionToken')).toBe('account-session');
    expect(told).toBe(1);

    await writeSecureStorageItem(signingIn, 'sessionToken', null);
    await Bun.sleep(0);
    expect(alreadyOpen.getValue('sessionToken')).toBeNull();

    // A key this tab never read stays unread until it is asked for.
    await writeSecureStorageItem(signingIn, 'deviceId', 'device-1');
    await Bun.sleep(0);
    expect(alreadyOpen.isHydrated('deviceId')).toBe(false);
    expect(await alreadyOpen.hydrate('deviceId')).toBe('device-1');
  });
});

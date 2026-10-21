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
});

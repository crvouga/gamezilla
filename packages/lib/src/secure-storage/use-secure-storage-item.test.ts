import { afterEach, describe, expect, test } from 'bun:test';

import type { SecureStorage } from './interface';
import {
  getCachedSecureStorageValue,
  resetSecureStorageCacheForTest,
  seedCachedSecureStorageValue,
  writeSecureStorageItem,
} from './use-secure-storage-item';

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

describe('secure-storage cache', () => {
  afterEach(() => {
    resetSecureStorageCacheForTest();
  });

  test('getCachedSecureStorageValue returns null for unseeded key', () => {
    expect(getCachedSecureStorageValue('missing')).toBeNull();
  });

  test('seedCachedSecureStorageValue makes value visible synchronously', () => {
    seedCachedSecureStorageValue('k', 'v');
    expect(getCachedSecureStorageValue('k')).toBe('v');
  });

  test('seed with null marks the key as absent', () => {
    seedCachedSecureStorageValue('k', null);
    expect(getCachedSecureStorageValue('k')).toBeNull();
  });

  test('writeSecureStorageItem writes through to storage and updates cache', async () => {
    const storage = new InMemorySecureStorage();
    await writeSecureStorageItem(storage, 'token', 'abc');

    expect(getCachedSecureStorageValue('token')).toBe('abc');
    expect(await storage.getItem('token')).toBe('abc');
  });

  test('writeSecureStorageItem with null deletes from storage and clears cache', async () => {
    const storage = new InMemorySecureStorage();
    await writeSecureStorageItem(storage, 'token', 'abc');
    await writeSecureStorageItem(storage, 'token', null);

    expect(getCachedSecureStorageValue('token')).toBeNull();
    expect(storage.has('token')).toBe(false);
  });

  test('resetSecureStorageCacheForTest clears all keys', () => {
    seedCachedSecureStorageValue('a', '1');
    seedCachedSecureStorageValue('b', '2');
    resetSecureStorageCacheForTest();
    expect(getCachedSecureStorageValue('a')).toBeNull();
    expect(getCachedSecureStorageValue('b')).toBeNull();
  });
});

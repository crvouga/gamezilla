import { describe, expect, test } from 'bun:test';
import {
  resolveHasAuthSession,
  SessionCapabilityStore,
} from '@libs/auth-shared/session-capability';
import type { SecureStorage } from '@pkgs/secure-storage-shared/interface';
import { createSecureStorageStore } from '@pkgs/secure-storage-shared/secure-storage-store';

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

describe('resolveHasAuthSession', () => {
  test('false when storage is not hydrated', () => {
    expect(
      resolveHasAuthSession({
        storageHydrated: false,
        sessionToken: 'tok',
      })
    ).toBe(false);
  });

  test('false when hydrated but token missing', () => {
    expect(
      resolveHasAuthSession({
        storageHydrated: true,
        sessionToken: null,
      })
    ).toBe(false);
    expect(
      resolveHasAuthSession({
        storageHydrated: true,
        sessionToken: '',
      })
    ).toBe(false);
  });

  test('true when hydrated with non-empty token', () => {
    expect(
      resolveHasAuthSession({
        storageHydrated: true,
        sessionToken: 'tok',
      })
    ).toBe(true);
  });
});

describe('SessionCapabilityStore write / clear', () => {
  test('persists and clears token, expiry, and external user id', async () => {
    const store = createSecureStorageStore(new InMemorySecureStorage());
    const session = new SessionCapabilityStore(store);
    await session.write({
      token: 'tok',
      expiresAt: '2099-01-01T00:00:00.000Z',
      externalUserId: 'ext-1',
    });
    expect(session.read()).toEqual({
      token: 'tok',
      expiresAt: '2099-01-01T00:00:00.000Z',
      externalUserId: 'ext-1',
    });
    await session.clear();
    expect(session.read()).toBeNull();
  });
});

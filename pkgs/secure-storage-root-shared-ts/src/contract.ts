import { assert } from '@pkgs/assert-root-shared-ts/singleton';

import type { SecureStorage } from './interface';

/**
 * Same rules as the secure-store contract: non-empty, only `[A-Za-z0-9_.-]`.
 * Web localStorage allows any string; we enforce this so behavior matches native.
 */
const KEY_RE = /^[\w.-]+$/;

/** Same limit as the secure-store value storage (UTF-8 bytes). */
export const SECURE_STORAGE_VALUE_MAX_BYTES = 2048;

export function assertSecureStorageKey(key: string): void {
  assert.ok(typeof key === 'string', 'secure storage key must be a string');
  assert.ok(key.length > 0, 'secure storage key must not be empty');
  assert.ok(
    KEY_RE.test(key),
    'secure storage key must contain only alphanumeric characters, ".", "-", and "_"'
  );
}

export function assertSecureStorageValue(value: string): void {
  assert.string(value, 'secure storage value must be a string');
  const bytes = new TextEncoder().encode(value).length;
  assert.ok(
    bytes <= SECURE_STORAGE_VALUE_MAX_BYTES,
    `secure storage value must be at most ${String(SECURE_STORAGE_VALUE_MAX_BYTES)} UTF-8 bytes`
  );
}

/** Wraps a backend so every call runs the same validation as the secure-store contract. */
export function wrapSecureStorage(storage: SecureStorage): SecureStorage {
  return {
    async getItem(key: string): Promise<string | null> {
      assertSecureStorageKey(key);
      return storage.getItem(key);
    },
    async setItem(key: string, value: string): Promise<void> {
      assertSecureStorageKey(key);
      assertSecureStorageValue(value);
      return storage.setItem(key, value);
    },
    async deleteItem(key: string): Promise<void> {
      assertSecureStorageKey(key);
      return storage.deleteItem(key);
    },
  };
}

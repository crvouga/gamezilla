import { wrapSecureStorage } from './contract';
import type { SecureStorage } from './interface';

/**
 * In-memory {@link SecureStorage} for simulations and tests. Each instance owns
 * an isolated `Map`, so per-actor sims never leak values through globals.
 * Wrapped with `wrapSecureStorage` so key/value validation matches native.
 */
export function createInMemorySecureStorage(): SecureStorage {
  const values = new Map<string, string>();
  return wrapSecureStorage({
    getItem(key: string): Promise<string | null> {
      return Promise.resolve(values.get(key) ?? null);
    },
    setItem(key: string, value: string): Promise<void> {
      values.set(key, value);
      return Promise.resolve();
    },
    deleteItem(key: string): Promise<void> {
      values.delete(key);
      return Promise.resolve();
    },
  });
}

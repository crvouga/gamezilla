import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const BEARER_STORAGE_KEY = 'gamezilla.better-auth.bearer';

/**
 * Storage backend shared by the Better Auth React client (expoClient cookie
 * storage) and the bearer token store. Intentionally SecureStore-shaped so the
 * production default is `expo-secure-store` verbatim; tests / multiple
 * in-process actors inject an isolated in-memory implementation instead.
 *
 * `getItem` / `setItem` are the synchronous surface expoClient requires. The
 * async `*Async` methods (SecureStore-style) back the bearer store's persisted
 * reads/writes; when absent the store falls back to the synchronous methods.
 */
export type AuthClientStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): unknown;
  removeItem?(key: string): unknown;
  getItemAsync?(key: string): Promise<string | null>;
  setItemAsync?(key: string, value: string): Promise<unknown>;
  deleteItemAsync?(key: string): Promise<unknown>;
};

/** Isolated in-memory {@link AuthClientStorage} (one Map per actor). */
export function createInMemoryAuthClientStorage(): AuthClientStorage {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

/**
 * Web {@link AuthClientStorage} that prefixes every key with `namespace.` in
 * `localStorage` so multiple in-process actors (playground Alice/Bob) do not
 * share bearer cookies / tokens. Falls back to in-memory when localStorage is
 * unavailable (native / SSR).
 */
export function createNamespacedAuthClientStorage(
  namespace: string
): AuthClientStorage {
  const prefix = `${namespace}.`;
  if (typeof globalThis.localStorage === 'undefined') {
    return createInMemoryAuthClientStorage();
  }
  const store = globalThis.localStorage;
  return {
    getItem: (key) => store.getItem(prefix + key),
    setItem: (key, value) => {
      store.setItem(prefix + key, value);
    },
    removeItem: (key) => {
      store.removeItem(prefix + key);
    },
  };
}

/** Removes every `localStorage` key that starts with `namespace.`. */
export function clearNamespacedAuthClientStorage(namespace: string): void {
  clearStorageKeysWithPrefix(globalThis.localStorage, `${namespace}.`);
}

function clearStorageKeysWithPrefix(
  storage: Storage | undefined,
  prefix: string
): void {
  if (storage === undefined) return;
  const toRemove: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key !== null && key.startsWith(prefix)) {
      toRemove.push(key);
    }
  }
  for (const key of toRemove) {
    storage.removeItem(key);
  }
}

/**
 * Per-actor bearer token store. Holds no module-level state so multiple
 * clients can coexist in one process, each with isolated memory + persistence.
 */
export type BearerTokenStore = {
  /** Synchronous peek (web / injected storage also checks disk for E2E). */
  peek(): string | null;
  read(): Promise<string | null>;
  write(token: string): Promise<void>;
  clear(): Promise<void>;
  clearSync(): void;
  setSuppressCapture(suppress: boolean): void;
  captureFromResponse(response: Response): void;
};

type Persistence = {
  peekSync(): string | null;
  read(): Promise<string | null>;
  write(token: string | null): Promise<void>;
  removeSync(): void;
};

function trimToken(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function createDefaultPersistence(): Persistence {
  const isWeb = Platform.OS === 'web';
  return {
    peekSync() {
      if (!isWeb) return null;
      try {
        return trimToken(
          globalThis.localStorage?.getItem(BEARER_STORAGE_KEY) ?? null
        );
      } catch {
        return null;
      }
    },
    async read() {
      if (isWeb) return this.peekSync();
      try {
        return trimToken(await SecureStore.getItemAsync(BEARER_STORAGE_KEY));
      } catch {
        return null;
      }
    },
    async write(token) {
      if (isWeb) {
        try {
          if (token === null) {
            globalThis.localStorage?.removeItem(BEARER_STORAGE_KEY);
          } else {
            globalThis.localStorage?.setItem(BEARER_STORAGE_KEY, token);
          }
        } catch {
          // best-effort
        }
        return;
      }
      try {
        if (token === null) {
          await SecureStore.deleteItemAsync(BEARER_STORAGE_KEY);
        } else {
          await SecureStore.setItemAsync(BEARER_STORAGE_KEY, token);
        }
      } catch {
        // best-effort
      }
    },
    removeSync() {
      if (!isWeb) return;
      try {
        globalThis.localStorage?.removeItem(BEARER_STORAGE_KEY);
      } catch {
        // best-effort
      }
    },
  };
}

function createInjectedPersistence(storage: AuthClientStorage): Persistence {
  return {
    peekSync() {
      try {
        return trimToken(storage.getItem(BEARER_STORAGE_KEY));
      } catch {
        return null;
      }
    },
    async read() {
      try {
        if (storage.getItemAsync !== undefined) {
          return trimToken(await storage.getItemAsync(BEARER_STORAGE_KEY));
        }
        return trimToken(storage.getItem(BEARER_STORAGE_KEY));
      } catch {
        return null;
      }
    },
    async write(token) {
      try {
        if (token === null) {
          if (storage.deleteItemAsync !== undefined) {
            await storage.deleteItemAsync(BEARER_STORAGE_KEY);
          } else {
            storage.removeItem?.(BEARER_STORAGE_KEY);
          }
          return;
        }
        if (storage.setItemAsync !== undefined) {
          await storage.setItemAsync(BEARER_STORAGE_KEY, token);
        } else {
          storage.setItem(BEARER_STORAGE_KEY, token);
        }
      } catch {
        // best-effort
      }
    },
    removeSync() {
      try {
        storage.removeItem?.(BEARER_STORAGE_KEY);
      } catch {
        // best-effort
      }
    },
  };
}

export function createBearerTokenStore(options?: {
  readonly storage?: AuthClientStorage;
}): BearerTokenStore {
  const persistence =
    options?.storage !== undefined
      ? createInjectedPersistence(options.storage)
      : createDefaultPersistence();

  /**
   * `undefined` = not hydrated from disk yet; `null` = known empty / cleared.
   * Distinguishes "cleared on purpose" from "not loaded" so peek cannot
   * rehydrate a just-cleared token from storage mid-await.
   */
  let memoryToken: string | null | undefined;
  /** Blocks disk rehydrate after sign-out / OAuth handoff clears. */
  let explicitlyCleared = false;
  /** While true, ignore `set-auth-token` (sign-out session refetch race). */
  let suppressCapture = false;

  function peek(): string | null {
    if (explicitlyCleared) return null;
    if (memoryToken !== undefined) return memoryToken;
    const fromDisk = persistence.peekSync();
    memoryToken = fromDisk;
    return fromDisk;
  }

  async function read(): Promise<string | null> {
    if (explicitlyCleared) return null;
    if (memoryToken !== undefined) return memoryToken;
    const stored = await persistence.read();
    // Sign-out may clear while the disk read is in flight.
    if (explicitlyCleared) return null;
    memoryToken = stored;
    return stored;
  }

  async function write(token: string): Promise<void> {
    const trimmed = trimToken(token);
    explicitlyCleared = false;
    memoryToken = trimmed;
    await persistence.write(trimmed);
  }

  function clearSync(): void {
    explicitlyCleared = true;
    memoryToken = null;
    persistence.removeSync();
  }

  async function clear(): Promise<void> {
    clearSync();
    // Persistence captured Platform at construction; do not read Platform here
    // (Jest teardown makes react-native's Platform getter throw).
    await persistence.write(null);
  }

  function setSuppressCapture(suppress: boolean): void {
    suppressCapture = suppress;
  }

  function captureFromResponse(response: Response): void {
    if (suppressCapture) return;
    const token = response.headers.get('set-auth-token')?.trim() ?? '';
    if (token.length === 0) return;
    explicitlyCleared = false;
    memoryToken = token;
    void persistence.write(token);
  }

  return {
    peek,
    read,
    write,
    clear,
    clearSync,
    setSuppressCapture,
    captureFromResponse,
  };
}

/** Storage key used by Playwright E2E token injection (web localStorage). */
export const BETTER_AUTH_BEARER_STORAGE_KEY = BEARER_STORAGE_KEY;

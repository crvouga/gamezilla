const BEARER_STORAGE_KEY = 'gamezilla.auth.bearer';

/**
 * Storage backend for bearer tokens. Hosts inject SecureStore / localStorage /
 * namespaced sim storage — this package never imports a platform SDK.
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
 * `localStorage` so multiple in-process actors do not share bearer tokens.
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
  const storage = globalThis.localStorage;
  if (storage === undefined) return;
  const toRemove: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key !== null && key.startsWith(`${namespace}.`)) {
      toRemove.push(key);
    }
  }
  for (const key of toRemove) {
    storage.removeItem(key);
  }
}

export type BearerTokenStore = {
  peek(): string | null;
  read(): Promise<string | null>;
  write(token: string): Promise<void>;
  clear(): Promise<void>;
  clearSync(): void;
  setSuppressCapture(suppress: boolean): void;
  captureFromResponse(response: Response): void;
};

function trimToken(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function createInjectedPersistence(storage: AuthClientStorage): {
  peekSync(): string | null;
  read(): Promise<string | null>;
  write(token: string | null): Promise<void>;
  removeSync(): void;
} {
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
  const persistence = createInjectedPersistence(
    options?.storage ?? createInMemoryAuthClientStorage()
  );

  let memoryToken: string | null | undefined;
  let explicitlyCleared = false;
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

/** Storage key used by Bun WebView E2E token injection (web localStorage). */
export const AUTH_BEARER_STORAGE_KEY = BEARER_STORAGE_KEY;

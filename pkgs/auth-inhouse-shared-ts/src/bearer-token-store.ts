/**
 * Storage backend for bearer tokens. Hosts inject SecureStore / localStorage /
 * namespaced harness storage — this package never imports a platform SDK.
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

function createInjectedPersistence(
  storage: AuthClientStorage,
  key: string
): {
  peekSync(): string | null;
  read(): Promise<string | null>;
  write(token: string | null): Promise<void>;
  removeSync(): void;
} {
  return {
    peekSync() {
      try {
        return trimToken(storage.getItem(key));
      } catch {
        return null;
      }
    },
    async read() {
      try {
        if (storage.getItemAsync !== undefined) {
          return trimToken(await storage.getItemAsync(key));
        }
        return trimToken(storage.getItem(key));
      } catch {
        return null;
      }
    },
    async write(token) {
      try {
        if (token === null) {
          if (storage.deleteItemAsync !== undefined) {
            await storage.deleteItemAsync(key);
          } else {
            storage.removeItem?.(key);
          }
          return;
        }
        if (storage.setItemAsync !== undefined) {
          await storage.setItemAsync(key, token);
        } else {
          storage.setItem(key, token);
        }
      } catch {
        // best-effort
      }
    },
    removeSync() {
      try {
        storage.removeItem?.(key);
      } catch {
        // best-effort
      }
    },
  };
}

/**
 * A bearer token kept in memory and persisted in `storage` under
 * `storageKey`. The key is the host's: changing it forgets every stored
 * session, so a host keeps it stable for as long as it has users.
 */
export function createBearerTokenStore(options: {
  readonly storage?: AuthClientStorage;
  /** Where in `storage` the token lives (e.g. `myapp.auth.bearer`). */
  readonly storageKey: string;
}): BearerTokenStore {
  const persistence = createInjectedPersistence(
    options.storage ?? createInMemoryAuthClientStorage(),
    options.storageKey
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

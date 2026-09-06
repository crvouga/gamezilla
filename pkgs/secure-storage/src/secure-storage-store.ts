import type { SecureStorage } from './interface';

type Listener = () => void;

/**
 * Per-app in-memory mirror of {@link SecureStorage} keys for synchronous
 * snapshots. Owned by context — not a module singleton — so tests and
 * identity switches cannot leak values via global getters.
 */
export class SecureStorageStore {
  private readonly values = new Map<string, string | null>();
  private readonly listeners = new Map<string, Set<Listener>>();
  private readonly hydrated = new Set<string>();
  private readonly hydrating = new Map<string, Promise<string | null>>();
  private readonly epochs = new Map<string, number>();
  private epochClock = 0;

  constructor(readonly storage: SecureStorage) {}

  getValue(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  isHydrated(key: string): boolean {
    return this.hydrated.has(key);
  }

  getEpoch(key: string): number {
    return this.epochs.get(key) ?? 0;
  }

  subscribe(key: string, listener: Listener): () => void {
    let set = this.listeners.get(key);
    if (set === undefined) {
      set = new Set();
      this.listeners.set(key, set);
    }
    set.add(listener);
    return () => {
      set.delete(listener);
    };
  }

  /**
   * Updates the in-memory mirror and notifies subscribers before any disk I/O.
   * Use when a value changes that other subscribers must see immediately.
   */
  setValue(key: string, value: string | null): void {
    this.values.set(key, value);
    this.hydrated.add(key);
    this.epochs.set(key, ++this.epochClock);
    const set = this.listeners.get(key);
    if (set === undefined) return;
    for (const l of set) l();
  }

  async hydrate(key: string): Promise<string | null> {
    if (this.hydrated.has(key)) {
      return this.values.get(key) ?? null;
    }
    const inflight = this.hydrating.get(key);
    if (inflight !== undefined) {
      return inflight;
    }
    const promise = this.storage
      .getItem(key)
      .then((value) => {
        // A setValue/write may have won while getItem was in flight — keep it.
        if (this.hydrated.has(key)) {
          return this.values.get(key) ?? null;
        }
        this.setValue(key, value);
        return value;
      })
      .finally(() => {
        this.hydrating.delete(key);
      });
    this.hydrating.set(key, promise);
    return promise;
  }

  /**
   * Updates memory first, then persists. Memory-first is critical on iOS where
   * Keychain deletes can lag for hundreds of ms after sign-out.
   */
  async write(key: string, value: string | null): Promise<void> {
    this.setValue(key, value);
    if (value === null) {
      await this.storage.deleteItem(key);
    } else {
      await this.storage.setItem(key, value);
    }
  }
}

export function createSecureStorageStore(
  storage: SecureStorage
): SecureStorageStore {
  return new SecureStorageStore(storage);
}

/** Updates the store mirror before awaiting persistent storage I/O. */
export async function writeSecureStorageItem(
  store: SecureStorageStore,
  key: string,
  value: string | null
): Promise<void> {
  await store.write(key, value);
}

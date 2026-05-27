import type { KeyValueStorage } from './key-value-storage';

const DEFAULT_KEY = '@app/command-history';
const DEFAULT_LIMIT = 20;

export type HistoryStoreOptions = {
  storage?: KeyValueStorage | undefined;
  storageKey?: string;
  limit?: number;
};

export type HistoryListener = () => void;

/**
 * MRU list of command ids with optional AsyncStorage persistence.
 */
export class HistoryStore {
  private readonly storage: KeyValueStorage | undefined;
  private readonly storageKey: string;
  private readonly limit: number;
  private ids: string[] = [];
  private hydrated = false;
  private readonly listeners = new Set<HistoryListener>();

  constructor(options: HistoryStoreOptions = {}) {
    this.storage = options.storage ?? undefined;
    this.storageKey = options.storageKey ?? DEFAULT_KEY;
    this.limit = options.limit ?? DEFAULT_LIMIT;
  }

  getIds(): string[] {
    return [...this.ids];
  }

  subscribe(fn: HistoryListener): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit(): void {
    for (const fn of this.listeners) {
      fn();
    }
  }

  async hydrate(): Promise<void> {
    if (this.storage === undefined || this.hydrated) {
      this.hydrated = true;
      return;
    }
    try {
      const raw = await this.storage.getItem(this.storageKey);
      if (raw === null || raw === '') {
        this.ids = [];
      } else {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
          this.ids = parsed
            .filter((x) => typeof x === 'string')
            .slice(0, this.limit);
        } else {
          this.ids = [];
        }
      }
    } catch {
      this.ids = [];
    }
    this.hydrated = true;
  }

  touch(id: string): void {
    const next = this.ids.filter((x) => x !== id);
    next.unshift(id);
    this.ids = next.slice(0, this.limit);
    this.emit();
    void this.persist();
  }

  private async persist(): Promise<void> {
    if (this.storage === undefined) {
      return;
    }
    try {
      await this.storage.setItem(this.storageKey, JSON.stringify(this.ids));
    } catch {
      // ignore persistence failures
    }
  }
}

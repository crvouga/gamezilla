import { asKeyword, type Keyword } from '@pkgs/keyword/keyword';
import type { Kv } from '@pkgs/kv/interface';
import { jsonKvCodec } from '@pkgs/kv/kv-state-codec';

const DEFAULT_KEY = asKeyword('ui.prefs/command-history');
const VALUE_ATTR = asKeyword('ui.prefs/value');
const DEFAULT_LIMIT = 20;

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

const IDS_CODEC = jsonKvCodec<string[]>(VALUE_ATTR, isStringArray);

export type HistoryStoreOptions = {
  kv?: Kv | null;
  storageKey?: Keyword;
  limit?: number;
};

export type HistoryListener = () => void;

/**
 * MRU list of command ids with optional {@link Kv} persistence.
 */
export class HistoryStore {
  private readonly kv: Kv | null;
  private readonly storageKey: Keyword;
  private readonly limit: number;
  private ids: string[] = [];
  private hydrated = false;
  private readonly listeners = new Set<HistoryListener>();

  constructor(options: HistoryStoreOptions = {}) {
    this.kv = options.kv ?? null;
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
    if (this.kv === null || this.hydrated) {
      this.hydrated = true;
      return;
    }
    try {
      const record = await this.kv.get(this.storageKey);
      const decoded = record === null ? undefined : IDS_CODEC.decode(record);
      this.ids = decoded === undefined ? [] : decoded.slice(0, this.limit);
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
    if (this.kv === null) {
      return;
    }
    try {
      await this.kv.put(this.storageKey, IDS_CODEC.encode(this.ids));
    } catch {
      // ignore persistence failures
    }
  }
}

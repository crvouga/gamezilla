/**
 * MRU list of command ids with optional {@link Kv} persistence.
 * Framework-free; exposes `getSnapshot` / `subscribe` for Solid bridging.
 */

import type { Keyword } from '@pkgs/keyword-shared-ts/keyword';
import { asKeyword } from '@pkgs/keyword-shared-ts/keyword';
import type { Kv } from '@pkgs/kv-root-shared-ts/interface';
import { jsonKvCodec } from '@pkgs/kv-root-shared-ts/kv-state-codec';

export const COMMAND_HISTORY_DEFAULT_KEY = asKeyword(
  'ui.prefs/command-history'
);
const VALUE_ATTR = asKeyword('ui.prefs/value');
export const COMMAND_HISTORY_DEFAULT_LIMIT = 20;

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

const IDS_CODEC = jsonKvCodec<string[]>(VALUE_ATTR, isStringArray);

export type HistoryStoreOptions = {
  kv?: Kv | null | undefined;
  storageKey?: Keyword | undefined;
  limit?: number | undefined;
};

export type HistoryListener = () => void;

export type HistorySnapshot = readonly string[];

export class HistoryStore {
  private readonly kv: Kv | null;
  private readonly storageKey: Keyword;
  private readonly limit: number;
  private ids: HistorySnapshot = [];
  private hydrated = false;
  private readonly listeners = new Set<HistoryListener>();

  constructor(options: HistoryStoreOptions = {}) {
    this.kv = options.kv ?? null;
    this.storageKey = options.storageKey ?? COMMAND_HISTORY_DEFAULT_KEY;
    this.limit = options.limit ?? COMMAND_HISTORY_DEFAULT_LIMIT;
  }

  /** Stable array reference until the next mutation. */
  getSnapshot(): HistorySnapshot {
    return this.ids;
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

  /** Load persisted ids once; a no-op without `kv` or when already hydrated. */
  async hydrate(): Promise<void> {
    if (this.kv === null || this.hydrated) {
      this.hydrated = true;
      return;
    }
    let loaded: readonly string[] = [];
    try {
      const record = await this.kv.get(this.storageKey);
      const decoded = record === null ? undefined : IDS_CODEC.decode(record);
      loaded = decoded ?? [];
    } catch {
      loaded = [];
    }
    // Ids touched while the load was in flight stay most-recent.
    const local = this.ids;
    this.ids = [...local, ...loaded.filter((id) => !local.includes(id))].slice(
      0,
      this.limit
    );
    this.hydrated = true;
    this.emit();
  }

  /** Move `id` to the front (most recent) and persist. */
  touch(id: string): void {
    const next = this.ids.filter((x) => x !== id);
    next.unshift(id);
    this.ids = next.slice(0, this.limit);
    this.emit();
    void this.persist();
  }

  private emit(): void {
    for (const fn of this.listeners) {
      fn();
    }
  }

  private async persist(): Promise<void> {
    if (this.kv === null) return;
    try {
      await this.kv.put(this.storageKey, IDS_CODEC.encode([...this.ids]));
    } catch {
      // Persistence is best-effort; the in-memory list stays authoritative.
    }
  }
}

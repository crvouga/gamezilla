import { Assert } from '@gamezilla/assert';

import type { LogEntry } from '../../../../types';
import type { ClientRoomStorage, QueuedCommand } from '../../../core/storage';

const crash: Assert = Assert.crash();

function readJson<T>(raw: string | null): T | null {
  if (raw === null || raw.length === 0) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Synchronous `localStorage`-backed room cache (topic-scoped keys). Web only.
 *
 * Use {@link KeyValueClientRoomStorage} instead when the same code must run
 * on React Native (AsyncStorage) — `Storage` is not available in Hermes.
 */
export class WebClientStorage implements ClientRoomStorage {
  constructor(
    private readonly prefix: string,
    private readonly storage: Pick<
      Storage,
      'getItem' | 'setItem' | 'removeItem'
    >
  ) {
    crash.nonEmptyString(prefix, 'WebClientStorage prefix must be non-empty');
  }

  private committedKey(): string {
    return `${this.prefix}:committed`;
  }

  private queueKey(): string {
    return `${this.prefix}:queue`;
  }

  async loadCommitted(): Promise<{ lastSeq: number; entries: LogEntry[] }> {
    const raw = this.storage.getItem(this.committedKey());
    const parsed = readJson<{ lastSeq: number; entries: LogEntry[] }>(raw);
    if (parsed === null) {
      return { lastSeq: 0, entries: [] };
    }
    const lastSeq =
      typeof parsed.lastSeq === 'number' && Number.isFinite(parsed.lastSeq)
        ? Math.floor(parsed.lastSeq)
        : 0;
    const entries = Array.isArray(parsed.entries) ? parsed.entries : [];
    return { lastSeq, entries };
  }

  async saveCommitted(lastSeq: number, entries: LogEntry[]): Promise<void> {
    this.storage.setItem(
      this.committedKey(),
      JSON.stringify({ lastSeq, entries })
    );
  }

  async loadQueued(): Promise<QueuedCommand[]> {
    const raw = this.storage.getItem(this.queueKey());
    const parsed = readJson<QueuedCommand[]>(raw);
    return Array.isArray(parsed) ? parsed : [];
  }

  async appendQueued(cmd: QueuedCommand): Promise<void> {
    const cur = await this.loadQueued();
    cur.push(cmd);
    this.storage.setItem(this.queueKey(), JSON.stringify(cur));
  }

  async removeQueued(id: string): Promise<void> {
    const cur = await this.loadQueued();
    const next = cur.filter((c) => c.id !== id);
    this.storage.setItem(this.queueKey(), JSON.stringify(next));
  }
}

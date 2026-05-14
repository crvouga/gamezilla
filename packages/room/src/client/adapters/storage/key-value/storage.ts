import type { Keyword } from '@gamezilla/lib/keyword';
import type { Kv } from '@gamezilla/lib/kv/interface';

import type { LogEntry } from '../../../../types';
import type { ClientRoomStorage, QueuedCommand } from '../../../core/storage';

function parseJson<T>(raw: string | null): T | null {
  if (raw === null || raw.length === 0) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Async {@link Kv}-backed room cache + outbound queue.
 *
 * Use a non-secure client {@link Kv} (e.g. `KvPlatform` from `@gamezilla/lib/kv/kv-platform`):
 * committed-log + queue blobs grow past `expo-secure-store`'s
 * 2048 UTF-8 byte per-value cap as soon as a few entries accumulate. None of
 * this data is sensitive — it's a recovery cache for replay-on-reconnect.
 */
export class KeyValueClientRoomStorage implements ClientRoomStorage {
  constructor(
    private readonly kv: Kv,
    private readonly committedKey: Keyword,
    private readonly queueKey: Keyword
  ) {}

  async loadCommitted(): Promise<{ lastSeq: number; entries: LogEntry[] }> {
    const raw = await this.kv.get(this.committedKey);
    const parsed = parseJson<{ lastSeq: number; entries: LogEntry[] }>(raw);
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
    await this.kv.put(this.committedKey, JSON.stringify({ lastSeq, entries }));
  }

  async loadQueued(): Promise<QueuedCommand[]> {
    const raw = await this.kv.get(this.queueKey);
    const parsed = parseJson<QueuedCommand[]>(raw);
    return Array.isArray(parsed) ? parsed : [];
  }

  async appendQueued(cmd: QueuedCommand): Promise<void> {
    const cur = await this.loadQueued();
    cur.push(cmd);
    await this.kv.put(this.queueKey, JSON.stringify(cur));
  }

  async removeQueued(id: string): Promise<void> {
    const cur = await this.loadQueued();
    const next = cur.filter((c) => c.id !== id);
    await this.kv.put(this.queueKey, JSON.stringify(next));
  }
}

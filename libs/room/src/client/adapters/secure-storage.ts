import type { SecureStorage } from '@gamezilla/lib/secure-storage/interface';

import type { LogEntry } from '../../types';
import type { ClientRoomStorage, QueuedCommand } from '../storage';

function parseJson<T>(raw: string | null): T | null {
  if (raw === null || raw.length === 0) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Async secure storage (Expo SecureStore / web localStorage) for room cache + queue.
 */
export class SecureClientRoomStorage implements ClientRoomStorage {
  constructor(
    private readonly storage: SecureStorage,
    private readonly rootKey: string
  ) {}

  private committedKey(): string {
    return `${this.rootKey}:committed`;
  }

  private queueKey(): string {
    return `${this.rootKey}:queue`;
  }

  async loadCommitted(): Promise<{ lastSeq: number; entries: LogEntry[] }> {
    const raw = await this.storage.getItem(this.committedKey());
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
    await this.storage.setItem(
      this.committedKey(),
      JSON.stringify({ lastSeq, entries })
    );
  }

  async loadQueued(): Promise<QueuedCommand[]> {
    const raw = await this.storage.getItem(this.queueKey());
    const parsed = parseJson<QueuedCommand[]>(raw);
    return Array.isArray(parsed) ? parsed : [];
  }

  async appendQueued(cmd: QueuedCommand): Promise<void> {
    const cur = await this.loadQueued();
    cur.push(cmd);
    await this.storage.setItem(this.queueKey(), JSON.stringify(cur));
  }

  async removeQueued(id: string): Promise<void> {
    const cur = await this.loadQueued();
    const next = cur.filter((c) => c.id !== id);
    await this.storage.setItem(this.queueKey(), JSON.stringify(next));
  }
}

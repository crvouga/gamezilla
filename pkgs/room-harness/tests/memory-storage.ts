import type {
  ClientRoomStorage,
  QueuedCommand,
} from '@pkgs/room-shared/core-storage';
import type { LogEntry } from '@pkgs/room-shared/types';

/** Test double with op counters so tests can assert persistence cost/order. */
export class CountingClientStorage implements ClientRoomStorage {
  entries: LogEntry[] = [];
  queue: readonly QueuedCommand[] = [];
  appends = 0;
  resets = 0;
  queueSaves = 0;
  appendedEntries = 0;

  async loadCommitted(): Promise<{ lastSeq: number; entries: LogEntry[] }> {
    const n = this.entries.length;
    return {
      lastSeq: n === 0 ? 0 : this.entries[n - 1]!.seq,
      entries: this.entries.slice(),
    };
  }

  async appendCommitted(entries: readonly LogEntry[]): Promise<void> {
    this.appends += 1;
    this.appendedEntries += entries.length;
    for (const e of entries) this.entries.push(e);
  }

  async resetCommitted(): Promise<void> {
    this.resets += 1;
    this.entries = [];
  }

  async loadQueued(): Promise<QueuedCommand[]> {
    return this.queue.slice();
  }

  async saveQueued(queue: readonly QueuedCommand[]): Promise<void> {
    this.queueSaves += 1;
    this.queue = queue.slice();
  }
}

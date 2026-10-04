import type {
  ClientRoomStorage,
  QueuedCommand,
} from '@pkgs/room-shared/core-storage';
import type { LogEntry } from '@pkgs/room-shared/types';

/**
 * Volatile per-process {@link ClientRoomStorage} for tests and the loopback
 * testkit. Not safe across reloads or app restarts.
 *
 * Every operation is O(what changed); loads hand out copies so the engine's
 * in-place mutation never aliases the "durable" arrays.
 */
export class InMemoryClientStorage implements ClientRoomStorage {
  private entries: LogEntry[] = [];
  private queue: readonly QueuedCommand[] = [];

  async loadCommitted(): Promise<{ lastSeq: number; entries: LogEntry[] }> {
    const n = this.entries.length;
    return {
      lastSeq: n === 0 ? 0 : this.entries[n - 1]!.seq,
      entries: this.entries.slice(),
    };
  }

  async appendCommitted(entries: readonly LogEntry[]): Promise<void> {
    for (let i = 0; i < entries.length; i++) this.entries.push(entries[i]!);
  }

  async resetCommitted(): Promise<void> {
    this.entries = [];
  }

  async loadQueued(): Promise<QueuedCommand[]> {
    return this.queue.slice();
  }

  async saveQueued(queue: readonly QueuedCommand[]): Promise<void> {
    this.queue = queue.slice();
  }
}

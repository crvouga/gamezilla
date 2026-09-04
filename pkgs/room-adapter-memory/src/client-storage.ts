import type { ClientRoomStorage, LogEntry, QueuedCommand } from '@pkgs/room';
/**
 * Volatile per-process {@link ClientRoomStorage} for tests and the loopback
 * testkit. Not safe across reloads or app restarts.
 */
export class InMemoryClientStorage implements ClientRoomStorage {
  private lastSeq = 0;
  private entries: LogEntry[] = [];
  private queue: QueuedCommand[] = [];

  async loadCommitted(): Promise<{ lastSeq: number; entries: LogEntry[] }> {
    return { lastSeq: this.lastSeq, entries: [...this.entries] };
  }

  async saveCommitted(lastSeq: number, entries: LogEntry[]): Promise<void> {
    this.lastSeq = lastSeq;
    this.entries = [...entries];
  }

  async loadQueued(): Promise<QueuedCommand[]> {
    return [...this.queue];
  }

  async appendQueued(cmd: QueuedCommand): Promise<void> {
    this.queue.push(cmd);
  }

  async removeQueued(id: string): Promise<void> {
    this.queue = this.queue.filter((c) => c.id !== id);
  }
}

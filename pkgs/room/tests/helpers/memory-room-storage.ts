import type { LogEntry } from '@pkgs/room';
import type { CommandDedupOutcome, RoomStorage } from '@pkgs/room/server';

/** Minimal in-memory server storage for engine tests / benchmarks. */
export class MemoryRoomStorage implements RoomStorage {
  entries: LogEntry[] = [];
  dedup = new Map<string, CommandDedupOutcome>();

  async loadEventsAfter(_t: string, afterSeq: number): Promise<LogEntry[]> {
    return this.entries.filter((e) => e.seq > afterSeq);
  }

  async getLastSeq(): Promise<number> {
    return this.entries.at(-1)?.seq ?? 0;
  }

  async commitCommand(
    _t: string,
    id: string,
    batch: LogEntry[]
  ): Promise<void> {
    for (const e of batch) this.entries.push(e);
    this.dedup.set(id, { kind: 'committed', entries: [...batch] });
  }

  async getDedupOutcome(
    _t: string,
    id: string
  ): Promise<CommandDedupOutcome | null> {
    return this.dedup.get(id) ?? null;
  }

  async putDedupOutcome(
    _t: string,
    id: string,
    o: Extract<CommandDedupOutcome, { kind: 'rejected' }>
  ): Promise<void> {
    this.dedup.set(id, o);
  }
}

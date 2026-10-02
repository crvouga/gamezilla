import type { LogEntry } from '@pkgs/room';
import type { CommandDedupOutcome, RoomStorage } from '@pkgs/room/server';

/** In-memory RoomStorage with op counters. */
export class CountingRoomStorage implements RoomStorage {
  entries: LogEntry[] = [];
  dedup = new Map<string, CommandDedupOutcome>();
  lastSeqReads = 0;

  async loadEventsAfter(_t: string, afterSeq: number): Promise<LogEntry[]> {
    return this.entries.filter((e) => e.seq > afterSeq);
  }
  async getLastSeq(): Promise<number> {
    this.lastSeqReads += 1;
    return this.entries.at(-1)?.seq ?? 0;
  }
  async commitCommand(
    _t: string,
    id: string,
    batch: LogEntry[]
  ): Promise<void> {
    let expect = (this.entries.at(-1)?.seq ?? 0) + 1;
    for (const e of batch) {
      if (e.seq !== expect++) throw new Error(`seq gap at ${String(e.seq)}`);
    }
    this.entries.push(...batch);
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

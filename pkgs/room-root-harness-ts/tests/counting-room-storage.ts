import type { LogEntry } from '@pkgs/room-root-shared-ts/types';
import { MemoryRoomStorage } from './memory-room-storage';

/** Engine storage with read counters and strict append sequencing. */
export class CountingRoomStorage extends MemoryRoomStorage {
  lastSeqReads = 0;

  override async getLastSeq(): Promise<number> {
    this.lastSeqReads += 1;
    return super.getLastSeq();
  }

  override async commitCommand(
    topic: string,
    id: string,
    batch: LogEntry[]
  ): Promise<void> {
    let expect = (this.entries.at(-1)?.seq ?? 0) + 1;
    for (const entry of batch) {
      if (entry.seq !== expect++)
        throw new Error(`seq gap at ${String(entry.seq)}`);
    }
    await super.commitCommand(topic, id, batch);
  }
}

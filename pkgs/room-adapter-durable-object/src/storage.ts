import type { LogEntry, RoomModuleName } from '@pkgs/room';
import type { CommandDedupOutcome, RoomStorage } from '@pkgs/room/server';
import {
  dedupKey,
  eventKey,
  type RoomDoKeyNs,
  roomDoKeyNs,
} from './storage-keys';
import {
  migrateLegacyBlobToV3,
  putEntriesBatched,
  type RoomDoMeta,
} from './storage-migrate';
import type { DurableObjectKvStorage } from './types';

/**
 * Room log persisted in a Durable Object's KV `storage` binding.
 *
 * v3 stores one key per event and per dedup outcome (plus a tiny meta key).
 * SQLite-backed DOs cap each string/BLOB/row at 2 MB — the old monolithic
 * `room.do/state-v2*` blob hit that limit on long-lived rooms. On first
 * access, any legacy blob is split into v3 keys and deleted.
 *
 * Pass {@link RoomModuleName} to isolate keys when one DO hosts several
 * modules; omit it to use the unscoped namespace.
 */
export class DurableObjectRoomStorage implements RoomStorage {
  private readonly ns: RoomDoKeyNs;
  private migratePromise: Promise<void> | null = null;

  constructor(
    private readonly kv: DurableObjectKvStorage,
    moduleName?: RoomModuleName
  ) {
    this.ns = roomDoKeyNs(moduleName);
  }

  private async ensureV3(): Promise<void> {
    if (this.migratePromise === null) {
      this.migratePromise = this.runMigrateIfNeeded();
    }
    await this.migratePromise;
  }

  private async runMigrateIfNeeded(): Promise<void> {
    const meta = await this.kv.get<RoomDoMeta>(this.ns.meta);
    if (meta !== undefined) return;
    await migrateLegacyBlobToV3(this.kv, this.ns);
  }

  async loadEventsAfter(_topic: string, afterSeq: number): Promise<LogEntry[]> {
    await this.ensureV3();
    const listed = await this.kv.list<LogEntry>({
      prefix: this.ns.eventPrefix,
      startAfter: eventKey(this.ns, afterSeq),
    });
    return [...listed.values()];
  }

  async getLastSeq(_topic: string): Promise<number> {
    await this.ensureV3();
    return this.readLastSeq();
  }

  async appendCommittedEntries(
    _topic: string,
    newEntries: LogEntry[]
  ): Promise<void> {
    if (newEntries.length === 0) return;
    await this.ensureV3();
    const prevLast = await this.readLastSeq();
    let expect = prevLast + 1;
    const batch: Record<string, unknown> = {};
    for (const e of newEntries) {
      if (e.seq !== expect) {
        throw new Error(
          `DurableObjectRoomStorage.appendCommittedEntries: expected seq ${String(expect)}, got ${String(e.seq)}`
        );
      }
      batch[eventKey(this.ns, e.seq)] = e;
      expect++;
    }
    const lastSeq = newEntries[newEntries.length - 1]!.seq;
    batch[this.ns.meta] = { lastSeq } satisfies RoomDoMeta;
    await putEntriesBatched(this.kv, batch);
  }

  async getDedupOutcome(
    _topic: string,
    commandId: string
  ): Promise<CommandDedupOutcome | null> {
    await this.ensureV3();
    const outcome = await this.kv.get<CommandDedupOutcome>(
      dedupKey(this.ns, commandId)
    );
    return outcome ?? null;
  }

  async putDedupOutcome(
    _topic: string,
    commandId: string,
    outcome: CommandDedupOutcome
  ): Promise<void> {
    await this.ensureV3();
    await this.kv.put(dedupKey(this.ns, commandId), outcome);
  }

  private async readLastSeq(): Promise<number> {
    const meta = await this.kv.get<RoomDoMeta>(this.ns.meta);
    return meta?.lastSeq ?? 0;
  }
}

import type { RoomIdentityErasure } from '@pkgs/room-root-shared/room-service';
import { eraseRoomIdentity } from '@pkgs/room-root-shared/room-service';
import type {
  CommandDedupOutcome,
  RoomStorage,
} from '@pkgs/room-root-shared/server-core-storage';
import type { LogEntry, RoomModuleName } from '@pkgs/room-root-shared/types';
import type { RoomDoKeyNs } from './storage-keys';
import { dedupKey, eventKey, roomDoKeyNs } from './storage-keys';
import type { RoomDoMeta } from './storage-migrate';
import { migrateLegacyBlobToV3, putEntriesBatched } from './storage-migrate';
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
  private migrated = false;
  /** Cached `meta.lastSeq`; this storage is the topic's single writer. */
  private lastSeq: number | null = null;

  constructor(
    private readonly kv: DurableObjectKvStorage,
    moduleName?: RoomModuleName
  ) {
    this.ns = roomDoKeyNs(moduleName);
  }

  private ensureV3(): Promise<void> | void {
    if (this.migrated) return;
    if (this.migratePromise === null) {
      this.migratePromise = this.runMigrateIfNeeded();
    }
    return this.migratePromise;
  }

  private async runMigrateIfNeeded(): Promise<void> {
    const meta = await this.kv.get<RoomDoMeta>(this.ns.meta);
    if (meta === undefined) await migrateLegacyBlobToV3(this.kv, this.ns);
    this.migrated = true;
  }

  async loadEventsAfter(_topic: string, afterSeq: number): Promise<LogEntry[]> {
    await this.ensureV3();
    const listed = await this.kv.list<LogEntry>({
      prefix: this.ns.eventPrefix,
      startAfter: eventKey(this.ns, afterSeq),
    });
    return [...listed.values()];
  }

  async eraseIdentity(
    _topic: string,
    erasure: RoomIdentityErasure,
    invalidation: { commandId: string; entry: LogEntry }
  ): Promise<void> {
    await this.ensureV3();
    await this.kv.transaction(async (tx) => {
      if (
        (await tx.get(dedupKey(this.ns, invalidation.commandId))) !== undefined
      )
        return;
      for (const prefix of [this.ns.eventPrefix, this.ns.dedupPrefix]) {
        const entries = await tx.list({ prefix });
        const batch: Record<string, unknown> = {};
        for (const [key, value] of entries) {
          const nextKey = eraseRoomIdentity(key, erasure);
          if (nextKey !== key) await tx.delete(key);
          batch[nextKey] = eraseRoomIdentity(value, erasure);
        }
        await putEntriesBatched(tx, batch);
      }
      await tx.put({
        [eventKey(this.ns, invalidation.entry.seq)]: invalidation.entry,
        [dedupKey(this.ns, invalidation.commandId)]: {
          kind: 'committed',
          entries: [invalidation.entry],
        } satisfies CommandDedupOutcome,
        [this.ns.meta]: {
          lastSeq: invalidation.entry.seq,
        } satisfies RoomDoMeta,
      });
    });
    this.lastSeq = null;
  }

  async getLastSeq(_topic: string): Promise<number> {
    await this.ensureV3();
    return this.readLastSeq();
  }

  async commitCommand(
    _topic: string,
    commandId: string,
    newEntries: LogEntry[]
  ): Promise<void> {
    if (newEntries.length === 0) return;
    await this.ensureV3();
    if ((await this.getDedupOutcome(_topic, commandId)) !== null) return;
    const prevLast = await this.readLastSeq();
    let expect = prevLast + 1;
    const batch: Record<string, unknown> = {};
    for (const e of newEntries) {
      if (e.seq !== expect) {
        throw new Error(
          `DurableObjectRoomStorage.commitCommand: expected seq ${String(expect)}, got ${String(e.seq)}`
        );
      }
      batch[eventKey(this.ns, e.seq)] = e;
      expect++;
    }
    const lastSeq = newEntries[newEntries.length - 1]!.seq;
    batch[this.ns.meta] = { lastSeq } satisfies RoomDoMeta;
    batch[dedupKey(this.ns, commandId)] = {
      kind: 'committed',
      entries: newEntries,
    } satisfies CommandDedupOutcome;
    try {
      await this.kv.transaction((tx) => putEntriesBatched(tx, batch));
    } catch (error) {
      this.lastSeq = null;
      throw error;
    }
    this.lastSeq = lastSeq;
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
    outcome: Extract<CommandDedupOutcome, { kind: 'rejected' }>
  ): Promise<void> {
    await this.ensureV3();
    if ((await this.getDedupOutcome(_topic, commandId)) !== null) return;
    await this.kv.put(dedupKey(this.ns, commandId), outcome);
  }

  private async readLastSeq(): Promise<number> {
    if (this.lastSeq !== null) return this.lastSeq;
    const meta = await this.kv.get<RoomDoMeta>(this.ns.meta);
    const lastSeq = meta?.lastSeq ?? 0;
    this.lastSeq = lastSeq;
    return lastSeq;
  }
}

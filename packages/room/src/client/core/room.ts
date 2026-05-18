import type { Assert } from '@gamezilla/lib/assert';
import { assert, hotAssert } from '@gamezilla/lib/assert';
import {
  assertKeywordRecord,
  isNamespacedKeyword,
} from '@gamezilla/lib/keyword';
import { isMessageEnvelope } from '@gamezilla/lib/message';

import { newCommandId } from '../../protocol/ids';
import {
  parseServerToClientWire,
  ROOM_WIRE_KIND,
  WIRE_VERSION,
  type ServerToClientWire,
} from '../../protocol/wire';
import type {
  LogEntry,
  RoomCommand,
  RoomCommandPayload,
  RoomError,
  RoomEvent,
  RoomModule,
  RoomState,
} from '../../types';
import { roomAttrNamespace, RoomMetaAttr } from './room-meta';
import type { ClientRoomStorage, QueuedCommand } from './storage';
import type { ClientTransport } from './transport';

export type RoomClientConfig<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
  Identity,
> = {
  topic: string;
  module: RoomModule<S, C, E, Identity>;
  storage: ClientRoomStorage;
  transport: ClientTransport;
  identity: Identity;
  onError?: (err: RoomError | Error) => void;
};

function foldEntries<S extends RoomState, E extends RoomEvent>(
  module: RoomModule<S, RoomCommandPayload, E, unknown>,
  entries: LogEntry<E>[]
): { state: S; lastSeq: number } {
  let state = module.initialState();
  let lastSeq = 0;
  const a: Assert = hotAssert();
  for (const e of entries) {
    state = module.reduce(state, e.event);
    assertKeywordRecord(
      a,
      state as Record<string, unknown>,
      'room.foldEntries'
    );
    lastSeq = e.seq;
  }
  return { state, lastSeq };
}

function foldDisplay<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
  Identity,
>(
  module: RoomModule<S, C, E, Identity>,
  committed: S,
  queue: QueuedCommand[],
  optimistic: Map<string, E[]>
): S {
  let s = committed;
  const a: Assert = hotAssert();
  for (const q of queue) {
    const ev = optimistic.get(q.id);
    if (ev === undefined) continue;
    for (const e of ev) {
      s = module.reduce(s, e);
      assertKeywordRecord(a, s as Record<string, unknown>, 'room.foldDisplay');
    }
  }
  return s;
}

/**
 * Client room: optimistic commands + durable queue; server is source of truth for commits.
 *
 * **API surface (designed for `useSyncExternalStore`)**:
 * - `getSnapshot()` returns stable flat {@link RoomState} (module display state +
 *   {@link RoomMetaAttr} client metadata). Replaced only inside `notify()`.
 * - `subscribe(listener)` takes a no-arg listener; React's external-store
 *   contract calls `getSnapshot()` after every notify.
 * - `dispatch(payload)` enqueues an optimistic command.
 */
export class Room<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
  Identity,
> {
  static async open<
    S2 extends RoomState,
    C2 extends RoomCommandPayload,
    E2 extends RoomEvent,
    I2,
  >(config: RoomClientConfig<S2, C2, E2, I2>): Promise<Room<S2, C2, E2, I2>> {
    const r = new Room(config);
    await r.hydrateLocal();
    r.attachTransport();
    await Promise.resolve(config.transport.connect());
    return r;
  }

  /** Test / bootstrap: wait until first `welcome` applied. */
  async untilSynced(timeoutMs = 2000): Promise<void> {
    const start = Date.now();
    while (!RoomMetaAttr.isSynced.from(this.snapshot)) {
      if (Date.now() - start > timeoutMs) {
        throw new Error('Room.untilSynced: timeout waiting for welcome');
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 2));
    }
  }

  private readonly module: RoomModule<S, C, E, Identity>;
  private readonly storage: ClientRoomStorage;
  private readonly transport: ClientTransport;
  private readonly identity: Identity;
  private readonly onError: ((err: RoomError | Error) => void) | undefined;

  private committedState: S;
  private committedEntries: LogEntry<E>[] = [];
  private lastSeq = 0;
  private pendingQueue: QueuedCommand[] = [];
  private readonly optimistic = new Map<string, E[]>();
  private synced = false;
  private destroyed = false;
  private lastError: RoomError | Error | null = null;
  private snapshot: S;
  private readonly subscribers = new Set<() => void>();
  private unsubTransport: (() => void) | null = null;
  private unsubHandlers: (() => void) | null = null;

  /**
   * Serializes {@link dispatch} work (storage append + optimistic rebuild).
   * Without this, two synchronous `dispatch()` calls race inside storages that
   * implement `appendQueued` as load/modify/write (e.g. web key-value): one
   * command can be dropped from the outbound queue.
   */
  private dispatchSerial: Promise<void> = Promise.resolve();

  private constructor(config: RoomClientConfig<S, C, E, Identity>) {
    this.module = config.module;
    this.storage = config.storage;
    this.transport = config.transport;
    this.identity = config.identity;
    this.onError = config.onError;
    this.committedState = config.module.initialState();
    this.snapshot = this.computeSnapshot();
  }

  private computeSnapshot(): S {
    const display = foldDisplay(
      this.module,
      this.committedState,
      this.pendingQueue,
      this.optimistic
    );
    const a: Assert = hotAssert();
    this.assertDisplayKeys(a, display as Record<string, unknown>);
    const merged = {
      ...(display as Record<string, unknown>),
      ...RoomMetaAttr.isSynced(this.synced),
      ...RoomMetaAttr.isConnected(this.transport.isConnected),
      ...RoomMetaAttr.lastError(this.lastError),
    };
    return a.isEnabled()
      ? (Object.freeze(merged) as unknown as S)
      : (merged as unknown as S);
  }

  private assertDisplayKeys(a: Assert, display: Record<string, unknown>): void {
    if (!a.isEnabled()) return;
    for (const k of Object.keys(display)) {
      a.ok(
        !roomAttrNamespace.ownsKey(k),
        'Tiger: domain room module state must not use room/* keys (reserved for RoomMetaAttr)',
        { k }
      );
      a.ok(
        isNamespacedKeyword(k),
        'Tiger: room module state keys must be Clojure-style namespaced keywords (prefix/local)',
        { k }
      );
    }
  }

  private notify(): void {
    this.snapshot = this.computeSnapshot();
    for (const fn of [...this.subscribers]) {
      fn();
    }
  }

  private reportError(err: RoomError | Error): void {
    this.lastError = err;
    this.onError?.(err);
  }

  private async hydrateLocal(): Promise<void> {
    const { lastSeq, entries } = await this.storage.loadCommitted();
    for (const e of entries) {
      assert.ok(
        isMessageEnvelope(e.event),
        'persisted committed entry must carry a valid message envelope; refusing to hydrate corrupt log',
        { seq: e.seq, event: e.event }
      );
    }
    const folded = foldEntries(this.module, entries as LogEntry<E>[]);
    this.committedState = folded.state;
    this.committedEntries = [...(entries as LogEntry<E>[])];
    this.lastSeq =
      folded.lastSeq > 0 ? folded.lastSeq : Math.max(0, Math.floor(lastSeq));
    this.pendingQueue = await this.storage.loadQueued();
    this.optimistic.clear();
    this.rebuildOptimisticSync();
    this.snapshot = this.computeSnapshot();
  }

  private rebuildOptimisticSync(): void {
    this.optimistic.clear();
    for (let i = 0; i < this.pendingQueue.length; i++) {
      const q = this.pendingQueue[i]!;
      const cmd: RoomCommand<C> = {
        id: q.id,
        ts: q.ts,
        payload: q.payload as C,
      };
      const prefix = this.pendingQueue.slice(0, i);
      const st = foldDisplay(
        this.module,
        this.committedState,
        prefix,
        this.optimistic
      );
      const res = this.module.handle(st, cmd, this.identity);
      if (res.ok) {
        this.optimistic.set(q.id, res.events);
      }
    }
  }

  private attachTransport(): void {
    this.unsubTransport = this.transport.subscribe((raw) => {
      void this.onWire(raw);
    });
    this.unsubHandlers = this.transport.onHandlers({
      onOpen: () => {
        this.sendSync();
        this.notify();
      },
      onClose: () => {
        this.notify();
      },
      onError: (err) => {
        this.reportError(err instanceof Error ? err : new Error(String(err)));
        this.notify();
      },
    });
  }

  private sendSync(): void {
    this.transport.sendJson({
      v: WIRE_VERSION,
      kind: ROOM_WIRE_KIND.sync,
      fromSeq: this.lastSeq,
    });
  }

  private appendCommittedEntries(entries: LogEntry<E>[]): void {
    const a: Assert = hotAssert();
    for (const e of entries) {
      a.ok(
        e.seq === this.lastSeq + 1,
        'log entries must extend lastSeq contiguously',
        { lastSeq: this.lastSeq, got: e.seq }
      );
      this.committedState = this.module.reduce(this.committedState, e.event);
      assertKeywordRecord(
        a,
        this.committedState as Record<string, unknown>,
        'room.appendCommittedEntries'
      );
      this.committedEntries.push(e);
      this.lastSeq = e.seq;
    }
  }

  /**
   * Server is authoritative: drop the local committed cache (state, entries,
   * persisted blob, synced flag) so the next welcome can rebuild from
   * scratch. Used when we detect the server's log has diverged from ours
   * (e.g. server storage was reset to a shorter log, or a broadcast carries
   * a seq at or below our local tail). The outbound command queue is
   * preserved so any user intent in flight gets re-submitted against the
   * fresh server log.
   */
  private async resetCommittedToEmpty(): Promise<void> {
    this.committedState = this.module.initialState();
    this.committedEntries = [];
    this.lastSeq = 0;
    this.synced = false;
    await this.storage.saveCommitted(0, []);
    this.rebuildOptimisticSync();
    this.notify();
  }

  private async onWelcomeWire(
    msg: Extract<ServerToClientWire, { kind: typeof ROOM_WIRE_KIND.welcome }>
  ): Promise<void> {
    // Skip entries we already hold so a re-sync from a lower `fromSeq` is
    // idempotent; only the suffix actually extends our tail.
    const suffix = (msg.entries as LogEntry<E>[]).filter(
      (e) => e.seq > this.lastSeq
    );
    const suffixContiguous =
      suffix.length === 0 || suffix[0]!.seq === this.lastSeq + 1;
    const serverBehind = msg.lastSeq < this.lastSeq;
    if (serverBehind || !suffixContiguous) {
      // Server log diverged from our local cache (e.g. server storage was
      // reset to a shorter log). Server is the source of truth: wipe local
      // committed state and request a full fresh sync from seq 0.
      await this.resetCommittedToEmpty();
      this.sendSync();
      return;
    }
    this.appendCommittedEntries(suffix);
    assert.ok(
      msg.lastSeq === this.lastSeq,
      'welcome lastSeq must match last applied entry seq',
      { lastSeq: this.lastSeq, msgLastSeq: msg.lastSeq }
    );
    await this.storage.saveCommitted(this.lastSeq, this.committedEntries);
    this.rebuildOptimisticSync();
    this.synced = true;
    this.notify();
    await this.flushOutboundQueue();
  }

  private async onCommittedWire(
    msg: Extract<ServerToClientWire, { kind: typeof ROOM_WIRE_KIND.committed }>
  ): Promise<void> {
    const first = msg.entries[0];
    if (first !== undefined) {
      if (first.seq <= this.lastSeq) {
        // Server log diverged: a broadcast seq at or below our tail means
        // the server reset / replayed under a shorter log while our local
        // cache still holds the older, higher-seq entries. Server wins:
        // wipe and re-sync from scratch.
        await this.resetCommittedToEmpty();
        this.sendSync();
        return;
      }
      if (first.seq !== this.lastSeq + 1) {
        // Forward gap: we missed one or more committed frames. Ask the
        // server to fill from our current tail; local state is still
        // valid, so don't wipe it.
        this.synced = false;
        this.sendSync();
        this.notify();
        return;
      }
    }
    this.appendCommittedEntries(msg.entries as LogEntry<E>[]);
    await this.storage.saveCommitted(this.lastSeq, this.committedEntries);
    if (typeof msg.commandId === 'string' && msg.commandId.length > 0) {
      this.optimistic.delete(msg.commandId);
      this.pendingQueue = this.pendingQueue.filter(
        (c) => c.id !== msg.commandId
      );
      await this.storage.removeQueued(msg.commandId);
    }
    this.notify();
  }

  private async onRejectedWire(
    msg: Extract<ServerToClientWire, { kind: typeof ROOM_WIRE_KIND.rejected }>
  ): Promise<void> {
    this.optimistic.delete(msg.commandId);
    this.pendingQueue = this.pendingQueue.filter((c) => c.id !== msg.commandId);
    await this.storage.removeQueued(msg.commandId);
    this.reportError(msg.error);
    this.notify();
  }

  private async onWire(raw: unknown): Promise<void> {
    if (this.destroyed) return;
    const msg = parseServerToClientWire(raw);
    if (msg === null) return;
    if (msg.kind === ROOM_WIRE_KIND.welcome) await this.onWelcomeWire(msg);
    else if (msg.kind === ROOM_WIRE_KIND.committed)
      await this.onCommittedWire(msg);
    else await this.onRejectedWire(msg);
  }

  private async flushOutboundQueue(): Promise<void> {
    if (!this.transport.isConnected || !this.synced) return;
    for (const c of this.pendingQueue) {
      this.transport.sendJson({
        v: WIRE_VERSION,
        kind: ROOM_WIRE_KIND.command,
        id: c.id,
        ts: c.ts,
        payload: c.payload,
      });
    }
  }

  /**
   * Optimistically applies `payload` against current display state, persists it
   * to the durable command queue, and (if connected + synced) sends it. The
   * server is authoritative; local apply is UX only.
   *
   * **Hot path (synchronous):** validate → in-memory queue / optimistic apply
   * → notify → ws.send. The synchronous block is what shows up in a frame's
   * budget when the user drops a chess piece, so storage I/O has been moved
   * off it (see `dispatchSerial` chain below).
   *
   * **Background path (chained):** the durable storage append is queued onto
   * {@link dispatchSerial} so concurrent dispatches still persist in order
   * (without that chain a localStorage / async-kv adapter can interleave a
   * load/modify/write and drop one command from the durable queue).
   */
  dispatch(payload: C): void {
    if (this.destroyed) return;
    const cmd: RoomCommand<C> = {
      id: newCommandId(),
      ts: Date.now(),
      payload,
    };
    const row = this.applyDispatchCommandSync(cmd);
    if (row === null) return;
    this.dispatchSerial = this.dispatchSerial
      .then(() => this.storage.appendQueued(row))
      .catch((err: unknown) => {
        this.reportError(err instanceof Error ? err : new Error(String(err)));
        this.notify();
      });
  }

  /**
   * Synchronous critical section of {@link dispatch}: returns the
   * {@link QueuedCommand} the caller must persist, or `null` when the command
   * was rejected by local validation (or the room is destroyed).
   */
  private applyDispatchCommandSync(cmd: RoomCommand<C>): QueuedCommand | null {
    if (this.destroyed) return null;
    const st = foldDisplay(
      this.module,
      this.committedState,
      this.pendingQueue,
      this.optimistic
    );
    const res = this.module.handle(st, cmd, this.identity);
    if (!res.ok) {
      this.reportError(res.error);
      this.notify();
      return null;
    }
    const row: QueuedCommand = {
      id: cmd.id,
      ts: cmd.ts,
      payload: cmd.payload,
    };
    // In-memory queue is the source of truth between dispatches; reuse the
    // events we already computed via `module.handle` instead of re-running
    // the whole queue through `rebuildOptimisticSync` (was O(N²) on queue
    // size, and on a fresh drop with one in-flight command, redundant).
    this.pendingQueue = [...this.pendingQueue, row];
    this.optimistic.set(cmd.id, res.events);
    this.notify();
    if (this.transport.isConnected && this.synced) {
      this.transport.sendJson({
        v: WIRE_VERSION,
        kind: ROOM_WIRE_KIND.command,
        id: cmd.id,
        ts: cmd.ts,
        payload: cmd.payload,
      });
    }
    return row;
  }

  /**
   * `useSyncExternalStore`-compatible subscribe. The listener is signal-only
   * (call `getSnapshot()` to read fresh values); React calls `getSnapshot`
   * after every notification.
   */
  subscribe(listener: () => void): () => void {
    this.subscribers.add(listener);
    return () => {
      this.subscribers.delete(listener);
    };
  }

  /** Stable reference between notifications. Safe inside `useSyncExternalStore`. */
  getSnapshot(): S {
    return this.snapshot;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.unsubTransport?.();
    this.unsubTransport = null;
    this.unsubHandlers?.();
    this.unsubHandlers = null;
    this.subscribers.clear();
    this.transport.destroy();
  }
}

import { Assert } from '@gamezilla/lib/assert';

import { newCommandId } from '../../protocol/ids';
import {
  parseServerToClientWire,
  WIRE_VERSION,
  type ServerToClientWire,
} from '../../protocol/wire';
import type {
  LogEntry,
  RoomCommand,
  RoomError,
  RoomModule,
  RoomState,
} from '../../types';
import type { ClientTransport } from './transport';
import type { ClientRoomStorage, QueuedCommand } from './storage';

const crash: Assert = Assert.crash();

export type RoomClientConfig<S extends RoomState, C, E, Identity> = {
  topic: string;
  module: RoomModule<S, C, E, Identity>;
  storage: ClientRoomStorage;
  transport: ClientTransport;
  identity: Identity;
  onError?: (err: RoomError | Error) => void;
};

/**
 * Single immutable view of room status + state. Returned by {@link Room.getSnapshot}.
 *
 * `useSyncExternalStore` requires a stable reference between change events; the
 * Room caches `RoomSnapshot` and replaces it only inside `notify()` so React
 * never sees a "moving" snapshot mid-render.
 */
export type RoomSnapshot<S extends RoomState> = Readonly<{
  state: S;
  isSynced: boolean;
  isConnected: boolean;
  lastError: RoomError | Error | null;
}>;

function foldEntries<S extends RoomState, E>(
  module: RoomModule<S, unknown, E, unknown>,
  entries: LogEntry<E>[]
): { state: S; lastSeq: number } {
  let state = module.initialState();
  let lastSeq = 0;
  for (const e of entries) {
    state = module.reduce(state, e.event);
    lastSeq = e.seq;
  }
  return { state, lastSeq };
}

function foldDisplay<S extends RoomState, C, E, Identity>(
  module: RoomModule<S, C, E, Identity>,
  committed: S,
  queue: QueuedCommand[],
  optimistic: Map<string, E[]>
): S {
  let s = committed;
  for (const q of queue) {
    const ev = optimistic.get(q.id);
    if (ev === undefined) continue;
    for (const e of ev) {
      s = module.reduce(s, e);
    }
  }
  return s;
}

/**
 * Client room: optimistic commands + durable queue; server is source of truth for commits.
 *
 * **API surface (designed for `useSyncExternalStore`)**:
 * - `getSnapshot()` returns a stable {@link RoomSnapshot} that is replaced only
 *   inside `notify()`. Callers can compare references to detect change.
 * - `subscribe(listener)` takes a no-arg listener; React's external-store
 *   contract calls `getSnapshot()` after every notify.
 * - `dispatch(payload)` enqueues an optimistic command.
 *
 * Internals (`getState`, `isSynced`, `isConnected`) are intentionally not part
 * of the public surface — read them via `getSnapshot()`.
 */
export class Room<S extends RoomState, C, E, Identity> {
  static async open<S2 extends RoomState, C2, E2, I2>(
    config: RoomClientConfig<S2, C2, E2, I2>
  ): Promise<Room<S2, C2, E2, I2>> {
    const r = new Room(config);
    await r.hydrateLocal();
    r.attachTransport();
    await Promise.resolve(config.transport.connect());
    return r;
  }

  /** Test / bootstrap: wait until first `welcome` applied. */
  async untilSynced(timeoutMs = 2000): Promise<void> {
    const start = Date.now();
    while (!this.snapshot.isSynced) {
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
  private snapshot: RoomSnapshot<S>;
  private readonly subscribers = new Set<() => void>();
  private unsubTransport: (() => void) | null = null;
  private unsubHandlers: (() => void) | null = null;

  private constructor(config: RoomClientConfig<S, C, E, Identity>) {
    this.module = config.module;
    this.storage = config.storage;
    this.transport = config.transport;
    this.identity = config.identity;
    this.onError = config.onError;
    this.committedState = config.module.initialState();
    this.snapshot = this.computeSnapshot();
  }

  private computeSnapshot(): RoomSnapshot<S> {
    return Object.freeze({
      state: foldDisplay(
        this.module,
        this.committedState,
        this.pendingQueue,
        this.optimistic
      ),
      isSynced: this.synced,
      isConnected: this.transport.isConnected,
      lastError: this.lastError,
    });
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
      kind: 'sync',
      fromSeq: this.lastSeq,
    });
  }

  private appendCommittedEntries(entries: LogEntry<E>[]): void {
    for (const e of entries) {
      crash.ok(
        e.seq === this.lastSeq + 1,
        'log entries must extend lastSeq contiguously',
        { lastSeq: this.lastSeq, got: e.seq }
      );
      this.committedState = this.module.reduce(this.committedState, e.event);
      this.committedEntries.push(e);
      this.lastSeq = e.seq;
    }
  }

  private async onWelcomeWire(
    msg: Extract<ServerToClientWire, { kind: 'welcome' }>
  ): Promise<void> {
    this.appendCommittedEntries(msg.entries as LogEntry<E>[]);
    crash.ok(
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
    msg: Extract<ServerToClientWire, { kind: 'committed' }>
  ): Promise<void> {
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
    msg: Extract<ServerToClientWire, { kind: 'rejected' }>
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
    if (msg.kind === 'welcome') await this.onWelcomeWire(msg);
    else if (msg.kind === 'committed') await this.onCommittedWire(msg);
    else await this.onRejectedWire(msg);
  }

  private async flushOutboundQueue(): Promise<void> {
    if (!this.transport.isConnected || !this.synced) return;
    for (const c of this.pendingQueue) {
      this.transport.sendJson({
        v: WIRE_VERSION,
        kind: 'command',
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
   */
  dispatch(payload: C): void {
    if (this.destroyed) return;
    const id = newCommandId();
    const ts = Date.now();
    const cmd: RoomCommand<C> = { id, ts, payload };

    void (async () => {
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
        return;
      }
      const row: QueuedCommand = { id, ts, payload };
      await this.storage.appendQueued(row);
      this.pendingQueue = await this.storage.loadQueued();
      this.rebuildOptimisticSync();
      this.notify();
      if (this.transport.isConnected && this.synced) {
        this.transport.sendJson({
          v: WIRE_VERSION,
          kind: 'command',
          id,
          ts,
          payload,
        });
      }
    })().catch((err: unknown) => {
      this.reportError(err instanceof Error ? err : new Error(String(err)));
      this.notify();
    });
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
  getSnapshot(): RoomSnapshot<S> {
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

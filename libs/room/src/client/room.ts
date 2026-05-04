import { Assert } from '@gamezilla/lib/assert';

import { newCommandId } from '../protocol/ids';
import {
  parseServerToClientWire,
  WIRE_VERSION,
  type ServerToClientWire,
} from '../protocol/wire';
import type {
  LogEntry,
  RoomCommand,
  RoomError,
  RoomModule,
  RoomState,
} from '../types';
import type { ClientTransport } from './transport';
import type { ClientRoomStorage, QueuedCommand } from './storage';

const crash: Assert = Assert.crash();

export type RoomClientConfig<
  S extends RoomState,
  C,
  E,
  Identity,
> = {
  topic: string;
  module: RoomModule<S, C, E, Identity>;
  storage: ClientRoomStorage;
  transport: ClientTransport;
  identity: Identity;
  onError?: (err: RoomError | Error) => void;
};

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
    while (!this.synced) {
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
  /** Explicit `| undefined` so assignments from optional config satisfy `exactOptionalPropertyTypes`. */
  private readonly onError: ((err: RoomError | Error) => void) | undefined;

  private committedState: S;
  private committedEntries: LogEntry<E>[] = [];
  private lastSeq = 0;
  /** Mirror of storage queue; kept in sync on every mutation. */
  private pendingQueue: QueuedCommand[] = [];
  private readonly optimistic = new Map<string, E[]>();
  private synced = false;
  private destroyed = false;
  private readonly subscribers = new Set<(s: S) => void>();
  private unsubTransport: (() => void) | null = null;
  private unsubHandlers: (() => void) | null = null;

  private constructor(config: RoomClientConfig<S, C, E, Identity>) {
    this.module = config.module;
    this.storage = config.storage;
    this.transport = config.transport;
    this.identity = config.identity;
    this.onError = config.onError;
    this.committedState = config.module.initialState();
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
      },
      onClose: () => {
        this.notify();
      },
      onError: (err) => {
        this.onError?.(err instanceof Error ? err : new Error(String(err)));
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
      this.pendingQueue = this.pendingQueue.filter((c) => c.id !== msg.commandId);
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
    this.onError?.(msg.error);
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
        this.onError?.(res.error);
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
      this.onError?.(err instanceof Error ? err : new Error(String(err)));
    });
  }

  subscribe(fn: (state: S) => void): () => void {
    this.subscribers.add(fn);
    return () => {
      this.subscribers.delete(fn);
    };
  }

  getState(): S {
    crash.ok(!this.destroyed, 'Room destroyed');
    return foldDisplay(
      this.module,
      this.committedState,
      this.pendingQueue,
      this.optimistic
    );
  }

  getCommittedState(): S {
    crash.ok(!this.destroyed, 'Room destroyed');
    return this.committedState;
  }

  isConnected(): boolean {
    return this.transport.isConnected;
  }

  isSynced(): boolean {
    return this.synced;
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

  private notify(): void {
    const st = this.getState();
    for (const fn of [...this.subscribers]) {
      fn(st);
    }
  }
}

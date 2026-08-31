import type { Assert } from '@pkgs/assert';
import { hotAssert } from '@pkgs/assert';
import type { Clock, Timers } from '@pkgs/clock';
import { isNamespacedKeyword } from '@pkgs/keyword';
import { isMessageEnvelope } from '@pkgs/message';
import type { CreateId } from '@pkgs/uuid';

import { MAX_PENDING_OUTBOUND_COMMANDS } from '../../bounds';
import type { RoomEffectHandler } from '../../effects/handler';
import { newCommandId } from '../../protocol/ids';
import {
  parseServerToClientWire,
  ROOM_WIRE_KIND,
  WIRE_VERSION,
} from '../../protocol/wire';
import {
  type LogEntry,
  ROOM_ERROR_TYPE,
  type RoomActor,
  type RoomCommand,
  type RoomCommandPayload,
  type RoomError,
  type RoomEvent,
  type RoomModule,
  type RoomState,
} from '../../types';
import {
  appendCommittedEntriesBatch,
  foldDispatchDisplay,
  rebuildOptimisticFromQueue,
} from './room-client-fold';
import { createRoomClientIoSerial } from './room-client-io';
import {
  applyCommittedWire,
  applyRejectedWire,
  applyWelcomeWire,
  type RoomClientWireHost,
} from './room-client-wire';
import { foldEntries } from './room-fold';
import { RoomMetaAttr, roomAttrNamespace } from './room-meta';
import { OptimisticEffectSession } from './room-optimistic-effects';
import type { ClientRoomStorage, QueuedCommand } from './storage';
import type { ClientTransport } from './transport';
import { wipeLocalRoomCache } from './wipe-local-cache';

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
  clock: Clock;
  timers: Timers;
  createId: CreateId;
  effectHandlers?: readonly RoomEffectHandler[];
};

/**
 * Client room: optimistic commands + durable queue; server is source of truth.
 *
 * Durable queue appends and inbound welcome/committed/rejected share one IO
 * serial so acks cannot race ahead of `appendQueued` (ghost-queue bug).
 */
export class RoomClient<
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
  >(
    config: RoomClientConfig<S2, C2, E2, I2>
  ): Promise<RoomClient<S2, C2, E2, I2>> {
    const r = new RoomClient(config);
    try {
      await r.hydrateLocal();
    } catch {
      try {
        await wipeLocalRoomCache(config.storage);
        await r.hydrateLocal();
      } catch {
        r.resetToEmptyLocalState();
      }
    }
    r.attachTransport();
    try {
      await Promise.resolve(config.transport.connect());
    } catch {
      // Stay offline; offline-first UI depends on returning the client.
    }
    return r;
  }

  async untilSynced(timeoutMs = 2000): Promise<void> {
    const start = this.clock.now();
    while (!RoomMetaAttr.isSynced.from(this.snapshot)) {
      if (this.clock.now() - start > timeoutMs) {
        throw new Error('RoomClient.untilSynced: timeout waiting for welcome');
      }
      await new Promise<void>((resolve) => {
        this.timers.setTimeout(resolve, 2);
      });
    }
  }

  private readonly module: RoomModule<S, C, E, Identity>;
  private readonly storage: ClientRoomStorage;
  private readonly transport: ClientTransport;
  private readonly identity: Identity;
  private readonly onError: ((err: RoomError | Error) => void) | undefined;
  private readonly clock: Clock;
  private readonly timers: Timers;
  private readonly createId: CreateId;
  private readonly effectHandlers: readonly RoomEffectHandler[];
  private readonly effectSession: OptimisticEffectSession;
  private readonly io: ReturnType<typeof createRoomClientIoSerial>;

  private committedState: S;
  private committedEntries: LogEntry<E>[] = [];
  private roster: readonly RoomActor[] = [];
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

  private constructor(config: RoomClientConfig<S, C, E, Identity>) {
    this.module = config.module;
    this.storage = config.storage;
    this.transport = config.transport;
    this.identity = config.identity;
    this.onError = config.onError;
    this.clock = config.clock;
    this.timers = config.timers;
    this.createId = config.createId;
    this.effectHandlers = config.effectHandlers ?? [];
    this.io = createRoomClientIoSerial({
      onError: (err) => {
        this.reportError(err);
        this.notify();
      },
    });
    this.effectSession = new OptimisticEffectSession(
      config.topic,
      config.clock,
      this.effectHandlers,
      (args) => {
        this.dispatch(args.payload as C);
      }
    );
    this.committedState = config.module.initialState();
    this.snapshot = this.computeSnapshot();
  }

  /** In-memory outbound command ids (DST durable-queue invariant). */
  getPendingQueueIds(): readonly string[] {
    return this.pendingQueue.map((q) => q.id);
  }

  /** Committed tip seq (DST post-converge lastSeq check). */
  getLastSeq(): number {
    return this.lastSeq;
  }

  /** Await durable-queue + inbound wire IO (tests). */
  async flushIo(): Promise<void> {
    await this.io.flush();
  }

  private wireHost(): RoomClientWireHost {
    const c = this;
    return {
      get lastSeq() {
        return c.lastSeq;
      },
      get committedEntries() {
        return c.committedEntries;
      },
      applyCommittedBatch: (entries) =>
        c.applyCommittedBatch(entries as LogEntry<E>[]),
      applyOptimisticRebuild: () => c.applyOptimisticRebuild(),
      resetCommittedToEmpty: () => c.resetCommittedToEmpty(),
      saveCommitted: () =>
        c.storage.saveCommitted(c.lastSeq, c.committedEntries),
      dropQueued: (id) => c.dropQueued(id),
      removeQueued: (id) => c.storage.removeQueued(id),
      sendSync: () => c.sendSync(),
      flushOutboundQueue: () => c.flushOutboundQueue(),
      setSynced: (v) => {
        c.synced = v;
      },
      setRoster: (clients) => {
        c.roster = clients;
      },
      reportError: (err) => c.reportError(err),
      notify: () => c.notify(),
    };
  }

  private computeSnapshot(): S {
    const display = foldDispatchDisplay(
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
    for (const fn of [...this.subscribers]) fn();
  }

  private reportError(err: RoomError | Error): void {
    this.lastError = err;
    this.onError?.(err);
  }

  private resetToEmptyLocalState(): void {
    this.committedState = this.module.initialState();
    this.committedEntries = [];
    this.lastSeq = 0;
    this.pendingQueue = [];
    this.optimistic.clear();
    this.effectSession.clear();
    void this.effectSession.refresh([]);
    this.synced = false;
    this.snapshot = this.computeSnapshot();
  }

  private async hydrateLocal(): Promise<void> {
    const { lastSeq, entries } = await this.storage.loadCommitted();
    for (const e of entries) {
      if (!isMessageEnvelope(e.event)) {
        throw new Error(
          `persisted committed entry must carry a valid message envelope (seq=${String(e.seq)})`
        );
      }
    }
    const folded = foldEntries(this.module, entries as LogEntry<E>[]);
    this.committedState = folded.state;
    this.committedEntries = [...(entries as LogEntry<E>[])];
    this.lastSeq =
      folded.lastSeq > 0 ? folded.lastSeq : Math.max(0, Math.floor(lastSeq));
    this.pendingQueue = await this.storage.loadQueued();
    this.applyOptimisticRebuild();
    this.snapshot = this.computeSnapshot();
  }

  private applyOptimisticRebuild(): void {
    const rebuilt = rebuildOptimisticFromQueue({
      module: this.module,
      committed: this.committedState,
      queue: this.pendingQueue,
      identity: this.identity,
    });
    this.optimistic.clear();
    this.effectSession.clear();
    for (const [id, events] of rebuilt.optimistic) {
      this.optimistic.set(id, events);
      this.effectSession.remember(id, rebuilt.effectsById.get(id) ?? []);
    }
    void this.effectSession.refresh(this.pendingQueue.map((q) => q.id));
  }

  private attachTransport(): void {
    this.unsubTransport = this.transport.subscribe((raw) => {
      this.onWire(raw);
    });
    this.unsubHandlers = this.transport.onHandlers({
      onOpen: () => {
        this.sendSync();
        this.notify();
      },
      onClose: () => {
        this.synced = false;
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

  private applyCommittedBatch(entries: LogEntry<E>[]): void {
    const next = appendCommittedEntriesBatch({
      module: this.module,
      committedState: this.committedState,
      committedEntries: this.committedEntries,
      lastSeq: this.lastSeq,
      entries,
    });
    this.committedState = next.committedState;
    this.committedEntries = next.committedEntries;
    this.lastSeq = next.lastSeq;
  }

  private async resetCommittedToEmpty(): Promise<void> {
    this.committedState = this.module.initialState();
    this.committedEntries = [];
    this.lastSeq = 0;
    this.synced = false;
    await this.storage.saveCommitted(0, []);
    this.applyOptimisticRebuild();
    this.notify();
  }

  private dropQueued(commandId: string): void {
    this.optimistic.delete(commandId);
    this.effectSession.forget(commandId);
    this.pendingQueue = this.pendingQueue.filter((c) => c.id !== commandId);
  }

  /**
   * Inbound welcome/committed/rejected join the same IO serial as
   * `appendQueued` so removeQueued cannot race ahead of persist.
   */
  private onWire(raw: unknown): void {
    if (this.destroyed) return;
    const msg = parseServerToClientWire(raw);
    if (msg === null) return;
    if (msg.kind === ROOM_WIRE_KIND.pong) return;
    if (msg.kind === ROOM_WIRE_KIND.roster) {
      this.roster = msg.clients;
      this.notify();
      return;
    }
    this.io.enqueue(async () => {
      if (this.destroyed) return;
      const host = this.wireHost();
      if (msg.kind === ROOM_WIRE_KIND.welcome)
        await applyWelcomeWire(host, msg);
      else if (msg.kind === ROOM_WIRE_KIND.committed)
        await applyCommittedWire(host, msg);
      else await applyRejectedWire(host, msg);
    });
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
   * Hot path: sync apply + notify + send. Durable persist is serialized so
   * concurrent dispatch / ack cannot drop or ghost a queued command.
   */
  dispatch(payload: C): void {
    if (this.destroyed) return;
    const cmd: RoomCommand<C> = {
      id: newCommandId(this.createId),
      ts: this.clock.now(),
      payload,
    };
    const row = this.applyDispatchCommandSync(cmd);
    if (row === null) return;
    this.io.enqueue(async () => {
      // Skip persist if already acked (committed/rejected raced ahead of us).
      if (!this.pendingQueue.some((q) => q.id === row.id)) return;
      await this.storage.appendQueued(row);
    });
  }

  private applyDispatchCommandSync(cmd: RoomCommand<C>): QueuedCommand | null {
    if (this.destroyed) return null;
    if (this.pendingQueue.length >= MAX_PENDING_OUTBOUND_COMMANDS) {
      this.reportError({ type: ROOM_ERROR_TYPE.rateLimited });
      this.notify();
      return null;
    }
    const st = foldDispatchDisplay(
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
    if ((res.effects?.length ?? 0) > 0 && this.effectHandlers.length === 0) {
      throw new Error(
        'Tiger: handle produced effects but RoomClient has no effectHandlers'
      );
    }
    const row: QueuedCommand = {
      id: cmd.id,
      ts: cmd.ts,
      payload: cmd.payload,
    };
    this.pendingQueue = [...this.pendingQueue, row];
    this.optimistic.set(cmd.id, res.events);
    void this.effectSession.applyNew(cmd.id, res.effects ?? []);
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

  subscribe(listener: () => void): () => void {
    this.subscribers.add(listener);
    return () => {
      this.subscribers.delete(listener);
    };
  }

  getSnapshot(): S {
    return this.snapshot;
  }

  getLog(): readonly LogEntry<E>[] {
    return this.committedEntries;
  }

  getRoster(): readonly RoomActor[] {
    return this.roster;
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

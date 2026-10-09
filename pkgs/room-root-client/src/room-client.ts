import { hotAssert } from '@pkgs/assert-root-shared/hot-asserts';
import type { Clock, Timers } from '@pkgs/clock-shared/types';
import { isMessageEnvelope } from '@pkgs/message-shared/message';
import { MAX_PENDING_OUTBOUND_COMMANDS } from '@pkgs/room-root-shared/bounds';
import type {
  ClientRoomStorage,
  QueuedCommand,
} from '@pkgs/room-root-shared/core-storage';
import type { RoomEffectHandler } from '@pkgs/room-root-shared/handler';
import { newCommandId } from '@pkgs/room-root-shared/ids';
import type { ClientTransport } from '@pkgs/room-root-shared/transport';
import type {
  LogEntry,
  RoomActor,
  RoomCommand,
  RoomCommandPayload,
  RoomError,
  RoomEvent,
  RoomModule,
  RoomState,
} from '@pkgs/room-root-shared/types';
import { ROOM_ERROR_TYPE } from '@pkgs/room-root-shared/types';
import type { ClientToServerWire } from '@pkgs/room-root-shared/wire';
import {
  parseServerToClientWire,
  ROOM_WIRE_KIND,
  WIRE_VERSION,
} from '@pkgs/room-root-shared/wire';
import type { CreateId } from '@pkgs/uuid-shared/create-id';
import type { ClientCore } from './room-client-core';
import {
  appendCommitted,
  applyDispatch,
  createClientCore,
  rebase,
  resetCommitted,
} from './room-client-core';
import type { RoomClientPersist } from './room-client-persist';
import { createRoomClientPersist } from './room-client-persist';
import type { SnapshotCache } from './room-client-snapshot';
import { createSnapshotCache, readSnapshot } from './room-client-snapshot';
import type { WireEnv } from './room-client-wire';
import {
  applyCommitted,
  applyRejected,
  applyWelcome,
} from './room-client-wire';
import { OptimisticEffectSession } from './room-optimistic-effects';
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
  onDestroy?: () => void;
  onError?: (err: RoomError | Error) => void;
  clock: Clock;
  timers: Timers;
  createId: CreateId;
  effectHandlers?: readonly RoomEffectHandler[];
};

const EMPTY_ROSTER: readonly RoomActor[] = Object.freeze([]);

export type RoomCommandResult =
  | { readonly commandId: string; readonly ok: true }
  | {
      readonly commandId: string;
      readonly ok: false;
      readonly error: RoomError;
    };

/** Local cache must be a contiguous log from seq 1; anything else is corrupt. */
function assertHydratable(entries: readonly LogEntry[]): void {
  for (let i = 0; i < entries.length; i++) {
    if (entries[i]!.seq !== i + 1) {
      throw new Error(
        `persisted committed log must be contiguous from seq 1 (index=${String(i)} seq=${String(entries[i]!.seq)})`
      );
    }
  }
}

function commandFrame(cmd: QueuedCommand): ClientToServerWire {
  return {
    v: WIRE_VERSION,
    kind: ROOM_WIRE_KIND.command,
    id: cmd.id,
    ts: cmd.ts,
    payload: cmd.payload,
  };
}

/**
 * Client room: optimistic commands + durable queue; server is source of truth.
 *
 * Every inbound frame and every dispatch is applied to memory synchronously
 * (parse → fold → notify) so UI latency is one reduce, not a storage round
 * trip. Durable writes ride a write-behind serial ({@link RoomClientPersist})
 * whose queue snapshot semantics make the ghost-queue race impossible.
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
      void Promise.resolve(config.transport.connect()).catch(() => {
        // Admission never holds local state or optimistic commands hostage.
      });
    } catch {
      // Stay offline; offline-first UI depends on returning the client.
    }
    return r;
  }

  /** Resolves on the first synced snapshot; rejects after `timeoutMs` (injected timers). */
  untilSynced(timeoutMs = 2000): Promise<void> {
    if (this.core.synced) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      let timer: unknown = null;
      const unsubscribe = this.subscribe(() => {
        if (!this.core.synced) return;
        if (timer !== null) this.timers.clearTimeout(timer);
        unsubscribe();
        resolve();
      });
      timer = this.timers.setTimeout(() => {
        unsubscribe();
        reject(
          new Error('RoomClient.untilSynced: timeout waiting for welcome')
        );
      }, timeoutMs);
    });
  }

  private readonly core: ClientCore<S, C, E, Identity>;
  private readonly persist: RoomClientPersist;
  private readonly env: WireEnv<S, C, E, Identity>;
  private readonly storage: ClientRoomStorage;
  private readonly transport: ClientTransport;
  private readonly onError: ((err: RoomError | Error) => void) | undefined;
  private readonly clock: Clock;
  private readonly timers: Timers;
  private readonly createId: CreateId;
  private readonly snapshot: SnapshotCache<S>;
  private readonly subscribers = new Set<() => void>();
  private readonly commandSubscribers = new Set<
    (result: RoomCommandResult) => void
  >();

  private roster: readonly RoomActor[] = EMPTY_ROSTER;
  private lastError: RoomError | Error | null = null;
  private readonly onDestroy: (() => void) | undefined;
  private destroyed = false;
  private unsubTransport: (() => void) | null = null;
  private unsubHandlers: (() => void) | null = null;

  private constructor(config: RoomClientConfig<S, C, E, Identity>) {
    this.onDestroy = config.onDestroy;
    this.storage = config.storage;
    this.transport = config.transport;
    this.onError = config.onError;
    this.clock = config.clock;
    this.timers = config.timers;
    this.createId = config.createId;
    const handlers = config.effectHandlers ?? [];
    const effects =
      handlers.length === 0
        ? null
        : new OptimisticEffectSession(
            config.topic,
            config.clock,
            handlers,
            (args) => {
              this.dispatch(args.payload as C);
            }
          );
    this.core = createClientCore({
      module: config.module,
      identity: config.identity,
      effects,
    });
    this.persist = createRoomClientPersist({
      storage: config.storage,
      readQueue: () => this.core.queue,
      onError: (err) => {
        this.reportError(err);
        this.notify();
      },
    });
    this.env = {
      core: this.core,
      persist: this.persist,
      sendSync: () => this.sendSync(),
      flushOutbound: () => this.flushOutbound(),
      reportError: (err) => this.reportError(err),
      notify: () => this.notify(),
    };
    this.snapshot = createSnapshotCache<S>(hotAssert().isEnabled());
    this.captureSnapshotInputs();
  }

  /** In-memory outbound command ids (DST durable-queue invariant). */
  getPendingQueueIds(): readonly string[] {
    const queue = this.core.queue;
    const ids = new Array<string>(queue.length);
    for (let i = 0; i < queue.length; i++) ids[i] = queue[i]!.id;
    return ids;
  }

  /** Committed tip seq (DST post-converge lastSeq check). */
  getLastSeq(): number {
    return this.core.lastSeq;
  }

  /** Await durable-queue + committed-log persistence (tests). */
  flushIo(): Promise<void> {
    return this.persist.flush();
  }

  private captureSnapshotInputs(): void {
    const s = this.snapshot;
    s.display = this.core.display;
    s.synced = this.core.synced;
    s.connected = this.transport.isConnected;
    s.lastError = this.lastError;
  }

  private notify(): void {
    this.captureSnapshotInputs();
    // Reactive listeners can replace subscriptions while receiving a change.
    for (const fn of [...this.subscribers]) {
      if (this.subscribers.has(fn)) fn();
    }
  }

  private reportError(err: RoomError | Error): void {
    this.lastError = err;
    this.onError?.(err);
  }

  private resetToEmptyLocalState(): void {
    resetCommitted(this.core);
    this.core.queue.length = 0;
    rebase(this.core);
    this.captureSnapshotInputs();
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
    assertHydratable(entries);
    const queued = await this.storage.loadQueued();
    resetCommitted(this.core);
    if (entries.length > 0) {
      appendCommitted(this.core, entries as LogEntry<E>[]);
    } else {
      this.core.lastSeq = Math.max(0, Math.floor(lastSeq));
    }
    this.core.queue = queued;
    rebase(this.core);
    this.captureSnapshotInputs();
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
        this.core.synced = false;
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
      fromSeq: this.core.lastSeq,
    });
  }

  private flushOutbound(): void {
    if (!this.transport.isConnected || !this.core.synced) return;
    const queue = this.core.queue;
    for (let i = 0; i < queue.length; i++) {
      this.transport.sendJson(commandFrame(queue[i]!));
    }
  }

  /** Inbound frames apply synchronously; persistence is write-behind. */
  private onWire(raw: unknown): void {
    if (this.destroyed) return;
    const msg = parseServerToClientWire(raw);
    if (msg === null) return;
    switch (msg.kind) {
      case ROOM_WIRE_KIND.pong:
        return;
      case ROOM_WIRE_KIND.roster:
        this.roster = msg.clients;
        this.notify();
        return;
      case ROOM_WIRE_KIND.welcome:
        applyWelcome(this.env, msg);
        return;
      case ROOM_WIRE_KIND.committed:
        applyCommitted(this.env, msg);
        if (msg.commandId !== undefined)
          this.notifyCommand({ commandId: msg.commandId, ok: true });
        return;
      case ROOM_WIRE_KIND.rejected:
        applyRejected(this.env, msg);
        this.notifyCommand({
          commandId: msg.commandId,
          ok: false,
          error: msg.error,
        });
        return;
      default:
        return;
    }
  }

  /**
   * Hot path: one `handle`, O(events) reduces, one notify, one send. The
   * durable queue snapshot is persisted write-behind.
   */
  dispatch(payload: C): string | null {
    if (this.destroyed) return null;
    if (this.core.queue.length >= MAX_PENDING_OUTBOUND_COMMANDS) {
      this.reportError({ type: ROOM_ERROR_TYPE.rateLimited });
      this.notify();
      return null;
    }
    const cmd: RoomCommand<C> = {
      id: newCommandId(this.createId),
      ts: this.clock.now(),
      payload,
    };
    const res = applyDispatch(this.core, cmd);
    if (!res.ok) {
      this.reportError(res.error);
      this.notify();
      return null;
    }
    this.persist.queueChanged();
    this.notify();
    if (this.transport.isConnected && this.core.synced) {
      this.transport.sendJson(commandFrame(cmd));
    }
    return cmd.id;
  }

  subscribe(listener: () => void): () => void {
    this.subscribers.add(listener);
    return () => {
      this.subscribers.delete(listener);
    };
  }

  /** Server results identify their command, even when other choices overlap. */
  subscribeCommandResult(
    listener: (result: RoomCommandResult) => void
  ): () => void {
    this.commandSubscribers.add(listener);
    return () => {
      this.commandSubscribers.delete(listener);
    };
  }

  private notifyCommand(result: RoomCommandResult): void {
    for (const listener of this.commandSubscribers) listener(result);
  }

  /** Display state (committed ⊕ optimistic) plus `room/*` meta; stable ref while unchanged. */
  getSnapshot(): S {
    return readSnapshot(this.snapshot);
  }

  /** Committed log; a fresh array only after the log actually changed (copy-on-read). */
  getLog(): readonly LogEntry<E>[] {
    const core = this.core;
    if (core.logView === null) core.logView = core.entries.slice();
    return core.logView;
  }

  getRoster(): readonly RoomActor[] {
    return this.roster;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.onDestroy?.();
    this.unsubTransport?.();
    this.unsubTransport = null;
    this.unsubHandlers?.();
    this.unsubHandlers = null;
    this.subscribers.clear();
    this.commandSubscribers.clear();
    this.transport.destroy();
  }
}

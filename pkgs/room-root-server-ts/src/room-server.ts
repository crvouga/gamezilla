import { Assert } from '@pkgs/assert-root-shared-ts/assert';
import type { Clock } from '@pkgs/clock-shared-ts/types';
import { isMessageEnvelope } from '@pkgs/message-shared-ts/message';
import { MAX_ROSTER_SIZE } from '@pkgs/room-root-shared-ts/bounds';
import { ROOM_PRESENCE_IDENTITY } from '@pkgs/room-root-shared-ts/builtin';
import { RoomCacheInvalidated } from '@pkgs/room-root-shared-ts/cache-invalidation';
import type { RoomEffectHandler } from '@pkgs/room-root-shared-ts/handler';
import { applyRoomEffects } from '@pkgs/room-root-shared-ts/handler';
import type { RoomIdentityErasure } from '@pkgs/room-root-shared-ts/room-service';
import type { RoomStorage } from '@pkgs/room-root-shared-ts/server-core-storage';
import {
  ROOM_SERVICE_GRANT,
  ROOM_SERVICE_IDENTITY,
} from '@pkgs/room-root-shared-ts/service-identity';
import type {
  LogEntry,
  RoomActor,
  RoomCommand,
  RoomCommandPayload,
  RoomEffect,
  RoomError,
  RoomEvent,
  RoomModule,
  RoomState,
} from '@pkgs/room-root-shared-ts/types';
import { ROOM_ERROR_TYPE } from '@pkgs/room-root-shared-ts/types';
import {
  parseClientToServerWire,
  ROOM_WIRE_KIND,
  WIRE_VERSION,
} from '@pkgs/room-root-shared-ts/wire';
import {
  changedPresence,
  connectionIdsForActor,
  hasAuthority,
  participatingRoster,
  readsHistory,
  refuseConnectionCommand,
} from './room-server-connections';
import {
  broadcastToConnections,
  sendCommitted,
  sendConnectionWelcome,
  sendDedupReplay,
  viewOf,
} from './room-server-fanout';
import { loadRoomSnapshot } from './room-server-hydrate';
import { sessionDenial } from './session-grant';

const crash: Assert = Assert.crash();

import type {
  CommandFrame,
  CommitArgs,
  RoomConnection,
  RoomConnectionOptions,
  RoomServerConfig,
} from '@pkgs/room-root-shared-ts/room-server-types';
import {
  NO_GRANTS,
  PONG_FRAME,
  rejectedFrame,
} from '@pkgs/room-root-shared-ts/room-server-types';

/**
 * Single-threaded authoritative room (run inside one DO or one test harness).
 *
 * All storage-touching work (commands, injects, welcome loads) rides one
 * serial chain, so the in-memory tip / state and the log never diverge and a
 * welcome always sees a consistent snapshot. The committed tip is cached
 * after hydrate, so a commit saves its log and retry verdict atomically
 * and one dedup read — no tip reads on the hot path.
 */
export class RoomServer<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
  Identity,
> {
  readonly topic: string;
  private readonly module: RoomModule<S, C, E, Identity>;
  private readonly storage: RoomStorage;
  private readonly authorize?: RoomServerConfig<S, C, E, Identity>['authorize'];
  private readonly clock: Clock;
  private readonly effectHandlers: readonly RoomEffectHandler[];
  private readonly connections = new Map<string, RoomConnection>();
  private authorityAvailable = false;
  private chain: Promise<void> = Promise.resolve();
  private committedState: S;
  private lastSeq = 0;
  private tipKnown = false;
  private presenceSeq = 0;
  private presenceKey = '[]';

  constructor(config: RoomServerConfig<S, C, E, Identity>) {
    this.topic = config.topic;
    this.module = config.module;
    this.storage = config.storage;
    this.authorize = config.authorize;
    this.clock = config.clock;
    this.effectHandlers = config.effectHandlers ?? [];
    this.committedState = config.module.initialState();
  }

  getCommittedState(): S {
    return this.committedState;
  }

  async readCommittedState(): Promise<S> {
    let state = this.committedState;
    await this.enqueue(async () => {
      state = structuredClone(this.committedState);
    });
    return state;
  }

  eraseIdentity(erasure: RoomIdentityErasure): Promise<void> {
    return this.enqueue(async () => {
      const commandId = `erasure:${erasure.replacement}`;
      if ((await this.storage.getDedupOutcome(this.topic, commandId)) !== null)
        return;
      const entry: LogEntry = {
        seq: (await this.tip()) + 1,
        event: RoomCacheInvalidated({}),
        ts: this.clock.now(),
        actor: { id: ROOM_SERVICE_IDENTITY, clientId: 'service' },
      };
      await this.storage.eraseIdentity(this.topic, erasure, {
        commandId,
        entry,
      });
      await this.hydrateFromStorage();
      this.broadcast({
        v: WIRE_VERSION,
        kind: ROOM_WIRE_KIND.committed,
        entries: [entry],
      });
      for (const conn of this.connections.values())
        if (conn.actor.id === erasure.identity)
          this.connections.delete(conn.id);
      this.broadcastRoster();
    });
  }

  async hydrateFromStorage(): Promise<void> {
    const snapshot = await loadRoomSnapshot(
      this.module,
      this.storage,
      this.topic
    );
    this.committedState = snapshot.state;
    this.lastSeq = snapshot.lastSeq;
    this.tipKnown = true;
    await this.applyCommittedEffects(
      this.module.recoverEffects(snapshot.state)
    );
    await this.availabilitySerial(true);
  }

  setAvailability(available: boolean): Promise<void> {
    return this.enqueue(() => this.availabilitySerial(available));
  }

  private async availabilitySerial(available: boolean): Promise<void> {
    const change = this.module.availabilityChange?.(
      this.committedState,
      available,
      this.clock.now()
    );
    if (change === null || change === undefined) return;
    await this.commit({
      actor: { id: ROOM_SERVICE_IDENTITY, clientId: 'host' },
      commandId: `availability:${String(this.clock.now())}:${String(this.lastSeq + 1)}`,
      events: change.events,
      effects: change.effects ?? [],
    });
  }

  registerConnection(
    id: string,
    send: RoomConnection['send'],
    actor: RoomActor,
    options?: RoomConnectionOptions
  ): void {
    crash.ok(!this.connections.has(id), 'duplicate connection id', { id });
    crash.ok(actor.id.length > 0, 'RoomActor.id must be non-empty', { actor });
    crash.ok(
      actor.clientId.length > 0,
      'RoomActor.clientId must be non-empty',
      { actor }
    );
    if (this.connections.size >= MAX_ROSTER_SIZE) {
      throw new Error(
        `Tiger: roster full (MAX_ROSTER_SIZE=${String(MAX_ROSTER_SIZE)})`
      );
    }
    this.connections.set(id, {
      id,
      send,
      actor,
      grants: options?.grants ?? NO_GRANTS,
      view: this.module.connectionView?.(options?.grants ?? NO_GRANTS) ?? {
        mode: 'full',
      },
    });
    if (options?.silent !== true) this.broadcastRoster();
  }

  hasConnection(id: string): boolean {
    return this.connections.has(id);
  }

  connectionIdsForActor(actorId: string, clientId: string): readonly string[] {
    return connectionIdsForActor(this.connections, actorId, clientId);
  }

  unregisterConnection(id: string): void {
    if (!this.connections.delete(id)) return;
    this.broadcastRoster();
  }

  disconnectActor(identity: string | null): void {
    for (const conn of this.connections.values())
      if (identity === null || conn.actor.id === identity)
        this.connections.delete(conn.id);
    this.broadcastRoster();
  }

  getRoster(): readonly RoomActor[] {
    return participatingRoster(this.connections);
  }

  broadcastRoster(): void {
    const authority = hasAuthority(this.connections);
    const returned = authority && !this.authorityAvailable;
    this.authorityAvailable = authority;
    this.broadcast({
      v: WIRE_VERSION,
      kind: ROOM_WIRE_KIND.roster,
      clients: this.getRoster(),
    });
    this.notePresence();
    if (returned) this.enqueue(() => this.resumeDependents()).catch(noop);
  }

  private async resumeDependents(): Promise<void> {
    for (const conn of this.connections.values())
      if (conn.view.mode === 'dependent' || conn.view.mode === 'dependent-read')
        await this.sendWelcomeSerial(conn.id, 0);
  }

  /**
   * Let the module commit what a presence change means to it. A failure is
   * not lost: the next roster change compares against committed state again.
   */
  private notePresence(): void {
    if (this.module.presenceCommand === undefined) return;
    this.enqueue(() => this.presenceSerial()).catch(noop);
  }

  private async presenceSerial(): Promise<void> {
    const change = changedPresence(this.presenceKey, this.getRoster());
    if (change === null) return;
    const payload = this.module.presenceCommand?.(
      this.committedState,
      change.present
    );
    if (payload === null || payload === undefined) {
      this.presenceKey = change.key;
      return;
    }
    this.presenceSeq += 1;
    await this.injectSerial(
      {
        id: `presence:${String(this.clock.now())}:${String(this.presenceSeq)}`,
        payload,
        identity: ROOM_PRESENCE_IDENTITY as Identity,
      },
      NO_GRANTS
    );
    this.presenceKey = change.key;
  }

  private broadcast(frame: unknown): void {
    const authority = hasAuthority(this.connections);
    broadcastToConnections(
      this.connections,
      frame,
      (conn) =>
        readsHistory(conn, authority) ||
        (frame as { kind: string }).kind === ROOM_WIRE_KIND.roster
    );
  }

  /** Serialize storage-touching work; the returned promise carries the work's outcome. */
  private enqueue(work: () => Promise<void>): Promise<void> {
    const run = this.chain.then(work);
    this.chain = run.then(noop, noop);
    return run;
  }

  private async tip(): Promise<number> {
    if (!this.tipKnown) {
      this.lastSeq = await this.storage.getLastSeq(this.topic);
      this.tipKnown = true;
    }
    return this.lastSeq;
  }

  private async sendWelcomeSerial(
    connectionId: string,
    fromSeq: number
  ): Promise<void> {
    const conn = this.connections.get(connectionId);
    if (conn === undefined) return;
    await sendConnectionWelcome({
      connection: conn,
      storage: this.storage,
      topic: this.topic,
      fromSeq,
      available: () => readsHistory(conn, hasAuthority(this.connections)),
      roster: this.getRoster(),
      tip: () => this.tip(),
      view: viewOf(this.module, conn),
    });
  }

  private async reject(
    commandId: string,
    error: RoomError,
    send: RoomConnection['send'] | null
  ): Promise<void> {
    await this.storage.putDedupOutcome(this.topic, commandId, {
      kind: 'rejected',
      error,
    });
    if (send !== null) send(rejectedFrame(commandId, error));
  }

  private async authorizeOrNull(
    identity: Identity,
    command: RoomCommand<C>,
    grants: readonly string[]
  ): Promise<RoomError | null> {
    if (this.authorize === undefined) return null;
    const a = await this.authorize(identity, this.topic, command, grants);
    if (a.ok) return null;
    return { type: ROOM_ERROR_TYPE.unauthorized, reason: a.reason };
  }

  private async commit(args: CommitArgs<E>): Promise<void> {
    crash.ok(args.events.length > 0, 'handle must produce events on success');
    for (const event of args.events) {
      crash.ok(
        isMessageEnvelope(event),
        'Tiger: room events must be Message envelopes with wire-valid type',
        { event }
      );
    }
    const ts = this.clock.now();
    const base = this.tipKnown ? this.lastSeq : await this.tip();
    const entries = new Array<LogEntry<E>>(args.events.length);
    for (let i = 0; i < args.events.length; i++) {
      entries[i] = {
        seq: base + i + 1,
        event: args.events[i]!,
        actor: args.actor,
        ts,
      };
    }
    let state = this.committedState;
    for (let i = 0; i < entries.length; i++) {
      if (!RoomCacheInvalidated.is(entries[i]!.event))
        state = this.module.reduce(state, entries[i]!.event);
    }
    try {
      await this.storage.commitCommand(this.topic, args.commandId, entries);
    } catch (error) {
      // The storage acknowledgement may be lost after an atomic commit. Reload
      // before accepting another command so its state and sequence are current.
      await this.hydrateFromStorage();
      throw error;
    }
    this.lastSeq = base + entries.length;
    this.committedState = state;
    sendCommitted({
      connections: this.connections,
      module: this.module,
      commandId: args.commandId,
      entries,
      reads: (conn) => readsHistory(conn, hasAuthority(this.connections)),
    });
    await this.applyCommittedEffects(args.effects);
  }

  private async applyCommittedEffects(
    effects: readonly RoomEffect[]
  ): Promise<void> {
    if (effects.length === 0) return;
    crash.ok(
      this.effectHandlers.length > 0,
      'Tiger: handle produced effects but RoomServer has no effectHandlers',
      { count: effects.length }
    );
    await applyRoomEffects(effects, this.effectHandlers, {
      topic: this.topic,
      clock: this.clock,
      now: this.clock.now(),
      injectCommand: (a) =>
        this.injectCommand({
          id: a.id,
          payload: a.payload as C,
          identity: a.identity as Identity,
        }),
    });
  }

  /** Socket-less command (scheduler wake / host-injected); same dedup + authz + commit path. */
  injectCommand(args: {
    readonly id: string;
    readonly payload: C;
    readonly identity: Identity;
  }): Promise<void> {
    return this.enqueue(() => this.injectSerial(args, NO_GRANTS));
  }

  /** Only a host service port calls this; socket commands never receive its grant. */
  injectServiceCommand(args: {
    readonly id: string;
    readonly payload: C;
    readonly identity: Identity;
  }): Promise<void> {
    return this.enqueue(() => this.injectSerial(args, [ROOM_SERVICE_GRANT]));
  }

  private async injectSerial(
    args: {
      readonly id: string;
      readonly payload: C;
      readonly identity: Identity;
    },
    grants: readonly string[]
  ): Promise<void> {
    const commandId = args.id;
    const prior = await this.storage.getDedupOutcome(this.topic, commandId);
    if (prior !== null) return;
    if (!isMessageEnvelope(args.payload)) return;
    const command: RoomCommand<C> = {
      id: commandId,
      ts: this.clock.now(),
      payload: args.payload,
    };
    const denied = await this.authorizeOrNull(args.identity, command, grants);
    if (denied !== null) {
      await this.reject(commandId, denied, null);
      return;
    }
    const result = this.module.handle(
      this.committedState,
      command,
      args.identity
    );
    if (!result.ok) {
      await this.reject(commandId, result.error, null);
      return;
    }
    await this.commit({
      actor: { id: String(args.identity), clientId: 'scheduler' },
      commandId,
      events: result.events,
      effects: result.effects ?? [],
    });
  }

  private async commandSerial(
    connectionId: string,
    identity: Identity,
    parsed: CommandFrame
  ): Promise<void> {
    const conn = this.connections.get(connectionId);
    if (conn === undefined) return;
    const send = conn.send;
    const commandId = parsed.id;
    if (refuseConnectionCommand(conn, this.connections, commandId)) return;
    const prior = await this.storage.getDedupOutcome(this.topic, commandId);
    if (prior !== null) {
      sendDedupReplay(send, commandId, prior, viewOf(this.module, conn));
      return;
    }
    if (!isMessageEnvelope(parsed.payload)) {
      await this.reject(
        commandId,
        {
          type: ROOM_ERROR_TYPE.invalidCommand,
          reason: 'not a valid message envelope',
        },
        send
      );
      return;
    }
    const command: RoomCommand<C> = {
      id: commandId,
      ts: this.clock.now(),
      payload: parsed.payload as C,
    };
    const denied = await this.authorizeOrNull(identity, command, conn.grants);
    if (refuseConnectionCommand(conn, this.connections, commandId)) return;
    const refusal = sessionDenial(denied, conn.grants, this.clock.now());
    if (refusal !== null) {
      await this.reject(commandId, refusal, send);
      return;
    }
    const result = this.module.handle(this.committedState, command, identity);
    if (!result.ok) {
      await this.reject(commandId, result.error, send);
      return;
    }
    await this.commit({
      actor: conn.actor,
      commandId,
      events: result.events,
      effects: result.effects ?? [],
    });
  }

  /**
   * Parse synchronously; `ping` answers immediately, `sync` / `command` join
   * the storage serial in arrival order. Resolves when the frame is fully
   * processed; rejects with the storage / module failure.
   */
  handleClientMessage(
    connectionId: string,
    identity: Identity,
    raw: unknown
  ): Promise<void> {
    const conn = this.connections.get(connectionId);
    if (conn === undefined) return Promise.resolve();
    const parsed = parseClientToServerWire(raw);
    if (parsed === null) return Promise.resolve();
    switch (parsed.kind) {
      case ROOM_WIRE_KIND.ping:
        conn.send(PONG_FRAME);
        return Promise.resolve();
      case ROOM_WIRE_KIND.sync:
        return this.enqueue(() =>
          this.sendWelcomeSerial(connectionId, parsed.fromSeq)
        );
      default:
        return this.enqueue(() =>
          this.commandSerial(connectionId, identity, parsed)
        );
    }
  }
}

function noop(): void {}

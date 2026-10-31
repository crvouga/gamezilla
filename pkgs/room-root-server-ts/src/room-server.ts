import type { Clock } from '@pkgs/clock-shared-ts/types';
import { ROOM_PRESENCE_IDENTITY } from '@pkgs/room-root-shared-ts/builtin';
import { RoomCacheInvalidated } from '@pkgs/room-root-shared-ts/cache-invalidation';
import type {
  CommandFrame,
  CommitArgs,
  RoomConnection,
  RoomConnectionOptions,
  RoomServerConfig,
} from '@pkgs/room-root-shared-ts/room-server-types';
import {
  NO_GRANTS,
  rejectedFrame,
} from '@pkgs/room-root-shared-ts/room-server-types';
import type {
  RoomIdentityErasure,
  RoomServiceReceipt,
} from '@pkgs/room-root-shared-ts/room-service';
import type { RoomStorage } from '@pkgs/room-root-shared-ts/server-core-storage';
import {
  ROOM_SERVICE_GRANT,
  ROOM_SERVICE_IDENTITY,
} from '@pkgs/room-root-shared-ts/service-identity';
import type {
  RoomActor,
  RoomCommand,
  RoomCommandPayload,
  RoomError,
  RoomEvent,
  RoomModule,
  RoomState,
} from '@pkgs/room-root-shared-ts/types';
import { ROOM_ERROR_TYPE } from '@pkgs/room-root-shared-ts/types';
import { ROOM_WIRE_KIND, WIRE_VERSION } from '@pkgs/room-root-shared-ts/wire';
import { processRoomCommand } from './room-server-command';
import {
  addRoomConnection,
  changedPresence,
  connectionIdsForActor,
  hasAuthority,
  liveRoster,
  participatingRoster,
  readsHistory,
} from './room-server-connections';
import { createRoomEffectDelivery } from './room-server-effects';
import { committedRoomEntries } from './room-server-entries';
import { eraseRoomIdentity } from './room-server-erasure';
import {
  broadcastToConnections,
  sendCommitted,
  sendConnectionWelcome,
  viewOf,
} from './room-server-fanout';
import { loadRoomSnapshot } from './room-server-hydrate';
import { processInjectedCommand } from './room-server-inject';
import { routeRoomMessage } from './room-server-message';
import { restoreRoomLiveCheckpoint } from './room-server-recovery';
import { RoomServerRuntime, roomRuntimePorts } from './room-server-runtime';
import { publishRoomSignal, receiveRoomSignal } from './room-server-signals';

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
  private readonly applyCommittedEffects;
  private readonly runtime: RoomServerRuntime<S, C, E, Identity>;
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
    this.applyCommittedEffects = createRoomEffectDelivery({
      handlers: config.effectHandlers ?? [],
      topic: this.topic,
      clock: this.clock,
      injectCommand: (args) =>
        this.injectCommand({
          id: args.id,
          payload: args.payload as C,
          identity: args.identity as Identity,
        }),
    });
    this.runtime = new RoomServerRuntime(
      config,
      roomRuntimePorts({
        storage: this.storage,
        topic: this.topic,
        publish: (payload, audience) => this.publishSignal(payload, audience),
        enqueue: (work) => this.enqueue(work),
        tip: () => this.lastSeq,
        acceptsCheckpoint: (payload) =>
          this.runtime.recover(this.committedState, payload) !== null,
        inject: async (id, payload) => {
          const receipt = await this.injectSerial(
            { id, payload, identity: ROOM_SERVICE_IDENTITY as Identity },
            [ROOM_SERVICE_GRANT]
          );
          if (!receipt.ok) throw new Error(JSON.stringify(receipt.error));
        },
        onError: (error) => this.runtime.report(error),
      })
    );
    this.committedState = config.module.initialState();
  }

  getCommittedState(): S {
    return this.committedState;
  }

  /** Live state is published on this room, without becoming permanent history. */
  publishSignal(
    payload: RoomCommandPayload,
    audience?: readonly string[]
  ): void {
    publishRoomSignal({
      connections: this.connections,
      payload,
      now: this.clock.now(),
      audience,
    });
  }

  async readCommittedState(): Promise<S> {
    let state = this.committedState;
    await this.enqueue(async () => {
      state = structuredClone(this.committedState);
    });
    return state;
  }

  eraseIdentity(erasure: RoomIdentityErasure): Promise<void> {
    return this.enqueue(() =>
      eraseRoomIdentity({
        storage: this.storage,
        topic: this.topic,
        erasure,
        now: this.clock.now(),
        tip: () => this.tip(),
        committed: async (entry) => {
          await this.hydrateFromStorage();
          this.broadcast({
            v: WIRE_VERSION,
            kind: ROOM_WIRE_KIND.committed,
            entries: [entry],
          });
          this.disconnectActor(erasure.identity);
        },
      })
    );
  }

  async hydrateFromStorage(): Promise<void> {
    this.runtime.reset();
    const snapshot = await loadRoomSnapshot(
      this.module,
      this.storage,
      this.topic
    );
    this.committedState = snapshot.state;
    this.lastSeq = snapshot.lastSeq;
    this.tipKnown = true;
    if (this.module.createRuntime !== undefined)
      await restoreRoomLiveCheckpoint({
        storage: this.storage,
        topic: this.topic,
        state: this.committedState,
        lastSeq: this.lastSeq,
        recover: (state, payload) => this.runtime.recover(state, payload),
        inject: async (id, payload) => {
          const receipt = await this.injectSerial(
            { id, payload, identity: ROOM_SERVICE_IDENTITY as Identity },
            [ROOM_SERVICE_GRANT]
          );
          if (!receipt.ok)
            throw new Error('live recovery checkpoint was refused');
        },
      });
    await this.applyCommittedEffects(
      this.module.recoverEffects(this.committedState)
    );
    await this.availabilitySerial(true);
    this.runtime.start(this.committedState);
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
    addRoomConnection(this.connections, {
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

  dispose(): void {
    this.runtime.dispose();
    this.connections.clear();
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
    const actors = liveRoster(this.connections);
    this.enqueue(async () => {
      this.runtime.presence(actors);
    }).catch((error: unknown) => this.runtime.report(error));
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
  private enqueue<T>(work: () => Promise<T>): Promise<T> {
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
    const base = this.tipKnown ? this.lastSeq : await this.tip();
    const entries = committedRoomEntries({
      events: args.events,
      base,
      actor: args.actor,
      ts: this.clock.now(),
    });
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
    this.runtime.update(state);
    sendCommitted({
      connections: this.connections,
      module: this.module,
      commandId: args.commandId,
      entries,
      reads: (conn) => readsHistory(conn, hasAuthority(this.connections)),
    });
    await this.applyCommittedEffects(args.effects);
  }

  /** Socket-less command (scheduler wake / host-injected); same dedup + authz + commit path. */
  injectCommand(args: {
    readonly id: string;
    readonly payload: C;
    readonly identity: Identity;
  }): Promise<void> {
    return this.enqueue(async () => {
      await this.injectSerial(args, NO_GRANTS);
    });
  }

  /** Only a host service port calls this; socket commands never receive its grant. */
  injectServiceCommand(args: {
    readonly id: string;
    readonly payload: C;
    readonly identity: Identity;
  }): Promise<RoomServiceReceipt> {
    return this.enqueue(() => this.injectSerial(args, [ROOM_SERVICE_GRANT]));
  }

  private async injectSerial(
    args: {
      readonly id: string;
      readonly payload: C;
      readonly identity: Identity;
    },
    grants: readonly string[]
  ): Promise<RoomServiceReceipt> {
    return processInjectedCommand({
      command: args,
      storage: this.storage,
      topic: this.topic,
      now: this.clock.now,
      state: () => structuredClone(this.committedState),
      authorize: (command) =>
        this.authorizeOrNull(args.identity, command, grants),
      handle: (command) =>
        this.module.handle(
          this.runtime.commandState(this.committedState),
          command,
          args.identity
        ),
      reject: (id, error) => this.reject(id, error, null),
      commit: (commit) => this.commit(commit),
    });
  }

  private commandSerial(
    connectionId: string,
    identity: Identity,
    parsed: CommandFrame
  ): Promise<void> {
    return processRoomCommand({
      connection: this.connections.get(connectionId),
      connections: this.connections,
      storage: this.storage,
      topic: this.topic,
      parsed,
      now: this.clock.now,
      view: (conn) => viewOf(this.module, conn),
      authorize: (command, grants) =>
        this.authorizeOrNull(identity, command as RoomCommand<C>, grants),
      handle: (command) =>
        this.module.handle(
          this.runtime.commandState(this.committedState),
          command as RoomCommand<C>,
          identity
        ),
      reject: (id, error, send) => this.reject(id, error, send),
      commit: (args) => this.commit(args as CommitArgs<E>),
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
    return routeRoomMessage(conn, raw, {
      sync: (fromSeq) =>
        this.enqueue(() => this.sendWelcomeSerial(connectionId, fromSeq)),
      signal: (parsed) =>
        this.enqueue(() =>
          receiveRoomSignal({
            connections: this.connections,
            connection: conn,
            command: {
              id: parsed.id,
              ts: this.clock.now(),
              payload: parsed.payload,
            },
            identity,
            now: this.clock.now,
            authorize: (command, grants) =>
              this.authorizeOrNull(identity, command as RoomCommand<C>, grants),
            handler: (command, actorIdentity, actor) =>
              this.runtime.receive(command, actorIdentity, actor),
            live: this.module.createRuntime !== undefined,
          })
        ),
      command: (parsed) =>
        this.enqueue(() => this.commandSerial(connectionId, identity, parsed)),
    });
  }
}

function noop(): void {}

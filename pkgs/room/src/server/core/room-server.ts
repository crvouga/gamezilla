import { Assert } from '@pkgs/assert';
import type { Clock } from '@pkgs/clock';
import { isMessageEnvelope } from '@pkgs/message';

import { MAX_ROSTER_SIZE } from '../../bounds';
import {
  applyRoomEffects,
  type RoomEffectHandler,
} from '../../effects/handler';
import {
  type ClientToServerWire,
  parseClientToServerWire,
  ROOM_WIRE_KIND,
  WIRE_VERSION,
} from '../../protocol/wire';
import {
  type LogEntry,
  ROOM_ERROR_TYPE,
  type RoomActor,
  type RoomCommand,
  type RoomCommandPayload,
  type RoomEffect,
  type RoomError,
  type RoomEvent,
  type RoomModule,
  type RoomState,
} from '../../types';
import { broadcastToConnections, sendWelcomeFrame } from './room-server-fanout';
import type { CommandDedupOutcome, RoomStorage } from './storage';

const crash: Assert = Assert.crash();

export type RoomServerConfig<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
  Identity,
> = {
  topic: string;
  module: RoomModule<S, C, E, Identity>;
  storage: RoomStorage;
  authorize?: (
    identity: Identity,
    topic: string,
    command: RoomCommand<C>
  ) => Promise<{ ok: true } | { ok: false; reason: string }>;
  clock: Clock;
  effectHandlers?: readonly RoomEffectHandler[];
};

type Sender = (payload: unknown) => void;

export type RoomConnection = {
  readonly id: string;
  readonly send: Sender;
  readonly actor: RoomActor;
};

type CommandFrame = Extract<
  ClientToServerWire,
  { kind: typeof ROOM_WIRE_KIND.command }
>;

type CommitArgs<E extends RoomEvent> = {
  readonly actor: RoomActor;
  readonly commandId: string;
  readonly events: E[];
  readonly effects: readonly RoomEffect[];
};

const PONG_FRAME = Object.freeze({
  v: WIRE_VERSION,
  kind: ROOM_WIRE_KIND.pong,
});

function rejectedFrame(commandId: string, error: RoomError): unknown {
  return { v: WIRE_VERSION, kind: ROOM_WIRE_KIND.rejected, commandId, error };
}

/**
 * Single-threaded authoritative room (run inside one DO or one test harness).
 *
 * All storage-touching work (commands, injects, welcome loads) rides one
 * serial chain, so the in-memory tip / state and the log never diverge and a
 * welcome always sees a consistent snapshot. The committed tip is cached
 * after hydrate, so a commit costs exactly two storage writes (log + dedup)
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
  private chain: Promise<void> = Promise.resolve();
  private committedState: S;
  private lastSeq = 0;
  private tipKnown = false;

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

  async hydrateFromStorage(): Promise<void> {
    const entries = await this.storage.loadEventsAfter(this.topic, 0);
    let state = this.module.initialState();
    for (const e of entries) {
      crash.ok(
        isMessageEnvelope(e.event),
        'Tiger: stored room events must be Message envelopes with wire-valid type',
        { event: e.event }
      );
      state = this.module.reduce(state, e.event as E);
    }
    this.committedState = state;
    this.lastSeq =
      entries.length > 0
        ? entries[entries.length - 1]!.seq
        : await this.storage.getLastSeq(this.topic);
    this.tipKnown = true;
  }

  registerConnection(
    id: string,
    send: Sender,
    actor: RoomActor,
    options?: { readonly silent?: boolean }
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
    this.connections.set(id, { id, send, actor });
    if (options?.silent !== true) this.broadcastRoster();
  }

  hasConnection(id: string): boolean {
    return this.connections.has(id);
  }

  connectionIdsForActor(actorId: string, clientId: string): readonly string[] {
    const out: string[] = [];
    for (const conn of this.connections.values()) {
      if (conn.actor.id === actorId && conn.actor.clientId === clientId) {
        out.push(conn.id);
      }
    }
    return out;
  }

  unregisterConnection(id: string): void {
    if (!this.connections.delete(id)) return;
    this.broadcastRoster();
  }

  getRoster(): readonly RoomActor[] {
    const out = new Array<RoomActor>(this.connections.size);
    let i = 0;
    for (const conn of this.connections.values()) out[i++] = conn.actor;
    return out;
  }

  broadcastRoster(): void {
    this.broadcast({
      v: WIRE_VERSION,
      kind: ROOM_WIRE_KIND.roster,
      clients: this.getRoster(),
    });
  }

  private broadcast(frame: unknown): void {
    broadcastToConnections(this.connections, frame);
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
    await sendWelcomeFrame({
      storage: this.storage,
      topic: this.topic,
      fromSeq,
      send: conn.send,
      roster: this.getRoster(),
      tip: () => this.tip(),
    });
  }

  private sendDedupReplay(
    send: Sender,
    commandId: string,
    prior: CommandDedupOutcome
  ): void {
    if (prior.kind === 'committed') {
      send({
        v: WIRE_VERSION,
        kind: ROOM_WIRE_KIND.committed,
        commandId,
        entries: prior.entries,
      });
    } else {
      send(rejectedFrame(commandId, prior.error));
    }
  }

  private async reject(
    commandId: string,
    error: RoomError,
    send: Sender | null
  ): Promise<void> {
    await this.storage.putDedupOutcome(this.topic, commandId, {
      kind: 'rejected',
      error,
    });
    if (send !== null) send(rejectedFrame(commandId, error));
  }

  private async authorizeOrNull(
    identity: Identity,
    command: RoomCommand<C>
  ): Promise<RoomError | null> {
    if (this.authorize === undefined) return null;
    const a = await this.authorize(identity, this.topic, command);
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
    await this.storage.appendCommittedEntries(this.topic, entries);
    this.lastSeq = base + entries.length;
    let state = this.committedState;
    for (let i = 0; i < entries.length; i++) {
      state = this.module.reduce(state, entries[i]!.event);
    }
    this.committedState = state;
    await this.storage.putDedupOutcome(this.topic, args.commandId, {
      kind: 'committed',
      entries,
    });
    this.broadcast({
      v: WIRE_VERSION,
      kind: ROOM_WIRE_KIND.committed,
      commandId: args.commandId,
      entries,
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
    return this.enqueue(() => this.injectSerial(args));
  }

  private async injectSerial(args: {
    readonly id: string;
    readonly payload: C;
    readonly identity: Identity;
  }): Promise<void> {
    const commandId = args.id;
    const prior = await this.storage.getDedupOutcome(this.topic, commandId);
    if (prior !== null) return;
    if (!isMessageEnvelope(args.payload)) return;
    const command: RoomCommand<C> = {
      id: commandId,
      ts: this.clock.now(),
      payload: args.payload,
    };
    const denied = await this.authorizeOrNull(args.identity, command);
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
    const prior = await this.storage.getDedupOutcome(this.topic, commandId);
    if (prior !== null) {
      this.sendDedupReplay(send, commandId, prior);
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
      ts: parsed.ts,
      payload: parsed.payload as C,
    };
    const denied = await this.authorizeOrNull(identity, command);
    if (denied !== null) {
      await this.reject(commandId, denied, send);
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

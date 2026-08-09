import { Assert } from '@pkgs/assert';
import type { Clock } from '@pkgs/clock';
import { isMessageEnvelope } from '@pkgs/message';

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
  type RoomEvent,
  type RoomModule,
  type RoomState,
} from '../../types';
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
  /** Injectable clock (required — no wall default). */
  clock: Clock;
};

type Sender = (payload: unknown) => void;

export type RoomConnection = {
  readonly id: string;
  readonly send: Sender;
  readonly actor: RoomActor;
};

/**
 * Single-threaded authoritative room (run inside one DO or one test harness).
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
  private readonly connections = new Map<string, RoomConnection>();
  private committedState: S;

  constructor(config: RoomServerConfig<S, C, E, Identity>) {
    this.topic = config.topic;
    this.module = config.module;
    this.storage = config.storage;
    this.authorize = config.authorize;
    this.clock = config.clock;
    this.committedState = config.module.initialState();
  }

  /** Load log from storage and fold into committedState (call on DO wake). */
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
    this.connections.set(id, { id, send, actor });
    if (options?.silent !== true) {
      this.broadcastRoster();
    }
  }

  /** True when `id` is already in the live connection map (hibernation restore). */
  hasConnection(id: string): boolean {
    return this.connections.has(id);
  }

  /**
   * Live connection ids for the same actor session (`id` + `clientId`).
   * Used to supersede orphaned sockets when a client reconnects.
   */
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

  /** Current connected clients (one entry per connection). */
  getRoster(): readonly RoomActor[] {
    return [...this.connections.values()].map((c) => c.actor);
  }

  /**
   * Re-broadcast the current roster without mutating connections.
   * Used after hibernation restore once all sockets are re-attached.
   */
  broadcastRoster(): void {
    this.broadcast({
      v: WIRE_VERSION,
      kind: ROOM_WIRE_KIND.roster,
      clients: this.getRoster(),
    });
  }

  private broadcast(payload: unknown): void {
    for (const conn of this.connections.values()) {
      try {
        conn.send(payload);
      } catch (err) {
        void err;
      }
    }
  }

  private sendWelcomeTo(connectionId: string, fromSeq: number): void {
    const conn = this.connections.get(connectionId);
    if (conn === undefined) return;
    const send = conn.send;
    void (async () => {
      try {
        const entries = await this.storage.loadEventsAfter(this.topic, fromSeq);
        // `lastSeq` must match the seq of the last entry the client will apply
        // after this frame (see client `onWelcomeWire`). Derive it from the
        // same `entries` tail when non-empty so a buggy or racy `getLastSeq`
        // cannot disagree with `loadEventsAfter` (e.g. two KV reads diverging).
        const lastSeqFromBatch =
          entries.length > 0 ? entries[entries.length - 1]!.seq : undefined;
        const lastSeq =
          lastSeqFromBatch !== undefined
            ? lastSeqFromBatch
            : await this.storage.getLastSeq(this.topic);
        send({
          v: WIRE_VERSION,
          kind: ROOM_WIRE_KIND.welcome,
          fromSeq,
          lastSeq,
          entries,
        });
        // Ephemeral roster snapshot alongside welcome so a freshly synced
        // client immediately knows who else is connected.
        send({
          v: WIRE_VERSION,
          kind: ROOM_WIRE_KIND.roster,
          clients: this.getRoster(),
        });
      } catch (err: unknown) {
        send({
          v: WIRE_VERSION,
          kind: ROOM_WIRE_KIND.rejected,
          commandId: '__welcome__',
          error: {
            type: ROOM_ERROR_TYPE.internal,
            reason: err instanceof Error ? err.message : String(err),
          },
        });
      }
    })();
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
      send({
        v: WIRE_VERSION,
        kind: ROOM_WIRE_KIND.rejected,
        commandId,
        error: prior.error,
      });
    }
  }

  private async authorizeCommandOrReject(
    send: Sender,
    identity: Identity,
    command: RoomCommand<C>,
    commandId: string
  ): Promise<boolean> {
    if (this.authorize === undefined) return true;
    const a = await this.authorize(identity, this.topic, command);
    if (a.ok) return true;
    const err = { type: ROOM_ERROR_TYPE.unauthorized, reason: a.reason };
    await this.storage.putDedupOutcome(this.topic, commandId, {
      kind: 'rejected',
      error: err,
    });
    send({
      v: WIRE_VERSION,
      kind: ROOM_WIRE_KIND.rejected,
      commandId,
      error: err,
    });
    return false;
  }

  private async commitCommandSuccess(
    actor: RoomActor,
    commandId: string,
    lastSeqBefore: number,
    events: E[]
  ): Promise<void> {
    crash.ok(events.length > 0, 'handle must produce events on success');
    for (const event of events) {
      crash.ok(
        isMessageEnvelope(event),
        'Tiger: room events must be Message envelopes with wire-valid type',
        { event }
      );
    }
    const ts = this.clock.now();
    const entries: LogEntry<E>[] = events.map((event, i) => ({
      seq: lastSeqBefore + i + 1,
      event,
      actor,
      ts,
    }));
    await this.storage.appendCommittedEntries(this.topic, entries);
    await this.storage.putDedupOutcome(this.topic, commandId, {
      kind: 'committed',
      entries,
    });
    for (const e of entries) {
      this.committedState = this.module.reduce(this.committedState, e.event);
    }
    this.broadcast({
      v: WIRE_VERSION,
      kind: ROOM_WIRE_KIND.committed,
      commandId,
      entries,
    });
  }

  private async handleParsedCommand(
    conn: RoomConnection,
    identity: Identity,
    parsed: Extract<ClientToServerWire, { kind: typeof ROOM_WIRE_KIND.command }>
  ): Promise<void> {
    const send = conn.send;
    const commandId = parsed.id;
    const prior = await this.storage.getDedupOutcome(this.topic, commandId);
    if (prior !== null) {
      this.sendDedupReplay(send, commandId, prior);
      return;
    }

    const lastSeqBefore = await this.storage.getLastSeq(this.topic);
    if (!isMessageEnvelope(parsed.payload)) {
      const err = {
        type: ROOM_ERROR_TYPE.invalidCommand,
        reason: 'not a valid message envelope',
      };
      await this.storage.putDedupOutcome(this.topic, commandId, {
        kind: 'rejected',
        error: err,
      });
      send({
        v: WIRE_VERSION,
        kind: ROOM_WIRE_KIND.rejected,
        commandId,
        error: err,
      });
      return;
    }

    const command: RoomCommand<C> = {
      id: commandId,
      ts: parsed.ts,
      payload: parsed.payload as C,
    };

    const ok = await this.authorizeCommandOrReject(
      send,
      identity,
      command,
      commandId
    );
    if (!ok) return;

    const result = this.module.handle(this.committedState, command, identity);
    if (!result.ok) {
      await this.storage.putDedupOutcome(this.topic, commandId, {
        kind: 'rejected',
        error: result.error,
      });
      send({
        v: WIRE_VERSION,
        kind: ROOM_WIRE_KIND.rejected,
        commandId,
        error: result.error,
      });
      return;
    }

    await this.commitCommandSuccess(
      conn.actor,
      commandId,
      lastSeqBefore,
      result.events
    );
  }

  async handleClientMessage(
    connectionId: string,
    identity: Identity,
    raw: unknown
  ): Promise<void> {
    const conn = this.connections.get(connectionId);
    if (conn === undefined) return;

    const parsed = parseClientToServerWire(raw);
    if (parsed === null) return;

    if (parsed.kind === ROOM_WIRE_KIND.ping) {
      conn.send({ v: WIRE_VERSION, kind: ROOM_WIRE_KIND.pong });
      return;
    }

    if (parsed.kind === ROOM_WIRE_KIND.sync) {
      this.sendWelcomeTo(connectionId, parsed.fromSeq);
      return;
    }

    await this.handleParsedCommand(conn, identity, parsed);
  }
}

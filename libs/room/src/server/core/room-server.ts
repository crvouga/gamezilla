import { Assert } from '@gamezilla/lib/assert';

import {
  parseClientToServerWire,
  WIRE_VERSION,
  type ClientToServerWire,
} from '../../protocol/wire';
import type { LogEntry, RoomCommand, RoomModule, RoomState } from '../../types';
import type { CommandDedupOutcome, RoomStorage } from './storage';

const crash: Assert = Assert.crash();

export type RoomServerConfig<S extends RoomState, C, E, Identity> = {
  topic: string;
  module: RoomModule<S, C, E, Identity>;
  storage: RoomStorage;
  authorize?: (
    identity: Identity,
    topic: string,
    command: RoomCommand<C>
  ) => Promise<{ ok: true } | { ok: false; reason: string }>;
};

type Sender = (payload: unknown) => void;

/**
 * Single-threaded authoritative room (run inside one DO or one test harness).
 */
export class RoomServer<S extends RoomState, C, E, Identity> {
  readonly topic: string;
  private readonly module: RoomModule<S, C, E, Identity>;
  private readonly storage: RoomStorage;
  private readonly authorize?: RoomServerConfig<S, C, E, Identity>['authorize'];
  private readonly senders = new Map<string, Sender>();
  private committedState: S;

  constructor(config: RoomServerConfig<S, C, E, Identity>) {
    this.topic = config.topic;
    this.module = config.module;
    this.storage = config.storage;
    this.authorize = config.authorize;
    this.committedState = config.module.initialState();
  }

  /** Load log from storage and fold into committedState (call on DO wake). */
  async hydrateFromStorage(): Promise<void> {
    const entries = await this.storage.loadEventsAfter(this.topic, 0);
    let state = this.module.initialState();
    for (const e of entries) {
      state = this.module.reduce(state, e.event as E);
    }
    this.committedState = state;
  }

  registerConnection(id: string, send: Sender): void {
    crash.ok(!this.senders.has(id), 'duplicate connection id', { id });
    this.senders.set(id, send);
  }

  unregisterConnection(id: string): void {
    this.senders.delete(id);
  }

  private broadcast(payload: unknown): void {
    for (const send of this.senders.values()) {
      try {
        send(payload);
      } catch (err) {
        void err;
      }
    }
  }

  private sendWelcomeTo(connectionId: string, fromSeq: number): void {
    const send = this.senders.get(connectionId);
    if (send === undefined) return;
    void Promise.all([
      this.storage.loadEventsAfter(this.topic, fromSeq),
      this.storage.getLastSeq(this.topic),
    ])
      .then(([entries, lastSeq]) => {
        send({
          v: WIRE_VERSION,
          kind: 'welcome',
          fromSeq,
          lastSeq,
          entries,
        });
      })
      .catch((err: unknown) => {
        send({
          v: WIRE_VERSION,
          kind: 'rejected',
          commandId: '__welcome__',
          error: {
            type: 'internal',
            reason: err instanceof Error ? err.message : String(err),
          },
        });
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
        kind: 'committed',
        commandId,
        entries: prior.entries,
      });
    } else {
      send({
        v: WIRE_VERSION,
        kind: 'rejected',
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
    const err = { type: 'unauthorized' as const, reason: a.reason };
    await this.storage.putDedupOutcome(this.topic, commandId, {
      kind: 'rejected',
      error: err,
    });
    send({
      v: WIRE_VERSION,
      kind: 'rejected',
      commandId,
      error: err,
    });
    return false;
  }

  private async commitCommandSuccess(
    commandId: string,
    lastSeqBefore: number,
    events: E[]
  ): Promise<void> {
    crash.ok(events.length > 0, 'handle must produce events on success');
    const entries: LogEntry<E>[] = events.map((event, i) => ({
      seq: lastSeqBefore + i + 1,
      event,
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
      kind: 'committed',
      commandId,
      entries,
    });
  }

  private async handleParsedCommand(
    send: Sender,
    identity: Identity,
    parsed: Extract<ClientToServerWire, { kind: 'command' }>
  ): Promise<void> {
    const commandId = parsed.id;
    const prior = await this.storage.getDedupOutcome(this.topic, commandId);
    if (prior !== null) {
      this.sendDedupReplay(send, commandId, prior);
      return;
    }

    const lastSeqBefore = await this.storage.getLastSeq(this.topic);
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
        kind: 'rejected',
        commandId,
        error: result.error,
      });
      return;
    }

    await this.commitCommandSuccess(commandId, lastSeqBefore, result.events);
  }

  async handleClientMessage(
    connectionId: string,
    identity: Identity,
    raw: unknown
  ): Promise<void> {
    const send = this.senders.get(connectionId);
    if (send === undefined) return;

    const parsed = parseClientToServerWire(raw);
    if (parsed === null || parsed.kind === 'ping') return;

    if (parsed.kind === 'sync') {
      this.sendWelcomeTo(connectionId, parsed.fromSeq);
      return;
    }

    await this.handleParsedCommand(send, identity, parsed);
  }
}

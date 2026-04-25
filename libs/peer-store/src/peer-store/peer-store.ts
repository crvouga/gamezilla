import { Assert } from '@gamezilla/lib/assert';
import { createMessageRouter } from '@gamezilla/lib/message';
import {
  assertCommand,
  assertLogEntryArray,
  assertSnapshot,
} from '../event-log/assert-durable-json';
import type {
  Command,
  Event,
  HandleResult,
  LogEntry,
  Message,
  PeerBootstrap,
  PeerStoreApi,
  State,
  StoreError,
  StoreModule,
  Transport,
} from '../model/types';
import {
  PeerStoreDuplicatePeer,
  PeerStoreInvalidJoinFields,
  PeerStoreInvalidJoinShape,
  PeerStoreInvalidLeaveFields,
  PeerStoreInvalidLeaveShape,
  PeerStoreInvalidTrustFields,
  PeerStoreInvalidTrustShape,
  PeerStoreJoinPeerMismatch,
  PeerStoreLeaveNotSelf,
  PeerStoreNotAuthority,
  PeerStoreNotSynced,
  PeerStoreUnknownPeer,
  PeerStoreUnknownSystemCommand,
} from '../protocol/store-errors';
import {
  PeerJoin,
  PeerJoined,
  PeerLeave,
  PeerLeft,
  peerNamespace,
  PeerTrustUpdate,
  PeerTrustUpdated,
} from '../protocol/system-messages';
import { generateId, isSystemEvent, replayDomainEntries } from '../protocol/utils';
import {
  applyMembershipEvent,
  computeAuthorityOrder,
  materializeAtSeq,
  membershipToRecord,
  rebuildMembershipFromLog,
} from './membership';
import type {
  OptimisticEvent,
  SystemCommandEvalResult,
  WireMessage,
} from './wire-protocol';

const crash: Assert = Assert.crash();
const validation: Assert = Assert.validation();

export class PeerStore implements PeerStoreApi {
  private readonly module: StoreModule;
  private readonly peerId: string;
  private readonly topic: string;
  private readonly transport: Transport;
  private readonly timeoutMs: number;
  private readonly heartbeatIntervalMs: number;
  private readonly heartbeatTimeoutMs: number;
  private readonly bootstrapKind: 'genesis' | 'join';

  private membership = new Map<string, number>();
  private authority_order: string[] = [];
  private readonly last_seen = new Map<string, number>();
  private current_authority = '';

  private readonly callbacks: {
    onTimeout?: (commandId: string) => void;
    onError?: (error: StoreError) => void;
    onSync?: () => void;
    onCommit?: (commandId: string, entries: LogEntry[]) => void;
    onReject?: (commandId: string) => void;
    onAuthorityChange?: (
      newAuthority: string,
      previousAuthority: string
    ) => void;
  };

  private committed_state: State;
  private committed_entries: LogEntry[] = [];
  /** Max global seq ever committed (survives pruning of `committed_entries`). */
  private last_committed_log_seq = 0;
  private optimistic_events: OptimisticEvent[] = [];
  /** Monotonic command counter for this peer (not global log seq). */
  private command_seq = 0;
  private is_destroyed = false;
  private sync_pending = false;
  /** Join bootstrap: false until first successful sync-response. */
  private synced: boolean;

  private readonly subscribers = new Set<(state: State) => void>();
  private readonly membership_subscribers = new Set<
    (membership: Record<string, number>) => void
  >();
  private readonly pending_timeouts = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();
  private readonly finalized_command_ids = new Set<string>();

  private readonly systemCommandRouter = createMessageRouter<
    PeerStore,
    Command,
    SystemCommandEvalResult
  >(peerNamespace)
    .on(PeerJoin, (self, command, msg) => {
      const raw: unknown = msg.payload;
      if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
        return {
          ok: false,
          error: PeerStoreInvalidJoinShape({
            detail: 'join payload must be a plain object',
          }),
        };
      }
      crash.record(raw, 'join payload must be a plain object');
      const p = raw as Record<string, unknown>;
      const peerId = p['peerId'];
      const trust = p['trust'];
      if (!peerId || typeof peerId !== 'string')
        return {
          ok: false,
          error: PeerStoreInvalidJoinFields({
            detail: 'join payload requires peerId string',
          }),
        };
      if (typeof trust !== 'number' || trust < 0 || !Number.isFinite(trust))
        return {
          ok: false,
          error: PeerStoreInvalidJoinFields({
            detail: 'join payload requires finite trust >= 0',
          }),
        };
      if (peerId !== command.peerId)
        return {
          ok: false,
          error: PeerStoreJoinPeerMismatch({
            detail: 'join peerId must match command.peerId',
          }),
        };
      if (self.membership.has(peerId))
        return { ok: false, error: PeerStoreDuplicatePeer({ peerId }) };
      return {
        ok: true,
        entries: self.allocateEntriesFromEvents([
          PeerJoined({ peerId, trust }),
        ]),
      };
    })
    .on(PeerLeave, (self, command, msg) => {
      const raw: unknown = msg.payload;
      if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
        return {
          ok: false,
          error: PeerStoreInvalidLeaveShape({
            detail: 'leave payload must be a plain object',
          }),
        };
      }
      crash.record(raw, 'leave payload must be a plain object');
      const p = raw as Record<string, unknown>;
      const peerId = p['peerId'];
      if (!peerId || typeof peerId !== 'string')
        return {
          ok: false,
          error: PeerStoreInvalidLeaveFields({
            detail: 'leave payload requires peerId',
          }),
        };
      if (peerId !== command.peerId)
        return {
          ok: false,
          error: PeerStoreLeaveNotSelf({
            detail: 'leave only allowed for self',
          }),
        };
      if (!self.membership.has(peerId))
        return { ok: false, error: PeerStoreUnknownPeer({ peerId }) };
      return {
        ok: true,
        entries: self.allocateEntriesFromEvents([PeerLeft({ peerId })]),
      };
    })
    .on(PeerTrustUpdate, (self, command, msg) => {
      const raw: unknown = msg.payload;
      if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
        return {
          ok: false,
          error: PeerStoreInvalidTrustShape({
            detail: 'trust_update payload must be a plain object',
          }),
        };
      }
      crash.record(raw, 'trust_update payload must be a plain object');
      const p = raw as Record<string, unknown>;
      const peerId = p['peerId'];
      const trust = p['trust'];
      if (!peerId || typeof peerId !== 'string')
        return {
          ok: false,
          error: PeerStoreInvalidTrustFields({
            detail: 'trust_update requires peerId',
          }),
        };
      if (typeof trust !== 'number' || trust < 0 || !Number.isFinite(trust))
        return {
          ok: false,
          error: PeerStoreInvalidTrustFields({
            detail: 'trust_update requires finite trust >= 0',
          }),
        };
      if (command.peerId !== self.current_authority)
        return {
          ok: false,
          error: PeerStoreNotAuthority({}),
        };
      if (!self.membership.has(peerId))
        return { ok: false, error: PeerStoreUnknownPeer({ peerId }) };
      return {
        ok: true,
        entries: self.allocateEntriesFromEvents([
          PeerTrustUpdated({ peerId, trust }),
        ]),
      };
    });

  private transport_unsubscribe: (() => void) | null = null;
  private connect_unsubscribe: (() => void) | null = null;
  private heartbeat_interval: ReturnType<typeof setInterval> | null = null;

  constructor(
    module: StoreModule,
    config: {
      topic: string;
      peerId: string;
      bootstrap: PeerBootstrap;
      transport: Transport;
      timeoutMs?: number;
      heartbeatIntervalMs?: number;
      heartbeatTimeoutMs?: number;
    },
    callbacks?: {
      onTimeout?: (commandId: string) => void;
      onError?: (error: StoreError) => void;
      onSync?: () => void;
      onCommit?: (commandId: string, entries: LogEntry[]) => void;
      onReject?: (commandId: string) => void;
      onAuthorityChange?: (
        newAuthority: string,
        previousAuthority: string
      ) => void;
    }
  ) {
    crash.nonEmptyString(config.topic, 'config.topic must be non-empty');
    crash.nonEmptyString(config.peerId, 'config.peerId must be non-empty');

    if (config.timeoutMs !== undefined) {
      crash.ok(config.timeoutMs > 0, 'timeoutMs must be > 0');
    }
    this.module = module;
    this.peerId = config.peerId;
    this.topic = config.topic;
    this.transport = config.transport;
    this.timeoutMs = config.timeoutMs ?? 5000;
    this.heartbeatIntervalMs = config.heartbeatIntervalMs ?? 2000;
    this.heartbeatTimeoutMs = config.heartbeatTimeoutMs ?? 6000;
    this.callbacks = callbacks ?? {};

    this.committed_state = module.initialState();
    crash.record(
      this.committed_state,
      'initialState must return a plain object'
    );

    if (config.bootstrap.kind === 'genesis') {
      this.bootstrapKind = 'genesis';
      const initial = { ...config.bootstrap.initialMembership };
      const peerIds = Object.keys(initial);
      crash.ok(
        peerIds.length >= 2,
        'genesis initialMembership must have >= 2 peers'
      );
      crash.ok(
        config.peerId in initial,
        'initialMembership must contain peerId'
      );
      for (const [id, weight] of Object.entries(initial)) {
        crash.nonEmptyString(id, 'peer id must be non-empty');
        crash.ok(weight >= 0, `trust weight for peer ${id} must be >= 0`);
      }
      this.synced = true;
      this.seedGenesisLog(initial);
    } else {
      this.bootstrapKind = 'join';
      this.synced = false;
    }

    this.rebuildAuthorityFromMembership();

    this.transport_unsubscribe = this.transport.subscribe(
      this.topic,
      (payload: unknown) => this.handleWireMessage(payload)
    );

    this.connect_unsubscribe = this.transport.onConnect(() => {
      this.requestSync();
    });

    this.heartbeat_interval = setInterval(() => {
      this.broadcastHeartbeat();
      this.checkAuthorityChange();
    }, this.heartbeatIntervalMs);

    this.broadcastHeartbeat();

    if (config.bootstrap.kind === 'join') {
      this.requestSync();
    }
  }

  private seedGenesisLog(initial: Record<string, number>): void {
    const sortedIds = Object.keys(initial).sort((a, b) => a.localeCompare(b));
    let seq = 0;
    const entries: LogEntry[] = [];
    for (const id of sortedIds) {
      seq++;
      entries.push({
        seq,
        event: PeerJoined({ peerId: id, trust: initial[id]! }),
      });
    }
    this.membership = rebuildMembershipFromLog(entries);
    this.committed_entries = entries;
    this.committed_state = replayDomainEntries(this.module, entries);
    this.last_committed_log_seq = entries[entries.length - 1]!.seq;
  }

  private rebuildAuthorityFromMembership(): void {
    const record = membershipToRecord(this.membership);
    this.authority_order = computeAuthorityOrder(record);
    this.current_authority = this.authority_order[0] ?? this.peerId;
  }

  private get latestLogSeq(): number {
    return this.last_committed_log_seq;
  }

  dispatch(message: Message): void {
    crash.ok(!this.is_destroyed, 'cannot dispatch on destroyed store');
    validation.nonEmptyString(
      message.type,
      'message.type must be non-empty string'
    );

    if (this.bootstrapKind === 'join' && !this.synced) {
      this.callbacks.onError?.(PeerStoreNotSynced({}));
      return;
    }

    const prev_cmd = this.command_seq;
    this.command_seq++;
    crash.ok(
      this.command_seq > prev_cmd,
      'command_seq must be strictly monotonically increasing'
    );

    const command: Command = {
      id: generateId(),
      seq: this.command_seq,
      peerId: this.peerId,
      message,
    };

    if (peerNamespace.owns(message)) {
      this.dispatchSystemOrDomain(command, true);
      return;
    }

    this.dispatchSystemOrDomain(command, false);
  }

  private dispatchSystemOrDomain(command: Command, isSystem: boolean): void {
    if (this.isAuthority()) {
      if (isSystem) {
        const sys = this.evaluateSystemCommand(command);
        if (!sys.ok) {
          this.callbacks.onError?.(sys.error);
          return;
        }
        this.handleCommit(command.id, sys.entries);
        const wire: WireMessage = {
          kind: 'accepted',
          commandId: command.id,
          entries: sys.entries,
        };
        this.transport.publish(this.topic, wire);
        return;
      }

      const result = this.module.handle(this.committed_state, command);
      this.assertHandleResult(result);

      if (!result.ok) {
        this.callbacks.onError?.(result.error);
        return;
      }

      crash.ok(
        result.value.events.length > 0,
        'handle must produce at least one event on success'
      );

      const entries = this.wrapDomainEventsWithSeq(result.value.events);
      this.handleCommit(command.id, entries);
      const wire: WireMessage = {
        kind: 'accepted',
        commandId: command.id,
        entries,
      };
      this.transport.publish(this.topic, wire);
    } else {
      if (isSystem) {
        const wire: WireMessage = { kind: 'propose', command };
        this.transport.publish(this.topic, wire);
        this.armTimeout(command.id);
        return;
      }

      const display_state = this.computeDisplayState();
      const result = this.module.handle(display_state, command);
      this.assertHandleResult(result);

      if (!result.ok) {
        this.callbacks.onError?.(result.error);
        return;
      }

      crash.ok(
        result.value.events.length > 0,
        'handle must produce at least one event on success'
      );

      for (const event of result.value.events) {
        this.optimistic_events.push({
          ...event,
          _commandId: command.id,
        });
      }

      const wire: WireMessage = { kind: 'propose', command };
      this.transport.publish(this.topic, wire);
      this.armTimeout(command.id);
      this.notifySubscribers();
    }
  }

  private armTimeout(commandId: string): void {
    if (this.finalized_command_ids.has(commandId)) return;
    const timeout = setTimeout(() => {
      this.pending_timeouts.delete(commandId);
      if (this.finalized_command_ids.has(commandId)) return;

      this.optimistic_events = this.optimistic_events.filter(
        (e) => e._commandId !== commandId
      );
      this.notifySubscribers();
      this.callbacks.onTimeout?.(commandId);
    }, this.timeoutMs);
    this.pending_timeouts.set(commandId, timeout);
  }

  private wrapDomainEventsWithSeq(events: Event[]): LogEntry[] {
    const out: LogEntry[] = [];
    let s = this.latestLogSeq;
    for (const event of events) {
      crash.ok(
        !isSystemEvent(event),
        'domain commit must not contain system events'
      );
      s++;
      out.push({ seq: s, event });
    }
    return out;
  }

  private evaluateSystemCommand(command: Command): SystemCommandEvalResult {
    return this.systemCommandRouter.dispatch(
      this,
      command,
      command.message,
      (_self, _cmd, msg) => ({
        ok: false,
        error: PeerStoreUnknownSystemCommand({ commandType: msg.type }),
      })
    );
  }

  private allocateEntriesFromEvents(events: Event[]): LogEntry[] {
    const entries: LogEntry[] = [];
    let s = this.latestLogSeq;
    for (const event of events) {
      s++;
      entries.push({ seq: s, event });
    }
    return entries;
  }

  proposeJoin(peerId: string, trust: number): void {
    this.dispatch(PeerJoin({ peerId, trust }));
  }

  proposeLeave(peerId: string): void {
    this.dispatch(PeerLeave({ peerId }));
  }

  proposeTrustUpdate(peerId: string, trust: number): void {
    this.dispatch(PeerTrustUpdate({ peerId, trust }));
  }

  dispatchOptimistic(event: Event): void {
    crash.ok(
      !this.is_destroyed,
      'cannot dispatchOptimistic on destroyed store'
    );
    crash.nonEmptyString(event.type, 'event.type must be non-empty string');
    crash.ok(
      !isSystemEvent(event),
      'dispatchOptimistic is for domain events only'
    );

    const new_state = this.module.reduce(this.computeDisplayState(), event);
    crash.record(new_state, 'reduce must return a plain object');

    this.optimistic_events.push({
      ...event,
      _commandId: '__optimistic__',
    });
    this.notifySubscribers();
  }

  subscribe(callback: (state: State) => void): () => void {
    crash.ok(!this.is_destroyed, 'cannot subscribe on destroyed store');
    crash.ok(typeof callback === 'function', 'callback must be a function');
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  getState(): State {
    crash.ok(!this.is_destroyed, 'cannot getState on destroyed store');
    return this.computeDisplayState();
  }

  getCommittedState(): State {
    crash.ok(!this.is_destroyed, 'cannot getCommittedState on destroyed store');
    return this.committed_state;
  }

  getCommittedEvents(): Event[] {
    crash.ok(
      !this.is_destroyed,
      'cannot getCommittedEvents on destroyed store'
    );
    return this.committed_entries
      .filter((e) => !isSystemEvent(e.event))
      .map((e) => e.event);
  }

  getCommittedLogEntries(): LogEntry[] {
    crash.ok(
      !this.is_destroyed,
      'cannot getCommittedLogEntries on destroyed store'
    );
    return [...this.committed_entries];
  }

  getMembership(): Record<string, number> {
    crash.ok(!this.is_destroyed, 'cannot getMembership on destroyed store');
    return membershipToRecord(this.membership);
  }

  subscribeMembership(
    callback: (membership: Record<string, number>) => void
  ): () => void {
    crash.ok(
      !this.is_destroyed,
      'cannot subscribeMembership on destroyed store'
    );
    crash.ok(typeof callback === 'function', 'callback must be a function');
    this.membership_subscribers.add(callback);
    return () => {
      this.membership_subscribers.delete(callback);
    };
  }

  getLatestSeq(): number {
    crash.ok(!this.is_destroyed, 'cannot getLatestSeq on destroyed store');
    return this.latestLogSeq;
  }

  requestSync(): void {
    crash.ok(!this.is_destroyed, 'cannot requestSync on destroyed store');
    this.sync_pending = true;
    const wire: WireMessage = {
      kind: 'sync-request',
      from: this.peerId,
      sinceSeq: this.latestLogSeq,
    };
    this.transport.publish(this.topic, wire);
  }

  rehydrate(entries: LogEntry[]): void {
    crash.ok(!this.is_destroyed, 'cannot rehydrate on destroyed store');
    crash.array(entries, 'entries must be an array');
    const sorted = [...entries].sort((a, b) => a.seq - b.seq);
    let prev = 0;
    for (const e of sorted) {
      validation.nonEmptyString(
        e.event.type,
        'rehydrated event must have non-empty type'
      );
      crash.ok(
        e.seq > prev,
        'rehydrate entries must have strictly increasing seq'
      );
      prev = e.seq;
    }

    this.membership = rebuildMembershipFromLog(sorted);
    this.committed_entries = [...sorted];
    this.committed_state = replayDomainEntries(this.module, sorted);
    this.optimistic_events = [];

    for (const timeout of this.pending_timeouts.values()) {
      clearTimeout(timeout);
    }
    this.pending_timeouts.clear();
    this.finalized_command_ids.clear();

    this.last_committed_log_seq =
      sorted.length > 0 ? sorted[sorted.length - 1]!.seq : 0;

    this.rebuildAuthorityFromMembership();
    this.synced = true;
    this.notifyMembershipSubscribers();
    this.notifySubscribers();
  }

  destroy(): void {
    if (this.is_destroyed) return;
    this.is_destroyed = true;

    for (const timeout of this.pending_timeouts.values()) {
      clearTimeout(timeout);
    }
    this.pending_timeouts.clear();
    this.subscribers.clear();
    this.membership_subscribers.clear();

    if (this.heartbeat_interval !== null) {
      clearInterval(this.heartbeat_interval);
      this.heartbeat_interval = null;
    }

    if (this.transport_unsubscribe) {
      this.transport_unsubscribe();
      this.transport_unsubscribe = null;
    }
    if (this.connect_unsubscribe) {
      this.connect_unsubscribe();
      this.connect_unsubscribe = null;
    }
  }

  getAuthorityPeerId(): string {
    crash.ok(
      !this.is_destroyed,
      'cannot getAuthorityPeerId on destroyed store'
    );
    return this.current_authority;
  }

  isAuthority(): boolean {
    return this.current_authority === this.peerId;
  }

  private broadcastHeartbeat(): void {
    if (this.is_destroyed) return;
    const wire: WireMessage = {
      kind: 'heartbeat',
      from: this.peerId,
      latestSeq: this.latestLogSeq,
    };
    this.transport.publish(this.topic, wire);
  }

  private checkAuthorityChange(): void {
    const newAuthority = this.deriveAuthority();
    if (newAuthority !== this.current_authority) {
      const prev = this.current_authority;
      this.current_authority = newAuthority;
      this.callbacks.onAuthorityChange?.(newAuthority, prev);
    }
  }

  private deriveAuthority(): string {
    const alive = this.authority_order.filter(
      (id) => id === this.peerId || this.isAlive(id)
    );
    return alive[0] ?? this.peerId;
  }

  private isAlive(peerId: string): boolean {
    if (peerId === this.peerId) return true;
    const lastSeen = this.last_seen.get(peerId);
    if (lastSeen === undefined) return true;
    return Date.now() - lastSeen < this.heartbeatTimeoutMs;
  }

  private updateLastSeenFromRecord(msg: Record<string, unknown>): void {
    const from = msg['from'];
    if (typeof from === 'string' && from !== this.peerId) {
      this.last_seen.set(from, Date.now());
    }
    const commandUnknown = msg['command'];
    if (
      commandUnknown !== null &&
      typeof commandUnknown === 'object' &&
      !Array.isArray(commandUnknown)
    ) {
      crash.record(commandUnknown, 'propose command must be a plain object');
      const cmdPeerId = commandUnknown['peerId'];
      if (typeof cmdPeerId === 'string' && cmdPeerId !== this.peerId) {
        this.last_seen.set(cmdPeerId, Date.now());
      }
    }
  }

  private computeDisplayState(): State {
    let state = this.committed_state;
    for (const event of this.optimistic_events) {
      if (isSystemEvent(event)) continue;
      state = this.module.reduce(state, event);
      crash.record(state, 'reduce must return a plain object');
    }
    return state;
  }

  private notifySubscribers(): void {
    if (this.is_destroyed) return;
    const state = this.computeDisplayState();
    for (const callback of [...this.subscribers]) {
      callback(state);
    }
  }

  private notifyMembershipSubscribers(): void {
    const m = membershipToRecord(this.membership);
    for (const cb of [...this.membership_subscribers]) {
      cb(m);
    }
  }

  private handleWireMessage(payload: unknown): void {
    if (this.is_destroyed) return;
    crash.record(payload, 'wire message must be an object');
    const msg = payload;
    const kindRaw = msg['kind'];
    crash.string(kindRaw, 'wire message must have a kind string');

    this.updateLastSeenFromRecord(msg);
    this.checkAuthorityChange();

    switch (kindRaw) {
      case 'propose':
        this.handlePropose(this.parseProposeWire(msg));
        break;
      case 'accepted':
        this.handleAccepted(this.parseAcceptedWire(msg));
        break;
      case 'rejected':
        this.handleRejected(this.parseRejectedWire(msg));
        break;
      case 'sync-request':
        this.handleSyncRequest(this.parseSyncRequestWire(msg));
        break;
      case 'sync-response':
        this.handleSyncResponse(this.parseSyncResponseWire(msg));
        break;
      default:
        break;
    }
  }

  private parseProposeWire(
    msg: Record<string, unknown>
  ): WireMessage & { kind: 'propose' } {
    return { kind: 'propose', command: assertCommand(msg['command']) };
  }

  private parseAcceptedWire(
    msg: Record<string, unknown>
  ): WireMessage & { kind: 'accepted' } {
    const commandId = msg['commandId'];
    crash.string(commandId, 'accepted.commandId must be a string');
    return {
      kind: 'accepted',
      commandId,
      entries: assertLogEntryArray(msg['entries']),
    };
  }

  private parseRejectedWire(
    msg: Record<string, unknown>
  ): WireMessage & { kind: 'rejected' } {
    const commandId = msg['commandId'];
    crash.string(commandId, 'rejected.commandId must be a string');
    const errObj = msg['error'];
    crash.record(errObj, 'rejected.error must be a plain object');
    const errRec = errObj as Record<string, unknown>;
    const type = errRec['type'];
    crash.string(type, 'rejected.error.type must be a string');
    validation.nonEmptyString(type, 'rejected.error.type must be non-empty');
    const rawPayload = errRec['payload'];
    const payload =
      rawPayload === undefined
        ? {}
        : rawPayload === null ||
            typeof rawPayload !== 'object' ||
            Array.isArray(rawPayload)
          ? {}
          : rawPayload;
    return { kind: 'rejected', commandId, error: { type, payload } };
  }

  private parseSyncRequestWire(
    msg: Record<string, unknown>
  ): WireMessage & { kind: 'sync-request' } {
    const from = msg['from'];
    crash.string(from, 'sync-request.from must be a string');
    const rawSince = msg['sinceSeq'];
    const sinceSeq =
      typeof rawSince === 'number' && Number.isFinite(rawSince)
        ? Math.max(0, Math.floor(rawSince))
        : 0;
    return { kind: 'sync-request', from, sinceSeq };
  }

  private parseSyncResponseWire(
    msg: Record<string, unknown>
  ): WireMessage & { kind: 'sync-response' } {
    const to = msg['to'];
    crash.string(to, 'sync-response.to must be a string');
    const baseSeqRaw = msg['baseSeq'];
    crash.number(baseSeqRaw, 'sync-response.baseSeq must be a finite number');
    const snapshot = assertSnapshot(msg['snapshot']);
    const prefixRaw = msg['prefix'];
    const prefix =
      prefixRaw === undefined ? [] : assertLogEntryArray(prefixRaw);
    return {
      kind: 'sync-response',
      to,
      snapshot,
      baseSeq: baseSeqRaw,
      prefix,
      entries: assertLogEntryArray(msg['entries']),
    };
  }

  private handlePropose(wire: WireMessage & { kind: 'propose' }): void {
    if (!this.isAuthority()) return;
    const { command } = wire;
    if (command.peerId === this.peerId) return;
    if (this.finalized_command_ids.has(command.id)) return;

    if (peerNamespace.owns(command.message)) {
      const sys = this.evaluateSystemCommand(command);
      if (sys.ok) {
        this.handleCommit(command.id, sys.entries);
        const accepted: WireMessage = {
          kind: 'accepted',
          commandId: command.id,
          entries: sys.entries,
        };
        this.transport.publish(this.topic, accepted);
      } else {
        this.finalized_command_ids.add(command.id);
        const rejected: WireMessage = {
          kind: 'rejected',
          commandId: command.id,
          error: sys.error,
        };
        this.transport.publish(this.topic, rejected);
      }
      return;
    }

    const result = this.module.handle(this.committed_state, command);

    if (result.ok) {
      const entries = this.wrapDomainEventsWithSeq(result.value.events);
      this.handleCommit(command.id, entries);
      const accepted: WireMessage = {
        kind: 'accepted',
        commandId: command.id,
        entries,
      };
      this.transport.publish(this.topic, accepted);
    } else {
      this.finalized_command_ids.add(command.id);
      const rejected: WireMessage = {
        kind: 'rejected',
        commandId: command.id,
        error: result.error,
      };
      this.transport.publish(this.topic, rejected);
    }
  }

  private handleAccepted(wire: WireMessage & { kind: 'accepted' }): void {
    const { commandId, entries } = wire;
    crash.array(entries, 'accepted must include entries array');
    this.handleCommit(commandId, entries);
  }

  private handleRejected(wire: WireMessage & { kind: 'rejected' }): void {
    const { commandId } = wire;
    if (this.finalized_command_ids.has(commandId)) return;
    this.finalized_command_ids.add(commandId);

    this.optimistic_events = this.optimistic_events.filter(
      (e) => e._commandId !== commandId
    );

    const timeout = this.pending_timeouts.get(commandId);
    if (timeout !== undefined) {
      clearTimeout(timeout);
      this.pending_timeouts.delete(commandId);
    }

    this.callbacks.onReject?.(commandId);
    this.notifySubscribers();
  }

  private handleCommit(commandId: string, entries: LogEntry[]): void {
    if (this.finalized_command_ids.has(commandId)) return;
    this.finalized_command_ids.add(commandId);

    let expectNext = this.latestLogSeq + 1;
    for (const { seq, event } of entries) {
      crash.ok(
        seq === expectNext,
        'commit entries must have consecutive global seq',
        { expectNext, got: seq }
      );
      expectNext++;
      if (isSystemEvent(event)) {
        applyMembershipEvent(this.membership, event);
      } else {
        this.committed_state = this.module.reduce(this.committed_state, event);
        crash.record(
          this.committed_state,
          'reduce must return a plain object after commit'
        );
      }
      this.committed_entries.push({ seq, event });
      this.last_committed_log_seq = seq;
    }

    this.rebuildAuthorityFromMembership();

    this.optimistic_events = this.optimistic_events.filter(
      (e) => e._commandId !== commandId
    );

    const timeout = this.pending_timeouts.get(commandId);
    if (timeout !== undefined) {
      clearTimeout(timeout);
      this.pending_timeouts.delete(commandId);
    }

    this.callbacks.onCommit?.(commandId, entries);
    this.notifyMembershipSubscribers();
    this.notifySubscribers();
  }

  private handleSyncRequest(
    wire: WireMessage & { kind: 'sync-request' }
  ): void {
    if (wire.from === this.peerId) return;
    if (!this.isAuthority()) return;

    const sinceSeq =
      typeof wire.sinceSeq === 'number' && Number.isFinite(wire.sinceSeq)
        ? Math.max(0, Math.floor(wire.sinceSeq))
        : 0;

    const snapshot = materializeAtSeq(
      this.module,
      this.committed_entries,
      sinceSeq
    );
    const prefix = this.committed_entries.filter((e) => e.seq <= sinceSeq);
    const tail = this.committed_entries.filter((e) => e.seq > sinceSeq);

    const response: WireMessage = {
      kind: 'sync-response',
      to: wire.from,
      snapshot,
      baseSeq: sinceSeq,
      prefix,
      entries: tail,
    };
    this.transport.publish(this.topic, response);
  }

  private handleSyncResponse(
    wire: WireMessage & { kind: 'sync-response' }
  ): void {
    if (wire.to !== this.peerId) return;
    if (!this.sync_pending) return;
    this.sync_pending = false;

    const baseSeq =
      typeof wire.baseSeq === 'number' && Number.isFinite(wire.baseSeq)
        ? wire.baseSeq
        : 0;
    const snap = wire.snapshot;
    crash.defined(snap, 'sync-response must include snapshot');
    crash.ok(snap.seq === baseSeq, 'snapshot.seq must equal baseSeq');

    const prefix = Array.isArray(wire.prefix) ? wire.prefix : [];
    const tail = Array.isArray(wire.entries) ? wire.entries : [];
    const full = [...prefix, ...tail].sort((a, b) => a.seq - b.seq);
    this.rehydrate(full);

    this.synced = true;
    this.callbacks.onSync?.();
  }

  private assertHandleResult(result: HandleResult): void {
    crash.defined(result, 'module.handle must return a result');
    crash.ok(
      typeof result.ok === 'boolean',
      'handle result must have ok: boolean'
    );
    if (result.ok) {
      crash.array(result.value.events, 'handle success must have events array');
    } else {
      crash.record(result.error, 'handle error must be a plain object');
      crash.nonEmptyString(
        result.error.type,
        'handle error must have non-empty type'
      );
    }
  }
}

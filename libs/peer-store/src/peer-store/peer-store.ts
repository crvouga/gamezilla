import { Assert } from '@gamezilla/lib/assert';
import type { MessageRouter } from '@gamezilla/lib/message';
import type { LogEntry } from '../peer-store-persistence/log-entry';
import type { Event, Message, StoreError } from '../protocol/message-types';
import {
  PeerStoreNotSynced,
  PeerStoreUnknownSystemCommand,
} from '../protocol/store-errors';
import {
  PeerJoined,
  peerNamespace,
} from '../protocol/system-messages';
import { generateId, isSystemEvent } from '../protocol/utils';
import type { Transport } from '../transport/transport-types';
import { assertHandleResult } from './assert-handle-result';
import { broadcastHeartbeat, checkAuthorityChange } from './authority-monitor';
import {
  computeAuthorityOrder,
  membershipToRecord,
  rebuildMembershipFromLog,
} from './membership';
import type {
  Command,
  PeerBootstrap,
  PeerStoreApi,
  State,
  StoreEffect,
  StoreModule,
} from './peer-store-types';
import { replayDomainEntries } from './replay';
import {
  createSystemCommandRouter,
  type SystemRouterContext,
} from './system-command-router';
import { handleCommitEntries, handleWireMessage } from './wire-handlers';
import type {
  OptimisticEvent,
  SystemCommandEvalResult,
  WireMessage,
} from './wire-protocol';

const crash: Assert = Assert.crash();
const validation: Assert = Assert.validation();

type PeerStoreConfig = {
  topic: string;
  peerId: string;
  bootstrap: PeerBootstrap;
  transport: Transport;
  timeoutMs?: number;
  heartbeatIntervalMs?: number;
  heartbeatTimeoutMs?: number;
};

type PeerStoreCallbacks = {
  onTimeout?: (commandId: string) => void;
  onError?: (error: StoreError) => void;
  onSync?: () => void;
  onCommit?: (
    commandId: string,
    entries: LogEntry[],
    effects?: StoreEffect[],
  ) => void;
  onReject?: (commandId: string) => void;
  onAuthorityChange?: (
    newAuthority: string,
    previousAuthority: string,
  ) => void;
};

const sharedSystemRouter: MessageRouter<
  SystemRouterContext,
  Command,
  SystemCommandEvalResult
> = createSystemCommandRouter();

export class PeerStore implements PeerStoreApi {
  readonly module: StoreModule;
  readonly peerId: string;
  readonly topic: string;
  readonly transport: Transport;
  private readonly timeoutMs: number;
  private readonly heartbeatIntervalMs: number;
  readonly heartbeatTimeoutMs: number;
  private readonly bootstrapKind: 'genesis' | 'join';

  membership = new Map<string, number>();
  authority_order: string[] = [];
  readonly last_seen = new Map<string, number>();
  current_authority = '';

  readonly callbacks: PeerStoreCallbacks;

  committed_state: State;
  committed_entries: LogEntry[] = [];
  /** Max global seq ever committed (survives pruning of `committed_entries`). */
  last_committed_log_seq = 0;
  optimistic_events: OptimisticEvent[] = [];
  /** Monotonic command counter for this peer (not global log seq). */
  private command_seq = 0;
  is_destroyed = false;
  sync_pending = false;
  /** Join bootstrap: false until first successful sync-response. */
  synced: boolean;

  private readonly subscribers = new Set<(state: State) => void>();
  readonly pending_timeouts = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();
  readonly finalized_command_ids = new Set<string>();

  private transport_unsubscribe: (() => void) | null = null;
  private connect_unsubscribe: (() => void) | null = null;
  private heartbeat_interval: ReturnType<typeof setInterval> | null = null;

  constructor(
    module: StoreModule,
    config: PeerStoreConfig,
    callbacks?: PeerStoreCallbacks,
  ) {
    validatePeerStoreConfig(config);

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
      'initialState must return a plain object',
    );

    this.bootstrapKind = config.bootstrap.kind;
    this.synced = config.bootstrap.kind === 'genesis';
    if (config.bootstrap.kind === 'genesis') {
      this.applyGenesisBootstrap(config.bootstrap.initialMembership);
    }

    this.rebuildAuthorityFromMembership();
    this.attachTransport();

    this.maybeRequestInitialSync();
  }

  private maybeRequestInitialSync(): void {
    if (this.bootstrapKind === 'join') {
      this.requestSync();
    }
  }

  authorityEvaluateDomain(
    command: Command,
  ):
    | { ok: true; entries: LogEntry[]; effects: StoreEffect[] }
    | { ok: false; error: StoreError } {
    const result = this.module.handle(this.committed_state, command);
    assertHandleResult(result);
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    crash.ok(
      result.events.length > 0,
      'handle must produce at least one event on success',
    );
    return {
      ok: true,
      entries: this.wrapDomainEventsWithSeq(result.events),
      effects: result.effects ?? [],
    };
  }

  private applyGenesisBootstrap(initialMembership: Record<string, number>): void {
    const initial = { ...initialMembership };
    const peerIds = Object.keys(initial);
    crash.ok(
      peerIds.length >= 2,
      'genesis initialMembership must have >= 2 peers',
    );
    crash.ok(this.peerId in initial, 'initialMembership must contain peerId');
    for (const [id, weight] of Object.entries(initial)) {
      crash.nonEmptyString(id, 'peer id must be non-empty');
      crash.ok(weight >= 0, `trust weight for peer ${id} must be >= 0`);
    }
    this.seedGenesisLog(initial);
  }

  private attachTransport(): void {
    this.transport_unsubscribe = this.transport.subscribe(
      this.topic,
      (payload: unknown) => handleWireMessage(this, payload),
    );
    this.connect_unsubscribe = this.transport.onConnect(() => {
      this.requestSync();
    });
    this.heartbeat_interval = setInterval(() => {
      broadcastHeartbeat(this);
      checkAuthorityChange(this);
    }, this.heartbeatIntervalMs);
    broadcastHeartbeat(this);
  }

  private seedGenesisLog(initial: Record<string, number>): void {
    const sortedIds = Object.keys(initial).sort((a, b) => a.localeCompare(b));
    const entries: LogEntry[] = sortedIds.map((id, idx) => ({
      seq: idx + 1,
      event: PeerJoined({ peerId: id, trust: initial[id]! }),
    }));
    this.membership = rebuildMembershipFromLog(entries);
    this.committed_entries = entries;
    this.committed_state = replayDomainEntries(this.module, entries);
    this.last_committed_log_seq = entries[entries.length - 1]!.seq;
  }

  rebuildAuthorityFromMembership(): void {
    const record = membershipToRecord(this.membership);
    this.authority_order = computeAuthorityOrder(record);
    this.current_authority = this.authority_order[0] ?? this.peerId;
  }

  get latestLogSeq(): number {
    return this.last_committed_log_seq;
  }

  dispatch(message: Message): void {
    crash.ok(!this.is_destroyed, 'cannot dispatch on destroyed store');
    validation.nonEmptyString(
      message.type,
      'message.type must be non-empty string',
    );

    if (this.bootstrapKind === 'join' && !this.synced) {
      this.callbacks.onError?.(PeerStoreNotSynced({}));
      return;
    }

    const prev_cmd = this.command_seq;
    this.command_seq++;
    crash.ok(
      this.command_seq > prev_cmd,
      'command_seq must be strictly monotonically increasing',
    );

    const command: Command = {
      id: generateId(),
      seq: this.command_seq,
      peerId: this.peerId,
      message,
    };

    const isSystem = peerNamespace.owns(message);
    if (this.isAuthority()) {
      this.dispatchAsAuthority(command, isSystem);
    } else {
      this.dispatchAsFollower(command, isSystem);
    }
  }

  private dispatchAsAuthority(command: Command, isSystem: boolean): void {
    if (isSystem) {
      const sys = this.evaluateSystemCommand(command);
      if (!sys.ok) {
        this.callbacks.onError?.(sys.error);
        return;
      }
      this.publishCommit(command.id, sys.entries);
      return;
    }

    const evaluated = this.authorityEvaluateDomain(command);
    if (!evaluated.ok) {
      this.callbacks.onError?.(evaluated.error);
      return;
    }
    this.publishCommit(command.id, evaluated.entries, evaluated.effects);
  }

  private publishCommit(
    commandId: string,
    entries: LogEntry[],
    effects?: StoreEffect[],
  ): void {
    handleCommitEntries(this, commandId, entries, effects);
    this.transport.publish(this.topic, {
      kind: 'accepted',
      commandId,
      entries,
    } satisfies WireMessage);
  }

  private dispatchAsFollower(command: Command, isSystem: boolean): void {
    if (isSystem) {
      this.proposeToAuthority(command);
      return;
    }

    const display_state = this.computeDisplayState();
    const result = this.module.handle(display_state, command);
    assertHandleResult(result);
    if (!result.ok) {
      this.callbacks.onError?.(result.error);
      return;
    }
    crash.ok(
      result.events.length > 0,
      'handle must produce at least one event on success',
    );
    for (const event of result.events) {
      this.optimistic_events.push({ ...event, _commandId: command.id });
    }
    this.proposeToAuthority(command);
    this.notifySubscribers();
  }

  private proposeToAuthority(command: Command): void {
    this.transport.publish(this.topic, {
      kind: 'propose',
      command,
    } satisfies WireMessage);
    this.armTimeout(command.id);
  }

  armTimeout(commandId: string): void {
    if (this.finalized_command_ids.has(commandId)) return;
    const timeout = setTimeout(() => {
      this.pending_timeouts.delete(commandId);
      if (this.finalized_command_ids.has(commandId)) return;
      this.optimistic_events = this.optimistic_events.filter(
        (e) => e._commandId !== commandId,
      );
      this.notifySubscribers();
      this.callbacks.onTimeout?.(commandId);
    }, this.timeoutMs);
    this.pending_timeouts.set(commandId, timeout);
  }

  wrapDomainEventsWithSeq(events: Event[]): LogEntry[] {
    const out: LogEntry[] = [];
    let s = this.latestLogSeq;
    for (const event of events) {
      crash.ok(
        !isSystemEvent(event),
        'domain commit must not contain system events',
      );
      s++;
      out.push({ seq: s, event });
    }
    return out;
  }

  evaluateSystemCommand(command: Command): SystemCommandEvalResult {
    const ctx: SystemRouterContext = {
      hasMember: (id) => this.membership.has(id),
      isAuthority: (id) => id === this.current_authority,
      allocateEntriesFromEvents: (events) => this.allocateEntriesBySeq(events),
    };
    return sharedSystemRouter.dispatch(ctx, command, command.message, (_c, _cmd, m) => ({
      ok: false,
      error: PeerStoreUnknownSystemCommand({ commandType: m.type }),
    }));
  }

  private allocateEntriesBySeq(events: Event[]): LogEntry[] {
    const entries: LogEntry[] = [];
    let s = this.latestLogSeq;
    for (const event of events) {
      s++;
      entries.push({ seq: s, event });
    }
    return entries;
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

  getCommittedLogEntries(): LogEntry[] {
    crash.ok(
      !this.is_destroyed,
      'cannot getCommittedLogEntries on destroyed store',
    );
    return [...this.committed_entries];
  }

  requestSync(): void {
    crash.ok(!this.is_destroyed, 'cannot requestSync on destroyed store');
    this.sync_pending = true;
    this.transport.publish(this.topic, {
      kind: 'sync-request',
      from: this.peerId,
      sinceSeq: this.latestLogSeq,
    } satisfies WireMessage);
  }

  rehydrate(entries: LogEntry[]): void {
    crash.ok(!this.is_destroyed, 'cannot rehydrate on destroyed store');
    crash.array(entries, 'entries must be an array');
    const sorted = [...entries].sort((a, b) => a.seq - b.seq);
    let prev = 0;
    for (const e of sorted) {
      validation.nonEmptyString(
        e.event.type,
        'rehydrated event must have non-empty type',
      );
      crash.ok(
        e.seq > prev,
        'rehydrate entries must have strictly increasing seq',
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
      'cannot getAuthorityPeerId on destroyed store',
    );
    return this.current_authority;
  }

  isAuthority(): boolean {
    return this.current_authority === this.peerId;
  }

  computeDisplayState(): State {
    let state = this.committed_state;
    for (const event of this.optimistic_events) {
      if (isSystemEvent(event)) continue;
      state = this.module.reduce(state, event);
      crash.record(state, 'reduce must return a plain object');
    }
    return state;
  }

  notifySubscribers(): void {
    if (this.is_destroyed) return;
    const state = this.computeDisplayState();
    for (const callback of [...this.subscribers]) {
      callback(state);
    }
  }

}

function validatePeerStoreConfig(config: PeerStoreConfig): void {
  crash.nonEmptyString(config.topic, 'config.topic must be non-empty');
  crash.nonEmptyString(config.peerId, 'config.peerId must be non-empty');
  if (config.timeoutMs !== undefined) {
    crash.ok(config.timeoutMs > 0, 'timeoutMs must be > 0');
  }
}

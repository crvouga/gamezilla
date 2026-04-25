import { Assert } from '@gamezilla/lib/assert';
import type { MessageRouter } from '@gamezilla/lib/message';
import type { LogEntry } from '../persistence/log-entry';
import type { Event, Message, StoreError } from '../events/message-types';
import {
  PeerStoreNotSynced,
  PeerStoreUnknownSystemCommand,
} from '../events/store-errors';
import { PeerJoin, peerNamespace } from '../events/system-messages';
import { generateId, isSystemEvent } from '../events/utils';
import type { Transport } from '../transport/transport-types';
import { assertHandleResult } from './assert-handle-result';
import { broadcastHeartbeat, checkAuthorityChange } from './authority-monitor';
import { computeAuthorityOrder, membershipToRecord } from './membership';
import { randomBytes } from './security/peer-crypto';
import {
  signWireEnvelope,
  verifyWireEnvelope,
  type VerifiedWireEnvelope,
} from './security/wire-envelope';
import type {
  Command,
  PeerStoreApi,
  PeerStoreRoomConfig,
  PeerStoreSecurityConfig,
  State,
  StoreEffect,
  StoreModule,
} from './types';
import { normalizePeerStoreInit } from './normalize-init';
import { runPeerStoreConstructorBootstrap } from './constructor-bootstrap';
import { applyRehydrateCommittedEntries } from './rehydrate';
import {
  finalizeInboundWireVerification,
} from './authorize-inbound';
import {
  createSystemCommandRouter,
  type SystemRouterContext,
} from './system-command-router';
import {
  authorityAcceptCommit,
  handleWireMessage,
} from './wire-handlers';
import type {
  OptimisticEvent,
  SystemCommandEvalResult,
  WireMessage,
} from './wire-protocol';

const crash: Assert = Assert.crash();
const validation: Assert = Assert.validation();

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
  /** Cryptographic verification failed for an inbound wire envelope. */
  onWireAuthFailure?: (reason: string) => void;
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
  readonly security: PeerStoreSecurityConfig;
  private readonly timeoutMs: number;
  private readonly heartbeatIntervalMs: number;
  readonly heartbeatTimeoutMs: number;
  readonly bootstrapKind: 'genesis' | 'join';

  membership = new Map<string, number>();
  authority_order: string[] = [];
  readonly last_seen = new Map<string, number>();
  current_authority = '';

  readonly callbacks: PeerStoreCallbacks;

  /** Join bootstrap only: genesis view for auth + authority until `synced`. */
  private readonly joinGenesis:
    | {
        initialMembership: Record<string, number>
        initialMemberPublicKeys: Record<string, string>
      }
    | null = null;

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

  /** Known Ed25519 public keys for members (from genesis or replicated log). */
  readonly memberPublicKeys = new Map<string, Uint8Array>();
  /** Last accepted inbound wire counter per remote signer. */
  readonly inboundWireCounters = new Map<string, number>();
  outboundWireCounter = 0;
  /** Active sync session id (requester only). */
  pendingSyncSessionId: string | null = null;

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
    config: PeerStoreRoomConfig,
    callbacks?: PeerStoreCallbacks,
  ) {
    const resolved = normalizePeerStoreInit(config);

    this.module = module;
    this.peerId = resolved.peerId;
    this.topic = resolved.topic;
    this.transport = resolved.transport;
    this.security = resolved.security;
    this.timeoutMs = resolved.timeoutMs ?? 5000;
    this.heartbeatIntervalMs = resolved.heartbeatIntervalMs ?? 2000;
    this.heartbeatTimeoutMs = resolved.heartbeatTimeoutMs ?? 6000;
    this.callbacks = callbacks ?? {};

    const boot = runPeerStoreConstructorBootstrap(
      module,
      {
        peerId: resolved.peerId,
        bootstrap: resolved.bootstrap,
        security: this.security,
      },
      this.memberPublicKeys,
      this.last_seen,
    );
    this.bootstrapKind = boot.bootstrapKind;
    this.synced = boot.synced;
    this.joinGenesis = boot.joinGenesis;
    this.membership = boot.membership;
    this.committed_entries = boot.committed_entries;
    this.committed_state = boot.committed_state;
    this.last_committed_log_seq = boot.last_committed_log_seq;

    this.rebuildAuthorityFromMembership();
    this.attachTransport();

    this.maybeRequestInitialSync();
  }

  private maybeRequestInitialSync(): void {
    if (this.bootstrapKind === 'join') {
      this.requestSync();
    }
  }

  /** Publish a signed wire envelope (all outbound store traffic must use this). */
  publishSignedWire(body: WireMessage): void {
    crash.ok(!this.is_destroyed, 'cannot publish on destroyed store');
    this.outboundWireCounter += 1;
    const env = signWireEnvelope({
      topic: this.topic,
      roomSecret: this.security.roomSecret,
      body,
      signerPeerId: this.peerId,
      secretSeed: this.security.secretSeed,
      counter: this.outboundWireCounter,
    });
    this.transport.publish(this.topic, env);
  }

  /**
   * Verify inbound signed envelope; updates `inboundWireCounters` on success.
   * Returns null on failure (invokes `onWireAuthFailure`).
   */
  verifyInboundWire(raw: unknown): VerifiedWireEnvelope | null {
    const vr = verifyWireEnvelope({
      topic: this.topic,
      roomSecret: this.security.roomSecret,
      raw,
      lastCounters: this.inboundWireCounters,
    });
    if (!('signerPublicKey' in vr)) {
      this.callbacks.onWireAuthFailure?.(vr.reason);
      return null;
    }
    return finalizeInboundWireVerification(
      {
        security: this.security,
        memberPublicKeys: this.memberPublicKeys,
        current_authority: this.current_authority,
        inboundWireCounters: this.inboundWireCounters,
        ...(this.callbacks.onWireAuthFailure !== undefined
          ? { onWireAuthFailure: this.callbacks.onWireAuthFailure }
          : {}),
      },
      vr,
    );
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

  rebuildAuthorityFromMembership(): void {
    const record =
      this.joinGenesis !== null && this.bootstrapKind === 'join' && !this.synced
        ? this.joinGenesis.initialMembership
        : membershipToRecord(this.membership);
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

    const allowJoinBeforeSync =
      this.bootstrapKind === 'join' &&
      !this.synced &&
      PeerJoin.is(message);

    if (this.bootstrapKind === 'join' && !this.synced && !allowJoinBeforeSync) {
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
    authorityAcceptCommit(this, commandId, entries, effects);
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
    this.publishSignedWire({
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
    const syncSessionId = randomBytes(16).toString('hex');
    this.pendingSyncSessionId = syncSessionId;
    this.publishSignedWire({
      kind: 'sync-request',
      from: this.peerId,
      sinceSeq: this.latestLogSeq,
      syncSessionId,
    } satisfies WireMessage);
  }

  rehydrate(entries: LogEntry[]): void {
    crash.ok(!this.is_destroyed, 'cannot rehydrate on destroyed store');
    applyRehydrateCommittedEntries(this, entries);
  }

  isSynced(): boolean {
    crash.ok(!this.is_destroyed, 'cannot query sync state on destroyed store');
    return this.synced;
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

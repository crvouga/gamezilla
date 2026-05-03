import type { LogEntry } from '../persistence/log-entry';
import type { RoomPersistence } from '../persistence/persistence';
import type { Event, Message, RoomError } from '../events/message-types';
import type { Transport } from '../transport/transport-types';

export type Command = {
  id: string;
  seq: number;
  peerId: string;
  message: Message;
};

/**
 * Plain serializable object used as reducer state.
 *
 * INTENTIONAL: `Record<string, unknown>` — not a generic app state type.
 * Modules parse/validate fields at runtime. Optional `snapshotState` /
 * `restoreState` on `RoomModule` can serialize a custom blob for sync.
 */
export type State = Record<string, unknown>;

/** Host-interpreted intent emitted after a successful committed command. */
export type RoomEffect = Message;

export type HandleResult =
  | { ok: true; events: Event[]; effects?: RoomEffect[] }
  | { ok: false; error: RoomError };

export type RoomModule = {
  initialState(): State;
  handle(state: State, command: Command): HandleResult;
  reduce(state: State, event: Event): State;
  /** Optional: custom snapshot for incremental sync (defaults to JSON-safe state clone). */
  snapshotState?(state: State): unknown;
  /** Optional: restore from `snapshotState` output (defaults to `state as State`). */
  restoreState?(snapshot: unknown): State;
};

/**
 * In-memory compaction boundary: domain state + membership after `seq`.
 */
export type Snapshot = {
  /** Last included global log sequence. */
  seq: number;
  /** Domain state after replaying domain events with seq <= this.seq. */
  domainState: State;
  /** Trust weights after applying all log entries with seq <= this.seq. */
  membership: Record<string, number>;
};

export type PeerBootstrap =
  | {
      kind: 'genesis';
      /** At least two members required for quorum-style authority. */
      initialMembership: Record<string, number>;
      /**
       * Base64url-encoded 32-byte Ed25519 public keys for every peer in
       * `initialMembership` (must match self-certifying `peerId` keys).
       */
      initialMemberPublicKeys: Record<string, string>;
    }
  | {
      kind: 'join';
      /**
       * Genesis membership + keys for the room **before** this peer's join.
       * Required to verify signed `accepted` / `sync-response` and to know
       * `current_authority` until the log is hydrated from sync.
       */
      initialMembership: Record<string, number>;
      initialMemberPublicKeys: Record<string, string>;
    };

/** Cryptographic session binding for all wire traffic on this topic. */
export type RoomSecurityConfig = {
  roomSecret: string;
  /** 32-byte Ed25519 secret seed (must match `peerId` derived public key). */
  secretSeed: Uint8Array;
  /** Optional: require fingerprintFromPublicKey(pub) to match per peerId. */
  peerFingerprints?: Record<string, string>;
};

export type RoomRoleHost = {
  type: 'host';
  initialMembership: Record<string, number>;
  initialMemberPublicKeys: Record<string, string>;
};

export type RoomRoleJoin = {
  type: 'join';
  /** Genesis membership + keys for the room before this peer appears in the log. */
  roomSnapshot: {
    initialMembership: Record<string, number>;
    initialMemberPublicKeys: Record<string, string>;
  };
};

/**
 * Room + transport + persistence only (no `module` / lifecycle callbacks).
 * `peerId` is derived from `secretSeed` (self-certifying).
 */
export type RoomConfigCore = {
  topic: string;
  roomSecret: string;
  secretSeed: Uint8Array;
  transport: Transport;
  persistence: RoomPersistence;
  role: RoomRoleHost | RoomRoleJoin;
  timeoutMs?: number;
  heartbeatIntervalMs?: number;
  heartbeatTimeoutMs?: number;
  peerFingerprints?: Record<string, string>;
};

export type RoomCallbacks = {
  onTimeout?: (commandId: string) => void;
  onError?: (error: RoomError) => void;
  onSync?: () => void;
  onCommit?: (
    commandId: string,
    entries: LogEntry[],
    effects?: RoomEffect[]
  ) => void;
  onReject?: (commandId: string) => void;
  onAuthorityChange?: (newAuthority: string, previousAuthority: string) => void;
  /** Cryptographic verification failed for an inbound wire envelope. */
  onWireAuthFailure?: (reason: string) => void;
  /** Async persistence append failed (hot path uses fire-and-forget). */
  onPersistenceError?: (err: unknown) => void;
};

/**
 * Full {@link Room} instantiation: {@link RoomConfigCore} plus `module`,
 * optional callbacks, and optional persistence recovery hook for {@link Room.create}.
 */
export type RoomConfig = RoomConfigCore &
  RoomCallbacks & {
    module: RoomModule;
    /** Used only by {@link Room.create}: journal command rows with no outcome. */
    onUnresolvedPersistenceCommand?: (command: Command) => void;
  };

/** Normalized internal shape after validation. */
export type NormalizedRoomInit = {
  topic: string;
  peerId: string;
  bootstrap: PeerBootstrap;
  transport: Transport;
  persistence: RoomPersistence;
  security: RoomSecurityConfig;
  timeoutMs?: number;
  heartbeatIntervalMs?: number;
  heartbeatTimeoutMs?: number;
};

export interface RoomApi {
  dispatch(message: Message): void;
  subscribe(callback: (state: State) => void): () => void;
  getState(): State;
  getCommittedState(): State;
  /** Full replicated log rows (system + domain). */
  getCommittedLogEntries(): LogEntry[];
  requestSync(): void;
  rehydrate(entries: LogEntry[]): void;
  destroy(): void;
  /** Join bootstrap: false until first successful `sync-response`. */
  isSynced(): boolean;
}

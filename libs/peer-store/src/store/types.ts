import type { LogEntry } from '../persistence/log-entry'
import type { Event, Message, StoreError } from '../events/message-types'
import type { Transport } from '../transport/transport-types'

export type Command = {
  id: string
  seq: number
  peerId: string
  message: Message
}

/**
 * Plain serializable object used as reducer state.
 *
 * INTENTIONAL: `Record<string, unknown>` — not a generic app state type.
 * Modules parse/validate fields at runtime. Optional `snapshotState` /
 * `restoreState` on `StoreModule` can serialize a custom blob for sync.
 */
export type State = Record<string, unknown>

/** Host-interpreted intent emitted after a successful committed command. */
export type StoreEffect = Message

export type HandleResult =
  | { ok: true; events: Event[]; effects?: StoreEffect[] }
  | { ok: false; error: StoreError }

export type StoreModule = {
  initialState(): State
  handle(state: State, command: Command): HandleResult
  reduce(state: State, event: Event): State
  /** Optional: custom snapshot for incremental sync (defaults to JSON-safe state clone). */
  snapshotState?(state: State): unknown
  /** Optional: restore from `snapshotState` output (defaults to `state as State`). */
  restoreState?(snapshot: unknown): State
}

/**
 * In-memory compaction boundary: domain state + membership after `seq`.
 */
export type Snapshot = {
  /** Last included global log sequence. */
  seq: number
  /** Domain state after replaying domain events with seq <= this.seq. */
  domainState: State
  /** Trust weights after applying all log entries with seq <= this.seq. */
  membership: Record<string, number>
}

export type PeerBootstrap =
  | {
      kind: 'genesis'
      /** At least two members required for quorum-style authority. */
      initialMembership: Record<string, number>
      /**
       * Base64url-encoded 32-byte Ed25519 public keys for every peer in
       * `initialMembership` (must match self-certifying `peerId` keys).
       */
      initialMemberPublicKeys: Record<string, string>
    }
  | {
      kind: 'join'
      /**
       * Genesis membership + keys for the room **before** this peer's join.
       * Required to verify signed `accepted` / `sync-response` and to know
       * `current_authority` until the log is hydrated from sync.
       */
      initialMembership: Record<string, number>
      initialMemberPublicKeys: Record<string, string>
    }

/** Cryptographic session binding for all wire traffic on this topic. */
export type PeerStoreSecurityConfig = {
  roomSecret: string
  /** 32-byte Ed25519 secret seed (must match `peerId` derived public key). */
  secretSeed: Uint8Array
  /** Optional: require fingerprintFromPublicKey(pub) to match per peerId. */
  peerFingerprints?: Record<string, string>
}

export type PeerStoreRoomRoleHost = {
  type: 'host'
  initialMembership: Record<string, number>
  initialMemberPublicKeys: Record<string, string>
}

export type PeerStoreRoomRoleJoin = {
  type: 'join'
  /** Genesis membership + keys for the room before this peer appears in the log. */
  roomSnapshot: {
    initialMembership: Record<string, number>
    initialMemberPublicKeys: Record<string, string>
  }
}

/**
 * Constructor config: `peerId` is derived from `secretSeed` (self-certifying).
 */
export type PeerStoreRoomConfig = {
  topic: string
  roomSecret: string
  secretSeed: Uint8Array
  transport: Transport
  role: PeerStoreRoomRoleHost | PeerStoreRoomRoleJoin
  timeoutMs?: number
  heartbeatIntervalMs?: number
  heartbeatTimeoutMs?: number
  peerFingerprints?: Record<string, string>
}

/** @deprecated Use {@link PeerStoreRoomConfig} — alias kept for short-term migration. */
export type PeerStoreInitConfig = PeerStoreRoomConfig

/** Normalized internal shape after validation. */
export type NormalizedPeerStoreInit = {
  topic: string
  peerId: string
  bootstrap: PeerBootstrap
  transport: Transport
  security: PeerStoreSecurityConfig
  timeoutMs?: number
  heartbeatIntervalMs?: number
  heartbeatTimeoutMs?: number
}

export interface PeerStoreApi {
  dispatch(message: Message): void
  subscribe(callback: (state: State) => void): () => void
  getState(): State
  getCommittedState(): State
  /** Full replicated log rows (system + domain). */
  getCommittedLogEntries(): LogEntry[]
  requestSync(): void
  rehydrate(entries: LogEntry[]): void
  destroy(): void
  /** Join bootstrap: false until first successful `sync-response`. */
  isSynced(): boolean
}

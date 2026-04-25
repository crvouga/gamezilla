import type { LogEntry } from '../peer-store-persistence/log-entry'
import type { Event, Message, StoreError } from '../protocol/message-types'

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
    }
  | { kind: 'join' }

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
}

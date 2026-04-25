/**
 * User-facing message envelope.
 *
 * INTENTIONAL: `payload` is `unknown` (not a generic). Consumers are expected to
 * narrow/validate at the boundary (e.g. in `StoreModule.handle`). This keeps
 * the transport/store layer transport-agnostic and avoids misleading TS
 * inference for LLMs/agents — validation lives in application code.
 */
export type Message = {
  type: string;
  payload: unknown;
};

export type Command = {
  id: string;
  seq: number;
  peerId: string;
  message: Message;
};

/**
 * Domain or system event.
 *
 * INTENTIONAL: `payload` is `unknown`. System events use reserved `type`
 * prefixes such as `_peer/...` and are handled inside `PeerStore`, not passed
 * to `StoreModule.reduce`. Domain events must be validated in `reduce`.
 */
export type Event = {
  type: string;
  payload: unknown;
};

/**
 * Plain serializable object used as reducer state.
 *
 * INTENTIONAL: `Record<string, unknown>` — not a generic app state type.
 * Modules parse/validate fields at runtime. Optional `snapshotState` /
 * `restoreState` on `StoreModule` can serialize a custom blob for sync.
 */
export type State = Record<string, unknown>;

export type StoreError = {
  code: string;
  message: string;
};

export type HandleResult =
  | { ok: true; value: { events: Event[] } }
  | { ok: false; error: StoreError };

export type StoreModule = {
  initialState(): State;
  handle(state: State, command: Command): HandleResult;
  reduce(state: State, event: Event): State;
  /** Optional: custom snapshot for incremental sync (defaults to JSON-safe state clone). */
  snapshotState?(state: State): unknown;
  /** Optional: restore from `snapshotState` output (defaults to `state as State`). */
  restoreState?(snapshot: unknown): State;
};

/**
 * One committed row in the replicated log (global `seq`, monotonic per space).
 * May be a system event (`_peer/...`) or a domain event.
 */
export type LogEntry = {
  seq: number;
  event: Event;
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
    }
  | { kind: 'join' };

export interface PeerStoreApi {
  dispatch(message: Message): void;
  dispatchOptimistic(event: Event): void;
  subscribe(callback: (state: State) => void): () => void;
  getState(): State;
  getCommittedState(): State;
  /** Domain events only (excludes `_peer/...` system events). */
  getCommittedEvents(): Event[];
  /** Full replicated log rows (system + domain). */
  getCommittedLogEntries(): LogEntry[];
  getMembership(): Record<string, number>;
  subscribeMembership(
    callback: (membership: Record<string, number>) => void
  ): () => void;
  /** Latest global log sequence committed locally (0 if none). */
  getLatestSeq(): number;
  proposeJoin(peerId: string, trust: number): void;
  proposeLeave(peerId: string): void;
  proposeTrustUpdate(peerId: string, trust: number): void;
  rehydrate(entries: LogEntry[]): void;
  requestSync(): void;
  destroy(): void;
}

export interface Transport {
  publish(topic: string, payload: unknown, options?: { qos?: 0 | 1 }): void;
  subscribe(topic: string, handler: (payload: unknown) => void): () => void;
  onConnect(handler: () => void): () => void;
  destroy(): void;
}

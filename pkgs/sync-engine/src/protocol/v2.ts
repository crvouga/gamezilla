/**
 * Wire protocol v3 — hard cut from v2.
 *
 * Same query/mutation/push envelopes as v2; domain row managed columns are
 * `id` / `created_at` / `updated_at` / `deleted_at` (no underscore prefix).
 * Version gate rejects pre-cut clients with
 * `{ error: 'auth', reason: 'upgrade_required' }` (no local DB wipe).
 */

/** Protocol major version. */
export const SYNC_PROTOCOL_VERSION = 3 as const;

/** Max mutation rows accepted per POST /mutations. */
export const MAX_MUTATIONS_BATCH = 64;

/** Max total rows in a push `rows` payload before falling back to wake-only. */
export const MAX_FANOUT_ROWS = 64;

/** Max serialized JSON bytes for push `rows` before falling back to wake-only. */
export const MAX_FANOUT_BYTES = 32 * 1024;

/** Max queries per POST /query batch. */
export const MAX_QUERY_BATCH = 64;

/** One domain row on the wire (incl. `deleted_at` when present). */
export type QueryRow = Record<string, unknown>;

/** One item in `POST /query` `{ queries: [...] }`. */
export type QueryRequestItem = {
  readonly name: string;
  readonly params: Readonly<Record<string, unknown>>;
  /** Opaque content hash from a prior `ok` response; equality ⇒ `not_modified`. */
  readonly lastHash?: string | undefined;
  readonly checkpoint?: string | undefined;
};

export type QueryBatchRequest = {
  readonly queries: readonly QueryRequestItem[];
};

/**
 * Exactly three response shapes. Removed forever unless redesign:
 * `mode: 'delta'|'full'`, `resync`, `gone`.
 */
export type QueryResponse =
  | {
      readonly status: 'ok';
      readonly checkpoint: string;
      /** Opaque content hash; algorithm is Internal (equality only on the wire). */
      readonly hash: string;
      readonly tables: Readonly<Record<string, readonly QueryRow[]>>;
    }
  | { readonly status: 'not_modified' }
  | { readonly status: 'denied' };

export type QueryBatchResponse = {
  readonly responses: readonly QueryResponse[];
};

/** One item in `POST /mutations` `{ mutations: [...] }`. */
export type MutationRequestItem = {
  readonly id: string;
  readonly name: string;
  /** JSON string of mutation args. */
  readonly args: string;
  readonly clientId: string;
  readonly seq: number;
  readonly createdAt: string;
};

export type MutationBatchRequest = {
  readonly mutations: readonly MutationRequestItem[];
};

export type MutationVerdict =
  | { readonly mutationId: string; readonly status: 'applied' }
  | {
      readonly mutationId: string;
      readonly status: 'rejected';
      readonly code: string;
      readonly message: string;
    };

export type MutationBatchResponse = {
  readonly ok: true;
  readonly verdicts: MutationVerdict[];
  readonly ackSeq: number;
  /**
   * Per-topic pushSeqs for this batch. Mutating client floors local applied
   * seq so own echoed fanout is skipped.
   */
  readonly topicPushSeqs?: Readonly<Record<string, string>>;
};

export type AuthErrorBody = {
  readonly error: 'auth';
  readonly reason: 'expired' | 'revoked' | 'upgrade_required';
};

/**
 * Pubsub push payload. `pushSeq` required and monotonic per topic.
 * Optional `rows` are a lossy optimization; snapshots define correctness.
 * `tables` comes from captured writes (AST), not hand declarations.
 *
 * `checkpoint` is the query-checkpoint allocator value minted after the
 * replay committed. Clients that already hold this push's writes raise the
 * affected scopes' `last_checkpoint` to it so an in-flight snapshot that was
 * read before the replay cannot overwrite them.
 */
export type PushMessage = {
  readonly pushSeq: string;
  readonly optimistic?: true;
  readonly tables?: readonly string[];
  readonly rows?: Readonly<Record<string, readonly QueryRow[]>>;
  readonly checkpoint?: string;
};

/** Header / body field clients send; server rejects mismatch. */
export const SYNC_PROTOCOL_HEADER = 'x-sync-protocol';

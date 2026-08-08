/**
 * Frozen wire protocol. Prefer importing via `@pkgs/sync-engine/shared`.
 * Do not change shapes without a version bump.
 */
export {
  type AuthErrorBody,
  MAX_FANOUT_BYTES,
  MAX_FANOUT_ROWS,
  MAX_MUTATIONS_BATCH,
  MAX_QUERY_BATCH,
  type MutationBatchRequest,
  type MutationBatchResponse,
  type MutationRequestItem,
  type MutationVerdict,
  type PushMessage,
  type QueryBatchRequest,
  type QueryBatchResponse,
  type QueryRequestItem,
  type QueryResponse,
  type QueryRow,
  SYNC_PROTOCOL_HEADER,
  SYNC_PROTOCOL_VERSION,
} from './v2';

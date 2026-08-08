/**
 * Public shared surface for `@pkgs/sync-engine` (runtime-agnostic).
 * Import from `@pkgs/sync-engine/shared` only — deep paths are not public.
 */

export { defineMutation } from '../mutations/core/define-mutation';
export { mutationRegistry } from '../mutations/core/registry';
export {
  type MutateResult,
  type Mutation,
  type MutationCtx,
  type MutationDb,
  type MutationEnv,
  MutationError,
  type MutationRegistry,
} from '../mutations/core/types';
export {
  LIVE_ROW_SQL,
  softDeleteById,
} from '../mutations/shared/soft-delete';
/** Frozen wire protocol v1 (shapes + bounds). */
export {
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
  SYNC_PROTOCOL_VERSION,
} from '../protocol';
export { defineQuery } from '../queries/core/define-query';
export { queryRegistry } from '../queries/core/registry';
export type {
  AuthErrorBody,
  QueryCtx,
  QueryDef,
  QueryRegistry,
  QueryResponse,
  QueryRow,
} from '../queries/core/types';

export { applyFrameworkServerDdl } from './apply-framework-server-ddl';
export { assertDomainTablesAvoidFrameworkNames } from './assert-domain-tables';
export {
  assertChannelExhaustiveness,
  type ChannelGap,
  findChannelExhaustivenessGaps,
} from './channel-exhaustiveness';

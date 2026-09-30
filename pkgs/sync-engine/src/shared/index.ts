/**
 * Public shared surface for `@pkgs/sync-engine` (runtime-agnostic).
 * Import from `@pkgs/sync-engine/shared` only — deep paths are not public.
 */

export { defineMutation } from '../mutations/core/define-mutation';
export { mutationRegistry } from '../mutations/core/registry';
export {
  type MutateResult,
  type Mutation,
  type MutationAuthorize,
  type MutationAuthorizeCtx,
  type MutationCtx,
  type MutationDb,
  type MutationEnv,
  MutationError,
  type MutationRegistry,
} from '../mutations/core/types';
export {
  type ManagedInsertColumns,
  managedInsertColumns,
  managedUpdatedAtIso,
} from '../mutations/shared/managed-columns';
export {
  LIVE_ROW_SQL,
  softDeleteById,
} from '../mutations/shared/soft-delete';
export { wrapMutationDb } from '../mutations/shared/wrap-mutation-db';
/** Frozen wire protocol (shapes + bounds). */
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
  SYNC_PROTOCOL_HEADER,
  SYNC_PROTOCOL_VERSION,
} from '../protocol';
export {
  defineQuery,
  resolveQueryHydrates,
} from '../queries/core/define-query';
export { queryRegistry } from '../queries/core/registry';
export {
  type AuthErrorBody,
  DEFAULT_QUERY_LIMIT,
  type QueryCtx,
  type QueryDef,
  type QueryDefInput,
  type QueryRegistry,
  type QueryResponse,
  type QueryRow,
} from '../queries/core/types';

export { applyFrameworkServerDdl } from './apply-framework-server-ddl';
export { assertDomainTablesAvoidFrameworkNames } from './assert-domain-tables';
export {
  assertChannelExhaustiveness,
  type ChannelGap,
  findChannelExhaustivenessGaps,
} from './channel-exhaustiveness';
export {
  type AssertQueryRegistryIndexableOpts,
  assertQueryRegistryIndexable,
  type EnvFixture,
  extractQueryTables,
  extractWorkload,
} from './extract-workload';
export {
  FRAMEWORK_CACHE_TABLE_NAMES,
  FRAMEWORK_DURABLE_TABLE_NAMES,
  FRAMEWORK_TABLE_NAMES,
  SYNC_ENGINE_MUTATIONS,
  SYNC_ENGINE_MUTATIONS_APPLIED,
  SYNC_ENGINE_PUSH_APPLIED,
  SYNC_ENGINE_SCOPE_META,
  SYNC_ENGINE_TOPIC_SEQ,
  SYNC_ENGINE_WRITE_REJECTIONS,
} from './framework-server-ddl';
export {
  FRAMEWORK_TOPIC_MAP,
  withFrameworkTopicMap,
} from './framework-topic-map';
export {
  filterAcceptableImages,
  filterPublishableImages,
} from './row-image-guard';
export { reconcileSyncEnginePostgres } from './reconcile-sync-engine-postgres';
export {
  defineTopicMap,
  subscribeTables,
  type TopicMap,
  type TopicMapCtx,
  type TopicMapEntry,
  type TopicMapRowImageGuard,
  topicMapCtxFromEnv,
  topicsFromHeldRows,
  topicsFromWriteCapture,
} from './topic-map';

/**
 * Public client surface for `@pkgs/sync-engine`.
 * Import from `@pkgs/sync-engine/client` only — deep paths are not public.
 */

export type {
  MutationClient,
  MutationClientIds,
  MutationConnectivity,
} from '../mutations/client/create-mutation-client';
export { createMutationClient } from '../mutations/client/create-mutation-client';
export { awaitMutationVerdict } from '../mutations/client/await-mutation-verdict';
export {
  notifySynchronously,
  type ScheduleNotify,
} from '../queries/client/sql-watch';
export type {
  AppLifecycle,
  AppLifecycleEvent,
} from './app-lifecycle';
export {
  type CreateLocalSyncEngineOptions,
  createLocalSyncEngine,
  type SyncEnginePushOptions,
} from './create-local-sync-engine';
export {
  clearPendingInteractionCorrelation,
  mutationCorrelationIdentity,
  mutationOriginTraceparent,
  pendingInteractionRequestTraceparent,
  runInInteractionRequestContext,
  setInteractionRequestRunner,
  setMutationCorrelationIdentity,
  setPendingInteractionCorrelation,
} from './interaction-correlation';
export { readLastSyncedAtMs } from './last-synced';
export type { LocalDomainSchema } from './local-schema-migrate';
export {
  clearLocalCache,
  getLocalSchemaTargetVersion,
  migrateLocalSchema,
} from './local-schema-migrate';
export type {
  MutationUploadResult,
  MutationUploadRow,
} from './mutation-upload-queue';
export type { QueryRequest } from './subscription-runtime';
export {
  type CreateSyncEnginePoolOptions,
  createSyncEnginePool,
  type SyncEnginePool,
  type SyncEnginePoolApi,
} from './sync-engine-pool';
export type {
  MutationStatus,
  SyncEngine,
  UnackedWriteRejection,
  WatchSubscription,
} from './sync-engine-port';
export {
  type CreateSyncHttpClientOptions,
  createSyncHttpClient,
  type GetFreshAuthToken,
  SyncApiAuthError,
  type SyncClientAuth,
  type SyncHttpClient,
  type SyncHttpFetch,
} from './sync-http-client';
export type {
  SyncConnectionState,
  SyncEngineStatus,
} from './sync-status';

/**
 * Public client surface for `@pkgs/sync-engine`.
 * Import from `@pkgs/sync-engine/client` only — deep paths are not public.
 */

export type {
  MutationClient,
  MutationClientIds,
  MutationConnectivity,
} from '../mutations/client/create-mutation-client';
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
  MutationClientProvider,
  type MutationClientProviderProps,
  useMutationClient,
} from './mutation-client-provider';
export type {
  MutationUploadResult,
  MutationUploadRow,
} from './mutation-upload-queue';
export type { QueryRequest } from './subscription-runtime';
export {
  type SyncEngineApi,
  SyncEngineProvider,
  useQuery,
  useSyncEngine,
  useSyncEngineInstance,
} from './sync-engine-context';
export { SyncEnginePaintGateContext } from './sync-engine-paint-gate';
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

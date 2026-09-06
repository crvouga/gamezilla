/**
 * Solid bindings for `@pkgs/sync-engine`.
 * Import from `@pkgs/sync-engine/solid` only — deep paths are not public.
 */

export {
  MutationClientProvider,
  type MutationClientProviderProps,
  useMutationClient,
} from './mutation-client-provider';
export {
  createQuery,
  type QueryResult,
  type SyncEngineApi,
  SyncEnginePaintGateProvider,
  SyncEngineProvider,
  useSyncEngine,
  useSyncEngineInstance,
} from './sync-engine-context';

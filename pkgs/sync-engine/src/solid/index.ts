/**
 * Solid bindings for `@pkgs/sync-engine`.
 * Import from `@pkgs/sync-engine/solid` only — deep paths are not public.
 *
 * Tree-shake note: `useMutationClient` lives in a separate module from
 * `MutationClientProvider` so query/mutate hooks do not pull the SQL AST
 * parser (`createMutationClient` → `node-sql-parser`) into lazy route chunks.
 */

export { useMutationClient } from './mutation-client-context';
export {
  MutationClientProvider,
  type MutationClientProviderProps,
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

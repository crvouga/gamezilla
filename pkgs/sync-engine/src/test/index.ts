/**
 * Test / sim host seam for `@pkgs/sync-engine`.
 * Import from `@pkgs/sync-engine/test` only — not for product apps/libs.
 */

export {
  alwaysOnLifecycle,
  createControllableLifecycle,
} from '../client/app-lifecycle';
export type { LocalMigratePhase } from '../client/local-schema-migrate';
export { pruneMutationArtifacts } from '../mutations/server/prune-mutation-artifacts';
export { withFrameworkMutations } from '../mutations/shared/with-framework-mutations';
export { SCHEMA_EPOCH } from '../queries/client/local-schema';
export {
  createInMemorySyncEngine,
  type InMemorySyncEngineOptions,
} from './in-memory-sync-engine';

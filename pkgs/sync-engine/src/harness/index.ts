/**
 * Test / harness host seam for `@pkgs/sync-engine`.
 * Import from `@pkgs/sync-engine/harness` only — not for product apps/libs.
 */

export {
  alwaysOnLifecycle,
  createControllableLifecycle,
} from '../client/app-lifecycle';
export type { LocalMigratePhase } from '../client/local-schema-migrate';
export { pruneMutationArtifacts } from '../mutations/server/prune-mutation-artifacts';
export { withFrameworkMutations } from '../mutations/shared/with-framework-mutations';
export {
  ensureFrameworkSchema,
  SCHEMA_EPOCH,
} from '../queries/client/local-schema';
export type { HarnessClient } from './client';
export type { HarnessDomainPack, HarnessSessionQuery } from './domain-pack';
export { emptyHarnessPushChannels } from './domain-pack';
export type { HarnessHttpFault } from './edge-faults';
export * from './example-app';
export { DST_FAULTS, RELIABLE_FAULTS } from './faults';
export {
  createInMemorySyncEngine,
  type InMemorySyncEngineOptions,
} from './in-memory-sync-engine';
export type { SeededRng } from './rng';
export type { SyncApp, SyncArgs, SyncHarness } from './scenario';
export { deviceCanSynchronize } from './scenario';
export type { HarnessClock } from './types';
export type {
  NeverOptions,
  UntilTarget,
  WaitUntilOptions,
} from './wait-until';

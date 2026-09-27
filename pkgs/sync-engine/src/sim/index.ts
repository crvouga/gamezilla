/**
 * Test / sim host seam for `@pkgs/sync-engine`.
 * Import from `@pkgs/sync-engine/sim` only — not for product apps/libs.
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
export type { SimDomainPack, SimSessionQuery } from './domain-pack';
export { emptySimPushChannels } from './domain-pack';
export type { SimHttpFault } from './edge-faults';
export * from './example-app';
export { RELIABLE_FAULTS } from './faults';
export {
  createInMemorySyncEngine,
  type InMemorySyncEngineOptions,
} from './in-memory-sync-engine';
export type { SeededRng } from './rng';
export type { SyncApp, SyncArgs, SyncSim } from './scenario';
export type { SimClient } from './sim-client';
export type { SimClock } from './sim-types';
export type {
  NeverOptions,
  UntilTarget,
  WaitUntilOptions,
} from './wait-until';

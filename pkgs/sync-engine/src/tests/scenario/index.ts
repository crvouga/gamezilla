/**
 * PBT / system test helpers. Worlds and action replay are framework-owned:
 * `defineSyncSystem` + `check` / `replay` from `@pkgs/dst`.
 */

export type {
  DomainOp,
  LibraryAction,
  ServerOp,
  SyncAction,
  SyncApp,
  SyncSurface,
  SyncSystemDef,
  WorldKnobs,
  WorldModel,
  WorldReal,
} from '../../sim/scenario';
export {
  AUTH_STATUSES,
  arbKnobs,
  CLIENT_IDS,
  CORRUPTION_VARIANTS,
  CRASH_EVENTS,
  checkSync,
  defineSyncSystem,
  HOLD_TRAFFIC,
  HTTP_FAULTS,
  openSyncWorld,
  PUBSUB_FAULTS,
  playSyncActions,
  replaySyncPin,
  SCHEMA_VARIANTS,
  STORAGE_TAMPERS,
  SYNC_PROPERTIES,
  WORLD_PBT_CRASH_EVENTS,
} from '../../sim/scenario';
export { pickLibraryAction, pickSyncAction } from './pick-library-action';
export type { RunSeedOptions, RunSeedResult } from './run-seed';
export { runSeed, seedsFromEnv } from './run-seed';

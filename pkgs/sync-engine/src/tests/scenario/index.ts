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
  SyncSystemDef,
  SyncSystemWorld,
  WorldKnobs,
  WorldModel,
  WorldReal,
} from '../../sim/scenario';
export {
  AUTH_STATUSES,
  arbKnobs,
  arbSeed,
  CLIENT_IDS,
  CORRUPTION_VARIANTS,
  CRASH_EVENTS,
  defineSyncSystem,
  HOLD_TRAFFIC,
  HTTP_FAULTS,
  PUBSUB_FAULTS,
  playSyncActions,
  SCHEMA_VARIANTS,
  STORAGE_TAMPERS,
  WORLD_PBT_CRASH_EVENTS,
} from '../../sim/scenario';
export { pickLibraryAction, pickSyncAction } from './pick-library-action';
export type { RunSeedOptions, RunSeedResult } from './run-seed';
export { runSeed, seedsFromEnv } from './run-seed';

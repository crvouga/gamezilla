/**
 * PBT / system test helpers. Runs and action replay are framework-owned:
 * `defineSyncSystem` + `start` / `check` / `replay` from `@pkgs/dst`.
 */

export type {
  DomainOp,
  LibraryAction,
  ServerOp,
  SyncAction,
  SyncApp,
  SyncKnobs,
  SyncModel,
  SyncReal,
  SyncSurface,
  SyncSystemDef,
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
  PUBSUB_FAULTS,
  SCHEMA_VARIANTS,
  SIM_PBT_CRASH_EVENTS,
  STORAGE_TAMPERS,
  SYNC_PROPERTIES,
  syncSystemDraws,
  syncVirtualHost,
} from '../../sim/scenario';
export { pickLibraryAction, pickSyncAction } from './pick-library-action';
export type { RunSeedOptions, RunSeedResult } from './run-seed';
export { runSeed, seedsFromEnv } from './run-seed';

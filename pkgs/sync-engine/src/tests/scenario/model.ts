/**
 * Model helpers and PBT constants — canonical copy lives in `sim/scenario/model`.
 */
export type { SyncModel, SyncReal } from '../../sim/scenario/model';
export {
  AUTH_STATUSES,
  applyActionToModel,
  CLIENT_IDS,
  CORRUPTION_VARIANTS,
  CRASH_EVENTS,
  clientLive,
  domainOp,
  HOLD_TRAFFIC,
  HTTP_FAULTS,
  initialSyncModel,
  modelAllowsAction,
  PUBSUB_FAULTS,
  SCHEMA_VARIANTS,
  SIM_PBT_CRASH_EVENTS,
  STORAGE_TAMPERS,
  serverOp,
} from '../../sim/scenario/model';

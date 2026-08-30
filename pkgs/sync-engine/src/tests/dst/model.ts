/**
 * Model helpers and PBT constants — canonical copy lives in `sim/dst/world-model`.
 */
export type { WorldModel, WorldReal } from '../../sim/dst/world-model';
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
  initialWorldModel,
  modelAllowsAction,
  PUBSUB_FAULTS,
  SCHEMA_VARIANTS,
  serverOp,
  STORAGE_TAMPERS,
  WORLD_PBT_CRASH_EVENTS,
} from '../../sim/dst/world-model';
